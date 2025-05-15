import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import ErrorHandler from '../utils/errorHandler.js';

dotenv.config();

export const sendEmail = async (subject, email, html) => {
  let transporter = nodemailer.createTransport({
    host: process.env.EmailHost,
    port: process.env.EmailPort,
    secure: false,
    auth: {
      user: process.env.EmailUser,
      pass: process.env.EmailPass,
    },
    tls: {
      ciphers: 'SSLv3',
    },
  });

  let mailOptions = {
    from: `${process.env.APP_NAME} <${process.env.EmailUser}>`,
    to: email,
    subject: subject,
    html: html,
  };

  try {
    await transporter.sendMail(mailOptions);

  } catch (err) {
    console.error("Email sending error:", err);
    next(new ErrorHandler("Failed to send OTP. Please try again later.", 500));
  }
}
