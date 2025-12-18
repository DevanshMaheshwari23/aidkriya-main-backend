const WalkSubscription = require('../models/WalkSubscription');
const WalkRequest = require('../models/WalkRequest');
const Profile = require('../models/Profile');
const { successResponse, errorResponse } = require('../utils/responseHelper');

function parseHHMM(str) {
  try {
    const [h, m] = (str || '').split(':').map((v) => parseInt(v, 10));
    if (isNaN(h) || isNaN(m)) return null;
    return { h, m };
  } catch { return null; }
}

function setTime(date, hhmm) {
  const d = new Date(date);
  d.setHours(hhmm.h, hhmm.m, 0, 0);
  return d;
}

function nextWeekday(from) {
  const d = new Date(from);
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() === 0 || d.getDay() === 6);
  return d;
}

function nextWeekendDay(from) {
  const d = new Date(from);
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() !== 0 && d.getDay() !== 6);
  return d;
}

function nextCustomDay(from, days) {
  const set = new Set((days || []).map((v) => parseInt(v, 10)));
  const d = new Date(from);
  for (let i = 1; i <= 14; i++) {
    const cand = new Date(from);
    cand.setDate(cand.getDate() + i);
    if (set.has(cand.getDay())) return cand;
  }
  return null;
}

function calculateNextWalkDate(subscription, baseDate = new Date()) {
  let nextDate;
  switch (subscription.subscriptionType) {
    case 'DAILY':
      nextDate = new Date(baseDate);
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case 'WEEKDAYS':
      nextDate = nextWeekday(baseDate);
      break;
    case 'WEEKENDS':
      nextDate = nextWeekendDay(baseDate);
      break;
    case 'CUSTOM':
      nextDate = nextCustomDay(baseDate, subscription.customDays || []);
      if (!nextDate) nextDate = new Date(baseDate);
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    default:
      nextDate = new Date(baseDate);
      nextDate.setDate(nextDate.getDate() + 1);
  }

  // Apply timeRange if provided
  if (subscription.timeRange && subscription.timeRange.start) {
    const hhmm = parseHHMM(subscription.timeRange.start);
    if (hhmm) nextDate = setTime(nextDate, hhmm);
  }
  return nextDate;
}

exports.createSubscription = async (req, res) => {
  try {
    const wandererId = req.user._id;
    const data = req.body;

    // Validate no active existing subscription
    const existing = await WalkSubscription.findOne({ wandererId, status: { $in: ['ACTIVE', 'PAUSED'] } });
    if (existing) {
      return errorResponse(res, 400, 'Existing subscription found. Pause or cancel before creating a new one.');
    }

    // Validate required fields minimal
    const required = ['subscriptionType', 'durationMinutes', 'preferredTimeSlot', 'mobilityLevel', 'primaryPurpose'];
    for (const f of required) {
      if (!data[f]) return errorResponse(res, 422, `Missing field: ${f}`);
    }
    if (!data.communicationNeeds || !Array.isArray(data.communicationNeeds.languages) || data.communicationNeeds.languages.length === 0) {
      return errorResponse(res, 422, 'Communication needs must include at least one language');
    }

    const subscription = new WalkSubscription({
      wandererId,
      subscriptionType: data.subscriptionType,
      customDays: data.customDays || [],
      durationMinutes: data.durationMinutes,
      preferredTimeSlot: data.preferredTimeSlot,
      timeRange: data.timeRange || {},
      mobilityLevel: data.mobilityLevel,
      primaryPurpose: data.primaryPurpose,
      purposeDetails: data.purposeDetails,
      communicationNeeds: data.communicationNeeds,
      walkerPreference: data.walkerPreference || 'ANY',
      preferredWalkerId: data.preferredWalkerId || null,
      autoMatch: data.autoMatch !== undefined ? !!data.autoMatch : true,
      advanceNotice: data.advanceNotice ?? 30,
      status: 'ACTIVE',
      totalWalksCompleted: 0,
      startDate: data.startDate || new Date(),
      endDate: data.endDate || null,
    });
    subscription.nextScheduledDate = calculateNextWalkDate(subscription, new Date());
    await subscription.save();

    return successResponse(res, 201, 'Subscription created', { subscription });
  } catch (error) {
    console.error('Create subscription error:', error);
    return errorResponse(res, 500, 'Error creating subscription', error.message);
  }
};

exports.getActiveSubscription = async (req, res) => {
  try {
    const { userId } = req.params;
    const sub = await WalkSubscription.findOne({ wandererId: userId, status: { $in: ['ACTIVE', 'PAUSED'] } }).sort({ createdAt: -1 });
    if (!sub) return successResponse(res, 200, 'No active subscription', { subscription: null });
    return successResponse(res, 200, 'Active subscription retrieved', { subscription: sub });
  } catch (error) {
    console.error('Get active subscription error:', error);
    return errorResponse(res, 500, 'Error fetching subscription', error.message);
  }
};

exports.quickStartWalk = async (req, res) => {
  try {
    const wandererId = req.user._id;
    const { subscriptionId, latitude, longitude, address } = req.body;
    if (!subscriptionId) return errorResponse(res, 422, 'subscriptionId is required');
    if (!latitude || !longitude || !address) return errorResponse(res, 422, 'location fields are required');

    const sub = await WalkSubscription.findById(subscriptionId);
    if (!sub || sub.status !== 'ACTIVE') return errorResponse(res, 404, 'Active subscription not found');

    // Create WalkRequest from subscription preferences
    const walkRequest = new WalkRequest({
      wandererId,
      latitude,
      longitude,
      address,
      durationMinutes: sub.durationMinutes,
      mobilityLevel: sub.mobilityLevel,
      primaryPurpose: sub.primaryPurpose,
      purposeDetails: sub.purposeDetails,
      communicationNeeds: sub.communicationNeeds,
      status: 'PENDING',
      subscriptionId: sub._id,
      scheduledFor: sub.nextScheduledDate,
    });
    await walkRequest.save();

    // Update subscription stats
    sub.lastWalkDate = new Date();
    sub.totalWalksCompleted = (sub.totalWalksCompleted || 0) + 1;
    sub.nextScheduledDate = calculateNextWalkDate(sub, new Date());
    await sub.save();

    // Auto-match hook could go here

    return successResponse(res, 201, 'Quick-start walk created', { requestId: walkRequest._id, walkRequest });
  } catch (error) {
    console.error('Quick-start error:', error);
    return errorResponse(res, 500, 'Error creating quick-start walk', error.message);
  }
};

exports.updateSubscription = async (req, res) => {
  try {
    const wandererId = req.user._id;
    const { subscriptionId, updates } = req.body;
    if (!subscriptionId || !updates) return errorResponse(res, 422, 'subscriptionId and updates are required');
    const sub = await WalkSubscription.findOne({ _id: subscriptionId, wandererId });
    if (!sub) return errorResponse(res, 404, 'Subscription not found');

    Object.assign(sub, updates);
    // Recalculate nextScheduledDate if frequency/time changes
    const freqTouched = ['subscriptionType', 'customDays', 'preferredTimeSlot', 'timeRange'].some((k) => updates[k] !== undefined);
    if (freqTouched) {
      sub.nextScheduledDate = calculateNextWalkDate(sub, new Date());
    }
    await sub.save();
    return successResponse(res, 200, 'Subscription updated', { subscription: sub });
  } catch (error) {
    console.error('Update subscription error:', error);
    return errorResponse(res, 500, 'Error updating subscription', error.message);
  }
};

exports.pauseSubscription = async (req, res) => {
  try {
    const wandererId = req.user._id;
    const { subscriptionId } = req.body;
    const sub = await WalkSubscription.findOne({ _id: subscriptionId, wandererId });
    if (!sub) return errorResponse(res, 404, 'Subscription not found');
    sub.status = 'PAUSED';
    await sub.save();
    return successResponse(res, 200, 'Subscription paused', { subscription: sub });
  } catch (error) {
    console.error('Pause subscription error:', error);
    return errorResponse(res, 500, 'Error pausing subscription', error.message);
  }
};

exports.resumeSubscription = async (req, res) => {
  try {
    const wandererId = req.user._id;
    const { subscriptionId } = req.body;
    const sub = await WalkSubscription.findOne({ _id: subscriptionId, wandererId });
    if (!sub) return errorResponse(res, 404, 'Subscription not found');
    sub.status = 'ACTIVE';
    sub.nextScheduledDate = calculateNextWalkDate(sub, new Date());
    await sub.save();
    return successResponse(res, 200, 'Subscription resumed', { subscription: sub });
  } catch (error) {
    console.error('Resume subscription error:', error);
    return errorResponse(res, 500, 'Error resuming subscription', error.message);
  }
};

exports.cancelSubscription = async (req, res) => {
  try {
    const wandererId = req.user._id;
    const { subscriptionId } = req.body;
    const sub = await WalkSubscription.findOne({ _id: subscriptionId, wandererId });
    if (!sub) return errorResponse(res, 404, 'Subscription not found');
    sub.status = 'CANCELLED';
    await sub.save();
    return successResponse(res, 200, 'Subscription cancelled', { subscription: sub });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    return errorResponse(res, 500, 'Error cancelling subscription', error.message);
  }
};

module.exports.calculateNextWalkDate = calculateNextWalkDate;

