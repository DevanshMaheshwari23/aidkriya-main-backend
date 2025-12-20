const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, required: true },
  privacy: {
    hidePersonalInfo: { type: Boolean, default: false },
    showEmail: { type: Boolean, default: true },
    showPhone: { type: Boolean, default: true },
    locationSharing: {
      enabled: { type: Boolean, default: true },
      accuracy: { type: String, enum: ['High', 'Balanced', 'Low'], default: 'Balanced' }
    }
  },
  notifications: {
    push: { enabled: { type: Boolean, default: true } },
    inApp: { sound: { type: Boolean, default: true }, vibration: { type: Boolean, default: true } },
    email: {
      weeklySummary: { type: Boolean, default: false },
      securityAlerts: { type: Boolean, default: true },
      newsletters: { type: Boolean, default: false }
    },
    dnd: { enabled: { type: Boolean, default: false }, startMinutes: { type: Number }, endMinutes: { type: Number } }
  }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
