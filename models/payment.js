const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  invoiceId: {
    type: String,
    validate: {
      validator: function (value) {
        if (this.paymentType === "Phonepe" || this.paymentType === "Bank_Transfer") {
          return value && value.length > 0;
        }
        return true;
      },
      message: "Invoice ID is required for PhonePe payments",
    },
  },
  invoicetype:{
    type: String,
    enum:["Inclusive","Exclusive","Getway"],
    default:"Getway"
  },
  transactionID: {
    type: String, // TRN3481423985
    required: true,
    unique: true,
  },
  paymentType: {
    type: String,
    required: true,
    enum: ["Stripe", "Phonepe", "Cryptomous", "Bank_Transfer"],
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  status: {
    type: String,
    enum: ["Pending", "Success"],
    default: "Success",
  },
  coinAmout: {
    type: Number,
    required: true,
  },
  Price: {
    type: Number,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    default: null,
    index: { expires: 0 },
  },
});

paymentSchema.pre('save', function(next) {
  if (this.status === 'Pending') {
    const oneHourFromNow = new Date();
    oneHourFromNow.setHours(oneHourFromNow.getHours() + 1);
    this.expiresAt = oneHourFromNow;
  } else {
    this.expiresAt = null;
  }
  next();
});

paymentSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  if (update && update.status === 'Success') {
    this.update({}, { $set: { expiresAt: null } });
  } 
  else if (update && update.status === 'Pending') {
    const oneHourFromNow = new Date();
    oneHourFromNow.setHours(oneHourFromNow.getHours() + 1);
    this.update({}, { $set: { expiresAt: oneHourFromNow } });
  }
  
  next();
});

const Payment =
  mongoose.models.Payment || mongoose.model("Payment", paymentSchema);

module.exports = Payment;
