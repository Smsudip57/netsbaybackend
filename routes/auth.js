const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const router = express.Router();
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const JWT_SECRET = process.env.JWT_SECRET;

const transporter = nodemailer.createTransport({
  host: "server.netbay.in",
  port: 465,
  secure: true,
  auth: {
    user: "noreply@netbay.in",
    pass: "NU*rJv+Ql_Ag",
  },
});

async function sendVerificationEmail(toEmail, verificationCode) {
  try {
    const mailOptions = {
      from: '"Netbay Support" <noreply@netbay.in>',
      to: toEmail,
      subject: "Your Verification Code",
      text: `Your verification code is: ${verificationCode}`,
      html: `<!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Your Email Verification Code</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0;
          background-color: #f9f9f9;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #ffffff;
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          padding: 20px 0;
          border-bottom: 1px solid #eee;
        }
        .logo {
          max-width: 150px;
          margin: 0 auto;
          display: block;
        }
        .content {
          padding: 30px 20px;
          text-align: center;
        }
        .verification-code {
          font-size: 32px;
          font-weight: bold;
          letter-spacing: 5px;
          color: #3677E0;
          padding: 15px;
          margin: 20px 0;
          background-color:rgba(51, 186, 87, 0.12);
          border-radius: 6px;
          display: inline-block;
        }
        .footer {
          text-align: center;
          padding: 20px;
          font-size: 12px;
          color: #666;
          border-top: 1px solid #eee;
        }
        .note {
          font-size: 14px;
          margin: 20px 0;
          padding: 10px;
          background-color: #fffef0;
          border-left: 4px solid #ffd700;
          text-align: left;
        }
        .button {
          display: inline-block;
          padding: 10px 20px;
          margin: 20px 0;
          background-color:rgba(54, 119, 224, 0.12);
          color: white;
          text-decoration: none;
          border-radius: 4px;
          font-weight: bold;
        }
        a{
          color: #3677E0!important;
          text-decoration: none;
        }
        a:hover {
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="${process.env.Current_Url}/logo.png" alt="Netbay Logo" class="logo" />
          <h2>Email Verification</h2>
        </div>
        
        <div class="content">
          <h3>Hello!</h3>
          <p>Thank you for choosing Netbay. To complete your registration, please use the verification code below:</p>
          
          <div class="verification-code">${verificationCode}</div>
          
          <p>This code will expire in 60 seconds.</p>
          
          <div class="note">
            <strong>Security Note:</strong> If you didn't request this code, please ignore this email or contact our support team.
          </div>
          
          <p>Need help? <a href="https://Netbay.in/support">Contact our support team</a></p>
        </div>
        
        <div class="footer">
          <p>&copy; 2025 Netbay. All rights reserved.</p>
          <p>Your privacy is important to us. View our <a href="https://Netbay.in/privacy">Privacy Policy</a>.</p>
        </div>
      </div>
    </body>
    </html>`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: ", info.response);
    return true;
  } catch (error) {
    console.error("Error sending email: ", error);
    return false;
  }
}

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    // console.log(req.body)
    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email and password are required." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }
    if (user.isBanned)
      return res.status(401).json({
        success: false,
        message: "You are banned from using this service.",
      });
    // console.log(user)

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: "Invalid email or password.",
      });
    }
    user.lastLogin = Date.now();
    await user.save();

    user.password = undefined;

    const refreshtoken = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: "30d",
    });
    res.cookie("refresh", refreshtoken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    });
    const accesstoken = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: "1h",
    });
    res.cookie("access", accesstoken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    });
    return res.status(200).json({
      success: true,
      message: "Login successful.",
      user: user,
    });
  } catch (error) {
    console.error("Error during login:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while logging in." });
  }
});

router.post("/register_verification", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser?.isActive) {
      return res.status(409).json({
        success: false,
        message: "Email is already registered.",
      });
    }
    if (existingUser?.isBanned)
      return res.status(409).json({
        success: false,
        message: "You are banned from using this service.",
      });

    const code = Math.floor(100000 + Math.random() * 900000);

    if (
      existingUser &&
      Date.now() - existingUser.varificationcode.createdAt < 60000
    ) {
      return res.status(409).json({
        success: false,
        message: `Please wait for ${(
          (60000 - (Date.now() - existingUser.varificationcode.createdAt)) /
          1000
        ).toFixed(0)} seconds before requesting a new code.`,
      });
    }
    const emailSent = await sendVerificationEmail(email, code);
    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to send verification email.",
      });
    }
    if (!existingUser) {
      await User.create({
        email,
        profile: {
          name: email.split("@")[0],
        },
        varificationcode: {
          code: code,
          createdAt: Date.now(),
        },
      });
    } else {
      await User.findOneAndUpdate(
        { email },
        {
          varificationcode: {
            code: code,
            createdAt: Date.now(),
          },
        }
      );
    }

    return res.status(200).json({
      success: true,
      message: "Verification code sent successfully.",
      // message: `Your verification code is ${code}`,
    });
  } catch (error) {
    console.error("Error during registration:", error);
    const mongooseerror = error.message
      ? error.message.split(":").shift().trim()
      : null;
    return res.status(500).json({
      success: false,
      message: mongooseerror || "An error occurred during registration.",
    });
  }
});

router.post("/register", async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
      whatsapp,
      street,
      city,
      state,
      country,
      pincode,
      organizationName,
      gstNumber,
      code,
    } = req.body;

    if (
      !firstName ||
      !lastName ||
      !email ||
      !password ||
      !confirmPassword ||
      !whatsapp ||
      !street ||
      !city ||
      !state ||
      !country ||
      !pincode
    ) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be filled.",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match.",
      });
    }

    const existingUser = await User.findOne({ email });
    if (!existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email not found. Please request a verification code first.",
      });
    }
    // console.log(existingUser.varificationcode.code !== Number(code));
    if (
      existingUser.varificationcode.code !== Number(code) ||
      Date.now() - existingUser.varificationcode.createdAt > 60000
    ) {
      return res.status(400).json({
        success: false,
        message: `Verification code is ${
          existingUser.varificationcode.code !== Number(code)
            ? "incorrect"
            : "expired"
        }.`,
      });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const updatedUser = await User.findOneAndUpdate(
      { email },
      {
        firstName,
        lastName,
        password: hashedPassword,
        whatsapp,
        address: {
          street,
          city,
          state,
          country,
          pincode,
        },
        organizationName,
        gstNumber,
        role: "user",
        isActive: true,
        profile: {
          name: `${firstName} ${lastName}`,
        },
        varificationcode: {
          code: null,
          createdAt: null,
        },
      },
      { new: true }
    ).select("-password");

    const refreshtoken = jwt.sign({ userId: updatedUser._id }, JWT_SECRET, {
      expiresIn: "30d",
    });
    res.cookie("refresh", refreshtoken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    });
    const accesstoken = jwt.sign({ userId: updatedUser._id }, JWT_SECRET, {
      expiresIn: "1h",
    });
    res.cookie("access", accesstoken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    });
    return res.status(201).json({
      success: true,
      message: "Registration successful.",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error during registration:", error);
    const mongooseerror = error.message
      ? error.message.split(":").pop().trim()
      : null;
    return res.status(500).json({
      success: false,
      message: mongooseerror || "An error occurred during registration.",
    });
  }
});

router.post("/google-getway", async (req, res) => {
  try {
    const { name, email, photoURL, googleId, userRefCode } = req.body;

    if (!email || !googleId) {
      return res.status(400).json({
        success: false,
        message: "Something went wrong. Please try again.",
      });
    }

    let user = await User.findOne({ email });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const firstName = name ? name.split(" ")[0] : email.split("@")[0];
      const lastName =
        name && name.split(" ").length > 1
          ? name.split(" ").slice(1).join(" ")
          : "";

      user = new User({
        email,
        googleId,
        firstName,
        lastName,
        isActive: true,
        profile: {
          name: name || email.split("@")[0],
          avatarUrl: photoURL,
        },
        address: {
          street: "",
          city: "",
          state: "",
          country: "",
          pincode: "",
        },
        role: "user",
        balance: 0,
        lastLogin: Date.now(),
      });

      await user.save();
    } else {
      if (user.isBanned)
        return res.status(401).json({
          success: false,
          message: "You are banned from using this service.",
        });
      if (!user.googleId) {
        user.googleId = googleId;
      }

      if (
        photoURL &&
        user.profile.avatarUrl === "https://default-avatar-url.com"
      ) {
        user.profile.avatarUrl = photoURL;
      }

      user.lastLogin = Date.now();
      await user.save();
    }

    user = user.toObject();
    delete user.varificationcode;
    const refreshtoken = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: "30d",
    });

    res.cookie("refresh", refreshtoken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    });

    const accesstoken = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: "1h",
    });

    res.cookie("access", accesstoken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    });

    return res.status(isNewUser ? 201 : 200).json({
      success: true,
      message: isNewUser ? "Registration successful." : "Login successful.",
      user: user,
    });
  } catch (error) {
    console.error("Error during Google authentication:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors)
          .map((err) => err.message)
          .join(", "),
      });
    }

    return res.status(500).json({
      success: false,
      message: "An error occurred during Google authentication.",
    });
  }
});

router.get("/getuserinfo", async (req, res) => {
  try {
    const accessToken = req.cookies.access;
    const refreshToken = req.cookies.refresh;
    if (!accessToken && !refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    let access;
    try {
      access = jwt.verify(accessToken, process.env.JWT_SECRET);
    } catch (error) {}

    let refresh;
    try {
      refresh = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch (error) {
      res.clearCookie("refresh", { path: "/" });
      res.clearCookie("access", { path: "/" });
      return res.status(403).json({
        success: false,
        message: "Your session has expired",
      });
    }
    if (!refresh) {
      res.clearCookie("refresh", { path: "/" });
      res.clearCookie("access", { path: "/" });
      return res.status(403).json({
        success: false,
        message: "Your session has expired",
      });
    }

    const { userId } = refresh;
    const user = await User.findById(userId).select("-password");
    if (!user) {
      res.clearCookie("refresh", { path: "/" });
      res.clearCookie("access", { path: "/" });
      return res.status(404).json({
        success: false,
        message: "Unauthorized",
      });
    }
    if (user.isBanned) {
      res.clearCookie("refresh", { path: "/" });
      res.clearCookie("access", { path: "/" });
      return res.status(401).json({
        success: false,
        message: "You are banned from using this service.",
      });
    }
    if (!access) {
      const refreshtoken = jwt.sign({ userId: user._id }, JWT_SECRET, {
        expiresIn: "30d",
      });
      res.cookie("refresh", refreshtoken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
      });
      const accesstoken = jwt.sign({ userId: user._id }, JWT_SECRET, {
        expiresIn: "1h",
      });
      res.cookie("access", accesstoken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User retrieved successfully.",
      user: user,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return res.status(500).json({
      error: "An error occurred while fetching the user.",
    });
  }
});

router.get("/user/logout", (req, res) => {
  try {
    res.clearCookie("refresh", { path: "/" });
    res.clearCookie("access", { path: "/" });

    return res.status(200).json({
      success: true,
      message: "Logout successful.",
    });
  } catch (error) {
    console.error("Error during logout:", error);
    return res.status(500).json({ error: "An error occurred during logout." });
  }
});

module.exports = router;
