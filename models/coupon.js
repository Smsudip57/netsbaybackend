const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    masterType: {
        type: String,
        required: [true, 'Master type is required'],
        enum: ['product', 'coin']
    },
    // Fields for 'product' coupons
    label: {
        type: String,
        enum: ['affiliate', 'festive'],
        required: function () { 
            return this.masterType === 'product'; 
        },
        message: 'Label is required for product coupons'
    },
    user: {
        type: [String],
        required: function () { 
            return this.masterType === 'product'; 
        },
        validate: {
            validator: function (users) {
                return this.masterType !== 'product' || users.every(email => /^\S+@\S+\.\S+$/.test(email));
            },
            message: 'Please enter a valid email address for users'
        }
    },
    userProhibited: {
        type: [String],
        validate: {
            validator: function (users) {
                return this.masterType === 'product' && users.every(email => /^\S+@\S+\.\S+$/.test(email));
            },
            message: 'Please enter a valid email address for prohibited users'
        }
    },
    addUsersToProhibited: {
        type: Boolean,
        default: false,
        required: function () { 
            return this.masterType === 'product'; 
        },
        message: 'Add users to prohibited is required for product coupons'
    },
    used:{
        type: Number,
        default: 0
    },
    maxUses: {
        type: Number
    },
    productId: {
        type: [String],
        required: function () { 
            return this.masterType === 'product'; 
        },
        message: 'Product ID is required for product coupons'
    },
    discountAmmount: {
        type: Number,
        required: function () { 
            return this.masterType === 'product'; 
        },
        message: 'Discount amount is required for product coupons'
    },
    discountParcent: {
        type: Number,
        required: function () { 
            return this.masterType === 'product'; 
        },
        message: 'Discount percentage is required for product coupons'
    },
    endDate: {
        type: Date,
        required: function () { 
            return this.masterType === 'product'; 
        },
        message: 'End date is required for product coupons'
    },
    // Fields for 'coin' coupons
    coinAmmount: {
        type: Number,
        required: function () { 
            return this.masterType === 'coin'; 
        },
        message: 'Coin amount is required for coin coupons'
    },
    token: {
        type: String,
        required: [true, 'Token is required'],
        unique: true
    },
    isActive: {
        type: Boolean,
        default: true
    }   
});

// Ensure that either discountAmount or discountPercent is present for 'product'
couponSchema.pre('validate', function (next) {
    if (this.masterType === 'product' && !this.discountAmmount && !this.discountParcent) {
        return next(new Error('Either discountAmmount or discountParcent is required for product coupons'));
    }
    next();
});

const Coupon = mongoose.models.Coupon || mongoose.model('Coupon', couponSchema);

module.exports = Coupon;
