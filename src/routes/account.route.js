import express from 'express';
import passport from '../utils/passport.js';
import { isAuthenticated } from '../middlewares/auth.mdw.js';
import * as accountController from '../controllers/account.controller.js';

const router = express.Router();

router.get('/ratings', isAuthenticated, accountController.getRatings);
router.get('/signup', accountController.getSignup);
router.get('/signin', accountController.getSignin);
router.get('/verify-email', accountController.getVerifyEmail);
router.get('/forgot-password', accountController.getForgotPassword);
router.post('/forgot-password', accountController.postForgotPassword);
router.post('/verify-forgot-password-otp', accountController.postVerifyForgotPasswordOtp);
router.post('/resend-forgot-password-otp', accountController.postResendForgotPasswordOtp);
router.post('/reset-password', accountController.postResetPassword);
router.post('/signin', accountController.postSignin);
router.post('/signup', accountController.postSignup);
router.post('/verify-email', accountController.postVerifyEmail);
router.post('/resend-otp', accountController.postResendOtp);
router.get('/profile', isAuthenticated, accountController.getProfile);
router.put('/profile', isAuthenticated, accountController.putProfile);
router.post('/logout', isAuthenticated, accountController.postLogout);
router.get('/request-upgrade', isAuthenticated, accountController.getRequestUpgrade);
router.post('/request-upgrade', isAuthenticated, accountController.postRequestUpgrade);
router.get('/watchlist', isAuthenticated, accountController.getWatchlist);
router.get('/bidding', isAuthenticated, accountController.getBidding);
router.get('/auctions', isAuthenticated, accountController.getAuctions);
router.post('/won-auctions/:productId/rate-seller', isAuthenticated, accountController.postRateSeller);
router.put('/won-auctions/:productId/rate-seller', isAuthenticated, accountController.putRateSeller);
router.get('/seller/products', isAuthenticated, accountController.getSellerProducts);
router.get('/seller/sold-products', isAuthenticated, accountController.getSellerSoldProducts);

// ===================== OAUTH ROUTES =====================
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/account/signin' }), accountController.getGoogleCallback);

router.get('/auth/facebook', passport.authenticate('facebook', { scope: ['public_profile'] }));
router.get('/auth/facebook/callback', passport.authenticate('facebook', { failureRedirect: '/account/signin' }), accountController.getFacebookCallback);

router.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));
router.get('/auth/github/callback', passport.authenticate('github', { failureRedirect: '/account/signin' }), accountController.getGithubCallback);

export default router;
