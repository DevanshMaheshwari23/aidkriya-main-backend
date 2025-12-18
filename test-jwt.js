require('dotenv').config();
const jwt = require('jsonwebtoken');
const generateToken = require('./src/utils/generateToken');

console.log('🔐 Testing JWT Token Generation\n');

// Check if JWT_SECRET is loaded
console.log('1️⃣ Checking Environment Variables:');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '✅ Found' : '❌ Not Found');
console.log('JWT_EXPIRE:', process.env.JWT_EXPIRE || '30d (default)');
console.log('');

if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET not found in .env file!');
  console.log('Add this to your .env file:');
  console.log('JWT_SECRET=your-super-secret-key-here');
  process.exit(1);
}

// Test token generation
console.log('2️⃣ Testing Token Generation:');
const testUserId = '674a8c5f1234567890abcdef';
const token = generateToken(testUserId);
console.log('Generated Token:', token);
console.log('Token Length:', token.length, 'characters');
console.log('');

// Test token verification
console.log('3️⃣ Testing Token Verification:');
try {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  console.log('✅ Token is VALID');
  console.log('Decoded Payload:', decoded);
  console.log('User ID:', decoded.id);
  console.log('Issued At:', new Date(decoded.iat * 1000).toLocaleString());
  console.log('Expires At:', new Date(decoded.exp * 1000).toLocaleString());
  console.log('');
  console.log('✅ JWT is working correctly!');
} catch (error) {
  console.error('❌ Token verification failed:', error.message);
}