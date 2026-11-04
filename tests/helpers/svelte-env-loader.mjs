export async function resolve(specifier, context, nextResolve) {
  if (specifier === '$app/env/private') return { url: 'data:text/javascript,export%20const%20CAMPAIGN_TOTALS_ENABLED%20%3D%20undefined%3B', shortCircuit: true };
  if (specifier === '$app/env/public') return { url: 'data:text/javascript,export%20const%20PUBLIC_CAMPAIGN_ALLOWED_LABELS%20%3D%20undefined%3B', shortCircuit: true };
  return nextResolve(specifier, context);
}
