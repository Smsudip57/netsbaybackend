const mongoose = require('mongoose');

const supportRequest = new mongoose.Schema({
    relatedUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    productMongoID:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Plan',
        required:true
    },
    serviceMongoID:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
        required:true
    },
    requestType:{
        type: String,
        required: true,
        enum:['pending']
    },
})



const SupportRequest = mongoose.models.supportRequest || mongoose.model('SupportRequest', supportRequest);

module.exports = SupportRequest;
