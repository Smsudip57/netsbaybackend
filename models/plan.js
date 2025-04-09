const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  productId: {
    type: String, // PRD34814
    required: true,
    unique: true
  },
  productName:{
    type: String,
  },
  Os:{
    type: String,
    required: true,
  },
  serviceType:{
    type: String,
    required: true,
    enum:["Internal RDP","External RDP","Internal Linux","External Linux"]
  },
  cpu:{
    type:Number,
    required:true
  },
  ram:{
    type:Number,
    required:true
  },
  storage:{
    type:Number,
    required:true
  },
  ipSet:{
    type: String,
    required: true
  },
  price:{
    type: Number,
    required:true
  },
  Stock:{
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  maxPendingService:{
    type: Number,
    default: 0
  }
 
})



const Plan = mongoose.models.Plan || mongoose.model('Plan', planSchema);

module.exports = Plan;
