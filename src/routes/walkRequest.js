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
    body('mobilityLevel').isIn(['INDEPENDENT', 'LIGHT_SUPPORT', 'WALKING_AID_USER', 'LIMITED_MOBILITY']).withMessage('Invalid mobility level'),
    body('primaryPurpose').isIn(['MEDICAL_RECOVERY', 'EXERCISE_FITNESS', 'ERRANDS_SHOPPING', 'FRESH_AIR_LEISURE', 'SOCIAL_COMPANION', 'SAFETY_MONITORING']).withMessage('Invalid primary purpose'),
    body('purposeDetails').optional().isLength({ max: 200 }).withMessage('Purpose details must be less than 200 characters'),
    body('communicationNeeds.languages').isArray({ min: 1 }).withMessage('At least one language is required'),
    body('communicationNeeds.hearingImpaired').optional().isBoolean().withMessage('hearingImpaired must be a boolean'),
    body('communicationNeeds.speechDifficulty').optional().isBoolean().withMessage('speechDifficulty must be a boolean'),
    body('communicationNeeds.prefersNonVerbal').optional().isBoolean().withMessage('prefersNonVerbal must be a boolean'),
    body('communicationNeeds.requiresClearCommunication').optional().isBoolean().withMessage('requiresClearCommunication must be a boolean'),
    body('communicationNeeds.additionalNotes').optional().isLength({ max: 150 }).withMessage('Additional notes must be less than 150 characters'),
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
