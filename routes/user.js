const express = require("express");
const User = require("../models/user");
const Plan = require("../models/plan");
const Announcement = require("../models/announcements");
const VmRequest = require("../models/vmRequest");
const Service = require("../models/service");
const Coupon = require("../models/coupon");
const Transaction = require("../models/transaction");
const Payment = require("../models/payment");
const crypto = require("crypto");
const router = express.Router();
const bcrypt = require("bcrypt");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const {
  getVMStatus,
  executeVMAction,
  changeWindowsVMPassword,
  changeCloudInitPassword,
  rebootServer,
  changePassword,
} = require("./actions");
const { getIO } = require("../socket/socket");
const Notification = require("../models/notification");

const notify = (data) => {
  const io = getIO();
  const { userId } = data;
  if (!userId) throw new Error("User ID is required for notification");
  console.log("Sending notification to user:", userId);
  io.to(userId.toString()).emit("notification", data);
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../public");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    if (!req.user || !req.user._id) {
      return cb(new Error("User not authenticated"));
    }
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `profile-${req.user._id}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, and WebP are allowed."));
    }
  },
});

// Profile edit route
router.post("/profileedit", async (req, res) => {
  try {
    const user = req.user; // This will be passed by middleware extracting from cookie

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Handle profile image upload with multer
    if (req.headers["content-type"]?.includes("multipart/form-data")) {
      upload.single("profileImage")(req, res, async (err) => {
        if (err) {
          return res.status(400).json({ message: err.message });
        }

        try {
          if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
          }

          const imageUrl = `${process.env.Current_Url}/${req.file.filename}`;

          if (
            user.profile?.avatarUrl &&
            user.profile.avatarUrl !== "https://default-avatar-url.com"
          ) {
            try {
              const oldImagePath = path.join(
                __dirname,
                "../public",
                new URL(user.profile.avatarUrl).pathname
              );
              if (fs.existsSync(oldImagePath)) {
                fs.unlinkSync(oldImagePath);
              }
            } catch (error) {
              console.error("Error deleting old image:", error);
            }
          }

          await User.findByIdAndUpdate(user._id, {
            "profile.avatarUrl": imageUrl,
            "profile.name": req.file.originalname,
          });

          // Fetch updated user
          const updatedUser = await User.findById(user._id);

          return res.status(200).json({
            message: "Profile image updated successfully",
            user: updatedUser,
          });
        } catch (error) {
          console.error("Error updating profile image:", error);
          return res
            .status(500)
            .json({ message: "Server error while updating profile image" });
        }
      });
      return;
    }

    if (req.body.deleteProfileImage) {
      if (
        user.profile?.avatarUrl &&
        user.profile.avatarUrl !== "https://default-avatar-url.com"
      ) {
        try {
          // Delete the image file
          const imageUrl = user.profile.avatarUrl;
          try {
            const imagePath = path.join(
              __dirname,
              "../public",
              new URL(imageUrl).pathname
            );
            if (fs.existsSync(imagePath)) {
              fs.unlinkSync(imagePath);
            }
          } catch (error) {
            console.error("Error parsing image URL:", error);
          }

          // Reset profile image to default
          await User.findByIdAndUpdate(user._id, {
            "profile.avatarUrl": "https://default-avatar-url.com",
            "profile.name": null,
          });

          // Fetch updated user
          const updatedUser = await User.findById(user._id);

          return res.status(200).json({
            message: "Profile image removed successfully",
            user: updatedUser,
          });
        } catch (error) {
          console.error("Error deleting profile image:", error);
          return res
            .status(500)
            .json({ message: "Server error while deleting profile image" });
        }
      } else {
        return res.status(400).json({ message: "No profile image to delete" });
      }
    }

    switch (req.body.type) {
      case "profileUpdate":
        // Verify password for sensitive update
        const isPasswordValid = await bcrypt.compare(
          req.body.password,
          user.password
        );
        if (!isPasswordValid) {
          return res.status(401).json({ message: "Incorrect password" });
        }

        // Update profile information
        await User.findByIdAndUpdate(user._id, {
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          whatsapp: req.body.whatsapp,
          organizationName: req.body.organizationName,
          gstNumber: req.body.gstNumber,
        });

        // Fetch updated user
        const updatedUserProfile = await User.findById(user._id);

        return res.status(200).json({
          message: "Profile updated successfully",
          user: updatedUserProfile,
        });

      case "addressUpdate":
        // Verify password for sensitive update
        const isPwdValid = await bcrypt.compare(
          req.body.password,
          user.password
        );
        if (!isPwdValid) {
          return res.status(401).json({ message: "Incorrect password" });
        }

        // Update address information
        await User.findByIdAndUpdate(user._id, {
          address: {
            street: req.body.address.street,
            city: req.body.address.city,
            state: req.body.address.state,
            country: req.body.address.country,
            pincode: req.body.address.pincode,
          },
        });

        // Fetch updated user
        const updatedUserAddress = await User.findById(user._id);

        return res.status(200).json({
          message: "Address updated successfully",
          user: updatedUserAddress,
        });

      case "passwordChange":
        if (req?.user?.password && req?.body?.password?.length > 0) {
          const isCurrentPwdValid = await bcrypt.compare(
            req.body.currentPassword,
            user.password
          );
          if (!isCurrentPwdValid) {
            return res
              .status(401)
              .json({ message: "Current password is incorrect" });
          }
        }

        const hashedPassword = await bcrypt.hash(req.body.newPassword, 10);

        // Update password
        await User.findByIdAndUpdate(user._id, {
          password: hashedPassword,
        });

        // Fetch updated user
        const updatedUserPassword = await User.findById(user._id).select();

        return res.status(200).json({
          message: "Password updated successfully",
          user: updatedUserPassword,
        });

      default:
        return res.status(400).json({ message: "Invalid update type" });
    }
  } catch (error) {
    console.error("Error in profile edit:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

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
    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }
    if (coupon.masterType === "product") {
      if (!coupon.isActive || coupon.endDate < new Date()) {
        return res.status(404).json({ message: "Coupon not found" });
      }
      if (coupon.maxUses > 0 && coupon.used >= coupon.maxUses) {
        return res.status(400).json({ message: "Coupon has expired" });
      }
      if (coupon.user.length > 0) {
        if (!coupon.user.includes(req.user.email)) {
          return res.status(400).json({ message: "Coupon not found" });
        }
      }
      if (coupon.userProhibited.length > 0) {
        if (coupon.userProhibited.includes(req.user.email)) {
          return res.status(400).json({ message: "Coupon not found" });
        }
      }
      return res.status(200).json(coupon);
    } else {
      if (!coupon.isActive || coupon.endDate < new Date()) {
        return res.status(404).json({ message: "Coupon not found" });
      }
      if (coupon.maxUses > 0 && coupon.used >= coupon.maxUses) {
        return res.status(400).json({ message: "Coupon has expired" });
      }
      if (coupon.userProhibited.includes(req.user.email)) {
        return res.status(400).json({ message: "Coupon not found" });
      }
      if (coupon.maxUses > 0) {
        coupon.used += 1;
      }
      let transactionId;
      let existingTransaction;
      do {
        transactionId = `TRN${crypto.randomInt(1000000000, 9999999999)}`;
        existingTransaction = await Transaction.findOne({
          transactionId: transactionId,
        });
      } while (existingTransaction);
      const transaction = new Transaction({
        transactionId,
        user: req.user._id,
        amount: Number(Number(coupon.coinAmmount).toFixed(2)),
        type: "Coupon",
        description: `Coupon code applied.`,
      });
      await transaction.save();
      const userfromDb = await User.findById(req.user._id);
      userfromDb.balance += Number(Number(coupon.coinAmmount).toFixed(2));
      await userfromDb.save();
      await notify({
        userId: req.user._id,
        status: "success",
        title: "Coupon Applied",
        message: `Your account has been credited ${Number(
          coupon.coinAmmount
        ).toFixed(2)} NC.`,
      });
      const notification = new Notification({
        userId: req.user._id,
        status: "success",
        title: "Coupon Applied",
        message: `Your account has been credited ${Number(
          coupon.coinAmmount
        ).toFixed(2)} NC.`,
      });
      await notification.save();
      coupon.userProhibited = [...coupon.userProhibited, req.user.email];
      await coupon.save();
      return res.status(200).json({
        success: true,
        message: "Coupon applied successfully",
        user: userfromDb,
      });
    }
  } catch (error) {
    console.error("Error fetching announcements:", error);
    return res.status(500).json({ message: "Failed to fetch announcements" });
  }
});

router.get("/services", async (req, res) => {
  try {
    const { _id } = req.user;
    const initialServices = await Service.find({ relatedUser: _id })
      .populate("relatedProduct")
      .select("-vmID")
      .select("-EXTRLhash");

    const savePromises = initialServices.map(async (service) => {
      const expired = new Date(service.expiryDate) < new Date();
      if (expired && service.status !== "expired") {
        service.status = "expired";
        service.terminationDate = new Date();
        service.terminationReason = "expired";
        await service.save();
      }
      return service;
    });

    const updatedServices = await Promise.all(savePromises);
    const services = updatedServices.map((service) => {
      const expired = new Date(service.expiryDate) < new Date();
      return {
        ...service.toObject(),
        status: expired ? "expired" : service.status,
      };
    });

    return res.status(200).json(services ? services : []);
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
    const initialService = await Service.findOne({
      serviceId: serviceId,
    }).populate("relatedProduct");
    if (!initialService) {
      return res.status(404).json({ message: "Service not found" });
    }

    let service = initialService.toObject();
    if (service?.relatedProduct?.serviceType?.includes("Internal")) {
      if (new Date(service.expiryDate) > new Date()) {
        try {
          const vmStatus = await getVMStatus(service?.vmID);
          console.log("VM Status:", vmStatus?.status);
          service.vmStatus = vmStatus?.status;
        } catch (error) {}
      } else if (service.expiryDate) {
        service.vmStatus = "expired";
        if (service.status !== "expired") {
          initialService.status = "expired";
          initialService.terminationDate = new Date();
          initialService.terminationReason = "expired";
          await initialService.save();
        }
      } else {
        service.vmStatus = "pending";
      }
    } else if (
      service.expiryDate &&
      new Date(service.expiryDate) < new Date()
    ) {
      service.vmStatus = "expired";
      if (service.status !== "expired") {
        initialService.status = "expired";
        initialService.terminationDate = new Date();
        initialService.terminationReason = "expired";
        await initialService.save();
      }
    }
    if (req?.user?.role !== "admin") {
      service.vmID = undefined;
      service.EXTRLhash = undefined;
    }
    const rebuildReq = await VmRequest.findOne({
      serviceMongoID: initialService._id,
      requestType: "Rebuild",
      status: "Pending",
    });
    if (rebuildReq) service.rebuildRequestExists = true;

    return res.status(200).json(service);
  } catch (error) {
    console.error("Error fetching service:", error);
    return res.status(500).json({ message: "Failed to fetch service" });
  }
});

router.post("/action", async (req, res) => {
  try {
    const { action, serviceId, password } = req.body;
    const user = req.user;
    if (user?.revokedService)
      return res.status(403).json({ message: "Your account is revoked" });
    if (
      !action ||
      !serviceId ||
      !["start", "stop", "reboot", "changepass", "rebuild"].includes(action) ||
      (action === "changepass" && !password)
    ) {
      return res
        .status(400)
        .json({ message: "Action and Service ID are required" });
    }
    if (user.actionCounter && action !== "rebuild") {
      const timeSinceLastAction =
        Date.now() - new Date(user.actionCounter).getTime();
      if (timeSinceLastAction < 30000) {
        return res.status(429).json({
          success: false,
          message: `Please wait ${Math.ceil(
            (30000 - timeSinceLastAction) / 1000
          )} seconds before trying again!`,
        });
      } else {
        user.actionCounter = new Date();
        await user.save();
      }
    }
    const targetService = await Service.findOne({
      serviceId: serviceId,
    }).populate("relatedProduct");
    if (
      !targetService ||
      targetService?.expiryDate < new Date() ||
      targetService?.status === "terminated"
    ) {
      return res.status(404).json({ message: "Service not found" });
    }
    if (action === "rebuild") {
      const request = new VmRequest({
        productMongoID: targetService.relatedProduct._id,
        serviceMongoID: targetService._id,
        relatedUser: user._id,
        requestType: "Rebuild",
      });
      await request.save();
      return res.status(200).json({
        success: true,
        service: { ...targetService.toObject(), rebuildRequestExists: true },
        message: "Service rebuild request sent successfully",
      });
    }
    if (targetService?.relatedProduct?.serviceType?.includes("Internal")) {
      if (action === "changepass") {
        try {
          const ChangePassRequest =
            targetService?.relatedProduct?.serviceType?.includes("Linux")
              ? await changeCloudInitPassword(targetService?.vmID, password)
              : await changeWindowsVMPassword(
                  targetService?.vmID,
                  targetService?.username,
                  password
                );

          if (ChangePassRequest) {
            targetService.password = password;
            targetService.save();
          }
          return res.status(200).json({
            success: true,
            service: {
              ...targetService.toObject(),
              vmStatus: targetService?.relatedProduct?.serviceType?.includes(
                "Linux"
              )
                ? "rebooting"
                : "running",
            },
            message: `Service ${action} successfully`,
          });
        } catch (error) {
          return res
            .status(500)
            .json({ success: false, message: "Failed to execute action" });
        }
      }
      try {
        await executeVMAction(targetService?.vmID, action);
        const msg =
          action === "start"
            ? "started"
            : action === "stop"
            ? "stopped"
            : action === "reboot"
            ? "rebooted"
            : action === "changepass"
            ? "changed password"
            : "";

        return res.status(200).json({
          success: true,
          service: {
            ...targetService.toObject(),
            vmStatus: action === "stop" ? "stopped" : "running",
          },
          message: `Service ${msg} successfully`,
        });
      } catch (error) {
        console.log(error?.response?.data);
        return res
          .status(500)
          .json({ success: false, message: "Failed to execute action" });
      }
    } else {
      if (targetService?.relatedProduct?.serviceType?.includes("RDP")) {
        return res.status(400).json({
          success: false,
          message: "This action is not allowed on External RDP",
        });
      } else {
        try {
          const Response =
            action === "reboot"
              ? await rebootServer(
                  targetService?.ipAddress,
                  targetService?.EXTRLhash
                )
              : await changePassword(
                  targetService?.ipAddress,
                  targetService?.EXTRLhash,
                  targetService?.username,
                  password
                );
          if (Response && action === "changepass") {
            targetService.password = password;
            targetService.save();
          }
          return res.status(200).json({
            success: true,
            service: {
              ...targetService.toObject(),
              status: action === "reboot" ? "rebooting" : "active",
            },
            message: `Service ${action} successfully`,
          });
        } catch (error) {
          return res
            .status(500)
            .json({ success: false, message: "Failed to execute action" });
        }
      }
    }
  } catch (error) {
    return res.status(500).json({ message: "Failed to execute action" });
  }
});

router.get("/purchase_service", async (req, res) => {
  try {
    const { productId, quantity, token } = req.query;
    const user = req.user;
    if (user?.revokedService)
      return res.status(403).json({ message: "Your account is revoked" });
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
        if (!validToken.user.includes(user.email)) {
          return res.status(400).json({ message: "Invalid Coupon" });
        }
      }
      if (validToken.userProhibited.length > 0) {
        if (validToken.userProhibited.includes(user.email)) {
          return res.status(400).json({ message: "Invalid Coupon" });
        }
      }
      if (validToken.addUsersToProhibited) {
        const prohibitedUsers = validToken.prohibitedUsers || [];
        prohibitedUsers.push(user.email);
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
      const extraneededService = quantity - relatedServices.length;
      if (plan?.maxPendingService < extraneededService) {
        return res.status(400).json({ message: "No available services" });
      }
      for (let i = 0; i < relatedServices.length; i++) {
        relatedServices[i].status = "active";
        relatedServices[i].relatedUser = user._id;
        relatedServices[i].expiryDate = new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        );
        relatedServices[i].purchedPrice = Number((price / quantity).toFixed(2));
        await relatedServices[i].save();
      }
      for (let i = 0; i < extraneededService; i++) {
        let uniqueId;
        let exists;
        do {
          uniqueId = `SID${crypto.randomInt(10000, 99999)}`;
          exists = await Service.findOne({ serviceId: uniqueId });
        } while (exists);
        const newService = new Service({
          serviceId: uniqueId,
          relatedProduct: plan._id,
          status: "pending",
          relatedUser: user._id,
          serviceNickname: plan.productName,
          purchedPrice: Number((price / quantity).toFixed(2)),
        });
        await newService.save();
        const request = new VmRequest({
          productMongoID: plan._id,
          serviceMongoID: newService._id,
          relatedUser: user._id,
          requestType: "Service",
        });
        await request.save();
      }
      plan.maxPendingService -= extraneededService;
      if (plan.maxPendingService === 0) plan.Stock = false;
      await plan.save();
    } else {
      for (let i = 0; i < quantity; i++) {
        relatedServices[i].status = "active";
        relatedServices[i].relatedUser = user._id;
        relatedServices[i].expiryDate = new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        );
        relatedServices[i].purchedPrice = Number((price / quantity).toFixed(2));
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
      planId: plan._id,
      amount: -price.toFixed(2),
      type: "Service-Purchase",
      description: `Purchased service: ${plan.productName} for ${quantity} time(s)`,
    });
    await transaction.save();
    user.balance -= price.toFixed(2);
    await user.save();
    if (validToken) {
      await validToken.save();
    }
    const newNotification = new Notification({
      userId: user?._id,
      status: "success",
      title: "Service Purchased",
      message: `You have successfully purchased ${quantity} ${plan.productName} service(s).`,
    });
    await newNotification.save();
    notify({
      userId: user?._id,
      status: "success",
      title: "Service Purchased",
      message: `You have successfully purchased ${quantity} ${plan.productName} service(s).`,
    });
    return res.status(200).json({ message: "Service purchased successfully" });
  } catch (error) {
    console.error("Error getting plan:", error);
    return res.status(500).json({ message: "Failed to get plan" });
  }
});

router.post("/renew_service", async (req, res) => {
  try {
    const { serviceId } = req.body;
    if (!serviceId) {
      return res.status(400).json({ message: "Service ID is required" });
    }
    const targetService = await Service.findOne({
      serviceId: serviceId,
    }).populate("relatedProduct");
    if (!targetService) {
      return res.status(404).json({ message: "Service not found" });
    }
    if (targetService?.expiryDate > new Date()) {
      return res.status(400).json({ message: "Service is not expired" });
    }
    const user = req.user;
    let price = targetService.purchedPrice
      ? targetService.purchedPrice
      : targetService.relatedProduct.price;
    if (user.balance < price) {
      return res.status(400).json({ message: "Insufficient balance" });
    }
    user.balance -= price.toFixed(2);
    await user.save();
    targetService.expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    targetService.status = targetService?.relatedProduct?.serviceType?.includes(
      "External"
    )
      ? "pending"
      : "active";
    await targetService.save();
    let newTransactionId;
    let existingTransaction;

    do {
      newTransactionId = `TRN${crypto.randomInt(10000, 99999)}`;
      existingTransaction = await Transaction.findOne({
        transactionId: newTransactionId,
      });
    } while (existingTransaction);
    const transaction = new Transaction({
      transactionId: `${newTransactionId}`,
      user: user._id,
      amount: -price.toFixed(2),
      type: "Service-Renewal",
      description: `Renewed service: ${targetService.serviceNickname}`,
    });
    await transaction.save();
    if (targetService?.relatedProduct?.serviceType?.includes("External")) {
      const request = new VmRequest({
        productMongoID: targetService.relatedProduct._id,
        serviceMongoID: targetService._id,
        relatedUser: user._id,
        requestType: "Renew",
      });
      await request.save();
    }
    return res.status(200).json({
      success: true,
      user: user,
      service: targetService,
      message: `Service ${
        targetService?.relatedProduct?.serviceType?.includes("External")
          ? "renew request sent"
          : "renewed"
      } successfully`,
    });
  } catch (error) {
    console.error("Error renewing service:", error);
    return res.status(500).json({ message: "Failed to renew service" });
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
    const history =
      user?.role === "admin"
        ? await Payment.find().populate("user").sort({ createdAt: -1 })
        : await Payment.find({ user: user._id }).sort({
            createdAt: -1,
          });
    return res.status(200).json(history);
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return res.status(500).json({ message: "Failed to fetch transactions" });
  }
});

router.get("/notifications", async (req, res) => {
  try {
    const user = req.user;
    const notifications = await Notification.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(10);
    return res.status(200).json(notifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return res.status(500).json({ message: "Failed to fetch notifications" });
  }
});

router.get("/requests", async (req, res) => {
  try {
    const user = req.user;
    const requests = await VmRequest.find({ relatedUser: user._id })
      .populate("productMongoID")
      .populate("serviceMongoID")
      .sort({ createdAt: -1 });
    return res.status(200).json(requests);
  } catch (error) {
    console.error("Error fetching requests:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch requests" });
  }
});

module.exports = router;
