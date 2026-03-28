import express from 'express';
import { upload } from '../utils/upload.js';
import * as sellerController from '../controllers/seller.controller.js';

const router = express.Router();

router.get('/', sellerController.getDashboard);
router.get('/products', sellerController.getAllProducts);
router.get('/products/active', sellerController.getActiveProducts);
router.get('/products/pending', sellerController.getPendingProducts);
router.get('/products/sold', sellerController.getSoldProducts);
router.get('/products/expired', sellerController.getExpiredProducts);

router.get('/products/add', sellerController.getAddProduct);
router.post('/products/add', sellerController.postAddProduct);

router.post('/products/upload-thumbnail', upload.single('thumbnail'), sellerController.uploadThumbnail);
router.post('/products/upload-subimages', upload.array('images', 10), sellerController.uploadSubimages);

router.post('/products/:id/cancel', sellerController.cancelProduct);
router.post('/products/:id/rate', sellerController.rateBidder);
router.put('/products/:id/rate', sellerController.updateRateBidder);

router.post('/products/:id/append-description', sellerController.appendDescription);
router.get('/products/:id/description-updates', sellerController.getDescriptionUpdates);
router.put('/products/description-updates/:updateId', sellerController.putDescriptionUpdates);
router.delete('/products/description-updates/:updateId', sellerController.deleteDescriptionUpdates);

export default router;