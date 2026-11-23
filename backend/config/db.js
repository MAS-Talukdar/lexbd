
import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;

    if (!mongoURI) {
      console.warn(
        "MongoDB URI not found. Running without database."
      );

      return false;
    }

    await mongoose.connect(mongoURI);

    console.log("MongoDB connected successfully!");

    return true;

  } catch (error) {
    console.error("MongoDB connection failed:", error.message);

    throw error;
  }
};

export default connectDB;
