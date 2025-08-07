import { asyncHandler } from "../middleware/asyncHandler.js";
import { uploadImageToCloudinary } from "../helpers/uploadImage.js";
import { userService } from "../services/userService.js";
import { resetPassword, sendOtp, verifyOtp } from "../services/otpService.js";


export const emailAvailiblity = asyncHandler(async (req, res) => {
    try {
        const result = await userService.validateEmail(req.body.email);

        res.status(200).json({ available: result });
    }
    catch (error) {

        res.status(400).json({ available: false, message: "Email already exist!" });

    }

});


export const userSignup = asyncHandler(async (req, res) => {
    const result = await userService.createUser(req.body);
    res.status(201).json(result);
});

export const userLogin = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const result = await userService.loginUser(email, password);
    res.status(200).json(result);
});

export const getUserProfile = asyncHandler(async (req, res) => {
    const user = await userService.getUserById(req.user._id);
    res.status(200).json({ success: true, user });
});

export const getAllUsers = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, ...filters } = req.query;
    const result = await userService.getAllUsers(filters, { page: Number(page), limit: Number(limit) });
    res.status(200).json(result);
});

export const updateUser = asyncHandler(async (req, res) => {
    const updates = { ...req.body };

    if (req.files?.profileImage) {
        const profileImageUrl = await uploadImageToCloudinary(req.files.profileImage[0].path);
        updates.profileImage = profileImageUrl;
    }

    const user = await userService.updateUser(req.user._id, updates);
    res.status(200).json({ success: true, user });
});

export const deleteUser = asyncHandler(async (req, res) => {
    const result = await userService.deleteUser(req.user._id);
    res.status(200).json(result);
});

export const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;

    const user = await sendOtp(email, "password-change");
    res.status(200).json({ success: true, user });
});


export const verifyUserOtp = asyncHandler(async (req, res) => {
    const { email, otp, type } = req.body; // Add type to the request body

    // Verify OTP with the specific type
    const user = await verifyOtp(email, otp, type);

    res.status(200).json({
        success: true,
        user,
        message: `OTP verified for ${type || 'general'} purpose`
    });
});

export const resetUserPassword = asyncHandler(async (req, res) => {
    const { email, otp, newPassword } = req.body;
    const user = await resetPassword(email, otp, newPassword);
    res.status(200).json({ success: true, user });
});
