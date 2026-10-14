import { randomUUID } from 'node:crypto';
import { cleanAttribution } from '../funnel/attribution.js';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const flagEnabled = (value) => value === 'true' || value === '1';

function endpoint(path, env) {
  try {
    const base = new URL(env.NALANA_API_BASE || env.AZURE_API_URL);
    if (base.username || base.password || base.search || base.hash || (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(base.hostname)))) return null;
    return `${base.origin}${path}`;
  } catch { return null; }
}

/** Fixed backend route only. Secrets never appear in return data or logs. */
export async function acquisitionRequest(path, body, { fetch = globalThis.fetch, env = process.env, enrollmentToken = null, trafficClass = null } = {}) {
  const target = endpoint(path, env);
  if (!target || !env.NALANA_WEBSITE_SERVICE_TOKEN) return null;
  try {
    const headers = { Authorization: `Bearer ${env.NALANA_WEBSITE_SERVICE_TOKEN}`, 'Content-Type': 'application/json' };
    if (enrollmentToken) headers['X-Funnel-Enrollment'] = enrollmentToken;
    if (['bot','prefetch','internal','test','updater','unclassified'].includes(trafficClass)) headers['X-Nalana-Traffic-Class'] = trafficClass;
    const response = await fetch(target, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(3000), redirect: 'error' });
    if (!response.ok) return { ok: false, status: response.status, retryAfter: response.headers.get('retry-after') };
    return { ok: true, status: response.status, data: await response.json() };
  } catch { return null; }
}

export function validateRelayIntent(data, platform, env = process.env) {
  if (!data || !UUID.test(data.download_id) || data.platform !== platform || data.observation_mode !== 'relay' || typeof data.release_id !== 'string' || !data.release_id || data.release_id.length > 128 || typeof data.artifact_id !== 'string' || !data.artifact_id || data.artifact_id.length > 128) return null;
  try {
    const base = new URL(env.NALANA_DOWNLOAD_RELAY_BASE);
    const target = new URL(data.download_url);
    const now = Math.floor(Date.now() / 1000);
    const expiry = Number(target.searchParams.get('expires'));
    if (target.origin !== base.origin || target.username || target.password || target.hash || target.pathname !== `/v1/downloads/${data.download_id}` || target.protocol !== base.protocol || !['https:', 'http:'].includes(target.protocol)) return null;
    if (target.protocol === 'http:' && !['localhost','127.0.0.1','[::1]'].includes(target.hostname)) return null;
    if (![...target.searchParams.keys()].every(key => ['expires','key_id','sig'].includes(key)) || [...target.searchParams.keys()].length !== 3 || !Number.isInteger(expiry) || expiry <= now || expiry > now + 1200 || !/^[A-Za-z0-9_-]{1,32}$/.test(target.searchParams.get('key_id') || '') || !/^[0-9a-f]{64}$/.test(target.searchParams.get('sig') || '')) return null;
    const expiryDate = Date.parse(data.expires_at);
    if (!Number.isFinite(expiryDate) || Math.abs(Math.floor(expiryDate/1000) - expiry) > 2) return null;
    return { download_id: data.download_id, release_id: data.release_id, artifact_id: data.artifact_id, platform, download_url: target.href, expires_at: data.expires_at, observation_mode: 'relay' };
  } catch { return null; }
}

export async function createIntent({ platform, subject = null, enrollment = null, clickId = null, trafficClass = 'unclassified', fetch, env = process.env }) {
  if (!flagEnabled(env.NALANA_ACQUISITION_RELAY) || !['windows','mac'].includes(platform)) return null;
  const consented = enrollment?.token && UUID.test(enrollment.web_visitor_id) && UUID.test(enrollment.web_session_id);
  const attribution = consented ? cleanAttribution(new URLSearchParams(Object.entries(enrollment.attribution || {}).map(([key,value])=>[`utm_${key}`,String(value)]))) : {};
  const result = await acquisitionRequest('/v1/acquisition/download-intents', { schema_version: 1, platform, channel: 'stable', click_id: consented && UUID.test(clickId) ? clickId : null, dedup_subject: subject, web_visitor_id: consented ? enrollment.web_visitor_id : null, web_session_id: consented ? enrollment.web_session_id : null, analytics_consent: consented ? 'granted' : 'unknown', attribution }, { fetch, env, enrollmentToken: consented ? enrollment.token : null, trafficClass });
  return result?.ok ? validateRelayIntent(result.data, platform, env) : null;
}

export async function refreshIntent({ intent, subject, fetch, env = process.env }) {
  if (!flagEnabled(env.NALANA_ACQUISITION_RELAY) || !subject || !UUID.test(intent?.download_id)) return null;
  const result = await acquisitionRequest(`/v1/acquisition/download-intents/${intent.download_id}/refresh`, { schema_version: 1, dedup_subject: subject }, { fetch, env });
  const refreshed = result?.ok ? validateRelayIntent(result.data, intent.platform, env) : null;
  return refreshed && refreshed.download_id === intent.download_id && (!intent.artifact_id || refreshed.artifact_id === intent.artifact_id) && (!intent.release_id || refreshed.release_id === intent.release_id) ? refreshed : null;
}

export async function recordHandoff({ downloadId, deliveryMode, fetch, env = process.env }) {
  if (!UUID.test(downloadId) || !['relay','direct_fallback'].includes(deliveryMode)) return;
  await acquisitionRequest('/v1/acquisition/download-handoffs', { schema_version: 1, event_id: randomUUID(), download_id: downloadId, delivery_mode: deliveryMode, occurred_at: new Date().toISOString() }, { fetch, env });
}
