export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Email service not configured' });

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Nalana <noreply@nalana.io>',
      to: email,
      subject: 'Your Nalana download link',
      html: `
        <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;color:#1a1a1a;">
          <div style="font-size:28px;font-weight:700;color:#1085EF;letter-spacing:-0.5px;margin-bottom:8px;">Nalana</div>
          <div style="font-size:13px;color:#999;margin-bottom:32px;">3D creation. Just say it.</div>

          <p style="font-size:16px;line-height:1.6;margin-bottom:28px;">
            Here are your download links. Open this email on your Mac or Windows machine and click below.
          </p>

          <a href="https://nalana.io/api/download?platform=mac"
             style="display:block;background:#1085EF;color:#fff;text-decoration:none;padding:14px 24px;border-radius:100px;font-size:15px;font-weight:600;text-align:center;margin-bottom:12px;">
            Download for Mac
          </a>
          <a href="https://nalana.io/api/download?platform=windows"
             style="display:block;background:#f5f5f5;color:#1a1a1a;text-decoration:none;padding:14px 24px;border-radius:100px;font-size:15px;font-weight:600;text-align:center;border:1px solid #e4e4e7;">
            Download for Windows
          </a>

          <p style="font-size:12px;color:#bbb;margin-top:32px;line-height:1.6;">
            Free to try. No account needed. macOS 12+ · Windows 10/11 · Apple Silicon &amp; Intel<br>
            <a href="https://nalana.io" style="color:#1085EF;text-decoration:none;">nalana.io</a>
          </p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('Resend error:', err);
    return res.status(500).json({ error: 'Failed to send email' });
  }

  return res.status(200).json({ ok: true });
}
