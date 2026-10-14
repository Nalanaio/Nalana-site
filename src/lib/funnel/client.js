import { validBrowserEvent } from './contract.js';
export const QUEUE_KEY = 'nalana_usage_queue_v1';
const bytes = value => new TextEncoder().encode(JSON.stringify(value)).length;
export function createQueue({ storage = undefined, now = Date.now, request = fetch, binding = () => null }) {
  let queue = [], sending = false, paused = false, nextAttempt = 0, attempt = 0, fence = 0;
  try { const saved = JSON.parse(storage?.getItem(QUEUE_KEY) || '[]'); if (Array.isArray(saved)) queue = saved.filter(item => validBrowserEvent(item, now())); } catch {}
  function save() { try { storage?.setItem(QUEUE_KEY, JSON.stringify(queue)); } catch {} }
  function purge() { fence++; queue = []; paused = false; nextAttempt = 0; attempt = 0; save(); }
  function enqueue(event) {
    const current = binding();
    if (!current || !validBrowserEvent(event, now()) || event.web_session_id !== current.web_session_id || event.association_epoch !== current.association_epoch) return false;
    queue.push(JSON.parse(JSON.stringify(event))); queue = queue.filter(item => validBrowserEvent(item, now()));
    while (queue.length > 500 || bytes(queue) > 1048576) queue.shift();
    save(); return true;
  }
  async function flush() {
    if (sending || paused || now() < nextAttempt) return;
    const current = binding(), version = fence;
    if (!current) { purge(); return; }
    queue = queue.filter(item => validBrowserEvent(item, now()) && item.web_session_id === current.web_session_id && item.association_epoch === current.association_epoch);
    const events = [];
    for (const item of queue.slice(0, 50)) { if (bytes({ schema_version: 1, events: [...events, item] }) > 65536) break; events.push(item); }
    if (!events.length) { save(); return; }
    sending = true;
    try {
      const response = await request('/api/funnel/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ schema_version: 1, events }) });
      if (version !== fence || binding()?.web_session_id !== current.web_session_id || binding()?.association_epoch !== current.association_epoch) return;
      if (response.status === 401 || response.status === 403) { paused = true; return; }
      if (!response.ok) { attempt = Math.min(attempt + 1, 8); const retry = Number(response.headers.get('retry-after')); nextAttempt = now() + Math.min(3600000, Number.isFinite(retry) && retry > 0 ? retry * 1000 : 1000 * 2 ** attempt); return; }
      const ack = await response.json();
      if (ack.schema_version !== 1 || !Array.isArray(ack.accepted) || !Array.isArray(ack.duplicates) || !Array.isArray(ack.rejected)) return;
      const sent = new Set(events.map(item => item.event_id));
      const removed = new Set([...ack.accepted, ...ack.duplicates, ...ack.rejected.map(item => item.event_id)].filter(id => sent.has(id)));
      queue = queue.filter(item => !removed.has(item.event_id)); attempt = 0; nextAttempt = 0; save();
    } catch { attempt = Math.min(attempt + 1, 8); nextAttempt = now() + Math.min(3600000, 1000 * 2 ** attempt); }
    finally { sending = false; }
  }
  return { enqueue, flush, purge, resume() { paused = false; }, snapshot: () => queue.map(item => ({ ...item })), isPaused: () => paused };
}
