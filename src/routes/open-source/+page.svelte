<svelte:head>
  <title>Open Source — Nalana</title>
</svelte:head>

<nav>
  <div class="glass nav-inner">
    <a href="/" class="nav-logo">Nalana</a>
    <a href="/" class="nav-back">← Back to home</a>
  </div>
</nav>

<div class="container">
  <div class="legal-header">
    <h1>Open Source</h1>
    <p class="updated">Last updated: May 5, 2026</p>
  </div>

  <div class="legal-body">

    <p>Nalana uses <strong>Blender</strong> as its underlying 3D engine. Everything else — the AI layer, the interface, the command system, and the backend — is built and owned by Nalana, Inc.</p>

    <div class="divider"></div>

    <h2>Blender</h2>
    <div class="component-meta">
      <span class="badge">GNU GPL v3.0</span>
      <a href="https://www.blender.org" target="_blank" rel="noopener">blender.org</a>
    </div>

    <p>Blender is the open source 3D creation suite that powers Nalana's geometry, rendering, and scene management. It is copyright © 2002–2026 Blender Foundation and contributors, licensed under the <a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noopener">GNU General Public License v3.0 (GPL)</a>.</p>

    <p>The GPL requires that any modifications to Blender be released as open source under the same license. Nalana's fork of Blender — which contains our modifications to the 3D engine — is publicly available here:</p>

    <div class="source-link">
      <a href="https://github.com/Nalanaio/Nalana-Fork-IDE" target="_blank" rel="noopener">github.com/Nalanaio/Nalana-Fork-IDE</a>
    </div>

    <p>The GPL applies only to our Blender fork. Nalana's AI system, natural language interface, backend services, and proprietary features are separate works and are not covered by the GPL.</p>

    <div class="divider"></div>

    <h2>Everything Else</h2>
    <p>All other parts of Nalana — the AI that understands your commands, the interface you interact with, and the cloud backend — are proprietary software developed and owned by Nalana, Inc. These are not open source and are governed by our <a href="/eula">End User License Agreement</a>.</p>

    <div class="divider"></div>

    <h2>Questions</h2>
    <p>If you have questions about our open source usage or GPL compliance, contact us at <a href="mailto:clarence@nalana.io">clarence@nalana.io</a>.</p>

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
    margin: 40px 0 8px; letter-spacing: -0.01em;
  }
  .legal-body p { margin-bottom: 16px; }
  .legal-body a { color: var(--primary); text-decoration: none; }
  .legal-body a:hover { text-decoration: underline; }
  .legal-body strong { font-weight: 600; color: var(--ink-deep); }

  .component-meta {
    display: flex; align-items: center; gap: 12px;
    margin-bottom: 16px;
  }
  .badge {
    display: inline-block;
    font-size: 11px; font-weight: 600; letter-spacing: 0.03em;
    padding: 3px 10px; border-radius: 100px;
    background: rgba(99, 91, 255, 0.08);
    color: var(--primary);
    border: 1px solid rgba(99, 91, 255, 0.2);
  }
  .component-meta a { font-size: 13px; color: var(--muted); }

  .source-link {
    background: rgba(0,0,0,0.03);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 14px 20px;
    margin-bottom: 16px;
    font-family: monospace; font-size: 14px;
  }
  .source-link a { color: var(--primary); }

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
