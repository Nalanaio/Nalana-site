import { createQueue } from './client.js';
import { UUID } from './contract.js';
const SESSION_KEY = 'nalana_usage_session_v1';
export function createFunnelSession({ storage, request = fetch, uuid = () => crypto.randomUUID(), now = Date.now, broadcast = (_message) => {}, attribution = () => ({}) }) {
  let state = null, granted = false, collecting = false, generation = 0, accountKey = null, accountToken = null, accountId = null, pending = Promise.resolve();
  const queue = createQueue({ storage, now, request, binding: () => granted && collecting ? state : null });
  function persist() { try { if (state) storage?.setItem(SESSION_KEY, JSON.stringify(state)); else storage?.removeItem(SESSION_KEY); } catch {} }
  async function call(path, body, token = null) {
    const response = await request(path, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(`usage:${response.status}`);
    return response.status === 204 ? {} : response.json();
  }
  async function register(version) {
    const sessionId = uuid();
    const response = await call(`/api/funnel/enrollments/${state.enrollment_id}/sessions`, { app_session_id: null, web_session_id: sessionId });
    if (generation !== version || !granted) return;
    state = { ...state, session_id: response.session_id, web_session_id: sessionId, association_epoch: 0 }; persist();
  }
  async function associate(version, token) {
    if (!state?.session_id || !token || state.association_epoch === 1) return;
    queue.purge();
    const response = await call(`/api/funnel/enrollments/${state.enrollment_id}/associate`, { session_id: state.session_id }, token);
    if (generation !== version || !granted) return;
    if (response.association_epoch !== 1) throw new Error('Invalid association epoch.');
    state = { ...state, association_epoch: 1, account_id: accountId }; persist(); queue.resume();
  }
  async function start(version) {
    if (!granted || version !== generation) return;
    if (state && queue.isPaused()) {
      // A rejected capability/session cannot silently stay active for 30 days.
      // Fence and discard observations bound to that rejected session first.
      collecting = false; queue.purge();
      const old = state;
      try {
        const renewed = await call(`/api/funnel/enrollments/${old.enrollment_id}/renew`, {});
        if (version !== generation || !granted) return;
        if (old.session_id) await call(`/api/funnel/enrollments/${old.enrollment_id}/dissociate`, { session_id: old.session_id });
        if (version !== generation || !granted) return;
        state = { ...old, expires_at: renewed.expires_at, session_id: null, association_epoch: 0, account_id: null }; persist();
      } catch {
        if (version !== generation || !granted) return;
        await call('/api/funnel/revoke', {}).catch(() => {});
        state = null; persist();
      }
    }
    if (state && Date.parse(state.expires_at) <= now()) { queue.purge(); state = null; persist(); }
    if (state && Date.parse(state.expires_at) - now() < 86400000) {
      try { const renewed = await call(`/api/funnel/enrollments/${state.enrollment_id}/renew`, {}); if (generation !== version) return; state = { ...state, expires_at: renewed.expires_at }; persist(); }
      catch { queue.purge(); state = null; persist(); }
    }
    if (!state) {
      try {
        const response = await request('/api/funnel/session', { headers: { accept: 'application/json' } });
        if (response.ok) { const resumed = await response.json(); if (!granted || version !== generation) return;
          if (UUID.test(resumed.enrollment_id) && UUID.test(resumed.web_visitor_id) && UUID.test(resumed.web_session_id) && [0, 1].includes(resumed.association_epoch) && Date.parse(resumed.expires_at) > now()) { state = resumed; persist(); }
        }
      } catch { /* Recreate only after explicitly revoking the old private capability. */ }
    }
    if (!state) {
      queue.purge();
      await call('/api/funnel/revoke', {});
      if (!granted || version !== generation) return;
      const visitor = uuid(), sessionId = uuid();
      const response = await call('/api/funnel/enrollments', { consent_version: 1, consent_state: 'granted', web_visitor_id: visitor, web_session_id: sessionId, attribution: attribution() });
      if (!granted || version !== generation) { void call(`/api/funnel/enrollments/${response.enrollment_id}/revoke`, {}).catch(() => {}); return; }
      if (!UUID.test(response.enrollment_id)) throw new Error('Invalid enrollment.');
      state = { enrollment_id: response.enrollment_id, expires_at: response.expires_at, web_visitor_id: visitor, web_session_id: sessionId, session_id: null, association_epoch: 0 }; persist();
    }
    if (state.association_epoch === 1 && state.account_id !== accountId) {
      queue.purge(); const old = state.session_id;
      await call(`/api/funnel/enrollments/${state.enrollment_id}/dissociate`, { session_id: old });
      if (version !== generation) return;
      state = { ...state, session_id: null, association_epoch: 0, account_id: null }; persist();
    }
    if (!state.session_id) await register(version);
    if (accountToken) await associate(version, accountToken);
    if (version === generation && granted && state?.session_id) { collecting = true; queue.resume(); }
  }
  function serialized(work) { pending = pending.catch(() => {}).then(work); return pending.catch(() => false); }
  return {
    queue,
    grant() {
      if (granted) return pending;
      granted = true; collecting = false; const version = ++generation;
      // Resume metadata is server-validated before restoring persisted observations.
      // Local storage alone never establishes permission or an authentication epoch.
      state = null;
      return serialized(() => start(version));
    },
    revoke({ remote = false } = {}) {
      const old = state; granted = false; collecting = false; generation++; queue.purge(); state = null; persist();
      if (!remote) broadcast({ kind: 'revoke' });
      return serialized(() => old ? call(`/api/funnel/enrollments/${old.enrollment_id}/revoke`, {}) : call('/api/funnel/revoke', {}));
    },
    authChanged(key, token, id = key?.split(':')[0] ?? null) {
      accountId = id;
      if (key === accountKey) { accountToken = token; return pending; }
      const previous = accountKey; accountKey = key; accountToken = token; const version = ++generation;
      collecting = false;
      if (granted) queue.purge();
      broadcast({ kind: 'session-close' });
      if (!granted) return pending;
      return serialized(async () => {
        if (state?.session_id && (previous !== null || state.association_epoch === 1)) {
          const oldSession = state.session_id; state = { ...state, session_id: null, association_epoch: 0 }; persist();
          try { await call(`/api/funnel/enrollments/${state.enrollment_id}/dissociate`, { session_id: oldSession }); } catch { state = null; persist(); throw new Error('Session close unavailable.'); }
          if (version !== generation) return;
          await register(version);
        }
        await start(version);
      });
    },
    remoteChanged(message) { if (message?.kind === 'revoke') return this.revoke({ remote: true }); if (message?.kind === 'session-close') { collecting = false; generation++; queue.purge(); state = null; persist(); } },
    click() {
      if (!granted || !collecting || !state?.session_id) return null;
      const event = { event_id: uuid(), event_name: 'website_download_clicked', occurred_at: new Date(now()).toISOString(), web_session_id: state.web_session_id, association_epoch: state.association_epoch, properties: {} };
      if (!queue.enqueue(event)) return null;
      void queue.flush(); return event.event_id;
    },
    snapshot: () => state ? { ...state } : null,
    refresh() { return serialized(() => start(generation)); }
  };
}
