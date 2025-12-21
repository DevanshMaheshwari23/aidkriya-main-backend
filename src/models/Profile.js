const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  latitude: {
    type: Number
  },
  longitude: {
    type: Number
  },
  locationUpdatedAt: {
    type: Date
  },
  name: {
    type: String,
    required: true
  },
  bio: {
    type: String,
    maxlength: 500
  },
  age: {
    type: Number,
    min: 18,
    max: 100
  },
  profileImage: {
    type: String,
    default: 'https://via.placeholder.com/150'
  },
  hasCustomProfileImage: {
    type: Boolean,
    default: false
  },
  additionalImages: [{
    type: String
  }],
  preferences: {
    pace: {
      type: String,
      enum: ['Slow', 'Moderate', 'Fast', 'Very Fast'],
      default: 'Moderate'
    },
    conversationLevel: {
      type: String,
      enum: ['Silent', 'Light', 'Moderate', 'Chatty'],
      default: 'Light'
    },
    languages: [{
      type: String
    }]
  },
  verification: {
    isVerified: {
      type: Boolean,
      default: false
    },
    documentType: String,
    documentNumber: String,
    documentImage: String,
    verifiedAt: Date
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalWalks: {
    type: Number,
    default: 0
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  walletBalance: {
    type: Number,
    default: 0
  },
  isAvailable: {
    type: Boolean,
    default: true // For walkers
  },
  manualBusy: {
    type: Boolean,
    default: false
  },
  lastHeartbeatAt: {
    type: Date
  },
  availabilityCooldownUntil: {
    type: Date
  },
  emergencyContacts: [{
  name: String,
  phone: String
}]
,
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

module.exports = mongoose.model('Profile', profileSchema);
