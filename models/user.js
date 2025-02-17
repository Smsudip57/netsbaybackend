const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address.']
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  whatsapp: {
    type: String,
    required: true,
    match: [/^\+?\d{10,15}$/, 'Please enter a valid WhatsApp number.']
  },
  address: {
    street: {
      type: String,
      required: true,
      trim: true
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    state: {
      type: String,
      required: true,
      trim: true
    },
    country: {
      type: String,
      required: true,
      trim: true
    },
    pincode: {
      type: String,
      required: true,
      match: [/^\d{4,6}$/, 'Please enter a valid pincode.']
    }
  },
  organizationName: {
    type: String,
    trim: true
  },
  gstNumber: {
    type: String,
    trim: true,
    match: [/^\d{15}$/, 'Please enter a valid GST number.']
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  balance: {
    type: Number,
    default: 0
  },
  profile: {
    name: {
      type: String,
      trim: true
    },
    avatarUrl: {
      type: String,
      default: 'https://default-avatar-url.com'
    }
  },
  isActive: {
    type: Boolean,
    default: false
  }
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User;
