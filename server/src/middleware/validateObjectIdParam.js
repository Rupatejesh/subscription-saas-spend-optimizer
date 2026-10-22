import mongoose from 'mongoose';
import { AppError } from '../utils/AppError.js';

export function validateObjectIdParam(name, label = 'resource') {
  return (req, _res, next) => {
    if (!mongoose.isValidObjectId(req.params[name])) {
      return next(new AppError(`Invalid ${label} identifier.`, 400));
    }
    next();
  };
}
