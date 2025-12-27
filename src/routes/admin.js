const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getSummary,
  listSOSAlerts,
  resolveSOS,
  listPayouts,
  listPayments,
  listWalkersForVerification,
  verifyWalker,
  listSessions,
  getSessionDetail,
  searchUsers,
  getUser,
  updateUserStatus,
  notifyUser,
  updateWalkerAvailability
} = require('../controllers/adminController');
const { body } = require('express-validator');
const { validate } = require('../middleware/validation');

router.use(protect, authorize('ADMIN'));

router.get('/summary', getSummary);

router.get('/sos-alerts', listSOSAlerts);
router.post('/sos/:sessionId/resolve', resolveSOS);

router.get('/payouts', listPayouts);
router.put(
  '/payouts/:payoutId',
  [
    body('status').isIn(['SUCCESS', 'FAILED', 'PENDING']).withMessage('Invalid status'),
    validate
  ],
  require('../controllers/adminController').updatePayoutStatus
);

router.get('/payments', listPayments);

router.get('/walkers', listWalkersForVerification);
router.post('/walkers/:userId/verify', verifyWalker);

router.get('/sessions', listSessions);
router.get('/session/:sessionId', getSessionDetail);

router.get('/users', searchUsers);
router.get('/users/:userId', getUser);
router.put(
  '/users/:userId/status',
  [
    body('isActive').isBoolean().withMessage('isActive must be boolean'),
    validate
  ],
  updateUserStatus
);
router.post(
  '/notify',
  [
    body('userId').notEmpty().withMessage('userId required'),
    body('title').notEmpty().withMessage('title required'),
    body('message').notEmpty().withMessage('message required'),
    validate
  ],
  notifyUser
);
router.post(
  '/walker/:userId/availability',
  [
    body('isAvailable').optional().isBoolean(),
    body('manualBusy').optional().isBoolean(),
    validate
  ],
  updateWalkerAvailability
);

module.exports = router;
