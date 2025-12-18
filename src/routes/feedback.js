const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { createFeedback } = require('../controllers/feedbackController');

// @route   POST /api/feedback
router.post(
  '/',
  protect,
  [
    body('sessionId').notEmpty().withMessage('Session ID is required'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('message').optional().isLength({ max: 500 }).withMessage('Message must be less than 500 characters'),
    validate,
  ],
  createFeedback
);

module.exports = router;

