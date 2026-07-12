import { MESSAGE } from "../constants/message.js";
import ErrorResponse from "../lib/helper/ErrorResponse.js";

/**
 * Middleware kiểm tra vai trò recruiter của người dùng.
 * Chỉ cho phép tiếp tục nếu người dùng có vai trò recruiter.
 * Nếu không, trả về lỗi 403 Forbidden.
 * Yêu cầu phải sử dụng sau authMiddleware và userMiddleware.
 */
export const recruiterMiddleware = async (req, res, next) => {
  try {
    const user = req.user;
    if (user.role.name !== "recruiter") {
      throw new ErrorResponse(403, MESSAGE.FORBIDDEN);
    }
    next();
  } catch (error) {
    next(error);
  }
};
