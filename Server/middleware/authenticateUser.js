import jwt from 'jsonwebtoken';
import ErrorHandler from '../utils/errorHandler.js';
import { User } from '../models/User.js';

const authenticateUser = (bypass = false) => {
  return async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return next(new ErrorHandler('No token provided', 401));
    }

    try {
      const decoded = jwt.verify(token, process.env.TOKEN_KEY);
      const user = await User.findById(decoded._id);

      if (!user) {
        if (bypass) {
          return next();
        } else {
          return next(new ErrorHandler('User not found', 404));
        }
      }

      req.user = user;
      next();
    } catch (error) {
      console.error('User Authentication error:', error.message); 
      return next(new ErrorHandler('Invalid token or other authentication error', 401));
    }
  };
};

export default authenticateUser;
