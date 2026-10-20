import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

// SvelteKit intentionally omits PUBLIC_ keys from dynamic/private. Add only the
// public reporting catalog to the server configuration; credentials stay private.
export function campaignEnvironment() {
  return { ...privateEnv, PUBLIC_CAMPAIGN_ALLOWED_LABELS: publicEnv.PUBLIC_CAMPAIGN_ALLOWED_LABELS };
}
