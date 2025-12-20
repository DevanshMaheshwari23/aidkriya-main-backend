const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  signup,
  login,
  verifyOTPController,
  resendOTP,
  logout,
  getMe,
  changePassword,
  getEmailVerificationStatus,
  toggleTwoFactor
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { validate, validators } = require('../middleware/validation');

// @route   POST /api/auth/signup
router.post(
  '/signup',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('phone').custom(validators.isValidPhone),
    body('password').custom(validators.isStrongPassword),
    body('role').isIn(['WALKER', 'WANDERER']).withMessage('Valid role is required'),
    validate
  ],
  signup
);

// @route   POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
    validate
  ],
  login
);

// @route   POST /api/auth/verify-otp
router.post(
  '/verify-otp',
  protect,
  [
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
    validate
  ],
  verifyOTPController
);

// @route   POST /api/auth/resend-otp
router.post('/resend-otp', protect, resendOTP);

// @route   POST /api/auth/logout
router.post('/logout', protect, logout);

// @route   GET /api/auth/me
router.get('/me', protect, getMe);

// @route   POST /api/auth/change-password
router.post(
  '/change-password',
  protect,
  [
    body('current_password_hash')
      .isLength({ min: 64, max: 64 }).withMessage('current_password_hash must be 64 chars')
      .isHexadecimal().withMessage('current_password_hash must be hex'),
    body('new_password_hash')
      .isLength({ min: 64, max: 64 }).withMessage('new_password_hash must be 64 chars')
      .isHexadecimal().withMessage('new_password_hash must be hex'),
    validate
  ],
  changePassword
);

// @route   GET /api/auth/email/verification-status
router.get('/email/verification-status', protect, getEmailVerificationStatus);

// @route   POST /api/auth/twofactor
router.post(
  '/twofactor',
  protect,
  [
    body('enable').isBoolean().withMessage('enable must be a boolean'),
    validate
  ],
  toggleTwoFactor
);

module.exports = router;
