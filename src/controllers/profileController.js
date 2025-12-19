const Profile = require('../models/Profile');
const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/responseHelper');

// @desc    Get user profile
// @route   GET /api/profile/:userId
// @access  Public
exports.getProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    const profile = await Profile.findOne({ userId }).populate('userId', 'name email phone role');

    if (!profile) {
      return errorResponse(res, 404, 'Profile not found');
    }

    successResponse(res, 200, 'Profile retrieved successfully', { profile });
  } catch (error) {
    console.error('Get profile error:', error);
    errorResponse(res, 500, 'Error fetching profile', error.message);
  }
};

// @desc    Create/Update profile
// @route   PUT /api/profile/setup
// @access  Private
exports.setupProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      name,
      bio,
      age,
      profileImage,
      additionalImages,
      preferences,
      latitude,
      longitude
    } = req.body;

    // Find or create profile
    let profile = await Profile.findOne({ userId });

    if (profile) {
      // Update existing profile
      if (name) profile.name = name;
      if (bio) profile.bio = bio;
      if (age) profile.age = age;
      if (profileImage) profile.profileImage = profileImage;
      if (additionalImages) profile.additionalImages = additionalImages;
      if (preferences) {
        profile.preferences = {
          ...profile.preferences,
          ...preferences
        };
      }
      if (latitude !== undefined) profile.latitude = latitude;
      if (longitude !== undefined) profile.longitude = longitude;
      if (latitude !== undefined || longitude !== undefined) profile.locationUpdatedAt = new Date();

      await profile.save();
    } else {
      // Create new profile
      profile = await Profile.create({
        userId,
        name: name || req.user.name,
        bio,
        age,
        profileImage,
        additionalImages,
        preferences,
        latitude,
        longitude,
        locationUpdatedAt: latitude !== undefined || longitude !== undefined ? new Date() : undefined
      });
    }

    // Update user name if provided
    if (name && name !== req.user.name) {
      await User.findByIdAndUpdate(userId, { name });
    }

    successResponse(res, 200, 'Profile updated successfully', { profile });
  } catch (error) {
    console.error('Setup profile error:', error);
    errorResponse(res, 500, 'Error setting up profile', error.message);
  }
};

// @desc    Upload verification documents
// @route   POST /api/profile/verification
// @access  Private
exports.uploadVerification = async (req, res) => {
  try {
    const userId = req.user._id;
    const { documentType, documentNumber, documentImage } = req.body;

    if (!documentType || !documentNumber || !documentImage) {
      return errorResponse(res, 400, 'Please provide all verification details');
    }

    const profile = await Profile.findOne({ userId });

    if (!profile) {
      return errorResponse(res, 404, 'Profile not found');
    }

    profile.verification = {
      isVerified: false, // Admin will verify
      documentType,
      documentNumber,
      documentImage,
      verifiedAt: null
    };

    await profile.save();

    successResponse(res, 200, 'Verification documents uploaded. Pending admin approval.', {
      verification: profile.verification
    });
  } catch (error) {
    console.error('Upload verification error:', error);
    errorResponse(res, 500, 'Error uploading verification', error.message);
  }
};

// @desc    Update walker availability
// @route   PUT /api/profile/availability
// @access  Private (Walker only)
exports.updateAvailability = async (req, res) => {
  try {
    const userId = req.user._id;
    const { isAvailable, manualBusy } = req.body;

    if (typeof isAvailable !== 'boolean') {
      return errorResponse(res, 400, 'Please provide valid availability status');
    }

    const profile = await Profile.findOne({ userId });

    if (!profile) {
      return errorResponse(res, 404, 'Profile not found');
    }

    profile.isAvailable = isAvailable;
    if (typeof manualBusy === 'boolean') {
      profile.manualBusy = manualBusy;
    }
    await profile.save();

    successResponse(res, 200, 'Availability updated successfully', {
      isAvailable: profile.isAvailable,
      manualBusy: profile.manualBusy
    });
  } catch (error) {
    console.error('Update availability error:', error);
    errorResponse(res, 500, 'Error updating availability', error.message);
  }
};

// @desc    Heartbeat to maintain availability
// @route   POST /api/profile/heartbeat
// @access  Private (Walker only)
exports.heartbeat = async (req, res) => {
  try {
    const userId = req.user._id;
    const profile = await Profile.findOne({ userId });
    if (!profile) {
      return errorResponse(res, 404, 'Profile not found');
    }

    profile.lastHeartbeatAt = new Date();
    await profile.save();

    successResponse(res, 200, 'Heartbeat received', { lastHeartbeatAt: profile.lastHeartbeatAt });
  } catch (error) {
    console.error('Heartbeat error:', error);
    errorResponse(res, 500, 'Error updating heartbeat', error.message);
  }
};

// @desc    Get wallet balance
// @route   GET /api/profile/wallet
// @access  Private
exports.getWalletBalance = async (req, res) => {
  try {
    const userId = req.user._id;

    const profile = await Profile.findOne({ userId });

    if (!profile) {
      return errorResponse(res, 404, 'Profile not found');
    }

    successResponse(res, 200, 'Wallet balance retrieved', {
      balance: profile.walletBalance || 0
    });
  } catch (error) {
    console.error('Get wallet error:', error);
    errorResponse(res, 500, 'Error fetching wallet balance', error.message);
  }
};

// @desc    Update profile statistics (internal use)
// @route   PUT /api/profile/stats
// @access  Private
exports.updateStats = async (profile, updates) => {
  try {
    if (updates.totalWalks !== undefined) {
      profile.totalWalks += updates.totalWalks;
    }

    if (updates.totalEarnings !== undefined) {
      profile.totalEarnings += updates.totalEarnings;
    }

    if (updates.walletBalance !== undefined) {
      profile.walletBalance = updates.walletBalance;
    }

    await profile.save();
    return profile;
  } catch (error) {
    console.error('Update stats error:', error);
    throw error;
  }
};
