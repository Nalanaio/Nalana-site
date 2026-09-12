import { loadDevManifest } from '$lib/server/dev-release.js';

export const prerender = false;

export async function load({ fetch, setHeaders }) {
  setHeaders({ 'cache-control': 'no-store' });
  return loadDevManifest(fetch);
}
