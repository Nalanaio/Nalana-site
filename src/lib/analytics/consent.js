export const CONSENT_KEY = 'nalana_privacy_v1';
export const SENSITIVE_PATH = /^\/(?:verify-email|reset-password|forgot-password|login|account|connect-download|operator|billing)(?:\/|$)/;
export const emptyChoice = () => ({ version: 1, usage: false, identification: false, decided: false });
export function parseChoice(value) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (parsed?.version !== 1 || typeof parsed.usage !== 'boolean' || typeof parsed.identification !== 'boolean' || typeof parsed.decided !== 'boolean') return emptyChoice();
    return { version: 1, usage: parsed.usage, identification: parsed.identification, decided: parsed.decided };
  } catch { return emptyChoice(); }
}
export function readChoice(storage) { try { return parseChoice(storage?.getItem(CONSENT_KEY)); } catch { return emptyChoice(); } }
export function writeChoice(storage, choice) { const value = parseChoice(choice); try { storage?.setItem(CONSENT_KEY, JSON.stringify(value)); } catch { /* Permission still applies in this document. */ } return value; }
export function sensitivePath(pathname) { return SENSITIVE_PATH.test(pathname); }
export function sanitizedLocation(url) { return new URL(url).pathname; }
export function needsDocumentBoundary(from, to) {
  const source = new URL(from, 'https://nalana.invalid');
  const target = new URL(to, 'https://nalana.invalid');
  // The proof is already captured in this sensitive document. Router navigation
  // must replace its URL, including internal history state, without losing it.
  if (source.origin === target.origin && source.pathname === target.pathname &&
      ['/verify-email', '/reset-password'].includes(source.pathname) &&
      source.searchParams.get('token') && !target.search && !target.hash) return false;
  return sensitivePath(target.pathname) || sensitivePath(source.pathname);
}
export function browserStorage(window) { try { return window.localStorage; } catch { return undefined; } }
export function permissionsRevoked(previous, next) { return (previous.usage && !next.usage) || (previous.identification && !next.identification); }
