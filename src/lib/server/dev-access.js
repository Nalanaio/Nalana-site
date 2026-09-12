/**
 * Default approved email addresses with access to the private dev channel.
 * Clarence ("i") and Brian ("brian").
 */
export const DEFAULT_DEV_ALLOWED_EMAILS = [
  'clarence@nalana.io',
  'jordankeith999@gmail.com',
  'cekeith@usc.edu',
  'cekeith999@gmail.com',
  'debriann07@gmail.com',
  'brian@nalana.io',
];

/**
 * Resolve the full list of allowed emails, combining code defaults
 * with any comma-separated emails from the DEV_ALLOWED_EMAILS environment variable.
 */
export function getDevAllowedEmails(envOverride = null) {
  const envVal =
    envOverride ??
    (typeof process !== 'undefined' ? process.env?.DEV_ALLOWED_EMAILS : '') ??
    '';

  const configured = (typeof envVal === 'string' ? envVal : '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const merged = new Set([
    ...DEFAULT_DEV_ALLOWED_EMAILS.map((e) => e.toLowerCase()),
    ...configured,
  ]);

  return Array.from(merged);
}

/**
 * Check if a given email is authorized for the dev channel.
 */
export function isDevAllowedEmail(email, envOverride = null) {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  const allowed = getDevAllowedEmails(envOverride);
  return allowed.includes(normalized);
}
