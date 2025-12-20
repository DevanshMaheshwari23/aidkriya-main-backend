const Payment = require('../models/Payment');
const WalkSession = require('../models/WalkSession');
const WalkRequest = require('../models/WalkRequest');
const Profile = require('../models/Profile');
const Payout = require('../models/Payout');
const razorpay = require('../config/razorpay');
const https = require('https');
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
      walkerProfile.isAvailable = true;
      walkerProfile.availabilityCooldownUntil = new Date(Date.now() + 30 * 1000);
      await walkerProfile.save();
    }

    // Update wanderer's total walks count
    const wandererProfile = await Profile.findOne({ userId: payment.wandererId });
    if (wandererProfile) {
      wandererProfile.totalWalks = (wandererProfile.totalWalks || 0) + 1;
      await wandererProfile.save();
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

    const [payments, payouts, totalPayments, totalPayouts] = await Promise.all([
      Payment.find({
        $or: [{ wandererId: userId }, { walkerId: userId }],
        status: 'SUCCESS'
      })
        .sort({ completedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('walkSessionId'),
      Payout.find({
        userId,
        status: 'SUCCESS'
      })
        .sort({ completedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Payment.countDocuments({
        $or: [{ wandererId: userId }, { walkerId: userId }],
        status: 'SUCCESS'
      }),
      Payout.countDocuments({
        userId,
        status: 'SUCCESS'
      }),
    ]);

    // Transform to transaction format
    const paymentTxns = payments.map(payment => {
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
    const payoutTxns = payouts.map(p => ({
      id: p._id,
      user_id: userId,
      type: 'WALLET_DEBIT',
      amount: p.amount,
      description: p.method === 'UPI' ? `Withdrawal to UPI ${p.upiId}` : `Withdrawal to bank ${p.accountNumber}`,
      timestamp: p.completedAt || p.createdAt,
      reference_id: p.externalReferenceId || p._id,
      status: p.status
    }));
    const formattedTransactions = [...paymentTxns, ...payoutTxns].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    successResponse(res, 200, 'Transaction history retrieved', {
      transactions: formattedTransactions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil((totalPayments + totalPayouts) / limit),
        totalItems: totalPayments + totalPayouts
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

// @desc    Withdraw money from wallet to bank/UPI
// @route   POST /api/payment/withdraw
// @access  Private
exports.withdrawFromWallet = async (req, res) => {
  try {
    const { user_id, amount, method, beneficiary_name, account_number, ifsc, upi_id } = req.body;

    if (!amount || amount <= 0) {
      return errorResponse(res, 400, 'Invalid amount');
    }
    // Enforce minimum withdraw threshold from env (default ₹100)
    const minWithdraw = parseFloat(process.env.MIN_WITHDRAW_AMOUNT || '100');
    if (parseFloat(amount) < minWithdraw) {
      return errorResponse(
        res,
        400,
        `Minimum withdraw amount is ₹${minWithdraw.toFixed(0)}`
      );
    }
    if (!method || !['BANK', 'UPI'].includes(method)) {
      return errorResponse(res, 400, 'Invalid method');
    }
    if (method === 'UPI' && (!upi_id || upi_id.length < 6)) {
      return errorResponse(res, 400, 'Invalid UPI ID');
    }
    if (method === 'BANK' && (!account_number || !ifsc)) {
      return errorResponse(res, 400, 'Bank details required');
    }

    const profile = await Profile.findOne({ userId: user_id });
    if (!profile) {
      return errorResponse(res, 404, 'Profile not found');
    }
    if ((profile.walletBalance || 0) < parseFloat(amount)) {
      return errorResponse(res, 400, 'Insufficient wallet balance');
    }

    // Create payout record (start as PENDING; escalate to SUCCESS when processed)
    const payout = await Payout.create({
      userId: user_id,
      amount: parseFloat(amount),
      method,
      beneficiaryName: beneficiary_name,
      accountNumber: account_number,
      ifsc,
      upiId: upi_id,
      status: 'PENDING',
      createdAt: new Date()
    });

    // Attempt real-time payout via RazorpayX if enabled and configured
    const payoutsEnabled =
      (process.env.RAZORPAY_PAYOUTS_ENABLED || '').toLowerCase() === 'true';
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const rpxAccountNumber = process.env.RAZORPAYX_ACCOUNT_NUMBER; // Needed for RazorpayX payouts

    try {
      if (payoutsEnabled && keyId && keySecret && rpxAccountNumber) {
        // Prepare payout payload
        const payoutPayload = {
          account_number: rpxAccountNumber,
          amount: Math.round(parseFloat(amount) * 100), // in paise
          currency: 'INR',
          mode: method === 'UPI' ? 'UPI' : 'IMPS',
          purpose: 'payout',
          queue_if_low_balance: true,
          // Create fund account inline (RazorpayX supports inline fund_account)
          fund_account: method === 'UPI'
            ? {
                account_type: 'vpa',
                vpa: { address: upi_id },
                contact: {
                  name: beneficiary_name || profile.name || 'Walker',
                  email: profile.email || undefined,
                  contact: profile.phone || undefined,
                  type: 'employee',
                },
              }
            : {
                account_type: 'bank_account',
                bank_account: {
                  name: beneficiary_name || profile.name || 'Walker',
                  ifsc: ifsc,
                  account_number: account_number
                },
                contact: {
                  name: beneficiary_name || profile.name || 'Walker',
                  email: profile.email || undefined,
                  contact: profile.phone || undefined,
                  type: 'employee',
                },
              },
          // Notes for reconciliation
          notes: {
            user_id,
            payout_id: payout._id.toString(),
            method,
          }
        };

        // Perform HTTP request to RazorpayX Payouts API via basic auth
        const authHeader =
          'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');

        let result;
        let statusOk = false;
        if (typeof fetch === 'function') {
          const response = await fetch('https://api.razorpay.com/v1/payouts', {
            method: 'POST',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payoutPayload)
          });
          result = await response.json();
          statusOk = response.ok;
        } else {
          result = await new Promise((resolve, reject) => {
            const data = JSON.stringify(payoutPayload);
            const req = https.request(
              'https://api.razorpay.com/v1/payouts',
              {
                method: 'POST',
                headers: {
                  'Authorization': authHeader,
                  'Content-Type': 'application/json',
                  'Content-Length': Buffer.byteLength(data)
                }
              },
              (res) => {
                let body = '';
                res.on('data', (chunk) => (body += chunk));
                res.on('end', () => {
                  try {
                    statusOk = res.statusCode >= 200 && res.statusCode < 300;
                    resolve(JSON.parse(body));
                  } catch (err) {
                    reject(err);
                  }
                });
              }
            );
            req.on('error', reject);
            req.write(data);
            req.end();
          });
        }

        if (statusOk && result && result.id) {
          payout.externalReferenceId = result.id;
          payout.status = (result.status || '').toUpperCase() === 'PROCESSED'
            ? 'SUCCESS'
            : 'PENDING';
          payout.completedAt = payout.status === 'SUCCESS' ? new Date() : undefined;
          await payout.save();
        } else {
          // If payout API failed, keep as PENDING and include error
          console.error('RazorpayX payout failure:', result);
        }
      } else {
        // Payouts not enabled/configured: mark as SUCCESS to simulate instant transfer
        payout.status = 'SUCCESS';
        payout.externalReferenceId = `SIMULATED_${Date.now()}`;
        payout.completedAt = new Date();
        await payout.save();
      }
    } catch (payoutErr) {
      console.error('Payout processing error:', payoutErr);
      // Leave payout as PENDING; can be retried by ops/admin later
    }

    // Deduct from wallet and persist
    profile.walletBalance -= parseFloat(amount);
    await profile.save();

    successResponse(res, 200, 'Withdrawal successful', {
      wallet_balance: profile.walletBalance,
      payout_id: payout._id
    });
  } catch (error) {
    console.error('Withdraw from wallet error:', error);
    errorResponse(res, 500, 'Error processing withdrawal', error.message);
  }
};
