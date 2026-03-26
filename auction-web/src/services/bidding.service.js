import { BiddingStrategyFactory } from '../strategies/bidding/BiddingStrategyFactory.js';
import db from '../utils/db.js';
import * as reviewModel from '../models/review.model.js';
import * as systemSettingModel from '../models/systemSetting.model.js';
import * as userModel from '../models/user.model.js';
import * as productModel from '../models/product.model.js';
import * as rejectedBidderModel from '../models/rejectedBidder.model.js';
import { sendMail } from '../utils/mailer.js';

export const placeBid = async (productId, userId, bidAmount) => {
  const result = await db.transaction(async (trx) => {
    // 1. Lock the product row
    const product = await trx('products')
      .where('id', productId)
      .forUpdate()
      .first();
    
    if (!product) throw new Error('Product not found');
    if (product.is_sold === true) throw new Error('This product has already been sold');
    if (product.seller_id === userId) throw new Error('You cannot bid on your own product');

    // 2. Check rejected bidder
    const isRejected = await trx('rejected_bidders')
      .where({ product_id: productId, bidder_id: userId })
      .first();
    if (isRejected) throw new Error('You have been rejected from bidding on this product');

    // 3. Rating validation
    const ratingPointObj = await reviewModel.calculateRatingPoint(userId);
    const ratingPoint = ratingPointObj ? ratingPointObj.rating_point : 0;
    const userReviews = await reviewModel.getReviewsByUserId(userId);
    const hasReviews = userReviews.length > 0;
    
    if (!hasReviews) {
      if (!product.allow_unrated_bidder) {
        throw new Error('This seller does not allow unrated bidders to bid on this product.');
      }
    } else if (ratingPoint < 0) {
      throw new Error('You are not eligible to place bids due to your rating.');
    } else if (ratingPoint === 0) {
      throw new Error('You are not eligible to place bids due to your rating.');
    } else if (ratingPoint <= 0.8) {
      throw new Error('Your rating point is not greater than 80%. You cannot place bids.');
    }

    // 4. Timing validation
    const now = new Date();
    const endDate = new Date(product.end_at);
    if (now > endDate) throw new Error('Auction has ended');

    // 5. Bid amount validation
    const currentPrice = parseFloat(product.current_price || product.starting_price);
    const minIncrement = parseFloat(product.step_price);
    if (bidAmount < currentPrice + minIncrement) {
      throw new Error(`Bid must be at least ${minIncrement.toLocaleString()} VND higher than current price`);
    }

    // 6. Auto-extend logic
    let extendedEndTime = null;
    if (product.auto_extend) {
      const settings = await systemSettingModel.getSettings();
      const triggerMinutes = settings?.auto_extend_trigger_minutes;
      const extendMinutes = settings?.auto_extend_duration_minutes;
      const minutesRemaining = (endDate - now) / (1000 * 60);
      if (minutesRemaining <= triggerMinutes) {
        extendedEndTime = new Date(endDate.getTime() + extendMinutes * 60 * 1000);
      }
    }

    // 7. Core Bidding Logic (USING STRATEGY PATTERN)
    const strategy = BiddingStrategyFactory.get(product, userId, bidAmount);
    const strategyResult = await strategy.calculate(product, userId, bidAmount, trx);

    const newCurrentPrice = strategyResult.newCurrentPrice;
    const newHighestBidderId = strategyResult.newHighestBidderId;
    const newHighestMaxPrice = strategyResult.newHighestMaxPrice;
    const shouldCreateHistory = strategyResult.shouldCreateHistory !== false;
    const buyNowTriggered = strategyResult.productSold === true;

    const updateData = {
      current_price: newCurrentPrice,
      highest_bidder_id: newHighestBidderId,
      highest_max_price: newHighestMaxPrice
    };

    if (buyNowTriggered) {
      updateData.end_at = new Date();
      updateData.closed_at = new Date();
    } else if (extendedEndTime) {
      updateData.end_at = extendedEndTime;
    }

    await trx('products').where('id', productId).update(updateData);

    if (shouldCreateHistory) {
      await trx('bidding_history').insert({
        product_id: productId, bidder_id: newHighestBidderId, current_price: newCurrentPrice
      });
    }

    await trx.raw(`
      INSERT INTO auto_bidding (product_id, bidder_id, max_price)
      VALUES (?, ?, ?)
      ON CONFLICT (product_id, bidder_id)
      DO UPDATE SET max_price = EXCLUDED.max_price, created_at = NOW()
    `, [productId, userId, bidAmount]);

    return { 
      newCurrentPrice, newHighestBidderId, userId, bidAmount, productSold: buyNowTriggered,
      autoExtended: !!extendedEndTime, newEndTime: extendedEndTime, productName: product.name,
      sellerId: product.seller_id, previousHighestBidderId: product.highest_bidder_id,
      previousPrice: currentPrice, priceChanged: currentPrice !== newCurrentPrice
    };
  });

  // ========== EMAILS (Outside Transaction) ==========
  (async () => {
    try {
      const [seller, currentBidder, previousBidder] = await Promise.all([
        userModel.findById(result.sellerId),
        userModel.findById(result.userId),
        result.previousHighestBidderId ? userModel.findById(result.previousHighestBidderId) : null
      ]);

      const emailPromises = [];
      if (seller?.email) emailPromises.push(sendMail({ to: seller.email, subject: `💰 New bid: ${result.productName}`, html: `<h3>New Bid!</h3><p>${result.newCurrentPrice} VND</p>` }));
      if (currentBidder?.email) emailPromises.push(sendMail({ to: currentBidder.email, subject: `✅ winning: ${result.productName}`, html: `<h3>You're winning!</h3>` }));
      if (previousBidder?.email && result.priceChanged) emailPromises.push(sendMail({ to: previousBidder.email, subject: `⚠️ Outbid: ${result.productName}`, html: `<h3>Outbid!</h3>` }));
      
      await Promise.all(emailPromises);
    } catch (e) { console.error('Email failed', e); }
  })();

  const message = result.productSold 
    ? (result.newHighestBidderId === userId ? 'You won!' : 'Sold to another.') 
    : (result.newHighestBidderId === userId ? 'Bid placed, you win!' : 'Bid placed, outbid.');
    
  return { ...result, message };
};

export const rejectBidder = async (productId, bidderId, sellerId) => {
  await db.transaction(async (trx) => {
    const product = await trx('products').where('id', productId).forUpdate().first();
    if (!product) throw new Error('Product not found');
    if (product.seller_id !== sellerId) throw new Error('Only the seller can reject bidders');

    const now = new Date();
    const endDate = new Date(product.end_at);
    if (product.is_sold !== null || endDate <= now || product.closed_at) {
      throw new Error('Can only reject bidders for active auctions');
    }

    const autoBid = await trx('auto_bidding').where({ product_id: productId, bidder_id: bidderId }).first();
    if (!autoBid) throw new Error('This bidder has not placed a bid on this product');
    
    await trx('rejected_bidders').insert({ product_id: productId, bidder_id: bidderId, seller_id: sellerId }).onConflict(['product_id', 'bidder_id']).ignore();
    await trx('bidding_history').where({ product_id: productId, bidder_id: bidderId }).del();
    await trx('auto_bidding').where({ product_id: productId, bidder_id: bidderId }).del();
    
    // ... rest of the recalculated logic ...

    const remainingBids = await trx('auto_bidding').where('product_id', productId).orderBy('max_price', 'desc');
    if (remainingBids.length === 0) {
      await trx('products').where('id', productId).update({ highest_bidder_id: null, current_price: product.starting_price, highest_max_price: null });
    } else {
      const winner = remainingBids[0];
      const second = remainingBids[1];
      let newPrice = second ? Math.min(second.max_price + product.step_price, winner.max_price) : product.starting_price;
      await trx('products').where('id', productId).update({ highest_bidder_id: winner.bidder_id, current_price: newPrice, highest_max_price: winner.max_price });
    }
  });

  // ========== SEND REJECTION EMAIL (outside transaction) ==========
  (async () => {
    try {
      const [rejectedBidderInfo, productInfo, sellerInfo] = await Promise.all([
        userModel.findById(bidderId),
        productModel.findByProductId2(productId, null),
        userModel.findById(sellerId)
      ]);

      if (rejectedBidderInfo?.email && productInfo) {
        await sendMail({
          to: rejectedBidderInfo.email,
          subject: `Your bid has been rejected: ${productInfo.name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0;">Bid Rejected</h1>
              </div>
              <div style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                <p>Dear <strong>${rejectedBidderInfo.fullname}</strong>,</p>
                <p>We regret to inform you that the seller has rejected your bid on the following product:</p>
                <div style="background-color: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #dc3545;">
                  <h3 style="margin: 0 0 10px 0; color: #333;">${productInfo.name}</h3>
                  <p style="margin: 5px 0; color: #666;"><strong>Seller:</strong> ${sellerInfo ? sellerInfo.fullname : 'N/A'}</p>
                </div>
                <p style="color: #666;">This means you can no longer place bids on this specific product. Your previous bids on this product have been removed.</p>
                <p style="color: #666;">You can still participate in other auctions on our platform.</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="/products/category" style="display: inline-block; background: linear-gradient(135deg, #72AEC8 0%, #5a9ab8 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                    Browse Other Auctions
                  </a>
                </div>
                <p style="color: #888; font-size: 13px;">If you believe this was done in error, please contact our support team.</p>
              </div>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="color: #888; font-size: 12px; text-align: center;">This is an automated message from Online Auction. Please do not reply to this email.</p>
            </div>
          `
        });
      }
    } catch (error) {
      console.error('Failed to send rejection email:', error);
    }
  })();
};

export const buyNow = async (productId, userId) => {
  return await db.transaction(async (trx) => {
    const product = await trx('products')
      .leftJoin('users as seller', 'products.seller_id', 'seller.id')
      .where('products.id', productId)
      .select('products.*', 'seller.fullname as seller_name')
      .first();

    if (!product) throw new Error('Product not found');
    if (product.seller_id === userId) throw new Error('Seller cannot buy their own product');

    const now = new Date();
    const endDate = new Date(product.end_at);
    if (product.is_sold !== null) throw new Error('Product is no longer available');
    if (endDate <= now || product.closed_at) throw new Error('Auction has already ended');
    if (!product.buy_now_price) throw new Error('Buy Now option is not available for this product');

    const isRejected = await trx('rejected_bidders').where({ product_id: productId, bidder_id: userId }).first();
    if (isRejected) throw new Error('You have been rejected from bidding on this product');

    if (!product.allow_unrated_bidder) {
      const ratingPointObj = await reviewModel.calculateRatingPoint(userId);
      const ratingPoint = ratingPointObj ? ratingPointObj.rating_point : 0;
      if (ratingPoint === 0) throw new Error('This product does not allow bidders without ratings');
    }

    const buyNowPrice = parseFloat(product.buy_now_price);
    await trx('products').where('id', productId).update({
      current_price: buyNowPrice, highest_bidder_id: userId, highest_max_price: buyNowPrice,
      end_at: now, closed_at: now, is_buy_now_purchase: true
    });
    await trx('bidding_history').insert({ product_id: productId, bidder_id: userId, current_price: buyNowPrice, is_buy_now: true });
    return { success: true };
  });
};

export const unrejectBidder = async (productId, bidderId, sellerId) => {
  const product = await productModel.findByProductId2(productId, sellerId);
  if (!product || product.seller_id !== sellerId) throw new Error('Unauthorized or product not found');
  await rejectedBidderModel.unrejectBidder(productId, bidderId);
};
