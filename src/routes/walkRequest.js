const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  createWalkRequest,
  getWalkRequest,
  cancelWalkRequest,
  getWalkHistory,
  getActiveWalkRequest
} = require('../controllers/walkRequestController');
const { protect, authorize } = require('../middleware/auth');
const { validate, validators } = require('../middleware/validation');

// @route   POST /api/walk-request/create
router.post(
  '/create',
  protect,
  authorize('WANDERER'),
  [
    body('latitude').custom(validators.isValidCoordinate),
    body('longitude').custom(validators.isValidLongitude),
    body('address').notEmpty().withMessage('Address is required'),
    body('durationMinutes').isInt({ min: 15, max: 240 }).withMessage('Duration must be between 15 and 240 minutes'),
    body('pace').isIn(['Slow', 'Moderate', 'Fast', 'Very Fast']).withMessage('Invalid pace'),
    body('conversationLevel').isIn(['Silent', 'Light', 'Moderate', 'Chatty']).withMessage('Invalid conversation level'),
    validate
  ],
  createWalkRequest
);

// @route   GET /api/walk-request/:requestId
router.get('/:requestId', protect, getWalkRequest);

// @route   PUT /api/walk-request/:requestId/cancel
router.put(
  '/:requestId/cancel',
  protect,
  [
    body('cancellationReason').optional().isString().withMessage('Cancellation reason must be a string'),
    validate
  ],
  cancelWalkRequest
);

// @route   GET /api/walk-request/history/:userId
router.get('/history/:userId', protect, getWalkHistory);

// @route   GET /api/walk-request/active/:userId
router.get('/active/:userId', protect, getActiveWalkRequest);

module.exports = router;
