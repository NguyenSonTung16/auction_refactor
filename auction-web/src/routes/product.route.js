import express from 'express';
import multer from 'multer';
import path from 'path';
import * as productController from '../controllers/product.controller.js';
import { isAuthenticated } from '../middlewares/auth.mdw.js';

const router = express.Router();

// Multer storage for order proof images
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed!'));
  }
});

// Basic Product Routes
router.get('/category', productController.getByCategory);
router.get('/search', productController.searchProducts);
router.get('/detail', productController.getDetail);
router.get('/bidding-history', productController.getBiddingHistory);

// Authenticated Product Actions
router.post('/watchlist', isAuthenticated, productController.addToWatchlist);
router.delete('/watchlist', isAuthenticated, productController.removeFromWatchlist);
router.post('/bid', isAuthenticated, productController.postBid);
router.post('/comment', isAuthenticated, productController.postComment);
router.post('/buy-now', isAuthenticated, productController.postBuyNow);
router.post('/reject-bidder', isAuthenticated, productController.postRejectBidder);
router.post('/unreject-bidder', isAuthenticated, productController.postUnrejectBidder);

// Order Management
router.get('/complete-order', isAuthenticated, productController.getCompleteOrder);
router.post('/order/upload-images', isAuthenticated, upload.array('images', 5), (req, res) => {
  const urls = req.files.map(file => `uploads/${file.filename}`);
  res.json({ success: true, urls });
});
router.post('/order/:orderId/submit-payment', isAuthenticated, productController.postSubmitPayment);
router.post('/order/:orderId/confirm-payment', isAuthenticated, productController.postConfirmPayment);
router.post('/order/:orderId/submit-shipping', isAuthenticated, productController.postSubmitShipping);
router.post('/order/:orderId/confirm-delivery', isAuthenticated, productController.postConfirmDelivery);
router.post('/order/:orderId/submit-rating', isAuthenticated, productController.postSubmitRating);
router.post('/order/:orderId/complete-transaction', isAuthenticated, productController.postCompleteTransaction);

// Communication
router.get('/order/:orderId/messages', isAuthenticated, productController.getChatMessages);
router.post('/order/:orderId/send-message', isAuthenticated, productController.postSendMessage);

// Public Ratings
router.get('/seller/:sellerId/ratings', productController.getSellerRatings);
router.get('/bidder/:bidderId/ratings', productController.getBidderRatings);

export default router;