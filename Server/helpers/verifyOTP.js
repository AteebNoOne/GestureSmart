import { catchAsyncError } from '../middleware/catchAsyncError.js';
import { Customer } from '../model/Customer.js';
import ErrorHandler from '../utils/errorHandler.js';
import { generateRandomOtp } from '../utils/generateRandomOtp.js';

export const verifyOTP = catchAsyncError(async (req, res, next) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return next(new ErrorHandler("Email and OTP are required", 400));
  }

  // Find the user by email
  const user = await Customer.findOne({ email });

  if (!user) {
    return next(new ErrorHandler("User with provided email not found", 404));
  }

  // Check if the OTP matches
  if (user.otp !== otp) {
    return next(new ErrorHandler("Invalid OTP", 400));
  }

  user.otp = generateRandomOtp()
  await user.save();

  res.status(200).json({
    success: true,
    message: "OTP verified successfully",
  });
});
