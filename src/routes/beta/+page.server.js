import { fetchChannelManifest } from '#lib/server/release-channel.js';

async function loadManifest(fetch) {
  const { manifest, status } = await fetchChannelManifest('beta', fetch);
  if (manifest) return { manifest, error: null };
  if (status !== null) return { manifest: null, error: `The latest beta build is not available yet (${status}).` };
  return { manifest: null, error: 'Could not reach the beta build service. Try again shortly.' };
}

export const prerender = false;

export async function load({ fetch, setHeaders }) {
  setHeaders({ 'cache-control': 'no-store' });
  return loadManifest(fetch);
}
