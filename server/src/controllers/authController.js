import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User, { toPublicUser, USER_ROLES } from '../models/User.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { apiResponse } from '../utils/apiResponse.js';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: 'strict',
  path: '/api/v1',
  maxAge: 60 * 60 * 1000
};

function issueSession(user, res) {
  const token = jwt.sign({ sv: user.sessionVersion ?? 0 }, env.jwtSecret, {
    subject: String(user._id),
    expiresIn: env.jwtExpiresIn
  });
  res.cookie(env.authCookieName, token, COOKIE_OPTIONS);
}

export async function register(req, res, next) {
  try {
    const email = req.body.email.trim().toLowerCase();
    if (await User.exists({ email })) throw new AppError('An account with this email already exists.', 409);
    const passwordHash = await bcrypt.hash(req.body.password, 12);
    const startedAt = new Date();
    const user = await User.create({
      name: req.body.name.trim(), email, passwordHash, role: USER_ROLES.USER,
      trialStartedAt: startedAt, trialEndsAt: new Date(startedAt.getTime() + 30 * 86400000), trialStatus: 'TRIAL_ACTIVE'
    });
    issueSession({ ...user.toObject(), sessionVersion: 0 }, res);
    res.status(201).json(apiResponse({ user: toPublicUser(user) }, 'Account created.'));
  } catch (error) {
    if (error.code === 11000) return next(new AppError('An account with this email already exists.', 409));
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const email = req.body.email.trim().toLowerCase();
    const user = await User.findOne({ email }).select('+passwordHash +sessionVersion');
    const passwordMatches = user && await bcrypt.compare(req.body.password, user.passwordHash);
    if (!passwordMatches) throw new AppError('Email or password is incorrect.', 401);
    issueSession(user, res);
    res.json(apiResponse({ user: toPublicUser(user) }, 'Signed in.'));
  } catch (error) { next(error); }
}

export async function logout(req, res, next) {
  res.clearCookie(env.authCookieName, { ...COOKIE_OPTIONS, maxAge: undefined });
  try {
    await User.updateOne({ _id: req.user._id }, { $inc: { sessionVersion: 1 } });
    res.json(apiResponse(null, 'Signed out.'));
  } catch (error) { next(error); }
}

export function getSession(req, res) {
  res.json(apiResponse({ user: toPublicUser(req.user) }));
}
