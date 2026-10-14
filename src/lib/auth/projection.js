import { normalizeVerification } from '../verification/policy.js';
export function normalizeUser(rawUser, data = {}) {
  const u = rawUser ?? data;
  const tier = u.tier ?? u.plan ?? data.tier ?? data.plan ?? 'free';
  const name = u.display_name ?? u.name ?? '';
  return { id: u.id ?? u.user_id, email: u.email, name, display_name: name,
    avatar_url: u.avatar_url ?? '', email_verified: Boolean(u.email_verified),
    plan: tier, tier, credits: u.credits ?? data.credits ?? 0, status: u.status ?? 'active',
    verification: normalizeVerification(u.verification) };
}
export function normalizeAuthResponse(data) {
  const result = { token: data.access_token ?? data.token, refresh_token: data.refresh_token ?? null };
  if (data.user?.id != null || data.id != null || data.user_id != null) result.user = normalizeUser(data.user ?? data, data);
  if ('verification' in data) result.verification = normalizeVerification(data.verification);
  return result;
}
export function mapAuthError(status, data, options = {}) {
  const detail = [data?.error, data?.detail, data?.message].find((value) => typeof value === 'string');
  if (status >= 500) return 'Service unavailable. Please try again.';
  if (detail) return detail.slice(0, 1000);
  if (status === 401) return 'Invalid email or password.';
  if (status === 403) return 'Access denied. Please try again or contact support.';
  if (status === 409) return 'This change could not be completed. Please check your details.';
  if (status === 429) return 'Please wait before trying again.';
  return 'Please check your input and try again.';
}
export function safeAuthError(status, data, options = {}) {
  const result = { error: mapAuthError(status, data, options) };
  if (typeof data?.code === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(data.code)) result.code = data.code;
  if (typeof data?.request_id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.request_id)) result.request_id = data.request_id;
  if (Number.isFinite(data?.retry_after_seconds) && data.retry_after_seconds >= 0) result.retry_after_seconds = data.retry_after_seconds;
  const verification = normalizeVerification(data?.verification);
  if (verification) result.verification = verification;
  return result;
}
