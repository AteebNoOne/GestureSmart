import { asyncHandler } from "../middleware/asyncHandler.js";
import { uploadImageToCloudinary } from "../helpers/uploadImage.js";
import { userService } from "../services/userService.js";


export const emailAvailiblity = asyncHandler(async (req, res) => {
    const result = await userService.validateEmail(req.body.email);
    res.status(200).json({ available: result });
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
