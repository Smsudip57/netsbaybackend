const mongoose = require('mongoose');

const systemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        enum: ['osType', 'ipSets', 'providers'],
    },
    value: {
        type: String,
        required: true,
    },
}, {
    timestamps: true,
});

const System = mongoose.models.system || mongoose.model('System', systemSchema);

module.exports = System;