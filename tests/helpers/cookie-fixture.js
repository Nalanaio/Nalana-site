import { browserContext, installSession } from '../../src/lib/server/authSession.js';
process.env.GOOGLE_AUTH_BFF_SECRET = 'source-fixture-bff-secret-not-live-32-characters';
process.env.NALANA_AUTH_COOKIE_SECRET = 'isolated-source-fixture-key-at-least-32-characters';
export const jwt = (label = 'fixture') => `header.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 900, sub: label })).toString('base64url')}.fixture-signature`;
export const tokens = (id = 'account') => ({ access_token: jwt(id), refresh_token: `opaque-refresh-${id}`, user: { id, email: `${id}@example.test`, tier: 'pro', credits: 123 } });
/** @param {string} [path] @param {{method?: string, body?: any, jar?: Map<string,string>, origin?: string, headers?: Record<string,string>}} [options] @returns {any} */
export function fixture(path = '/api/auth/me', { method = 'GET', body, jar = new Map(), origin = 'https://nalana.test', headers = {} } = {}) {
  const url = new URL(path, 'https://nalana.test');
  const writes = [];
  const cookies = { get: key => jar.get(key), set: (key, value, options) => { jar.set(key, value); writes.push({ key, value, options }); }, delete: (key, options) => { jar.delete(key); writes.push({ key, value: null, options }); } };
  const request = new Request(url, { method, headers: { origin, 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { request, url, cookies, jar, writes, getClientAddress: () => '203.0.113.6', params: {}, setHeaders() {} };
}
export function authenticated(path, options = {}) {
  const event = fixture(path, options); browserContext(event, true); installSession(event, tokens()); return event;
}
