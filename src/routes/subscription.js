const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const {
  createSubscription,
  getActiveSubscription,
  quickStartWalk,
  updateSubscription,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
} = require('../controllers/subscriptionController');

// Create subscription
router.post(
  '/create',
  protect,
  authorize('WANDERER'),
  [
    body('subscriptionType').isIn(['DAILY', 'WEEKDAYS', 'WEEKENDS', 'CUSTOM']).withMessage('Invalid subscriptionType'),
    body('durationMinutes').isIn([15, 30, 45, 60]).withMessage('Invalid duration'),
    body('preferredTimeSlot').isIn(['MORNING', 'AFTERNOON', 'EVENING', 'FLEXIBLE']).withMessage('Invalid time slot'),
    body('mobilityLevel').isIn(['INDEPENDENT', 'LIGHT_SUPPORT', 'WALKING_AID_USER', 'LIMITED_MOBILITY']).withMessage('Invalid mobility level'),
    body('primaryPurpose').isIn(['MEDICAL_RECOVERY', 'EXERCISE_FITNESS', 'ERRANDS_SHOPPING', 'FRESH_AIR_LEISURE', 'SOCIAL_COMPANION', 'SAFETY_MONITORING']).withMessage('Invalid primary purpose'),
    validate,
  ],
  createSubscription
);

// Get active subscription
router.get('/active/:userId', protect, authorize('WANDERER'), getActiveSubscription);

// Quick-start walk
router.post(
  '/quick-start',
  protect,
  authorize('WANDERER'),
  [
    body('subscriptionId').notEmpty().withMessage('subscriptionId is required'),
    body('latitude').isFloat().withMessage('latitude required'),
    body('longitude').isFloat().withMessage('longitude required'),
    body('address').notEmpty().withMessage('address required'),
    validate,
  ],
  quickStartWalk
);

// Update subscription
router.patch(
  '/update',
  protect,
  authorize('WANDERER'),
  [
    body('subscriptionId').notEmpty().withMessage('subscriptionId is required'),
    body('updates').isObject().withMessage('updates object is required'),
    validate,
  ],
  updateSubscription
);

// Pause
router.post(
  '/pause',
  protect,
  authorize('WANDERER'),
  [body('subscriptionId').notEmpty().withMessage('subscriptionId is required'), validate],
  pauseSubscription
);

// Resume
router.post(
  '/resume',
  protect,
  authorize('WANDERER'),
  [body('subscriptionId').notEmpty().withMessage('subscriptionId is required'), validate],
  resumeSubscription
);

// Cancel
router.delete(
  '/cancel',
  protect,
  authorize('WANDERER'),
  [body('subscriptionId').notEmpty().withMessage('subscriptionId is required'), validate],
  cancelSubscription
);

module.exports = router;

