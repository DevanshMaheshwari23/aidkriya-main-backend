const Notification = require('../models/Notification');
const server = require('../server');
const { successResponse, errorResponse } = require('../utils/responseHelper');

// @desc    Create notification (internal use)
// @route   POST /api/notifications/create
// @access  Private
exports.createNotification = async (req, res) => {
  try {
    const {
      userId,
      title,
      message,
      type,
      data,
      relatedId,
      relatedModel,
      priority,
      actionUrl,
      imageUrl,
      expiresAt
    } = req.body;

    const notification = await Notification.create({
      userId,
      title,
      message,
      type,
      data,
      relatedId,
      relatedModel,
      priority,
      actionUrl,
      imageUrl,
      expiresAt
    });

    try {
      const unreadCount = await Notification.getUnreadCount(userId);
      if (server && server.io) {
        server.io.to(`user:${userId}`).emit('notifications:new', {
          notification,
          unreadCount
        });
      }
    } catch (_) {}

    successResponse(res, 201, 'Notification created successfully', {
      notification
    });
  } catch (error) {
    console.error('Create notification error:', error);
    errorResponse(res, 500, 'Error creating notification', error.message);
  }
};

// @desc    Get all notifications for user
// @route   GET /api/notifications/:userId
// @access  Private
exports.getUserNotifications = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, unreadOnly = false } = req.query;

    const query = { userId };
    if (unreadOnly === 'true') {
      query.isRead = false;
    }

    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Notification.countDocuments(query),
      Notification.getUnreadCount(userId)
    ]);

    successResponse(res, 200, 'Notifications retrieved successfully', {
      notifications,
      unreadCount,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        hasNextPage: page < Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    errorResponse(res, 500, 'Error fetching notifications', error.message);
  }
};

// @desc    Get unread notification count
// @route   GET /api/notifications/unread-count/:userId
// @access  Private
exports.getUnreadCount = async (req, res) => {
  try {
    const { userId } = req.params;

    const unreadCount = await Notification.getUnreadCount(userId);

    successResponse(res, 200, 'Unread count retrieved', {
      unreadCount
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    errorResponse(res, 500, 'Error fetching unread count', error.message);
  }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:notificationId/read
// @access  Private
exports.markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findById(notificationId);

    if (!notification) {
      return errorResponse(res, 404, 'Notification not found');
    }

    // Verify user owns this notification
    if (notification.userId.toString() !== req.user._id.toString()) {
      return errorResponse(res, 403, 'Not authorized to update this notification');
    }

    await notification.markAsRead();

    try {
      const unreadCount = await Notification.getUnreadCount(notification.userId);
      if (server && server.io) {
        server.io.to(`user:${notification.userId}`).emit('notifications:read', {
          notificationId,
          unreadCount
        });
      }
    } catch (_) {}

    successResponse(res, 200, 'Notification marked as read', {
      notification
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    errorResponse(res, 500, 'Error marking notification as read', error.message);
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/mark-all-read/:userId
// @access  Private
exports.markAllAsRead = async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify user is marking their own notifications
    if (userId !== req.user._id.toString()) {
      return errorResponse(res, 403, 'Not authorized');
    }

    const result = await Notification.markAllAsRead(userId);

    try {
      const unreadCount = await Notification.getUnreadCount(userId);
      if (server && server.io) {
        server.io.to(`user:${userId}`).emit('notifications:mark-all-read', {
          unreadCount,
          modifiedCount: result.modifiedCount
        });
      }
    } catch (_) {}

    successResponse(res, 200, 'All notifications marked as read', {
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    errorResponse(res, 500, 'Error marking all notifications as read', error.message);
  }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:notificationId
// @access  Private
exports.deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findById(notificationId);

    if (!notification) {
      return errorResponse(res, 404, 'Notification not found');
    }

    // Verify user owns this notification
    if (notification.userId.toString() !== req.user._id.toString()) {
      return errorResponse(res, 403, 'Not authorized to delete this notification');
    }

    await notification.deleteOne();

    try {
      const unreadCount = await Notification.getUnreadCount(notification.userId);
      if (server && server.io) {
        server.io.to(`user:${notification.userId}`).emit('notifications:delete', {
          notificationId,
          unreadCount
        });
      }
    } catch (_) {}

    successResponse(res, 200, 'Notification deleted successfully');
  } catch (error) {
    console.error('Delete notification error:', error);
    errorResponse(res, 500, 'Error deleting notification', error.message);
  }
};

// @desc    Delete all notifications for user
// @route   DELETE /api/notifications/all/:userId
// @access  Private
exports.deleteAllNotifications = async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify user is deleting their own notifications
    if (userId !== req.user._id.toString()) {
      return errorResponse(res, 403, 'Not authorized');
    }

    const result = await Notification.deleteMany({ userId });

    try {
      const unreadCount = await Notification.getUnreadCount(userId);
      if (server && server.io) {
        server.io.to(`user:${userId}`).emit('notifications:delete-all', {
          unreadCount,
          deletedCount: result.deletedCount
        });
      }
    } catch (_) {}

    successResponse(res, 200, 'All notifications deleted', {
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Delete all notifications error:', error);
    errorResponse(res, 500, 'Error deleting notifications', error.message);
  }
};
