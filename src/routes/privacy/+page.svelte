<svelte:head>
  <title>Privacy Policy — Nalana</title>
</svelte:head>

<nav>
  <div class="glass nav-inner">
    <a href="/" class="nav-logo">Nalana</a>
    <a href="/" class="nav-back">← Back to home</a>
  </div>
</nav>

<div class="container">
  <div class="legal-header">
    <h1>Privacy Policy</h1>
    <p class="updated">Last updated: October 19, 2026</p>
  </div>

  <div class="legal-body">

    <p>Nalana uses account information and operational records to provide the application, protect accounts and diagnose failures. Optional website analytics, visitor identification and in-app usage measurement have separate choices. See our <a href="/cookies">Cookie Policy</a> for website storage and controls.</p>
    <h2>Accounts and service operation</h2>
    <p>We process your email address, account profile, authentication and verification state, account entitlements and service requests. Passwords are checked against a protected password hash. Verification messages are sent through our email provider, Resend. Queued, provider accepted, delivered and bounced are distinct delivery states; delivery does not prove that you read a message.</p>
    <p>To provide requested AI features, Nalana sends the instructions and context needed for that request to the backend and its configured AI providers. Optional funnel measurement does not include prompts, generated code, scene contents, file paths, passwords, email addresses or verification tokens. Diagnostics have a separate setting and are not enabled by granting usage permission.</p>
    <h2>Operational download and activity records</h2>
    <p>Operational records describe account creation, sign-in outcomes, verification, authorized cloud operations, delivery and installer transfer attempts. For direct downloads, an internal request notification contains the requested platform and time, without your identity, IP address or browser details. It does not confirm a completed download, installation or unique person. The direct file transfer itself is unobserved. When transfer tracking is enabled, a download start means the transfer server accepted a nonempty response-body write. It does not establish a completed file, installation, application launch or a unique person.</p>
    <p>When transfer tracking is enabled, a first-party random download cookie helps suppress repeated transfer notifications within 24 hours. Direct request notifications are not deduplicated. The cookie is not used to fingerprint you or shared as a Google Analytics or RB2B identity. Deleting cookies or using another browser can create another identity.</p>
    <h2>Optional usage measurement and linking</h2>
    <p>Website analytics and app usage measurement are default off until you choose to allow them. With permission, pseudonymous usage records can describe current app readiness, observed result presentation, intentional revisions and explicit saves. An optional account association or short-lived download pairing code can connect permitted activity across surfaces. We do not match people by IP address, email address or nearby timestamps to invent a funnel link. Without permission or a valid explicit link, coverage remains unknown or unlinked.</p>
    <p>Google Analytics and Vercel Web Analytics use the optional usage analytics choice. Vercel Web Analytics runs only on our production website, with URL queries and fragments removed. RB2B visitor identification requires its own separate choice. RB2B is an identification service and its data must not be described as anonymous. Account, sign-in, recovery, verification, pairing and operator pages do not load these vendors. Change your choices using <button type="button" on:click={() => window.dispatchEvent(new Event('nalana:privacy-settings'))}>Privacy settings</button>. In-app usage permission is controlled separately in Nalana Settings.</p>
    <h2>Retention</h2>
    <ul>
      <li>Optional raw usage events, enrollments and links: up to 90 days.</li>
      <li>Operational download intents and attempts: up to 30 days.</li>
      <li>Verification delivery, reminder and webhook audit records: up to 90 days.</li>
      <li>Pairing codes: 15 minutes; pairing records: up to 7 days.</li>
      <li>Nonidentifying daily aggregates: up to 13 months.</li>
      <li>Account verification policy state: account lifetime. Active cloud-operation admission records remain available while the operation is live.</li>
    </ul>
    <p>These limits describe acquisition and usage measurement. Account, billing, support and security records may have different retention needs. We retain minimal operational or security evidence where needed to prevent abuse, resolve disputes or meet applicable obligations.</p>
    <h2>Your choices and deletion</h2>
    <p>You may revoke optional usage permission at any time. Revocation stops new optional collection and clears pending uploads; it does not erase all historical business records. You can request deletion of optional measurement records with proof of account or enrollment ownership. Requests are completed within 30 days, subject to disclosed security and operational exceptions. Contact <a href="mailto:clarence@nalana.io">clarence@nalana.io</a> for access, deletion or help with your choices.</p>
    <h2>Providers and security</h2>
    <p>Our hosting, database, email, payment and configured AI providers process information needed for the requested service. Optional website vendors run only under the applicable choice. We use access controls, encrypted transport and restricted credentials; no system can promise absolute security. Funnel events exclude raw IP addresses, raw user agents and sensitive URL queries; service security logs have a separate operational purpose.</p>
    <h2>Children and changes</h2>
    <p>Nalana is not directed at children under 13. We update this policy as practices change. Related documents: <a href="/terms">Terms</a>, <a href="/eula">EULA</a>, <a href="/refund">Refund Policy</a> and <a href="/cookies">Cookie Policy</a>.</p>

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
  .legal-body ul { padding-left: 24px; margin-bottom: 16px; }
  .legal-body li { margin-bottom: 8px; }
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
