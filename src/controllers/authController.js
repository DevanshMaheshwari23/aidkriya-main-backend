const User = require('../models/User');
const Profile = require('../models/Profile');
const generateToken = require('../utils/generateToken');
const { generateOTP, sendOTP, verifyOTP } = require('../utils/sendOTP');
const { successResponse, errorResponse } = require('../utils/responseHelper');
const { addMinutes } = require('../utils/dateHelpers');

// @desc    Register new user
// @route   POST /api/auth/signup
// @access  Public
exports.signup = async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !password || !role) {
      return errorResponse(res, 400, 'Please provide all required fields');
    }

    // Validate role
    if (!['WALKER', 'WANDERER'].includes(role)) {
      return errorResponse(res, 400, 'Invalid role. Must be WALKER or WANDERER');
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { phone }]
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return errorResponse(res, 400, 'Email already registered');
      }
      if (existingUser.phone === phone) {
        return errorResponse(res, 400, 'Phone number already registered');
      }
    }

    // Create user
    const user = await User.create({
      name,
      email,
      phone,
      password,
      role
    });

    // Create profile
    await Profile.create({
      userId: user._id,
      name: user.name
    });

    // Generate OTP for phone verification
    const otp = generateOTP();
    const otpExpiry = addMinutes(new Date(), 10); // 10 minutes expiry

    // Save OTP to user
    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    // Send OTP
    await sendOTP(phone, otp);

    // Generate JWT token
    const token = generateToken(user._id);

    // Prepare user data (exclude password)
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isVerified: user.isVerified
    };

    successResponse(res, 201, 'User registered successfully. OTP sent to phone.', {
      user: userData,
      token
    });
  } catch (error) {
    console.error('Signup error:', error);
    errorResponse(res, 500, 'Error registering user', error.message);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return errorResponse(res, 400, 'Please provide email and password');
    }

    // Find user and include password
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return errorResponse(res, 401, 'Invalid email or password');
    }

    // Check if user is active
    if (!user.isActive) {
      return errorResponse(res, 401, 'Account is deactivated. Please contact support.');
    }

    // Compare password
    const isPasswordMatch = await user.comparePassword(password);

    if (!isPasswordMatch) {
      return errorResponse(res, 401, 'Invalid email or password');
    }

    // Generate token
    const token = generateToken(user._id);

    // Get user profile
    const profile = await Profile.findOne({ userId: user._id });

    // Prepare user data
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isVerified: user.isVerified,
      profile: profile ? {
        rating: profile.rating,
        totalWalks: profile.totalWalks,
        isAvailable: profile.isAvailable
      } : null
    };

    successResponse(res, 200, 'Login successful', {
      user: userData,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    errorResponse(res, 500, 'Error logging in', error.message);
  }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Private
exports.verifyOTPController = async (req, res) => {
  try {
    const { otp } = req.body;
    const userId = req.user._id;

    if (!otp) {
      return errorResponse(res, 400, 'Please provide OTP');
    }

    // Get user with OTP
    const user = await User.findById(userId).select('+otp +otpExpiry');

    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }

    // Verify OTP
    const verification = verifyOTP(user.otp, otp, user.otpExpiry);

    if (!verification.valid) {
      return errorResponse(res, 400, verification.message);
    }

    // Mark user as verified
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    successResponse(res, 200, 'Phone number verified successfully', {
      isVerified: true
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    errorResponse(res, 500, 'Error verifying OTP', error.message);
  }
};

// @desc    Resend OTP
// @route   POST /api/auth/resend-otp
// @access  Private
exports.resendOTP = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId);

    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }

    if (user.isVerified) {
      return errorResponse(res, 400, 'Phone number already verified');
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpExpiry = addMinutes(new Date(), 10);

    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    // Send OTP
    await sendOTP(user.phone, otp);

    successResponse(res, 200, 'OTP resent successfully');
  } catch (error) {
    console.error('Resend OTP error:', error);
    errorResponse(res, 500, 'Error resending OTP', error.message);
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res) => {
  try {
    // In JWT-based auth, logout is handled client-side by removing token
    // Server-side, we can log the action or invalidate refresh tokens if implemented
    
    successResponse(res, 200, 'Logout successful');
  } catch (error) {
    console.error('Logout error:', error);
    errorResponse(res, 500, 'Error logging out', error.message);
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    const profile = await Profile.findOne({ userId: req.user._id });

    successResponse(res, 200, 'User data retrieved successfully', {
      user: {
        ...user.toObject(),
        profile
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    errorResponse(res, 500, 'Error fetching user data', error.message);
  }
};

// @desc    Change password
// @route   POST /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res) => {
  try {
    const { current_password_hash, new_password_hash } = req.body;

    if (!current_password_hash || !new_password_hash) {
      return errorResponse(res, 400, 'Please provide current_password_hash and new_password_hash');
    }

    if (
      typeof current_password_hash !== 'string' ||
      typeof new_password_hash !== 'string' ||
      current_password_hash.length !== 64 ||
      new_password_hash.length !== 64
    ) {
      return errorResponse(res, 422, 'Password hashes must be 64-character hex strings');
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }

    const isMatch = user.comparePasswordHash(current_password_hash);
    if (!isMatch) {
      return errorResponse(res, 401, 'Current password is incorrect');
    }

    user.password = new_password_hash;
    await user.save();

    successResponse(res, 200, 'Password changed successfully');
  } catch (error) {
    console.error('Change password error:', error);
    errorResponse(res, 500, 'Error changing password', error.message);
  }
};

// @desc    Get email verification status
// @route   GET /api/auth/email/verification-status
// @access  Private
exports.getEmailVerificationStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('isVerified email');
    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }
    successResponse(res, 200, 'Email verification status', {
      verified: !!user.isVerified,
      email: user.email
    });
  } catch (error) {
    console.error('Get email verification status error:', error);
    errorResponse(res, 500, 'Error fetching verification status', error.message);
  }
};

// @desc    Toggle two-factor authentication
// @route   POST /api/auth/twofactor
// @access  Private
exports.toggleTwoFactor = async (req, res) => {
  try {
    const { enable } = req.body;
    if (typeof enable !== 'boolean') {
      return errorResponse(res, 422, 'enable must be a boolean');
    }
    const user = await User.findById(req.user._id);
    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }
    user.twoFactorEnabled = enable;
    await user.save();
    successResponse(res, 200, 'Two-factor authentication updated', {
      twoFactorEnabled: user.twoFactorEnabled
    });
  } catch (error) {
    console.error('Toggle two-factor error:', error);
    errorResponse(res, 500, 'Error updating two-factor authentication', error.message);
  }
};
