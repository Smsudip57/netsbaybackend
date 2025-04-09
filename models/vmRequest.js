const mongoose = require('mongoose');

const vmrequestSchema = new mongoose.Schema({
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
    relatedUser:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required:true
    },
    requestType:{
        type: String,
        required: true,
        enum:["Rebuild","Service","Renew"],
    },
    status:{
        type: String,
        required: true,
        enum:["Pending","Approved","Rejected"],
        default:"Pending"
    },
    createdAt:{
        type: Date,
        default: Date.now,
    },
})



const vmRequest = mongoose.models.vmRequest || mongoose.model('vmRequest', vmrequestSchema);

module.exports = vmRequest;
