const MAX_RECOVERY_BYTES = 8192;
const rejected = (status, error) => ({ body: null, response: Response.json({ error }, { status, headers: { 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer' } }) });

/** Check browser origin and bound actual bytes before decoding any credential input. */
export async function readAuthRecoveryRequest(request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return rejected(403, 'Invalid request origin.');
  if (request.method !== 'POST') return rejected(405, 'Method not allowed.');
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return rejected(415, 'A JSON request is required.');
  const declared = request.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_RECOVERY_BYTES)) return rejected(413, 'Request is too large.');
  const reader = request.body?.getReader();
  if (!reader) return rejected(400, 'Invalid request.');
  let length = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_RECOVERY_BYTES) { await reader.cancel(); return rejected(413, 'Request is too large.'); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!body || typeof body !== 'object' || Array.isArray(body)) return rejected(400, 'Invalid request.');
    return { body, response: null };
  } catch { return rejected(400, 'Invalid request.'); }
  finally { reader.releaseLock(); }
}
