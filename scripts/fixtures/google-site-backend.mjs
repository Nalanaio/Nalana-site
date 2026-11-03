// Local deterministic UI fixture. No Google/provider/network calls or real accounts.
import { createServer } from 'node:http';
const user = { id: 'source-fixture-account', email: 'fixture@example.test', display_name: 'Source fixture', tier: 'pro', credits: 123, email_verified: true };
const access = () => `fixture.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now()/1000) + 900, sub: user.id })).toString('base64url')}.not-a-real-signature`;
let logoutFailures = Number(process.env.SOURCE_FIXTURE_LOGOUT_FAILURES) || 0;
const server = createServer(async (request, response) => {
  let raw = ''; for await (const chunk of request) raw += chunk;
  response.setHeader('Content-Type', 'application/json');
  const send = (body, status = 200) => { response.statusCode = status; response.end(JSON.stringify(body)); };
  if (request.url === '/v1/auth/login' || request.url === '/v1/auth/register' || request.url === '/v1/auth/refresh') return send({ access_token: access(), refresh_token: 'local-opaque-source-fixture-refresh', user }, request.url.endsWith('/register') ? 201 : 200);
  if (request.url === '/v1/users/me') return send(user);
  if (request.url === '/v1/auth/methods') return send({ has_password: true, google: { connected: false, email: null, email_mismatch: false } });
  if (request.url === '/v1/auth/logout') { if (logoutFailures-- > 0) return send({ detail: 'Intentional fixture outage.' }, 503); response.statusCode = 204; return response.end(); }
  if (request.url === '/v1/credits/balance') return send({ subscription_available: '123', top_up_available: '0', free_available: '0', available_to_start: '123', billing_mode: 'observe' });
  if (request.url === '/v1/billing/public-catalog' || request.url === '/v1/billing/catalog') return send({ checkout_enabled: false, products: [] });
  return send({ detail: 'This action is not available in the local UI fixture.' }, 503);
});
server.listen(5181, '127.0.0.1', () => process.stdout.write('Source-only auth backend fixture at http://127.0.0.1:5181\n'));
