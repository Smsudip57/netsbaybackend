const crypto = require("crypto");
const axios = require("axios");
const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const router = express.Router();
const uniqid = require("uniqid");
const Transaction = require("../models/transaction");

// UAT environment configuration
const MERCHANT_ID = "M1FB2SUH7ZNA";
const PHONE_PE_HOST_URL = "https://api.phonepe.com/apis/hermes";
const SALT_INDEX = 1;
const SALT_KEY = "93ffd3df-d4bc-48f7-926a-36da8b16dd42";
const APP_BE_URL = process.env.Client_Url; 
const taxGst = .18;
const Inrperusd = 86;

const package = [
  { id: 1, coins: 200, priceINR: 200, priceUSD: (200 / Inrperusd).toFixed(2) },
  { id: 2, coins: 500, priceINR: 500, priceUSD: (500 / Inrperusd).toFixed(2) },
  { id: 3, coins: 1000, priceINR: 1000, priceUSD: (1000 / Inrperusd).toFixed(2) },
  { id: 4, coins: 2000, priceINR: 2000, priceUSD: (2000 / Inrperusd).toFixed(2) },
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
router.post("/new_payment", async (req, res) => {
  try {
    const { type, package : packageid, userId, mobileNumber } = req.body;
    if (!packageid || !type) {
      return res
        .status(400)
        .json({ message: "Invalid payment details" });
    }

    const amount = package.find((p) => p.id === packageid).priceINR ;
    const usdAmount = package.find((p) => p.id === packageid).priceUSD ;
    // const amount = 5;

    //generat is like this TRN3481423985 with crypto
    let merchantTransactionId;
    let exists = true;
    while (exists) {
      const tenDigitCode = crypto.randomInt(1000000000, 9999999999);
      merchantTransactionId = `TRN${tenDigitCode}`;
      exists = await Transaction.findOne({
        transactionId: merchantTransactionId,
      });
    }

   if(type ==="upi"){
    const normalPayLoad = {
      merchantId: MERCHANT_ID,
      merchantTransactionId: merchantTransactionId,
      merchantUserId: userId,
      amount: ((amount * 100)+ (amount * 100 * taxGst)).toFixed(2),
      redirectUrl: `${APP_BE_URL}/payment/status/${merchantTransactionId}`,
      redirectMode: "REDIRECT",
      mobileNumber: req.body.mobileNumber || "9793741405",
      paymentInstrument: {
        type: "PAY_PAGE",
      },
    };
    const bufferObj = Buffer.from(JSON.stringify(normalPayLoad), "utf8");
    const base64EncodedPayload = bufferObj.toString("base64");
    const string = base64EncodedPayload + "/pg/v1/pay" + SALT_KEY;
    const sha256_val = crypto.createHash("sha256").update(string).digest("hex");
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
   }else if(type === "card") {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${package.find(p => p.id === packageid).coins} Coins Package`,
              description: 'Digital coins for your account',
            },
            unit_amount: Math.round(usdAmount * 100) + Math.round(usdAmount * 100 * taxGst),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.Client_Url}/payment/success?session_id={CHECKOUT_SESSION_ID}&txn=${merchantTransactionId}`,
      cancel_url: `${process.env.Client_Url}/payment/cancel?txn=${merchantTransactionId}`,
      metadata: {
        package: packageid.toString(),
        transactionId: merchantTransactionId,
        userId: userId || "guest"
      },
      client_reference_id: merchantTransactionId,
    });
    
    return res.status(200).json({
      success: true,
      sessionId: session.id,
      redirectUrl: session.url,
    });
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

router.get("/status/:merchantTransactionId", async (req, res) => {
  try {
    const { merchantTransactionId } = req.params;

    if (!merchantTransactionId) {
      return res.status(400).json({ message: "Transaction ID is required" });
    }
   try {

    const statusUrl = `${PHONE_PE_HOST_URL}/pg/v1/status/${MERCHANT_ID}/${merchantTransactionId}`;
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
      throw new Error("Payment failed");
    }
   } catch (error) {
    //check for stipe here
   }
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
    const authHeader = req.headers['Authorization'];
    if (!authHeader) {
      return res.status(401).json({ status: "FAILED", message: "Authorization header missing" });
    }
    
    const username = "your_configured_username"; 
    const password = "your_configured_password"; 
    
    const expectedAuth = crypto.createHash('sha256')
      .update(`${username}:${password}`)
      .digest('hex');
    
    if (authHeader !== expectedAuth) {
      return res.status(401).json({ status: "FAILED", message: "Invalid authorization" });
    }
    
    const payload = req.body.payload;
    
    if (req.body.event === "checkout.order.completed" && payload.state === "COMPLETED") {
      const merchantTransactionId = payload.merchantOrderId;
      const amount = payload.amount / 100; // Convert from paise to rupees
      
      // Update transaction status
      const transaction = await Transaction.findOne({ transactionId: merchantTransactionId });
      
      if (transaction) {
        transaction.status = 'completed';
        transaction.lastUpdated = new Date();
        transaction.amount = amount;
        // Save additional data if needed
        if (payload.paymentDetails && payload.paymentDetails.length > 0) {
          transaction.paymentId = payload.paymentDetails[0].transactionId;
          transaction.paymentMode = payload.paymentDetails[0].paymentMode;
        }
        await transaction.save();
        
        // Update user balance if needed
        // This depends on your application logic
        
        console.log(`Transaction ${merchantTransactionId} completed successfully`);
      } else {
        console.error(`Transaction ${merchantTransactionId} not found in database`);
      }
      
      return res.status(200).json({ status: "SUCCESS" });
    } else if (req.body.event === "checkout.order.failed") {
      const merchantTransactionId = payload.merchantOrderId;
      
      // Update transaction as failed
      await Transaction.updateOne(
        { transactionId: merchantTransactionId },
        { 
          status: 'failed',
          failureReason: payload.state || 'Payment Failed',
          lastUpdated: new Date()
        }
      );
      
      return res.status(200).json({ status: "ACKNOWLEDGED" });
    } else {
      // Handle other events like refunds
      console.log(`Received event: ${req.body.event} with state: ${payload.state}`);
      return res.status(200).json({ status: "ACKNOWLEDGED" });
    }
  } catch (error) {
    console.error("Error in PhonePe callback:", error);
    return res.status(500).json({ status: "ERROR", message: error.message });
  }
});




router.post("/stripe_webhook", async (req, res) => {
  const webhookSecret = "whsec_45074fb164f37434a6b09be0a10a2e2b706d46247b93ce61000760b29c4edaec";
  try {
    const signature = req.headers['stripe-signature'];
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
      case 'checkout.session.completed':
        const paymentIntent = event.data.object;
        await handleSuccessfulPayment(paymentIntent);
        break;
        
      case 'payment_intent.payment_failed':
        const failedPaymentIntent = event.data.object;
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }
    res.status(200).json({received: true});
    
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({error: 'Webhook processing failed'});
  }
});

async function handleSuccessfulPayment(paymentIntent) {
  try {
    const { transactionId } = paymentIntent.metadata;
    console.log(paymentIntent.metadata);
    // const transaction = new Transaction({ 
    //   transactionId,
    //   amount: paymentIntent.amount / 100,
    //   status: 'completed',
    //   paymentMethod: 'stripe',
    //  });
    //   await transaction.save();
  } catch (error) {
    console.error('Error handling successful payment:', error);
  }
}


module.exports = router;
