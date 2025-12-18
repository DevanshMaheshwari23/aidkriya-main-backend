const mongoose = require('mongoose');

const walkRequestSchema = new mongoose.Schema({
  wandererId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  latitude: {
    type: Number,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  durationMinutes: {
    type: Number,
    required: true,
    min: 15,
    max: 240
  },
  mobilityLevel: {
    type: String,
    enum: ['INDEPENDENT', 'LIGHT_SUPPORT', 'WALKING_AID_USER', 'LIMITED_MOBILITY'],
    required: true
  },
  primaryPurpose: {
    type: String,
    enum: ['MEDICAL_RECOVERY', 'EXERCISE_FITNESS', 'ERRANDS_SHOPPING', 'FRESH_AIR_LEISURE', 'SOCIAL_COMPANION', 'SAFETY_MONITORING'],
    required: true
  },
  purposeDetails: {
    type: String,
    maxlength: 200
  },
  communicationNeeds: {
    languages: {
      type: [String],
      validate: {
        validator: function(v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: 'Languages must include at least one item'
      },
      required: true
    },
    hearingImpaired: {
      type: Boolean,
      default: false
    },
    speechDifficulty: {
      type: Boolean,
      default: false
    },
    prefersNonVerbal: {
      type: Boolean,
      default: false
    },
    requiresClearCommunication: {
      type: Boolean,
      default: false
    },
    additionalNotes: {
      type: String,
      maxlength: 150
    }
  },
  specialRequirements: {
    type: String,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['PENDING', 'MATCHED', 'IN_PROGRESS', 'PAYMENT_PENDING', 'COMPLETED', 'CANCELLED'],
    default: 'PENDING'
  },
  walkerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  scheduledFor: {
    type: Date
  },
  matchedAt: {
    type: Date
  },
  startedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  cancelledAt: {
    type: Date
  },
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WalkSubscription'
  },
  otp: {
  type: String
},
otpExpiresAt: {
  type: Date
},
  otpVerified: {
    type: Boolean,
    default: false
  }
,
  walkerCurrentLocation: {
    latitude: Number,
    longitude: Number,
    accuracy: Number,
    heading: Number,
    speed: Number,
    timestamp: Date
  },
  cancellationReason: {
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

// Index for geospatial queries
walkRequestSchema.index({ latitude: 1, longitude: 1 });
walkRequestSchema.index({ status: 1, createdAt: -1 });
walkRequestSchema.index({ mobilityLevel: 1 });
walkRequestSchema.index({ primaryPurpose: 1 });

module.exports = mongoose.model('WalkRequest', walkRequestSchema);
