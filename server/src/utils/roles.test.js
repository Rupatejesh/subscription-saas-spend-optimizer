import test from 'node:test';
import assert from 'node:assert/strict';
import { canAccessRole } from './roles.js';

test('role authorization only grants explicitly allowed known roles', () => {
  assert.equal(canAccessRole('USER', ['USER']), true);
  assert.equal(canAccessRole('TEAM_ADMIN', ['PLATFORM_ADMIN']), false);
  assert.equal(canAccessRole('PLATFORM_ADMIN', ['PLATFORM_ADMIN']), true);
  assert.equal(canAccessRole('ROOT', ['ROOT']), false);
});
