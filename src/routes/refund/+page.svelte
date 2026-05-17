<svelte:head>
  <title>Refund Policy — Nalana</title>
</svelte:head>

<nav>
  <div class="glass nav-inner">
    <a href="/" class="nav-logo">Nalana</a>
    <a href="/" class="nav-back">← Back to home</a>
  </div>
</nav>

<div class="container">
  <div class="legal-header">
    <h1>Refund Policy</h1>
    <p class="updated">Last updated: May 5, 2026</p>
  </div>

  <div class="legal-body">

    <p>This Refund Policy describes when and how Nalana, Inc. ("Nalana," "we," "us," or "our") issues refunds for purchases made through the Nalana desktop application or website. Because Nalana is downloadable software and sells digital subscriptions and credits — not physical goods — this policy reflects the nature of those digital products.</p>

    <div class="divider"></div>

    <h2>1. Subscriptions</h2>

    <h3>Monthly subscriptions</h3>
    <p>Monthly subscription charges are billed in advance at the start of each billing period. If you cancel a monthly subscription, you will retain access through the end of the current billing period. We do not issue prorated refunds for partial months.</p>

    <h3>Annual subscriptions</h3>
    <p>If you cancel an annual subscription within <strong>14 days</strong> of the initial purchase and have not used any paid features during that period, you are eligible for a full refund. After 14 days, or after using paid features, annual subscriptions are non-refundable.</p>

    <h3>Subscription renewals</h3>
    <p>If your subscription renews automatically and you did not intend to renew, contact us at <a href="mailto:clarence@nalana.io">clarence@nalana.io</a> within <strong>7 days</strong> of the renewal charge and we will evaluate a refund on a case-by-case basis, provided you have not used the Service during the renewal period.</p>

    <h2>2. Credit Purchases</h2>
    <p>Nalana credits are digital tokens consumed when using AI-powered features. Credit purchases are generally <strong>non-refundable</strong> once delivered, as they are immediately available for use.</p>
    <p>Exceptions may be made if:</p>
    <ul>
      <li>Credits were not delivered due to a technical error on our end</li>
      <li>You were charged for a purchase you did not authorize</li>
      <li>You contact us within 48 hours and the credits have not been used</li>
    </ul>
    <p>Unused credits have no cash value and are not transferable.</p>

    <h2>3. Free Tier and Trials</h2>
    <p>Nalana offers a free tier with limited credits at no cost. No refunds apply to free tier usage. If a paid trial was offered at a promotional rate, refund eligibility is stated at the time of purchase.</p>

    <h2>4. Technical Issues</h2>
    <p>If the Application is substantially non-functional due to a bug or error on our end — meaning core features do not work as described — and we are unable to resolve the issue within a reasonable timeframe, you may be eligible for a full or partial refund regardless of the standard windows above. Please report the issue to <a href="mailto:clarence@nalana.io">clarence@nalana.io</a> with details and we will investigate promptly.</p>

    <h2>5. Chargebacks</h2>
    <p>If you initiate a chargeback with your bank or card issuer rather than contacting us first, we reserve the right to suspend your account pending resolution. We encourage you to contact us directly — we are a small team and will work to make things right.</p>

    <h2>6. How to Request a Refund</h2>
    <p>To request a refund, email us at <a href="mailto:clarence@nalana.io">clarence@nalana.io</a> with:</p>
    <ul>
      <li>The email address associated with your account</li>
      <li>The date of purchase and the amount charged</li>
      <li>A brief description of why you are requesting a refund</li>
    </ul>
    <p>We aim to respond to all refund requests within <strong>3 business days</strong>. Approved refunds are processed to the original payment method and typically appear within 5–10 business days depending on your bank.</p>

    <h2>7. Changes to This Policy</h2>
    <p>We may update this policy as our pricing model evolves. The "Last updated" date above reflects the most recent revision. Continued use of the Service after changes constitutes acceptance.</p>

    <h2>8. Contact</h2>
    <p>Questions about refunds? Reach us at <a href="mailto:clarence@nalana.io">clarence@nalana.io</a>.</p>

  </div>
</div>

<footer>
  <div class="container" style="max-width:900px;">
    <div class="glass footer-inner">
      <span class="footer-wordmark">Nalana</span>
      <div class="footer-links">
        <a href="https://x.com/nalanaio" target="_blank" rel="noopener">Twitter</a>
        <a href="https://discord.gg/KRKCyxxkwb" target="_blank" rel="noopener">Discord</a>
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
  .legal-body h3 { font-size: 15px; font-weight: 600; color: var(--ink); margin: 24px 0 8px; }
  .legal-body p { margin-bottom: 16px; }
  .legal-body ul, .legal-body ol { padding-left: 24px; margin-bottom: 16px; }
  .legal-body li { margin-bottom: 8px; }
  .legal-body a { color: var(--primary); text-decoration: none; }
  .legal-body a:hover { text-decoration: underline; }
  .legal-body strong { font-weight: 600; color: var(--ink-deep); }

  .divider { height: 1px; background: var(--border); margin: 40px 0; }

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
