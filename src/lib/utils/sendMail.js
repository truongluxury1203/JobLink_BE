import { Resend } from "resend";
import dotenv from "dotenv";
dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * sendMail — wrapper tương thích với nodemailer callback API
 * mailOptions: { from, to, subject, html }
 */
const sendMail = async (mailOptions, callback) => {
  try {
    const { from, to, subject, html } = mailOptions;
    const { error } = await resend.emails.send({
      from: from || `JobLink <onboarding@resend.dev>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    });
    if (error) {
      callback(error);
    } else {
      callback(null, { success: true });
    }
  } catch (err) {
    callback(err);
  }
};

export default sendMail;
