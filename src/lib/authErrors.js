/**
 * Client-side auth error messages (matches server mapAuthError).
 * @param {number} status
 * @param {{ error?: string; detail?: string; message?: string }} data
 * @param {'login' | 'signup'} mode
 */
export function authErrorMessage(status, data, mode = 'login') {
  const detail = data?.error ?? data?.detail ?? data?.message;

  if (status === 401 && mode === 'login') {
    return detail || 'No account found. Please sign up first.';
  }
  if (status === 401) return detail || 'Invalid email or password.';
  if (status === 409) return detail || 'An account with this email already exists.';
  if (status === 503) {
    return detail || 'Auth service is not available. Please try again later.';
  }
  return detail || 'Something went wrong. Please try again.';
}
