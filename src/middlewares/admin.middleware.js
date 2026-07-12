import { MESSAGE } from "../constants/message.js";
import ErrorResponse from "../lib/helper/ErrorResponse.js";

/**
 * Middleware kiểm tra vai trò admin của người dùng.
 * Chỉ cho phép tiếp tục nếu người dùng có vai trò admin.
 * Nếu không, trả về lỗi 403 Forbidden.
 * Yêu cầu phải sử dụng sau authMiddleware và userMiddleware.
 */
export const adminMiddleware = async (req, res, next) => {
  try {
    const user = req.user;
    
    // Debug: Log user role để kiểm tra
    console.log('Admin middleware - User role:', user.role);
    console.log('Admin middleware - User role type:', typeof user.role);
    console.log('Admin middleware - User role name:', user.role?.name);
    
    // Kiểm tra role - có thể là string hoặc object
    const userRole = user.role?.name || user.role;
    
    if (userRole !== "admin") {
      console.log('❌ Access denied - User role is not admin:', userRole);
      throw new ErrorResponse(403, MESSAGE.FORBIDDEN);
    }
    
    console.log('✅ Admin access granted');
    next();
  } catch (error) {
    next(error);
  }
};
