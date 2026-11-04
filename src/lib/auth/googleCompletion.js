/** One automatic attempt, then explicit retries. Credentials stay in the BFF. */
export function takeGoogleReturn(browser) { return browser.__nalanaTakeGoogleReturn?.() ?? null; }
export function createGoogleCompletion({ request, navigate, epoch = () => 0, changed = _state => {}, returned = null }) {
  let state = { phase: 'idle', error: '', confirmationStarted: false }, flight = null, mounted = false, disposed = false, cancelling = false, saved = false;
  const initialEpoch = epoch();
  const current = () => !disposed && epoch() === initialEpoch;
  function publish(phase, error = '') { state = { ...state, phase, error }; if (!disposed) changed(state); }
  const retryable = status => status === 202 || status === 429 || status >= 500;
  async function finish() {
    if (!current() || cancelling || state.phase === 'terminal' || state.phase === 'done') return;
    if (flight) return flight;
    if (returned?.invalid) { publish('terminal', 'This Google sign-in could not finish. Go back and start again.'); return; }
    publish('finishing');
    flight = (async () => {
      try {
        if (!saved) {
          const proof = returned;
          const response = await request('/api/auth/google/complete', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(proof ?? {}) });
          if (!current() || cancelling) return;
          if (!response.ok || response.status === 202) {
            if (!retryable(response.status)) returned = null;
            publish(retryable(response.status) ? 'retry' : 'terminal', retryable(response.status)
              ? 'Sign-in could not finish yet. Retry when connected.'
              : 'This Google sign-in could not finish. Go back and start again.');
            return;
          }
          saved = true; returned = null;
        }
        // Separate HTTP readback proves the browser accepted the sealed cookies.
        // Issuance becomes irreversible once acknowledgment may have succeeded.
        state = { ...state, confirmationStarted: true }; publish('confirming');
        const ack = await request('/api/auth/google/acknowledge', { method: 'POST' });
        if (!current() || cancelling) return;
        if (!ack.ok || ack.status === 202) { publish('retry', 'Your sign-in was saved. Retry confirmation to finish.'); return; }
        publish('done'); navigate('/account');
      } catch { if (current() && !cancelling) publish('retry', 'Could not reach Nalana. Retry when connected.'); }
      finally { flight = null; }
    })();
    return flight;
  }
  return {
    get current() { return state; },
    mount() { if (mounted || disposed) return; mounted = true; return finish(); },
    retry: finish,
    async goBack() {
      if (!current() || cancelling || state.confirmationStarted || state.phase === 'done') return;
      cancelling = true; publish('cancelling');
      // Wait for a possible cookie-writing response before cancelling its family.
      await flight;
      if (!current()) return;
      try {
        const response = await request('/api/auth/google/cancel', { method: 'POST' });
        if (!current()) return;
        if (!response.ok) { publish('cancel-error', 'Could not go back safely. Retry Go back to cancel this sign-in.'); return; }
        returned = null; publish('done'); navigate('/login');
      } catch { if (current()) publish('cancel-error', 'Could not reach Nalana. Retry Go back to cancel this sign-in.'); }
      finally { cancelling = false; }
    },
    dispose() { disposed = true; returned = null; },
  };
}
