const jwt = require("jsonwebtoken");
const User = require("../models/user");

const adminAuth = async (req, res, next) => {
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
    if (!access) {
      const refreshtoken = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        {
          expiresIn: "30d",
        }
      );
      res.cookie("refresh", refreshtoken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
      });
      const accesstoken = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        {
          expiresIn: "1h",
        }
      );
      res.cookie("access", accesstoken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
      });
    }
    if (user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }
    user.lastLogin = new Date();
    await user.save();
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account is not active",
      });
    }
    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        message: "Your account is banned",
      });
    }

    req.user = user;

    next();
  } catch (error) {
    console.error("Error authenticating user:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while authenticating the user",
    });
  }
};

const userAuth = async (req, res, next) => {
  try {
    if (req.path === "/plan") {
      return next();
    }
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
    if (!access) {
      const refreshtoken = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        {
          expiresIn: "30d",
        }
      );
      res.cookie("refresh", refreshtoken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
      });
      const accesstoken = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        {
          expiresIn: "1h",
        }
      );
      res.cookie("access", accesstoken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
      });
    }
    user.lastLogin = new Date();
    await user.save();
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account is not active",
      });
    }
    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        message: "Your account is banned",
      });
    }
    req.user = user;

    next();
  } catch (error) {
    console.error("Error authenticating user:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while authenticating the user",
    });
  }
};

module.exports = {
  adminAuth,
  userAuth,
};
