/** Best-effort notification; email failures must never prevent a download. */
export async function notifyDownload({ platform, request, fetch, env = process.env }) {
  if (!env.RESEND_API_KEY || request.method !== 'GET') return;
  // Ignore browser prefetches and link previews that advertise their purpose.
  const purpose = `${request.headers.get('purpose') || ''} ${request.headers.get('sec-purpose') || ''}`;
  if (/prefetch|preview/i.test(purpose)) return;

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
        subject: `Nalana download clicked — ${platformLabel}`,
        text: `Someone requested the Nalana ${platformLabel} download on nalana.io.\n\nTime: ${new Date().toISOString()}\n\nThis records a download request, not a completed download or installation. The visitor is anonymous.`,
      }),
    });
    if (!response.ok) console.error('Download notification rejected:', response.status);
  } catch {
    console.error('Download notification failed or timed out.');
  }
}
