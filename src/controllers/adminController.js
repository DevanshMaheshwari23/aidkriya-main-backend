const User = require('../models/User');
const Profile = require('../models/Profile');
const WalkSession = require('../models/WalkSession');
const WalkRequest = require('../models/WalkRequest');
const Payment = require('../models/Payment');
const Payout = require('../models/Payout');
const { successResponse, errorResponse, getPaginationData } = require('../utils/responseHelper');
const { sendNotification, notificationTemplates } = require('../utils/notificationHelper');

exports.getSummary = async (req, res) => {
  try {
    const [
      totalUsers,
      walkers,
      wanderers,
      activeSessions,
      unresolvedSOS,
      payoutPending
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ role: 'WALKER' }),
      User.countDocuments({ role: 'WANDERER' }),
      WalkSession.countDocuments({ status: 'ACTIVE' }),
      WalkSession.countDocuments({ sosTriggered: true, sosResolved: false }),
      Payout.countDocuments({ status: 'PENDING' })
    ]);

    successResponse(res, 200, 'Admin summary', {
      totals: {
        users: totalUsers,
        walkers,
        wanderers,
        activeSessions,
        unresolvedSOS,
        payoutPending
      }
    });
  } catch (error) {
    errorResponse(res, 500, 'Error fetching admin summary', error.message);
  }
};

exports.listSOSAlerts = async (req, res) => {
  try {
    const { resolved, page = 1, limit = 20 } = req.query;
    const match = { sosTriggered: true };
    if (typeof resolved !== 'undefined') {
      match.sosResolved = String(resolved).toLowerCase() === 'true';
    }

    const total = await WalkSession.countDocuments(match);
    const { skip, itemsPerPage, totalPages } = getPaginationData(page, limit, total);

    const sessions = await WalkSession.find(match)
      .sort({ sosTimestamp: -1 })
      .skip(skip)
      .limit(itemsPerPage)
      .populate('wandererId', 'name phone email')
      .populate('walkerId', 'name phone email')
      .populate('walkRequestId');

    successResponse(res, 200, 'SOS alerts', {
      items: sessions,
      pagination: { page: Number(page), totalPages, totalItems: total }
    });
  } catch (error) {
    errorResponse(res, 500, 'Error fetching SOS alerts', error.message);
  }
};

exports.resolveSOS = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { notes } = req.body || {};
    const session = await WalkSession.findById(sessionId);
    if (!session) {
      return errorResponse(res, 404, 'Walk session not found');
    }
    if (!session.sosTriggered) {
      return errorResponse(res, 400, 'No SOS triggered for this session');
    }
    session.sosResolved = true;
    session.sosResolvedAt = new Date();
    if (typeof notes !== 'undefined') {
      session.sosResolvedNotes = String(notes);
    }
    await session.save();

    successResponse(res, 200, 'SOS resolved', { sessionId: session._id, resolvedAt: session.sosResolvedAt });
  } catch (error) {
    errorResponse(res, 500, 'Error resolving SOS', error.message);
  }
};

exports.listPayouts = async (req, res) => {
  try {
    const { status = 'ALL', page = 1, limit = 20 } = req.query;
    const match = status && status !== 'ALL' ? { status: String(status).toUpperCase() } : {};
    const total = await Payout.countDocuments(match);
    const { skip, itemsPerPage, totalPages } = getPaginationData(page, limit, total);
    const payouts = await Payout.find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(itemsPerPage)
      .populate('userId', 'name email phone');

    successResponse(res, 200, 'Payouts', {
      items: payouts,
      pagination: { page: Number(page), totalPages, totalItems: total }
    });
  } catch (error) {
    errorResponse(res, 500, 'Error fetching payouts', error.message);
  }
};

exports.updatePayoutStatus = async (req, res) => {
  try {
    const { payoutId } = req.params;
    const { status, externalReferenceId } = req.body;
    if (!['SUCCESS', 'FAILED', 'PENDING'].includes(String(status).toUpperCase())) {
      return errorResponse(res, 400, 'Invalid status');
    }
    const payout = await Payout.findById(payoutId);
    if (!payout) {
      return errorResponse(res, 404, 'Payout not found');
    }
    payout.status = String(status).toUpperCase();
    if (externalReferenceId) {
      payout.externalReferenceId = externalReferenceId;
    }
    if (payout.status === 'SUCCESS' && !payout.completedAt) {
      payout.completedAt = new Date();
    }
    await payout.save();
    successResponse(res, 200, 'Payout updated', { payout });
  } catch (error) {
    errorResponse(res, 500, 'Error updating payout', error.message);
  }
};
exports.listPayments = async (req, res) => {
  try {
    const { page = 1, limit = 20, status = 'SUCCESS' } = req.query;
    const match = status ? { status: String(status).toUpperCase() } : {};
    const total = await Payment.countDocuments(match);
    const { skip, itemsPerPage, totalPages } = getPaginationData(page, limit, total);
    const payments = await Payment.find(match)
      .sort({ completedAt: -1 })
      .skip(skip)
      .limit(itemsPerPage)
      .populate('wandererId', 'name')
      .populate('walkerId', 'name')
      .populate('walkSessionId');

    successResponse(res, 200, 'Payments', {
      items: payments,
      pagination: { page: Number(page), totalPages, totalItems: total }
    });
  } catch (error) {
    errorResponse(res, 500, 'Error fetching payments', error.message);
  }
};

exports.listWalkersForVerification = async (req, res) => {
  try {
    const { verified = 'false', page = 1, limit = 20 } = req.query;
    const isVerified = String(verified).toLowerCase() === 'true';
    const match = { 'verification.isVerified': isVerified };

    // Only walker profiles
    const total = await Profile.countDocuments(match);
    const { skip, itemsPerPage, totalPages } = getPaginationData(page, limit, total);
    const profiles = await Profile.find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(itemsPerPage)
      .populate({ path: 'userId', select: 'name email phone role', match: { role: 'WALKER' } });

    const filtered = profiles.filter(p => !!p.userId);

    successResponse(res, 200, 'Walker profiles', {
      items: filtered,
      pagination: { page: Number(page), totalPages, totalItems: filtered.length }
    });
  } catch (error) {
    errorResponse(res, 500, 'Error fetching walker profiles', error.message);
  }
};

exports.verifyWalker = async (req, res) => {
  try {
    const { userId } = req.params;
    const profile = await Profile.findOne({ userId });
    if (!profile) {
      return errorResponse(res, 404, 'Profile not found');
    }
    profile.verification = profile.verification || {};
    profile.verification.isVerified = true;
    profile.verification.verifiedAt = new Date();
    await profile.save();

    successResponse(res, 200, 'Walker verified', { userId });
  } catch (error) {
    errorResponse(res, 500, 'Error verifying walker', error.message);
  }
};

exports.listSessions = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const match = {};
    if (status) {
      match.status = String(status).toUpperCase();
    }
    const total = await WalkSession.countDocuments(match);
    const { skip, itemsPerPage, totalPages } = getPaginationData(page, limit, total);
    const sessions = await WalkSession.find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(itemsPerPage)
      .populate('wandererId', 'name')
      .populate('walkerId', 'name')
      .populate('walkRequestId');

    successResponse(res, 200, 'Sessions', {
      items: sessions,
      pagination: { page: Number(page), totalPages, totalItems: total }
    });
  } catch (error) {
    errorResponse(res, 500, 'Error fetching sessions', error.message);
  }
};

exports.getSessionDetail = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await WalkSession.findById(sessionId)
      .populate('wandererId', 'name email phone')
      .populate('walkerId', 'name email phone')
      .populate('walkRequestId');
    if (!session) {
      return errorResponse(res, 404, 'Session not found');
    }
    successResponse(res, 200, 'Session detail', { session });
  } catch (error) {
    errorResponse(res, 500, 'Error fetching session detail', error.message);
  }
};

exports.searchUsers = async (req, res) => {
  try {
    const { q = '', page = 1, limit = 20, role } = req.query;
    const regex = new RegExp(String(q), 'i');
    const match = {
      $or: [{ name: regex }, { email: regex }, { phone: regex }]
    };
    if (role) {
      match.role = String(role).toUpperCase();
    }
    const total = await User.countDocuments(match);
    const { skip, itemsPerPage, totalPages } = getPaginationData(page, limit, total);
    const users = await User.find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(itemsPerPage)
      .select('name email phone role isActive createdAt');
    const profiles = await Profile.find({ userId: { $in: users.map(u => u._id) } });
    const profileByUser = Object.fromEntries(profiles.map(p => [String(p.userId), p]));
    const items = users.map(u => ({
      user: u,
      profile: profileByUser[String(u._id)] || null
    }));
    successResponse(res, 200, 'Users', {
      items,
      pagination: { page: Number(page), totalPages, totalItems: total }
    });
  } catch (error) {
    errorResponse(res, 500, 'Error searching users', error.message);
  }
};

exports.getUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }
    const profile = await Profile.findOne({ userId });
    successResponse(res, 200, 'User', { user, profile });
  } catch (error) {
    errorResponse(res, 500, 'Error fetching user', error.message);
  }
};

exports.updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }
    user.isActive = Boolean(isActive);
    await user.save();
    successResponse(res, 200, 'User status updated', { userId, isActive: user.isActive });
  } catch (error) {
    errorResponse(res, 500, 'Error updating user status', error.message);
  }
};

exports.notifyUser = async (req, res) => {
  try {
    const { userId, title, message, type = 'SYSTEM' } = req.body;
    const result = await sendNotification(userId, title, message, {}, { type });
    if (!result.success) {
      return errorResponse(res, 500, 'Notification failed', result.error);
    }
    successResponse(res, 200, 'Notification sent', { notificationId: result.notification._id });
  } catch (error) {
    errorResponse(res, 500, 'Error sending notification', error.message);
  }
};

exports.broadcastPromotion = async (req, res) => {
  try {
    const { role, title, message, actionUrl, imageUrl, expiresAt, activeOnly = true } = req.body;
    const targetRole = String(role || '').toUpperCase();
    if (!['WALKER', 'WANDERER'].includes(targetRole)) {
      return errorResponse(res, 400, 'Invalid role: must be WALKER or WANDERER');
    }
    if (!title || !message) {
      return errorResponse(res, 400, 'Title and message are required');
    }
    const match = { role: targetRole };
    if (activeOnly) {
      match.isActive = true;
    }
    const users = await User.find(match).select('_id');
    const userIds = users.map(u => u._id);
    if (userIds.length === 0) {
      return successResponse(res, 200, 'No users to notify', { successful: 0, total: 0 });
    }
    const options = {
      type: 'PROMOTION',
      actionUrl,
      imageUrl,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined
    };
    const { successful, total } = await require('../utils/notificationHelper').sendBulkNotifications(
      userIds,
      title,
      message,
      'PROMOTION',
      {},
      options
    );
    successResponse(res, 200, 'Promotion broadcast sent', { successful, total });
  } catch (error) {
    errorResponse(res, 500, 'Error broadcasting promotion', error.message);
  }
};

exports.updateWalkerAvailability = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isAvailable, manualBusy } = req.body;
    const profile = await Profile.findOne({ userId });
    if (!profile) {
      return errorResponse(res, 404, 'Profile not found');
    }
    if (typeof isAvailable !== 'undefined') {
      profile.isAvailable = Boolean(isAvailable);
    }
    if (typeof manualBusy !== 'undefined') {
      profile.manualBusy = Boolean(manualBusy);
    }
    await profile.save();
    successResponse(res, 200, 'Availability updated', { userId, isAvailable: profile.isAvailable, manualBusy: profile.manualBusy });
  } catch (error) {
    errorResponse(res, 500, 'Error updating availability', error.message);
  }
};
