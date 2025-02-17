const mongoose = require('mongoose');
const service = require('./service');

const transactionSchema = new mongoose.Schema({
    transactionID:{
        type: String, // TRN3481423985
        required: true,
        unique: true
    },
  user:{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  productMongoID:{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    required:true
  },
  productId:{
    type: String,
    required:true
  },
  serviceMongoID:{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required:true
  },
  serviceId:{
    type: String,
    required:true
  },
  amout:{
    type: Number,
    required:true
  },
  count:{
    type: Number,
    required:true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
 
})



const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
