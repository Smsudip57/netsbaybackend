const mongoose = require('mongoose');



const systemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        enum: ['osType', 'ipSets', 'providers', "datacenter"],
    },
    value: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
        validate: {
            validator: function (v) {
                if (this.name === 'datacenter') {
                    return (
                        v.location && typeof v.location === 'string' &&
                        v.datastore && typeof v.datastore === 'string' &&
                        typeof v.status === 'boolean'
                    );
                }
                return typeof v === 'string';
            },
            message: props =>
                props.value.name === 'datacenter'
                    ? 'For datacenter, value must follow valueSchema structure'
                    : 'Value must be a string for non-datacenter types'
        }
    },
}, {
    timestamps: true,
});


systemSchema.pre('save', function(next) {
    if (this.name === 'datacenter' && typeof this.value === 'string') {
        return next(new Error('Datacenter value must be an object following valueSchema'));
    }
    if (this.name !== 'datacenter' && typeof this.value !== 'string') {
        return next(new Error('Non-datacenter value must be a string'));
    }
    next();
});


const System = mongoose.models.system || mongoose.model('System', systemSchema);

module.exports = System;