const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  submitRating,
  getUserRatings,
  getAverageRating,
  hasRatedSession,
  reportReview
} = require('../controllers/ratingController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

// @route   POST /api/rating/submit
router.post(
  '/submit',
  protect,
  [
    body('walk_session_id').notEmpty().withMessage('Walk session ID is required'),
    body('reviewer_id').notEmpty().withMessage('Reviewer ID is required'),
    body('reviewed_user_id').notEmpty().withMessage('Reviewed user ID is required'),
    body('rating').isFloat({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('review_text').optional().isLength({ max: 500 }).withMessage('Review must be less than 500 characters'),
    validate
  ],
  submitRating
);

// @route   GET /api/rating/user/:userId
router.get('/user/:userId', getUserRatings);

// @route   GET /api/rating/average/:userId
router.get('/average/:userId', getAverageRating);

// @route   GET /api/rating/check/:sessionId/:userId
router.get('/check/:sessionId/:userId', protect, hasRatedSession);

// @route   POST /api/rating/report
router.post(
  '/report',
  protect,
  [
    body('rating_id').notEmpty().withMessage('Rating ID is required'),
    body('reason').notEmpty().withMessage('Report reason is required'),
    validate
  ],
  reportReview
);

module.exports = router;
