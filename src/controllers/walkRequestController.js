const WalkRequest = require('../models/WalkRequest');
const Profile = require('../models/Profile');
const { successResponse, errorResponse } = require('../utils/responseHelper');
const { sendNotification } = require('../utils/notificationHelper');

// @desc    Create walk request
// @route   POST /api/walk-request/create
// @access  Private (Wanderer only)
exports.createWalkRequest = async (req, res) => {
  try {
    const wandererId = req.user._id;
    const {
      latitude,
      longitude,
      address,
      durationMinutes,
      pace,
      conversationLevel,
      languages,
      specialRequirements
    } = req.body;

    // Validate required fields
    if (!latitude || !longitude || !address || !durationMinutes || !pace || !conversationLevel) {
      return errorResponse(res, 400, 'Please provide all required fields');
    }

    // Check if user already has an active request
    const existingRequest = await WalkRequest.findOne({
      wandererId,
      status: { $in: ['PENDING', 'MATCHED', 'IN_PROGRESS'] }
    });

    if (existingRequest) {
      return errorResponse(res, 400, 'You already have an active walk request');
    }

    // Create walk request
    const walkRequest = await WalkRequest.create({
      wandererId,
      latitude,
      longitude,
      address,
      durationMinutes,
      pace,
      conversationLevel,
      languages,
      specialRequirements,
      status: 'PENDING'
    });

    successResponse(res, 201, 'Walk request created successfully', { walkRequest });
  } catch (error) {
    console.error('Create walk request error:', error);
    errorResponse(res, 500, 'Error creating walk request', error.message);
  }
};

// @desc    Get walk request by ID
// @route   GET /api/walk-request/:requestId
// @access  Private
exports.getWalkRequest = async (req, res) => {
  try {
    const { requestId } = req.params;

    const walkRequest = await WalkRequest.findById(requestId)
      .populate('wandererId', 'name phone')
      .populate('walkerId', 'name phone');

    if (!walkRequest) {
      return errorResponse(res, 404, 'Walk request not found');
    }

    successResponse(res, 200, 'Walk request retrieved', { walkRequest });
  } catch (error) {
    console.error('Get walk request error:', error);
    errorResponse(res, 500, 'Error fetching walk request', error.message);
  }
};

// @desc    Cancel walk request
// @route   PUT /api/walk-request/:requestId/cancel
// @access  Private
exports.cancelWalkRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { cancellationReason } = req.body;

    const walkRequest = await WalkRequest.findById(requestId);

    if (!walkRequest) {
      return errorResponse(res, 404, 'Walk request not found');
    }

    // Check if user is authorized
    if (walkRequest.wandererId.toString() !== req.user._id.toString() &&
        walkRequest.walkerId?.toString() !== req.user._id.toString()) {
      return errorResponse(res, 403, 'Not authorized to cancel this request');
    }

    // Can only cancel if not completed
    if (walkRequest.status === 'COMPLETED') {
      return errorResponse(res, 400, 'Cannot cancel completed walk');
    }

    walkRequest.status = 'CANCELLED';
    walkRequest.cancelledAt = new Date();
    walkRequest.cancellationReason = cancellationReason;
    await walkRequest.save();

    // Notify the other party
    const notifyUserId = walkRequest.wandererId.toString() === req.user._id.toString()
      ? walkRequest.walkerId
      : walkRequest.wandererId;

    if (notifyUserId) {
      await sendNotification(
        notifyUserId,
        'Walk Cancelled',
        `The walk has been cancelled. ${cancellationReason || ''}`,
        { walkRequestId: walkRequest._id },
        { type: 'WALK_CANCELLED', relatedId: walkRequest._id, relatedModel: 'WalkRequest' }
      );
    }

    successResponse(res, 200, 'Walk request cancelled', { walkRequest });
  } catch (error) {
    console.error('Cancel walk request error:', error);
    errorResponse(res, 500, 'Error cancelling walk request', error.message);
  }
};

// @desc    Get walk history for user
// @route   GET /api/walk-request/history/:userId
// @access  Private
exports.getWalkHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (page - 1) * limit;

    const query = {
      $or: [
        { wandererId: userId },
        { walkerId: userId }
      ],
      status: { $in: ['COMPLETED', 'CANCELLED'] }
    };

    const [history, total] = await Promise.all([
      WalkRequest.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('wandererId', 'name')
        .populate('walkerId', 'name'),
      WalkRequest.countDocuments(query)
    ]);

    successResponse(res, 200, 'Walk history retrieved', {
      history,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total
      }
    });
  } catch (error) {
    console.error('Get walk history error:', error);
    errorResponse(res, 500, 'Error fetching walk history', error.message);
  }
};

// @desc    Get active walk request for user
// @route   GET /api/walk-request/active/:userId
// @access  Private
exports.getActiveWalkRequest = async (req, res) => {
  try {
    const { userId } = req.params;

    const activeRequest = await WalkRequest.findOne({
      $or: [
        { wandererId: userId },
        { walkerId: userId }
      ],
      status: { $in: ['PENDING', 'MATCHED', 'IN_PROGRESS', 'PAYMENT_PENDING'] }
    })
      .populate('wandererId', 'name phone')
      .populate('walkerId', 'name phone');

    if (!activeRequest) {
      return errorResponse(res, 404, 'No active walk request found');
    }

    successResponse(res, 200, 'Active walk request found', { walkRequest: activeRequest });
  } catch (error) {
    console.error('Get active walk error:', error);
    errorResponse(res, 500, 'Error fetching active walk request', error.message);
  }
};
