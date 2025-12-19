const WalkRequest = require('../models/WalkRequest');
const WalkSession = require('../models/WalkSession');
const Profile = require('../models/Profile');
const { successResponse, errorResponse } = require('../utils/responseHelper');
const { calculateDistance } = require('../utils/calculateDistance');
const { calculateFare } = require('../utils/paymentHelpers');
const { sendNotification, notificationTemplates } = require('../utils/notificationHelper');

const sanitizeLocationPoint = (location = {}) => {
  if (
    location.latitude === undefined ||
    location.longitude === undefined ||
    location.timestamp === undefined
  ) {
    return null;
  }

  return {
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
    timestamp: new Date(location.timestamp),
    accuracy: location.accuracy,
    speed: location.speed,
    heading: location.heading
  };
};

const assertSessionParticipant = (session, userId) => {
  if (
    session.wandererId.toString() !== userId.toString() &&
    session.walkerId.toString() !== userId.toString()
  ) {
    throw new Error('NOT_AUTHORIZED');
  }
};
// Get OTP for walk session (Wanderer only)
exports.getWalkOtp = async (req, res) => {
  try {
    const { walkRequestId } = req.params;
    const WalkRequest = require('../models/WalkRequest');
    
    const walkRequest = await WalkRequest.findById(walkRequestId);
    
    if (!walkRequest) {
      return res.status(404).json({ success: false, message: 'Walk request not found' });
    }
    
    // Verify requester is the wanderer
    if (walkRequest.wandererId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    
    if (!walkRequest.otp || !walkRequest.otpExpiresAt || walkRequest.otpExpiresAt < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP unavailable or expired' });
    }
    
    return res.status(200).json({ 
      success: true, 
      message: 'OTP retrieved',
      data: { otp: walkRequest.otp }
    });
  } catch (error) {
    console.error('Get OTP error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching OTP', error: error.message });
  }
};

// Verify OTP before starting session (Walker only)
exports.verifyWalkOtp = async (req, res) => {
  try {
    const { walk_request_id, otp } = req.body;
    const WalkRequest = require('../models/WalkRequest');
    
    const walkRequest = await WalkRequest.findById(walk_request_id);
    
    if (!walkRequest) {
      return res.status(404).json({ success: false, message: 'Walk request not found' });
    }
    
    if (walkRequest.status !== 'MATCHED') {
      return res.status(400).json({ success: false, message: 'Request not ready for OTP verification' });
    }
    
    if (!walkRequest.otp || !walkRequest.otpExpiresAt || walkRequest.otpExpiresAt < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP expired' });
    }
    
    if (walkRequest.otp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
    
    // Mark as verified and transition to IN_PROGRESS
    walkRequest.status = 'IN_PROGRESS';
    walkRequest.otpVerified = true;
    walkRequest.otp = undefined; // Clear OTP after verification
    walkRequest.otpExpiresAt = undefined;
    await walkRequest.save();
    
    return res.status(200).json({ 
      success: true, 
      message: 'OTP verified successfully',
      data: { verified: true }
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return res.status(500).json({ success: false, message: 'Error verifying OTP', error: error.message });
  }
};


// @desc    Start a walk session
// @route   POST /api/tracking/start
exports.startWalkSession = async (req, res) => {
  try {
    const { walk_request_id, wanderer_id, walker_id, initial_location } = req.body;

    const walkRequest = await WalkRequest.findById(walk_request_id);

    if (!walkRequest) {
      return errorResponse(res, 404, 'Walk request not found');
    }

    if (
      walkRequest.wandererId.toString() !== wanderer_id ||
      walkRequest.walkerId?.toString() !== walker_id
    ) {
      return errorResponse(res, 400, 'Walker or wanderer mismatch');
    }

    if (!['MATCHED', 'IN_PROGRESS'].includes(walkRequest.status)) {
      return errorResponse(res, 400, 'Walk request is not ready to start');
    }

    const existingSession = await WalkSession.findOne({
      walkRequestId: walkRequest._id,
      status: 'ACTIVE'
    });

    if (existingSession) {
      return successResponse(res, 200, 'Walk session already active', {
        session: existingSession
      });
    }

    const sanitizedPoint = sanitizeLocationPoint(initial_location);
    const sessionPayload = {
      walkRequestId: walkRequest._id,
      wandererId: walkRequest.wandererId,
      walkerId: walkRequest.walkerId,
      startTime: new Date(),
      route: sanitizedPoint ? [sanitizedPoint] : []
    };

    const walkSession = await WalkSession.create(sessionPayload);

    walkRequest.status = 'IN_PROGRESS';
    walkRequest.startedAt = walkSession.startTime;
    await walkRequest.save();

    const notification = notificationTemplates.walkStarted();
    await sendNotification(
      walkRequest.wandererId,
      notification.title,
      notification.message,
      { walkRequestId: walkRequest._id, sessionId: walkSession._id },
      { type: 'WALK_STARTED', relatedId: walkRequest._id, relatedModel: 'WalkRequest' }
    );
    await sendNotification(
      walkRequest.walkerId,
      notification.title,
      notification.message,
      { walkRequestId: walkRequest._id, sessionId: walkSession._id },
      { type: 'WALK_STARTED', relatedId: walkRequest._id, relatedModel: 'WalkRequest' }
    );

    successResponse(res, 201, 'Walk session started', {
      session: walkSession
    });
  } catch (error) {
    if (error.message === 'NOT_AUTHORIZED') {
      return errorResponse(res, 403, 'Not authorized to access this session');
    }
    console.error('Start walk session error:', error);
    errorResponse(res, 500, 'Error starting walk session', error.message);
  }
};

// @desc    Update location during walk session
// @route   POST /api/tracking/update-location
exports.updateLocation = async (req, res) => {
  try {
    const { session_id, location } = req.body;

    const walkSession = await WalkSession.findById(session_id);

    if (!walkSession) {
      return errorResponse(res, 404, 'Walk session not found');
    }

    assertSessionParticipant(walkSession, req.user._id);

    if (walkSession.status !== 'ACTIVE') {
      return errorResponse(res, 400, 'Walk session is not active');
    }

    const sanitizedPoint = sanitizeLocationPoint(location);

    if (!sanitizedPoint) {
      return errorResponse(res, 400, 'Invalid location payload');
    }

    if (!Array.isArray(walkSession.route)) {
      walkSession.route = [];
    }

    const lastPoint = walkSession.route[walkSession.route.length - 1];
    if (lastPoint && sanitizedPoint.timestamp.getTime() <= new Date(lastPoint.timestamp).getTime()) {
      return errorResponse(res, 400, 'Stale location timestamp');
    }
    let incrementalDistance = 0;

    if (lastPoint) {
      incrementalDistance = calculateDistance(
        lastPoint.latitude,
        lastPoint.longitude,
        sanitizedPoint.latitude,
        sanitizedPoint.longitude
      );
    }

    walkSession.route.push(sanitizedPoint);
    walkSession.totalDistance = parseFloat(
      (walkSession.totalDistance + incrementalDistance).toFixed(3)
    );

    const nowMs = Date.now();
    const durationMinutes = (nowMs - walkSession.startTime.getTime()) / (1000 * 60);
    walkSession.durationMinutes = Math.max(walkSession.durationMinutes, Math.round(durationMinutes));

    // Save last location per participant
    if (walkSession.walkerId.toString() === req.user._id.toString()) {
      walkSession.lastWalkerLocation = sanitizedPoint;
    } else if (walkSession.wandererId.toString() === req.user._id.toString()) {
      walkSession.lastWandererLocation = sanitizedPoint;
    }

    await walkSession.save();

    successResponse(res, 200, 'Location updated', {
      total_distance_km: walkSession.totalDistance,
      duration_minutes: walkSession.durationMinutes
    });
  } catch (error) {
    if (error.message === 'NOT_AUTHORIZED') {
      return errorResponse(res, 403, 'Not authorized to update this session');
    }
    console.error('Update location error:', error);
    errorResponse(res, 500, 'Error updating location', error.message);
  }
};

// @desc    End walk session
// @route   POST /api/tracking/end
exports.endWalkSession = async (req, res) => {
  try {
    const { session_id, end_location } = req.body;

    const walkSession = await WalkSession.findById(session_id);

    if (!walkSession) {
      return errorResponse(res, 404, 'Walk session not found');
    }

    assertSessionParticipant(walkSession, req.user._id);

    if (walkSession.status === 'PAYMENT_PENDING') {
      return successResponse(res, 200, 'Awaiting payment', { session: walkSession });
    }

    if (walkSession.status !== 'ACTIVE') {
      return errorResponse(res, 400, 'Walk session already closed');
    }

    const requesterIsWanderer = walkSession.wandererId.toString() === req.user._id.toString();
    const endPoint = sanitizeLocationPoint(end_location);

    if (requesterIsWanderer) {
      walkSession.wandererEndRequested = true;
      walkSession.wandererEndTimestamp = new Date();
    } else {
      walkSession.walkerEndRequested = true;
      walkSession.walkerEndTimestamp = new Date();
    }

    const partnerId = requesterIsWanderer ? walkSession.walkerId : walkSession.wandererId;

    const bothConfirmed = walkSession.wandererEndRequested && walkSession.walkerEndRequested;

    if (!bothConfirmed) {
      await walkSession.save();
      const notification = notificationTemplates.partnerEndRequested();
      await sendNotification(
        partnerId,
        notification.title,
        notification.message,
        { walkRequestId: walkSession.walkRequestId, sessionId: walkSession._id },
        { type: 'WALK_END_REQUESTED', relatedId: walkSession.walkRequestId, relatedModel: 'WalkRequest' }
      );
      return successResponse(res, 200, 'End request recorded', { session: walkSession });
    }

    if (!Array.isArray(walkSession.route)) {
      walkSession.route = [];
    }

    if (endPoint) {
      const lastPoint = walkSession.route[walkSession.route.length - 1];
      let incrementalDistance = 0;
      if (lastPoint) {
        incrementalDistance = calculateDistance(
          lastPoint.latitude,
          lastPoint.longitude,
          endPoint.latitude,
          endPoint.longitude
        );
      }
      walkSession.route.push(endPoint);
      walkSession.totalDistance = parseFloat(
        (walkSession.totalDistance + incrementalDistance).toFixed(3)
      );
    }

    walkSession.endTime = new Date();
    walkSession.durationMinutes = Math.max(
      walkSession.durationMinutes,
      Math.round((walkSession.endTime - walkSession.startTime) / (1000 * 60))
    );

    walkSession.status = 'PAYMENT_PENDING';
    await walkSession.save();

    const walkRequest = await WalkRequest.findById(walkSession.walkRequestId);
    if (walkRequest) {
      walkRequest.status = 'PAYMENT_PENDING';
      await walkRequest.save();
    }

    const walkerProfile = await Profile.findOne({ userId: walkSession.walkerId });
    if (walkerProfile) {
      walkerProfile.isAvailable = false;
      await walkerProfile.save();
    }

    const paymentNotification = notificationTemplates.paymentPending();
    await sendNotification(
      walkSession.wandererId,
      paymentNotification.title,
      paymentNotification.message,
      { walkRequestId: walkSession.walkRequestId, sessionId: walkSession._id },
      { type: 'PAYMENT_PENDING', relatedId: walkSession.walkRequestId, relatedModel: 'WalkRequest' }
    );
    await sendNotification(
      walkSession.walkerId,
      paymentNotification.title,
      paymentNotification.message,
      { walkRequestId: walkSession.walkRequestId, sessionId: walkSession._id },
      { type: 'PAYMENT_PENDING', relatedId: walkSession.walkRequestId, relatedModel: 'WalkRequest' }
    );

    successResponse(res, 200, 'Walk finalized. Proceed to payment.', { session: walkSession });
  } catch (error) {
    if (error.message === 'NOT_AUTHORIZED') {
      return errorResponse(res, 403, 'Not authorized to close this session');
    }
    console.error('End walk session error:', error);
    errorResponse(res, 500, 'Error ending walk session', error.message);
  }
};

// @desc    Get walk session details
// @route   GET /api/tracking/session/:sessionId
exports.getWalkSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const walkSession = await WalkSession.findById(sessionId)
      .populate('walkRequestId')
      .populate('wandererId', 'name phone')
      .populate('walkerId', 'name phone');

    if (!walkSession) {
      return errorResponse(res, 404, 'Walk session not found');
    }

    assertSessionParticipant(walkSession, req.user._id);

    successResponse(res, 200, 'Walk session retrieved', { session: walkSession });
  } catch (error) {
    if (error.message === 'NOT_AUTHORIZED') {
      return errorResponse(res, 403, 'Not authorized to access this session');
    }
    console.error('Get walk session error:', error);
    errorResponse(res, 500, 'Error fetching walk session', error.message);
  }
};

// @desc    Get partner's latest location
// @route   GET /api/tracking/partner-location/:sessionId
exports.getPartnerLocation = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const walkSession = await WalkSession.findById(sessionId);

    if (!walkSession) {
      return errorResponse(res, 404, 'Walk session not found');
    }

    assertSessionParticipant(walkSession, req.user._id);

    const partnerId =
      walkSession.wandererId.toString() === req.user._id.toString()
        ? walkSession.walkerId
        : walkSession.wandererId;

    let latestLocation = null;
    const requesterIsWanderer = walkSession.wandererId.toString() === req.user._id.toString();
    if (requesterIsWanderer) {
      latestLocation = walkSession.lastWalkerLocation || null;
    } else {
      latestLocation = walkSession.lastWandererLocation || null;
    }

    successResponse(res, 200, 'Partner location retrieved', {
      partner_id: partnerId,
      location: latestLocation
    });
  } catch (error) {
    if (error.message === 'NOT_AUTHORIZED') {
      return errorResponse(res, 403, 'Not authorized to access this session');
    }
    console.error('Get partner location error:', error);
    errorResponse(res, 500, 'Error fetching partner location', error.message);
  }
};

exports.getSessionByWalkRequestId = async (req, res) => {
  try {
    const { walkRequestId } = req.params;

    const walkRequest = await WalkRequest.findById(walkRequestId);
    if (!walkRequest) {
      return errorResponse(res, 404, 'Walk request not found');
    }

    // Explicit authorization: requester must be the wanderer or the assigned walker of this request
    const isAuthorized =
      walkRequest.wandererId?.toString() === req.user._id.toString() ||
      (walkRequest.walkerId && walkRequest.walkerId.toString() === req.user._id.toString());

    if (!isAuthorized) {
      return errorResponse(res, 403, 'Not authorized to access this session');
    }

    const session = await WalkSession.findOne({
      walkRequestId: walkRequest._id,
      status: { $in: ['ACTIVE', 'PAYMENT_PENDING', 'COMPLETED'] }
    })
      .populate('walkRequestId')
      .populate('wandererId', 'name phone')
      .populate('walkerId', 'name phone')
      .sort({ startTime: -1 });

    if (!session) {
      return errorResponse(res, 404, 'No session exists for this request');
    }

    successResponse(res, 200, 'Walk session retrieved', { session });
  } catch (error) {
    if (error.message === 'NOT_AUTHORIZED') {
      return errorResponse(res, 403, 'Not authorized to access this session');
    }
    console.error('Get session by request error:', error);
    errorResponse(res, 500, 'Error fetching session by request', error.message);
  }
};

exports.getPaymentSummary = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await WalkSession.findById(sessionId);
    if (!session) {
      return errorResponse(res, 404, 'Walk session not found');
    }
    assertSessionParticipant(session, req.user._id);
    if (!['PAYMENT_PENDING', 'COMPLETED'].includes(session.status)) {
      return errorResponse(res, 400, 'Payment summary not available');
    }
    const fare = calculateFare(session.durationMinutes || 0);
    return successResponse(res, 200, 'Payment summary', {
      session_id: session._id,
      distance_km: session.totalDistance,
      duration_minutes: session.durationMinutes,
      fare: {
        total_amount: fare.totalAmount,
        platform_commission: fare.platformCommission,
        walker_earnings: fare.walkerEarnings
      }
    });
  } catch (error) {
    if (error.message === 'NOT_AUTHORIZED') {
      return errorResponse(res, 403, 'Not authorized to access this session');
    }
    console.error('Get payment summary error:', error);
    errorResponse(res, 500, 'Error fetching payment summary', error.message);
  }
};

// @desc    Trigger SOS alert
// @route   POST /api/tracking/sos-alert
exports.sendSOSAlert = async (req, res) => {
  try {
    const { session_id, location, reason } = req.body;

    const walkSession = await WalkSession.findById(session_id);

    if (!walkSession) {
      return errorResponse(res, 404, 'Walk session not found');
    }

    assertSessionParticipant(walkSession, req.user._id);

    walkSession.sosTriggered = true;
    walkSession.sosTimestamp = new Date();
    walkSession.sosLocation = {
      latitude: location?.latitude,
      longitude: location?.longitude
    };
    await walkSession.save();

    const partnerId =
      walkSession.wandererId.toString() === req.user._id.toString()
        ? walkSession.walkerId
        : walkSession.wandererId;

    const notification = notificationTemplates.sosAlert(req.user.name || 'User', location?.address || 'Unknown');
    await sendNotification(
      partnerId,
      notification.title,
      notification.message,
      { sessionId: walkSession._id, reason },
      { type: 'SOS_ALERT', relatedId: walkSession.walkRequestId, relatedModel: 'WalkRequest', priority: 'URGENT' }
    );

    successResponse(res, 200, 'SOS alert sent successfully');
  } catch (error) {
    if (error.message === 'NOT_AUTHORIZED') {
      return errorResponse(res, 403, 'Not authorized to trigger SOS for this session');
    }
    console.error('Send SOS alert error:', error);
    errorResponse(res, 500, 'Error sending SOS alert', error.message);
  }
};

// Update walker arrival location before session starts
exports.updateWalkerArrivalLocation = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { latitude, longitude, accuracy, heading, speed } = req.body;
    const walkerId = req.user._id;

    const walkRequest = await WalkRequest.findById(requestId);
    if (!walkRequest) {
      return res.status(404).json({ success: false, message: 'Walk request not found' });
    }

    if (!walkRequest.walkerId || walkRequest.walkerId.toString() !== walkerId.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    walkRequest.walkerCurrentLocation = {
      latitude: Number(latitude),
      longitude: Number(longitude),
      accuracy,
      heading,
      speed,
      timestamp: new Date()
    };

    await walkRequest.save();

    console.log(`[Location] Walker ${walkerId} updated for request ${requestId}`);
    return res.status(200).json({ success: true, message: 'Location updated' });
  } catch (error) {
    console.error('[Location] Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get partner location by walk request (pre-session)
exports.getPartnerLocationByRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user._id;

    const walkRequest = await WalkRequest.findById(requestId);
    if (!walkRequest) {
      return res.status(404).json({ success: false, message: 'Walk request not found' });
    }

    const isWanderer = walkRequest.wandererId?.toString() === userId.toString();
    const isWalker = walkRequest.walkerId?.toString() === userId.toString();

    if (!isWanderer && !isWalker) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (isWanderer) {
      return res.status(200).json({
        success: true,
        data: {
          partnerId: walkRequest.walkerId,
          location: walkRequest.walkerCurrentLocation || null
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        partnerId: walkRequest.wandererId,
        location: {
          latitude: walkRequest.latitude,
          longitude: walkRequest.longitude,
          timestamp: walkRequest.createdAt
        }
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
