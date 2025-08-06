import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { calculateAge } from '../utils/calculateAge.js';

class UserService {
    async createUser(userData) {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const {
                firstName,
                lastName,
                email,
                password,
                dateOfBirth,
                gender,
                phone,
                location
            } = userData;

            const existingUser = await User.findOne({ email }).session(session);
            if (existingUser) {
                throw new AppError("Email already exists", 400);
            }


            const hashedPassword = await bcrypt.hash(password, 10);
            const age = calculateAge(dateOfBirth)

            const user = await User.create([{
                firstName,
                lastName,
                email,
                password: hashedPassword,
                dateOfBirth,
                age: age,
                gender,
                phone,
                location,

            }], { session });


            await session.commitTransaction();

            const token = user[0].getJWTToken();
            return {
                success: true,
                message: "User registered successfully",
                token,
                user
            };

        } catch (error) {
            console.log("Error?", error)
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    async getUserById(userId) {
        const user = await User.findById(userId);
        if (!user) {
            throw new AppError("User not found", 404);
        }
        return user;
    }

    async getAllUsers(filters = {}, pagination = { page: 1, limit: 10 }) {
        const { page, limit } = pagination;
        const skip = (page - 1) * limit;

        const users = await User.find(filters)
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const total = await User.countDocuments(filters);

        return {
            users,
            pagination: {
                current: page,
                total: Math.ceil(total / limit),
                count: users.length,
                totalRecords: total
            }
        };
    }

    async updateUser(userId, updateData) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            if (updateData.password) {
                updateData.password = await bcrypt.hash(updateData.password, 10);
            }

            if (updateData.dateOfBirth) {
                updateData.age = calculateAge(updateData.dateOfBirth);
            }

            const user = await User.findByIdAndUpdate(
                userId,
                { $set: updateData },
                { new: true, runValidators: true, session }
            );

            if (!user) {
                throw new AppError("User not found", 404);
            }

            await session.commitTransaction();
            return user;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    async deleteUser(userId) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Delete the user
            const user = await User.findByIdAndDelete(userId).session(session);
            if (!user) {
                throw new AppError("User not found", 404);
            }

            await session.commitTransaction();
            return { message: "User and associated data deleted successfully" };
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    async loginUser(email, password) {
        const user = await User.findOne({ email });
        if (!user) {
            throw new AppError("Invalid email or password", 401);
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            throw new AppError("Invalid email or password", 401);
        }

        const token = user.getJWTToken();
        return { user, token, success: true };
    }

    async validateEmail(email) {
        const user = await User.findOne({ email }); // findOne instead of find
        if (user) {
            throw new AppError("Email Already Exist", 400);
        }
        return true; // Indicate email is available
    }

}

export const userService = new UserService();