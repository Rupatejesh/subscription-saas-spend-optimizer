import mongoose from 'mongoose';
import Subscription, { SUBSCRIPTION_CATEGORIES } from '../models/Subscription.js';
import { AppError } from '../utils/AppError.js';
import { apiResponse } from '../utils/apiResponse.js';

const DAY = 86400000;
const MONTHLY_FACTOR = { WEEKLY: 52 / 12, MONTHLY: 1, QUARTERLY: 1 / 3, YEARLY: 1 / 12 };
const monthlyCost = (item) => item.amount * MONTHLY_FACTOR[item.billingCycle];
const annualCost = (item) => monthlyCost(item) * 12;
const isUnused = (item, now) => !item.lastUsedAt || now - new Date(item.lastUsedAt).getTime() > 30 * DAY;
const ownedBy = (userId) => ({ user: userId, team: null });
const withUsage = (item, now = new Date()) => {
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const usageCount = item.usageMonth === currentMonth ? item.usageCount ?? 0 : 0;
  const usagePercentage = Math.min(100, Math.round(usageCount / Math.max(1, item.monthlyUsageTarget ?? 12) * 100));
  const lastUsedAt = item.lastUsedAt ?? null;
  return { ...item, usageCount, usagePercentage, lastUsedAt, health: !lastUsedAt || now - new Date(lastUsedAt).getTime() > 30 * DAY ? 'REVIEW' : usagePercentage < 25 ? 'LOW_USAGE' : 'HEALTHY' };
};
const serialize = (item) => ({ ...withUsage(item.toObject()), id: String(item._id), monthlyCost: monthlyCost(item), annualCost: annualCost(item), estimatedYearlySpend: Number(annualCost(item).toFixed(2)) });

export async function createSubscription(req, res, next) {
  try {
    const { team: ignoredTeam, isShared: ignoredShared, ...input } = req.body ?? {};
    const item = await Subscription.create({ ...input, user: req.user._id, team: null, isShared: false });
    res.status(201).json(apiResponse({ subscription: serialize(item) }, 'Subscription created.'));
  } catch (error) { next(error); }
}

export async function listSubscriptions(req, res, next) {
  try {
    const { q, category, status, sort = 'renewal', order = 'asc' } = req.query;
    const filter = { user: req.user._id, team: null };
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (q) filter.name = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    const sortBy = { renewal: 'nextRenewalDate', amount: 'amount', name: 'name', created: 'createdAt' }[sort];
    const rows = await Subscription.find(filter).sort({ [sortBy]: order === 'desc' ? -1 : 1, _id: 1 }).limit(200).lean();
    res.json(apiResponse({ subscriptions: rows.map((item) => ({ ...withUsage(item), id: String(item._id), monthlyCost: monthlyCost(item), annualCost: annualCost(item) })) }));
  } catch (error) { next(error); }
}

export async function trackSubscriptionUsage(req, res, next) {
  try {
    const item = await Subscription.findOne({ _id: req.params.id, ...ownedBy(req.user._id) });
    if (!item) throw new AppError('Subscription not found.', 404);
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    item.usageCount = item.usageMonth === month ? item.usageCount + 1 : 1;
    item.usageMonth = month;
    item.lastUsedAt = now;
    await item.save();
    res.json(apiResponse({ subscription: { ...withUsage(item.toObject(), now), id: String(item._id) } }, 'Usage recorded.'));
  } catch (error) { next(error); }
}

export async function getSubscription(req, res, next) {
  try {
    const item = await Subscription.findOne({ _id: req.params.id, ...ownedBy(req.user._id) });
    if (!item) throw new AppError('Subscription not found.', 404);
    res.json(apiResponse({ subscription: serialize(item) }));
  } catch (error) { next(error); }
}

export async function updateSubscription(req, res, next) {
  try {
    const item = await Subscription.findOneAndUpdate({ _id: req.params.id, ...ownedBy(req.user._id) }, req.body, { new: true, runValidators: true });
    if (!item) throw new AppError('Subscription not found.', 404);
    res.json(apiResponse({ subscription: serialize(item) }, 'Subscription updated.'));
  } catch (error) { next(error); }
}

export async function deleteSubscription(req, res, next) {
  try {
    const item = await Subscription.findOneAndDelete({ _id: req.params.id, ...ownedBy(req.user._id) });
    if (!item) throw new AppError('Subscription not found.', 404);
    res.json(apiResponse({ id: String(item._id) }, 'Subscription deleted.'));
  } catch (error) { next(error); }
}

export async function getSubscriptionSummary(req, res, next) {
  try {
    const now = new Date();
    const items = await Subscription.find(ownedBy(req.user._id)).lean();
    const active = items.filter((item) => item.status === 'ACTIVE');
    const unused = active.filter((item) => isUnused(item, now));
    const upcoming = active.filter((item) => {
      const until = new Date(item.nextRenewalDate).getTime() - now.getTime();
      return until >= 0 && until <= 30 * DAY;
    }).sort((a, b) => new Date(a.nextRenewalDate) - new Date(b.nextRenewalDate));
    const monthlySpend = active.reduce((sum, item) => sum + monthlyCost(item), 0);
    const annualSpend = active.reduce((sum, item) => sum + annualCost(item), 0);
    const potentialSavings = unused.reduce((sum, item) => sum + monthlyCost(item), 0);
    // The projection uses declared recurring plans; it is not a transaction history.
    const spendingTrend = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() + index + 1, 1);
      return { month: date.toLocaleString('en', { month: 'short' }), amount: Number(monthlySpend.toFixed(2)) };
    });
    const usedRecently = active.filter((item) => !isUnused(item, now)).length;
    const healthScore = active.length ? Math.round((usedRecently / active.length) * 100) : 100;
    const categories = SUBSCRIPTION_CATEGORIES.map((category) => ({
      category,
      monthlySpend: Number(active.filter((item) => item.category === category).reduce((sum, item) => sum + monthlyCost(item), 0).toFixed(2))
    })).filter((item) => item.monthlySpend > 0);
    res.json(apiResponse({
      currency: active[0]?.currency ?? 'INR', monthlySpend: Number(monthlySpend.toFixed(2)), annualSpend: Number(annualSpend.toFixed(2)),
      activeCount: active.length, unusedCount: unused.length, upcomingRenewals: upcoming.slice(0, 6).map((item) => ({ ...item, id: String(item._id), monthlyCost: monthlyCost(item) })),
      upcomingRenewalCount: upcoming.length, unusedSubscriptions: unused.map((item) => ({ ...item, id: String(item._id), monthlyCost: monthlyCost(item) })),
      potentialSavings: Number(potentialSavings.toFixed(2)), healthScore, spendingTrend, categories
    }));
  } catch (error) { next(error); }
}

export function getSubscriptionCategories(_req, res) {
  res.json(apiResponse({ categories: SUBSCRIPTION_CATEGORIES }));
}

export async function getUpcomingRenewals(req, res, next) {
  try {
    const days = Math.min(Math.max(Number.parseInt(req.query.days, 10) || 30, 1), 90);
    const now = new Date();
    const items = await Subscription.find({ ...ownedBy(req.user._id), status: 'ACTIVE', nextRenewalDate: { $gte: now, $lte: new Date(now.getTime() + days * DAY) } }).sort({ nextRenewalDate: 1 }).lean();
    res.json(apiResponse({ days, renewals: items.map((item) => ({ ...item, id: String(item._id), monthlyCost: monthlyCost(item) })) }));
  } catch (error) { next(error); }
}

export function validateSubscriptionId(req, _res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return next(new AppError('Subscription not found.', 404));
  next();
}



