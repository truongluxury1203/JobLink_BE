import { config } from "dotenv";
config();
export const mailOptions = (to, subject, text) => {
  return {
    from: "JobLink <onboarding@resend.dev>",
    to: to,
    subject: subject,
    html: text,
  };
};
