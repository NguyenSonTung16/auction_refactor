import bcrypt from 'bcryptjs';
import * as userModel from '../models/user.model.js';
import * as upgradeRequestModel from '../models/upgradeRequest.model.js';
import * as watchlistModel from '../models/watchlist.model.js';
import * as reviewModel from '../models/review.model.js';
import * as autoBiddingModel from '../models/autoBidding.model.js';
import * as authService from '../services/auth.service.js';

export const getRatings = async (req, res) => {
  const currentUserId = req.session.authUser.id;
  const ratingData = await reviewModel.calculateRatingPoint(currentUserId);
  const rating_point = ratingData ? ratingData.rating_point : 0;
  const reviews = await reviewModel.getReviewsByUserId(currentUserId);
  
  const totalReviews = reviews.length;
  const positiveReviews = reviews.filter(r => r.rating === 1).length;
  const negativeReviews = reviews.filter(r => r.rating === -1).length;
  
  res.render('vwAccount/rating', { 
    activeSection: 'ratings',
    rating_point,
    reviews,
    totalReviews,
    positiveReviews,
    negativeReviews
  });
};

export const getSignup = (req, res) => {
  res.render('vwAccount/auth/signup', {
    recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY
  });
};

export const getSignin = (req, res) => {
  const success_message = req.session.success_message;
  delete req.session.success_message;
  res.render('vwAccount/auth/signin', { success_message });
};

export const getVerifyEmail = (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.redirect('/account/signin');
  }
  return res.render('vwAccount/auth/verify-otp', {
    email,
    info_message: 'We have sent an OTP to your email. Please enter it below to verify your account.',
  });
};

export const getForgotPassword = (req, res) => {
  res.render('vwAccount/auth/forgot-password');
};

export const postForgotPassword = async (req, res) => {
  const { email } = req.body;
  const user = await userModel.findByEmail(email);
  if (!user) {
    return res.render('vwAccount/auth/forgot-password', {
      error_message: 'Email not found.',
    });
  }
  await authService.createAndSendOtp(user, 'reset_password');
  return res.render('vwAccount/auth/verify-forgot-password-otp', { email });
};

export const postVerifyForgotPasswordOtp = async (req, res) => {
  const { email, otp } = req.body;
  const user = await userModel.findByEmail(email);
  const otpRecord = await userModel.findValidOtp({
    user_id: user.id,
    otp_code: otp,
    purpose: 'reset_password',
  });
  if (!otpRecord) {
    return res.render('vwAccount/auth/verify-forgot-password-otp', {
      email,
      error_message: 'Invalid or expired OTP.',
    });
  }
  await userModel.markOtpUsed(otpRecord.id);
  return res.render('vwAccount/auth/reset-password', { email });
};

export const postResendForgotPasswordOtp = async (req, res) => {
  const { email } = req.body;
  const user = await userModel.findByEmail(email);
  if (!user) {
    return res.render('vwAccount/auth/verify-forgot-password-otp', {
      email,
      error_message: 'User not found.',
    });
  }
  await authService.createAndSendOtp(user, 'reset_password');
  return res.render('vwAccount/auth/verify-forgot-password-otp', {
    email,
    info_message: 'We have sent a new OTP to your email. Please check your inbox.',
  });
};

export const postResetPassword = async (req, res) => {
  const { email, new_password, confirm_new_password } = req.body;
  if (new_password !== confirm_new_password) {
    return res.render('vwAccount/auth/reset-password', {
      email,
      error_message: 'Passwords do not match.',
    });
  }
  const user = await userModel.findByEmail(email);
  if (!user) {
    return res.render('vwAccount/auth/reset-password', {
      email,
      error_message: 'User not found.',
    });
  }
  const hashedPassword = bcrypt.hashSync(new_password, 10);
  await userModel.update(user.id, { password_hash: hashedPassword });
  return res.render('vwAccount/auth/signin', {
    success_message: 'Your password has been reset. You can sign in now.',
  });
};

export const postSignin = async (req, res) => {
  const { email, password } = req.body;
  const user = await userModel.findByEmail(email);
  if (!user) {
    return res.render('vwAccount/auth/signin', { error_message: 'Invalid email or password', old: { email } });
  }

  const isPasswordValid = bcrypt.compareSync(password, user.password_hash);
  if (!isPasswordValid) {
    return res.render('vwAccount/auth/signin', { error_message: 'Invalid email or password', old: { email } });
  }

  if (!user.email_verified) {
    await authService.createAndSendOtp(user, 'verify_email');
    return res.redirect(`/account/verify-email?email=${encodeURIComponent(email)}`);
  }

  req.session.isAuthenticated = true;
  req.session.authUser = user;
  const returnUrl = req.session.returnUrl || '/';
  delete req.session.returnUrl;
  return res.redirect(returnUrl);
};

export const postSignup = async (req, res) => {
  const { fullname, email, address, password, confirmPassword } = req.body;
  const recaptchaResponse = req.body['g-recaptcha-response'];
  const errors = {};
  const old = { fullname, email, address };

  const recaptchaResult = await authService.verifyRecaptcha(recaptchaResponse);
  if (!recaptchaResult.success) {
      errors.captcha = recaptchaResult.message;
  }
  if (!fullname) errors.fullname = 'Full name is required';
  if (!address) errors.address = 'Address is required';
  if (!email) errors.email = 'Email is required';

  const isEmailExist = await userModel.findByEmail(email);
  if (isEmailExist) errors.email = 'Email is already in use';
  if (!password) errors.password = 'Password is required';
  if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match';

  if (Object.keys(errors).length > 0) {
    return res.render('vwAccount/auth/signup', { errors, old, error_message: 'Please correct the errors below.' });
  }

  const hashedPassword = bcrypt.hashSync(req.body.password, 10);
  const user = {
    email: req.body.email,
    fullname: req.body.fullname,
    address: req.body.address,
    password_hash: hashedPassword,
    role: 'bidder',
  };

  const newUser = await userModel.add(user);
  const verifyUrl = `${process.env.APP_BASE_URL}/account/verify-email?email=${encodeURIComponent(email)}`;
  await authService.createAndSendOtp(newUser, 'verify_email', verifyUrl);

  return res.redirect(`/account/verify-email?email=${encodeURIComponent(email)}`);
};

export const postVerifyEmail = async (req, res) => {
  const { email, otp } = req.body;
  const user = await userModel.findByEmail(email);
  if (!user) {
    return res.render('vwAccount/verify-otp', { email, error_message: 'User not found.' });
  }

  const otpRecord = await userModel.findValidOtp({
    user_id: user.id,
    otp_code: otp,
    purpose: 'verify_email',
  });

  if (!otpRecord) {
    return res.render('vwAccount/auth/verify-otp', { email, error_message: 'Invalid or expired OTP.' });
  }

  await userModel.markOtpUsed(otpRecord.id);
  await userModel.verifyUserEmail(user.id);

  req.session.success_message = 'Your email has been verified. You can sign in now.';
  return res.redirect('/account/signin');
};

export const postResendOtp = async (req, res) => {
  const { email } = req.body;
  const user = await userModel.findByEmail(email);
  if (!user) {
    return res.render('vwAccount/auth/verify-otp', { email, error_message: 'User not found.' });
  }

  if (user.email_verified) {
    return res.render('vwAccount/auth/signin', { success_message: 'Your email is already verified. Please sign in.' });
  }

  await authService.createAndSendOtp(user, 'verify_email');
  return res.render('vwAccount/verify-otp', { email, info_message: 'We have sent a new OTP to your email. Please check your inbox.' });
};

export const getProfile = async (req, res) => {
  try {
    const currentUserId = req.session.authUser.id;
    const user = await userModel.findById(currentUserId);
    let success_message = null;
    if (req.query.success === 'true') success_message = 'Profile updated successfully.';
    if (req.query['send-request-upgrade'] === 'true') success_message = 'Your upgrade request has been sent successfully.';
    res.render('vwAccount/profile', { user: user, success_message });
  } catch (err) {
    res.render('vwAccount/profile', { user: req.session.authUser, err_message: 'Unable to load profile information.' });
  }
};

export const putProfile = async (req, res) => {
  try {
    const { email, fullname, address, date_of_birth, old_password, new_password, confirm_new_password } = req.body;
    const currentUserId = req.session.authUser.id;
    const currentUser = await userModel.findById(currentUserId);

    if (!currentUser.oauth_provider) {
      if (!old_password || !bcrypt.compareSync(old_password, currentUser.password_hash)) {
        return res.render('vwAccount/profile', { user: currentUser, err_message: 'Password is incorrect!' });
      }
    }

    if (email !== currentUser.email) {
      const existingUser = await userModel.findByEmail(email);
      if (existingUser) {
        return res.render('vwAccount/profile', { user: currentUser, err_message: 'Email is already in use by another user.' });
      }
    }

    if (!currentUser.oauth_provider && new_password) {
      if (new_password !== confirm_new_password) {
        return res.render('vwAccount/profile', { user: currentUser, err_message: 'New passwords do not match.' });
      }
    }

    const entity = {
      email,
      fullname,
      address: address || currentUser.address,
      date_of_birth: date_of_birth ? new Date(date_of_birth) : currentUser.date_of_birth,
    };
    
    if (!currentUser.oauth_provider) {
      entity.password_hash = new_password ? bcrypt.hashSync(new_password, 10) : currentUser.password_hash;
    }

    const updatedUser = await userModel.update(currentUserId, entity);

    if (updatedUser) {
      delete updatedUser.password_hash;
      req.session.authUser = updatedUser;
    }
    return res.redirect('/account/profile?success=true');
  } catch (err) {
    return res.render('vwAccount/profile', { user: req.session.authUser, err_message: 'System error. Please try again later.' });
  }
};

export const postLogout = (req, res) => {
  req.session.isAuthenticated = false;
  delete req.session.authUser;
  res.redirect('/');
};

export const getRequestUpgrade = async (req, res) => {
  const currentUserId = req.session.authUser.id;
  const upgradeRequest = await upgradeRequestModel.findByUserId(currentUserId);
  res.render('vwAccount/request-upgrade', { upgrade_request: upgradeRequest });
};

export const postRequestUpgrade = async (req, res) => {
  try {
    const currentUserId = req.session.authUser.id;
    await userModel.markUpgradePending(currentUserId);
    await upgradeRequestModel.createUpgradeRequest(currentUserId);
    return res.redirect('/account/profile?send-request-upgrade=true');
  } catch (err) {
    res.render('vwAccount/profile', { user: req.session.authUser, err_message: 'Unable to submit your request at this time. Please try again later.' });
  }
};

export const getWatchlist = async (req, res) => {
  const limit = 3;
  const page = parseInt(req.query.page) || 1;
  const offset = (page - 1) * limit;
  const currentUserId = req.session.authUser.id;
  const watchlistProducts = await watchlistModel.searchPageByUserId(currentUserId, limit, offset);
  const total = await watchlistModel.countByUserId(currentUserId);
  const totalCount = Number(total.count);
  const nPages = Math.ceil(totalCount / limit);
  let from = (page - 1) * limit + 1;
  let to = page * limit;
  if (to > totalCount) to = totalCount;
  if (totalCount === 0) { from = 0; to = 0; }
  res.render('vwAccount/watchlist', { products: watchlistProducts, totalCount, from, to, currentPage: page, totalPages: nPages });
};

export const getBidding = async (req, res) => {
  const currentUserId = req.session.authUser.id;
  const biddingProducts = await autoBiddingModel.getBiddingProductsByBidderId(currentUserId);
  res.render('vwAccount/bidding-products', { activeSection: 'bidding', products: biddingProducts });
};

export const getAuctions = async (req, res) => {
  const currentUserId = req.session.authUser.id;
  const wonAuctions = await autoBiddingModel.getWonAuctionsByBidderId(currentUserId);
  for (let product of wonAuctions) {
    const review = await reviewModel.findByReviewerAndProduct(currentUserId, product.id);
    if (review && review.rating !== 0) {
      product.has_rated_seller = true;
      product.seller_rating = review.rating === 1 ? 'positive' : 'negative';
      product.seller_rating_comment = review.comment;
    } else {
      product.has_rated_seller = false;
    }
  }
  res.render('vwAccount/won-auctions', { activeSection: 'auctions', products: wonAuctions });
};

export const postRateSeller = async (req, res) => {
  try {
    const currentUserId = req.session.authUser.id;
    const productId = req.params.productId;
    const { seller_id, rating, comment } = req.body;
    const ratingValue = rating === 'positive' ? 1 : -1;
    const existingReview = await reviewModel.findByReviewerAndProduct(currentUserId, productId);
    if (existingReview) {
      await reviewModel.updateByReviewerAndProduct(currentUserId, productId, { rating: ratingValue, comment: comment || null });
    } else {
      await reviewModel.create({ reviewer_id: currentUserId, reviewed_user_id: seller_id, product_id: productId, rating: ratingValue, comment: comment || null });
    }
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, message: 'Failed to submit rating.' });
  }
};

export const putRateSeller = async (req, res) => {
  try {
    const currentUserId = req.session.authUser.id;
    const productId = req.params.productId;
    const { rating, comment } = req.body;
    const ratingValue = rating === 'positive' ? 1 : -1;
    await reviewModel.updateByReviewerAndProduct(currentUserId, productId, { rating: ratingValue, comment: comment || null });
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, message: 'Failed to update rating.' });
  }
};

export const getSellerProducts = async (req, res) => {
  res.render('vwAccount/my-products');
};

export const getSellerSoldProducts = async (req, res) => {
  res.render('vwAccount/sold-products');
};

export const getGoogleCallback = (req, res) => {
  req.session.authUser = req.user;
  req.session.isAuthenticated = true;
  res.redirect('/');
};

export const getFacebookCallback = (req, res) => {
  req.session.authUser = req.user;
  req.session.isAuthenticated = true;
  res.redirect('/');
};

export const getGithubCallback = (req, res) => {
  req.session.authUser = req.user;
  req.session.isAuthenticated = true;
  res.redirect('/');
};
