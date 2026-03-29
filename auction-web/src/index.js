import 'dotenv/config';
import express from 'express';
import setUpViewEngine from './config/viewEngine.js';
import session from 'express-session';
import methodOverride from 'method-override';
import path from 'path';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import passport from './utils/passport.js';
import { errorHandler } from './errorHandlers.js/errorHandler.js';
// Import Scheduled Jobs
import { startAuctionEndNotifier } from './scripts/auctionEndNotifier.js';

// Import Routes
import homeRouter from './routes/home.route.js';
import productRouter from './routes/product.route.js';
import accountRouter from './routes/account.route.js';
import sellerRouter from './routes/seller.route.js';
import { setupAdminRoutes } from './routes/admin/admin.router.js';

// Import Middlewares
import { isAuthenticated, isSeller } from './middlewares/auth.mdw.js';
import { userInfoMiddleware } from './controllers/userInfo.controllers.js';
import { categoryMiddleware } from './controllers/category.controllers.js';


//import API search categories
import  {getCategorySearchModal} from './controllers/api/category_searchModal.controllers.js';

const app = express();
const PORT = process.env.PORT || 3005;

// ============================================================
// 1. CẤU HÌNH CỐT LÕI
// ============================================================
app.use('/static', express.static('public'));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(methodOverride('_method'));
app.use(session({
  secret: 'x8w3v9p2q1r7s6t5u4z0a8b7c6d5e4f3g2h1j9k8l7m6n5o4p3q2r1s0t9u8v7w6x5y4z3',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // false chạy localhost
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// ============================================================
// 2. CẤU HÌNH VIEW ENGINE (Handlebars)
// ============================================================
setUpViewEngine(app);

// File filter (chỉ cho phép ảnh) 
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files (jpeg, jpg, png, webp) are allowed!'));
  }
};

// ============================================================
// 3. MIDDLEWARE TOÀN CỤC (Chạy cho mọi request)
// ============================================================

// User Info Middleware
app.use(userInfoMiddleware);

// Category Middleware
app.use(categoryMiddleware);

// ============================================================
// 4. CẤU HÌNH LOGIC ADMIN (Design Pattern)
// ============================================================

// Setup Admin Routes (centralized configuration)
setupAdminRoutes(app);

// ============================================================
// 5. ROUTES
// ============================================================

// Các Route Seller
app.use('/seller', isAuthenticated, isSeller, sellerRouter);

// API endpoint for categories (for search modal)
app.get('/api/categories', getCategorySearchModal);

// Các Route Client (Đặt cuối cùng để tránh override)
app.use('/', homeRouter);
app.use('/products', productRouter);
app.use('/account', accountRouter);
// global error handler
app.use(errorHandler);

app.listen(PORT, function () {
  console.log(`Server is running on http://localhost:${PORT}`);
  // Start scheduled jobs
  startAuctionEndNotifier(30); // Check every 30 seconds for ended auctions
});