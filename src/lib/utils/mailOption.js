import { config } from "dotenv";
config();
export const mailOptions = (to, subject, text) => {
  return {
    from: `JobLink <${process.env.EMAIL_USER}>`,
    to: to,
    subject: subject,
    html: text,
  };
};
