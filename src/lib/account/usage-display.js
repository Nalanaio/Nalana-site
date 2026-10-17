/**
 * Only a successful usage response establishes displayed entitlements. The auth
 * projection's compatibility defaults cannot establish a current plan or balance.
 * @param {unknown} value
 * @returns {{plan: string|null, credits: number|null}}
 */
export function usageDisplay(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { plan: null, credits: null };
  const usage = /** @type {{plan?: unknown, tier?: unknown, credits_remaining?: unknown}} */ (value);
  const name = [usage.plan, usage.tier].find((entry) => typeof entry === 'string' && entry.trim());
  const rawPlan = typeof name === 'string' ? name.trim() : null;
  const labels = { free: 'Free', pro: 'Pro', team: 'Team' };
  const plan = rawPlan ? Object.hasOwn(labels,rawPlan.toLowerCase()) ? labels[rawPlan.toLowerCase()] : rawPlan : null;
  const credits = typeof usage.credits_remaining === 'number' && Number.isFinite(usage.credits_remaining) && usage.credits_remaining >= 0
    ? usage.credits_remaining : null;
  return { plan, credits };
}
