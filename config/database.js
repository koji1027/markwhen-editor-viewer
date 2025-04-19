// config/database.js
const mongoose = require("mongoose");
const User = require("../models/User");

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);

        // Check if admin user exists, if not create one
        const adminExists = await User.findOne({
            username: process.env.ADMIN_USERNAME,
        });

        if (!adminExists) {
            console.log("Creating admin user...");
            await User.create({
                username: process.env.ADMIN_USERNAME,
                email: process.env.ADMIN_EMAIL,
                password: process.env.ADMIN_PASSWORD,
                isAdmin: true,
            });
            console.log("Admin user created successfully");
        }
    } catch (error) {
        console.error(`Error connecting to MongoDB: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
