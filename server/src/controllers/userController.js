import bcrypt from 'bcryptjs';
import User, { toPublicUser, USER_ROLES } from '../models/User.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { apiResponse } from '../utils/apiResponse.js';
import AuditEvent from '../models/AuditEvent.js';

export async function updateProfile(req, res, next) {
  try {
    req.user.name = req.body.name.trim();
    await req.user.save();
    res.json(apiResponse({ user: toPublicUser(req.user) }, 'Profile updated.'));
  } catch (error) { next(error); }
}

export async function changePassword(req, res, next) {
  try {
    const user = await User.findById(req.user._id).select('+passwordHash +sessionVersion');
    if (!user) throw new AppError('Your session has expired. Please sign in again.', 401);
    const matches = await bcrypt.compare(req.body.currentPassword, user.passwordHash);
    if (!matches) throw new AppError('Current password is incorrect.', 400, { currentPassword: 'Check your current password.' });
    user.passwordHash = await bcrypt.hash(req.body.newPassword, 12);
    user.sessionVersion += 1;
    await user.save();
    res.clearCookie(env.authCookieName, { httpOnly: true, secure: env.isProduction, sameSite: 'strict', path: '/api/v1' });
    res.json(apiResponse(null, 'Password changed. Please sign in again.'));
  } catch (error) { next(error); }
}

export async function updateUserRole(req, res, next) {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    if (!Object.values(USER_ROLES).includes(role)) {
      throw new AppError('Choose a valid role.', 400, { role: 'Role must be USER, TEAM_ADMIN, or PLATFORM_ADMIN.' });
    }
    if (String(req.user._id) === userId) throw new AppError('You cannot change your own role.', 400);
    const target = await User.findById(userId).select('+sessionVersion');
    if (!target) throw new AppError('User not found.', 404);
    target.role = role;
    target.sessionVersion += 1;
    await target.save();
    await AuditEvent.create({ actor: req.user._id, action: 'USER_ROLE_UPDATED', targetType: 'USER', targetId: target._id, summary: `Account role updated to ${target.role}.` });
    res.json(apiResponse({ user: toPublicUser(target) }, 'User role updated.'));
  } catch (error) { next(error); }
}
