const e = require("express");
const { model, Schema, default: mongoose } = require("mongoose");

const notificationSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  status: {
    type: String,
    enum: ["success","error","info","warning"],
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  seen:{
    type: Boolean,
    default: false,
  },
  expireAt: { 
    type: Date,
    default: () => {
      const date = new Date();
      date.setDate(date.getDate() + 5);
      return date;
    },
  },
});

notificationSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.Notification || model("Notification", notificationSchema);