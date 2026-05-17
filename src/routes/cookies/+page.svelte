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
    <p class="updated">Last updated: May 5, 2026</p>
  </div>

  <div class="legal-body">

    <p>This Cookie Policy explains how Nalana, Inc. ("Nalana," "we," "us," or "our") uses cookies and similar tracking technologies when you visit <strong>nalana.io</strong>. This policy should be read alongside our <a href="/privacy">Privacy Policy</a>.</p>

    <div class="divider"></div>

    <h2>1. What Are Cookies?</h2>
    <p>Cookies are small text files placed on your device by a website. They are widely used to make websites work efficiently and to provide information to site owners. Cookies can be "persistent" (they remain on your device until they expire or are deleted) or "session" cookies (they are deleted when you close your browser).</p>

    <h2>2. How We Use Cookies</h2>
    <p>We use cookies on our website (<strong>nalana.io</strong>) for the following purposes:</p>

    <h3>Analytics cookies</h3>
    <p>We use Google Analytics 4 to understand how visitors interact with our website — which pages are most visited, how long people stay, and where they come from. This helps us improve the site and our product marketing.</p>
    <p>Google Analytics sets the following cookies:</p>
    <ul>
      <li><strong>_ga</strong> — Registers a unique ID to generate statistical data on how you use the website. Duration: 2 years.</li>
      <li><strong>_ga_[ID]</strong> — Used by Google Analytics 4 to persist session state. Duration: 2 years.</li>
    </ul>
    <p>These cookies do not identify you personally. The data collected is aggregated and anonymized. You can opt out of Google Analytics tracking using the <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener">Google Analytics Opt-out Browser Add-on</a>.</p>

    <h3>Strictly necessary cookies</h3>
    <p>Some cookies are essential for the website to function. These include session management cookies if you are logged in to your Nalana account. These cannot be disabled without affecting site functionality.</p>

    <h2>3. What We Do Not Use</h2>
    <p>We do not use:</p>
    <ul>
      <li>Advertising or retargeting cookies</li>
      <li>Third-party social media tracking pixels</li>
      <li>Fingerprinting or other persistent tracking beyond what is described above</li>
    </ul>

    <h2>4. Third-Party Cookies</h2>
    <p>Google Analytics is the only third-party service that sets cookies on nalana.io. Google's use of data collected through Analytics is governed by <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google's Privacy Policy</a>.</p>

    <h2>5. Managing Cookies</h2>
    <p>You can control and delete cookies through your browser settings. Most browsers allow you to:</p>
    <ul>
      <li>See what cookies are set and delete them individually</li>
      <li>Block third-party cookies</li>
      <li>Block cookies from particular sites</li>
      <li>Block all cookies from being set</li>
    </ul>
    <p>Note that blocking all cookies may affect the functionality of some parts of our website. For guidance on managing cookies in your browser, visit:</p>
    <ul>
      <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener">Chrome</a></li>
      <li><a href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer" target="_blank" rel="noopener">Firefox</a></li>
      <li><a href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac" target="_blank" rel="noopener">Safari</a></li>
      <li><a href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener">Edge</a></li>
    </ul>

    <h2>6. Do Not Track</h2>
    <p>Some browsers include a "Do Not Track" (DNT) feature that signals to websites that you do not want to be tracked. There is currently no industry standard for how websites should respond to DNT signals. We do not currently respond to DNT signals, but we do limit our tracking to the analytics described above.</p>

    <h2>7. Changes to This Policy</h2>
    <p>We may update this Cookie Policy as our website or tracking practices change. We will update the "Last updated" date at the top when we do.</p>

    <h2>8. Contact</h2>
    <p>Questions about our use of cookies? Contact us at <a href="mailto:clarence@nalana.io">clarence@nalana.io</a>.</p>

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
