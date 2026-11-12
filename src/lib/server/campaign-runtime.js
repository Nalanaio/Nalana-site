import * as privateEnv from '$app/env/private';
import * as publicEnv from '$app/env/public';

// SvelteKit intentionally omits PUBLIC_ keys from dynamic/private. Add only the
// public reporting catalog and default download channel to the server
// configuration; credentials stay private.
/** @returns {Record<string, string | undefined>} */
export function campaignEnvironment() {
  return {
    ...privateEnv,
    PUBLIC_CAMPAIGN_ALLOWED_LABELS: publicEnv.PUBLIC_CAMPAIGN_ALLOWED_LABELS,
    PUBLIC_DEFAULT_DOWNLOAD_CHANNEL: publicEnv.PUBLIC_DEFAULT_DOWNLOAD_CHANNEL,
  };
}
