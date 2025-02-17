const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI 

const dbConnect = async () => {
  try {
    if (mongoose.connection.readyState >= 1) {
      console.log('Already connected to MongoDB');
      return;
    }

    await mongoose.connect(MONGO_URI);

    console.log('Connected to MongoDB successfully');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error.message);
    process.exit(1); // Exit process if connection fails
  }
};

module.exports = dbConnect;
