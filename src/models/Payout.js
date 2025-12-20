const mongoose = require('mongoose');

const payoutSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true, min: 1 },
  method: { type: String, enum: ['BANK', 'UPI'], required: true },
  beneficiaryName: { type: String },
  accountNumber: { type: String },
  ifsc: { type: String },
  upiId: { type: String },
  status: { type: String, enum: ['PENDING', 'SUCCESS', 'FAILED'], default: 'PENDING' },
  externalReferenceId: { type: String },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
});

module.exports = mongoose.model('Payout', payoutSchema);
