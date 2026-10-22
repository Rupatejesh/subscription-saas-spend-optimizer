import { AppError } from '../utils/AppError.js';

export function validateRequest(validator) {
  return (req, _res, next) => {
    const errors = validator(req.body ?? {});
    if (Object.keys(errors).length) return next(new AppError('Please correct the highlighted fields.', 400, errors));
    next();
  };
}
