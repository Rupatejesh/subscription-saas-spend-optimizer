import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import app from './app.js';

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('registration rejects invalid input with a safe field-level response before database access', async () => {
  const response = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: '', email: 'not-an-email', password: 'short' })
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.equal(body.message, 'Please correct the highlighted fields.');
  assert.ok(body.details.name);
  assert.ok(body.details.email);
  assert.ok(body.details.password);
  assert.doesNotMatch(JSON.stringify(body), /stack|mongodb|passwordHash|secret/i);
});

test('login rejects malformed input without disclosing account information', async () => {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'bad', password: '' })
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.ok(body.details.email);
  assert.ok(body.details.password);
});

test('private subscription endpoint rejects requests without a session', async () => {
  const response = await fetch(`${baseUrl}/users/subscriptions`);
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.success, false);
  assert.equal(body.message, 'Please sign in to continue.');
});

test('platform administration endpoint rejects requests without a session', async () => {
  const response = await fetch(`${baseUrl}/admin/users`);
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.success, false);
  assert.equal(body.message, 'Please sign in to continue.');
});

test('authentication rejects malformed session tokens', async () => {
  const response = await fetch(`${baseUrl}/auth/me`, { headers: { cookie: 'optimizer_session=not-a-valid-jwt' } });
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.success, false);
  assert.equal(body.message, 'Your session has expired. Please sign in again.');
});
