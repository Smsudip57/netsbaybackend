const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
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
    minlength: 8
  },
  whatsapp: {
    type: String,
    match: [/^\+?\d{10,15}$/, 'Please enter a valid WhatsApp number.']
  },
  address: {
    street: {
      type: String,
      trim: true
    },
    city: {
      type: String,
      trim: true
    },
    state: {
      type: String,
      trim: true
    },
    country: {
      type: String,
      trim: true
    },
    pincode: {
      type: String,
      match: [/^\d{4,6}$/, 'Please enter a valid pincode.']
    }
  },
  varificationcode: {
    code: {
      type:Number,
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
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
  },
  isBanned: {
    type: Boolean,
    default: false
  },
  revokedService:{
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date,
    default: Date.now
  }
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User;
