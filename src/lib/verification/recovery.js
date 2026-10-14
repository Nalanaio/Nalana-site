/** Proof is transient and only the explicit confirmation action consumes it. */
export function createRecoveryProof(url, options = {}) {
  const parsed = new URL(url);
  let token = parsed.searchParams.get('token') ?? '';
  const resend = ['resend', '1', 'true'].includes(parsed.searchParams.get('action') ?? parsed.searchParams.get('resend'));
  options.replace?.(parsed.pathname);
  let inFlight;
  return {
    get hasToken() { return !!token; },
    resend,
    confirm() {
      if (inFlight) return inFlight;
      if (!token) return Promise.resolve({ ok: false, data: { error: 'Verification token is missing.' } });
      inFlight = (async () => {
        try {
          const response = await (options.fetch ?? globalThis.fetch)('/api/auth/verify-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }), signal: AbortSignal.timeout(10000) });
          const data = await response.json().catch(() => ({}));
          if (response.ok) token = '';
          return { ok: response.ok, data };
        } catch { return { ok: false, data: { error: 'Network error. Please try again.' } }; }
        finally { inFlight = null; }
      })();
      return inFlight;
    },
  };
}
