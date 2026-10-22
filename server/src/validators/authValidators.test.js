import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLogin, validatePassword, validatePasswordChange, validateRegistration } from './authValidators.js';

test('registration requires a valid name, email, and long password', () => {
  assert.deepEqual(validateRegistration({ name: 'Ada Lovelace', email: 'ada@example.com', password: 'a-secure-password' }), {});
  assert.equal(validateRegistration({ name: 'A', email: 'bad', password: 'short' }).name, 'Name must be between 2 and 80 characters.');
});

test('password bounds are enforced without requiring arbitrary character classes', () => {
  assert.equal(validatePassword('twelve chars'), true);
  assert.equal(validatePassword('short'), false);
  assert.equal(validatePassword('x'.repeat(129)), false);
});

test('login gives a generic shape validation without exposing account existence', () => {
  assert.deepEqual(validateLogin({ email: 'ada@example.com', password: 'anything' }), {});
  assert.ok(validateLogin({ email: 'ada@example.com' }).password);
});

test('password change requires current password and matching valid new passwords', () => {
  assert.deepEqual(validatePasswordChange({ currentPassword: 'old', newPassword: 'new-password-123', confirmPassword: 'new-password-123' }), {});
  assert.ok(validatePasswordChange({ currentPassword: 'old', newPassword: 'new-password-123', confirmPassword: 'different-password' }).confirmPassword);
});
