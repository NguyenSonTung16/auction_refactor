import { isAdmin } from '../../middlewares/auth.mdw.js';
import adminAccountRouter from './account.route.js';
import adminUserRouter from './user.route.js';
import adminCategoryRouter from './category.route.js';
import adminProductRouter from './product.route.js';
import adminSystemRouter from './system.route.js';

/**
 * Setup Admin Routes
 * Centralizes all admin routing configuration
 * - Applies authentication middleware
 * - Sets admin mode flag
 * - Registers all admin subroutes
 */
export const setupAdminRoutes = (app) => {
    // A. Security: All /admin/* routes must pass admin verification
    app.use('/admin', isAdmin);

    // B. Set admin mode flag for layout to display Admin Sidebar
    app.use('/admin', (req, res, next) => {
        res.locals.isAdminMode = true;
        next();
    });

    // C. Register admin sub-routes
    app.use('/admin/account', adminAccountRouter);
    app.use('/admin/users', adminUserRouter);
    app.use('/admin/categories', adminCategoryRouter);
    app.use('/admin/products', adminProductRouter);
    app.use('/admin/system', adminSystemRouter);
};
