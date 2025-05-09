const express = require("express");
const User = require("../models/user");
const Service = require("../models/service");
const Plan = require("../models/plan");
const crypto = require("crypto");
const { default: mongoose } = require("mongoose");
const Announcement = require("../models/announcements");
const Coupon = require("../models/coupon");
const System = require("../models/system");
const Transaction = require("../models/transaction");
const vmRequest = require("../models/vmRequest");
const { route } = require("./user");
const router = express.Router();
const { getIO } = require("../socket/socket");
const Notification = require("../models/notification");
const Payment = require("../models/payment");

const notify = (data) => {
  const io = getIO();
  const { userId } = data;
  if (!userId) throw new Error("User ID is required for notification");
  io.to(userId.toString()).emit("notification", data);
};

router.get("/all_users", async (req, res) => {
  try {
    const users = await User.find();
    return res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    return res.status(500).json({ message: "Failed to fetch users" });
  }
});

router.get("/targetuser", async (req, res) => {
  try {
    const { userId } = req.query;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    return res.status(500).json({ message: "Failed to fetch user" });
  }
});

router.put("/update_user", async (req, res) => {
  try {
    const { userId, reason, balance, isBanned, revokedService } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const existinguser = await User.findById(userId);

    const updateFields = {};
    if (typeof balance === "number") {
      updateFields.balance = balance < 0 ? 0 : parseFloat(balance).toFixed(2);
      let newTransactionId;
      let existingTransaction;

      do {
        newTransactionId = `TRN${crypto.randomInt(1000000000, 9999999999)}`;
        existingTransaction = await Transaction.findOne({
          transactionId: newTransactionId,
        });
      } while (existingTransaction);
      const transaction = new Transaction({
        transactionId: newTransactionId,
        user: userId,
        amount: updateFields.balance - existinguser.balance,
        type: "Admin-Update",
        description: reason || "Admin updated balance",
      });
      await transaction.save();
      const newNotification = new Notification({
        userId: userId,
        status:
          updateFields.balance < existinguser.balance ? "error" : "success",
        title: "Account Status Changed",
        message: `${updateFields.balance - existinguser.balance} ${updateFields.balance < existinguser.balance
          ? "has been debited from your account"
          : "has been credited from your account"
          }.`,
      });
      await newNotification.save();
      notify({
        userId: userId,
        status:
          updateFields.balance < existinguser.balance ? "error" : "success",
        title: "Account Status Changed",
        message: `${updateFields.balance - existinguser.balance} ${updateFields.balance < existinguser.balance
          ? "has been debited from your account"
          : "has been credited from your account"
          }.`,
      });
    }
    if (typeof isBanned === "boolean") {
      updateFields.isBanned = isBanned;
      const newNotification = new Notification({
        userId: userId,
        status: isBanned ? "error" : "success",
        title: "Account Status Changed",
        message: `Your account has been ${isBanned ? "banned" : "unbanned"}.`,
      });
      await newNotification.save();
      notify({
        userId: userId,
        status: isBanned ? "error" : "success",
        title: "Account Status Changed",
        message: `Your account has been ${isBanned ? "banned" : "unbanned"}.`,
      });
    }
    if (typeof revokedService === "boolean") {
      updateFields.revokedService = revokedService;
      const newNotification = new Notification({
        userId: userId,
        status: revokedService ? "error" : "success",
        title: "Account Status Changed",
        message: `Your account has been ${revokedService ? "revoked" : "unrevoked"
          }.`,
      });
      await newNotification.save();
      notify({
        userId: userId,
        status: revokedService ? "error" : "success",
        title: "Account Status Changed",
        message: `Your account has been ${revokedService ? "revoked" : "unrevoked"
          }.`,
      });
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateFields, {
      new: true,
    });

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    return res
      .status(200)
      .json({ message: "User updated successfully", user: updatedUser });
  } catch (error) {
    console.error("Error updating user:", error);
    return res.status(500).json({ message: "Failed to update user" });
  }
});

router.post("/create_announcement", async (req, res) => {
  try {
    const { subject, body } = req.body;

    if (!subject || !body) {
      return res.status(400).json({ message: "Subject and body are required" });
    }

    const announcement = new Announcement({ subject, body });
    await announcement.save();

    return res
      .status(201)
      .json({ message: "Announcement created successfully", announcement });
  } catch (error) {
    console.error("Error creating announcement:", error);
    return res.status(500).json({ message: "Failed to create announcement" });
  }
});

router.get("/generate_id", async (req, res) => {
  try {
    let uniqueId;
    let exists;
    do {
      uniqueId = `PRD${crypto.randomInt(10000, 99999)}`;
      exists = await Plan.findOne({ productId: uniqueId });
    } while (exists);
    return res.status(200).json({ id: uniqueId });
  } catch (error) {
    console.error("Error generating ID:", error);
    return res.status(500).json({ message: "Error generating unique ID" });
  }
});

router.post("/add_product", async (req, res) => {
  try {
    const {
      productId,
      productName,
      os,
      networkType,
      cpu,
      ram,
      storage,
      ipSet,
      price,
      inStock,
      maxPendingService,
      dataCenterLocation
    } = req.body;

    const plan = new Plan({
      productId,
      productName,
      Os: os,
      serviceType: networkType,
      cpu: Number(cpu),
      ram: Number(ram),
      storage: Number(storage),
      ipSet,
      price: Number(price),
      stock: Boolean(inStock),
      maxPendingService: Number(maxPendingService),
      dataCenterLocation
    });
    await plan.save();

    return res
      .status(201)
      .json({ success: true, message: "Plan added successfully" });
  } catch (error) {
    console.error("Error adding service:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
});

router.post("/stock_product", async (req, res) => {
  try {
    const { productId, value } = req.body;
    if (!productId || value === undefined || value === null) {
      return res
        .status(400)
        .json({ message: "Product ID and value are required" });
    }
    const targetPlan = await Plan.findOneAndUpdate(
      { productId: productId },
      { Stock: value },
      { new: true }
    );
    if (!targetPlan) {
      return res.status(404).json({ message: "Plan not found" });
    }
    return res.status(200).json({
      message: `Plan stock updated to ${value ? "available" : "not available"}`,
    });
  } catch (error) {
    console.error("Error deleting plan:", error);
    return res.status(500).json({ message: "Failed to delete plan" });
  }
});

router.post("/delete_product", async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) {
      return res.status(400).json({ message: "Product ID is required" });
    }
    const targetProduct = await Plan.findOne({ productId: productId });
    if (!targetProduct) {
      return res.status(404).json({ message: "Product not found" });
    }
    const relatedServices = await Service.find({
      relatedProduct: targetProduct._id,
    });
    if (relatedServices.length > 0) {
      return res.status(400).json({ message: "Product is in use" });
    } else {
      await Plan.deleteOne({ productId: productId });
    }
    return res.status(200).json({ message: "Plan deleted successfully" });
  } catch (error) {
    console.error("Error deleting plan:", error);
    return res.status(500).json({ message: "Failed to delete plan" });
  }
});

router.post("/update_product", async (req, res) => {
  try {
    const {
      productId,
      productName,
      Os,
      serviceType,
      cpu,
      ram,
      storage,
      ipSet,
      price,
      Stock,
      maxPendingService,
      dataCenterLocation
    } = req.body;

    // console.log("req.body")
    // console.log(dataCenterLocation)
    if (!productId) {
      return res.status(400).json({ message: "Product ID is required" });
    }
    if (
      !productName &&
      !Os &&
      !serviceType &&
      !cpu &&
      !ram &&
      !storage &&
      !ipSet &&
      !price &&
      Stock === undefined &&
      !dataCenterLocation
    ) {
      return res.status(400).json({ message: "No update data provided" });
    }

    const updateData = {};
    if (productName) updateData.productName = productName;
    if (Os) updateData.Os = Os;
    if (serviceType) updateData.serviceType = serviceType;
    if (cpu) updateData.cpu = Number(cpu);
    if (ram) updateData.ram = Number(ram);
    if (storage) updateData.storage = Number(storage);
    if (ipSet) updateData.ipSet = ipSet;
    if (price) updateData.price = Number(price);
    if (Stock !== undefined) updateData.Stock = Boolean(Stock);
    if (maxPendingService)
      updateData.maxPendingService = Number(maxPendingService);

    if (dataCenterLocation) {
      const system = await System.findById(dataCenterLocation);
      if (!system || system.name !== "datacenter") {
        return res
          .status(400)
          .json({ message: "Invalid data center location" });
      }
      updateData.dataCenterLocation = dataCenterLocation;
    }
    const updatedPlan = await Plan.findOneAndUpdate(
      { productId },
      { $set: updateData },
      { new: true }
    );

    if (!updatedPlan) {
      return res.status(404).json({ message: "Plan not found" });
    }

    return res
      .status(200)
      .json({ message: "Plan updated successfully", updatedPlan });
  } catch (error) {
    console.error("Error updating plan:", error);
    return res.status(500).json({ message: "Failed to update plan" });
  }
});

router.post("/add_services", async (req, res) => {
  try {
    console.log(req.body);
    if (!Array.isArray(req.body) || req.body.length === 0) {
      return res.status(400).json({ message: "Invalid request data" });
    }

    const productType = req.body[0].productType;
    const relatedProduct = await Plan.findOne({ productId: productType });

    if (!relatedProduct) {
      return res
        .status(400)
        .json({ message: "Could not find related product" });
    }

    const generate_id = new Set();

    async function generateUniqueServiceId() {
      let uniqueId;
      let exists;
      do {
        uniqueId = `SID${crypto.randomInt(10000, 99999)}`;
        exists = await Service.findOne({ serviceId: uniqueId });
      } while (exists || generate_id.has(uniqueId));

      generate_id.add(uniqueId);
      return uniqueId;
    }

    const values = await Promise.all(
      req.body.map(async (item) => {
        return {
          relatedProduct: relatedProduct._id,
          serviceNickname: relatedProduct.productName,
          serviceId: await generateUniqueServiceId(),
          vmID: item.vmId || null,
          purchaseDate: item.purchaseDate ? new Date(item.purchaseDate) : null,
          purchedFrom: item.purchaseProvider || null,
          EXTRLhash: item.hashCode || null,
          ipAddress: item.ipAddress || null,
          username: item.username || null,
          password: item.password || null,
        };
      })
    );

    const services = await Service.insertMany(values);
    return res.status(201).json({
      title: "Success",
      message: "Services added successfully",
      services,
    });
  } catch (error) {
    console.error("Error inserting services:", error);
    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/services", async (req, res) => {
  try {
    const now = new Date();
    await Service.updateMany(
      {
        expiryDate: { $lt: now },
        status: { $ne: "expired" },
      },
      {
        status: "expired",
        terminationDate: now,
        terminationReason: "expired",
      }
    );
    const services = await Service.find()
      .populate("relatedProduct")
      .populate("relatedUser");

    return res.status(200).json(services);
  } catch (error) {
    console.error("Error fetching services:", error);
    return res.status(500).json({ message: "Failed to fetch services" });
  }
});

router.delete("/services", async (req, res) => {
  try {
    const { serviceId } = req.query;
    if (!serviceId) {
      return res.status(400).json({ message: "Service ID is required" });
    }
    const deletedService = await Service.findOneAndDelete({
      serviceId: serviceId,
    });
    if (!deletedService) {
      return res.status(404).json({ message: "Service not found" });
    }
    return res.status(200).json({ message: "Service deleted successfully" });
  } catch (error) {
    console.error("Error deleting service:", error);
    return res.status(500).json({ message: "Failed to delete service" });
  }
});

router.get("/all_coupons", async (req, res) => {
  try {
    const coupons = await Coupon.find();
    return res.status(200).json(coupons);
  } catch (error) {
    console.error("Error fetching coupons:", error);
    return res.status(500).json({ message: "Failed to fetch coupons" });
  }
});

router.post("/create_coupon", async (req, res) => {
  try {
    const {
      masterType,
      label,
      user,
      userProhibited,
      addUsersToProhibited,
      productId,
      discountAmmount,
      discountParcent,
      maxUses,
      endDate,
      coinAmmount,
      token,
    } = req.body;
    if (!token) {
      return res.status(400).json({ message: "Token is required" });
    }
    if (masterType === "product") {
      if (!label) {
        return res
          .status(400)
          .json({ message: "Label is required for product coupons" });
      }
      if (
        (!discountAmmount && !discountParcent) ||
        (discountAmmount && discountParcent)
      ) {
        return res.status(400).json({
          message:
            "Either discountAmmount or discountParcent is required for product coupons",
        });
      }
      if (productId.length > 0) {
        const validProducts = await Plan.find({
          productId: { $in: productId },
        });
        const validProductIds = validProducts.map(
          (product) => product.productId
        );
        const filteredProductIds = productId.filter((id) =>
          validProductIds.includes(id)
        );
        if (filteredProductIds.length === 0) {
          return res
            .status(400)
            .json({ message: "No valid product IDs found" });
        }
      }
      if (user.length > 0) {
        const validUsers = await User.find({ email: { $in: user } });
        const validUserEmail = validUsers.map((user) => user.email);
        const filteredUserEmail = user.filter((id) =>
          validUserEmail.includes(id)
        );
        if (filteredUserEmail.length === 0) {
          return res.status(400).json({ message: "No valid user IDs found" });
        }
      }
      if (userProhibited.length > 0) {
        const validUsers = await User.find({ email: { $in: userProhibited } });
        const validUserEmail = validUsers.map((user) => user.email);
        const filteredUserEmail = userProhibited.filter((id) =>
          validUserEmail.includes(id)
        );
        if (filteredUserEmail.length === 0) {
          return res.status(400).json({ message: "No valid user IDs found" });
        }
      }
      const newCoupon = new Coupon({
        masterType,
        label,
        user,
        userProhibited,
        addUsersToProhibited,
        productId,
        discountAmmount,
        discountParcent,
        maxUses,
        endDate,
        token,
      });
      console.log(newCoupon);
      const savedCoupon = await newCoupon.save();
      if (savedCoupon) {
        return res
          .status(201)
          .json({ message: "Coupon created successfully", savedCoupon });
      }
    } else if (masterType === "coin") {
      if (!coinAmmount) {
        return res
          .status(400)
          .json({ message: "coinAmmount is required for coin coupons" });
      }
      const newCoupon = new Coupon({
        masterType,
        coinAmmount,
        maxUses,
        token,
      });
      console.log(newCoupon);
      const savedCoupon = await newCoupon.save();
      if (savedCoupon) {
        return res
          .status(201)
          .json({ message: "Coupon created successfully", savedCoupon });
      }
    } else {
      return res.status(400).json({ message: "Invalid masterType" });
    }
    return res.status(500).json({ message: "Failed to create coupon" });
  } catch (error) {
    return res.status(500).json({
      message:
        error instanceof mongoose.Error.ValidationError
          ? error.message
          : "Internal Server Error",
    });
  }
});

router.delete("/delete_coupon", async (req, res) => {
  try {
    const { couponId } = req.query;
    if (!couponId) {
      return res.status(400).json({ message: "Coupon ID is required" });
    }
    const deletedCoupon = await Coupon.findByIdAndDelete(couponId);
    if (!deletedCoupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }
    return res.status(200).json({ message: "Coupon deleted successfully" });
  } catch (error) {
    console.error("Error deleting coupon:", error);
    return res.status(500).json({ message: "Failed to delete coupon" });
  }
});

router.post("/coupon_status", async (req, res) => {
  try {
    const { value, couponId } = req.body;
    if (typeof value !== "boolean") {
      return res.status(400).json({ message: "Invalid request" });
    }
    if (!couponId) {
      return res.status(400).json({ message: "Coupon ID is required" });
    }
    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }
    coupon.isActive = value;
    await coupon.save();
    return res.status(200).json({
      success: true,
      message: `Coupon ${value ? "activated" : "deactivated"
        } updated successfully`,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Failed to update coupon status" });
  }
});

//sytem
router.get("/system", async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) {
      const systems = await System.find();
      return res.status(200).json(systems);
    }
    const system = await System.find({ name: name });
    if (!system) {
      return res.status(404).json({ message: "System not found" });
    }
    return res.status(200).json(system);
  } catch (error) {
    console.error("Error fetching system:", error);
    return res.status(500).json({ message: "Failed to fetch system" });
  }
});

router.post("/create_system", async (req, res) => {
  try {
    const { name, value } = req.body;
    if (!name || !value) {
      return res.status(400).json({ message: "Name and value are required" });
    }
    if (name !== "datacenter") {

      const system = new System({ name, value });
      await system.save();
      return res
        .status(201)
        .json({ message: "System created successfully", system });
    } else if (name === "datacenter") {
      const { location, datastore, status } = value;
      if (!location || typeof location !== 'string') {
        return res.status(400).json({ message: "Location is required and must be a string" });
      }
      if (!datastore || typeof datastore !== 'string') {
        return res.status(400).json({ message: "Datastore is required and must be a string" });
      }
      if (typeof status !== 'boolean') {
        return res.status(400).json({ message: "Status must be a boolean" });
      }
      const system = new System({
        name,
        value: {
          location,
          datastore,
          status
        }
      });

      await system.save();


      return res
        .status(201)
        .json({ message: "System created successfully", system });
    } else {
      res.status(400).json({ message: "Invalid system name" });
    }
  } catch (error) {
    console.error("Error creating system:", error);
    return res.status(500).json({ message: "Failed to create system" });
  }
});


router.post("/update_system", async (req, res) => {
  try {
    const { id, value } = req.body;
    if (!id) {
      return res.status(400).json({ message: "ID is required" });
    }
    if (!value) {
      return res.status(400).json({ message: "Name and value are required" });
    }
    const system = await System.findById(id);
    if (!system) {
      return res.status(404).json({ message: "System not found" });
    }
    if (system.name !== "datacenter") {
      return res.status(400).json({ message: "Only DataCenter constants are editable" });
    }
    system.value = {
      location: system.value.location,
      datastore: system.value.datastore,
      status: value.status
    };
    await system.save();
    return res.status(200).json({
      message: "System updated successfully",
      system,
    });
  } catch (error) {
    console.error("Error updating system:", error);
    return res.status(500).json({ message: "Failed to update system" });
  }
})


router.delete("/delete_system", async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ message: "ID is required" });
    }

    const targetSystem = await System.findById(id);
    if (!targetSystem) {
      return res.status(404).json({ message: "System not found" });
    }
    if (targetSystem?.name === "ipSets" || targetSystem?.name === "osType") {
      const relatedPlans = await Plan.find({ ipSet: targetSystem?.value });
      if (relatedPlans?.length > 0) {
        return res
          .status(400)
          .json({ message: "Constant is already being utilized" });
      }
      const relatedPlanss = await Plan.find({ Os: targetSystem?.value });
      if (relatedPlanss?.length > 0) {
        return res
          .status(400)
          .json({ message: "Constant is already being utilized" });
      }
    } else if (targetSystem?.name === "providers") {
      const relatedPlans = await Service.find({
        purchedFrom: targetSystem?.value,
      });
      if (relatedPlans?.length > 0) {
        return res
          .status(400)
          .json({ message: "Constant is already being utilized" });
      }
    }
    const deletedSystem = await System.findByIdAndDelete(id);
    if (!deletedSystem) {
      return res.status(404).json({ message: "System not found" });
    }
    return res.status(200).json({ message: "System deleted successfully" });
  } catch (error) {
    console.error("Error deleting system:", error);
    return res.status(500).json({ message: "Failed to delete system" });
  }
});

router.get("/requests", async (req, res) => {
  try {
    const requests = await vmRequest
      .find({ status: "Pending" })
      .populate("productMongoID")
      .populate("serviceMongoID")
      .populate("relatedUser")
      .sort({ createdAt: -1 });
    return res.status(200).json(requests);
  } catch (error) {
    console.error("Error fetching requests:", error);
    return res.status(500).json({ message: "Failed to fetch requests" });
  }
});

router.get("/request", async (req, res) => {
  try {
    const { requestId } = req.query;
    if (!requestId) {
      return res.status(400).json({ message: "ID is required" });
    }
    const request = await vmRequest
      .findById(requestId)
      .populate("productMongoID")
      .populate("serviceMongoID")
      .populate("relatedUser");
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }
    return res.status(200).json(request);
  } catch (error) {
    console.error("Error fetching request:", error);
    return res.status(500).json({ message: "Failed to fetch request" });
  }
});

router.post("/update_service", async (req, res) => {
  try {
    const {
      serviceId,
      terminate,
      terminationReason,
      ipAddress,
      username,
      password,
      vmID,
      EXTRLhash,
      expiryDate,
      productId,
      purchedFrom,
      relatedUser,
    } = req.body;
    if (!serviceId) {
      return res.status(400).json({ message: "Service ID is required" });
    }
    // console.log(req.body)
    // return res.status(400).json({messgae:" this is a dummy data."})
    if (terminate && !terminationReason) {
      return res
        .status(400)
        .json({ message: "Termination reason is required" });
    }
    const updateFields = {};
    if (terminate) {
      updateFields.status = "terminated";
      updateFields.terminationDate = new Date();
      updateFields.terminationReason = terminationReason;
    } else if (terminate === false) {
      updateFields.status = "active";
      updateFields.terminationDate = null;
      updateFields.terminationReason = null;
    }
    if (ipAddress) updateFields.ipAddress = ipAddress;
    if (username) updateFields.username = username;
    if (password) updateFields.password = password;
    if (vmID) updateFields.vmID = vmID;
    if (EXTRLhash) updateFields.EXTRLhash = EXTRLhash;
    if (purchedFrom) updateFields.purchedFrom = purchedFrom;
    if (expiryDate) {
      updateFields.expiryDate = expiryDate;
      if (new Date(expiryDate) < new Date()) {
        updateFields.status = "expired";
        updateFields.terminationDate = new Date();
        updateFields.terminationReason = "expired";
      } else {
        updateFields.status = "active";
        updateFields.terminationDate = null;
        updateFields.terminationReason = null;
      }
    }
    if (relatedUser) {
      const userExists = await User.findById(relatedUser);
      if (userExists) {
        updateFields.relatedUser = userExists._id;
        updateFields.status = "active";
        if (!expiryDate) {
          updateFields.expiryDate = new Date(
            new Date().setDate(new Date().getDate() + 30)
          );
        }
      }
    }
    if (productId) {
      const plan = await Plan.findOne({ productId: productId });
      if (plan) updateFields.relatedProduct = plan._id;
    }
    const updatedService = await Service.findOneAndUpdate(
      { serviceId: serviceId },
      { $set: updateFields },
      { new: true }
    )
      .populate("relatedProduct")
      .populate("relatedUser");
    if (!updatedService) {
      return res.status(404).json({ message: "Service not found" });
    }
    return res.status(200).json({
      success: true,
      message: "Service updated successfully",
      service: {
        ...updatedService.toObject(),
        vmStatus:
          terminate === false ||
            (expiryDate && new Date(expiryDate) > new Date())
            ? "running"
            : updatedService.status,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update service" });
  }
});

router.post("/process_request", async (req, res) => {
  try {
    const { requestId, approve } = req.body;
    if (!requestId) {
      return res.status(400).json({ message: "Request ID is required" });
    }
    const request = await vmRequest
      .findById(requestId)
      .populate("serviceMongoID")
      .populate("productMongoID")
      .populate("relatedUser");
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }
    request.status = approve ? "Approved" : "Rejected";
    const value = {};
    const service = await Service.findById(request.serviceMongoID);
    if (request?.requestType === "Service") {
      if ((service.status = approve)) {
        service.status = "active";
        service.terminationDate = null;
        service.terminationReason = null;
      }
      service.expiryDate = new Date(
        new Date().setDate(new Date().getDate() + 30)
      );
      await service.save();
      value.title = approve
        ? "Service activation Approved"
        : "Service activation Rejected";
      value.message = approve
        ? `Your service has been activated successfully.`
        : `Your service has been rejected. Price has been refunded to your account.`;
    }
    if (request?.requestType === "Renew") {
      if (approve) {
        service.status = "active";
        service.terminationDate = null;
        service.terminationReason = null;
        service.expiryDate = new Date(
          new Date().setDate(new Date().getDate() + 30)
        );
        await service.save();
        value.title = "Renewal Approved";
        value.message = `Your service has been renewed successfully.`;
      } else {
        service.status = "expired";
        if (new Date(service.expiryDate) > new Date())
          service.expiryDate = new Date(
            new Date().setDate(new Date().getDate() - 1)
          );
        const user = await User.findById(service.relatedUser);
        user.balance += request.productMongoID.price;
        await user.save();
        await service.save();
        value.title = "Renewal Rejected";
        value.message = `Your service has been rejected.`;
      }
    } else {
      value.title = approve ? "Rebuild Approved" : "Rebuild Rejected";
      value.message = approve
        ? `Your service has been rebuilt successfully.`
        : `Your rebuild request has been rejected.`;
    }
    const newNotification = new Notification({
      userId: request.relatedUser,
      status:
        !approve && request?.requestType === "Renew"
          ? "Warning"
          : approve
            ? "success"
            : "error",
      ...value,
    });
    await newNotification.save();
    notify({
      userId: request.relatedUser,
      status: updateFields.balance < existinguser.balance ? "error" : "success",
      ...value,
    });
    await request.save();
    return res.status(200).json({
      success: true,
      request: request,
      message: `Request ${approve ? "approved" : "rejected"} successfully`,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Failed to process request" });
  }
});

router.post("/create_invoice", async (req, res) => {
  try {
    const { email, amount, invoiceType, isPaid } = req.body;
    const user = await User.findOne({ email: email });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    let newTransactionId = `TRN${crypto.randomInt(1000000000, 9999999999)}`;
    let existingTransaction;
    do {
      newTransactionId = `TRN${crypto.randomInt(1000000000, 9999999999)}`;
      existingTransaction = await Transaction.findOne({
        transactionId: newTransactionId,
      });
    } while (existingTransaction);
    const getLastPhonepeTransaction = await Payment.findOne({
      paymentType: { $in: ["Phonepe", "Bank_Transfer"] },
    }).sort({
      createdAt: -1,
    });
    let generatedInvoiceId;
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const day = now.getDate().toString().padStart(2, "0");

    if (getLastPhonepeTransaction && getLastPhonepeTransaction.invoiceId) {
      const parts = getLastPhonepeTransaction.invoiceId.split("-");
      let lastSerial = 1;
      if (parts.length === 5 && !isNaN(parseInt(parts[4]))) {
        lastSerial = parseInt(parts[4]) + 1;
      }
      generatedInvoiceId = `INV-${year}-${month}-${day}-${String(
        lastSerial
      ).padStart(8, "0")}`;
    } else {
      generatedInvoiceId = `INV-${year}-${month}-${day}-00000001`;
    }
    if (isPaid) {
      // const payment = new Payment({
      //   invoiceId:generatedInvoiceId,
      //   transactionId: newTransactionId,
      //   user: user._id,
      //   paymentType: "Bank_Transfer",
      //   Price: amount,
      // coinAmout
      //   invoicetype: invoiceType,
      //   status: isPaid ? "Success" : "Pending",
      // });
      // await payment.save();
      // if (invoiceType === "Inclusive") {
      const payment = new Payment({
        invoiceId: generatedInvoiceId,
        transactionID: newTransactionId,
        user: user._id,
        paymentType: "Bank_Transfer",
        Price: amount,
        coinAmout:
          invoiceType === "Inclusive"
            ? amount
            : Number(Number(amount) / 1.18).toFixed(2),
        invoicetype: invoiceType,
        status: isPaid ? "Success" : "Pending",
      });
      await payment.save();
      const transaction = new Transaction({
        transactionId: newTransactionId,
        user: user._id,
        amount: invoiceType === "Inclusive" ? amount : Number(amount) / 1.18,
        type: "Bank_Transfer",
        description: `Custom Package Purchase`,
      });
      const Formatedtoday = () => {
        return new Date(Date.now()).toLocaleDateString("en-GB", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      };
      const subTotalInNumber = parseFloat(amount);
      const actualPrice = subTotalInNumber / 1.18;
      const uploadToExcel = async () => {
        try {
          await axios.post(
            `https://docs.google.com/forms/d/e/1FAIpQLSfzP9YAoLH08MLZUO-LtlCpR2lTCOIF9Bfn-lgv-YPxDrm48A/formResponse?&submit=Submit?usp=pp_url&entry.1888128289=${Formatedtoday()}&entry.824453820=${payment?.invoiceId
            }&entry.897584116=${user?.address?.state
            }&entry.1231415132=18%25&entry.1207835655=${actualPrice.toFixed(
              2
            )}&entry.978406635=${user?.address?.state === "UP"
              ? ((subTotalInNumber - actualPrice) / 2).toFixed(2)
              : ""
            }&entry.555025617=${user?.address?.state === "UP"
              ? ((subTotalInNumber - actualPrice) / 2).toFixed(2)
              : ""
            }&entry.1209097425=${user?.address?.state !== "UP"
              ? (subTotalInNumber - actualPrice).toFixed(2)
              : ""
            }&entry.723332171=${subTotalInNumber.toFixed(2)}`
          );
        } catch (error) { }
      };
      uploadToExcel();
      await transaction.save();
      user.balance += Number(amount);
      await user.save();
      notify({
        userId: user?._id,
        status: "success",
        title: "Custom Package Purchased",
        message: `You have successfully purchased a custom package.`,
      });
      const notification = new Notification({
        userId: user?._id,
        status: "success",
        title: "Custom Package Purchased",
        message: `You have successfully purchased a custom package.`,
      });
      await notification.save();
    } else {
      const payment = new Payment({
        invoiceId: generatedInvoiceId,
        transactionID: newTransactionId,
        user: user._id,
        paymentType: "Bank_Transfer",
        Price:
          invoiceType === "Inclusive"
            ? amount
            : Number(amount) + Number(amount) * 0.18,
        coinAmout: amount,
        invoicetype: invoiceType,
        status: isPaid ? "Success" : "Pending",
      });
      await payment.save();
    }
    return res
      .status(200)
      .json({ success: true, message: "Invoice created successfully" });
  } catch (error) {
    console.error("Error creating invoice:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create invoice" });
  }
});

router.get("/search_user_by_email", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ message: "Email parameter is required" });
    }

    const users = await User.find({
      email: { $regex: email, $options: "i" },
      role: { $ne: "admin" }, // Exclude admin roles
    }).select("email firstName lastName _id");
    // console.log(users)
    return res.status(200).json(users);
  } catch (error) {
    console.error("Error searching users by email:", error);
    return res.status(500).json({ message: "Failed to search users" });
  }
});

router.get("/search_productid", async (req, res) => {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ message: "Email parameter is required" });
    }
    const product = await Plan.find({
      productId: { $regex: id, $options: "i" },
    });
    return res.status(200).json(product);
  } catch (error) {
    console.error("Error searching users by email:", error);
    return res.status(500).json({ message: "Failed to search users" });
  }
});

router.get("/get_user_transation", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }
    const transactions = await Transaction.find({ user: userId });
    return res.status(200).json(transactions);
  } catch (error) {
    console.error("Error searching users by email:", error);
    return res.status(500).json({ message: "Failed to search users" });
  }
});

router.get("/transactions", async (req, res) => {
  try {
    const transactions = await Transaction.find().populate("planId").populate("user");
    return res.status(200).json(transactions);
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return res.status(500).json({ message: "Failed to fetch transactions" });
  }
});

module.exports = router;
