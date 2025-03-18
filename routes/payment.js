const crypto = require("crypto");
const axios = require("axios");
const express = require("express");
const router = express.Router();
const uniqid = require("uniqid");

// UAT environment configuration
const MERCHANT_ID = "M1FB2SUH7ZNA";
const PHONE_PE_HOST_URL = "https://api-preprod.phonepe.com/apis/pg-sandbox";
const SALT_INDEX = 1;
const SALT_KEY = "93ffd3df-d4bc-48f7-926a-36da8b16dd42";
const APP_BE_URL = process.env.Current_Url; // Your backend URL

// Endpoint to initiate a payment
router.post("/new_payment", async (req, res) => {
  try {
    const amount = req.body.amount || 100; // Default to 100 if not provided
    
    // You can get userId from your authentication middleware
    const userId = req.body.userId || "MUID123";
    
    // Generate a unique merchant transaction ID
    const merchantTransactionId = uniqid();
    
    // Prepare payload for PhonePe
    const normalPayLoad = {
      merchantId: MERCHANT_ID,
      merchantTransactionId: merchantTransactionId,
      merchantUserId: userId,
      amount: amount * 100, // Converting to paise
      redirectUrl: `${APP_BE_URL}/api/payment/status/${merchantTransactionId}`,
      redirectMode: "REDIRECT",
      mobileNumber: req.body.mobileNumber || "9999999999",
      paymentInstrument: {
        type: "PAY_PAGE",
      },
    };

    // Convert payload to base64
    const bufferObj = Buffer.from(JSON.stringify(normalPayLoad), "utf8");
    const base64EncodedPayload = bufferObj.toString("base64");
    
    // Generate X-VERIFY checksum
    const string = base64EncodedPayload + "/pg/v1/pay" + SALT_KEY;
    const sha256_val = crypto.createHash("sha256").update(string).digest("hex");
    const xVerifyChecksum = sha256_val + "###" + SALT_INDEX;

    // Make API call to PhonePe
    const response = await axios.post(
      `${PHONE_PE_HOST_URL}/pg/v1/pay`,
      {
        request: base64EncodedPayload,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-VERIFY": xVerifyChecksum,
          accept: "application/json",
        },
      }
    );

    // Return the redirect URL to the client
    return res.status(200).json({
      success: true,
      redirectUrl: response.data.data.instrumentResponse.redirectInfo.url,
      merchantTransactionId: merchantTransactionId
    });
  } catch (error) {
    console.error("Error initiating payment:", error);
    return res.status(500).json({
      message: error.message || "Failed to initiate payment",
      error: error,
      success: false,
    });
  }
});

// Endpoint to validate payment status
router.get("/status/:merchantTransactionId", async (req, res) => {
  try {
    const { merchantTransactionId } = req.params;
    
    if (!merchantTransactionId) {
      return res.status(400).json({ message: "Transaction ID is required" });
    }
    
    const statusUrl = `${PHONE_PE_HOST_URL}/pg/v1/status/${MERCHANT_ID}/${merchantTransactionId}`;
    
    // Generate X-VERIFY checksum for status check
    const string = `/pg/v1/status/${MERCHANT_ID}/${merchantTransactionId}${SALT_KEY}`;
    const sha256_val = crypto.createHash("sha256").update(string).digest("hex");
    const xVerifyChecksum = sha256_val + "###" + SALT_INDEX;
    
    // Make API call to check payment status
    const response = await axios.get(statusUrl, {
      headers: {
        "Content-Type": "application/json",
        "X-VERIFY": xVerifyChecksum,
        "X-MERCHANT-ID": MERCHANT_ID,
        accept: "application/json",
      },
    });
    
    // Process response
    if (response.data && response.data.code === "PAYMENT_SUCCESS") {
      // Payment was successful
      return res.redirect("http://localhost:3000/success");
    } else {
      // Payment failed or is pending
      return res.redirect("http://localhost:3000/failure");
    }
  } catch (error) {
    console.error("Error checking payment status:", error);
    return res.status(500).json({
      message: error.message || "Failed to check payment status",
      success: false,
    });
  }
});

module.exports = router;