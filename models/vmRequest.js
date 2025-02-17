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
    requestType:{
        type: String,
        required: true,
        enum:["Rebuild","Start VM","Stop"]
    },
    status:{
        type: String,
        required: true,
        enum:["Pending","Approved","Rejected"],
        default:"Pending"
    },

})



const vmRequest = mongoose.models.vmRequest || mongoose.model('vmRequest', vmrequestSchema);

module.exports = vmRequest;
