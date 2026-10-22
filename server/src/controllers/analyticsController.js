import Subscription, { SUBSCRIPTION_CATEGORIES } from '../models/Subscription.js';
import Team from '../models/Team.js';
import { AppError } from '../utils/AppError.js';
import { apiResponse } from '../utils/apiResponse.js';

const DAY = 86400000;
const FACTOR = { WEEKLY: 52 / 12, MONTHLY: 1, QUARTERLY: 1 / 3, YEARLY: 1 / 12 };
const monthlyCost = (item) => Number(item.amount) * (FACTOR[item.billingCycle] ?? 1);
const peerAverageINR = Object.freeze({ Entertainment: 900, Productivity: 1500, 'Cloud Storage': 600, Design: 900, 'AI Tools': 1000, Utilities: 400, Other: 700 });
const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const usageThisMonth = (item, now) => item.usageMonth === monthKey(now) ? Number(item.usageCount) || 0 : 0;
const unused = (item, now) => !item.lastUsedAt || now.getTime() - new Date(item.lastUsedAt).getTime() > 30 * DAY;
const groupByCurrency = (items, pick) => {
  const totals = new Map();
  for (const item of items) {
    const currency = item.currency || 'INR';
    totals.set(currency, (totals.get(currency) ?? 0) + pick(item));
  }
  return [...totals].map(([currency, amount]) => ({ currency, amount: Number(amount.toFixed(2)) }));
};
async function teamSubscriptions(teamId, userId) {
  const team = await Team.findById(teamId);
  if (!team) throw new AppError('Team not found.', 404);
  if (!team.members.some((member) => String(member.user) === String(userId))) throw new AppError('You are not a member of this team.', 403);
  const subscriptions = await Subscription.find({ team: team._id, isShared: true, status: 'ACTIVE' }).sort({ nextRenewalDate: 1 });
  return { team, subscriptions };
}
function daysUntil(value, now) { return Math.ceil((new Date(value).getTime() - now.getTime()) / DAY); }
function personalCategorySpending(items) {
  const totals = new Map();
  for (const item of items) {
    const key = `${item.currency || 'INR'}:${item.category}`;
    totals.set(key, (totals.get(key) ?? 0) + monthlyCost(item));
  }
  return [...totals].map(([key, amount]) => {
    const [currency, category] = key.split(':');
    return { currency, category, monthlySpend: Number(amount.toFixed(2)), annualEstimate: Number((amount * 12).toFixed(2)) };
  }).sort((a, b) => a.currency.localeCompare(b.currency) || b.monthlySpend - a.monthlySpend);
}

export async function getPersonalAlerts(req, res, next) {
  try {
    const now = new Date();
    const items = await Subscription.find({ user: req.user._id, team: null, status: 'ACTIVE' }).sort({ nextRenewalDate: 1 }).lean();
    const alerts = [];
    for (const item of items) {
      const days = daysUntil(item.nextRenewalDate, now);
      if (days >= 0 && days <= 30) alerts.push({ id: `renewal-${item._id}`, type: 'RENEWAL', severity: days <= 7 ? 'HIGH' : 'INFO', title: `${item.name} renews soon`, message: days === 0 ? 'This subscription is due to renew today.' : `Renewal is due in ${days} day${days === 1 ? '' : 's'}.`, subscriptionId: String(item._id), dueAt: item.nextRenewalDate, amount: item.amount, currency: item.currency });
      if (unused(item, now)) alerts.push({ id: `unused-${item._id}`, type: 'UNUSED', severity: 'INFO', title: `${item.name} has low recent usage`, message: 'No use was recorded in the last 30 days. Review whether this plan is still needed.', subscriptionId: String(item._id), monthlyCost: Number(monthlyCost(item).toFixed(2)), currency: item.currency });
    }
    const unusedItems = items.filter((item) => unused(item, now));
    const potentialSavings = groupByCurrency(unusedItems, monthlyCost);
    for (const saving of potentialSavings.filter((item) => item.amount > 0)) alerts.push({ id: `savings-${saving.currency}`, type: 'SAVINGS', severity: 'INFO', title: 'Potential subscription savings', message: `Unused plans cost about ${saving.amount.toFixed(2)} ${saving.currency} per month.`, monthlyAmount: saving.amount, currency: saving.currency });
    const byCategory = personalCategorySpending(items.filter((item) => item.currency === 'INR'));
    for (const category of byCategory) {
      const average = peerAverageINR[category.category];
      if (average && category.monthlySpend > average * 1.1) alerts.push({ id: `spending-${category.category}`, type: 'SPENDING', severity: 'INFO', title: `${category.category} spending is above the demo average`, message: `Your monthly estimate is ${category.monthlySpend.toFixed(2)} INR; the simulated peer reference is ${average.toFixed(2)} INR.`, category: category.category, monthlySpend: category.monthlySpend, peerAverage: average, currency: 'INR' });
    }
    res.json(apiResponse({ generatedAt: now, source: 'YOUR_SUBSCRIPTIONS_AND_DEMO_REFERENCES', alerts }));
  } catch (error) { next(error); }
}

export async function getPersonalReport(req, res, next) {
  try {
    const now = new Date();
    const items = await Subscription.find({ user: req.user._id, team: null }).sort({ nextRenewalDate: 1 }).lean();
    const active = items.filter((item) => item.status === 'ACTIVE');
    const totals = groupByCurrency(active, monthlyCost).map(({ currency, amount }) => ({ currency, monthlySpend: amount, annualEstimate: Number((amount * 12).toFixed(2)), potentialMonthlySavings: Number(active.filter((item) => item.currency === currency && unused(item, now)).reduce((sum, item) => sum + monthlyCost(item), 0).toFixed(2)) }));
    const categorySpending = personalCategorySpending(active);
    const renewals = active.filter((item) => { const days = daysUntil(item.nextRenewalDate, now); return days >= 0 && days <= 90; }).map((item) => ({ id: String(item._id), name: item.name, category: item.category, dueAt: item.nextRenewalDate, daysUntil: daysUntil(item.nextRenewalDate, now), amount: item.amount, currency: item.currency, billingCycle: item.billingCycle }));
    const forecast = totals.map(({ currency, monthlySpend }) => ({ currency, months: Array.from({ length: 6 }, (_, index) => { const date = new Date(now.getFullYear(), now.getMonth() + index + 1, 1); return { month: date.toLocaleString('en', { month: 'short', year: 'numeric' }), amount: monthlySpend }; }) }));
    const currentMonth = monthKey(now);
    const subscriptionUsage = items.map((item) => ({ id: String(item._id), name: item.name, category: item.category, status: item.status, currency: item.currency, monthlyCost: Number(monthlyCost(item).toFixed(2)), usageCount: usageThisMonth(item, now), monthlyUsageTarget: item.monthlyUsageTarget, usageMonth: currentMonth, lastUsedAt: item.lastUsedAt ?? null }));
    const savings = active.filter((item) => unused(item, now)).map((item) => ({ subscriptionId: String(item._id), name: item.name, category: item.category, monthlyAmount: Number(monthlyCost(item).toFixed(2)), currency: item.currency }));
    res.json(apiResponse({ simulatedData: true, asOf: now, period: currentMonth, notes: ['Spend and forecast use declared recurring plan prices, not transaction history.', 'Annual spend is a 12-month estimate at current active plan prices.', 'Usage reflects manually recorded activity.'], totals, categorySpending, subscriptionUsage, savings, renewals, forecast }));
  } catch (error) { next(error); }
}

export async function getPeerBenchmarks(req, res, next) {
  try {
    const now = new Date();
    const items = await Subscription.find({ user: req.user._id, team: null, status: 'ACTIVE', currency: 'INR' }).lean();
    const own = new Map();
    for (const item of items) own.set(item.category, (own.get(item.category) ?? 0) + monthlyCost(item));
    const comparisons = SUBSCRIPTION_CATEGORIES.map((category) => {
      const monthlySpend = Number((own.get(category) ?? 0).toFixed(2));
      const demoAverage = peerAverageINR[category] ?? 700;
      const difference = monthlySpend - demoAverage;
      const comparison = difference > demoAverage * 0.1 ? 'HIGHER' : difference < -demoAverage * 0.1 ? 'LOWER' : 'SIMILAR';
      return { category, currency: 'INR', monthlySpend, demoAverage: Number(demoAverage.toFixed(2)), difference: Number(difference.toFixed(2)), comparison, message: comparison === 'HIGHER' ? `Your ${category.toLowerCase()} subscription spending is higher than the demo peer average.` : comparison === 'LOWER' ? `Your ${category.toLowerCase()} subscription spending is lower than the demo peer average.` : `Your ${category.toLowerCase()} subscription spending is close to the demo peer average.` };
    }).filter((item) => item.monthlySpend > 0);
    res.json(apiResponse({ source: 'SIMULATED_DEMO_AGGREGATES', currency: 'INR', generatedAt: now, comparisons, privacy: 'Comparisons use fixed aggregate demo reference values. No other users’ records or identifying data are read or returned.' }));
  } catch (error) { next(error); }
}

export async function getTeamAlerts(req, res, next) {
  try {
    const now = new Date();
    const { team, subscriptions } = await teamSubscriptions(req.params.teamId, req.user._id);
    const alerts = [];
    for (const item of subscriptions) {
      const days = daysUntil(item.nextRenewalDate, now);
      if (days >= 0 && days <= 30) alerts.push({ id: `renewal-${item._id}`, type: 'TEAM_RENEWAL', severity: days <= 7 ? 'HIGH' : 'INFO', title: `${item.name} renews soon`, message: `Shared plan renewal is due in ${days} day${days === 1 ? '' : 's'}.`, subscriptionId: String(item._id), dueAt: item.nextRenewalDate, amount: item.amount, currency: item.currency });
      const usageCount = (item.memberUsage ?? []).filter((entry) => entry.usageMonth === monthKey(now)).reduce((sum, entry) => sum + entry.usageCount, 0);
      if (usageCount < 3) alerts.push({ id: `unused-${item._id}`, type: 'TEAM_UNUSED', severity: 'INFO', title: `Review ${item.name} usage`, message: `Team members recorded ${usageCount} uses this month.`, subscriptionId: String(item._id), monthlyCost: Number(monthlyCost(item).toFixed(2)), currency: item.currency });
    }
    const monthlySpend = subscriptions.reduce((sum, item) => sum + monthlyCost(item), 0);
    if (team.currency === 'INR' && monthlySpend > 15000) alerts.push({ id: 'team-spending-demo-reference', type: 'TEAM_SPENDING', severity: 'INFO', title: 'Team spend is above the demo reference', message: `Current recurring spend is ${monthlySpend.toFixed(2)} INR per month; the simulated team reference is 15000 INR.`, monthlySpend: Number(monthlySpend.toFixed(2)), demoAverage: 15000, currency: 'INR' });
    const unusedCost = subscriptions.filter((item) => (item.memberUsage ?? []).filter((entry) => entry.usageMonth === monthKey(now)).reduce((sum, entry) => sum + entry.usageCount, 0) < 3).reduce((sum, item) => sum + monthlyCost(item), 0);
    if (unusedCost > 0) alerts.push({ id: 'team-savings-opportunity', type: 'TEAM_SAVINGS', severity: 'INFO', title: 'Potential team savings', message: `Low-usage shared plans cost about ${unusedCost.toFixed(2)} ${team.currency} per month.`, monthlyAmount: Number(unusedCost.toFixed(2)), currency: team.currency });
    res.json(apiResponse({ team: { id: String(team._id), name: team.name, currency: team.currency }, generatedAt: now, alerts }));
  } catch (error) { next(error); }
}

export async function getTeamReport(req, res, next) {
  try {
    const now = new Date();
    const { team, subscriptions } = await teamSubscriptions(req.params.teamId, req.user._id);
    const monthlySpend = subscriptions.reduce((sum, item) => sum + monthlyCost(item), 0);
    const categorySpending = SUBSCRIPTION_CATEGORIES.map((category) => ({ category, monthlySpend: Number(subscriptions.filter((item) => item.category === category).reduce((sum, item) => sum + monthlyCost(item), 0).toFixed(2)) })).filter((item) => item.monthlySpend > 0);
    const subscriptionUsage = subscriptions.map((item) => ({ id: String(item._id), name: item.name, category: item.category, monthlyCost: Number(monthlyCost(item).toFixed(2)), usesThisMonth: (item.memberUsage ?? []).filter((entry) => entry.usageMonth === monthKey(now)).reduce((sum, entry) => sum + entry.usageCount, 0), status: item.status }));
    const unused = subscriptions.filter((item) => subscriptionUsage.find((entry) => entry.id === String(item._id)).usesThisMonth < 3);
    const renewals = subscriptions.filter((item) => { const days = daysUntil(item.nextRenewalDate, now); return days >= 0 && days <= 90; }).map((item) => ({ id: String(item._id), name: item.name, dueAt: item.nextRenewalDate, amount: item.amount, currency: item.currency, daysUntil: daysUntil(item.nextRenewalDate, now) }));
    const forecast = Array.from({ length: 6 }, (_, index) => ({ month: new Date(now.getFullYear(), now.getMonth() + index + 1, 1).toLocaleString('en', { month: 'short', year: 'numeric' }), amount: Number(monthlySpend.toFixed(2)), currency: team.currency }));
    res.json(apiResponse({ simulatedData: true, asOf: now, team: { id: String(team._id), name: team.name, currency: team.currency }, monthlySpend: Number(monthlySpend.toFixed(2)), annualEstimate: Number((monthlySpend * 12).toFixed(2)), categorySpending, subscriptionUsage, potentialMonthlySavings: Number(unused.reduce((sum, item) => sum + monthlyCost(item), 0).toFixed(2)), renewals, forecast, notes: ['Spend and forecast use declared recurring plan prices, not transaction history.', 'Usage reflects activity manually logged by team members.'] }));
  } catch (error) { next(error); }
}
