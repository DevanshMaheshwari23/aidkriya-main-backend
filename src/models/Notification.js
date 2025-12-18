const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  type: {
    type: String,
    enum: [
      'WALK_REQUEST',      // New walk request received
      'WALK_ACCEPTED',     // Walk request accepted
      'WALK_STARTED',      // Walk session started
      'WALK_COMPLETED',    // Walk completed
      'WALK_CANCELLED',    // Walk cancelled
      'PAYMENT_SUCCESS',   // Payment successful
      'PAYMENT_FAILED',    // Payment failed
      'WALLET_CREDIT',     // Money added to wallet
      'EARNING_ADDED',     // Earnings credited
      'NEW_RATING',        // New rating received
      'SOS_ALERT',         // Emergency SOS alert
      'SYSTEM',            // System notifications
      'REMINDER'           // Reminders
    ],
    required: true
  },
  data: {
    // Additional data related to notification
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  relatedId: {
    // ID of related entity (walk request, session, payment, etc.)
    type: mongoose.Schema.Types.ObjectId
  },
  relatedModel: {
    // Model name of related entity
    type: String,
    enum: ['WalkRequest', 'WalkSession', 'Payment', 'Rating', null]
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: {
    type: Date
  },
  priority: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
    default: 'MEDIUM'
  },
  actionUrl: {
    // Deep link or action URL
    type: String
  },
  imageUrl: {
    // Optional image for notification
    type: String
  },
  expiresAt: {
    // Notification expiry time
    type: Date
  },
  isSent: {
    type: Boolean,
    default: false
  },
  sentAt: {
    type: Date
  },
  deliveryStatus: {
    type: String,
    enum: ['PENDING', 'SENT', 'DELIVERED', 'FAILED'],
    default: 'PENDING'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for faster queries
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // Auto-delete after 30 days

// Methods

// Mark notification as read
notificationSchema.methods.markAsRead = async function() {
  this.isRead = true;
  this.readAt = new Date();
  return await this.save();
};

// Check if notification is expired
notificationSchema.methods.isExpired = function() {
  return this.expiresAt && new Date() > this.expiresAt;
};

// Static Methods

// Get unread count for user
notificationSchema.statics.getUnreadCount = async function(userId) {
  return await this.countDocuments({
    userId,
    isRead: false
  });
};

// Mark all as read for user
notificationSchema.statics.markAllAsRead = async function(userId) {
  return await this.updateMany(
    { userId, isRead: false },
    { 
      isRead: true, 
      readAt: new Date() 
    }
  );
};

// Delete old notifications (cleanup)
notificationSchema.statics.deleteOldNotifications = async function(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return await this.deleteMany({
    createdAt: { $lt: cutoffDate }
  });
};

// Get notifications with pagination
notificationSchema.statics.getUserNotifications = async function(userId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  
  const [notifications, total] = await Promise.all([
    this.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    this.countDocuments({ userId })
  ]);
  
  return {
    notifications,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      hasNextPage: page < Math.ceil(total / limit)
    }
  };
};

module.exports = mongoose.model('Notification', notificationSchema);
