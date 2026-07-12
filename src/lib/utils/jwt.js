import { config } from "dotenv";
import { OAuth2Client } from "google-auth-library";
import { SignJWT, jwtVerify } from "jose";
import { TOKEN_EXPIRATION } from "../../constants/variable.js";

config();

// chuyển đổi chuỗi bí mật thành Uint8Array để dùng vì jose yêu cầu định dạng này
const secret = new TextEncoder().encode(process.env.JWT_SECRET);
const refreshSecret = new TextEncoder().encode(process.env.REFRESH_SECRET);
const ResetToken = new TextEncoder().encode(process.env.RESET_PASSWORD_SECRET);
const EmailToken = new TextEncoder().encode(process.env.EMAIL_SECRET || process.env.JWT_SECRET);
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function generateAccessToken(payload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(TOKEN_EXPIRATION.ACCESS_EXPIRES)
    .sign(secret);
}

export async function generateRefreshToken(payload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(TOKEN_EXPIRATION.REFRESH_EXPIRES)
    .sign(refreshSecret);
}

export async function verifyAccessToken(token) {
  return await jwtVerify(token, secret);
}

export async function verifyRefreshToken(token) {
  return await jwtVerify(token, refreshSecret);
}

export const createResetToken = async (userId) => {
  return await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(TOKEN_EXPIRATION.RESET_EXPIRES)
    .sign(ResetToken);
};
export const verifyResetToken = async (token) => {
  return await jwtVerify(token, ResetToken);
};

export const createEmailToken = async (userId) => {
  return await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(TOKEN_EXPIRATION.EMAIL_EXPIRES)
    .sign(EmailToken);
};

export const verifyEmailToken = async (token) => {
  return await jwtVerify(token, EmailToken);
};

export const verifyGoogleToken = async (idToken) => {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  return payload;
};
