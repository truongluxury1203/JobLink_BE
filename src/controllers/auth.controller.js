import { config } from "dotenv";
import { MESSAGE } from "../constants/message.js";
import { TOKEN_EXPIRATION } from "../constants/variable.js";
import ErrorResponse from "../lib/helper/ErrorResponse.js";
import Role from "../models/Role.js";
import User from "../models/User.js";
import { toResultOk } from "../results/Result.js";
import {
  createResetToken,
  createEmailToken,
  generateAccessToken,
  generateRefreshToken,
  verifyEmailToken,
  verifyGoogleToken,
  verifyRefreshToken,
} from "../lib/utils/jwt.js";
import { mailOptions } from "../lib/utils/mailOption.js";
import sendMail from "../lib/utils/sendMail.js";
config();

/**
 * Controller for user registration.
 * Handles creating a new user with default "user" role.
 * Responds with success message on successful registration.
 */
export const registerController = async (req, res) => {
  let { username, email, password, firstName, lastName } = req.body;
  const role = await Role.findOne({ name: "candidate" });
  if (!role) throw new ErrorResponse(400, MESSAGE.ROLE_NOT_FOUND);

  const newUser = new User({
    role: role._id,
    username,
    email,
    password,
    firstName,
    lastName,
    isActive: false,
  });

  await newUser.save();

  // Tạo token xác thực email và gửi mail
  const emailToken = await createEmailToken(newUser._id.toString());
  const verifyLink = `${process.env.CLIENT_URL}/verify-email?token=${emailToken}`;
  const option = mailOptions(
    email,
    MESSAGE.EMAIL_VERIFY_SUBJECT,
    `${MESSAGE.EMAIL_VERIFY_BODY}: <a href="${verifyLink}">${verifyLink}</a>`
  );

  // Gửi mail xác thực trong background (bỏ await) để phản hồi nhanh cho người dùng
  sendMail(option, (error, info) => {
    if (error) {
      console.error("Send mail error:", error);
    }
  });

  return res.status(201).json(toResultOk({ msg: MESSAGE.REGISTER_VERIFY_SENT, statusCode: 201 }));
};

/**
 * Controller for user login.
 * Verifies credentials, generates JWT tokens,
 * sets refresh token as httpOnly cookie, and returns access token.
 */
export const loginController = async (req, res) => {
  let { username, password } = req.body;

  const user = await User.findOne({ username });
  if (!user || !(await user.comparePassword(password)))
    throw new ErrorResponse(401, MESSAGE.LOGIN_FAILED);

  if (!user.isEmailVerified) throw new ErrorResponse(401, MESSAGE.EMAIL_NOT_VERIFIED);

  if (!user.isActive) throw new ErrorResponse(401, MESSAGE.ACCOUNT_NOT_ACTIVE);

  const payload = { userId: user._id.toString() };

  const accessToken = await generateAccessToken(payload);
  const refreshToken = await generateRefreshToken(payload);

  const days = Number(TOKEN_EXPIRATION.REFRESH_EXPIRES.split("d")[0]);
  const refreshTokenExpiry = 1000 * 60 * 60 * 24 * days;

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: true,
    path: "/",
    maxAge: refreshTokenExpiry,
    sameSite: "Strict",
  });
  return res.status(200).json(
    toResultOk({
      msg: MESSAGE.LOGIN_SUCCESS,
      data: {
        token: accessToken,
      },
    })
  );
};

/**
 * Controller to refresh access token using refresh token from cookies.
 * Validates the refresh token and issues a new access token.
 */
export const refreshController = async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) throw new ErrorResponse(401, MESSAGE.LOGIN_EXPIRED);
  let payload;
  try {
    payload = await verifyRefreshToken(refreshToken);
  } catch {
    throw new ErrorResponse(401, MESSAGE.LOGIN_EXPIRED);
  }
  const accessToken = await generateAccessToken({
    userId: payload?.payload?.userId,
  });

  return res.status(200).json(
    toResultOk({
      msg: MESSAGE.REFRESH_TOKEN_SUCCESS,
      data: {
        token: accessToken,
      },
    })
  );
};

// Xác thực email từ token
export const verifyEmailController = async (req, res) => {
  const { token } = req.params;
  if (!token) throw new ErrorResponse(400, MESSAGE.JWT_INVALID);

  let payload;
  try {
    payload = await verifyEmailToken(token);
  } catch {
    throw new ErrorResponse(400, MESSAGE.TOKEN_EXPIRED);
  }

  const userId = payload?.payload?.userId;
  const user = await User.findById(userId);
  if (!user) throw new ErrorResponse(404, MESSAGE.USER_NOT_FOUND);

  if (user.isEmailVerified) {
    return res.status(200).json(toResultOk({ msg: MESSAGE.EMAIL_ALREADY_VERIFIED }));
  }

  user.isEmailVerified = true;
  user.isActive = true;
  await user.save();

  return res.status(200).json(toResultOk({ msg: MESSAGE.EMAIL_VERIFY_SUCCESS }));
};

/**
 * Controller to handle forgot password requests.
 * Generates a reset token, constructs a reset link, and sends it via email.
 * Responds with a message indicating that the reset email has been sent.
 * If the email does not exist, responds with a user not found error.
 */
export const forgotPasswordController = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) throw new ErrorResponse(404, MESSAGE.USER_NOT_FOUND);
  // Tạo token reset
  const token = await createResetToken(user._id.toString());
  // Link reset
  const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
  const option = mailOptions(
    email,
    "Đặt lại mật khẩu",
    `Nhấn vào link sau để đặt lại mật khẩu: ${resetLink}`
  );
  // Gửi mail reset password
  await new Promise((resolve, reject) => {
    sendMail(option, (error, info) => {
      if (error) {
        console.error("Send mail error:", error);
        reject(new ErrorResponse(500, MESSAGE.SEND_MAIL_ERROR));
      } else {
        resolve(info);
      }
    });
  });

  return res.status(200).json(toResultOk({ msg: MESSAGE.FORGOT_PASSWORD_BODY }));
};

/**
 * Controller to verify reset password token.
 * Checks if the reset token is valid and returns userId if valid.
 * Used before allowing user to reset password.
 */
export const resetPasswordController = async (req, res) => {
  const { newPassword } = req.body;
  const userId = req.userId;

  const user = await User.findById(userId);
  if (!user) throw new ErrorResponse(404, MESSAGE.USER_NOT_FOUND);

  user.password = newPassword;
  await user.save();

  return res.status(200).json(toResultOk({ msg: MESSAGE.RESET_PASSWORD_SUCCESS }));
};

export const changePasswordController = async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  // Truy vấn lại user từ DB để có đầy đủ trường, bao gồm password
  const userId = req.user?._id || req.user?.userId;
  const user = await User.findById(userId);

  if (!user) throw new ErrorResponse(404, MESSAGE.USER_NOT_FOUND);

  const isMatch = await user.comparePassword(oldPassword);
  if (!isMatch) throw new ErrorResponse(400, MESSAGE.OLD_PASSWORD_INCORRECT);

  user.password = newPassword;
  await user.save();

  return res.status(200).json(toResultOk({ msg: MESSAGE.CHANGE_PASSWORD_SUCCESS }));
};

export const logoutController = (req, res) => {
  // Xóa refresh token khỏi cookie
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    path: "/",
  });

  return res.status(200).json(
    toResultOk({
      statusCode: 200,
      msg: MESSAGE.LOGOUT_SUCCESS,
    })
  );
};

// Google OAuth login
export const oauthGoogleLoginController = async (req, res) => {
  const { token } = req.body;
  if (!token) throw new ErrorResponse(400, MESSAGE.GG_TOKEN_INVALID);

  const payload = await verifyGoogleToken(token);

  const { email, given_name, family_name, picture } = payload;

  let user = await User.findOne({ email });
  if (!user) {
    const role = await Role.findOne({ name: "candidate" });
    if (!role) throw new ErrorResponse(400, MESSAGE.ROLE_NOT_FOUND);
    user = await User.create({
      role: role._id,
      email,
      firstName: given_name,
      lastName: family_name,
      avatar: picture,
      isEmailVerified: true,
    });
  }

  const jwtPayload = { userId: user._id.toString() };
  const accessToken = await generateAccessToken(jwtPayload);
  const refreshToken = await generateRefreshToken(jwtPayload);

  const days = Number(TOKEN_EXPIRATION.REFRESH_EXPIRES.split("d")[0]);
  const refreshTokenExpiry = 1000 * 60 * 60 * 24 * days;

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: true,
    path: "/",
    maxAge: refreshTokenExpiry,
    sameSite: "Strict",
  });

  return res.status(200).json(
    toResultOk({
      msg: MESSAGE.LOGIN_SUCCESS,
      data: {
        token: accessToken,
      },
    })
  );
};
