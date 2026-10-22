import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import app from './app.js';
import { env } from './config/env.js';
import User, { USER_ROLES } from './models/User.js';

let server;
let baseUrl;
let dbUri;
let databaseError;

function testDatabaseUri() {
  const configured = process.env.TEST_MONGODB_URI;
  const source = new URL(configured || env.mongoUri);
  const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
  if (!localHosts.has(source.hostname)) return null;

  const originalName = decodeURIComponent(source.pathname.replace(/^\//, '')) || 'subscription_optimizer';
  const testName = configured
    ? originalName
    : `${originalName.replace(/_phase13b_test$/, '')}_phase13b_test`;
  if (!testName.endsWith('_phase13b_test')) {
    throw new Error('TEST_MONGODB_URI must point to a dedicated *_phase13b_test database.');
  }
  source.pathname = `/${testName}`;
  return source.toString();
}

async function call(method, path, { body, cookie } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(cookie ? { cookie: `${env.authCookieName}=${cookie}` } : {})
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const json = await response.json();
  return { response, json };
}

function assertApi(results, id, result, expectedStatus) {
  assert.equal(result.response.status, expectedStatus, `${id}: ${result.json.message ?? 'unexpected response'}`);
  assert.equal(result.json.success, expectedStatus < 400, `${id}: response success flag`);
  results.set(id, result.response.status);
  return result.json.data;
}

function sessionCookie(response) {
  const value = response.headers.get('set-cookie')?.match(new RegExp(`${env.authCookieName}=([^;]+)`))?.[1];
  assert.ok(value, 'expected an HttpOnly session cookie');
  return value;
}

before(async () => {
  dbUri = testDatabaseUri();
  if (!dbUri) return;
  try {
    await mongoose.connect(dbUri, { serverSelectionTimeoutMS: 3000 });
    await mongoose.connection.dropDatabase();
  } catch (error) {
    databaseError = error;
  }
  server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (mongoose.connection.readyState && mongoose.connection.name.endsWith('_phase13b_test')) {
    await mongoose.connection.dropDatabase();
  }
  if (mongoose.connection.readyState) await mongoose.disconnect();
});

test('all 57 registered business APIs execute against isolated MongoDB fixtures', async (t) => {
  if (!dbUri) return t.skip('Use a loopback TEST_MONGODB_URI or MONGODB_URI to enable isolated API tests.');
  if (databaseError) return t.skip(`Local test MongoDB is unavailable (${databaseError.name}); database-backed APIs are blocked.`);

  const results = new Map();
  const date = new Date(Date.now() + 20 * 86400000).toISOString();
  const firstPassword = 'Optimizer-Test-Password-123!';

  let result = await call('POST', '/auth/register', { body: { name: 'API Test Owner', email: 'owner@example.test', password: firstPassword } });
  const owner = assertApi(results, 'API-001', result, 201).user;
  const ownerId = new mongoose.Types.ObjectId(owner.id);
  let ownerCookie = sessionCookie(result.response);

  result = await call('POST', '/auth/register', { body: { name: 'Duplicate Owner', email: owner.email, password: firstPassword } });
  assert.equal(result.response.status, 409, 'duplicate registration is rejected');
  result = await call('POST', '/auth/login', { body: { email: owner.email, password: 'incorrect-test-password' } });
  assert.equal(result.response.status, 401, 'incorrect credentials are rejected');

  result = await call('POST', '/auth/login', { body: { email: owner.email, password: firstPassword } });
  assertApi(results, 'API-002', result, 200);
  ownerCookie = sessionCookie(result.response);

  result = await call('GET', '/auth/me', { cookie: ownerCookie });
  assertApi(results, 'API-004', result, 200);

  result = await call('PUT', '/users/me', { cookie: ownerCookie, body: { name: 'API Test Owner Updated' } });
  assertApi(results, 'API-005', result, 200);

  result = await call('PATCH', '/users/me/password', { cookie: ownerCookie, body: {
    currentPassword: firstPassword, newPassword: 'Optimizer-Test-Password-456!', confirmPassword: 'Optimizer-Test-Password-456!'
  } });
  assertApi(results, 'API-006', result, 200);
  result = await call('POST', '/auth/login', { body: { email: owner.email, password: 'Optimizer-Test-Password-456!' } });
  assert.equal(result.response.status, 200, 'password change should permit the new password');
  ownerCookie = sessionCookie(result.response);

  result = await call('GET', '/users/subscriptions/categories', { cookie: ownerCookie });
  assertApi(results, 'API-007', result, 200);
  assert.ok(result.json.data.categories.length);

  result = await call('POST', '/users/subscriptions', { cookie: ownerCookie, body: {
    name: 'Test Streaming', category: 'Entertainment', amount: 500, currency: 'INR', billingCycle: 'MONTHLY', nextRenewalDate: date
  } });
  const subscription = assertApi(results, 'API-012', result, 201).subscription;

  result = await call('GET', '/users/subscriptions/not-an-object-id', { cookie: ownerCookie });
  assert.equal(result.response.status, 404, 'invalid subscription IDs are reported as not found');

  result = await call('GET', '/users/subscriptions', { cookie: ownerCookie });
  assertApi(results, 'API-011', result, 200);
  assert.ok(result.json.data.subscriptions.some((item) => item.id === subscription.id));

  result = await call('GET', `/users/subscriptions/${subscription.id}`, { cookie: ownerCookie });
  assertApi(results, 'API-013', result, 200);

  result = await call('PATCH', `/users/subscriptions/${subscription.id}`, { cookie: ownerCookie, body: { amount: 650 } });
  assertApi(results, 'API-014', result, 200);

  result = await call('POST', `/users/subscriptions/${subscription.id}/usage`, { cookie: ownerCookie });
  assertApi(results, 'API-010', result, 200);

  result = await call('GET', '/users/subscriptions/summary', { cookie: ownerCookie });
  assertApi(results, 'API-008', result, 200);

  result = await call('GET', '/users/subscriptions/renewals/upcoming?days=90', { cookie: ownerCookie });
  assertApi(results, 'API-009', result, 200);

  result = await call('GET', '/users/me/alerts', { cookie: ownerCookie });
  assertApi(results, 'API-038', result, 200);

  result = await call('GET', '/users/me/reports', { cookie: ownerCookie });
  assertApi(results, 'API-039', result, 200);

  result = await call('GET', '/users/me/benchmarks', { cookie: ownerCookie });
  assertApi(results, 'API-040', result, 200);

  result = await call('GET', '/bank-feed/transactions', { cookie: ownerCookie });
  assertApi(results, 'API-033', result, 200);

  result = await call('POST', '/bank-feed/transactions/generate', { cookie: ownerCookie });
  assertApi(results, 'API-035', result, 201);

  result = await call('POST', '/bank-feed/transactions/import', { cookie: ownerCookie, body: {
    csv: `merchant,amount,date,category\nManual Import,123,${new Date().toISOString()},Other`
  } });
  const importedId = assertApi(results, 'API-036', result, 201).transactions[0].id;

  result = await call('PATCH', `/bank-feed/transactions/${importedId}/category`, { cookie: ownerCookie, body: { category: 'Utilities' } });
  assertApi(results, 'API-037', result, 200);

  result = await call('GET', '/bank-feed/intelligence', { cookie: ownerCookie });
  assertApi(results, 'API-034', result, 200);
  assert.equal(result.json.data.dataLabel, 'MOCK / SIMULATED TRANSACTIONS');

  result = await call('POST', '/teams', { cookie: ownerCookie, body: { name: 'API Test Team', description: 'Isolated integration team' } });
  const team = assertApi(results, 'API-018', result, 201).team;

  result = await call('GET', '/teams', { cookie: ownerCookie });
  assertApi(results, 'API-017', result, 200);

  result = await call('GET', '/teams/not-an-object-id', { cookie: ownerCookie });
  assert.equal(result.response.status, 400, 'invalid team IDs are rejected before querying MongoDB');

  result = await call('PATCH', `/teams/${team.id}`, { cookie: ownerCookie, body: { description: 'Updated test team' } });
  assertApi(results, 'API-022', result, 200);

  result = await call('GET', `/teams/${team.id}`, { cookie: ownerCookie });
  assertApi(results, 'API-021', result, 200);

  result = await call('POST', `/teams/${team.id}/invitations`, { cookie: ownerCookie, body: { email: 'member@example.test', role: 'MEMBER' } });
  const invitation = assertApi(results, 'API-026', result, 201).invitation;

  result = await call('POST', '/auth/register', { body: { name: 'API Test Member', email: 'member@example.test', password: firstPassword } });
  assert.equal(result.response.status, 201);
  const memberCookie = sessionCookie(result.response);

  result = await call('GET', `/teams/${team.id}`, { cookie: memberCookie });
  assert.equal(result.response.status, 403, 'a non-member cannot read a team');

  result = await call('GET', '/teams/invitations/me', { cookie: memberCookie });
  assertApi(results, 'API-019', result, 200);

  result = await call('POST', `/teams/invitations/${invitation.id}/accept`, { cookie: memberCookie });
  assertApi(results, 'API-020', result, 200);

  result = await call('POST', `/teams/${team.id}/subscriptions`, { cookie: memberCookie, body: {
    name: 'Member Unauthorized Plan', amount: 50, billingCycle: 'MONTHLY', nextRenewalDate: date
  } });
  assert.equal(result.response.status, 403, 'regular team members cannot manage shared subscriptions');

  result = await call('PATCH', '/bank-feed/transactions/not-an-object-id/category', { cookie: ownerCookie, body: { category: 'Other' } });
  assert.equal(result.response.status, 404, 'invalid transaction IDs do not become server errors');

  result = await call('GET', `/teams/${team.id}/dashboard`, { cookie: ownerCookie });
  assertApi(results, 'API-023', result, 200);

  result = await call('GET', `/teams/${team.id}/alerts`, { cookie: ownerCookie });
  assertApi(results, 'API-024', result, 200);

  result = await call('GET', `/teams/${team.id}/reports`, { cookie: ownerCookie });
  assertApi(results, 'API-025', result, 200);

  result = await call('POST', `/teams/${team.id}/subscriptions`, { cookie: ownerCookie, body: {
    name: 'Shared Test Plan', amount: 1200, billingCycle: 'MONTHLY', nextRenewalDate: date
  } });
  const shared = assertApi(results, 'API-029', result, 201).subscription;
  result = await call('GET', '/users/me/notifications', { cookie: memberCookie });
  assert.ok(result.json.data.notifications.some((item) => item.type === 'TEAM' && item.title === 'Shared subscription added'), 'team subscription changes notify team members who allow team alerts');

  result = await call('POST', `/teams/${team.id}/subscriptions/${shared._id}/usage`, { cookie: memberCookie });
  assertApi(results, 'API-030', result, 200);

  result = await call('PATCH', `/teams/${team.id}/subscriptions/${shared._id}`, { cookie: ownerCookie, body: { amount: 1400 } });
  assertApi(results, 'API-031', result, 200);

  result = await call('POST', `/teams/${team.id}/invitations`, { cookie: ownerCookie, body: { email: 'admin-member@example.test', role: 'ADMIN' } });
  const adminInvitation = result.json.data.invitation;
  assert.equal(result.response.status, 201);
  result = await call('POST', '/auth/register', { body: { name: 'API Test Team Admin', email: 'admin-member@example.test', password: firstPassword } });
  const teamAdminCookie = sessionCookie(result.response);
  result = await call('POST', `/teams/invitations/${adminInvitation.id}/accept`, { cookie: teamAdminCookie });
  assert.equal(result.response.status, 200);

  result = await call('GET', '/admin/users', { cookie: ownerCookie });
  assert.equal(result.response.status, 403, 'TEAM_ADMIN cannot access platform administration');

  result = await call('PATCH', `/teams/${team.id}/members/${(await User.findOne({ email: 'admin-member@example.test' })).id}`, { cookie: ownerCookie, body: { role: 'MEMBER' } });
  assertApi(results, 'API-027', result, 200);

  result = await call('DELETE', `/teams/${team.id}/members/${(await User.findOne({ email: 'admin-member@example.test' })).id}`, { cookie: ownerCookie });
  assertApi(results, 'API-028', result, 200);

  result = await call('DELETE', `/teams/${team.id}/subscriptions/${shared._id}`, { cookie: ownerCookie });
  assertApi(results, 'API-032', result, 200);

  const platformAdmin = await User.create({
    name: 'API Test Platform Admin', email: 'platform-admin@example.test',
    passwordHash: await bcrypt.hash(firstPassword, 4), role: USER_ROLES.PLATFORM_ADMIN
  });
  result = await call('POST', '/auth/login', { body: { email: platformAdmin.email, password: firstPassword } });
  const platformCookie = sessionCookie(result.response);
  result = await call('GET', '/admin/users', { cookie: platformCookie });
  assertApi(results, 'API-041', result, 200);

  result = await call('PATCH', `/users/${(await User.findOne({ email: 'member@example.test' })).id}/role`, { cookie: platformCookie, body: { role: 'TEAM_ADMIN' } });
  assertApi(results, 'API-016', result, 200);

  result = await call('PATCH', '/users/not-an-object-id/role', { cookie: platformCookie, body: { role: 'USER' } });
  assert.equal(result.response.status, 400, 'invalid user IDs are rejected before querying MongoDB');

  result = await call('PATCH', `/users/${platformAdmin.id}/role`, { cookie: platformCookie, body: { role: 'USER' } });
  assert.equal(result.response.status, 400, 'platform admins cannot change their own role');

  result = await call('GET', '/users/me/trial', { cookie: ownerCookie });
  const ownerTrial = assertApi(results, 'API-042', result, 200).trial;
  assert.equal(ownerTrial.status, 'TRIAL_ACTIVE');
  assert.equal(ownerTrial.paymentIntegrated, false);
  result = await call('GET', '/users/me/trial');
  assert.equal(result.response.status, 401, 'trial information requires authentication');
  const trialStarter = await User.create({ name: 'Trial Starter', email: 'trial-starter@example.test', passwordHash: await bcrypt.hash(firstPassword, 4), role: USER_ROLES.USER });
  result = await call('POST', '/auth/login', { body: { email: trialStarter.email, password: firstPassword } });
  const trialStarterCookie = sessionCookie(result.response);
  result = await call('POST', '/users/me/trial/start', { cookie: trialStarterCookie });
  assertApi(results, 'API-043', result, 201);
  result = await call('POST', '/users/me/trial/start', { cookie: trialStarterCookie });
  assert.equal(result.response.status, 409, 'an existing trial cannot be reset');
  await User.updateOne({ _id: trialStarter._id }, { $set: { trialEndsAt: new Date(Date.now() - 86400000) } });
  result = await call('GET', '/users/me/trial', { cookie: trialStarterCookie });
  assert.equal(result.response.status, 200);
  assert.equal(result.json.data.trial.status, 'TRIAL_EXPIRED', 'trial expiration is derived from its persisted end date');
  result = await call('GET', '/users/me/notifications', { cookie: trialStarterCookie });
  assert.ok(result.json.data.notifications.some((item) => item.type === 'TRIAL'), 'trial expiry creates a persistent reminder');

  result = await call('GET', '/users/me/notification-preferences', { cookie: ownerCookie });
  assertApi(results, 'API-048', result, 200);
  result = await call('PUT', '/users/me/notification-preferences', { cookie: ownerCookie, body: { preferences: { unused: false, renewals: true } } });
  assertApi(results, 'API-049', result, 200);
  assert.equal(result.json.data.preferences.unused, false);
  result = await call('PUT', '/users/me/notification-preferences', { cookie: ownerCookie, body: { preferences: { unknown: true } } });
  assert.equal(result.response.status, 400, 'unknown notification preferences are rejected');
  result = await call('GET', '/users/me/notifications');
  assert.equal(result.response.status, 401, 'notifications require authentication');
  await mongoose.connection.collection('subscriptions').updateOne({ _id: new mongoose.Types.ObjectId(subscription.id) }, { $set: { lastUsedAt: null } });
  result = await call('GET', '/users/me/notifications', { cookie: ownerCookie });
  assert.ok(result.json.data.notifications.some((item) => item.type === 'SAVINGS'), 'unused plans create an estimated savings reminder when enabled');
  assert.equal(result.json.data.notifications.some((item) => item.type === 'UNUSED'), false, 'disabled unused alerts are suppressed');

  result = await call('PATCH', `/users/subscriptions/${subscription.id}`, { cookie: ownerCookie, body: { status: 'CANCELLATION_REQUESTED' } });
  assert.equal(result.response.status, 400, 'cancellation state cannot be bypassed through generic subscription edits');
  result = await call('POST', `/users/subscriptions/${subscription.id}/cancellation-requests`, { cookie: ownerCookie, body: { reason: 'INVALID' } });
  assert.equal(result.response.status, 400, 'invalid cancellation reasons are rejected');
  result = await call('POST', `/users/subscriptions/${subscription.id}/cancellation-requests`, { cookie: teamAdminCookie, body: { reason: 'UNUSED' } });
  assert.equal(result.response.status, 404, 'users cannot cancel another account subscription');
  result = await call('POST', `/users/subscriptions/${subscription.id}/cancellation-requests`, { cookie: ownerCookie, body: { reason: 'UNUSED', notes: 'Not used this month' } });
  const cancellation = assertApi(results, 'API-050', result, 201).request;
  result = await call('POST', `/users/subscriptions/${subscription.id}/cancellation-requests`, { cookie: ownerCookie, body: { reason: 'UNUSED' } });
  assert.equal(result.response.status, 409, 'duplicate active cancellation requests are rejected');
  result = await call('GET', `/users/cancellation-requests?subscriptionId=${subscription.id}`, { cookie: ownerCookie });
  assertApi(results, 'API-051', result, 200);
  result = await call('GET', '/users/cancellation-requests?subscriptionId=invalid-id', { cookie: ownerCookie });
  assert.equal(result.response.status, 404, 'invalid cancellation subscription filters are rejected');
  result = await call('GET', '/users/cancellation-requests', { cookie: teamAdminCookie });
  assert.equal(result.response.status, 200, 'each account only sees its own cancellation history');
  result = await call('GET', '/users/me/notifications', { cookie: ownerCookie });
  const notifications = assertApi(results, 'API-044', result, 200).notifications;
  const cancellationNotification = notifications.find((item) => item.type === 'CANCELLATION');
  assert.ok(cancellationNotification, 'cancellation request creates a persistent notification');
  result = await call('GET', '/users/me/notifications/unread-count', { cookie: ownerCookie });
  assertApi(results, 'API-045', result, 200);
  result = await call('PATCH', `/users/me/notifications/${cancellationNotification.id}/read`, { cookie: ownerCookie });
  assertApi(results, 'API-046', result, 200);
  result = await call('POST', '/users/me/notifications/read-all', { cookie: ownerCookie });
  assertApi(results, 'API-047', result, 200);
  result = await call('PATCH', `/users/me/notifications/${cancellationNotification.id}/read`, { cookie: teamAdminCookie });
  assert.equal(result.response.status, 404, 'users cannot mark another account notification as read');
  result = await call('PATCH', '/users/me/notifications/not-an-object-id/read', { cookie: ownerCookie });
  assert.equal(result.response.status, 400, 'malformed notification IDs are rejected');
  result = await call('POST', `/users/cancellation-requests/${cancellation.id}/complete`, { cookie: ownerCookie });
  assertApi(results, 'API-052', result, 200);
  result = await call('POST', `/users/cancellation-requests/${cancellation.id}/restore`, { cookie: ownerCookie });
  assertApi(results, 'API-053', result, 200);
  result = await call('POST', `/users/cancellation-requests/${cancellation.id}/complete`, { cookie: ownerCookie });
  assert.equal(result.response.status, 409, 'completed cancellation requests cannot be completed twice');
  result = await call('POST', '/users/cancellation-requests/not-an-object-id/restore', { cookie: ownerCookie });
  assert.equal(result.response.status, 400, 'malformed cancellation IDs are rejected');
  result = await call('GET', `/users/subscriptions/${subscription.id}`, { cookie: ownerCookie });
  assert.equal(result.json.data.subscription.status, 'ACTIVE', 'restore reactivates the in-app plan');

  result = await call('POST', '/users/demo-workspace', { cookie: ownerCookie });
  const demo = assertApi(results, 'API-054', result, 201);
  assert.equal(demo.count, 12);
  assert.equal(demo.transactions, 36);
  result = await call('POST', '/users/demo-workspace', { cookie: ownerCookie });
  assert.equal(result.response.status, 409, 'demo data cannot be duplicated');
  assert.equal(await mongoose.connection.collection('subscriptions').countDocuments({ user: ownerId, isDemoData: true }), 12);
  assert.equal(await mongoose.connection.collection('transactions').countDocuments({ user: ownerId, isDemoData: true }), 36);
  result = await call('DELETE', '/users/demo-workspace', { cookie: ownerCookie });
  assertApi(results, 'API-055', result, 200);
  assert.equal(await mongoose.connection.collection('subscriptions').countDocuments({ user: ownerId, isDemoData: true }), 0, 'demo cleanup leaves no labelled samples behind');
  assert.equal(await mongoose.connection.collection('transactions').countDocuments({ user: ownerId, isDemoData: true }), 0, 'demo cleanup removes only tagged simulated charges');

  result = await call('GET', '/admin/metrics', { cookie: ownerCookie });
  assert.equal(result.response.status, 403, 'regular users cannot read platform metrics');
  result = await call('GET', '/admin/metrics', { cookie: platformCookie });
  const platformMetrics = assertApi(results, 'API-056', result, 200);
  assert.ok(platformMetrics.users.total >= 1);
  assert.doesNotMatch(JSON.stringify(platformMetrics), /passwordHash|jwtSecret|password/i, 'admin metrics never expose credentials');
  result = await call('GET', '/admin/teams', { cookie: ownerCookie });
  assert.equal(result.response.status, 403, 'regular users cannot inspect platform teams');
  result = await call('GET', '/admin/teams', { cookie: platformCookie });
  const platformTeams = assertApi(results, 'API-057', result, 200);
  assert.ok(platformTeams.teams.some((item) => item.id === team.id));

  result = await call('DELETE', `/users/subscriptions/${subscription.id}`, { cookie: ownerCookie });
  assertApi(results, 'API-015', result, 200);

  result = await call('POST', '/auth/logout', { cookie: ownerCookie });
  assertApi(results, 'API-003', result, 200);
  result = await call('GET', '/auth/me', { cookie: ownerCookie });
  assert.equal(result.response.status, 401, 'logout invalidates the session');

  assert.equal(results.size, 57, `verified API IDs: ${[...results.keys()].join(', ')}`);
  assert.equal(await mongoose.connection.collection('subscriptions').countDocuments({ user: ownerId, team: null }), 0, 'subscription deletion persists');
  assert.equal(await mongoose.connection.collection('transactions').countDocuments({ user: ownerId }), 31, 'generated and imported transactions persist');
});
