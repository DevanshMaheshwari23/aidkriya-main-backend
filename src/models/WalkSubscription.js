const mongoose = require('mongoose');

const walkSubscriptionSchema = new mongoose.Schema({
  wandererId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  subscriptionType: {
    type: String,
    enum: ['DAILY', 'WEEKDAYS', 'WEEKENDS', 'CUSTOM'],
    required: true,
  },
  customDays: [{
    type: Number, // 0=Sun ... 6=Sat
    min: 0,
    max: 6,
  }],
  durationMinutes: {
    type: Number,
    enum: [15, 30, 45, 60],
    required: true,
  },
  preferredTimeSlot: {
    type: String,
    enum: ['MORNING', 'AFTERNOON', 'EVENING', 'FLEXIBLE'],
    required: true,
  },
  timeRange: {
    start: { type: String }, // HH:MM
    end: { type: String },   // HH:MM
  },
  mobilityLevel: {
    type: String,
    enum: ['INDEPENDENT', 'LIGHT_SUPPORT', 'WALKING_AID_USER', 'LIMITED_MOBILITY'],
    required: true,
  },
  primaryPurpose: {
    type: String,
    enum: ['MEDICAL_RECOVERY', 'EXERCISE_FITNESS', 'ERRANDS_SHOPPING', 'FRESH_AIR_LEISURE', 'SOCIAL_COMPANION', 'SAFETY_MONITORING'],
    required: true,
  },
  purposeDetails: {
    type: String,
    maxlength: 200,
  },
  communicationNeeds: {
    languages: {
      type: [String],
      validate: {
        validator: function(v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: 'Languages must include at least one item',
      },
      required: true,
    },
    hearingImpaired: { type: Boolean, default: false },
    speechDifficulty: { type: Boolean, default: false },
    prefersNonVerbal: { type: Boolean, default: false },
    requiresClearCommunication: { type: Boolean, default: false },
    additionalNotes: { type: String, maxlength: 150 },
  },
  walkerPreference: {
    type: String,
    enum: ['ANY', 'SAME_WALKER', 'RATED_4_PLUS'],
    default: 'ANY',
  },
  preferredWalkerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  autoMatch: {
    type: Boolean,
    default: true,
  },
  advanceNotice: {
    type: Number,
    default: 30, // minutes
    min: 0,
    max: 180,
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'PAUSED', 'CANCELLED'],
    default: 'ACTIVE',
    index: true,
  },
  totalWalksCompleted: {
    type: Number,
    default: 0,
  },
  lastWalkDate: { type: Date },
  nextScheduledDate: { type: Date, index: true },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },
}, {
  timestamps: true,
});

walkSubscriptionSchema.index({ wandererId: 1, status: 1 });
walkSubscriptionSchema.index({ nextScheduledDate: 1, status: 1 });

module.exports = mongoose.model('WalkSubscription', walkSubscriptionSchema);

