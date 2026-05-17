<script>
  import { onMount } from 'svelte';
  import Nav from '$lib/components/Nav.svelte';
  import { openAuthModal, openEmailModal, emailModal, closeEmailModal } from '$lib/stores/modal.js';

  // ── Voice command rotation ──
  const voiceCmds = [
    '"add a metallic sphere"',
    '"make the lighting warmer"',
    '"duplicate this object"',
    '"add a chrome torus"',
    '"smooth out the edges"',
    '"apply a glass material"',
    '"rotate 45 degrees"',
    '"make it bigger"',
  ];
  let cmdIndex = 0;
  let voiceCmdEl;
  let voiceCmdText = voiceCmds[0];
  let cmdFading = false;

  // ── Waitlist state ──
  let waitlistEmail = '';
  let waitlistDone = false;
  let waitlistLoading = false;

  // ── Email modal state ──
  let emailInput = '';
  let emailSending = false;
  let emailSent = false;
  let emailError = '';

  // ── Download handler ──
  function handleDownloadClick(platform, location) {
    if (typeof gtag !== 'undefined') {
      gtag('event', 'download', { platform, location });
    }
    // Show signup modal ~1.2s after click (download already started via href)
    setTimeout(() => openAuthModal(platform, 'signup'), 1200);
  }

  async function handleWaitlist() {
    if (!waitlistEmail || waitlistLoading) return;
    waitlistLoading = true;
    try {
      const res = await fetch('/api/send-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: waitlistEmail, platform: 'notify' }),
      });
      if (res.ok) waitlistDone = true;
    } catch {}
    waitlistLoading = false;
  }

  async function handleEmailSend() {
    if (!emailInput || emailSending) return;
    emailSending = true;
    emailError = '';
    try {
      const res = await fetch('/api/send-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput, platform: $emailModal.platform }),
      });
      const data = await res.json();
      if (res.ok) {
        emailSent = true;
        if (typeof gtag !== 'undefined') {
          gtag('event', 'email_capture', { platform: $emailModal.platform });
        }
      } else {
        emailError = data.error || 'Something went wrong.';
      }
    } catch {
      emailError = 'Network error. Try again.';
    }
    emailSending = false;
  }

  function closeEmail() {
    closeEmailModal();
    emailInput = '';
    emailSent = false;
    emailError = '';
  }

  onMount(() => {
    // ── Custom cursor ──
    const cursor = document.getElementById('cursor');
    const ring   = document.getElementById('cursorRing');
    let rx = 0, ry = 0;

    document.addEventListener('mousemove', e => {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top  = e.clientY + 'px';
    });
    function animRing() {
      rx += (parseFloat(cursor.style.left || 0) - rx) * 0.12;
      ry += (parseFloat(cursor.style.top  || 0) - ry) * 0.12;
      ring.style.left = rx + 'px';
      ring.style.top  = ry + 'px';
      requestAnimationFrame(animRing);
    }
    animRing();
    document.querySelectorAll('a,button,[data-hover]').forEach(el => {
      el.addEventListener('mouseenter', () => { cursor.classList.add('grow'); ring.classList.add('grow'); });
      el.addEventListener('mouseleave', () => { cursor.classList.remove('grow'); ring.classList.remove('grow'); });
    });

    // ── Voice command rotation ──
    setInterval(() => {
      cmdFading = true;
      setTimeout(() => {
        cmdIndex = (cmdIndex + 1) % voiceCmds.length;
        voiceCmdText = voiceCmds[cmdIndex];
        cmdFading = false;
      }, 350);
    }, 3200);

    // ── Scroll reveal ──
    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.12 });
    document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));

    // ── Three.js blob ──
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    script.onload = initThree;
    document.head.appendChild(script);

    function initThree() {
      const canvas   = document.getElementById('hero-canvas');
      if (!canvas || typeof THREE === 'undefined') return;
      const scene    = new THREE.Scene();
      const camera   = new THREE.PerspectiveCamera(45, innerWidth/innerHeight, 0.1, 100);
      camera.position.z = 16;
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setSize(innerWidth, innerHeight);
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const l1 = new THREE.PointLight(0x1085EF, 6, 60); l1.position.set(6,6,6);   scene.add(l1);
      const l2 = new THREE.PointLight(0xFF8C69, 5, 60); l2.position.set(-6,4,6);  scene.add(l2);
      const l3 = new THREE.PointLight(0xA78ADE, 4, 60); l3.position.set(0,-6,6);  scene.add(l3);

      const mat  = new THREE.MeshPhysicalMaterial({ color:0xffffff, metalness:0.05, roughness:0.08, transmission:0.85, ior:1.5, thickness:2.2, clearcoat:1, clearcoatRoughness:0.08 });
      const geo  = new THREE.IcosahedronGeometry(4.2, 64);
      const orig = [];
      for (let i = 0; i < geo.attributes.position.count; i++)
        orig.push(new THREE.Vector3(geo.attributes.position.getX(i), geo.attributes.position.getY(i), geo.attributes.position.getZ(i)));
      const blob = new THREE.Mesh(geo, mat);
      blob.position.set(5, 1.5, -3); scene.add(blob);

      const sphere = new THREE.Mesh(new THREE.SphereGeometry(1.8,32,32), mat);
      sphere.position.set(-6,3,-5); scene.add(sphere);
      const torus = new THREE.Mesh(new THREE.TorusGeometry(2.2,.65,32,64), mat);
      torus.position.set(-5,-2,-4); scene.add(torus);

      window.addEventListener('resize', () => {
        camera.aspect = innerWidth / innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(innerWidth, innerHeight);
      });

      let t = 0;
      (function animate() {
        requestAnimationFrame(animate);
        t += 0.008 * (window._nalanaEnergyFactor || 1);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const o = orig[i];
          const n = Math.sin(o.x * 1.2 + t) * Math.cos(o.y * 0.9 + t * 0.7) * Math.sin(o.z * 1.1 + t * 0.5);
          pos.setXYZ(i, o.x + n * 0.35, o.y + n * 0.35, o.z + n * 0.35);
        }
        pos.needsUpdate = true;
        blob.rotation.y += 0.003; blob.rotation.x += 0.001;
        sphere.rotation.y -= 0.005;
        torus.rotation.x += 0.008; torus.rotation.z += 0.004;
        renderer.render(scene, camera);
      })();
    }

    return () => {
      // cleanup observer on unmount
      document.querySelectorAll('.fade-up').forEach(el => observer.unobserve(el));
    };
  });
</script>

<svelte:head>
  <title>Nalana – 3D creation. Just say it.</title>
  <meta name="description" content="Nalana is your AI 3D studio. Describe what you want to build — it builds. No menus, no shortcuts, no friction.">
</svelte:head>

<!-- CURSOR -->
<div class="cursor" id="cursor"></div>
<div class="cursor-ring" id="cursorRing"></div>

<!-- BACKGROUND -->
<div class="dot-grid-wrap"><div class="dot-grid"></div></div>
<canvas id="hero-canvas"></canvas>

<div class="page">

  <Nav />

  <!-- ══ HERO ══ -->
  <section class="hero" id="top">
    <div class="glow" style="width:60vw;height:60vh;top:5%;left:20%;z-index:-1;"></div>

    <div class="glass hero-eyebrow fade-up" style="border-radius:100px;">
      <span class="eyebrow-dot"></span>
      Now available — Mac &amp; Windows
    </div>

    <h1 class="hero-headline fade-up">
      3D creation.<br>
      <span class="line-blue">Just say it.</span>
    </h1>

    <p class="hero-sub fade-up">
      Nalana is your 3D studio. Describe what you want to build. It builds. No menus, no shortcuts, no friction.
    </p>

    <div class="not-blender glass fade-up" style="border-radius:100px;">
      <span class="nb-badge">Not a plugin</span>
      Nalana is its own separate software, built on top of Blender.
    </div>

    <div class="hero-ctas fade-up">
      <a
        href="/api/download?platform=mac"
        class="hero-dl-mac"
        on:click={() => handleDownloadClick('mac', 'hero')}
      >
        <svg class="dl-icon-lg" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
        Download for Mac
      </a>
      <a
        href="/api/download?platform=windows"
        class="hero-dl-win"
        on:click={() => handleDownloadClick('windows', 'hero')}
      >
        <svg class="dl-icon-lg" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5.557L10.173 4.5v7.145H3V5.557zM11 4.35L20.994 3v8.645H11V4.35zM3 12.345h7.173V19.5L3 18.442v-6.097zM11 12.345h9.994v8.61L11 19.63v-7.285z"/></svg>
        Download for Windows
      </a>
      <!-- Mobile: send to computer -->
      <div class="mobile-send-btns">
        <button class="mobile-send-mac" on:click={() => openEmailModal('mac')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
          Send to my Mac
        </button>
        <button class="mobile-send-win" on:click={() => openEmailModal('windows')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5.557L10.173 4.5v7.145H3V5.557zM11 4.35L20.994 3v8.645H11V4.35zM3 12.345h7.173V19.5L3 18.442v-6.097zM11 12.345h9.994v8.61L11 19.63v-7.285z"/></svg>
          Send to my Windows PC
        </button>
      </div>
    </div>

    <!-- Voice bubble -->
    <div class="bubble-wrap fade-up">
      <div class="bubble-glow"></div>
      <div class="bubble">
        <p class="try-label">try saying</p>
        <p class="voice-cmd" class:fade-out={cmdFading}>{voiceCmdText}</p>
      </div>
    </div>

    <p class="platform-note fade-up">
      Free to try. No account needed. <a href="#download">System requirements →</a>
    </p>
  </section>


  <!-- ══ SOCIAL PROOF STRIP ══ -->
  <section class="proof-strip fade-up">
    <div class="container">
      <div class="proof-strip-inner">
        <div class="proof-stat">
          <span class="proof-stat-number">200+</span>
          <span class="proof-stat-label">downloads</span>
        </div>
        <div class="proof-divider"></div>
        <span class="proof-used-by">Used by creators from</span>
        <div class="proof-logos">
          <span class="proof-logo proof-logo-usc">USC</span>
          <span class="proof-logo proof-logo-gdav">GDA·V</span>
        </div>
      </div>
    </div>
  </section>


  <!-- ══ VIDEO / DEMO ══ -->
  <section id="demo" class="video-section">
    <div class="container">
      <div style="text-align:center;margin-bottom:40px;" class="fade-up">
        <div class="section-label">Product Demo</div>
        <h2 class="section-title">See it in action.</h2>
        <p class="section-sub" style="margin:0 auto;">One command. One result. No clicking through menus.</p>
      </div>
      <div class="video-wrap fade-up" style="transition-delay:.1s;">
        <video autoplay muted loop playsinline style="width:100%;border-radius:16px;display:block;">
          <source src="/nalana-mvp-demo.web.mp4" type="video/mp4">
        </video>
        <div class="vid-label">↳ Live Demo</div>
      </div>
    </div>
  </section>


  <!-- ══ NOT BLENDER STRIP ══ -->
  <div class="container">
    <div class="nb-strip fade-up">
      <div class="nb-strip-icon">
        <svg width="36" height="36" viewBox="0 0 69 82" fill="none">
          <path d="M68.5 69.3278C68.5 71.5139 66.7278 73.2861 64.5416 73.2861C62.6686 73.2861 61.07 71.9671 60.5184 70.177C59.0003 65.2496 56.2489 59.8111 52.3994 54.5664C42.7884 41.472 29.9768 34.5417 23.7842 39.0869C17.5915 43.6321 20.3627 57.9319 29.9736 71.0264C30.6518 71.9503 30.0071 73.2861 28.8611 73.2861H11.75C9.54086 73.2861 7.75 71.4953 7.75 69.2861V4C7.75 1.79086 9.54086 0 11.75 0H15.1428C17.0007 0 18.5961 1.28563 19.1747 3.05109C20.7305 7.79868 23.4053 12.9832 27.0811 17.9912C36.692 31.0856 49.5037 38.0159 55.6963 33.4707C61.8888 28.9254 59.1177 14.6256 49.5068 1.53125C49.0448 0.901696 49.4862 0 50.2671 0H64.5C66.7091 0 68.5 1.79086 68.5 4V69.3278Z" fill="#FF8C69"/>
          <path d="M61.75 69.3283C61.75 71.5142 59.978 73.2861 57.7922 73.2861C55.9194 73.2861 54.321 71.9672 53.7695 70.1774C52.2511 65.25 49.499 59.8113 45.6494 54.5664C36.0384 41.4721 23.2268 34.5417 17.0342 39.0869C10.8418 43.6323 13.6129 57.932 23.2236 71.0264C23.9019 71.9505 23.2577 73.2861 22.1114 73.2861H5C2.79086 73.2861 1 71.4953 1 69.2861V4C1 1.79086 2.79086 0 5 0H8.39283C10.2507 0 11.8461 1.28563 12.4247 3.05109C13.9805 7.79868 16.6553 12.9832 20.3311 17.9912C29.942 31.0856 42.7537 38.0159 48.9463 33.4707C55.1388 28.9254 52.3677 14.6256 42.7568 1.53125C42.2948 0.901696 42.7362 0 43.5171 0H57.75C59.9591 0 61.75 1.79086 61.75 4V69.3283Z" fill="#1085EF"/>
        </svg>
      </div>
      <div class="nb-strip-text">
        <strong>Nalana is not Blender. It is not a plugin. It is not a Blender addon or mod.</strong>
        Nalana is <em>its own separate software</em> — built on top of Blender. You never open Blender. You open Nalana. The interface is different. The friction is gone.
      </div>
    </div>
  </div>


  <!-- ══ FEATURES ══ -->
  <section id="features">
    <div class="container">
      <div style="text-align:center;margin-bottom:56px;" class="fade-up">
        <div class="section-label">How It Works</div>
        <h2 class="section-title">The interface is your voice.</h2>
      </div>
      <div class="features-grid">

        <div class="glass feature-card fade-up">
          <div class="feature-icon-wrap" style="background:rgba(16,133,239,0.1);">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1085EF" stroke-width="2" stroke-linecap="round">
              <line x1="1" y1="12" x2="1" y2="12"/><path d="M4 9v6"/><path d="M7 6v12"/><path d="M10 4v16"/><path d="M13 7v10"/><path d="M16 10v4"/><path d="M19 8v8"/><path d="M22 11v2"/>
            </svg>
          </div>
          <h3 class="feature-title">Just say it.</h3>
          <p class="feature-desc">Voice or text. Either way, Nalana understands your intent — geometry, materials, lighting, transforms — and executes precisely.</p>
          <span class="feature-stat">Voice + text input</span>
        </div>

        <div class="glass feature-card fade-up" style="transition-delay:.1s;">
          <div class="feature-icon-wrap" style="background:rgba(255,140,105,0.1);">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF8C69" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 3L5 13h6l-1 8 8-11h-6l2-7z"/>
              <path d="M17 2l-1.5 4" opacity="0.5"/><path d="M20 5l-2 3" opacity="0.35"/>
            </svg>
          </div>
          <h3 class="feature-title">Instant execution.</h3>
          <p class="feature-desc">Local processing. Common commands run in ~5ms. Complex operations under 600ms. No lag between thought and result.</p>
          <span class="feature-stat" style="color:var(--salmon);background:rgba(255,140,105,0.08);border-color:rgba(255,140,105,0.2);">~5ms · sub-600ms</span>
        </div>

        <div class="glass feature-card fade-up" style="transition-delay:.2s;">
          <div class="feature-icon-wrap" style="background:rgba(167,138,222,0.12);">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#A78ADE" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18.37 2.63L14 7l-1.59-1.59a2 2 0 0 0-2.82 0L8 7l9 9 1.59-1.59a2 2 0 0 0 0-2.82L17 10l4.37-4.37a2.12 2.12 0 0 0-3-3z"/>
              <path d="M9 8c-2 3-4 3.5-7 4l8 8c1-.5 3.5-2 4-7"/><path d="M14.5 17.5L4.5 15"/>
            </svg>
          </div>
          <h3 class="feature-title">Learns your style.</h3>
          <p class="feature-desc">Nalana adapts to your vocabulary over time. The longer you use it, the more it feels like an extension of how you think.</p>
          <span class="feature-stat" style="color:var(--lavender);background:rgba(167,138,222,0.1);border-color:rgba(167,138,222,0.22);">Adaptive AI</span>
        </div>

      </div>
    </div>
  </section>


  <!-- ══ SOCIAL PROOF ══ -->
  <section>
    <div class="container">
      <div class="proof-grid">
        <div class="glass quote-card fade-up">
          <div class="qmark">"</div>
          <p class="quote-text">This is exactly what our 3D teams need. I'd pay $50 a month for this without hesitation.</p>
          <div class="quote-attr">
            <strong>Senior Director of 3D Excellence</strong>
            Nike / Jordan Brand — after one live demo
          </div>
        </div>
      </div>
    </div>
  </section>


  <!-- ══ ABOUT ══ -->
  <section id="about">
    <div class="container">
      <div class="glow" style="width:40vw;height:40vh;top:-10%;left:-5%;z-index:-1;"></div>
      <div class="glass about-card fade-up">
        <h2>Built by a creator, for creators.</h2>
        <p>Clarence Keith spent 7+ years in Blender, then taught 120+ students at the USC Iovine and Young Academy. The problem was always the same: people know what they want to make. They just can't find the button. Nalana removes the button entirely.</p>
        <div class="about-founder glass" style="border-radius:100px;">
          <div class="founder-avatar">C</div>
          <div>
            <div class="founder-name">Clarence Keith</div>
            <div class="founder-title">Founder — Nalana · USC Iovine and Young Academy</div>
          </div>
        </div>
      </div>
    </div>
  </section>


  <!-- ══ FINAL DOWNLOAD CTA ══ -->
  <section id="download" class="cta-section">
    <div class="container">
      <div class="glass cta-card fade-up">
        <div class="glow" style="width:80%;height:100%;top:-20%;left:10%;z-index:-1;opacity:0.5;"></div>
        <h2 class="cta-title">Build the world.</h2>
        <p class="cta-sub">Free to try. No account. No setup. Just open it and speak.</p>

        <!-- Desktop: download buttons -->
        <div class="cta-btns cta-desktop-only">
          <a
            href="/api/download?platform=mac"
            class="cta-big-mac"
            on:click={() => handleDownloadClick('mac', 'cta')}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
            Download for Mac
          </a>
          <a
            href="/api/download?platform=windows"
            class="cta-big-win"
            on:click={() => handleDownloadClick('windows', 'cta')}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5.557L10.173 4.5v7.145H3V5.557zM11 4.35L20.994 3v8.645H11V4.35zM3 12.345h7.173V19.5L3 18.442v-6.097zM11 12.345h9.994v8.61L11 19.63v-7.285z"/></svg>
            Download for Windows
          </a>
        </div>

        <div class="waitlist-label cta-desktop-only">Not ready? Get notified when we ship new versions.</div>
        {#if waitlistDone}
          <p class="cta-desktop-only" style="font-size:14px;font-weight:600;color:var(--primary);margin-top:8px;">✦ You're on the list.</p>
        {:else}
          <div class="waitlist-row cta-desktop-only">
            <input
              type="email"
              class="waitlist-input"
              placeholder="your@email.com"
              bind:value={waitlistEmail}
              on:keydown={e => e.key === 'Enter' && handleWaitlist()}
            />
            <button class="waitlist-btn" on:click={handleWaitlist} disabled={waitlistLoading}>
              {waitlistLoading ? '…' : 'Notify me →'}
            </button>
          </div>
        {/if}
        <p class="cta-desktop-only" style="margin-top:20px;font-size:12px;color:#bbb;">macOS 12+ · Windows 10/11 · Apple Silicon &amp; Intel</p>

        <!-- Mobile: send to computer -->
        <div class="cta-mobile-email">
          <div class="mobile-send-btns" style="margin-bottom:0;">
            <button class="mobile-send-mac" on:click={() => openEmailModal('mac')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
              Send to my Mac
            </button>
            <button class="mobile-send-win" on:click={() => openEmailModal('windows')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5.557L10.173 4.5v7.145H3V5.557zM11 4.35L20.994 3v8.645H11V4.35zM3 12.345h7.173V19.5L3 18.442v-6.097zM11 12.345h9.994v8.61L11 19.63v-7.285z"/></svg>
              Send to my Windows PC
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>


  <!-- ══ FOOTER ══ -->
  <footer>
    <div class="container">
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

</div><!-- /page -->


<!-- ══ MOBILE EMAIL MODAL ══ -->
{#if $emailModal.open}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="modal-overlay open" on:click={e => e.target === e.currentTarget && closeEmail()}>
    <div class="modal-card">
      <button class="modal-close" on:click={closeEmail}>✕</button>

      {#if emailSent}
        <div class="modal-platform-icon">✦</div>
        <div class="modal-title">Check your inbox!</div>
        <div class="modal-sub">We sent the download link to {emailInput}. Open it on your computer.</div>
      {:else}
        <div class="modal-platform-icon">{$emailModal.platform === 'mac' ? '🍎' : '🪟'}</div>
        <div class="modal-title">Send to your computer</div>
        <div class="modal-sub">Enter your email — we'll send you the download link to open on your {$emailModal.platform === 'mac' ? 'Mac' : 'Windows PC'}.</div>
        <input
          type="email"
          class="modal-input"
          placeholder="your@email.com"
          bind:value={emailInput}
          on:keydown={e => e.key === 'Enter' && handleEmailSend()}
        />
        {#if emailError}
          <p style="font-size:12px;color:#e53e3e;margin-bottom:8px;">{emailError}</p>
        {/if}
        <button
          class="modal-submit"
          on:click={handleEmailSend}
          disabled={emailSending || !emailInput}
        >
          {emailSending ? 'Sending…' : `Send ${$emailModal.platform === 'mac' ? 'Mac' : 'Windows'} link →`}
        </button>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* Email modal — local to this page */
  .modal-overlay {
    position: fixed; inset: 0; z-index: 2000;
    background: rgba(10,10,10,.5); backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex; align-items: center; justify-content: center; padding: 24px;
  }
  .modal-card {
    width: 100%; max-width: 360px; padding: 36px 28px 32px;
    border-radius: 24px; background: #fff;
    box-shadow: 0 24px 60px rgba(0,0,0,0.18); text-align: center; position: relative;
  }
  .modal-close { position: absolute; top: 16px; right: 18px; background: none; border: none; font-size: 22px; color: #bbb; cursor: pointer; line-height: 1; padding: 4px 8px; border-radius: 8px; transition: color .15s; }
  .modal-close:hover { color: #555; }
  .modal-platform-icon { font-size: 32px; margin-bottom: 12px; }
  .modal-title { font-family: 'Amulya', sans-serif; font-size: 22px; font-weight: 700; color: var(--ink-deep); letter-spacing: -.02em; margin-bottom: 8px; }
  .modal-sub { font-size: 14px; color: var(--muted); line-height: 1.55; margin-bottom: 24px; }
  .modal-input {
    width: 100%; padding: 13px 18px; border-radius: 100px;
    border: 1px solid var(--border); background: rgba(255,255,255,.8);
    font-family: 'Inter', sans-serif; font-size: 15px; outline: none; color: var(--ink);
    margin-bottom: 10px; text-align: center;
  }
  .modal-input::placeholder { color: #b0b0b0; }
  .modal-input:focus { border-color: rgba(16,133,239,.45); }
  .modal-submit {
    width: 100%; padding: 14px; border-radius: 100px; border: none;
    background: var(--primary); color: #fff;
    font-family: 'Inter', sans-serif; font-size: 15px; font-weight: 600;
    cursor: pointer; transition: opacity .15s;
  }
  .modal-submit:hover:not(:disabled) { opacity: .88; }
  .modal-submit:disabled { opacity: .5; cursor: not-allowed; }
</style>
