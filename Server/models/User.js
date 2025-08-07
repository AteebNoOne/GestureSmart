// models/User.js
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { TOKEN_KEY } from "../config/index.js";

const Schema = mongoose.Schema;

// Base schema with common fields
const userSchema = new Schema({
    profileImage: {
        type: String,
        default: null
    },
    firstName: {
        type: String,
        required: [true, "First Name is required!"],
    },
    lastName: {
        type: String,
        required: [true, "Last Name is required!"],
    },
    email: {
        type: String,
        unique: true,
        required: [true, "Email is required!"],
    },
    password: {
        type: String,
        required: [true, "Password is required!"],
    },
    gender: {
        type: String,
        enum: ["male", "female"],
        required: [true, "Gender is required!"],
    },
    dateOfBirth: {
        type: Date,
        required: [true, "Date of birth is required!"],
    },
    age: {
        type: Number,
        default: null
    },
    phone: {
        type: String,
        required: [true, "Phone is required!"],
    },
    location: {
        type: String,
        required: [true, "Location is required!"],
    },
    otp: {
        type: String,
        default: undefined
    },
    otpExpire: {
        type: Date,
        default: undefined
    },
    otpType: {
        type: String,
        default: undefined
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    }
});

// Add JWT method to base schema
userSchema.methods.getJWTToken = function () {
    return jwt.sign({
        _id: this._id,
    }, TOKEN_KEY, {
        expiresIn: "7d",
    });
};

export const User = mongoose.model("User", userSchema);