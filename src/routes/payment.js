const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  createPaymentOrder,
  verifyPayment,
  getTransactionHistory,
  getPaymentDetails,
  addToWallet,
  getWalletBalance,
  withdrawFromWallet
} = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

// @route   POST /api/payment/create-order
router.post(
  '/create-order',
  protect,
  [
    body().custom((value, { req }) => {
      const sid =
        req.body.walk_session_id ||
        req.body.walkSessionId ||
        req.body.sessionId;
      if (!sid) {
        throw new Error('Walk session ID is required');
      }
      // Normalize to snake_case for controller consumption
      req.body.walk_session_id = sid;
      return true;
    }),
    validate
  ],
  createPaymentOrder
);

// @route   POST /api/payment/verify
router.post(
  '/verify',
  protect,
  [
    body().custom((value, { req }) => {
      const sid =
        req.body.walk_session_id ||
        req.body.walkSessionId ||
        req.body.sessionId;
      if (!sid) {
        throw new Error('Walk session ID is required');
      }
      req.body.walk_session_id = sid;
      return true;
    }),
    body('razorpay_payment_id').notEmpty().withMessage('Razorpay payment ID is required'),
    body('razorpay_order_id').notEmpty().withMessage('Razorpay order ID is required'),
    body('razorpay_signature').notEmpty().withMessage('Razorpay signature is required'),
    validate
  ],
  verifyPayment
);

// @route   GET /api/payment/transactions/:userId
router.get('/transactions/:userId', protect, getTransactionHistory);

// @route   GET /api/payment/:paymentId
router.get('/:paymentId', protect, getPaymentDetails);

// @route   POST /api/payment/add-to-wallet
router.post(
  '/add-to-wallet',
  protect,
  [
    body('user_id').notEmpty().withMessage('User ID is required'),
    body('amount').isFloat({ min: 1 }).withMessage('Amount must be greater than 0'),
    validate
  ],
  addToWallet
);

// @route   GET /api/payment/wallet/:userId
router.get('/wallet/:userId', protect, getWalletBalance);

// @route   POST /api/payment/withdraw
router.post(
  '/withdraw',
  protect,
  [
    body('user_id').notEmpty().withMessage('User ID is required'),
    body('amount').isFloat({ min: 1 }).withMessage('Amount must be greater than 0'),
    body('method').isIn(['BANK', 'UPI']).withMessage('Method must be BANK or UPI'),
    validate
  ],
  withdrawFromWallet
);

module.exports = router;
