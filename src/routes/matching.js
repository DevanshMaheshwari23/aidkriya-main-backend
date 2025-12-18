const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  findWalkers,
  acceptWalkRequest,
  rejectWalkRequest,
  getPendingRequests,
  requestWalker
} = require('../controllers/matchingController');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

// @route   POST /api/matching/find-walkers
router.post(
  '/find-walkers',
  protect,
  authorize('WANDERER'),
  [
    body('walk_request_id').notEmpty().withMessage('Walk request ID is required'),
    validate
  ],
  findWalkers
);

// @route   POST /api/matching/accept
router.post(
  '/accept',
  protect,
  authorize('WALKER'),
  [
    body('match_id').notEmpty().withMessage('Match ID is required'),
    validate
  ],
  acceptWalkRequest
);

// @route   POST /api/matching/reject
router.post(
  '/reject',
  protect,
  authorize('WALKER'),
  [
    body('match_id').notEmpty().withMessage('Match ID is required'),
    validate
  ],
  rejectWalkRequest
);

// @route   GET /api/matching/pending-requests/:walkerId
router.get(
  '/pending-requests/:walkerId',
  protect,
  authorize('WALKER'),
  getPendingRequests
);

// @route   POST /api/matching/request
router.post(
  '/request',
  protect,
  authorize('WANDERER'),
  [
    body('walk_request_id').notEmpty().withMessage('Walk request ID is required'),
    body('walker_id').notEmpty().withMessage('Walker ID is required'),
    validate
  ],
  requestWalker
);

module.exports = router;
