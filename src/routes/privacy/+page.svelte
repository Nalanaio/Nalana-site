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
    <p class="updated">Last updated: May 5, 2026</p>
  </div>

  <div class="legal-body">

    <p>This Privacy Policy describes how Nalana, Inc. ("Nalana," "we," "us," or "our") collects and uses information when you use our software ("Service"). We built Nalana with a minimal data footprint by design. <strong>We do not collect personal information through the application.</strong> For information about cookies used on this website, see our <a href="/cookies">Cookie Policy</a>.</p>

    <div class="divider"></div>

    <h2>1. What We Collect</h2>

    <h3>Creation activity data (in-app)</h3>
    <p>When you use Nalana to create 3D content, we collect anonymized data about your creative activity to improve the product. This includes:</p>
    <ul>
      <li><strong>Commands and prompts:</strong> The natural language instructions you give to generate or modify 3D objects and scenes — used in aggregate to improve Nalana's AI</li>
      <li><strong>Creation patterns:</strong> What types of objects, materials, and scenes are generated (e.g., "chair," "outdoor lighting") — no content is stored, only anonymous metadata</li>
      <li><strong>App version and OS:</strong> Which version of Nalana you're running and your operating system — used for compatibility and stability</li>
      <li><strong>Crash and error reports:</strong> Anonymized diagnostic data when the app crashes — used to fix bugs</li>
    </ul>
    <p>This data is <strong>not linked to your identity</strong>. We do not collect your name, email, IP address, or any other personal identifier through the application itself.</p>

    <h3>Website and contact</h3>
    <p>If you contact us via email, we retain that correspondence to respond to your inquiry. Our website uses Google Analytics 4 and standard server logs to understand traffic patterns. Analytics data is anonymized and not linked to your identity. For full details on what cookies are set, see our <a href="/cookies">Cookie Policy</a>.</p>

    <h2>2. What We Do Not Collect</h2>
    <ul>
      <li>Your name, email address, or identity — unless you contact us directly</li>
      <li>Your IP address or precise location through the app</li>
      <li>Payment or financial information of any kind</li>
      <li>Your actual 3D files, renders, or project data — these stay on your device</li>
      <li>Microphone or audio recordings</li>
    </ul>

    <h2>3. How We Use Activity Data</h2>
    <p>The anonymized creation data we collect is used exclusively to:</p>
    <ul>
      <li>Improve Nalana's AI models and command understanding</li>
      <li>Identify which features are used most and least</li>
      <li>Debug crashes and improve app stability</li>
      <li>Understand what kinds of 3D work people are doing</li>
    </ul>
    <p>We do not sell this data, use it for advertising, or share it with third parties for commercial purposes.</p>

    <h2>4. Opting Out</h2>
    <p>You can opt out of sending usage data to Nalana from within the application settings. Opting out does not affect your ability to use the software.</p>

    <h2>5. Data Sharing</h2>
    <p>We do not sell any data. We may share anonymized, aggregate data with:</p>
    <ul>
      <li><strong>Infrastructure providers:</strong> Services that host our backend (all data is anonymized before transmission)</li>
      <li><strong>Legal requirements:</strong> If required by law or valid legal process</li>
      <li><strong>Business transfers:</strong> In connection with a merger or acquisition, with the same privacy protections</li>
    </ul>

    <h2>6. Security</h2>
    <p>We use industry-standard encryption and security practices to protect the data we do collect. Because we don't collect personal information, the risk surface for our users is minimal by design.</p>

    <h2>7. Children</h2>
    <p>Nalana is not directed at children under 13. We do not knowingly collect any data from children under 13.</p>

    <h2>8. Related Policies</h2>
    <p>This Privacy Policy works alongside our other legal documents:</p>
    <ul>
      <li><a href="/terms">Terms of Service</a> — governing your use of the Service</li>
      <li><a href="/eula">End User License Agreement</a> — governing the desktop application specifically</li>
      <li><a href="/cookies">Cookie Policy</a> — describing cookies and analytics on nalana.io</a></li>
      <li><a href="/refund">Refund Policy</a> — describing how refunds are handled</li>
    </ul>

    <h2>9. Changes to This Policy</h2>
    <p>We may update this policy as the product evolves. We'll update the "Last updated" date at the top when we do. If we ever begin collecting personal information, we will update this policy significantly and notify users.</p>

    <h2>10. Contact</h2>
    <p>Questions about our data practices? Reach us at <a href="mailto:clarence@nalana.io">clarence@nalana.io</a>.</p>

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
        <a href="/terms">Terms</a>
        <a href="/privacy">Privacy</a>
        <a href="/eula">EULA</a>
        <a href="/refund">Refund</a>
        <a href="/cookies">Cookies</a>
      </div>
      <span class="footer-copy">© 2026 Nalana.</span>
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
  .footer-links { display: flex; gap: 24px; flex-wrap: wrap; }
  .footer-links a { font-size: 13px; font-weight: 500; color: var(--muted); text-decoration: none; transition: color .15s; }
  .footer-links a:hover { color: var(--ink-deep); }
  .footer-copy { font-size: 12px; color: #bbb; }

  @media (max-width: 600px) {
    .footer-inner { flex-direction: column; gap: 16px; text-align: center; }
    .footer-links { justify-content: center; }
  }
</style>
