<svelte:head>
  <title>Cookie Policy — Nalana</title>
</svelte:head>

<nav>
  <div class="glass nav-inner">
    <a href="/" class="nav-logo">Nalana</a>
    <a href="/" class="nav-back">← Back to home</a>
  </div>
</nav>

<div class="container">
  <div class="legal-header">
    <h1>Cookie Policy</h1>
    <p class="updated">Last updated: October 19, 2026</p>
  </div>

  <div class="legal-body">

    <p>This policy describes website cookies and similar storage. Optional analytics and visitor identification are default off. These choices are separate from optional in-app usage measurement and diagnostics.</p>
    <h2>Operational storage</h2>
    <p>Website account sessions and security controls use browser storage and private cookies as needed for authentication, recovery and restricted operator access. Operator cookies are HttpOnly, Secure and SameSite Strict, and expire after 15 minutes. Private backend credentials are not exposed to the browser.</p>
    <p>The download deduplication cookie is a signed random first-party value with a non-sliding lifetime of 24 hours. It is HttpOnly, Secure and SameSite Lax. It suppresses repeated notifications for the same browser, platform and release; it does not identify a unique person. Expiry, deletion, cookie blocking or another browser can produce a new identity. Cookies are not proof that a download finished or the application was installed.</p>
    <h2>Optional analytics and visitor identification</h2>
    <p>Google Analytics and Vercel Web Analytics measure permitted website activity under the usage analytics choice. Vercel Web Analytics runs only on our production website, with URL queries and fragments removed. RB2B is a separate visitor-identification integration and requires its own permission. An analytics or app usage grant does not silently enable RB2B. Vendor storage and retention depend on the vendor and configured service. We do not promise that vendor data is anonymous or that revocation erases information already sent.</p>
    <p>With usage permission, campaign labels from tagged links are kept in this tab's session storage for up to 30 minutes after the latest tagged visit, so permitted download-button clicks and successful website registrations can be attributed to that campaign. A new tagged visit replaces the previous campaign. A registration measurement marker expires after one minute and is consumed once. These values contain no account identifier, email, password or advertising click ID. Revoking usage permission clears them. Before permission, campaign labels are held only in the current document's memory.</p>
    <p>Optional first-party usage enrollment may use a pseudonymous browser visitor ID and session ID. Consented account association or an explicit pairing code can link a download with app activity. A pairing code expires after 15 minutes and does not authenticate an account, verify email or prove installation. Operational deduplication values, account email, passwords, verification tokens and pairing codes are not forwarded as analytics identities.</p>
    <p>Verification, password recovery, pairing and operator pages do not load optional third-party analytics or identification scripts. Changing optional choices stops new dispatch; a page reload may be needed to remove a vendor already loaded in the current document.</p>
    <h2>Change your choices</h2>
    <p><button type="button" on:click={(event) => window.dispatchEvent(new CustomEvent('nalana:privacy-settings', { detail: { opener: event.currentTarget } }))}>Open privacy settings</button> to review separate analytics and visitor-identification choices at any time. App usage permission and diagnostics are controlled separately inside Nalana Settings.</p>
    <p>Your browser can block or delete cookies and website storage. Blocking operational cookies may affect login or deduplication. Declining optional measurement does not prevent downloading or using local app features.</p>
    <h2>Retention and deletion</h2>
    <p>Optional raw measurement records and links are retained for up to 90 days; operational download records for 30 days; delivery audit records for 90 days; pairing records for 7 days with code secrets expiring after 15 minutes; nonidentifying daily aggregates for 13 months. Account policy state is retained for the account lifetime. Revocation stops new optional collection and clears pending uploads; it is separate from a request to delete historical records. See the <a href="/privacy">Privacy Policy</a> for deletion within 30 days and operational/security exceptions.</p>
    <h2>Contact</h2>
    <p>Questions about storage or choices? Email <a href="mailto:clarence@nalana.io">clarence@nalana.io</a>.</p>

  </div>
</div>

<footer>
  <div class="container" style="max-width:900px;">
    <div class="glass footer-inner">
      <span class="footer-wordmark">Nalana</span>
      <div class="footer-links">
        <a href="https://x.com/nalanaio" target="_blank" rel="noopener">Twitter</a>
        <a href="https://discord.gg/GXjbwrcwFz" target="_blank" rel="noopener">Discord</a>
        <a href="mailto:clarence@nalana.io">clarence@nalana.io</a>
      </div>
      <span class="footer-copy">© 2026 Nalana.</span>
    </div>
    <div class="footer-legal">
      <span class="footer-legal-label">Legal</span>
      <div class="footer-legal-links">
        <a href="/terms">Terms</a>
        <a href="/privacy">Privacy</a>
        <a href="/eula">EULA</a>
        <a href="/refund">Refund</a>
        <a href="/cookies">Cookies</a>
        <a href="/open-source">Open Source</a>
      </div>
    </div>
  </div>
</footer>

<style>
  :global(body) { cursor: auto; }

  nav {
    position: sticky; top: 0; z-index: 100;
    padding: 16px 5%;
    background: rgba(250,250,250,0.85);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid rgba(228,228,231,0.5);
  }
  .nav-inner {
    max-width: 900px; margin: 0 auto;
    display: flex; align-items: center; justify-content: space-between;
    background: none; backdrop-filter: none; border: none; box-shadow: none;
  }
  .nav-inner::before { display: none; }
  .nav-logo {
    font-family: 'KonkhmerSleokchher', sans-serif;
    font-size: 18px; color: var(--primary); text-decoration: none;
  }
  .nav-back {
    font-size: 14px; font-weight: 500; color: var(--muted);
    text-decoration: none; transition: color .15s;
  }
  .nav-back:hover { color: var(--ink-deep); }

  .container {
    max-width: 900px; margin: 0 auto;
    padding: 64px 5% 80px;
  }

  .legal-header { margin-bottom: 48px; }
  .legal-header h1 {
    font-family: 'Amulya', sans-serif;
    font-size: clamp(32px, 5vw, 52px);
    font-weight: 700; color: var(--ink-deep);
    letter-spacing: -0.02em; line-height: 1.1; margin-bottom: 12px;
  }
  .updated { font-size: 13px; color: var(--muted); }

  .legal-body { font-size: 15px; line-height: 1.8; color: #333; }
  .legal-body h2 {
    font-family: 'Amulya', sans-serif;
    font-size: 20px; font-weight: 700; color: var(--ink-deep);
    margin: 40px 0 12px; letter-spacing: -0.01em;
  }
  .legal-body p { margin-bottom: 16px; }
  .legal-body a { color: var(--primary); text-decoration: none; }
  .legal-body a:hover { text-decoration: underline; }


  footer { padding: 48px 5% 36px; }
  .footer-inner {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px 32px; border-radius: 24px; gap: 16px; flex-wrap: wrap;
  }
  .footer-wordmark { font-family: 'KonkhmerSleokchher', sans-serif; font-size: 18px; color: var(--primary); }
  .footer-links { display: flex; gap: 24px; }
  .footer-links a { font-size: 13px; font-weight: 500; color: var(--muted); text-decoration: none; transition: color .15s; }
  .footer-links a:hover { color: var(--ink-deep); }
  .footer-copy { font-size: 12px; color: #bbb; }
  .footer-legal { display: flex; align-items: center; justify-content: center; gap: 16px; padding: 14px 8px 0; flex-wrap: wrap; }
  .footer-legal-label { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #ccc; flex-shrink: 0; }
  .footer-legal-links { display: flex; gap: 20px; flex-wrap: wrap; }
  .footer-legal-links a { font-size: 12px; color: #bbb; text-decoration: none; transition: color .15s; }
  .footer-legal-links a:hover { color: var(--ink-deep); }

  @media (max-width: 600px) {
    .footer-inner { flex-direction: column; gap: 16px; text-align: center; }
    .footer-legal { justify-content: center; }
    .footer-legal-links { justify-content: center; }
  }
</style>
