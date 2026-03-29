import * as categoryModel from '../../models/category.model.js';

const getCategorySearchModal =async (req, res) => {
  try {
    const categories = await categoryModel.findAll();
    // Add level information based on parent_id
    const categoriesWithLevel = categories.map(cat => ({
      ...cat,
      level: cat.parent_id ? 2 : 1
    }));
    res.json({ categories: categoriesWithLevel });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to load categories' });
  }
};
export {getCategorySearchModal};