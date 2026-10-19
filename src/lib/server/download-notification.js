/** Best-effort request notification; only the backend can confirm transfer starts. */
export async function notifyDownload({ platform, request, fetch, env = process.env }) {
  if (!env.RESEND_API_KEY || request.method !== 'GET' || !['mac', 'windows'].includes(platform)) return;
  const purpose = `${request.headers.get('purpose') || ''} ${request.headers.get('sec-purpose') || ''}`;
  if (/prefetch|preview|prerender/i.test(purpose)) return;
  if (/bot|crawler|spider|slackbot|facebookexternalhit|preview/i.test(request.headers.get('user-agent') || '')) return;

  const platformLabel = platform === 'mac' ? 'Mac' : 'Windows';
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(1500),
      body: JSON.stringify({
        from: 'Nalana <noreply@nalana.io>',
        to: env.DOWNLOAD_NOTIFICATION_EMAIL || 'clarence@nalana.io',
        subject: `Nalana download requested — ${platformLabel}`,
        text: `Someone requested the Nalana ${platformLabel} download on nalana.io.\n\nTime: ${new Date().toISOString()}\n\nThis records a download request, not a completed download or installation. The visitor is anonymous. Repeated requests do not represent unique people.`,
      }),
    });
    if (!response.ok) console.error('Download request notification rejected:', response.status);
  } catch {
    console.error('Download request notification failed or timed out.');
  }
}
