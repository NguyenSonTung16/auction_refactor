import { BiddingStrategy } from './BiddingStrategy.js';

export class NormalBidStrategy extends BiddingStrategy {
  async calculate(product, userId, bidAmount, trx) {
    const minIncrement = parseFloat(product.step_price);
    
    if (!product.highest_bidder_id || !product.highest_max_price) {
      return { 
        newCurrentPrice: product.starting_price, 
        newHighestBidderId: userId, 
        newHighestMaxPrice: bidAmount 
      };
    }

    const currentHighestMaxPrice = parseFloat(product.highest_max_price);
    const currentHighestBidderId = product.highest_bidder_id;

    if (bidAmount <= currentHighestMaxPrice) {
      return { 
        newCurrentPrice: bidAmount, 
        newHighestBidderId: currentHighestBidderId, 
        newHighestMaxPrice: currentHighestMaxPrice 
      };
    } else {
      return { 
        newCurrentPrice: currentHighestMaxPrice + minIncrement, 
        newHighestBidderId: userId, 
        newHighestMaxPrice: bidAmount 
      };
    }
  }
}
