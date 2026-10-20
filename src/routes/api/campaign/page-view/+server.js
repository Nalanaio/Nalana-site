import { env } from '$env/dynamic/private';
import { handleCampaignPageView } from '$lib/server/campaign-measurement.js';

export async function POST({ request, url }) {
  return handleCampaignPageView({ request, url, env });
}
