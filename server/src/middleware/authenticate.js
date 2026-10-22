import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { canAccessRole } from '../utils/roles.js';

function readCookie(req, name) {
  const cookies = req.headers.cookie?.split(';') ?? [];
  const entry = cookies.map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
    return entry ? entry.slice(name.length + 1) : undefined;
}

export async function authenticate(req, _res, next) {
  try {
    const token = readCookie(req, env.authCookieName);
    if (!token) throw new AppError('Please sign in to continue.', 401);
    const payload = jwt.verify(token, env.jwtSecret);
    if (!payload.sub || !Number.isInteger(payload.sv)) throw new AppError('Your session is invalid. Please sign in again.', 401);
    const user = await User.findById(payload.sub).select('+sessionVersion');
    if (!user || user.sessionVersion !== payload.sv) throw new AppError('Your session has expired. Please sign in again.', 401);
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(new AppError('Your session has expired. Please sign in again.', 401));
    }
    next(error);
  }
}

export function authorize(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) return next(new AppError('Please sign in to continue.', 401));
    if (!canAccessRole(req.user.role, allowedRoles)) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }
    next();
  };
}
