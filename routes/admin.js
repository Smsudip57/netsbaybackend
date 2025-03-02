const express = require("express");
const User = require("../models/user");
const Service = require("../models/service");
const Plan = require("../models/plan");
const crypto = require("crypto");
const { default: mongoose } = require("mongoose");
const Announcement = require("../models/announcements");
const Coupon = require("../models/coupon");
const router = express.Router();

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
    const { userId, balance, isBanned, revokedService } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const updateFields = {};
    if (balance !== undefined) updateFields.balance = balance;
    if (isBanned !== undefined) updateFields.isBanned = isBanned;
    if (revokedService !== undefined)
      updateFields.revokedService = revokedService;

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
    const deletedPlan = await Plan.findOneAndDelete({ productId: productId });
    if (!deletedPlan) {
      return res.status(404).json({ message: "Plan not found" });
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
    } = req.body;

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
      Stock === undefined
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
})

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
        return res
          .status(400)
          .json({
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

module.exports = router;
