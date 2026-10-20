import { campaignEnvironment } from '$lib/server/campaign-runtime.js';
import { handleCampaignPageView } from '$lib/server/campaign-measurement.js';

export async function POST({ request, url }) {
  return handleCampaignPageView({ request, url, env: campaignEnvironment() });
}
