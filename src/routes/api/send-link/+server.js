import { json } from '@sveltejs/kit';

/** POST /api/send-link  { email, platform } */
export async function POST({ request }) {
  const body = await request.json().catch(() => ({}));
  const { email, platform } = body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Invalid email' }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return json({ error: 'Email service not configured' }, { status: 500 });

  const isMac = platform !== 'windows';
  const platformLabel = isMac ? 'Mac' : 'Windows';

  // Send download link to user
  const userEmail = fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Nalana <noreply@nalana.io>',
      to: email,
      subject: `Your Nalana download link for ${platformLabel}`,
      html: `
        <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;color:#1a1a1a;">
          <div style="font-size:28px;font-weight:700;color:#1085EF;letter-spacing:-0.5px;margin-bottom:4px;">Nalana</div>
          <div style="font-size:13px;color:#999;margin-bottom:32px;">3D creation. Just say it.</div>
          <p style="font-size:16px;line-height:1.6;margin-bottom:8px;">
            Here's your download link for <strong>${platformLabel}</strong>. Open this on your computer and click below.
          </p>
          <p style="font-size:13px;color:#999;margin-bottom:28px;">Free to try. No account needed.</p>
          <a href="https://nalana.io/api/download?platform=${isMac ? 'mac' : 'windows'}"
             style="display:block;background:#1085EF;color:#fff;text-decoration:none;padding:16px 24px;border-radius:100px;font-size:15px;font-weight:600;text-align:center;">
            Download Nalana for ${platformLabel}
          </a>
          <p style="font-size:12px;color:#bbb;margin-top:32px;line-height:1.6;">
            ${isMac ? 'macOS 12+ · Apple Silicon & Intel' : 'Windows 10/11 · 64-bit'}<br>
            <a href="https://nalana.io" style="color:#1085EF;text-decoration:none;">nalana.io</a>
          </p>
        </div>
      `,
    }),
  });

  // Lead notification
  const leadNotification = fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Nalana Leads <noreply@nalana.io>',
      to: 'clarence@nalana.io',
      subject: `New lead — ${platformLabel}`,
      html: `
        <div style="font-family:'Helvetica Neue',sans-serif;padding:24px;color:#1a1a1a;">
          <p style="margin:0 0 8px;"><strong>Email:</strong> ${email}</p>
          <p style="margin:0;"><strong>Platform:</strong> ${platformLabel}</p>
        </div>
      `,
    }),
  });

  const [userRes] = await Promise.all([userEmail, leadNotification]);

  if (!userRes.ok) {
    const err = await userRes.text();
    console.error('Resend error:', err);
    return json({ error: 'Failed to send email' }, { status: 500 });
  }

  return json({ ok: true });
}
