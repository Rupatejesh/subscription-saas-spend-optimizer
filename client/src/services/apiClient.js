const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL ?? '/api/v1';
let cacheScope = 'guest';
const CACHEABLE_READS = ['/users/subscriptions', '/users/transactions', '/bank-feed/transactions', '/users/me/reports', '/users/me/alerts', '/users/me/benchmarks', '/teams'];

export function setCacheScope(userId) { cacheScope = userId ? String(userId) : 'guest'; }

function userFacingError(status, message) {
  if (status >= 500) return 'The server could not complete this request. Please try again shortly.';
  if (status === 401) return 'Your session has expired. Sign in again to continue.';
  if (status === 403) return 'You do not have permission to perform this action.';
  if (status === 404) return 'The requested item could not be found. Refresh and try again.';
  if (status === 409) return message || 'This action conflicts with the current data. Refresh and try again.';
  if (status === 422) return message || 'Some information needs correction before this can be saved.';
  if (status === 429) return 'Too many requests were made. Wait a moment and try again.';
  if (status === 400) return message || 'Some information is invalid. Review it and try again.';
  return message || 'Unable to complete your request. Please try again.';
}

function cacheKey(path) { return `spend-optimizer:${cacheScope}:${path}`; }

function cachedResponse(path) {
  try {
    const entry = JSON.parse(sessionStorage.getItem(cacheKey(path)) || 'null');
    if (!entry || Date.now() - entry.savedAt > 7 * 24 * 60 * 60 * 1000) return null;
    return entry.data;
  } catch { return null; }
}

function saveResponse(path, data) {
  try { sessionStorage.setItem(cacheKey(path), JSON.stringify({ savedAt: Date.now(), data })); }
  catch { /* Private browsing or storage limits: use the live response only. */ }
}

export async function apiRequest(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const { timeoutMs = 10000, ...requestOptions } = options;
  let response;
  let timedOut = false;
  for (let attempt = 0; attempt < (method === 'GET' ? 3 : 1); attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        ...requestOptions,
        signal: controller.signal,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...requestOptions.headers }
      });
      if (response.status < 500 || attempt === 2) break;
      await new Promise((resolve) => setTimeout(resolve, 300 * (2 ** attempt)));
    } catch {
      if (timedOut) break;
      if (attempt < 2 && method === 'GET') await new Promise((resolve) => setTimeout(resolve, 300 * (2 ** attempt)));
      else break;
    } finally { clearTimeout(timeoutId); }
  }
  if (!response) {
    const cached = method === 'GET' ? cachedResponse(path) : null;
    if (cached !== null) return cached;
    const message = timedOut
      ? (method === 'GET' ? 'The request took too long. Check your connection and try again.' : 'The request timed out. Check whether the action completed before trying again.')
      : 'Unable to connect. If you are offline, reconnect and try again; saved information is shown when available.';
    const error = new Error(message);
    error.status = 0;
    error.code = timedOut ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR';
    throw error;
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.success) {
    if (method === 'GET' && response.status >= 500) {
      const cached = cachedResponse(path);
      if (cached !== null) return cached;
    }
    const error = new Error(userFacingError(response.status, body.message));
    error.details = body.details;
    error.status = response.status;
    throw error;
  }
  if (method === 'GET' && CACHEABLE_READS.some((prefix) => path.startsWith(prefix))) saveResponse(path, body.data);
  return body.data;
}
