import * as categoryModel from '../models/category.model.js';

/**
 * Middleware: Category
 * Loads category lists for client views (layout)
 * Provides both level 1 and level 2 categories
 */
export const categoryMiddleware = async (req, res, next) => {
    try {
        const plist = await categoryModel.findLevel1Categories();
        const clist = await categoryModel.findLevel2Categories();
        res.locals.lcCategories1 = plist;
        res.locals.lcCategories2 = clist;
    } catch (error) {
        console.error('Error loading categories in middleware:', error);
        res.locals.lcCategories1 = [];
        res.locals.lcCategories2 = [];
    }
    next();
};
