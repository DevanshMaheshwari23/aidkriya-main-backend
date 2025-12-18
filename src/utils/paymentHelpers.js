const crypto = require('crypto');

// Calculate fare based on duration
const calculateFare = (durationMinutes) => {
  const BASE_RATE = 50; // ₹50 per 30 minutes
  const RATE_PER_MINUTE = BASE_RATE / 30;
  
  const totalAmount = durationMinutes * RATE_PER_MINUTE;
  const platformCommission = totalAmount * parseFloat(process.env.PLATFORM_COMMISSION_RATE || 0.25);
  const walkerEarnings = totalAmount - platformCommission;
  
  return {
    totalAmount: Math.round(totalAmount * 100) / 100,
    platformCommission: Math.round(platformCommission * 100) / 100,
    walkerEarnings: Math.round(walkerEarnings * 100) / 100
  };
};

// Verify Razorpay signature
const verifyRazorpaySignature = (orderId, paymentId, signature) => {
  const generatedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  
  return generatedSignature === signature;
};

// Generate Razorpay order ID
const generateOrderId = () => {
  return `order_${Date.now()}_${Math.random().toString(36).substring(7)}`;
};

module.exports = {
  calculateFare,
  verifyRazorpaySignature,
  generateOrderId
};
