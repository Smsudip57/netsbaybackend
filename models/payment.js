const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  transactionID:{
    type: String, // TRN3481423985
    required: true,
    unique: true, 
  },
  paymentType:{
    type: String,
    required: true,
    enum:["Stripe","Phonepe","Cryptomous"]
  },
  user:{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  coinAmout:{
    type: Number,
    required:true
  },
  Price:{
    type: Number,
    required:true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
})



const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);

module.exports = Payment;
