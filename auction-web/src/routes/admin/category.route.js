import express from 'express';
import * as categoryController from '../../controllers/admin/category.controllers.js';
const router = express.Router();

router.get('/list', categoryController.getList);
router.get('/detail/:id', categoryController.getDetailById);
router.get('/add', categoryController.getAddPage);
router.get('/edit/:id', categoryController.getEditPage);
router.post('/add', categoryController.postAdd);
router.post('/edit', categoryController.postEdit);
router.post('/delete', categoryController.postDelete);

export default router;
