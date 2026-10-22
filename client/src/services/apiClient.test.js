import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { apiRequest } from './apiClient.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

function response(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

test('API errors map common HTTP statuses to safe user-facing messages', async () => {
  const cases = [
    [400, 'Check the amount.', 'Check the amount.'],
    [401, 'private detail', 'Your session has expired. Sign in again to continue.'],
    [403, 'private detail', 'You do not have permission to perform this action.'],
    [404, 'private detail', 'The requested item could not be found. Refresh and try again.'],
    [409, 'Try again later.', 'Try again later.'],
    [422, 'Correct the form.', 'Correct the form.'],
    [429, 'private detail', 'Too many requests were made. Wait a moment and try again.'],
    [500, 'Database credentials leaked', 'The server could not complete this request. Please try again shortly.']
  ];

  for (const [status, serverMessage, expected] of cases) {
    globalThis.fetch = async () => response(status, { success: false, message: serverMessage });
    await assert.rejects(apiRequest('/test', { method: 'POST' }), (error) => {
      assert.equal(error.status, status);
      assert.equal(error.message, expected);
      return true;
    });
  }
});

test('API timeout aborts the request and does not retry a write', async () => {
  let calls = 0;
  globalThis.fetch = async (_url, { signal }) => {
    calls += 1;
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      reject(error);
    }, { once: true }));
  };

  await assert.rejects(apiRequest('/test', { method: 'POST', timeoutMs: 5 }), (error) => {
    assert.equal(error.code, 'REQUEST_TIMEOUT');
    assert.match(error.message, /timed out/i);
    return true;
  });
  assert.equal(calls, 1);
});
