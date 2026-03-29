// src/middlewares/errorHandler.js

export const errorHandler = (err, req, res, next) => {
  // Log lỗi ra console để debug (có thể dùng winston/morgan sau này)
  console.error('[Global Error]:', err.stack);

  // Mặc định là lỗi 500 (Internal Server Error) nếu không chỉ định
  const statusCode = err.statusCode || 500;
  
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Đã có lỗi xảy ra từ phía máy chủ.',
    // Chỉ hiện chi tiết lỗi ở môi trường dev, ẩn đi ở production để bảo mật
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

