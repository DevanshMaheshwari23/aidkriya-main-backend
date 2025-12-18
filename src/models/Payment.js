const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  walkSessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WalkSession',
    required: true
  },
  wandererId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  walkerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  totalAmount: {
    type: Number,
    required: true
  },
  platformCommission: {
    type: Number,
    required: true
  },
  walkerEarnings: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['UPI', 'CARD', 'NETBANKING', 'WALLET'],
    required: true
  },
  razorpayOrderId: {
    type: String
  },
  razorpayPaymentId: {
    type: String
  },
  razorpaySignature: {
    type: String
  },
  status: {
    type: String,
    enum: ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'],
    default: 'PENDING'
  },
  failureReason: {
    type: String
  },
  refundAmount: {
    type: Number
  },
  refundedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Payment', paymentSchema);
