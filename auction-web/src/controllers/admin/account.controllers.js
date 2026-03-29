import catchAsync from '../../utils/catchAsync.js';

export const getProfile = catchAsync(async (req, res, next) => {
    res.render('vwAdmin/account/profile');
});
