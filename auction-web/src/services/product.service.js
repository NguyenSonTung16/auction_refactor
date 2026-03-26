import * as systemSettingModel from '../models/systemSetting.model.js';
import * as productModel from '../models/product.model.js';

export const prepareProductList = async (products) => {
  const now = new Date();
  if (!products) return [];
  
  const settings = await systemSettingModel.getSettings();
  const N_MINUTES = settings.new_product_limit_minutes;
  
  return products.map(product => {
    const created = new Date(product.created_at);
    const isNew = (now - created) < (N_MINUTES * 60 * 1000);

    return {
      ...product,
      is_new: isNew
    };
  });
};

export const getProductStatus = async (product, productId) => {
  const now = new Date();
  const endDate = new Date(product.end_at);
  
  // Auto-close auction if time expired and not yet closed
  if (endDate <= now && !product.closed_at && product.is_sold === null) {
    await productModel.updateProduct(productId, { closed_at: endDate });
    product.closed_at = endDate;
  }
  
  if (product.is_sold === true) return 'SOLD';
  if (product.is_sold === false) return 'CANCELLED';
  if ((endDate <= now || product.closed_at) && product.highest_bidder_id) return 'PENDING';
  if (endDate <= now && !product.highest_bidder_id) return 'EXPIRED';
  
  return 'ACTIVE';
};
