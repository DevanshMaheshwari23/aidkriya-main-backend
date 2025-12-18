const Payment = require('../models/Payment');
const WalkSession = require('../models/WalkSession');
const WalkRequest = require('../models/WalkRequest');
const Profile = require('../models/Profile');
const razorpay = require('../config/razorpay');
const { successResponse, errorResponse } = require('../utils/responseHelper');
const { calculateFare, verifyRazorpaySignature } = require('../utils/paymentHelpers');
const { sendNotification, notificationTemplates } = require('../utils/notificationHelper');

// @desc    Create payment order
// @route   POST /api/payment/create-order
// @access  Private
exports.createPaymentOrder = async (req, res) => {
  try {
    const { walk_session_id } = req.body;

    // Ensure Razorpay credentials are configured
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return errorResponse(res, 500, 'Payment gateway not configured');
    }

    // Validate walk session
    if (!walk_session_id) {
      return errorResponse(res, 400, 'Walk session ID is required');
    }

    const walkSession = await WalkSession.findById(walk_session_id);

    if (!walkSession) {
      return errorResponse(res, 404, 'Walk session not found');
    }

    if (walkSession.status !== 'PAYMENT_PENDING') {
      return errorResponse(res, 400, 'Walk session not ready for payment');
    }

    if (walkSession.wandererId.toString() !== req.user._id.toString()) {
      return errorResponse(res, 403, 'Only wanderer can initiate payment');
    }

    // Check if payment already exists
    const existingPayment = await Payment.findOne({
      walkSessionId: walk_session_id,
      status: { $in: ['SUCCESS', 'PENDING'] }
    });

    if (existingPayment) {
      if (existingPayment.status === 'SUCCESS') {
        return errorResponse(res, 400, 'Payment already completed for this session');
      }
      console.log(
        `ℹ️ Returning existing pending payment order for session ${walk_session_id} (orderId=${existingPayment.razorpayOrderId})`
      );
      return successResponse(res, 200, 'Existing payment order reused', {
        order_id: existingPayment.razorpayOrderId,
        amount: existingPayment.totalAmount,
        currency: 'INR',
        payment_id: existingPayment._id,
        key_id: process.env.RAZORPAY_KEY_ID,
        total_amount: existingPayment.totalAmount,
        platform_commission: existingPayment.platformCommission,
        walker_earnings: existingPayment.walkerEarnings,
        existing: true
      });
    }

    // Calculate fare from session if available, else compute
    const fareDetails = walkSession.fareTotalAmount
      ? {
          totalAmount: walkSession.fareTotalAmount,
          platformCommission: walkSession.farePlatformCommission,
          walkerEarnings: walkSession.fareWalkerEarnings
        }
      : calculateFare(walkSession.durationMinutes || 0);

    // Create Razorpay order with safe receipt length (<= 40 chars)
    const baseReceipt = `WLK_${walk_session_id}`;
    const safeReceipt = baseReceipt.length > 40
      ? baseReceipt.substring(0, 40)
      : baseReceipt;

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(fareDetails.totalAmount * 100),
      currency: 'INR',
      receipt: safeReceipt,
      notes: {
        walk_session_id,
        wanderer_id: walkSession.wandererId.toString(),
        walker_id: walkSession.walkerId.toString()
      }
    });

    // Create payment record
    const payment = await Payment.create({
      walkSessionId: walk_session_id,
      wandererId: walkSession.wandererId,
      walkerId: walkSession.walkerId,
      totalAmount: fareDetails.totalAmount,
      platformCommission: fareDetails.platformCommission,
      walkerEarnings: fareDetails.walkerEarnings,
      paymentMethod: 'UPI', // Default, will be updated
      razorpayOrderId: razorpayOrder.id,
      status: 'PENDING'
    });

    successResponse(res, 201, 'Payment order created successfully', {
      order_id: razorpayOrder.id,
      amount: fareDetails.totalAmount,
      currency: 'INR',
      payment_id: payment._id,
      key_id: process.env.RAZORPAY_KEY_ID,
      total_amount: fareDetails.totalAmount,
      platform_commission: fareDetails.platformCommission,
      walker_earnings: fareDetails.walkerEarnings,
      existing: false
    });
  } catch (error) {
    console.error('Create payment order error:', error);
    const message = error?.message || 'Error creating payment order';
    errorResponse(res, 500, message);
  }
};

// @desc    Verify payment
// @route   POST /api/payment/verify
// @access  Private
exports.verifyPayment = async (req, res) => {
  try {
    const {
      walk_session_id,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      total_amount,
      platform_commission,
      walker_earnings
    } = req.body;

    // Verify signature
    const isValid = verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      return errorResponse(res, 400, 'Payment verification failed. Invalid signature.');
    }

    // Find and update payment
    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });

    if (!payment) {
      return errorResponse(res, 404, 'Payment record not found');
    }

    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    payment.status = 'SUCCESS';
    payment.completedAt = new Date();
    await payment.save();

    const session = await WalkSession.findById(payment.walkSessionId).exec();
    if (session) {
      session.status = 'COMPLETED';
      session.endTime = session.endTime || payment.completedAt;
      await session.save();
      console.log('[Payment] Session completed and saved:', payment.walkSessionId.toString());
    } else {
      console.log('[Payment] ⚠️ Session not found during completion');
    }
    const walkRequest = await WalkRequest.findById(session ? session.walkRequestId : null);
    if (walkRequest) {
      walkRequest.status = 'COMPLETED';
      walkRequest.completedAt = payment.completedAt;
      await walkRequest.save();
    }

    // Update walker's wallet and earnings
    const walkerProfile = await Profile.findOne({ userId: payment.walkerId });
    if (walkerProfile) {
      walkerProfile.walletBalance += payment.walkerEarnings;
      walkerProfile.totalEarnings += payment.walkerEarnings;
      walkerProfile.totalWalks = (walkerProfile.totalWalks || 0) + 1;
      await walkerProfile.save();
    }

    // Send notifications
    const notification = notificationTemplates.paymentSuccess(payment.totalAmount);
    await sendNotification(
      payment.wandererId,
      notification.title,
      notification.message,
      { paymentId: payment._id },
      { type: notification.type, relatedId: payment._id, relatedModel: 'Payment' }
    );
    await sendNotification(
      payment.walkerId,
      'Earnings Added',
      `₹${payment.walkerEarnings} has been added to your wallet!`,
      { paymentId: payment._id },
      { type: 'EARNING_ADDED', relatedId: payment._id, relatedModel: 'Payment' }
    );

    successResponse(res, 200, 'Payment verified successfully', {
      id: payment._id,
      walk_session_id: payment.walkSessionId,
      wanderer_id: payment.wandererId,
      walker_id: payment.walkerId,
      total_amount: payment.totalAmount,
      platform_commission: payment.platformCommission,
      walker_earnings: payment.walkerEarnings,
      payment_method: payment.paymentMethod,
      razorpay_payment_id: payment.razorpayPaymentId,
      razorpay_order_id: payment.razorpayOrderId,
      status: payment.status,
      completed_at: payment.completedAt
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    errorResponse(res, 500, 'Error verifying payment', error.message);
  }
};

// @desc    Get transaction history
// @route   GET /api/payment/transactions/:userId
// @access  Private
exports.getTransactionHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      Payment.find({
        $or: [{ wandererId: userId }, { walkerId: userId }],
        status: 'SUCCESS'
      })
        .sort({ completedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('walkSessionId'),
      Payment.countDocuments({
        $or: [{ wandererId: userId }, { walkerId: userId }],
        status: 'SUCCESS'
      })
    ]);

    // Transform to transaction format
    const formattedTransactions = transactions.map(payment => {
      const isWanderer = payment.wandererId.toString() === userId;
      
      return {
        id: payment._id,
        user_id: userId,
        type: isWanderer ? 'PAYMENT' : 'EARNING',
        amount: isWanderer ? payment.totalAmount : payment.walkerEarnings,
        description: isWanderer 
          ? `Payment for walk session`
          : `Earnings from walk session`,
        timestamp: payment.completedAt,
        reference_id: payment._id,
        status: payment.status
      };
    });

    successResponse(res, 200, 'Transaction history retrieved', {
      transactions: formattedTransactions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total
      }
    });
  } catch (error) {
    console.error('Get transaction history error:', error);
    errorResponse(res, 500, 'Error fetching transaction history', error.message);
  }
};

// @desc    Get payment details
// @route   GET /api/payment/:paymentId
// @access  Private
exports.getPaymentDetails = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findById(paymentId)
      .populate('wandererId', 'name')
      .populate('walkerId', 'name')
      .populate('walkSessionId');

    if (!payment) {
      return errorResponse(res, 404, 'Payment not found');
    }

    successResponse(res, 200, 'Payment details retrieved', { payment });
  } catch (error) {
    console.error('Get payment details error:', error);
    errorResponse(res, 500, 'Error fetching payment details', error.message);
  }
};

// @desc    Add money to wallet
// @route   POST /api/payment/add-to-wallet
// @access  Private
exports.addToWallet = async (req, res) => {
  try {
    const { user_id, amount } = req.body;

    if (!amount || amount <= 0) {
      return errorResponse(res, 400, 'Invalid amount');
    }

    const profile = await Profile.findOne({ userId: user_id });

    if (!profile) {
      return errorResponse(res, 404, 'Profile not found');
    }

    profile.walletBalance += parseFloat(amount);
    await profile.save();

    successResponse(res, 200, 'Money added to wallet successfully', {
      wallet_balance: profile.walletBalance
    });
  } catch (error) {
    console.error('Add to wallet error:', error);
    errorResponse(res, 500, 'Error adding money to wallet', error.message);
  }
};

// @desc    Get wallet balance
// @route   GET /api/payment/wallet/:userId
// @access  Private
exports.getWalletBalance = async (req, res) => {
  try {
    const { userId } = req.params;

    const profile = await Profile.findOne({ userId });

    if (!profile) {
      return errorResponse(res, 404, 'Profile not found');
    }

    successResponse(res, 200, 'Wallet balance retrieved', {
      balance: profile.walletBalance || 0
    });
  } catch (error) {
    console.error('Get wallet balance error:', error);
    errorResponse(res, 500, 'Error fetching wallet balance', error.message);
  }
};
