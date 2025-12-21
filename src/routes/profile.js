const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getProfile,
  setupProfile,
  uploadVerification,
  updateAvailability,
  heartbeat,
  getWalletBalance
} = require('../controllers/profileController');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

// @route   GET /api/profile/:userId
router.get('/:userId', getProfile);

// @route   PUT /api/profile/setup
router.put(
  '/setup',
  protect,
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('age').optional().isInt({ min: 18, max: 100 }).withMessage('Age must be between 18 and 100'),
    body('bio').optional().isLength({ max: 500 }).withMessage('Bio must be less than 500 characters'),
    body('profileImage').optional().isURL().withMessage('Invalid profile image URL').custom((value) => {
      return !/ui-avatars\.com/i.test(String(value));
    }).withMessage('Placeholder URLs are not allowed'),
    body('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
    body('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
    validate
  ],
  setupProfile
);

// @route   POST /api/profile/verification
router.post(
  '/verification',
  protect,
  [
    body('documentType').notEmpty().withMessage('Document type is required'),
    body('documentNumber').notEmpty().withMessage('Document number is required'),
    body('documentImage').notEmpty().withMessage('Document image is required'),
    validate
  ],
  uploadVerification
);

// @route   PUT /api/profile/availability
router.put(
  '/availability',
  protect,
  authorize('WALKER'),
  [
    body('isAvailable').isBoolean().withMessage('Availability must be a boolean'),
    body('manualBusy').optional().isBoolean().withMessage('manualBusy must be a boolean'),
    validate
  ],
  updateAvailability
);

// @route   POST /api/profile/heartbeat
router.post(
  '/heartbeat',
  protect,
  authorize('WALKER'),
  heartbeat
);

// @route   GET /api/profile/wallet
router.get('/wallet', protect, getWalletBalance);

module.exports = router;
