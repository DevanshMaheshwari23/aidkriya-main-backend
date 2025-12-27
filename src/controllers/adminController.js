const User = require('../models/User');
const Profile = require('../models/Profile');
const WalkSession = require('../models/WalkSession');
const WalkRequest = require('../models/WalkRequest');
const Payment = require('../models/Payment');
const Payout = require('../models/Payout');
const { successResponse, errorResponse, getPaginationData } = require('../utils/responseHelper');

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
    const session = await WalkSession.findById(sessionId);
    if (!session) {
      return errorResponse(res, 404, 'Walk session not found');
    }
    if (!session.sosTriggered) {
      return errorResponse(res, 400, 'No SOS triggered for this session');
    }
    session.sosResolved = true;
    session.sosResolvedAt = new Date();
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
