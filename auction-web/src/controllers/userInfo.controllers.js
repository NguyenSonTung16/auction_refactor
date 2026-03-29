import * as userModel from '../models/user.model.js';

/**
 * Middleware: User Info
 * Checks and updates user authentication status from session
 * Syncs user data with database on each request
 */
export const userInfoMiddleware = async (req, res, next) => {
    if (typeof req.session.isAuthenticated === 'undefined') {
        req.session.isAuthenticated = false;
    }
    
    // Nếu user đã đăng nhập, kiểm tra xem thông tin có thay đổi không
    if (req.session.isAuthenticated && req.session.authUser) {
        const currentUser = await userModel.findById(req.session.authUser.id);
        
        // Nếu không tìm thấy user (bị xóa) hoặc thông tin đã thay đổi, cập nhật session
        if (!currentUser) {
            // User bị xóa, đăng xuất
            req.session.isAuthenticated = false;
            req.session.authUser = null;
        } else {
            // Cập nhật thông tin mới từ DB vào session
            req.session.authUser = {
                id: currentUser.id,
                username: currentUser.username,
                fullname: currentUser.fullname,
                email: currentUser.email,
                role: currentUser.role,
                address: currentUser.address,
                date_of_birth: currentUser.date_of_birth,
                email_verified: currentUser.email_verified,
                oauth_provider: currentUser.oauth_provider,
                oauth_id: currentUser.oauth_id
            };
        }
    }
    
    res.locals.isAuthenticated = req.session.isAuthenticated;
    res.locals.authUser = req.session.authUser;
    res.locals.isAdmin = req.session.authUser?.role === 'admin';
    res.locals.isSeller = req.session.authUser?.role === 'seller';
    next();
};
