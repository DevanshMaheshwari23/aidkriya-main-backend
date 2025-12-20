const mongoose = require('mongoose');

const bankAccountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  holderName: { type: String, required: true },
  bankName: { type: String, required: true },
  accountNumberLast4: { type: String, required: true },
  ifsc: { type: String, required: true },
  verified: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('BankAccount', bankAccountSchema);
