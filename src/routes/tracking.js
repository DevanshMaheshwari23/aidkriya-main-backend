const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  startWalkSession,
  updateLocation,
  endWalkSession,
  getWalkSession,
  getPartnerLocation,
  sendSOSAlert,
  getPaymentSummary
} = require('../controllers/trackingController');
const { protect } = require('../middleware/auth');
const { validate, validators } = require('../middleware/validation');
// Add these imports at the top with other controller imports
const { getWalkOtp, verifyWalkOtp } = require('../controllers/trackingController');
const { getSessionByWalkRequestId } = require('../controllers/trackingController');
const { updateWalkerArrivalLocation, getPartnerLocationByRequest } = require('../controllers/trackingController');

// Add these routes
router.get('/otp/:walkRequestId', protect, getWalkOtp);

router.post(
  '/verify-otp',
  protect,
  [
    body('walk_request_id').notEmpty().withMessage('Walk request ID is required'),
    body('otp').notEmpty().withMessage('OTP is required'),
    validate
  ],
  verifyWalkOtp
);


// @route   POST /api/tracking/start
router.post(
  '/start',
  protect,
  [
    body('walk_request_id').notEmpty().withMessage('Walk request ID is required'),
    body('wanderer_id').notEmpty().withMessage('Wanderer ID is required'),
    body('walker_id').notEmpty().withMessage('Walker ID is required'),
    validate
  ],
  startWalkSession
);

// @route   POST /api/tracking/update-location
router.post(
  '/update-location',
  protect,
  [
    body('session_id').notEmpty().withMessage('Session ID is required'),
    body('location.latitude').custom(validators.isValidCoordinate),
    body('location.longitude').custom(validators.isValidLongitude),
    body('location.timestamp').notEmpty().withMessage('Timestamp is required'),
    validate
  ],
  updateLocation
);

// Pre-session: walker updates current location tied to walk request
router.post(
  '/update-location/:requestId',
  protect,
  [
    body('latitude').custom(validators.isValidCoordinate),
    body('longitude').custom(validators.isValidLongitude),
    validate
  ],
  updateWalkerArrivalLocation
);

// @route   POST /api/tracking/end
router.post(
  '/end',
  protect,
  [
    body('session_id').notEmpty().withMessage('Session ID is required'),
    validate
  ],
  endWalkSession
);

// @route   GET /api/tracking/session/:sessionId
router.get('/session/:sessionId', protect, getWalkSession);

// @route   GET /api/tracking/session/by-request/:walkRequestId
router.get('/session/by-request/:walkRequestId', protect, getSessionByWalkRequestId);

// @route   GET /api/tracking/partner-location/:sessionId
router.get('/partner-location/:sessionId', protect, getPartnerLocation);

// Pre-session: partner location by walk request
router.get('/partner-location/by-request/:requestId', protect, getPartnerLocationByRequest);

// @route   GET /api/tracking/payment-summary/:sessionId
router.get('/payment-summary/:sessionId', protect, getPaymentSummary);

// @route   POST /api/tracking/sos-alert
router.post(
  '/sos-alert',
  protect,
  [
    body('session_id').notEmpty().withMessage('Session ID is required'),
    body('location.latitude').custom(validators.isValidCoordinate),
    body('location.longitude').custom(validators.isValidLongitude),
    validate
  ],
  sendSOSAlert
);

module.exports = router;
