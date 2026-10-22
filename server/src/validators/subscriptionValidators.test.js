import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSubscription, validateSubscriptionQuery } from './subscriptionValidators.js';

const valid = { name: 'Cloud tool', amount: 10, nextRenewalDate: '2026-12-01' };

test('subscription creation validates amount, date, name, and optional enums', () => {
  assert.deepEqual(validateSubscription(valid), {});
  assert.ok(validateSubscription({ ...valid, amount: -1 }).amount);
  assert.ok(validateSubscription({ ...valid, nextRenewalDate: 'soon' }).nextRenewalDate);
  assert.ok(validateSubscription({ ...valid, status: 'UNKNOWN' }).status);
  assert.ok(validateSubscription({ ...valid, extra: true }).body);
});

test('partial subscription updates validate provided values and allow an empty patch', () => {
  assert.deepEqual(validateSubscription({ status: 'PAUSED' }, true), {});
  assert.ok(validateSubscription({ amount: '10' }, true).amount);
  assert.ok(validateSubscription({ billingCycle: 'DAILY' }, true).billingCycle);
});

test('subscription list query accepts supported filters and rejects invalid sort options', () => {
  assert.deepEqual(validateSubscriptionQuery({ q: 'cloud', category: 'Cloud Storage', status: 'ACTIVE', sort: 'amount', order: 'desc' }), {});
  assert.ok(validateSubscriptionQuery({ sort: 'password' }).sort);
  assert.ok(validateSubscriptionQuery({ category: 'Bank' }).category);
});
