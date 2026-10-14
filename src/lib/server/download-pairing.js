import { ownedDownload } from './download-cookie.js';
import { acquisitionRequest, flagEnabled, UUID } from './acquisition-api.js';
import { downloadHeaders } from './download-handler.js';

const reply = (body, status) => Response.json(body, { status, headers: downloadHeaders });

export async function handlePairing({ request, url, cookies, enrollment, fetch, env = process.env }) {
  if (request.headers.get('origin') !== url.origin) return reply({ error: 'Invalid request origin.' }, 403);
  if (!flagEnabled(env.NALANA_ACQUISITION_PAIRING)) return reply({ error: 'Download linking is currently unavailable.' }, 503);
  if (!enrollment?.token) return reply({ error: 'Allow optional usage tracking before linking a download.' }, 403);
  const owned = ownedDownload(cookies, env);
  if (!owned || !UUID.test(owned.download_id)) return reply({ error: 'Start a new download before linking it.' }, 404);
  let input;
  try {
    const reader = request.body?.getReader();
    const chunks = [];
    let size = 0;
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 1024) { await reader.cancel(); return reply({ error: 'Request is too large.' }, 413); }
        chunks.push(value);
      }
    }
    input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) return reply({ error: 'Invalid request.' }, 400);
  } catch { return reply({ error: 'Invalid request.' }, 400); }
  const result = await acquisitionRequest('/v1/acquisition/pairings', { schema_version: 1, download_id: owned.download_id }, { fetch, env, enrollmentToken: enrollment.token });
  if (!result?.ok) {
    const status = [400,403,404,409,429].includes(result?.status) ? result.status : 503;
    const response = reply({ error: status === 429 ? 'Please wait before requesting another code.' : 'This download could not be linked. Try starting a new download.' }, status);
    if (status === 429 && /^\d{1,5}$/.test(result?.retryAfter || '')) response.headers.set('retry-after', result.retryAfter);
    return response;
  }
  const data = result.data;
  const expiry = Date.parse(data?.expires_at);
  if (!UUID.test(data?.pairing_id) || !/^[0-9A-HJKMNP-TV-Z]{16}$/.test(data?.code || '') || !Number.isFinite(expiry) || expiry <= Date.now() || expiry > Date.now() + 901000) return reply({ error: 'Download linking is temporarily unavailable.' }, 503);
  // Only transient display proof. Enrollment and service credentials never leave server.
  return reply({ pairing_id: data.pairing_id, code: data.code, expires_at: data.expires_at }, 201);
}
