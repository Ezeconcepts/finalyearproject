const mongoose = require("mongoose");

const connectDB = async function () {
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/forteFile";

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000, // fail fast if DB unreachable
    });

    const host = mongoose.connection.host;
    console.log(`✅ Database connected → ${host}`);
  } catch (error) {
    console.error("❌ Error connecting to the database:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
