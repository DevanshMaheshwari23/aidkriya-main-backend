const twilio = require('twilio');

let client;

const isTwilioConfigured = () => {
  return (
    !!process.env.TWILIO_ACCOUNT_SID &&
    !!process.env.TWILIO_AUTH_TOKEN &&
    !!process.env.TWILIO_PHONE_NUMBER
  );
};

const getClient = () => {
  if (!isTwilioConfigured()) {
    return null;
  }

  if (!client) {
    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }

  return client;
};

const formatPhoneNumber = (phone = '') => {
  const trimmed = phone.trim();
  if (trimmed.startsWith('+')) return trimmed;
  return `+91${trimmed}`;
};

const sendSMS = async (to, message) => {
  const formattedNumber = formatPhoneNumber(to);

  if (!isTwilioConfigured()) {
    console.warn('⚠️ Twilio not configured. Falling back to console log for SMS sending.');
    console.log(`📨 MOCK SMS to ${formattedNumber}: ${message}`);
    return {
      success: true,
      sid: `MOCK_${Date.now()}`,
      status: 'mocked',
      to: formattedNumber
    };
  }

  try {
    const twilioClient = getClient();
    const response = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedNumber
    });

    return {
      success: true,
      sid: response.sid,
      status: response.status,
      to: response.to
    };
  } catch (error) {
    console.error('❌ Twilio SMS error:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendSMS,
  formatPhoneNumber,
  isTwilioConfigured
};