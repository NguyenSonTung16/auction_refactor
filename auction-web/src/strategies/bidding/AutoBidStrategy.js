import { BiddingStrategy } from './BiddingStrategy.js';
import { NormalBidStrategy } from './NormalBidStrategy.js';

export class AutoBidStrategy extends BiddingStrategy {
  async calculate(product, userId, bidAmount, trx) {
    if (product.highest_bidder_id === userId) {
      return {
        newCurrentPrice: parseFloat(product.current_price),
        newHighestBidderId: userId,
        newHighestMaxPrice: bidAmount,
        shouldCreateHistory: false
      };
    }
    return new NormalBidStrategy().calculate(product, userId, bidAmount, trx);
  }
}
