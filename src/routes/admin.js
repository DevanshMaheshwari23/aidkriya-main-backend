const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { body } = require('express-validator');
const { validate } = require('../middleware/validation');
const {
  getSummary,
  listSOSAlerts,
  resolveSOS,
  listPayouts,
  listPayments,
  listWalkersForVerification,
  verifyWalker,
  listSessions
} = require('../controllers/adminController');

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

module.exports = router;
