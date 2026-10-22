import Transaction, { TRANSACTION_CATEGORIES } from '../models/Transaction.js';
import mongoose from 'mongoose';
import Subscription from '../models/Subscription.js';
import { detectRecurringPayments } from '../services/subscriptionIntelligence.js';
import { AppError } from '../utils/AppError.js';
import { apiResponse } from '../utils/apiResponse.js';

const DEMO = [
  ['Netflix', 649, 'Entertainment'], ['Spotify', 119, 'Entertainment'], ['YouTube Premium', 189, 'Entertainment'],
  ['Microsoft 365', 489, 'Productivity'], ['Adobe Creative Cloud', 1675, 'Design'], ['Canva', 499, 'Design'],
  ['Google One', 130, 'Cloud Storage'], ['Dropbox', 999, 'Cloud Storage'], ['ChatGPT Plus', 1950, 'AI Tools'], ['Notion', 800, 'Productivity']
];
const serialize = (item) => ({ ...item.toObject(), id: String(item._id), demo: true });

export async function getSubscriptionIntelligence(req, res, next) {
  try {
    const [transactions, subscriptions] = await Promise.all([
      Transaction.find({ user: req.user._id }).sort({ date: 1 }).limit(1000).lean(),
      Subscription.find({ user: req.user._id }).lean()
    ]);
    const detections = detectRecurringPayments(transactions, subscriptions).map((item) => ({
      ...item,
      duplicate: item.duplicate || detectionsDuplicate(item, subscriptions),
      classification: subscriptions.some((subscription) => normalizeName(subscription.name) === normalizeName(item.merchant)) ? 'EXISTING_SUBSCRIPTION' : 'SUGGESTED_SUBSCRIPTION'
    }));
    const currentMonth = new Date().toISOString().slice(0, 7);
    const usage = subscriptions.filter((item) => item.status === 'ACTIVE').map((item) => {
      const count = item.usageMonth === currentMonth ? item.usageCount ?? 0 : 0;
      const percentage = Math.min(100, Math.round(count / Math.max(item.monthlyUsageTarget ?? 12, 1) * 100));
      const unused = !item.lastUsedAt || Date.now() - new Date(item.lastUsedAt).getTime() > 30 * 86400000;
      const explanation = unused ? `${item.name} has no recorded use in the last 30 days.` : `${item.name} has been used ${count} ${count === 1 ? 'time' : 'times'} this month.`;
      return { id: String(item._id), name: item.name, category: item.category, lastUsedAt: item.lastUsedAt, usageCount: count, usagePercentage: percentage, health: unused ? 'REVIEW' : percentage < 25 ? 'LOW_USAGE' : 'HEALTHY', unused, explanation, recommendation: unused || percentage < 25 ? 'Consider reviewing this subscription.' : 'Usage is on track.' };
    });
    res.json(apiResponse({ dataLabel: 'MOCK / SIMULATED TRANSACTIONS', detections, usage, duplicateGroups: detections.filter((item) => item.duplicate), unusedSubscriptions: usage.filter((item) => item.unused || item.health === 'LOW_USAGE') }));
  } catch (error) { next(error); }
}

const normalizeName = (name) => String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
const detectionsDuplicate = (detection, subscriptions) => subscriptions.filter((item) => normalizeName(item.name) === normalizeName(detection.merchant)).length > 1;

export async function listTransactions(req, res, next) {
  try {
    const { q, category, recurring, from, to, sort = 'date' } = req.query;
    const filter = { user: req.user._id };
    if (category && TRANSACTION_CATEGORIES.includes(category)) filter.category = category;
    if (recurring === 'true' || recurring === 'false') filter.possibleRecurring = recurring === 'true';
    if (from || to) filter.date = { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(to) } : {}) };
    if (q) filter.merchant = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    const transactions = await Transaction.find(filter).sort({ [sort === 'amount' ? 'amount' : 'date']: -1 }).limit(250);
    res.json(apiResponse({ label: 'DEMO / SIMULATED BANK DATA', transactions: transactions.map(serialize) }));
  } catch (error) { next(error); }
}

export async function generateTransactions(req, res, next) {
  try {
    const now = new Date();
    const rows = DEMO.flatMap(([merchant, amount, category], index) => Array.from({ length: 3 }, (_, monthOffset) => ({
      user: req.user._id, merchant, amount, currency: 'INR', category,
      date: new Date(now.getFullYear(), now.getMonth() - monthOffset, 4 + (index % 12)),
      possibleRecurring: true, confidenceScore: Number((0.84 + (index % 15) / 100).toFixed(2)), source: 'GENERATED'
    })));
    const saved = await Transaction.insertMany(rows);
    res.status(201).json(apiResponse({ count: saved.length, transactions: saved.map(serialize), label: 'DEMO / SIMULATED BANK DATA' }, 'Generated simulated demo transactions.'));
  } catch (error) { next(error); }
}

export async function parseImport(req, res, next) {
  try {
    const { csv } = req.body;
    if (typeof csv !== 'string' || csv.length > 50000) throw new AppError('Provide CSV text up to 50 KB.', 400);
    const lines = csv.trim().split(/\r?\n/);
    const headers = lines.shift()?.split(',').map((value) => value.trim().toLowerCase());
    const required = ['merchant', 'amount', 'date'];
    if (!headers || required.some((key) => !headers.includes(key))) throw new AppError('CSV needs merchant, amount, and date columns.', 400);
    const parsed = lines.filter(Boolean).map((line, index) => {
      const cells = line.split(',').map((value) => value.trim());
      const row = Object.fromEntries(headers.map((header, i) => [header, cells[i] ?? '']));
      const amount = Number(row.amount); const date = new Date(row.date);
      if (!row.merchant || !Number.isFinite(amount) || amount < 0 || !Number.isFinite(date.getTime())) throw new AppError(`Invalid transaction on CSV row ${index + 2}.`, 400);
      const known = DEMO.find(([merchant]) => merchant.toLowerCase() === row.merchant.toLowerCase());
      const category = TRANSACTION_CATEGORIES.includes(row.category) ? row.category : (known?.[2] ?? 'Other');
      return { merchant: row.merchant.slice(0, 120), amount, currency: /^[A-Za-z]{3}$/.test(row.currency ?? '') ? row.currency.toUpperCase() : 'INR', date, category, possibleRecurring: /true|yes|1/i.test(row.recurring ?? '') || Boolean(known), confidenceScore: known ? 0.9 : 0.55, source: 'SIMULATED_IMPORT' };
    });
    if (!parsed.length || parsed.length > 100) throw new AppError('Import between 1 and 100 transaction rows.', 400);
    const records = await Transaction.insertMany(parsed.map((item) => ({ ...item, user: req.user._id })));
    res.status(201).json(apiResponse({ count: records.length, transactions: records.map(serialize), label: 'DEMO / SIMULATED BANK DATA' }, 'CSV parsed and imported as simulated data.'));
  } catch (error) { next(error); }
}

export async function categorizeTransaction(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Transaction not found.', 404);
    if (!TRANSACTION_CATEGORIES.includes(req.body.category)) throw new AppError('Choose a valid transaction category.', 400);
    const item = await Transaction.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { category: req.body.category }, { new: true, runValidators: true });
    if (!item) throw new AppError('Transaction not found.', 404);
    res.json(apiResponse({ transaction: serialize(item) }, 'Transaction categorized.'));
  } catch (error) { next(error); }
}
