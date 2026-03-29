import * as categoryModel from '../../models/category.model.js';
import catchAsync from '../../utils/catchAsync.js';

export const getList = catchAsync(async (req, res, next) => {
    const categories = await categoryModel.findAll();
    const success_message = req.session.success_message;
    const error_message = req.session.error_message;
    delete req.session.success_message;
    delete req.session.error_message;
    res.render('vwAdmin/category/list', {
        categories,
        empty: categories.length === 0,
        success_message,
        error_message
    });
});

export const getDetailById = catchAsync(async (req, res, next) => {
    const id = req.params.id;
    const category = await categoryModel.findByCategoryId(id);
    res.render('vwAdmin/category/detail', { category });
});

export const getAddPage = catchAsync(async (req, res, next) => {
    const parentCategories = await categoryModel.findLevel1Categories();
    res.render('vwAdmin/category/add', { parentCategories });
});

export const getEditPage = catchAsync(async (req, res, next) => {
    const id = req.params.id;
    const category = await categoryModel.findByCategoryId(id);
    const parentCategories = await categoryModel.findLevel1Categories();
    res.render('vwAdmin/category/edit', { category, parentCategories });
});

export const postAdd = catchAsync(async (req, res, next) => {
    const { name, parent_id } = req.body;
    await categoryModel.createCategory({ name, parent_id: parent_id || null });
    req.session.success_message = 'Category added successfully!';
    res.redirect('/admin/categories/list');
});

export const postEdit = catchAsync(async (req, res, next) => {
    const { id, name, parent_id } = req.body;
    await categoryModel.updateCategory(id, { name, parent_id: parent_id || null });
    req.session.success_message = 'Category updated successfully!';
    res.redirect('/admin/categories/list');
});

export const postDelete = catchAsync(async (req, res, next) => {
    const { id } = req.body;
    const hasProducts = await categoryModel.isCategoryHasProducts(id);
    if (hasProducts) {
        req.session.error_message = 'Cannot delete category that has associated products.';
        return res.redirect('/admin/categories/list');
    }
    await categoryModel.deleteCategory(id);
    req.session.success_message = 'Category deleted successfully!';
    res.redirect('/admin/categories/list');
});
