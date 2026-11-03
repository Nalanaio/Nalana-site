export const LEGACY_AUTH_KEYS = ['nalana_session_v1', 'nalana_token', 'nalana_refresh_token', 'nalana_user'];
/** Delete credentials without parsing, adopting or returning their values. */
export function clearLegacyAuth(storage) {
  let found = false;
  try { for (const key of LEGACY_AUTH_KEYS) { if (storage?.getItem(key) !== null) found = true; storage?.removeItem(key); } } catch { /* Cookie login remains available if storage is blocked. */ }
  return found;
}
