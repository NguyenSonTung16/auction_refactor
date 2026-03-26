import { BiddingStrategy } from './BiddingStrategy.js';

export class BuyNowBidStrategy extends BiddingStrategy {
  async calculate(product, userId, bidAmount, trx) {
    const buyNowPrice = parseFloat(product.buy_now_price);
    return {
      newCurrentPrice: buyNowPrice,
      newHighestBidderId: userId,
      newHighestMaxPrice: buyNowPrice,
      productSold: true
    };
  }
}
