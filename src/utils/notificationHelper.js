const Notification = require('../models/Notification');
const server = require('../server');

const dispatchPushNotification = async (userId, title, message, data = {}) => {
  // Placeholder for FCM or any other push provider
  console.log(`📬 Notification dispatched for user ${userId}:`, {
    title,
    message,
    data
  });
  return { success: true };
};

const sendNotification = async (
  userId,
  title,
  message,
  data = {},
  options = {}
) => {
  const {
    type = 'SYSTEM',
    relatedId,
    relatedModel,
    priority = type === 'SOS_ALERT' ? 'URGENT' : 'MEDIUM',
    actionUrl,
    imageUrl,
    expiresAt
  } = options;

  try {
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

    const dispatchResult = await dispatchPushNotification(userId, title, message, data);
    await Notification.findByIdAndUpdate(notification._id, {
      isSent: dispatchResult.success,
      deliveryStatus: dispatchResult.success ? 'SENT' : 'FAILED',
      sentAt: dispatchResult.success ? new Date() : undefined
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

    return { success: true, notification };
  } catch (error) {
    console.error('❌ Error sending notification:', error);
    return { success: false, error: error.message };
  }
};

const sendBulkNotifications = async (
  userIds,
  title,
  message,
  type = 'SYSTEM',
  data = {},
  options = {}
) => {
  const results = await Promise.all(
    userIds.map(userId =>
      sendNotification(userId, title, message, data, { ...options, type })
    )
  );

  const successful = results.filter(r => r.success).length;
  console.log(`✅ Created ${successful}/${userIds.length} notifications`);

  return { successful, total: userIds.length };
};

// Notification templates
const notificationTemplates = {
  walkRequestReceived: (wandererName) => ({
    title: 'New Walk Request',
    message: `${wandererName} is requesting a walk. Check it out!`,
    type: 'WALK_REQUEST'
  }),
  
  walkRequestAccepted: (walkerName) => ({
    title: 'Walk Request Accepted',
    message: `${walkerName} accepted your walk request. Get ready!`,
    type: 'WALK_ACCEPTED'
  }),
  
  walkRequestDeclined: (walkerName) => ({
    title: 'Walk Request Declined',
    message: `${walkerName} declined your walk request. Searching for other walkers...`,
    type: 'WALK_DECLINED'
  }),
  
  walkStarted: () => ({
    title: 'Walk Started',
    message: 'Your walk has started. Enjoy your walking experience!',
    type: 'WALK_STARTED'
  }),
  
  walkCompleted: () => ({
    title: 'Walk Completed',
    message: 'Great job! Your walk is complete. Please rate your experience.',
    type: 'WALK_COMPLETED'
  }),
  partnerEndRequested: () => ({
    title: 'End Requested',
    message: 'Your partner requested to end the walk.',
    type: 'WALK_END_REQUESTED'
  }),
  paymentPending: () => ({
    title: 'Payment Pending',
    message: 'Walk finalized. Review summary and complete payment.',
    type: 'PAYMENT_PENDING'
  }),
  
  paymentSuccess: (amount) => ({
    title: 'Payment Successful',
    message: `Payment of ₹${amount} completed successfully.`,
    type: 'PAYMENT_SUCCESS'
  }),
  
  newRating: (rating, reviewerName) => ({
    title: 'New Rating Received',
    message: `${reviewerName} rated you ${rating} stars!`,
    type: 'NEW_RATING'
  }),
  
  sosAlert: (userName, location) => ({
    title: '🚨 SOS Alert',
    message: `${userName} triggered SOS at ${location}. Immediate assistance required!`,
    type: 'SOS_ALERT'
  }),

  walletCredit: (amount) => ({
    title: 'Money Added',
    message: `₹${amount} has been added to your wallet.`,
    type: 'WALLET_CREDIT'
  }),

  earningAdded: (amount) => ({
    title: 'Earnings Received',
    message: `You earned ₹${amount} from your last walk!`,
    type: 'EARNING_ADDED'
  })
};

module.exports = {
  sendNotification,
  sendBulkNotifications,
  notificationTemplates
};
