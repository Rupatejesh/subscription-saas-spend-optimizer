import { createUserNotification } from '../services/notifications.js';
import { AppError } from '../utils/AppError.js';
import { apiResponse } from '../utils/apiResponse.js';

const DAY = 86400000;
const trialState = (user) => {
  const daysRemaining = user.trialEndsAt ? Math.max(0, Math.ceil((new Date(user.trialEndsAt).getTime() - Date.now()) / DAY)) : null;
  return { startedAt: user.trialStartedAt, endsAt: user.trialEndsAt, status: user.trialStatus, daysRemaining, label: '30-day free trial — simulated billing environment', paymentIntegrated: false };
};

export async function getTrial(req, res, next) {
  try {
    if (req.user.trialStartedAt && req.user.trialEndsAt && req.user.trialStatus !== 'ACTIVE_PLAN') {
      const status = Date.now() >= new Date(req.user.trialEndsAt).getTime() ? 'TRIAL_EXPIRED' : 'TRIAL_ACTIVE';
      if (status !== req.user.trialStatus) { req.user.trialStatus = status; await req.user.save(); }
    }
    if (req.user.trialStatus === 'TRIAL_EXPIRED' || (req.user.trialEndsAt && trialState(req.user).daysRemaining <= 3)) {
      const expired = req.user.trialStatus === 'TRIAL_EXPIRED';
      await createUserNotification(req.user, { type: 'TRIAL', severity: expired ? 'WARNING' : 'INFO', title: expired ? 'Application trial ended' : 'Application trial ending soon', message: expired ? 'Your simulated 30-day application trial has ended. No charge was made.' : 'Your simulated application trial ends within three days. No payment method is connected.', dedupeKey: `trial:${expired ? 'expired' : 'ending'}:${req.user.trialEndsAt?.toISOString?.() ?? 'unknown'}`, relatedResource: { type: 'TRIAL', id: req.user._id } });
    }
    res.json(apiResponse({ trial: trialState(req.user) }));
  } catch (error) { next(error); }
}

export async function startTrial(req, res, next) {
  try {
    if (req.user.trialStartedAt || req.user.trialStatus !== 'TRIAL_NOT_STARTED') throw new AppError('The application trial has already been started and cannot be reset.', 409);
    const startedAt = new Date();
    req.user.trialStartedAt = startedAt;
    req.user.trialEndsAt = new Date(startedAt.getTime() + 30 * DAY);
    req.user.trialStatus = 'TRIAL_ACTIVE';
    await req.user.save();
    res.status(201).json(apiResponse({ trial: trialState(req.user) }, 'Your simulated 30-day application trial has started.'));
  } catch (error) { next(error); }
}
