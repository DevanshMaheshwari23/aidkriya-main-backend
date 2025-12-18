const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
  walkSessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WalkSession',
    required: true
  },
  reviewerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reviewedUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  reviewText: {
    type: String,
    maxlength: 500
  },
  tags: [{
    type: String
  }],
  isReported: {
    type: Boolean,
    default: false
  },
  reportReason: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Ensure one rating per user per session
ratingSchema.index({ walkSessionId: 1, reviewerId: 1 }, { unique: true });

module.exports = mongoose.model('Rating', ratingSchema);
