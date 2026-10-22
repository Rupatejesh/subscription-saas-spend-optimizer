import Notification from '../models/Notification.js';
import Subscription from '../models/Subscription.js';
import { AppError } from '../utils/AppError.js';

const DAY = 86400000;
const MONTHLY_FACTOR = { WEEKLY: 52 / 12, MONTHLY: 1, QUARTERLY: 1 / 3, YEARLY: 1 / 12 };
const preferenceFor = (type) => ({ RENEWAL: 'renewals', UNUSED: 'unused', SAVINGS: 'savings', SPENDING: 'spending', TEAM: 'team', TRIAL: 'trial' })[type];

export async function createUserNotification(user, fields) {
  const setting = preferenceFor(fields.type);
  if (setting && user.notificationPreferences?.[setting] === false) return null;
  try { return await Notification.create({ ...fields, user: user._id }); }
  catch (error) { if (error.code === 11000) return null; throw error; }
}

export async function syncScheduledNotifications(user) {
  const now = new Date();
  const subscriptions = await Subscription.find({ user: user._id, team: null, status: { $in: ['ACTIVE', 'CANCELLATION_REQUESTED'] } }).lean();
  const unusedByCurrency = new Map();
  const activeSpendINR = { amount: 0, currency: 'INR' };
  for (const item of subscriptions) {
    const monthlyAmount = Number(item.amount) * (MONTHLY_FACTOR[item.billingCycle] ?? 1);
    if (item.status === 'ACTIVE' && item.currency === 'INR') activeSpendINR.amount += monthlyAmount;
    const days = Math.ceil((new Date(item.nextRenewalDate).getTime() - now.getTime()) / DAY);
    if (days >= 0 && days <= 30 && item.status === 'ACTIVE') {
      await createUserNotification(user, { type: 'RENEWAL', severity: days <= 7 ? 'WARNING' : 'INFO', title: `${item.name} renews soon`, message: days === 0 ? 'This plan is due to renew today. Review it if needed.' : `This plan is due to renew in ${days} day${days === 1 ? '' : 's'}.`, dedupeKey: `renewal:${item._id}:${new Date(item.nextRenewalDate).toISOString().slice(0, 10)}`, relatedResource: { type: 'SUBSCRIPTION', id: item._id } });
    }
    if (item.status === 'ACTIVE' && (!item.lastUsedAt || now.getTime() - new Date(item.lastUsedAt).getTime() > 30 * DAY)) {
      unusedByCurrency.set(item.currency || 'INR', (unusedByCurrency.get(item.currency || 'INR') ?? 0) + monthlyAmount);
      await createUserNotification(user, { type: 'UNUSED', severity: 'INFO', title: `Review ${item.name}`, message: 'No use was recorded in the last 30 days. Consider whether the plan is still useful.', dedupeKey: `unused:${item._id}:${now.getFullYear()}-${now.getMonth() + 1}`, relatedResource: { type: 'SUBSCRIPTION', id: item._id } });
    }
  }
  for (const [currency, amount] of unusedByCurrency) {
    await createUserNotification(user, { type: 'SAVINGS', severity: 'INFO', title: 'Potential subscription savings', message: `Plans with low recorded use total about ${amount.toFixed(2)} ${currency} per month. Review before making changes; this is an estimate.`, dedupeKey: `savings:${currency}:${now.getFullYear()}-${now.getMonth() + 1}` });
  }
  if (activeSpendINR.amount >= 10000) {
    await createUserNotification(user, { type: 'SPENDING', severity: 'WARNING', title: 'Monthly recurring spend is above the demo threshold', message: `Your listed active plans total ${activeSpendINR.amount.toFixed(2)} INR per month, above the 10000 INR demo review threshold. This is a plan-price estimate, not bank activity.`, dedupeKey: `spending:INR:${now.getFullYear()}-${now.getMonth() + 1}` });
  }
  if (user.trialStartedAt && user.trialEndsAt && user.trialStatus !== 'ACTIVE_PLAN') {
    const remaining = Math.ceil((new Date(user.trialEndsAt).getTime() - now.getTime()) / DAY);
    const expired = remaining <= 0;
    if (user.trialStatus !== (expired ? 'TRIAL_EXPIRED' : 'TRIAL_ACTIVE')) {
      user.trialStatus = expired ? 'TRIAL_EXPIRED' : 'TRIAL_ACTIVE';
      await user.save();
    }
    if (expired || remaining <= 3) {
      await createUserNotification(user, { type: 'TRIAL', severity: expired ? 'WARNING' : 'INFO', title: expired ? 'Application trial ended' : 'Application trial ending soon', message: expired ? 'Your simulated 30-day application trial has ended. No charge was made.' : `Your simulated application trial ends in ${remaining} day${remaining === 1 ? '' : 's'}. No payment method is connected.`, dedupeKey: `trial:${expired ? 'expired' : 'ending'}:${new Date(user.trialEndsAt).toISOString()}`, relatedResource: { type: 'TRIAL', id: user._id } });
    }
  }
}

export function assertPreferencePatch(input) {
  const allowed = ['renewals', 'unused', 'savings', 'spending', 'team', 'trial'];
  if (!input || typeof input !== 'object' || Array.isArray(input) || !Object.keys(input).length || Object.keys(input).some((key) => !allowed.includes(key) || typeof input[key] !== 'boolean')) {
    throw new AppError('Provide one or more valid notification preference values.', 400);
  }
  return input;
}
