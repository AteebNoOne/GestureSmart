import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { sendEmail } from '../helpers/sendEmail.js'
import bcrypt from 'bcrypt';

// Generate 6-digit OTP
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Email templates
const getEmailTemplate = (type, user, otp) => {
    const templates = {
        'password-change': {
            subject: 'Password Reset OTP',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #333; text-align: center;">Password Reset OTP</h2>
                    <p>Hello ${user.firstName},</p>
                    <p>Your OTP for password reset is:</p>
                    <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
                        <h1 style="color: #007bff; font-size: 32px; margin: 0; letter-spacing: 5px;">${otp}</h1>
                    </div>
                    <p><strong>This OTP will expire in 5 minutes.</strong></p>
                    <p>If you didn't request this password reset, please ignore this email or contact support if you have concerns.</p>
                    <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p style="margin: 0; color: #856404;"><strong>Security Notice:</strong> Never share your OTP with anyone. Our team will never ask for your OTP.</p>
                    </div>
                    <hr style="margin: 30px 0;">
                    <p style="color: #666; font-size: 14px;">Best regards,<br>${process.env.APP_NAME || 'Your App'}</p>
                </div>
            `
        },
        'email-change': {
            subject: 'Email Change Verification OTP',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #333; text-align: center;">Email Change Verification</h2>
                    <p>Hello ${user.firstName},</p>
                    <p>You've requested to change your email address. Please verify this request with the OTP below:</p>
                    <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
                        <h1 style="color: #28a745; font-size: 32px; margin: 0; letter-spacing: 5px;">${otp}</h1>
                    </div>
                    <p><strong>This OTP will expire in 5 minutes.</strong></p>
                    <p>If you didn't request this email change, please ignore this email and consider securing your account.</p>
                    <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p style="margin: 0; color: #0c5460;"><strong>Important:</strong> This OTP will verify your current email before allowing the change to a new email address.</p>
                    </div>
                    <hr style="margin: 30px 0;">
                    <p style="color: #666; font-size: 14px;">Best regards,<br>${process.env.APP_NAME || 'Your App'}</p>
                </div>
            `
        }
    };

    return templates[type] || templates['password-change'];
};

// Send OTP function with template support
export const sendOtp = async (email, type = 'password-change') => {
    try {
        console.log(`[OTP Service] Sending OTP to: ${email}, type: ${type}`);

        // Validate type
        const validTypes = ['password-change', 'email-change'];
        if (!validTypes.includes(type)) {
            throw new AppError("Invalid OTP type", 400);
        }

        // Check if user exists
        const user = await User.findOne({ email });
        if (!user) {
            throw new AppError("User not found with this email", 404);
        }

        // Generate OTP
        const otp = generateOTP();
        const expireTime = Date.now() + 5 * 60 * 1000; // 5 minutes

        console.log(`[OTP Service] Generated OTP: ${otp}, Expires at: ${new Date(expireTime)}`);

        // Set OTP and expiration (5 minutes)
        user.otp = otp;
        user.otpExpire = expireTime;
        user.otpType = type;
        await user.save();

        console.log(`[OTP Service] Saved OTP to database for user: ${user._id}`);

        // Get email template based on type
        const emailTemplate = getEmailTemplate(type, user, otp);

        // Send email
        await sendEmail(emailTemplate.subject, email, emailTemplate.html);

        return {
            success: true,
            message: `OTP sent successfully to your email for ${type.replace('-', ' ')}`
        };

    } catch (error) {
        console.error("Send OTP error:", error);
        throw error;
    }
};

// Verify OTP function with type validation
export const verifyOtp = async (email, otp, expectedType = null) => {
    try {
        console.log(`[OTP Service] Verifying OTP for email: ${email}, OTP: ${otp}, Expected type: ${expectedType}`);

        // Find user with email first to debug
        const userCheck = await User.findOne({ email });
        if (!userCheck) {
            console.log(`[OTP Service] User not found with email: ${email}`);
            throw new AppError("User not found with this email", 404);
        }

        console.log(`[OTP Service] User found. Stored OTP: ${userCheck.otp}, Stored OTP Type: ${userCheck.otpType}, OTP Expires: ${new Date(userCheck.otpExpire)}, Current Time: ${new Date()}`);

        // Find user with email and valid OTP
        const user = await User.findOne({
            email,
            otp,
            otpExpire: { $gt: Date.now() }
        });

        if (!user) {
            // More specific error messages
            const userWithEmail = await User.findOne({ email });
            if (!userWithEmail) {
                throw new AppError("User not found with this email", 404);
            }

            if (userWithEmail.otp !== otp) {
                console.log(`[OTP Service] OTP mismatch. Provided: ${otp}, Stored: ${userWithEmail.otp}`);
                throw new AppError("Invalid OTP", 400);
            }

            if (userWithEmail.otpExpire <= Date.now()) {
                console.log(`[OTP Service] OTP expired. Expiry: ${new Date(userWithEmail.otpExpire)}, Current: ${new Date()}`);
                throw new AppError("OTP has expired", 400);
            }

            throw new AppError("Invalid or expired OTP", 400);
        }

        // Validate OTP type if specified
        if (expectedType && user.otpType !== expectedType) {
            console.log(`[OTP Service] OTP type mismatch. Expected: ${expectedType}, Stored: ${user.otpType}`);
            throw new AppError(`OTP was not generated for ${expectedType.replace('-', ' ')}`, 400);
        }

        console.log(`[OTP Service] OTP verified successfully for user: ${user._id}`);

        return {
            success: true,
            message: "OTP verified successfully",
            userId: user._id,
            otpType: user.otpType
        };

    } catch (error) {
        console.error("Verify OTP error:", error);
        throw error;
    }
};

// Reset Password function (for internal use)
export const resetPassword = async (email, otp, newPassword) => {
    try {
        console.log(`[OTP Service] Resetting password for email: ${email}`);

        // Validate input
        if (!email || !otp || !newPassword) {
            throw new AppError("Email, OTP, and new password are required", 400);
        }

        // Validate password strength (optional - adjust as needed)
        if (newPassword.length < 6) {
            throw new AppError("Password must be at least 6 characters long", 400);
        }

        // First verify the OTP
        await verifyOtp(email, otp, 'password-change');

        // Find user again to get fresh data
        const user = await User.findOne({ email });
        if (!user) {
            throw new AppError("User not found", 404);
        }

        // Hash the new password
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update user password and clear OTP fields
        user.password = hashedPassword;
        user.otp = undefined;
        user.otpExpire = undefined;
        user.otpType = undefined;
        await user.save();

        console.log(`[OTP Service] Password reset successfully for user: ${user._id}`);

        // Send confirmation email
        const confirmationHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #28a745; text-align: center;">Password Reset Successful</h2>
                <p>Hello ${user.firstName},</p>
                <p>Your password has been successfully reset.</p>
                <p>If you didn't make this change, please contact our support team immediately.</p>
                <div style="background-color: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p style="margin: 0; color: #155724;"><strong>Security Tip:</strong> Make sure to use a strong, unique password and enable two-factor authentication if available.</p>
                </div>
                <hr style="margin: 30px 0;">
                <p style="color: #666; font-size: 14px;">Best regards,<br>${process.env.APP_NAME || 'Your App'}</p>
            </div>
        `;

        await sendEmail("Password Reset Confirmation", email, confirmationHtml);

        return {
            success: true,
            message: "Password reset successfully"
        };

    } catch (error) {
        console.error("Reset password error:", error);
        throw error;
    }
};

// Reset Email function (for internal use)
export const resetEmail = async (currentEmail, otp, newEmail) => {
    try {
        console.log(`[OTP Service] Resetting email from ${currentEmail} to ${newEmail} with OTP: ${otp}`);

        // Validate input
        if (!currentEmail || !otp || !newEmail) {
            throw new AppError("Current email, OTP, and new email are required", 400);
        }

        // Validate new email format (basic validation)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newEmail)) {
            throw new AppError("Please provide a valid new email address", 400);
        }

        // Check if new email already exists
        const existingUser = await User.findOne({ email: newEmail });
        if (existingUser) {
            throw new AppError("Email already exists", 409);
        }

        // First verify the OTP with detailed logging
        await verifyOtp(currentEmail, otp, 'email-change');

        // Find user again to get fresh data
        const user = await User.findOne({ email: currentEmail });
        if (!user) {
            throw new AppError("User not found", 404);
        }

        // Store old email for confirmation
        const oldEmail = user.email;

        // Update user email and clear OTP fields
        user.email = newEmail;
        user.otp = undefined;
        user.otpExpire = undefined;
        user.otpType = undefined;
        await user.save();

        console.log(`[OTP Service] Email changed successfully for user: ${user._id}`);

        // Send confirmation email to new email address
        const confirmationHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #28a745; text-align: center;">Email Change Successful</h2>
                <p>Hello ${user.firstName},</p>
                <p>Your email has been successfully changed from <strong>${oldEmail}</strong> to <strong>${newEmail}</strong>.</p>
                <p>If you didn't make this change, please contact our support team immediately.</p>
                <div style="background-color: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p style="margin: 0; color: #155724;"><strong>Security Notice:</strong> This is your new primary email address for all future communications and login attempts.</p>
                </div>
                <hr style="margin: 30px 0;">
                <p style="color: #666; font-size: 14px;">Best regards,<br>${process.env.APP_NAME || 'Your App'}</p>
            </div>
        `;

        await sendEmail("Email Change Confirmation", newEmail, confirmationHtml);

        // Optionally, send notification to old email
        const notificationHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #ffc107; text-align: center;">Email Address Changed</h2>
                <p>Hello ${user.firstName},</p>
                <p>This is to notify you that your email address has been changed from this email (${oldEmail}) to ${newEmail}.</p>
                <p>If you didn't authorize this change, please contact our support team immediately.</p>
                <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p style="margin: 0; color: #856404;"><strong>Important:</strong> This email address is no longer associated with your account.</p>
                </div>
                <hr style="margin: 30px 0;">
                <p style="color: #666; font-size: 14px;">Best regards,<br>${process.env.APP_NAME || 'Your App'}</p>
            </div>
        `;

        await sendEmail("Email Address Change Notification", oldEmail, notificationHtml);

        return {
            success: true,
            message: "Email changed successfully",
            newEmail: newEmail
        };

    } catch (error) {
        console.error("Reset email error:", error);
        throw error;
    }
};