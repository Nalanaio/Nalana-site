import { sensitivePath } from './lib/analytics/consent.js';
export async function handle({ event, resolve }) {
  const response = await resolve(event);
  if (sensitivePath(event.url.pathname) || event.url.pathname.startsWith('/api/')) {
    response.headers.set('cache-control', 'no-store');
    response.headers.set('referrer-policy', 'no-referrer');
    response.headers.set('x-content-type-options', 'nosniff');
  }
  return response;
}
