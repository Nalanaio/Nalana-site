<script>
  import { onMount, onDestroy } from 'svelte';
  import NalanaDemo from '$lib/components/NalanaDemo.svelte';
  import NalanaFeed from '$lib/components/NalanaFeed.svelte';
  import NalanaTryIt from '$lib/components/NalanaTryIt.svelte';

  // ── OS detection ──
  let detectedOS = 'unknown';
  $: showMac = detectedOS !== 'windows';
  $: showWin = detectedOS !== 'mac';

  // ── Early-access waitlist ──
  let waitlistEmail = '';
  let waitlistDone = false;
  let waitlistLoading = false;
  let waitlistPlatform = '';   // OS the visitor showed interest in (from the CTA they clicked)
  let waitlistInput;           // bound <input>, focused when a CTA scrolls to the form

  function requestAccess(platform, location) {
    waitlistPlatform = platform || '';
    if (typeof gtag !== 'undefined') gtag('event', 'request_access', { platform, location });
    // The CTA's href="#access" scrolls to the form; drop the cursor in the field once there.
    setTimeout(() => waitlistInput?.focus({ preventScroll: true }), 500);
  }

  async function handleWaitlist() {
    if (!waitlistEmail || waitlistLoading) return;
    if (!waitlistEmail.includes('@')) return;
    waitlistLoading = true;
    try {
      const platform = waitlistPlatform || (detectedOS === 'windows' ? 'windows' : 'mac');
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: waitlistEmail, platform }),
      });
      if (res.ok) waitlistDone = true;
    } catch {}
    waitlistLoading = false;
  }

  // ── Mouse-follow blur ball ──
  let ball;
  let raf;
  let onMove;

  // ── Demo reveal-on-scroll ──
  let demoEl;
  let demoVisible = false;
  let demoIO;
  let revealTimer;
  let onScroll;
  let scrolled = false;

  onMount(() => {
    const ua = navigator.userAgent;
    if (/Mac|iPhone|iPad|iPod/.test(ua) && !/Windows/.test(ua)) detectedOS = 'mac';
    else if (/Windows/.test(ua)) detectedOS = 'windows';

    let mx = window.innerWidth * 0.5;
    let my = window.innerHeight * 0.4;
    let bx = mx;
    let by = my;
    onMove = (e) => { mx = e.clientX; my = e.clientY; };
    window.addEventListener('mousemove', onMove);
    const loop = () => {
      bx += (mx - bx) * 0.12;
      by += (my - by) * 0.12;
      if (ball) ball.style.transform = `translate(${bx}px,${by}px)`;
      raf = requestAnimationFrame(loop);
    };
    loop();

    if (demoEl) {
      if ('IntersectionObserver' in window) {
        demoIO = new IntersectionObserver(
          (entries) => {
            entries.forEach((e) => {
              if (e.isIntersecting) { demoVisible = true; demoIO.disconnect(); }
            });
          },
          { threshold: 0.4 }
        );
        demoIO.observe(demoEl);
      } else {
        demoVisible = true;
      }

      // Fallback: if the user hasn't scrolled within 3s, reveal anyway so the
      // demo sharpens into focus and signals there's more below.
      onScroll = () => { scrolled = true; };
      window.addEventListener('scroll', onScroll, { passive: true, once: true });
      revealTimer = setTimeout(() => { if (!scrolled) demoVisible = true; }, 3000);
    }
  });

  onDestroy(() => {
    if (onMove) window.removeEventListener('mousemove', onMove);
    if (raf) cancelAnimationFrame(raf);
    if (demoIO) demoIO.disconnect();
    if (revealTimer) clearTimeout(revealTimer);
    if (onScroll) window.removeEventListener('scroll', onScroll);
  });
</script>

<svelte:head>
  <title>Nalana — Build in 3D by describing what you want</title>
  <meta name="description" content="Nalana turns your words into real, editable geometry: clean topology, production-ready, fully yours to refine. The AI-native 3D studio, built on Blender." />
</svelte:head>

<div id="top" class="page-b">
  <!-- animated gradient blobs -->
  <div class="blob b1"></div>
  <div class="blob b2"></div>
  <div class="blob b3"></div>
  <div class="blob b4"></div>
  <div class="blob b5"></div>
  <div class="ball" bind:this={ball}></div>

  <!-- NAV -->
  <nav class="nav">
    <a href="#top" class="nav-logo">
      <svg width="20" height="24" viewBox="0 0 69 82" fill="none"><path d="M68.5 69.33C68.5 71.51 66.73 73.29 64.54 73.29C62.67 73.29 61.07 71.97 60.52 70.18C59 65.25 56.25 59.81 52.4 54.57C42.79 41.47 29.98 34.54 23.78 39.09C17.59 43.63 20.36 57.93 29.97 71.03C30.65 71.95 30.01 73.29 28.86 73.29H11.75C9.54 73.29 7.75 71.5 7.75 69.29V4C7.75 1.79 9.54 0 11.75 0H15.14C17 0 18.6 1.29 19.17 3.05C20.73 7.8 23.41 12.98 27.08 17.99C36.69 31.09 49.5 38.02 55.7 33.47C61.89 28.93 59.12 14.63 49.51 1.53C49.04 0.9 49.49 0 50.27 0H64.5C66.71 0 68.5 1.79 68.5 4V69.33Z" fill="#FF8C69"/><path d="M61.75 69.33C61.75 71.51 59.98 73.29 57.79 73.29C55.92 73.29 54.32 71.97 53.77 70.18C52.25 65.25 49.5 59.81 45.65 54.57C36.04 41.47 23.23 34.54 17.03 39.09C10.84 43.63 13.61 57.93 23.22 71.03C23.9 71.95 23.26 73.29 22.11 73.29H5C2.79 73.29 1 71.5 1 69.29V4C1 1.79 2.79 0 5 0H8.39C10.25 0 11.85 1.29 12.42 3.05C13.98 7.8 16.66 12.98 20.33 17.99C29.94 31.09 42.75 38.02 48.95 33.47C55.14 28.93 52.37 14.63 42.76 1.53C42.29 0.9 42.74 0 43.52 0H57.75C59.96 0 61.75 1.79 61.75 4V69.33Z" fill="#1085EF"/></svg>
      <span class="wordmark">nalana</span>
    </a>
    <div class="nav-center">
      <a href="#demo">Demo</a>
      <a href="#features">Features</a>
      <a href="#access">Early access</a>
      <a href="/login">Profile</a>
    </div>
    <div class="nav-right">
      {#if showMac}
        <a class="nav-os mac" href="#access" on:click={() => requestAccess('mac', 'nav')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#0a0a0a"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>Request access
        </a>
      {/if}
      {#if showWin}
        <a class="nav-os win" href="#access" on:click={() => requestAccess('windows', 'nav')}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="#fff"><path d="M3 5.557L10.173 4.5v7.145H3V5.557zM11 4.35L20.994 3v8.645H11V4.35zM3 12.345h7.173V19.5L3 18.442v-6.097zM11 12.345h9.994v8.61L11 19.63v-7.285z"/></svg>Request access
        </a>
      {/if}
    </div>
  </nav>

  <div class="wrap">
    <!-- HERO -->
    <section class="hero">
      <div class="hero-badge"><span class="dot-green"></span>Nalana V2 is now available for early access</div>
      <h1 class="hero-h1">Build anything.</h1>
      <p class="hero-sub">Nalana turns your words into real, editable geometry: clean topology, production-ready, fully yours to refine.</p>
      <div class="not-plugin"><span class="np-badge">Not a plugin</span>nalana is its own software, built on Blender.</div>
      <div class="hero-ctas">
        {#if showMac}
          <a class="os-cta dark" href="#access" on:click={() => requestAccess('mac', 'hero')}>
            <span class="cta-def"><svg width="17" height="17" viewBox="0 0 24 24" fill="#fff"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>Request early access</span>
            <span class="cta-hov">We onboard studios weekly →</span>
          </a>
        {/if}
        {#if showWin}
          <a class="os-cta blue" href="#access" on:click={() => requestAccess('windows', 'hero')}>
            <span class="cta-def"><svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M3 5.557L10.173 4.5v7.145H3V5.557zM11 4.35L20.994 3v8.645H11V4.35zM3 12.345h7.173V19.5L3 18.442v-6.097zM11 12.345h9.994v8.61L11 19.63v-7.285z"/></svg>Request early access</span>
            <span class="cta-hov">We onboard studios weekly →</span>
          </a>
        {/if}
      </div>
    </section>

    <!-- DEMO -->
    <section id="demo" class="demo-section" class:revealed={demoVisible} bind:this={demoEl}>
      <div class="demo-frame">
        <div class="demo-inner">
          <NalanaDemo theme="color" />
        </div>
      </div>
    </section>

    <!-- VALIDATION STRIP -->
    <section class="validation">
      <span class="used-by">Used by creators from</span>
      <div class="logos">
        <span class="vlogo">USC</span>
        <span class="vlogo">GDA·V</span>
        <span class="vlogo wide">WAYFAIR</span>
      </div>
    </section>

    <!-- FEATURES -->
    <section id="features" class="features">
      <div class="feat-head">
        <div class="eyebrow">Built for how creators actually think</div>
        <h2 class="feat-h2">You direct. It builds.</h2>
        <p class="feat-sub">You think in outcomes, not menus. So does Nalana. Describe what you want and watch real geometry take shape. You stay the artist. The busywork disappears.</p>
      </div>

      <div class="feat-blocks">
        <!-- 01 -->
        <div class="block">
          <div class="block-visual"><NalanaFeed /></div>
          <div class="block-copy">
            <div class="block-num">01</div>
            <h3>Idea to model in minutes</h3>
            <p>Skip the box-modeling grind. Say what you're after and Nalana builds it: clean, editable, ready to refine.</p>
          </div>
        </div>

        <!-- 02 -->
        <div class="block">
          <div class="block-copy">
            <div class="block-num">02</div>
            <h3>One space instead of five apps</h3>
            <p>Stop bouncing between programs to finish one thing. Model the way you think, all in one place.</p>
          </div>
          <div class="collapse-visual">
            <div class="appwin" style="top:20%;left:13%;width:70px;height:50px;--fx:140px;--fy:74px;animation-delay:0s;">Modeler</div>
            <div class="appwin" style="top:16%;right:14%;width:64px;height:46px;--fx:-138px;--fy:88px;animation-delay:.15s;">Sculpt</div>
            <div class="appwin" style="bottom:18%;left:18%;width:66px;height:48px;--fx:120px;--fy:-80px;animation-delay:.3s;">UV</div>
            <div class="appwin" style="bottom:15%;right:17%;width:60px;height:44px;--fx:-128px;--fy:-92px;animation-delay:.45s;">Render</div>
            <div class="appwin" style="top:46%;left:8%;width:56px;height:40px;--fx:172px;--fy:-6px;animation-delay:.6s;">Texture</div>
            <div class="appmain">
              <svg width="24" height="29" viewBox="0 0 69 82" fill="none"><path d="M68.5 69.33C68.5 71.51 66.73 73.29 64.54 73.29C62.67 73.29 61.07 71.97 60.52 70.18C59 65.25 56.25 59.81 52.4 54.57C42.79 41.47 29.98 34.54 23.78 39.09C17.59 43.63 20.36 57.93 29.97 71.03C30.65 71.95 30.01 73.29 28.86 73.29H11.75C9.54 73.29 7.75 71.5 7.75 69.29V4C7.75 1.79 9.54 0 11.75 0H15.14C17 0 18.6 1.29 19.17 3.05C20.73 7.8 23.41 12.98 27.08 17.99C36.69 31.09 49.5 38.02 55.7 33.47C61.89 28.93 59.12 14.63 49.51 1.53C49.04 0.9 49.49 0 50.27 0H64.5C66.71 0 68.5 1.79 68.5 4V69.33Z" fill="#FF8C69"/><path d="M61.75 69.33C61.75 71.51 59.98 73.29 57.79 73.29C55.92 73.29 54.32 71.97 53.77 70.18C52.25 65.25 49.5 59.81 45.65 54.57C36.04 41.47 23.23 34.54 17.03 39.09C10.84 43.63 13.61 57.93 23.22 71.03C23.9 71.95 23.26 73.29 22.11 73.29H5C2.79 73.29 1 71.5 1 69.29V4C1 1.79 2.79 0 5 0H8.39C10.25 0 11.85 1.29 12.42 3.05C13.98 7.8 16.66 12.98 20.33 17.99C29.94 31.09 42.75 38.02 48.95 33.47C55.14 28.93 52.37 14.63 42.76 1.53C42.29 0.9 42.74 0 43.52 0H57.75C59.96 0 61.75 1.79 61.75 4V69.33Z" fill="#1085EF"/></svg>
            </div>
          </div>
        </div>

        <!-- 03 -->
        <div class="block">
          <div class="compare-visual">
            <div class="compare-col">
              <svg width="120" height="120" viewBox="0 0 100 100" fill="none" stroke="#aab0bd" stroke-width="1.2"><g style="stroke-dasharray:620;animation:ftDrawMessy 4s ease-in-out infinite;"><path d="M50 14 L70 22 L80 40 L74 60 L82 72 L60 84 L42 80 L26 86 L18 66 L24 48 L16 34 L34 24 Z"/><path d="M50 14 L42 80"/><path d="M70 22 L26 86"/><path d="M80 40 L18 66"/><path d="M74 60 L34 24"/><path d="M60 84 L24 48"/><path d="M82 72 L16 34"/><path d="M50 14 L60 84"/><path d="M34 24 L82 72"/></g></svg>
              <span class="compare-label gray">diffusion</span>
            </div>
            <div class="compare-divider"><span>vs</span></div>
            <div class="compare-col">
              <svg width="120" height="120" viewBox="0 0 100 100" fill="none" stroke="#1085EF" stroke-width="1.2"><g style="stroke-dasharray:620;animation:ftDrawClean 4s ease-in-out infinite;"><polygon points="50,16 71,28 71,52 50,64 29,52 29,28"/><polygon points="50,64 71,52 71,72 50,84 29,72 29,52"/><line x1="50" y1="16" x2="50" y2="64"/><line x1="71" y1="28" x2="71" y2="72"/><line x1="29" y1="28" x2="29" y2="72"/><line x1="50" y1="40" x2="71" y2="40"/><line x1="50" y1="40" x2="29" y2="40"/><line x1="29" y1="62" x2="71" y2="62"/></g></svg>
              <span class="compare-label blue">nalana</span>
            </div>
          </div>
          <div class="block-copy">
            <div class="block-num">03</div>
            <h3>Real geometry, not generated guesswork</h3>
            <p>Nalana builds from the ground up. Actual topology, not scraped blobs. Production-ready for any pipeline.</p>
          </div>
        </div>

        <!-- 04 -->
        <div class="block">
          <div class="block-copy">
            <div class="block-num">04</div>
            <h3>Still your craft</h3>
            <p>Nalana doesn't replace the artist. It expands what one is capable of. The vision stays yours.</p>
          </div>
          <div class="block-visual"><NalanaTryIt /></div>
        </div>
      </div>
    </section>

    <!-- EARLY ACCESS -->
    <section id="access" class="access">
      <div class="access-card">
        <div class="access-blob a1"></div>
        <div class="access-blob a2"></div>
        <div class="access-inner">
          <div class="eyebrow light">Early access</div>
          <h2 class="access-h2">We're onboarding studios now.</h2>
          <p class="access-p">Tell us about your team. We're bringing on a small group of studios each month and working with each one directly.</p>
          {#if waitlistDone}
            <div class="access-done">✦ You're on the list. We'll reach out personally within two business days.</div>
          {:else}
            <div class="access-form">
              <input
                type="email"
                bind:this={waitlistInput}
                bind:value={waitlistEmail}
                on:keydown={(e) => e.key === 'Enter' && handleWaitlist()}
                placeholder="you@studio.com"
              />
              <button on:click={handleWaitlist} disabled={waitlistLoading}>
                {waitlistLoading ? '…' : 'Request access →'}
              </button>
            </div>
            <p class="access-fine">No card required. We reply to every request personally.</p>
          {/if}
        </div>
      </div>
    </section>

    <!-- FOOTER -->
    <footer class="footer">
      <div class="footer-bar">
        <span class="footer-brand">
          <svg width="18" height="22" viewBox="0 0 69 82" fill="none"><path d="M61.75 69.33C61.75 71.51 59.98 73.29 57.79 73.29C55.92 73.29 54.32 71.97 53.77 70.18C52.25 65.25 49.5 59.81 45.65 54.57C36.04 41.47 23.23 34.54 17.03 39.09C10.84 43.63 13.61 57.93 23.22 71.03C23.9 71.95 23.26 73.29 22.11 73.29H5C2.79 73.29 1 71.5 1 69.29V4C1 1.79 2.79 0 5 0H8.39C10.25 0 11.85 1.29 12.42 3.05C13.98 7.8 16.66 12.98 20.33 17.99C29.94 31.09 42.75 38.02 48.95 33.47C55.14 28.93 52.37 14.63 42.76 1.53C42.29 0.9 42.74 0 43.52 0H57.75C59.96 0 61.75 1.79 61.75 4V69.33Z" fill="#1085EF"/></svg>
          <span class="wordmark">nalana</span>
        </span>
        <div class="footer-links">
          <a href="https://x.com/nalanaio" target="_blank" rel="noopener">Twitter</a>
          <a href="https://discord.gg/KRKCyxxkwb" target="_blank" rel="noopener">Discord</a>
          <a href="mailto:clarence@nalana.io">clarence@nalana.io</a>
        </div>
        <span class="footer-copy">© 2026 Nalana</span>
      </div>
      <div class="footer-legal">
        <span class="legal-label">Legal</span>
        <div class="legal-links">
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
          <a href="/eula">EULA</a>
          <a href="/refund">Refund</a>
          <a href="/cookies">Cookies</a>
          <a href="/open-source">Open Source</a>
        </div>
      </div>
    </footer>
  </div>
</div>

<style>
  /* the redesign has no custom cursor; undo the global body{cursor:none} on this page only */
  .page-b { position: relative; background: #fafafa; overflow: hidden; color: #0a0a0a; font-family: 'Inter', sans-serif; cursor: auto; }
  ::selection { background: rgba(16, 133, 239, 0.18); }

  /* animated gradient blobs */
  .blob { position: fixed; border-radius: 50%; z-index: 0; pointer-events: none; filter: blur(60px); animation: nlGlow 11s ease-in-out infinite; }
  .b1 { width: 50vw; height: 50vw; top: -14vw; left: -10vw; background: radial-gradient(circle, rgba(70, 145, 250, 0.6), transparent 62%); animation-duration: 9s; }
  .b2 { width: 44vw; height: 44vw; top: -8vw; right: -12vw; background: radial-gradient(circle, rgba(90, 170, 255, 0.5), transparent 62%); animation-delay: 1s; }
  .b3 { width: 40vw; height: 40vw; top: 34vh; right: -6vw; background: radial-gradient(circle, rgba(120, 135, 235, 0.42), transparent 64%); filter: blur(70px); animation-duration: 14s; animation-delay: 2s; }
  .b4 { width: 46vw; height: 46vw; bottom: -14vw; left: 6vw; background: radial-gradient(circle, rgba(60, 135, 250, 0.46), transparent 62%); filter: blur(70px); animation-duration: 12s; animation-delay: 1.5s; }
  .b5 { width: 34vw; height: 34vw; bottom: -6vw; right: 20vw; background: radial-gradient(circle, rgba(255, 140, 105, 0.24), transparent 64%); filter: blur(70px); animation-duration: 13s; animation-delay: 2.5s; }
  .ball { position: fixed; top: 0; left: 0; width: 420px; height: 420px; margin: -210px 0 0 -210px; border-radius: 50%; background: radial-gradient(circle, rgba(90, 160, 255, 0.22), rgba(110, 170, 250, 0.09) 45%, transparent 70%); filter: blur(80px); z-index: 1; pointer-events: none; will-change: transform; transform: translate(50vw, 40vh); }

  /* nav */
  .nav { position: fixed; top: 22px; left: 0; right: 0; z-index: 500; display: flex; align-items: center; justify-content: space-between; padding: 0 28px; pointer-events: none; transform: none; width: auto; max-width: none; }
  .nav-logo { pointer-events: auto; display: flex; align-items: center; gap: 1px; padding: 9px 20px 9px 15px; border-radius: 100px; background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(22px); -webkit-backdrop-filter: blur(22px); border: 1px solid rgba(255, 255, 255, 0.7); box-shadow: 0 8px 30px rgba(20, 30, 80, 0.1); text-decoration: none; }
  .wordmark { font-family: 'Amulya', sans-serif; font-weight: 700; color: #0a0a0a; }
  .nav-logo .wordmark { font-size: 18px; margin-left: 6px; }
  .nav-center { pointer-events: auto; position: absolute; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 4px; padding: 7px; border-radius: 100px; background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(22px); -webkit-backdrop-filter: blur(22px); border: 1px solid rgba(255, 255, 255, 0.7); box-shadow: 0 8px 30px rgba(20, 30, 80, 0.1); }
  .nav-center a { font-size: 13.5px; font-weight: 500; color: #444; text-decoration: none; padding: 8px 16px; border-radius: 100px; transition: background 0.18s; }
  .nav-center a:hover { background: rgba(244, 244, 245, 0.85); }
  .nav-right { pointer-events: auto; display: flex; align-items: center; gap: 10px; }
  .nav-os { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 600; text-decoration: none; padding: 10px 16px; border-radius: 100px; }
  .nav-os.mac { color: #0a0a0a; background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(22px); border: 1px solid rgba(255, 255, 255, 0.7); box-shadow: 0 6px 18px rgba(20, 30, 80, 0.1); }
  .nav-os.win { color: #fff; background: linear-gradient(135deg, #3a9bf2, #1085ef 55%, #5b6ef0); box-shadow: 0 6px 18px rgba(16, 133, 239, 0.3); }

  .wrap { position: relative; z-index: 10; max-width: 1180px; margin: 0 auto; padding: 0 28px; }

  /* hero */
  .hero { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; min-height: 88vh; min-height: 88svh; padding: 96px 0 40px; }
  .hero-badge { display: inline-flex; align-items: center; gap: 9px; padding: 8px 16px; border-radius: 100px; background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(14px); border: 1px solid rgba(255, 255, 255, 0.8); box-shadow: 0 4px 16px rgba(20, 30, 80, 0.06); font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: #1a1a1a; margin-bottom: 30px; }
  .dot-green { width: 7px; height: 7px; border-radius: 50%; background: #28c840; box-shadow: 0 0 8px #28c840; }
  .hero-h1 { font-family: 'Amulya', sans-serif; font-size: clamp(44px, 6vw, 76px); font-weight: 700; line-height: 1.05; letter-spacing: -0.025em; color: #0a0a0a; max-width: 920px; margin: 0 0 22px; }
  .hero-sub { font-size: 19px; line-height: 1.6; color: #3a3a3a; font-weight: 450; max-width: 580px; margin: 0 0 16px; }
  .not-plugin { display: inline-flex; align-items: center; gap: 9px; padding: 7px 16px; border-radius: 100px; background: rgba(255, 255, 255, 0.6); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.8); font-size: 13px; color: #4a4a52; margin-bottom: 32px; }
  .np-badge { font-size: 10px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #1085ef; background: rgba(16, 133, 239, 0.1); padding: 3px 9px; border-radius: 100px; }
  .hero-ctas { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; justify-content: center; margin-bottom: 30px; }
  .os-cta { display: inline-flex; align-items: center; text-decoration: none; padding: 16px 28px; border-radius: 100px; font-size: 15px; font-weight: 600; color: #fff; cursor: pointer; }
  .os-cta.dark { background: #0a0a0a; box-shadow: 0 10px 28px rgba(10, 10, 30, 0.25); }
  .os-cta.blue { background: linear-gradient(135deg, #3a9bf2, #1085ef 55%, #5b6ef0); box-shadow: inset 0 2px 4px rgba(255, 255, 255, 0.4), 0 10px 28px rgba(16, 133, 239, 0.34); }
  .os-cta .cta-def { display: inline-flex; align-items: center; gap: 9px; }
  .os-cta .cta-hov { display: none; }
  .os-cta:hover .cta-def { display: none; }
  .os-cta:hover .cta-hov { display: inline-flex; align-items: center; gap: 8px; }

  /* demo */
  .demo-section { padding: 16px 0 80px; }
  .demo-frame { position: relative; border-radius: 24px; padding: 14px; background: rgba(255, 255, 255, 0.5); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.8); box-shadow: inset 0 2px 10px rgba(255, 255, 255, 0.7), 0 30px 80px -24px rgba(20, 30, 80, 0.4); opacity: 0.18; filter: blur(8px); transform: translateY(18px); transition: opacity 0.85s ease, filter 0.85s ease, transform 0.9s cubic-bezier(0.22, 0.7, 0.2, 1); }
  .demo-section.revealed .demo-frame { opacity: 1; filter: blur(0); transform: none; }
  @media (prefers-reduced-motion: reduce) {
    .demo-frame { opacity: 1; filter: none; transform: none; transition: none; }
  }
  .demo-inner { height: 540px; border-radius: 14px; overflow: hidden; }

  /* validation */
  .validation { padding: 30px 0 70px; display: flex; align-items: center; justify-content: center; gap: 30px; flex-wrap: wrap; }
  .used-by { font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #8a8a93; }
  .logos { display: flex; gap: 36px; align-items: center; flex-wrap: wrap; justify-content: center; }
  .vlogo { font-family: 'Amulya', sans-serif; font-size: 27px; font-weight: 700; color: #5a5a64; letter-spacing: 0.01em; }
  .vlogo.wide { letter-spacing: 0.04em; }

  /* features */
  .features { padding: 80px 0 60px; }
  .feat-head { text-align: center; max-width: 680px; margin: 0 auto 64px; }
  .eyebrow { font-size: 12px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #1085ef; margin-bottom: 16px; }
  .feat-h2 { font-family: 'Amulya', sans-serif; font-size: clamp(36px, 5vw, 60px); font-weight: 700; color: #0a0a0a; margin: 0 0 18px; letter-spacing: -0.025em; line-height: 1.02; }
  .feat-sub { font-size: 18px; line-height: 1.6; color: #4a4a52; margin: 0; }
  .feat-blocks { display: flex; flex-direction: column; gap: 30px; }
  .block { display: grid; grid-template-columns: 1fr 1fr; gap: 46px; align-items: center; }
  .block-visual { aspect-ratio: 16 / 11; }
  .block-copy .block-num { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 12px; font-weight: 600; color: #1085ef; margin-bottom: 14px; }
  .block-copy h3 { font-family: 'Amulya', sans-serif; font-size: clamp(24px, 2.6vw, 32px); font-weight: 700; color: #0a0a0a; margin: 0 0 13px; letter-spacing: -0.02em; }
  .block-copy p { font-size: 16px; line-height: 1.65; color: #555; margin: 0; max-width: 420px; }

  /* block 02 — app collapse */
  .collapse-visual { position: relative; aspect-ratio: 16 / 11; border-radius: 24px; overflow: hidden; background: linear-gradient(160deg, #eef2fb, #e4eaf6); border: 1px solid rgba(255, 255, 255, 0.8); box-shadow: inset 0 2px 10px rgba(255, 255, 255, 0.7), 0 18px 44px -24px rgba(20, 30, 80, 0.28); display: flex; align-items: center; justify-content: center; }
  .appwin { position: absolute; border-radius: 9px; background: #fff; border: 1px solid rgba(15, 23, 42, 0.1); box-shadow: 0 6px 16px rgba(20, 30, 80, 0.1); display: flex; align-items: center; justify-content: center; font-size: 9.5px; font-weight: 600; color: #9aa0ac; animation: ftCollapse 3.2s ease-in-out infinite; }
  .appmain { position: relative; z-index: 2; width: 118px; height: 82px; border-radius: 13px; background: linear-gradient(160deg, #fff, #eaf1fd); border: 1px solid rgba(255, 255, 255, 0.9); box-shadow: 0 14px 34px -10px rgba(16, 133, 239, 0.42); display: flex; align-items: center; justify-content: center; animation: ftPopMain 3.2s ease-in-out infinite; }

  /* block 03 — comparison */
  .compare-visual { position: relative; aspect-ratio: 16 / 11; border-radius: 24px; overflow: hidden; background: linear-gradient(160deg, #ffffff, #f6f9fe); border: 1px solid rgba(15, 23, 42, 0.07); box-shadow: inset 0 2px 10px rgba(255, 255, 255, 0.7), 0 18px 44px -24px rgba(20, 30, 80, 0.2); display: flex; align-items: center; justify-content: center; }
  .compare-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 14px; }
  .compare-label { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; }
  .compare-label.gray { color: #9aa0ac; }
  .compare-label.blue { color: #1085ef; }
  .compare-divider { width: 1px; align-self: stretch; margin: 26px 0; background: rgba(15, 23, 42, 0.1); position: relative; }
  .compare-divider span { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 9px; color: #9aa0ac; background: #f4f6fb; padding: 3px 0; }

  /* access */
  .access { padding: 70px 0 100px; }
  .access-card { position: relative; text-align: center; padding: 60px 40px; border-radius: 36px; overflow: hidden; background: linear-gradient(140deg, #0e1830, #142a55 55%, #1085ef); box-shadow: 0 30px 80px -30px rgba(16, 40, 120, 0.6); }
  .access-blob { position: absolute; border-radius: 50%; filter: blur(40px); }
  .access-blob.a1 { width: 380px; height: 380px; top: -120px; right: -80px; background: radial-gradient(circle, rgba(167, 138, 222, 0.5), transparent 60%); }
  .access-blob.a2 { width: 320px; height: 320px; bottom: -130px; left: -60px; background: radial-gradient(circle, rgba(255, 140, 105, 0.4), transparent 60%); }
  .access-inner { position: relative; z-index: 2; max-width: 560px; margin: 0 auto; }
  .eyebrow.light { color: rgba(255, 255, 255, 0.7); }
  .access-h2 { font-family: 'Amulya', sans-serif; font-size: clamp(30px, 4vw, 46px); font-weight: 700; color: #fff; margin: 0 0 14px; letter-spacing: -0.02em; }
  .access-p { font-size: 16px; line-height: 1.6; color: rgba(255, 255, 255, 0.82); margin: 0 0 30px; }
  .access-done { display: inline-flex; align-items: center; gap: 10px; padding: 16px 28px; border-radius: 100px; background: rgba(255, 255, 255, 0.16); border: 1px solid rgba(255, 255, 255, 0.3); color: #fff; font-size: 15px; font-weight: 500; }
  .access-form { display: flex; gap: 10px; max-width: 480px; margin: 0 auto; flex-wrap: wrap; justify-content: center; }
  .access-form input { flex: 1; min-width: 240px; padding: 15px 22px; border-radius: 100px; border: 1px solid rgba(255, 255, 255, 0.25); background: rgba(255, 255, 255, 0.12); color: #fff; font-family: 'Inter', sans-serif; font-size: 14.5px; outline: none; }
  .access-form input::placeholder { color: rgba(255, 255, 255, 0.55); }
  .access-form button { padding: 15px 28px; border-radius: 100px; border: none; background: #fff; color: #0e1830; font-family: 'Inter', sans-serif; font-size: 14.5px; font-weight: 600; cursor: pointer; white-space: nowrap; }
  .access-form button:disabled { opacity: 0.7; cursor: default; }
  .access-fine { font-size: 12px; color: rgba(255, 255, 255, 0.55); margin: 16px 0 0; }

  /* footer */
  .footer { padding: 30px 0 50px; }
  .footer-bar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 18px; padding: 24px 36px; border-radius: 100px; background: rgba(255, 255, 255, 0.6); backdrop-filter: blur(14px); border: 1px solid rgba(255, 255, 255, 0.75); }
  .footer-brand { display: flex; align-items: center; gap: 9px; }
  .footer-brand .wordmark { font-size: 17px; }
  .footer-links { display: flex; gap: 22px; }
  .footer-links a { color: #767676; text-decoration: none; font-size: 13.5px; font-weight: 500; }
  .footer-links a:hover { color: #1085ef; }
  .footer-copy { font-size: 13px; color: #9a9aa2; }
  .footer-legal { display: flex; align-items: center; justify-content: flex-start; gap: 16px; flex-wrap: wrap; margin-top: 20px; padding: 0 36px; }
  .legal-label { font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #a4a7b0; }
  .legal-links { display: flex; gap: 18px; flex-wrap: wrap; }
  .legal-links a { color: #8a8a93; text-decoration: none; font-size: 13px; }
  .legal-links a:hover { color: #1085ef; }

  @keyframes nlGlow { 0%, 100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 0.8; transform: scale(1.06); } }
  @keyframes ftCollapse { 0%, 12% { transform: translate(0, 0) scale(1); opacity: 1; } 75% { transform: translate(calc(var(--fx, 0) * 0.9), calc(var(--fy, 0) * 0.9)) scale(0.34); opacity: 0.95; } 100% { transform: translate(var(--fx, 0), var(--fy, 0)) scale(0.06); opacity: 0; } }
  @keyframes ftPopMain { 0%, 18% { transform: scale(0.82); opacity: 0.35; } 50%, 100% { transform: scale(1); opacity: 1; } }
  @keyframes ftDrawClean { 0% { stroke-dashoffset: 620; opacity: 0.3; } 42% { stroke-dashoffset: 0; opacity: 1; } 84% { stroke-dashoffset: 0; opacity: 1; } 100% { stroke-dashoffset: 620; opacity: 0.3; } }
  @keyframes ftDrawMessy { 0% { stroke-dashoffset: 620; opacity: 0.25; } 10% { stroke-dashoffset: 520; opacity: 0.5; } 18% { stroke-dashoffset: 540; opacity: 0.4; } 28% { stroke-dashoffset: 300; opacity: 0.7; } 36% { stroke-dashoffset: 340; opacity: 0.6; } 46% { stroke-dashoffset: 0; opacity: 0.9; } 84% { stroke-dashoffset: 0; opacity: 0.9; } 100% { stroke-dashoffset: 620; opacity: 0.25; } }

  @media (max-width: 860px) {
    .nav-center { display: none; }
    .block { grid-template-columns: 1fr; gap: 24px; }
  }
</style>
