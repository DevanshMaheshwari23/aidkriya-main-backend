const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
  {
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'WalkSession', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userRole: { type: String, enum: ['WALKER', 'WANDERER', 'UNKNOWN'], default: 'UNKNOWN', required: true },
    partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, default: null },
    rating: { type: Number, required: true, min: 1, max: 5 },
    message: { type: String, maxlength: 500 },
  },
  { timestamps: true }
);

// One feedback per user per session
feedbackSchema.index({ sessionId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Feedback', feedbackSchema);
