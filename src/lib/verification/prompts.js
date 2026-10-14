const shown = new Set();
export function claimVerificationPrompt(sessionEpoch, phase) {
  if (!['initial', 'warning', 'required'].includes(phase)) return false;
  const key = `${sessionEpoch}:${phase}`;
  if (shown.has(key)) return false;
  shown.add(key);
  return true;
}
