const crypto = require("crypto");
const axios = require("axios");
const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const router = express.Router();
const uniqid = require("uniqid");
const Transaction = require("../models/transaction");
const { adminAuth, userAuth } = require("../middlewares/Auth");
const User = require("../models/user");
const Payment = require("../models/payment");

const secretpassword = "MynameIsSudip";
const MERCHANT_ID = "M1FB2SUH7ZNA";
const PHONE_PE_HOST_URL = "https://api.phonepe.com/apis/hermes";
const SALT_INDEX = 1;
const SALT_KEY = "93ffd3df-d4bc-48f7-926a-36da8b16dd42";
const APP_BE_URL = process.env.Client_Url;
const taxGst = 0.18;
const Inrperusd = 86;

const package = [
  { id: 1, coins: 200, priceINR: 200, priceUSD: (200 / Inrperusd).toFixed(2) },
  { id: 2, coins: 500, priceINR: 500, priceUSD: (500 / Inrperusd).toFixed(2) },
  {
    id: 3,
    coins: 1000,
    priceINR: 1000,
    priceUSD: (1000 / Inrperusd).toFixed(2),
  },
  {
    id: 4,
    coins: 2000,
    priceINR: 2000,
    priceUSD: (2000 / Inrperusd).toFixed(2),
  },
];

router.get("/packages", async (req, res) => {
  try {
    return res.status(200).json({ success: true, packages: package });
  } catch (error) {
    console.error("Error fetching packages:", error);
    return res.status(500).json({ message: "Failed to fetch packages" });
  }
});

// Endpoint to initiate a payment
router.post("/new_payment", userAuth, async (req, res) => {
  try {
    const { type, package: packageid, userId, mobileNumber } = req.body;
    if (!packageid || !type) {
      return res.status(400).json({ message: "Invalid payment details" });
    }

    const amount = package.find((p) => p.id === packageid).priceINR;
    // const usdAmount = package.find((p) => p.id === packageid).priceUSD;
    // const amount = 1.1;
    const usdAmount = 1.5;
    if (!amount || !usdAmount) {
      return res.status(400).json({ message: "Invalid package" });
    }

    //generat is like this TRN3481423985 with crypto
    let merchantTransactionId;
    let exists = true;
    while (exists) {
      const tenDigitCode = crypto.randomInt(1000000000, 9999999999);
      merchantTransactionId = `TRN${tenDigitCode}`;
      exists = await Transaction.findOne({
        transactionId: merchantTransactionId,
      });
      exists = await Payment.findOne({
        transactionID: merchantTransactionId,
      });
    }

    if (type === "upi") {
      const normalPayLoad = {
        merchantId: MERCHANT_ID,
        merchantTransactionId: merchantTransactionId,
        merchantUserId: userId,
        amount: Number((amount * 100 + amount * 100 * taxGst).toFixed(2)),
        redirectUrl: `${APP_BE_URL}/payment/status?txn=${merchantTransactionId}`,
        callbackUrl: `${process.env.Current_Url}/api/payment/phonepay_webhook?userId=${userId}&package=${packageid}`,
        redirectMode: "REDIRECT",
        mobileNumber: req.body.mobileNumber || "9793741405",
        paymentInstrument: {
          type: "PAY_PAGE",
          user: req?.user?._id,
        },
      };
      const bufferObj = Buffer.from(JSON.stringify(normalPayLoad), "utf8");
      const base64EncodedPayload = bufferObj.toString("base64");
      const string = base64EncodedPayload + "/pg/v1/pay" + SALT_KEY;
      const sha256_val = crypto
        .createHash("sha256")
        .update(string)
        .digest("hex");
      const xVerifyChecksum = sha256_val + "###" + SALT_INDEX;

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

      return res.status(200).json({
        success: true,
        redirectUrl: response.data.data.instrumentResponse.redirectInfo.url,
        merchantTransactionId: merchantTransactionId,
      });
    } else if (type === "card") {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `${
                  package.find((p) => p.id === packageid).coins
                } Coins Package`,
                description: "Digital coins for your account",
              },
              unit_amount:
                Math.round(usdAmount * 100) +
                Math.round(usdAmount * 100 * taxGst),
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${APP_BE_URL}/payment/status?session_id={CHECKOUT_SESSION_ID}&txn=${merchantTransactionId}`,
        cancel_url: `${APP_BE_URL}/payment/status?txn=${merchantTransactionId}`,
        metadata: {
          package: packageid,
          transactionId: merchantTransactionId,
          userId: userId || "guest",
        },
        client_reference_id: merchantTransactionId,
      });

      return res.status(200).json({
        success: true,
        sessionId: session.id,
        redirectUrl: session.url,
      });
    } else if (type === "crypto") {
      try {
        const { currency } = req.body;
        // || !["DOGE", "TRX", "LTC", "USDT" ].includes(currency)
        if (!amount || amount <= 0) {
          return res
            .status(400)
            .json({ success: false, message: "Invalid request" });
        }

        const additionalData = JSON.stringify({
          userId: req.user._id,
          package: packageid,
        });

        const paymentData = {
          amount: Number(usdAmount + usdAmount * taxGst).toFixed(2),
          currency: "USDT",
          order_id: merchantTransactionId,
          to_currency: "LTC",
          lifetime: 3600,
          additional_data: additionalData,
          url_success: `${APP_BE_URL}/payment/status?txn=${merchantTransactionId}`,
          url_failure: `${APP_BE_URL}/payment/status?txn=${merchantTransactionId}`,
          url_callback: `${process.env.Current_Url}/api/payment/cryptomous_hook?userId=${userId}&package=${packageid}`,
        };
        const jsonString = JSON.stringify(paymentData);
        const base64Data = Buffer.from(jsonString).toString("base64");
        const apiKey =
          "O4zKwImbVgLfj6slTSkxvOz4gbeuWyOa0119Ttjqu5qCxQkhxIjJTzlkeHWseVlycKJ3V352ZgRtVhpk7GmsT6WhQTpwIZ6Vr0khmGWKH0pSKJtrCCYvgU9NtR9Vj40z";
        const sign = crypto
          .createHash("md5")
          .update(base64Data + apiKey)
          .digest("hex");
        const response = await axios.post(
          "https://api.cryptomus.com/v1/payment",
          paymentData,
          {
            headers: {
              "Content-Type": "application/json",
              merchant: "0e69ee46-304f-41b2-a6d4-3b57550af545",
              sign: sign,
            },
          }
        );
        return res
          .status(200)
          .json({ success: true, url: response?.data?.result?.url });
      } catch (error) {
        console.error("Error creating payment link:", error);
        return res
          .status(500)
          .json({ success: false, message: "Something went wrong" });
      }
    }
  } catch (error) {
    console.error("Error initiating payment:", error);
    return res.status(500).json({
      message: error.message || "Failed to initiate payment",
      error: error,
      success: false,
    });
  }
});

router.get("/status", async (req, res) => {
  try {
    const { merchantTransactionId } = req.query;

    if (!merchantTransactionId) {
      return res.status(400).json({ message: "Transaction ID is required" });
    }
    const transaction = await Transaction.findOne({
      transactionId: merchantTransactionId,
    });
    if (!transaction) {
      return res
        .status(200)
        .json({ success: false, message: "Transaction not found" });
    }
    return res.status(200).json({ success: true, transaction });
  } catch (error) {
    console.error("Error checking payment status:", error);
    return res.status(500).json({
      message: error.message || "Failed to check payment status",
      success: false,
    });
  }
});

router.post("/phonepay_webhook", async (req, res) => {
  try {
    const { userId: user_id, package: packageId } = req.query;
    const packageDetails = package.find(
      (p) => p.id === parseInt(packageId)
    )?.coins;
    if (!packageDetails) {
      throw new Error("Invalid package selected.");
    }
    const authHeader = req.headers["x-verify"];
    if (!authHeader) {
      return res
        .status(401)
        .json({ status: "FAILED", message: "Authorization header missing" });
    }
    const [checksum, saltIndex] = authHeader.split("###");
    const { response: base64Response } = req.body;
    const decodedString = Buffer.from(base64Response, "base64").toString(
      "utf8"
    );
    const jsonResponse = JSON.parse(decodedString);
    const stringToHash = base64Response + SALT_KEY;
    const recalculatedChecksum = crypto
      .createHash("sha256")
      .update(stringToHash)
      .digest("hex");

    if (recalculatedChecksum !== checksum) {
      console.log("Checksum verification failed");
      return res
        .status(401)
        .json({ status: "FAILED", message: "Checksum verification failed" });
    }

    if (jsonResponse.success && jsonResponse.code === "PAYMENT_SUCCESS") {
      try {
        const transaction = new Transaction({
          transactionId: jsonResponse.data.merchantTransactionId,
          amount: packageDetails,
          type: "PhonePe",
          user: user_id,
          description: "Package purchase",
        });

        await transaction.save();
        const payment = new Payment({
          transactionID: jsonResponse.data.merchantTransactionId,
          paymentType: "Phonepe",
          user: user_id,
          coinAmout: packageDetails,
          Price: Number(jsonResponse.data.amount) / 100,
        });

        await payment.save();
      } catch (error) {
        console.log(error);
      }
      const userfromDb = await User.findById(user_id);
      userfromDb.balance += Number(packageDetails);
      await userfromDb.save();
      return res.status(200).json({ status: "SUCCESS" });
    } else {
      return res.status(200).json({ status: "FAILED" });
    }
  } catch (error) {
    console.error("Error in PhonePe callback:", error);
    return res.status(500).json({ status: "ERROR", message: error.message });
  }
});

router.post("/stripe_webhook", async (req, res) => {
  const webhookSecret = "whsec_LhZmMs4LqDxgRGVE8jETAlrHGhZUrkwO";
  try {
    const signature = req.headers["stripe-signature"];
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        webhookSecret
      );
    } catch (err) {
      console.error(`Webhook signature verification failed: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    switch (event.type) {
      case "checkout.session.completed":
        const paymentIntent = event.data.object;
        await handleSuccessfulPayment(paymentIntent);
        break;

      case "payment_intent.payment_failed":
        const failedPaymentIntent = event.data.object;
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }
    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

async function handleSuccessfulPayment(paymentIntent) {
  try {
    const { transactionId } = paymentIntent.metadata;
    const transaction = new Transaction({
      transactionId,
      amount: paymentIntent.amount / 100,
      status: "completed",
      user: paymentIntent.metadata.userId,
      description: "Package purchase",
      type: "stripe",
    });
    await transaction.save();
  } catch (error) {
    console.error("Error handling successful payment:", error);
  }
}

router.get("/hook_test", async (req, res) => {
  try {
    let merchantTransactionId;
    let exists = true;
    while (exists) {
      const tenDigitCode = crypto.randomInt(1000000000, 9999999999);
      merchantTransactionId = `TRN${tenDigitCode}`;
      exists = await Transaction.findOne({
        transactionId: merchantTransactionId,
      });
      exists = await Payment.findOne({
        transactionID: merchantTransactionId,
      });
    }
    const paymentData = {
      uuid: "e1830f1b-50fc-432e-80ec-15b58ccac867",
      currency: "USDT",
      url_callback: `https://api.netbay.in/api/payment/cryptomous_hook?userId=67edb8dc0a1861ff8dcd61f7&package=${1}`,
      network: "tron",
      status: "paid",
      order_id: merchantTransactionId,
      // additional_data: additionalData,
    };
    const jsonString = JSON.stringify(paymentData);
    const base64Data = Buffer.from(jsonString).toString("base64");
    const apiKey =
      "O4zKwImbVgLfj6slTSkxvOz4gbeuWyOa0119Ttjqu5qCxQkhxIjJTzlkeHWseVlycKJ3V352ZgRtVhpk7GmsT6WhQTpwIZ6Vr0khmGWKH0pSKJtrCCYvgU9NtR9Vj40z";
    const sign = crypto
      .createHash("md5")
      .update(base64Data + apiKey)
      .digest("hex");
    console.log(sign);
    const response = await axios.post(
      "https://api.cryptomus.com/v1/test-webhook/payment",
      paymentData,
      {
        headers: {
          "Content-Type": "application/json",
          merchant: "0e69ee46-304f-41b2-a6d4-3b57550af545",
          sign: sign,
        },
      }
    );
    console.log(response.data);
    res.status(200).json(response.data);
  } catch (error) {
    console.error("Error in hook test:", error);
    res.status(500).json(error?.data?.response?.data);
  }
});

router.post("/cryptomous_hook", async (req, res) => {
  try {
    const payload = req.body;
    const { sign: signature } = req.body;
    const payloadCopy = { ...payload };
    if (payloadCopy?.sign) delete payloadCopy.sign;
    const data = Buffer.from(JSON.stringify(payloadCopy)).toString("base64");
    const apiKey =
      "O4zKwImbVgLfj6slTSkxvOz4gbeuWyOa0119Ttjqu5qCxQkhxIjJTzlkeHWseVlycKJ3V352ZgRtVhpk7GmsT6WhQTpwIZ6Vr0khmGWKH0pSKJtrCCYvgU9NtR9Vj40z";
    const calculatedSignature = crypto
      .createHash("md5")
      .update(data + apiKey)
      .digest("hex");
    if (calculatedSignature !== signature) {
      return res.status(403).json({
        success: false,
        message: "Invalid signature",
      });
    }
    console.log("Payment notification received:", payload);
    const { order_id, status, amount, currency } = payload;

    const { userId, package: packageId } = req.query;
    if (!package || !userId) {
      return res.status(403).json({
        success: false,
        message: "Invalid additional data",
      });
    }
    
    const packageCoins = package.find(
      (p) => p.id === parseInt(packageId)
    )?.coins;
    if (!packageCoins) {
      return res.status(403).json({
        success: false,
        message: "Invalid package selected.",
      });
    }
console.log(packageCoins);
    if (["paid", "paid_over", "wrong_amount"].includes(status) && packageCoins) {
      console.log(packageCoins);
      let transaction = await Transaction.findOne({ transactionId: order_id });
      if (!transaction) {
        console.log(packageCoins);
        transaction = new Transaction({
          transactionId: order_id,
          amount: packageCoins,
          user: userId,
          type: "Crypto",
          description: "Package purchase",
        });
        await transaction.save();
      } else {
        return res.status(200).json({
          success: true,
          message: "Webhook processed successfully",
        });
      }
      
      const user = await User.findById(transaction.userId);
      if (user) {
        user.balance = (parseFloat(user.balance) || 0) + parseFloat(amount);
        await user.save();
      }
    }

    // Send response to Cryptomus
    return res.status(200).json({
      success: true,
      message: "Webhook processed successfully",
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(500).json({
      success: false,
      message: "Error processing webhook",
    });
  }
});

module.exports = router;
