// utils/mailer.js
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// Load .env
dotenv.config();

// Create transporter for Gmail + App Password
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.MAIL_PORT) || 587,
  secure: false, // 587 = STARTTLS (an toàn + dễ dùng)
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS, // APP PASSWORD 16 ký tự
  },
  tls: {
    rejectUnauthorized: false,
  },
});

// Test transporter (optional)
transporter.verify(function (error, success) {
  if (error) {
    console.error('❌ SMTP ERROR:', error);
  } else {
    console.log('📧 SMTP Ready to send mail');
  }
});

// Export sendMail function
export async function sendMail({ to, subject, html }) {
  console.log('➡️ Sending mail to:', to);
  return transporter.sendMail({
    from: `"Online Auction" <${process.env.MAIL_USER}>`,
    to,
    subject,
    html,
  });
}

export { transporter };

export async function sendOtpEmail(user, otp, purpose, verifyUrl = null) {
  let subject = '';
  let html = '';

  if (purpose === 'reset_password') {
    subject = 'Password Reset for Your Online Auction Account';
    html = `
      <p>Hi ${user.fullname},</p>
      <p>Your OTP code for password reset is: <strong>${otp}</strong></p>
      <p>This code will expire in 15 minutes.</p>
    `;
  } else {
    // verify_email
    subject = 'Verify your Online Auction account';
    html = `
      <p>Hi ${user.fullname},</p>
      <p>Your OTP code is: <strong>${otp}</strong></p>
      <p>This code will expire in 15 minutes.</p>
    `;
    if (verifyUrl) {
      html += `
        <p>You can enter this code on the verification page, or click the link below:</p>
        <p><a href="${verifyUrl}">Verify your email</a></p>
        <p>If you did not register, please ignore this email.</p>
      `;
    }
  }

  return sendMail({ to: user.email, subject, html });
}

export async function sendDescriptionUpdateEmail(user, product, description, productUrl) {
  const subject = `[Auction Update] New description added for "${product.name}"`;
  const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #72AEC8 0%, #5a9bb8 100%); padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">Product Description Updated</h1>
          </div>
          <div style="padding: 20px; background: #f9f9f9;">
              <p>Hello <strong>${user.fullname}</strong>,</p>
              <p>The seller has added new information to the product description:</p>
              <div style="background: white; padding: 15px; border-left: 4px solid #72AEC8; margin: 15px 0;">
                  <h3 style="margin: 0 0 10px 0; color: #333;">${product.name}</h3>
                  <p style="margin: 0; color: #666;">Current Price: <strong style="color: #72AEC8;">${new Intl.NumberFormat('en-US').format(product.current_price)} VND</strong></p>
              </div>
              <div style="background: #fff8e1; padding: 15px; border-radius: 5px; margin: 15px 0;">
                  <p style="margin: 0 0 10px 0; font-weight: bold; color: #f57c00;"><i>✉</i> New Description Added:</p>
                  <div style="color: #333;">${description.trim()}</div>
              </div>
              <p>View the product to see the full updated description:</p>
              <a href="${productUrl}" style="display: inline-block; background: #72AEC8; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; margin: 10px 0;">View Product</a>
              <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
              <p style="color: #999; font-size: 12px;">You received this email because you placed a bid or asked a question on this product.</p>
          </div>
      </div>
  `;
  return sendMail({ to: user.email, subject, html });
}
