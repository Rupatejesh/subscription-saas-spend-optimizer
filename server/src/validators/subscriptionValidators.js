import { SUBSCRIPTION_CATEGORIES, SUBSCRIPTION_STATUSES } from '../models/Subscription.js';
import { AppError } from '../utils/AppError.js';

const cycles = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'];
const fields = ['name', 'category', 'amount', 'currency', 'billingCycle', 'nextRenewalDate', 'status', 'lastUsedAt', 'notes', 'monthlyUsageTarget'];

export function validateSubscription(body = {}, partial = false) {
  const errors = {};
  if (!partial || 'name' in body) {
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 100) errors.name = 'Enter a name up to 100 characters.';
  }
  if (!partial || 'amount' in body) {
    if (typeof body.amount !== 'number' || !Number.isFinite(body.amount) || body.amount < 0 || body.amount > 1000000) errors.amount = 'Enter a valid non-negative amount.';
  }
  if (!partial || 'nextRenewalDate' in body) {
    if (!body.nextRenewalDate || Number.isNaN(Date.parse(body.nextRenewalDate))) errors.nextRenewalDate = 'Enter a valid renewal date.';
  }
  if ('category' in body && !SUBSCRIPTION_CATEGORIES.includes(body.category)) errors.category = 'Choose a valid subscription category.';
  if ('status' in body && (!SUBSCRIPTION_STATUSES.includes(body.status) || body.status === 'CANCELLATION_REQUESTED')) errors.status = 'Choose a valid subscription status.';
  if ('billingCycle' in body && !cycles.includes(body.billingCycle)) errors.billingCycle = 'Choose a valid billing cycle.';
  if ('currency' in body && (typeof body.currency !== 'string' || !/^[A-Za-z]{3}$/.test(body.currency))) errors.currency = 'Use a three-letter currency code.';
  if ('lastUsedAt' in body && body.lastUsedAt !== null && Number.isNaN(Date.parse(body.lastUsedAt))) errors.lastUsedAt = 'Enter a valid last-used date.';
  if ('notes' in body && (typeof body.notes !== 'string' || body.notes.length > 500)) errors.notes = 'Notes must be 500 characters or fewer.';
  if ('monthlyUsageTarget' in body && (!Number.isInteger(body.monthlyUsageTarget) || body.monthlyUsageTarget < 1 || body.monthlyUsageTarget > 1000)) errors.monthlyUsageTarget = 'Monthly usage target must be between 1 and 1000.';
  if (Object.keys(body).some((key) => !fields.includes(key))) errors.body = 'The request contains unsupported fields.';
  return errors;
}

export function validateSubscriptionQuery(query = {}) {
  const errors = {};
  if (query.category && !SUBSCRIPTION_CATEGORIES.includes(query.category)) errors.category = 'Choose a valid subscription category.';
  if (query.status && !SUBSCRIPTION_STATUSES.includes(query.status)) errors.status = 'Choose a valid subscription status.';
  if (query.sort && !['renewal', 'amount', 'name', 'created'].includes(query.sort)) errors.sort = 'Choose renewal, amount, name, or created sorting.';
  if (query.order && !['asc', 'desc'].includes(query.order)) errors.order = 'Choose asc or desc ordering.';
  if (query.q && (query.q.length > 100 || typeof query.q !== 'string')) errors.q = 'Search text must be 100 characters or fewer.';
  return errors;
}

export function validateSubscriptionSearch(req, _res, next) {
  const errors = validateSubscriptionQuery(req.query);
  if (Object.keys(errors).length) return next(new AppError('Please correct the subscription filters.', 400, errors));
  next();
}
