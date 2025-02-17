const mongoose = require('mongoose');


const serviceSchema = new mongoose.Schema({
    relatedUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    relatedProduct:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Plan'
    },
    //service details
    serviceId:{
        type: String, // SID3481434232
        required: true,
        unique: true
    },
    serviceNickname: {
        type: String,
    },
    //service type
    vmID:{
       type:Number, //internal
    },
    purchaseDate:{
        type: Date, //external
    },
    purchedFrom:{
        type: String,
    },
    EXTRLhash:{
        type: String,
    },
    //credentials
    username:{
        type: String,
    },
    password:{
        type: String,
    },
    ipAddress: {
        type: String,
    },
    //status
    status: { 
        type: String, 
        enum: ['unsold', 'pending', 'active', 'expired', 'terminated'],  
        default: 'unsold' 
    },
    terminationDate: { 
        type: Date, 
        default: null 
    },
    terminationReason: { 
        type: String, 
        enum: ['expired', 'unpaid', 'banned'],
        default: null 
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    expiryDate: { 
        type: Date,
    },
    
  });
  

  module.exports = mongoose.model('service', serviceSchema);