/**
 * Custom error class that extends Error to include status code and operational status
 * Used for handling application-specific errors
 */
export class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        
        // Set isOperational to true for all operational errors
        // Helps distinguish from programming errors
        this.isOperational = true;

        // Capture stack trace
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Helper function to create a new AppError instance
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @returns {AppError} New AppError instance
 */
export const createError = (message, statusCode) => {
    return new AppError(message, statusCode);
};

/**
 * List of common error status codes for reference
 */
export const ErrorCodes = {
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    VALIDATION_ERROR: 422,
    INTERNAL_SERVER: 500,
    SERVICE_UNAVAILABLE: 503
};