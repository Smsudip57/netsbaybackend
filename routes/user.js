const express = require("express");
const User = require("../models/user");
const Plan = require("../models/plan");
const Announcement = require("../models/announcements");
const Service = require("../models/service");
const Coupon = require("../models/coupon");
const Transaction = require("../models/transaction");
const Payment = require("../models/payment");
const crypto = require("crypto");
const router = express.Router();

router.get("/all_plans", async (req, res) => {
  try {
    const plans = await Plan.find();
    return res.status(200).json(plans);
  } catch (error) {
    console.error("Error fetching plans:", error);
    return res.status(500).json({ message: "Failed to fetch plans" });
  }
});

router.get("/get_product", async (req, res) => {
  try {
    const { productId } = req.query;
    if (!productId) {
      return res.status(400).json({ message: "Product ID is required" });
    }
    const plan = await Plan.findOne({ productId: productId });
    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }
    return res.status(200).json(plan);
  } catch (error) {
    console.error("Error getting plan:", error);
    return res.status(500).json({ message: "Failed to get plan" });
  }
});

router.get("/announcements", async (req, res) => {
  try {
    const announcements = await Announcement.find().sort({ createdAt: -1 });
    return res.status(200).json(announcements);
  } catch (error) {
    console.error("Error fetching announcements:", error);
    return res.status(500).json({ message: "Failed to fetch announcements" });
  }
});

router.get("/apply_coupon", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ message: "Coupon token is required" });
    }
    const coupon = await Coupon.findOne({ token: token });
    if (
      !coupon ||
      coupon.masterType !== "product" ||
      !coupon.isActive ||
      coupon.endDate < new Date()
    ) {
      return res.status(404).json({ message: "Coupon not found" });
    }
    if (coupon.maxUses > 0 && coupon.used >= coupon.maxUses) {
      return res.status(400).json({ message: "Coupon has expired" });
    }
    if (coupon.user.length > 0) {
      if (!coupon.user.includes(req.user._id)) {
        return res.status(400).json({ message: "Coupon not found" });
      }
    }
    if (coupon.userProhibited.length > 0) {
      if (coupon.userProhibited.includes(req.user._id)) {
        return res.status(400).json({ message: "Coupon not found" });
      }
    }
    return res.status(200).json(coupon);
  } catch (error) {
    console.error("Error fetching announcements:", error);
    return res.status(500).json({ message: "Failed to fetch announcements" });
  }
});

router.get("/services", async (req, res) => {
  try {
    const { _id } = req.user;
    const services = await Service.find({ relatedUser: _id }).populate(
      "relatedProduct"
    );
    return res.status(200).json(services);
  } catch (error) {
    console.error("Error fetching services:", error);
    return res.status(500).json({ message: "Failed to fetch services" });
  }
});

router.get("/service", async (req, res) => {
  try {
    const { serviceId } = req.query;
    if (!serviceId) {
      return res.status(400).json({ message: "Service ID is required" });
    }
    const service = await Service.findOne({ serviceId: serviceId }).populate(
      "relatedProduct"
    );
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }
    return res.status(200).json(service);
  } catch (error) {
    console.error("Error fetching service:", error);
    return res.status(500).json({ message: "Failed to fetch service" });
  }
});

router.get("/purchase_service", async (req, res) => {
  try {
    const { productId, quantity, token } = req.query;
    const user = req.user;
    if (!productId) {
      return res.status(400).json({ message: "Product ID is required" });
    }
    const plan = await Plan.findOne({ productId: productId });
    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }
    const relatedServices = await Service.find({
      relatedProduct: plan._id,
      status: "unsold",
    });

    let price = plan.price * quantity;
    let validToken;
    if (token) {
      validToken = await Coupon.findOne({ token: token });
      if (
        !validToken ||
        validToken.masterType !== "product" ||
        validToken.isActive === false ||
        validToken.endDate < new Date()
      ) {
        return res.status(400).json({ message: "Invalid Coupon" });
      }
      if (validToken.user.length > 0) {
        if (!validToken.user.includes(user._id)) {
          return res.status(400).json({ message: "Invalid Coupon" });
        }
      }
      if (validToken.userProhibited.length > 0) {
        if (validToken.userProhibited.includes(user._id)) {
          return res.status(400).json({ message: "Invalid Coupon" });
        }
      }
      if (validToken.addUsersToProhibited) {
        const prohibitedUsers = validToken.prohibitedUsers || [];
        prohibitedUsers.push(user._id);
        validToken.prohibitedUsers = prohibitedUsers;
      }
      if (validToken.maxUses > 0) {
        if (validToken.used >= validToken.maxUses) {
          return res.status(400).json({ message: "Invalid Coupon" });
        }
        validToken.used += 1;
      }
      if (validToken.discountAmmount) {
        price -= validToken.discountAmmount;
      } else if (validToken.discountParcent) {
        price = price - price * (validToken.discountParcent / 100);
      }
    }
    if (user?.balance < price) {
      return res.status(400).json({ message: "Insufficient balance" });
    }
    if (relatedServices.length < quantity) {
      //create new service with pending status
      //and send notification to the admin to ass username and password
      return res.status(400).json({ message: "No available services" });
    } else {
      for (let i = 0; i < quantity; i++) {
        relatedServices[i].status = "active";
        relatedServices[i].relatedUser = user._id;
        relatedServices[i].expiryDate = new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        );
        await relatedServices[i].save();
      }
    }
    let newTransactionId;
    let existingTransaction;
    do {
      newTransactionId = `TRN${crypto.randomInt(10000, 99999)}`;
      existingTransaction = await Transaction.findOne({
        transactionId: newTransactionId,
      });
    } while (existingTransaction);
    const transaction = new Transaction({
      transactionId: newTransactionId,
      user: user._id,
      amount: -price.toFixed(2),
      type: "Service-Purchase",
      description: `Purchased service: ${relatedServices[0].serviceNickname} for ${quantity} time(s)`,
    });
    await transaction.save();
    user.balance -= price.toFixed(2);
    await user.save();
    if (validToken) {
      await validToken.save();
    }
    return res.status(200).json({ message: "Service purchased successfully" });
  } catch (error) {
    console.error("Error getting plan:", error);
    return res.status(500).json({ message: "Failed to get plan" });
  }
});

router.get("/transactions", async (req, res) => {
  try {
    const user = req.user;
    const transactions = await Transaction.find({ user: user._id }).sort({
      createdAt: -1,
    });
    return res.status(200).json(transactions);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch transactions" });
  }
});


router.get("/paymentHistory", async (req, res) => {
  try {
    const user = req.user;
    const history = await Payment.find({ user: user._id }).sort({
      createdAt: -1,
    });
    return res.status(200).json(history);
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return res.status(500).json({ message: "Failed to fetch transactions" });
  }
});

module.exports = router;
