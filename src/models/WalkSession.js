const mongoose = require('mongoose');

const locationPointSchema = new mongoose.Schema({
  latitude: {
    type: Number,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    required: true
  },
  accuracy: Number,
  speed: Number,
  heading: Number
}, { _id: false });

const walkSessionSchema = new mongoose.Schema({
  walkRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WalkRequest',
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
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date
  },
  route: [locationPointSchema],
  lastWandererLocation: locationPointSchema,
  lastWalkerLocation: locationPointSchema,
  totalDistance: {
    type: Number, // in kilometers
    default: 0
  },
  durationMinutes: {
    type: Number,
    default: 0
  },
  wandererEndRequested: {
    type: Boolean,
    default: false
  },
  walkerEndRequested: {
    type: Boolean,
    default: false
  },
  wandererEndTimestamp: {
    type: Date
  },
  walkerEndTimestamp: {
    type: Date
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'PAYMENT_PENDING', 'COMPLETED', 'CANCELLED'],
    default: 'ACTIVE'
  },
  sosTriggered: {
    type: Boolean,
    default: false
  },
  sosTimestamp: {
    type: Date
  },
  sosLocation: {
    latitude: Number,
    longitude: Number
  },
  sosResolved: {
    type: Boolean,
    default: false
  },
  sosResolvedAt: {
    type: Date
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

module.exports = mongoose.model('WalkSession', walkSessionSchema);
