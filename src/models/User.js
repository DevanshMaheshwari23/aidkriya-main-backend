const mongoose = require('mongoose');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    trim: true,
    match: [/^[0-9]{10}$/, 'Please provide a valid 10-digit phone number']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't return password by default
  },
  role: {
    type: String,
    enum: ['WALKER', 'WANDERER'],
    required: [true, 'Role is required']
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  otp: {
    type: String,
    select: false
  },
  otpExpiry: {
    type: Date,
    select: false
  },
  resetPasswordToken: String,
  resetPasswordExpiry: Date,
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

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }

  const isHex64 = typeof this.password === 'string' && /^[a-f0-9]{64}$/i.test(this.password);
  if (!isHex64) {
    this.password = crypto.createHash('sha256').update(this.password).digest('hex');
  }
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  const hash = crypto.createHash('sha256').update(candidatePassword).digest('hex');
  return hash === this.password;
};

userSchema.methods.comparePasswordHash = function(passwordHash) {
  return passwordHash === this.password;
};

module.exports = mongoose.model('User', userSchema);
