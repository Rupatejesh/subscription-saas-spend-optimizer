import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSpendForecast } from './spendForecast.js';

test('forecasts active monthly equivalents, categories, and unused savings in one currency', () => {
  const now = new Date('2026-10-06T12:00:00Z');
  const subscriptions = [
    { id: '1', name: 'Design Tool', category: 'Design', amount: 1200, currency: 'INR', billingCycle: 'YEARLY', status: 'ACTIVE', lastUsedAt: '2026-09-30T12:00:00Z', nextRenewalDate: '2027-01-01' },
    { id: '2', name: 'Stream', category: 'Entertainment', amount: 300, currency: 'INR', billingCycle: 'MONTHLY', status: 'ACTIVE', lastUsedAt: null, nextRenewalDate: '2026-10-20' },
    { id: '3', name: 'Other currency', category: 'Other', amount: 50, currency: 'USD', billingCycle: 'MONTHLY', status: 'ACTIVE', lastUsedAt: null, nextRenewalDate: '2026-10-22' },
    { id: '4', name: 'Paused', category: 'Other', amount: 900, currency: 'INR', billingCycle: 'MONTHLY', status: 'PAUSED', lastUsedAt: null, nextRenewalDate: '2026-10-23' }
  ];
  const result = buildSpendForecast(subscriptions, now, 'INR');
  assert.equal(result.monthlySpend, 400);
  assert.equal(result.annualSpend, 4800);
  assert.equal(result.monthlySavings, 300);
  assert.equal(result.unusedInCurrency.length, 1);
  assert.deepEqual(result.categories.map(({ category }) => category), ['Entertainment', 'Design']);
  assert.equal(result.renewalsNext30Days.length, 2);
  assert.equal(result.healthScore, 33);
});

test('returns zero spend and a full score for an empty active list', () => {
  const result = buildSpendForecast([], new Date('2026-10-06T12:00:00Z'), 'INR');
  assert.equal(result.monthlySpend, 0);
  assert.equal(result.annualSpend, 0);
  assert.equal(result.healthScore, 100);
  assert.equal(result.categories.length, 0);
});
