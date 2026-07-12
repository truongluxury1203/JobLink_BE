// auth.routes.js
import express from "express";
import {
  changePasswordController,
  forgotPasswordController,
  loginController,
  logoutController,
  oauthGoogleLoginController,
  refreshController,
  registerController,
  resetPasswordController,
  verifyEmailController,
} from "../controllers/auth.controller.js";
import {
  authMiddleware,
  changePasswordValidator,
  forgotPasswordValidator,
  loginValidator,
  registerValidator,
  resetPasswordValidator,
} from "../middlewares/auth.middleware.js";
import { wrapAsync } from "../middlewares/error.middleware.js";
const authRoutes = express.Router();
// Đăng ký tài khoản
authRoutes.post("/register", registerValidator, wrapAsync(registerController));

// Đăng nhập
authRoutes.post("/login", loginValidator, wrapAsync(loginController));

// Refresh access token
authRoutes.get("/refresh", wrapAsync(refreshController));

// // Quên mật khẩu (gửi mail reset)
authRoutes.post("/forgot-password", forgotPasswordValidator, wrapAsync(forgotPasswordController));

// // Đặt lại mật khẩu bằng token
authRoutes.post(
  "/reset-password/:token",
  resetPasswordValidator,
  wrapAsync(resetPasswordController)
);

// // Đổi mật khẩu (khi đang đăng nhập)
authRoutes.put(
  "/change-password",
  authMiddleware,
  changePasswordValidator,
  wrapAsync(changePasswordController)
);

// Đăng xuất (xóa refresh token)
authRoutes.get("/logout", wrapAsync(logoutController));

// Đăng nhập bằng Google OAuth
authRoutes.post("/oauth-google", wrapAsync(oauthGoogleLoginController));

// Xác minh email
authRoutes.get("/verify-email/:token", wrapAsync(verifyEmailController));
export default authRoutes;
