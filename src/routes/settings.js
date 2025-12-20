const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getPrivacy, updatePrivacy, getNotifications, updateNotifications } = require('../controllers/settingsController');

router.get('/privacy', protect, getPrivacy);
router.post('/privacy', protect, updatePrivacy);
router.get('/notifications', protect, getNotifications);
router.post('/notifications', protect, updateNotifications);

module.exports = router;
