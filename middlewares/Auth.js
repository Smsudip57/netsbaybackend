const jwt = require('jsonwebtoken');
const User = require('../models/user');

const adminAuth = async (req, res, next) => {
  try {
    const cookie = req.cookies.user;
    if (!cookie) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(cookie, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    const { userId } = decoded;

    // Verify user exists
    const user = await User.findById(userId).select('-password');
    if (!user || user.role !== 'admin') {
      return res.status(404).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    req.user = user;

    next();  // Proceed to the next middleware/route handler
  } catch (error) {
    console.error('Error authenticating user:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while authenticating the user',
    });
  }
};




const userAuth = async (req, res, next) => {
  try {
    const cookie = req.cookies.user;
    if (!cookie) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(cookie, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    const { userId } = decoded;

    // Verify user exists
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Unauthorized',
      });
    }
    if(user.isBanned){
      return res.status(401).json({
        success: false,
        message: 'Your account has been banned',
      });
    }
    req.user = user;
    next();  // Proceed to the next middleware/route handler
  } catch (error) {
    console.error('Error authenticating user:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while authenticating the user',
    });
  }
};







module.exports = {
  adminAuth,
  userAuth
};
