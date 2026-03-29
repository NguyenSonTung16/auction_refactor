import express from 'express';
import * as productController from '../../controllers/admin/product.controllers.js';
const router = express.Router();

router.get('/list', productController.getList);
router.get('/add', productController.getAddPage);
router.post('/add', productController.postAdd);
router.get('/detail/:id', productController.getDetailById);
router.get('/edit/:id', productController.getEditPage);
router.post('/edit', productController.postEdit);
router.post('/delete', productController.postDelete);
router.post('/upload-thumbnail', productController.upload.single('thumbnail'), productController.handleUploadThumbnail);
router.post('/upload-subimages', productController.upload.array('images', 10), productController.handleUploadSubimages);

export default router;
