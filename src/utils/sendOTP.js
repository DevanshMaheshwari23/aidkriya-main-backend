const { sendSMS, formatPhoneNumber, isTwilioConfigured } = require('../config/twilio');

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP SMS
const sendOTP = async (phone, otp) => {
  const formattedPhone = formatPhoneNumber(phone);
  const message = `Your aidKRIYA Walker verification code is: ${otp}. Valid for 10 minutes.`;
  const result = await sendSMS(formattedPhone, message);

  if (!isTwilioConfigured()) {
    console.warn('⚠️ Twilio disabled. OTP logged instead of sent via SMS.');
  }

  if (result.success) {
    console.log(`✅ OTP ${otp} sent to ${formattedPhone}`);
  }

  return result;
};

// Verify OTP
const verifyOTP = (storedOTP, providedOTP, otpExpiry) => {
  if (!storedOTP || !otpExpiry) {
    return { valid: false, message: 'No OTP found' };
  }

  if (new Date() > new Date(otpExpiry)) {
    return { valid: false, message: 'OTP expired' };
  }

  if (storedOTP !== providedOTP) {
    return { valid: false, message: 'Invalid OTP' };
  }

  return { valid: true, message: 'OTP verified' };
};

module.exports = {
  generateOTP,
  sendOTP,
  verifyOTP
};