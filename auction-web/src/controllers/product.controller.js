import * as productModel from '../models/product.model.js';
import * as categoryModel from '../models/category.model.js';
import * as productService from '../services/product.service.js';
import * as biddingService from '../services/bidding.service.js';
import * as productDescUpdateModel from '../models/productDescriptionUpdate.model.js';
import * as biddingHistoryModel from '../models/biddingHistory.model.js';
import * as productCommentModel from '../models/productComment.model.js';
import * as rejectedBidderModel from '../models/rejectedBidder.model.js';
import * as reviewModel from '../models/review.model.js';
import * as watchListModel from '../models/watchlist.model.js';
import * as orderModel from '../models/order.model.js';
import * as invoiceModel from '../models/invoice.model.js';
import * as orderChatModel from '../models/orderChat.model.js';
import * as userModel from '../models/user.model.js';

export const getByCategory = async (req, res) => {
  const userId = req.session.authUser ? req.session.authUser.id : null;
  const sort = req.query.sort || '';
  const categoryId = req.query.catid;
  const page = parseInt(req.query.page) || 1;
  const limit = 3;
  const offset = (page - 1) * limit;
  
  const category = await categoryModel.findByCategoryId(categoryId);
  let categoryIds = [categoryId];
  
  if (category && category.parent_id === null) {
    const childCategories = await categoryModel.findChildCategoryIds(categoryId);
    const childIds = childCategories.map(cat => cat.id);
    categoryIds = [categoryId, ...childIds];
  }
  
  const list = await productModel.findByCategoryIds(categoryIds, limit, offset, sort, userId);
  const products = await productService.prepareProductList(list);
  const total = await productModel.countByCategoryIds(categoryIds);
  
  const totalCount = parseInt(total.count) || 0;
  const nPages = Math.ceil(totalCount / limit);
  let from = (page - 1) * limit + 1;
  let to = page * limit;
  if (to > totalCount) to = totalCount;
  if (totalCount === 0) { from = 0; to = 0; }

  res.render('vwProduct/list', { 
    products,
    totalCount,
    from,
    to,
    currentPage: page,
    totalPages: nPages,
    categoryId: categoryId,
    categoryName: category ? category.name : null,
    sort,
  });
};

export const searchProducts = async (req, res) => {
  const userId = req.session.authUser ? req.session.authUser.id : null;
  const q = req.query.q || '';
  const logic = req.query.logic || 'and';
  const sort = req.query.sort || '';
  
  if (q.length === 0) {
    return res.render('vwProduct/list', {
      q, logic, sort, products: [], totalCount: 0, from: 0, to: 0, currentPage: 1, totalPages: 0,
    });
  }

  const limit = 3;
  const page = parseInt(req.query.page) || 1;
  const offset = (page - 1) * limit;
  
  const keywords = q.trim();
  const list = await productModel.searchPageByKeywords(keywords, limit, offset, userId, logic, sort);
  const products = await productService.prepareProductList(list);
  const total = await productModel.countByKeywords(keywords, logic);
  const totalCount = parseInt(total.count) || 0;
  
  const nPages = Math.ceil(totalCount / limit);
  let from = (page - 1) * limit + 1;
  let to = page * limit;
  if (to > totalCount) to = totalCount;
  if (totalCount === 0) { from = 0; to = 0; }
  
  res.render('vwProduct/list', { 
    products, totalCount, from, to, currentPage: page, totalPages: nPages, q, logic, sort,
  });
};

export const getDetail = async (req, res) => {
  const userId = req.session.authUser ? req.session.authUser.id : null;
  const productId = req.query.id;
  
  const product = await productModel.findByProductId2(productId, userId);
  if (!product) {
    return res.status(404).render('404', { message: 'Product not found' });
  }

  const productStatus = await productService.getProductStatus(product, productId);
  
  if (productStatus !== 'ACTIVE') {
    if (!userId) {
      return res.status(403).render('403', { message: 'You do not have permission to view this product' });
    }
    const isSeller = product.seller_id === userId;
    const isHighestBidder = product.highest_bidder_id === userId;
    if (!isSeller && !isHighestBidder) {
      return res.status(403).render('403', { message: 'You do not have permission to view this product' });
    }
  }

  const commentPage = parseInt(req.query.commentPage) || 1;
  const commentsPerPage = 2;
  const offset = (commentPage - 1) * commentsPerPage;

  const [descriptionUpdates, biddingHistory, comments, totalComments, related_products] = await Promise.all([
    productDescUpdateModel.findByProductId(productId),
    biddingHistoryModel.getBiddingHistory(productId),
    productCommentModel.getCommentsByProductId(productId, commentsPerPage, offset),
    productCommentModel.countCommentsByProductId(productId),
    productModel.findRelatedProducts(productId)
  ]);

  let rejectedBidders = [];
  if (req.session.authUser && product.seller_id === req.session.authUser.id) {
    rejectedBidders = await rejectedBidderModel.getRejectedBidders(productId);
  }
  
  if (comments.length > 0) {
    const commentIds = comments.map(c => c.id);
    const allReplies = await productCommentModel.getRepliesByCommentIds(commentIds);
    const repliesMap = new Map();
    for (const reply of allReplies) {
      if (!repliesMap.has(reply.parent_id)) repliesMap.set(reply.parent_id, []);
      repliesMap.get(reply.parent_id).push(reply);
    }
    for (const comment of comments) {
      comment.replies = repliesMap.get(comment.id) || [];
    }
  }
  
  const totalPages = Math.ceil(totalComments / commentsPerPage);
  const { success_message, error_message } = req.session;
  delete req.session.success_message;
  delete req.session.error_message;

  const [sellerRating, bidderRating] = await Promise.all([
    reviewModel.calculateRatingPoint(product.seller_id),
    product.highest_bidder_id ? reviewModel.calculateRatingPoint(product.highest_bidder_id) : { rating_point: null }
  ]);

  const [sellerReviews, bidderReviews] = await Promise.all([
    reviewModel.getReviewsByUserId(product.seller_id),
    product.highest_bidder_id ? reviewModel.getReviewsByUserId(product.highest_bidder_id) : []
  ]);
  
  let showPaymentButton = false;
  if (req.session.authUser && productStatus === 'PENDING') {
    showPaymentButton = (product.seller_id === userId || product.highest_bidder_id === userId);
  }
  
  res.render('vwProduct/details', { 
    product, productStatus, authUser: req.session.authUser, descriptionUpdates, biddingHistory,
    rejectedBidders, comments, success_message, error_message, related_products,
    seller_rating_point: sellerRating.rating_point, seller_has_reviews: sellerReviews.length > 0,
    bidder_rating_point: bidderRating.rating_point, bidder_has_reviews: bidderReviews.length > 0,
    commentPage, totalPages, totalComments, showPaymentButton
  });
};

export const postBid = async (req, res) => {
  const { productId, bidAmount: rawBidAmount } = req.body;
  const userId = req.session.authUser.id;
  try {
    const bidAmount = parseFloat(rawBidAmount.replace(/,/g, ''));
    const result = await biddingService.placeBid(productId, userId, bidAmount);
    
    let baseMessage = '';
    if (result.productSold) {
      if (result.newHighestBidderId === result.userId) {
        baseMessage = `Congratulations! You won the product with Buy Now price: ${result.newCurrentPrice.toLocaleString()} VND. Please proceed to payment.`;
      } else {
        baseMessage = `Product has been sold to another bidder at Buy Now price: ${result.newCurrentPrice.toLocaleString()} VND. Your bid helped reach the Buy Now threshold.`;
      }
    } else if (result.newHighestBidderId === result.userId) {
      baseMessage = `Bid placed successfully! Current price: ${result.newCurrentPrice.toLocaleString()} VND (Your max: ${result.bidAmount.toLocaleString()} VND)`;
    } else {
      baseMessage = `Bid placed! Another bidder is currently winning at ${result.newCurrentPrice.toLocaleString()} VND`;
    }
    
    if (result.autoExtended) {
      const extendedTimeStr = new Date(result.newEndTime).toLocaleString('vi-VN');
      baseMessage += ` | Auction extended to ${extendedTimeStr}`;
    }
    
    req.session.success_message = baseMessage;
    res.redirect(`/products/detail?id=${productId}`);
  } catch (error) {
    console.error('Bid error:', error);
    req.session.error_message = error.message || 'An error occurred while placing bid. Please try again.';
    res.redirect(`/products/detail?id=${productId}`);
  }
};

export const addToWatchlist = async (req, res) => {
  const userId = req.session.authUser.id;
  const productId = req.body.productId;
  const isInWatchlist = await watchListModel.isInWatchlist(userId, productId);
  if (!isInWatchlist) {
    await watchListModel.addToWatchlist(userId, productId);
  }
  res.redirect(req.headers.referer || '/');
};

export const removeFromWatchlist = async (req, res) => {
  const userId = req.session.authUser.id;
  const productId = req.body.productId;
  await watchListModel.removeFromWatchlist(userId, productId);
  res.redirect(req.headers.referer || '/');
};

export const postComment = async (req, res) => {
  const { productId, content, parentId } = req.body;
  const userId = req.session.authUser.id;
  try {
    if (!content || content.trim().length === 0) {
      req.session.error_message = 'Comment cannot be empty';
      return res.redirect(`/products/detail?id=${productId}`);
    }

    await productCommentModel.createComment(productId, userId, content.trim(), parentId || null);

    // Fire and forget email notifications
    (async () => {
      try {
        const [product, commenter, seller] = await Promise.all([
          productModel.findByProductId2(productId, null),
          userModel.findById(userId),
          null // will get seller later
        ]);
        const sellerInfo = await userModel.findById(product.seller_id);
        const productUrl = `${req.protocol}://${req.get('host')}/products/detail?id=${productId}`;
        const isSellerReplying = userId === product.seller_id;

        if (isSellerReplying && parentId) {
          const [bidders, commenters] = await Promise.all([
            biddingHistoryModel.getUniqueBidders(productId),
            productCommentModel.getUniqueCommenters(productId)
          ]);
          const recipientsMap = new Map();
          [...bidders, ...commenters].forEach(u => {
            if (u.id !== product.seller_id && u.email) recipientsMap.set(u.id, u);
          });
          for (const recipient of recipientsMap.values()) {
            await sendMail({
              to: recipient.email,
              subject: `Seller answered a question on: ${product.name}`,
              html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #667eea;">Seller Response on Product</h2>
                <p>Dear <strong>${recipient.fullname}</strong>,</p>
                <p>The seller has responded to a question on a product you're interested in:</p>
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
                  <p><strong>Product:</strong> ${product.name}</p>
                  <p><strong>Seller:</strong> ${sellerInfo.fullname}</p>
                  <p><strong>Answer:</strong></p>
                  <p style="background-color: white; padding: 15px; border-radius: 5px; border-left: 4px solid #667eea;">${content}</p>
                </div>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${productUrl}" style="display: inline-block; background-color: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Product</a>
                </div>
              </div>`
            });
          }
        } else if (sellerInfo?.email && userId !== product.seller_id) {
          const subject = parentId ? `New reply on your product: ${product.name}` : `New question about your product: ${product.name}`;
          await sendMail({
            to: sellerInfo.email,
            subject,
            html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #667eea;">${parentId ? 'New Reply' : 'New Question'} About Your Product</h2>
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
                <p><strong>Product:</strong> ${product.name}</p>
                <p><strong>From:</strong> ${commenter.fullname}</p>
                <p><strong>${parentId ? 'Reply' : 'Question'}:</strong></p>
                <p style="background-color: white; padding: 15px; border-radius: 5px;">${content}</p>
              </div>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${productUrl}" style="display: inline-block; background-color: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Product</a>
              </div>
            </div>`
          });
        }
      } catch (err) { console.error('Comment email error:', err); }
    })();

    req.session.success_message = 'Comment posted successfully!';
    res.redirect(`/products/detail?id=${productId}`);
  } catch (error) {
    console.error('Comment error:', error);
    req.session.error_message = 'Failed to post comment. Please try again.';
    res.redirect(`/products/detail?id=${productId}`);
  }
};

export const getBiddingHistory = async (req, res) => {
  const productId = req.query.id;
  if (!productId) return res.redirect('/');
  const product = await productModel.findByProductId2(productId, null);
  if (!product) return res.status(404).render('404', { message: 'Product not found' });
  const history = await biddingHistoryModel.getBiddingHistory(productId);
  res.render('vwProduct/biddingHistory', { product, biddingHistory: history });
};

export const getCompleteOrder = async (req, res) => {
  const userId = req.session.authUser.id;
  const productId = req.query.id;
  if (!productId) return res.redirect('/');
  const product = await productModel.findByProductId2(productId, userId);
  if (!product) return res.status(404).render('404', { message: 'Product not found' });
  
  const productStatus = await productService.getProductStatus(product, productId);
  if (productStatus !== 'PENDING') return res.redirect(`/products/detail?id=${productId}`);
  
  const isSeller = product.seller_id === userId;
  const isHighestBidder = product.highest_bidder_id === userId;
  if (!isSeller && !isHighestBidder) return res.status(403).render('403', { message: 'No permission' });
  
  let order = await orderModel.findByProductId(productId);
  if (!order) {
    await orderModel.createOrder({ product_id: productId, buyer_id: product.highest_bidder_id, seller_id: product.seller_id, final_price: product.current_price || 0 });
    order = await orderModel.findByProductId(productId);
  }
  
  const [paymentInvoice, shippingInvoice, messages] = await Promise.all([
    invoiceModel.getPaymentInvoice(order.id),
    invoiceModel.getShippingInvoice(order.id),
    orderChatModel.getMessagesByOrderId(order.id)
  ]);
  
  res.render('vwProduct/complete-order', {
    product, order, paymentInvoice, shippingInvoice, messages, isSeller, isHighestBidder, currentUserId: userId
  });
};

export const postSubmitPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.session.authUser.id;
    const { payment_method, payment_proof_urls, note, shipping_address, shipping_phone } = req.body;
    const order = await orderModel.findById(orderId);
    if (!order || order.buyer_id !== userId) return res.status(403).json({ error: 'Unauthorized' });
    
    await invoiceModel.createPaymentInvoice({ order_id: orderId, issuer_id: userId, payment_method, payment_proof_urls, note });
    await orderModel.updateShippingInfo(orderId, { shipping_address, shipping_phone });
    await orderModel.updateStatus(orderId, 'payment_submitted', userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const postConfirmPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.session.authUser.id;
    const order = await orderModel.findById(orderId);
    if (!order || order.seller_id !== userId) return res.status(403).json({ error: 'Unauthorized' });
    const paymentInvoice = await invoiceModel.getPaymentInvoice(orderId);
    if (!paymentInvoice) return res.status(400).json({ error: 'No invoice' });
    await invoiceModel.verifyInvoice(paymentInvoice.id);
    await orderModel.updateStatus(orderId, 'payment_confirmed', userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const postSubmitShipping = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.session.authUser.id;
    const { tracking_number, shipping_provider, shipping_proof_urls, note } = req.body;
    const order = await orderModel.findById(orderId);
    if (!order || order.seller_id !== userId) return res.status(403).json({ error: 'Unauthorized' });
    await invoiceModel.createShippingInvoice({ order_id: orderId, issuer_id: userId, tracking_number, shipping_provider, shipping_proof_urls, note });
    await orderModel.updateStatus(orderId, 'shipped', userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const postConfirmDelivery = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.session.authUser.id;
    const order = await orderModel.findById(orderId);
    if (!order || order.buyer_id !== userId) return res.status(403).json({ error: 'Unauthorized' });
    await orderModel.updateStatus(orderId, 'delivered', userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const postRejectBidder = async (req, res) => {
  const { productId, bidderId } = req.body;
  const sellerId = req.session.authUser.id;
  try {
    await biddingService.rejectBidder(productId, bidderId, sellerId);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const postBuyNow = async (req, res) => {
  const { productId } = req.body;
  const userId = req.session.authUser.id;
  try {
    const result = await biddingService.buyNow(productId, userId);
    res.json({ 
      success: true, 
      message: 'Congratulations! You have successfully purchased the product at Buy Now price. Please proceed to payment.',
      redirectUrl: `/products/complete-order?id=${productId}` 
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getChatMessages = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.session.authUser.id;
    const order = await orderModel.findById(orderId);
    if (!order || (order.buyer_id !== userId && order.seller_id !== userId)) return res.status(403).json({ error: 'Unauthorized' });
    const messages = await orderChatModel.getMessagesByOrderId(orderId);
    res.json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const postSendMessage = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.session.authUser.id;
    const { message } = req.body;
    const order = await orderModel.findById(orderId);
    if (!order || (order.buyer_id !== userId && order.seller_id !== userId)) return res.status(403).json({ error: 'Unauthorized' });
    await orderChatModel.sendMessage({ order_id: orderId, sender_id: userId, message });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getSellerRatings = async (req, res) => {
  const sellerId = parseInt(req.params.sellerId);
  const seller = await userModel.findById(sellerId);
  if (!seller) return res.redirect('/');
  const ratingData = await reviewModel.calculateRatingPoint(sellerId);
  const reviews = await reviewModel.getReviewsByUserId(sellerId);
  res.render('vwProduct/seller-ratings', {
    sellerName: seller.fullname, rating_point: ratingData?.rating_point || 0,
    totalReviews: reviews.length, reviews
  });
};

export const getBidderRatings = async (req, res) => {
  const bidderId = parseInt(req.params.bidderId);
  const bidder = await userModel.findById(bidderId);
  if (!bidder) return res.redirect('/');
  const ratingData = await reviewModel.calculateRatingPoint(bidderId);
  const reviews = await reviewModel.getReviewsByUserId(bidderId);
  const maskedName = bidder.fullname.split('').map((c, i) => i % 2 === 0 ? c : '*').join('');
  res.render('vwProduct/bidder-ratings', {
    bidderName: maskedName, rating_point: ratingData?.rating_point || 0,
    totalReviews: reviews.length, reviews
  });
};

export const postCompleteTransaction = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.session.authUser.id;
    await orderModel.updateStatus(orderId, 'completed', userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const postSubmitRating = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.session.authUser.id;
    const { rating, comment } = req.body;
    const order = await orderModel.findById(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const isBuyer = order.buyer_id === userId;
    const revieweeId = isBuyer ? order.seller_id : order.buyer_id;
    await reviewModel.create({ reviewer_id: userId, reviewed_user_id: revieweeId, product_id: order.product_id, rating: rating === 'positive' ? 1 : -1, comment });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const postUnrejectBidder = async (req, res) => {
  const { productId, bidderId } = req.body;
  const sellerId = req.session.authUser.id;
  try {
    await biddingService.unrejectBidder(productId, bidderId, sellerId);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
