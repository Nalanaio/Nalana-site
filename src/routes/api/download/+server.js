import { redirect } from '@sveltejs/kit';

/** GET /api/download?platform=mac|windows */
export function GET({ url }) {
  const platform = url.searchParams.get('platform');

  const urls = {
    mac:     process.env.NALANA_MAC_URL,
    windows: process.env.NALANA_WIN_URL,
  };

  const downloadUrl = urls[platform];

  if (!downloadUrl) {
    return new Response('Unknown platform. Use ?platform=mac or ?platform=windows', { status: 400 });
  }

  throw redirect(302, downloadUrl);
}
