import * as userModel from '../models/user.model.js';
import { sendOtpEmail } from '../utils/mailer.js';

export function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function createAndSendOtp(user, purpose, verifyUrl = null) {
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

  await userModel.createOtp({
    user_id: user.id,
    otp_code: otp,
    purpose: purpose,
    expires_at: expiresAt,
  });

  await sendOtpEmail(user, otp, purpose, verifyUrl);
  return otp;
}

export async function verifyRecaptcha(token) {
  if (!token) {
    return { success: false, message: 'Please check the captcha box.' };
  }
  
  const secretKey = process.env.RECAPTCHA_SECRET;
  const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`;
  
  try {
    const response = await fetch(verifyUrl, { method: 'POST' });
    const data = await response.json();
    if (!data.success) {
      return { success: false, message: 'Captcha verification failed. Please try again.' };
    }
    return { success: true };
  } catch (err) {
    console.error('Recaptcha error:', err);
    return { success: false, message: 'Error connecting to captcha server.' };
  }
}
