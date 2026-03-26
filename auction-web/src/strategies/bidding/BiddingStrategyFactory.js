import { NormalBidStrategy } from './NormalBidStrategy.js';
import { AutoBidStrategy } from './AutoBidStrategy.js';
import { BuyNowBidStrategy } from './BuyNowBidStrategy.js';

export class BiddingStrategyFactory {
  static get(product, userId, bidAmount) {
    const buyNowPrice = product.buy_now_price ? parseFloat(product.buy_now_price) : null;
    
    if (buyNowPrice && bidAmount >= buyNowPrice) {
      return new BuyNowBidStrategy();
    }
    if (product.highest_bidder_id === userId) {
      return new AutoBidStrategy();
    }
    return new NormalBidStrategy();
  }
}
