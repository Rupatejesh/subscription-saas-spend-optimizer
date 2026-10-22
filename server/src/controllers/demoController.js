import Subscription from '../models/Subscription.js';
import Transaction from '../models/Transaction.js';
import { AppError } from '../utils/AppError.js';
import { apiResponse } from '../utils/apiResponse.js';

const SAMPLES = [
  ['Amazon Prime', 'Entertainment', 1499, 'YEARLY'], ['Netflix', 'Entertainment', 649, 'MONTHLY'], ['Spotify', 'Entertainment', 119, 'MONTHLY'],
  ['YouTube Premium', 'Entertainment', 129, 'MONTHLY'], ['Microsoft 365', 'Productivity', 4899, 'YEARLY'], ['Adobe Creative Cloud', 'Design', 1999, 'MONTHLY'],
  ['Canva', 'Design', 499, 'MONTHLY'], ['Google One', 'Cloud Storage', 130, 'MONTHLY'], ['Dropbox', 'Cloud Storage', 999, 'MONTHLY'],
  ['Notion', 'Productivity', 800, 'MONTHLY'], ['GitHub', 'Productivity', 400, 'MONTHLY'], ['ChatGPT', 'AI Tools', 1950, 'MONTHLY']
];

export async function loadDemoWorkspace(req, res, next) {
  try {
    if (await Subscription.exists({ user: req.user._id, isDemoData: true })) throw new AppError('Demo workspace data is already loaded. Remove it before loading it again.', 409);
    const now = new Date();
    const subscriptions = await Subscription.insertMany(SAMPLES.map(([name, category, amount, billingCycle], index) => ({
      user: req.user._id, team: null, isShared: false, isDemoData: true, name, category, amount,
      currency: 'INR', billingCycle, status: 'ACTIVE', monthlyUsageTarget: 12,
      nextRenewalDate: new Date(now.getTime() + (index % 25 + 1) * 86400000),
      lastUsedAt: index % 4 === 0 ? null : new Date(now.getTime() - (index % 4 + 1) * 86400000),
      notes: 'DEMO / SIMULATED DATA — sample only'
    })));
    let transactions;
    try { transactions = await Transaction.insertMany(subscriptions.flatMap((item) => {
      const interval = { WEEKLY: 7, MONTHLY: 30, QUARTERLY: 90, YEARLY: 365 }[item.billingCycle];
      return Array.from({ length: 3 }, (_, period) => ({ user: req.user._id, merchant: item.name, amount: item.amount, currency: item.currency, category: item.category, date: new Date(now.getTime() - (period + 1) * interval * 86400000), possibleRecurring: true, confidenceScore: 0.92, source: 'GENERATED', isDemoData: true }));
    })); } catch (error) {
      await Promise.allSettled([Subscription.deleteMany({ user: req.user._id, isDemoData: true }), Transaction.deleteMany({ user: req.user._id, isDemoData: true })]);
      throw error;
    }
    res.status(201).json(apiResponse({ label: 'DEMO / SIMULATED DATA', count: subscriptions.length, transactions: transactions.length, subscriptions: subscriptions.map((item) => ({ id: String(item._id), name: item.name })) }, 'Demo workspace loaded. Sample plans and transactions are labelled and can be removed.'));
  } catch (error) { next(error); }
}

export async function removeDemoWorkspace(req, res, next) {
  try {
    const subscriptions = await Subscription.deleteMany({ user: req.user._id, isDemoData: true });
    const transactions = await Transaction.deleteMany({ user: req.user._id, isDemoData: true });
    if (!subscriptions.deletedCount && !transactions.deletedCount) throw new AppError('No demo workspace data is loaded.', 404);
    res.json(apiResponse({ subscriptionsRemoved: subscriptions.deletedCount, transactionsRemoved: transactions.deletedCount }, 'Only labelled demo data was removed.'));
  } catch (error) { next(error); }
}
