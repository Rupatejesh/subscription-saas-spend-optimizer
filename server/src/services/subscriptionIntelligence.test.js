import test from 'node:test';
import assert from 'node:assert/strict';
import { detectRecurringPayments } from './subscriptionIntelligence.js';

test('detects normalized known merchants on monthly cadence and reports confidence', () => {
  const rows = [
    { _id: '1', merchant: 'SPOTIFY PTE', amount: 119, date: '2026-08-01', currency: 'INR' },
    { _id: '2', merchant: 'Spotify', amount: 119, date: '2026-09-01', currency: 'INR' },
    { _id: '3', merchant: 'Spotify Premium', amount: 119, date: '2026-10-01', currency: 'INR' }
  ];
  const [found] = detectRecurringPayments(rows);
  assert.equal(found.merchant, 'Spotify');
  assert.equal(found.billingCycle, 'MONTHLY');
  assert.equal(found.occurrenceCount, 3);
  assert.ok(found.confidenceScore >= 0.8);
});

test('ignores one-off and irregular transactions and flags existing duplicates', () => {
  const monthly = [
    { _id: '1', merchant: 'Netflix', amount: 649, date: '2026-08-01' },
    { _id: '2', merchant: 'Netflix', amount: 649, date: '2026-09-01' }
  ];
  assert.equal(detectRecurringPayments([{ merchant: 'One off', amount: 20, date: '2026-08-01' }]).length, 0);
  assert.equal(detectRecurringPayments(monthly, [{ _id: 's1', name: 'Netflix' }, { _id: 's2', name: 'netflix' }])[0].duplicate, true);
});
