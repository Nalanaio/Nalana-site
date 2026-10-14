/** Incomplete capabilities remain unknown; never invent a grace period. */
export function normalizeVerification(value) {
  if (!value || value.policy_version !== 1 || !['verified', 'grace', 'required'].includes(value.state) ||
      typeof value.enforcement_enabled !== 'boolean' || typeof value.cloud_actions_allowed !== 'boolean' ||
      !Number.isFinite(Date.parse(value.server_time))) return null;
  const result = { policy_version: 1, state: value.state, enforcement_enabled: value.enforcement_enabled,
    cloud_actions_allowed: value.cloud_actions_allowed, server_time: value.server_time };
  for (const key of ['grace_started_at', 'grace_expires_at', 'next_reminder_at', 'resend_available_at']) {
    if (value[key] !== null && (typeof value[key] !== 'string' || !Number.isFinite(Date.parse(value[key])))) return null;
    result[key] = value[key];
  }
  return result;
}
export function verificationPhase(policy, elapsedMs = 0) {
  const value = normalizeVerification(policy);
  if (!value) return 'unavailable';
  if (value.state === 'verified') return 'verified';
  if (!value.cloud_actions_allowed) return 'required';
  const now = Date.parse(value.server_time) + Math.max(0, elapsedMs);
  return value.grace_started_at && now - Date.parse(value.grace_started_at) >= 86400000 ? 'warning' : 'initial';
}
export function verificationMessage(policy, elapsedMs = 0) {
  const phase = verificationPhase(policy, elapsedMs);
  if (phase === 'verified') return 'Your email is verified.';
  if (phase === 'unavailable') return 'Verification status is unavailable. Check again when you are online.';
  if (phase === 'required') return 'Verify your email to start new cloud work. Your account and local projects remain available.';
  const deadline = policy.grace_expires_at ? new Date(policy.grace_expires_at).toLocaleString() : null;
  if (!policy.enforcement_enabled) return 'Please verify your email. Cloud access is currently available.';
  return `You can use Nalana now. Verify your email${deadline ? ` by ${deadline}` : ''} to keep starting cloud work.`;
}
