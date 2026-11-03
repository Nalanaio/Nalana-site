import { proxyAuthenticated } from '#lib/server/authApi.js';
export const GET = event => proxyAuthenticated('/v1/auth/methods', event, { method: 'GET' });
