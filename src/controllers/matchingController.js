const WalkRequest = require('../models/WalkRequest');
const Profile = require('../models/Profile');
const { successResponse, errorResponse } = require('../utils/responseHelper');
const { sendNotification, notificationTemplates } = require('../utils/notificationHelper');
const { calculateDistance } = require('../utils/calculateDistance');

const safeImage = (url) => {
  const val = String(url || '');
  if (!val) return '';
  return /ui-avatars\.com/i.test(val) ? '' : val;
};

// @desc    Find available walkers for a walk request
// @route   POST /api/matching/find-walkers
// @access  Private (Wanderer only)
exports.findWalkers = async (req, res) => {
  try {
    const { walk_request_id } = req.body;

    const walkRequest = await WalkRequest.findById(walk_request_id);

    if (!walkRequest) {
      return errorResponse(res, 404, 'Walk request not found');
    }

    const cutoff = new Date(Date.now() - 60 * 1000);
    const busyWalkerIds = await WalkRequest.find({
      status: { $in: ['PENDING', 'MATCHED', 'IN_PROGRESS', 'PAYMENT_PENDING'] }
    }).distinct('walkerId');

    const walkerProfiles = await Profile.find({
      isAvailable: true,
      manualBusy: { $ne: true },
      lastHeartbeatAt: { $gte: cutoff },
      $or: [
        { availabilityCooldownUntil: { $exists: false } },
        { availabilityCooldownUntil: { $lte: new Date() } }
      ]
    })
      .where('userId')
      .nin(busyWalkerIds)
      .populate('userId', 'name phone email role');

    // Filter walkers by role
    const availableWalkers = walkerProfiles.filter(
      profile => profile.userId.role === 'WALKER'
    );

    if (availableWalkers.length === 0) {
      return errorResponse(res, 404, 'No walkers available at the moment');
    }

    const radiusKm = parseFloat(req.body.radius_km) || 5;
    const { latitude: reqLat, longitude: reqLng } = walkRequest;

    // Calculate distance and create match objects using walker last known location
    const matches = availableWalkers
      .filter((profile) => typeof profile.latitude === 'number' && typeof profile.longitude === 'number')
      .map((profile) => {
        const distance = calculateDistance(reqLat, reqLng, profile.latitude, profile.longitude);
        return {
          id: profile._id,
          walk_request_id,
          walker_id: profile.userId._id,
          walker_name: profile.userId.name,
          walker_image: safeImage(profile.profileImage),
          walker_rating: profile.rating,
          total_walks: profile.totalWalks,
          distance: parseFloat(distance.toFixed(2)),
          status: 'PENDING'
        };
      })
      .filter((m) => m.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);

    // Notify nearby walkers
    const notifyWalkers = matches.slice(0, 5); // Notify top 5 closest within radius
    for (const match of notifyWalkers) {
      const notification = notificationTemplates.walkRequestReceived(req.user.name);
      await sendNotification(
        match.walker_id,
        notification.title,
        notification.message,
        { walkRequestId: walk_request_id },
        {
          type: notification.type,
          relatedId: walk_request_id,
          relatedModel: 'WalkRequest'
        }
      );
    }

    successResponse(res, 200, 'Available walkers found', matches);
  } catch (error) {
    console.error('Find walkers error:', error);
    errorResponse(res, 500, 'Error finding walkers', error.message);
  }
};

// @desc    Accept walk request (Walker)
// @route   POST /api/matching/accept
// @access  Private (Walker only)
exports.acceptWalkRequest = async (req, res) => {
  try {
    const { match_id } = req.body;
    const walkerId = req.user._id;

    // In production, match_id would be the walk_request_id
    const walkRequest = await WalkRequest.findById(match_id);

    if (!walkRequest) {
      return errorResponse(res, 404, 'Walk request not found');
    }

    if (walkRequest.status !== 'PENDING') {
      return errorResponse(res, 400, 'Walk request is no longer available');
    }

    // Ensure this walker is the one requested
    if (walkRequest.walkerId && walkRequest.walkerId.toString() !== walkerId.toString()) {
      return errorResponse(res, 403, 'This request is not assigned to you');
    }

    // Update walk request
    walkRequest.walkerId = walkerId;
    walkRequest.status = 'MATCHED';
    // Generate OTP for session start
const otp = Math.floor(1000 + Math.random() * 9000).toString();
walkRequest.otp = otp;
walkRequest.otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
walkRequest.otpVerified = false;
    walkRequest.matchedAt = new Date();
    await walkRequest.save();

    // Notify wanderer
    const notification = notificationTemplates.walkRequestAccepted(req.user.name);
    await sendNotification(
      walkRequest.wandererId,
      notification.title,
      notification.message,
      { walkRequestId: walkRequest._id, walkerId },
      { type: notification.type, relatedId: walkRequest._id, relatedModel: 'WalkRequest' }
    );

    // Return match object
    const match = {
      id: walkRequest._id,
      walk_request_id: walkRequest._id,
      walker_id: walkerId,
      wanderer_id: walkRequest.wandererId,
      status:  walkRequest.status, 
      matched_at: walkRequest.matchedAt
    };

    successResponse(res, 200, 'Walk request accepted successfully', match);
  } catch (error) {
    console.error('Accept walk request error:', error);
    errorResponse(res, 500, 'Error accepting walk request', error.message);
  }
};

// @desc    Reject walk request (Walker)
// @route   POST /api/matching/reject
// @access  Private (Walker only)
exports.rejectWalkRequest = async (req, res) => {
  try {
    const { match_id } = req.body;
    const walkerId = req.user._id;

    const walkRequest = await WalkRequest.findById(match_id);
    if (!walkRequest) {
      return errorResponse(res, 404, 'Walk request not found');
    }

    if (walkRequest.status !== 'PENDING') {
      return errorResponse(res, 400, 'Walk request is no longer pending');
    }

    if (walkRequest.walkerId?.toString() !== walkerId.toString()) {
      return errorResponse(res, 403, 'This request is not assigned to you');
    }

    walkRequest.walkerId = null;
    await walkRequest.save();

    const declineNotification = notificationTemplates.walkRequestDeclined(req.user.name);
    await sendNotification(
      walkRequest.wandererId,
      declineNotification.title,
      declineNotification.message,
      { walkRequestId: walkRequest._id },
      { type: declineNotification.type, relatedId: walkRequest._id, relatedModel: 'WalkRequest' }
    );

    const cutoff = new Date(Date.now() - 60 * 1000);
    const busyWalkerIds = await WalkRequest.find({
      status: { $in: ['PENDING', 'MATCHED', 'IN_PROGRESS', 'PAYMENT_PENDING'] }
    }).distinct('walkerId');

    const nearbyProfiles = await Profile.find({
      isAvailable: true,
      manualBusy: { $ne: true },
      lastHeartbeatAt: { $gte: cutoff },
      $or: [
        { availabilityCooldownUntil: { $exists: false } },
        { availabilityCooldownUntil: { $lte: new Date() } }
      ]
    })
      .where('userId')
      .nin(busyWalkerIds)
      .populate('userId', 'name phone email role');

    const availableWalkers = nearbyProfiles.filter(
      profile => profile.userId.role === 'WALKER'
    );

    const { latitude: reqLat, longitude: reqLng } = walkRequest;
    const matches = availableWalkers
      .filter((profile) => typeof profile.latitude === 'number' && typeof profile.longitude === 'number')
      .map((profile) => ({
        profile,
        distance: calculateDistance(reqLat, reqLng, profile.latitude, profile.longitude)
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);

    for (const m of matches) {
      const template = notificationTemplates.walkRequestReceived(req.user.name);
      await sendNotification(
        m.profile.userId._id,
        template.title,
        template.message,
        { walkRequestId: walkRequest._id },
        { type: template.type, relatedId: walkRequest._id, relatedModel: 'WalkRequest' }
      );
    }

    successResponse(res, 200, 'Walk request rejected and re-broadcasted');
  } catch (error) {
    console.error('Reject walk request error:', error);
    errorResponse(res, 500, 'Error rejecting walk request', error.message);
  }
};

// @desc    Get pending walk requests for walker
// @route   GET /api/matching/pending-requests/:walkerId
// @access  Private (Walker only)
exports.getPendingRequests = async (req, res) => {
  try {
    const { walkerId } = req.params;
    // Only show requests explicitly targeted to this walker
    const pendingRequests = await WalkRequest.find({
      status: 'PENDING',
      walkerId: walkerId,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    })
      .populate('wandererId', 'name phone')
      .limit(10)
      .sort({ createdAt: -1 });

    // Transform to match format
    const matches = await Promise.all(pendingRequests.map(async (request) => {
      const wandererProfile = await Profile.findOne({ userId: request.wandererId });
      const walkerProfile = await Profile.findOne({ userId: walkerId });

      return {
        id: request._id,
        walk_request_id: request._id,
        walker_id: walkerId,
        walker_name: wandererProfile?.name || request.wandererId.name,
        walker_image: safeImage(wandererProfile?.profileImage || ''),
        walker_rating: wandererProfile?.rating || 0,
        total_walks: wandererProfile?.totalWalks || 0,
        distance: calculateDistance(
          request.latitude,
          request.longitude,
          walkerProfile?.latitude ?? request.latitude,
          walkerProfile?.longitude ?? request.longitude
        ),
        status: 'PENDING'
      };
    }));

    successResponse(res, 200, 'Pending requests retrieved', matches);
  } catch (error) {
    console.error('Get pending requests error:', error);
    errorResponse(res, 500, 'Error fetching pending requests', error.message);
  }
};

// @desc    Assign a specific walker to a walk request (Wanderer action)
// @route   POST /api/matching/request
// @access  Private (Wanderer only)
exports.requestWalker = async (req, res) => {
  try {
    const { walk_request_id, walker_id } = req.body;
    const walkRequest = await WalkRequest.findById(walk_request_id);
    if (!walkRequest) {
      return errorResponse(res, 404, 'Walk request not found');
    }

    if (walkRequest.status !== 'PENDING') {
      return errorResponse(res, 400, 'Walk request is not available');
    }

    // Assign walker and keep status as PENDING until walker accepts
    walkRequest.walkerId = walker_id;
    await walkRequest.save();

    const notification = notificationTemplates.walkRequestReceived(req.user.name);
    await sendNotification(
      walker_id,
      notification.title,
      notification.message,
      { walkRequestId: walk_request_id },
      { type: notification.type, relatedId: walk_request_id, relatedModel: 'WalkRequest' }
    );

    successResponse(res, 200, 'Walker requested successfully');
  } catch (error) {
    console.error('Request walker error:', error);
    errorResponse(res, 500, 'Error requesting walker', error.message);
  }
};
