const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED'], default: 'PENDING' },
}, { timestamps: true });

module.exports = mongoose.model('Withdrawal', withdrawalSchema);
