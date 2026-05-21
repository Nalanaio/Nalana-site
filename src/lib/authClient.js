import { EMAIL_NOT_VERIFIED_DETAIL, RESEND_SUCCESS_MESSAGE } from '$lib/auth/constants.js';

export { RESEND_SUCCESS_MESSAGE };

export const MIN_PASSWORD_LENGTH = 8;

export const FORGOT_PASSWORD_SUCCESS =
  'If an account exists for that email, we sent a password reset link.';

export const RESET_PASSWORD_SUCCESS = 'Your password has been reset. You can log in now.';

/**
 * @param {string} password
 * @param {string} [confirm]
 */
export function validatePassword(password, confirm) {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (confirm !== undefined && password !== confirm) {
    return 'Passwords do not match.';
  }
  return null;
}

/**
 * @param {{ error?: string; detail?: string; message?: string }} data
 */
export function apiDetail(data) {
  return data?.error ?? data?.detail ?? data?.message ?? '';
}

/**
 * @param {number} status
 * @param {{ error?: string; detail?: string }} data
 */
export function isEmailNotVerifiedError(status, data) {
  if (status !== 403) return false;
  const detail = apiDetail(data);
  return (
    detail === EMAIL_NOT_VERIFIED_DETAIL ||
    detail.toLowerCase().includes('email not verified')
  );
}

/**
 * @param {number} status
 * @param {{ error?: string; detail?: string; message?: string }} data
 * @param {'login' | 'signup'} mode
 */
export function authErrorMessage(status, data, mode = 'login') {
  if (isEmailNotVerifiedError(status, data)) {
    return 'Your email is not verified yet. Check your inbox, or contact support if you need help.';
  }

  const detail = apiDetail(data);

  if (status === 401 && mode === 'login') {
    return detail || 'Invalid email or password.';
  }
  if (status === 401) return detail || 'Invalid email or password.';
  if (status === 403) {
    return detail || 'Access denied. Please try again or contact support.';
  }
  if (status === 409) return detail || 'An account with this email already exists.';
  if (status === 503) {
    return detail || 'Auth service is not available. Please try again later.';
  }
  return detail || 'Something went wrong. Please try again.';
}

/** @param {string} email */
export async function resendVerificationEmail(email) {
  const res = await fetch('/api/auth/resend-verification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await res.json().catch(() => ({}));
  return {
    ok: res.ok,
    message: res.ok
      ? data.message ?? RESEND_SUCCESS_MESSAGE
      : data.error ?? data.detail ?? data.message ?? 'Could not send verification email.',
  };
}
