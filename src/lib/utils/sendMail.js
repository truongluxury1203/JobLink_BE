import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * sendMail — wrapper tương thích với nodemailer callback API
 * mailOptions: { from, to, subject, html }
 */
const sendMail = async (mailOptions, callback) => {
  try {
    const info = await transporter.sendMail(mailOptions);
    callback(null, info);
  } catch (err) {
    callback(err);
  }
};

export default sendMail;
