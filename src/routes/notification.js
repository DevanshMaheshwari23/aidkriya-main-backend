const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  createNotification,
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

// @route   POST /api/notifications/create
router.post(
  '/create',
  protect,
  [
    body('userId').notEmpty().withMessage('User ID is required'),
    body('title').notEmpty().withMessage('Title is required'),
    body('message').notEmpty().withMessage('Message is required'),
    body('type').notEmpty().withMessage('Type is required'),
    validate
  ],
  createNotification
);

// @route   GET /api/notifications/unread-count/:userId
router.get('/unread-count/:userId', protect, getUnreadCount);

// @route   GET /api/notifications/:userId
router.get('/:userId', protect, getUserNotifications);

// @route   PUT /api/notifications/:notificationId/read
router.put('/:notificationId/read', protect, markAsRead);

// @route   PUT /api/notifications/mark-all-read/:userId
router.put('/mark-all-read/:userId', protect, markAllAsRead);

// @route   DELETE /api/notifications/:notificationId
router.delete('/:notificationId', protect, deleteNotification);

// @route   DELETE /api/notifications/all/:userId
router.delete('/all/:userId', protect, deleteAllNotifications);

module.exports = router;
