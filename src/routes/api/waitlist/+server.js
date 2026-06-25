import { json } from '@sveltejs/kit';

/**
 * POST /api/waitlist  { email, platform }
 *
 * Early-access capture. Unlike the old /api/send-link, this NEVER hands out an
 * installer — we're gating access while we onboard studios manually. It:
 *   1. logs the signup to a Google Sheet (best-effort, if WAITLIST_SHEET_WEBHOOK is set),
 *   2. emails the team a lead notification,
 *   3. sends the user a "you're on the list" confirmation (no download link).
 *
 * Returns { ok: true } whenever the request is well-formed, even if a downstream
 * side-effect (email / sheet) fails — we never want to lose or block a lead on a
 * transient Resend/Sheets hiccup.
 */
export async function POST({ request }) {
  const body = await request.json().catch(() => ({}));
  const { email, platform } = body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Invalid email' }, { status: 400 });
  }

  const isWindows = platform === 'windows';
  const platformLabel = isWindows ? 'Windows' : 'Mac';

  // 1. Append to the Google Sheet (best-effort). Configure WAITLIST_SHEET_WEBHOOK
  //    to a Google Apps Script web-app URL that appends a row. No-op if unset.
  const sheetWebhook = process.env.WAITLIST_SHEET_WEBHOOK;
  const sheetLog = sheetWebhook
    ? fetch(sheetWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          platform: platformLabel,
          date: new Date().toISOString(),
          source: 'site-waitlist',
        }),
      }).catch((err) => {
        console.error('Waitlist sheet log failed:', err);
        return null;
      })
    : Promise.resolve(null);

  const apiKey = process.env.RESEND_API_KEY;

  // 2 + 3. Email side-effects only run when Resend is configured (prod). Missing
  //         key locally is fine — the lead still counts as captured.
  let emailWork = Promise.resolve(null);
  if (apiKey) {
    const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

    const userConfirmation = fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        from: 'Nalana <noreply@nalana.io>',
        to: email,
        subject: "You're on the Nalana early-access list",
        html: `
          <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;color:#1a1a1a;">
            <div style="font-size:28px;font-weight:700;color:#1085EF;letter-spacing:-0.5px;margin-bottom:4px;">Nalana</div>
            <div style="font-size:13px;color:#999;margin-bottom:32px;">3D creation. Just say it.</div>
            <p style="font-size:16px;line-height:1.6;margin-bottom:8px;">
              You're on the list. ✦
            </p>
            <p style="font-size:15px;line-height:1.6;color:#444;margin-bottom:8px;">
              We're onboarding a small group of studios each month and working with
              each one directly. We'll reach out personally within two business days
              to get you set up on <strong>${platformLabel}</strong>.
            </p>
            <p style="font-size:13px;color:#999;margin-top:28px;line-height:1.6;">
              Questions? Just reply to this email.<br>
              <a href="https://nalana.io" style="color:#1085EF;text-decoration:none;">nalana.io</a>
            </p>
          </div>
        `,
      }),
    });

    const leadNotification = fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        from: 'Nalana Leads <noreply@nalana.io>',
        to: 'clarence@nalana.io',
        subject: `New early-access request — ${platformLabel}`,
        html: `
          <div style="font-family:'Helvetica Neue',sans-serif;padding:24px;color:#1a1a1a;">
            <p style="margin:0 0 8px;"><strong>Email:</strong> ${email}</p>
            <p style="margin:0;"><strong>Platform:</strong> ${platformLabel}</p>
          </div>
        `,
      }),
    });

    emailWork = Promise.allSettled([userConfirmation, leadNotification]).then((results) => {
      results.forEach((r) => {
        if (r.status === 'rejected') console.error('Waitlist email failed:', r.reason);
      });
      return null;
    });
  } else {
    console.warn('RESEND_API_KEY not set — waitlist email skipped (lead still captured).');
  }

  await Promise.allSettled([sheetLog, emailWork]);

  return json({ ok: true });
}
