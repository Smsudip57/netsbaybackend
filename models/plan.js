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
  dataCenterLocation: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "System",
    validate: {
      validator: async function(value) {
        if (!value) return true;
        const System = mongoose.model('System');
        const system = await System.findById(value);
        return system && system.name === "datacenter";
      },
      message: "dataCenterLocation must reference a valid datacenter System document"
    }
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
