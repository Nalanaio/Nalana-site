<script>
  import { onMount } from 'svelte';
  import Nav from '$lib/components/Nav.svelte';
  import { openAuthModal, openEmailModal, emailModal, closeEmailModal } from '$lib/stores/modal.js';

  // ── UTM variant definitions ──
  const variants = {
    arch: {
      heroSub: 'Nalana is your 3D studio. Describe the space. It builds. No menus, no shortcuts, no friction.',
      cmds: [
        '"add a glass curtain wall"',
        '"make the facade concrete"',
        '"add recessed lighting to the ceiling"',
        '"render a wide-angle exterior shot"',
        '"apply a wood floor material"',
        '"add a cantilevered overhang"',
        '"make the columns thinner"',
        '"duplicate the window grid"',
      ],
    },
    game: {
      heroSub: 'Nalana is your 3D studio. Describe your world. It builds. No menus, no shortcuts, no friction.',
      cmds: [
        '"add a low-poly terrain"',
        '"create a dungeon wall tile"',
        '"make it feel dystopian"',
        '"add atmospheric fog"',
        '"apply a worn metal texture"',
        '"build a modular corridor"',
        '"add directional god rays"',
        '"make the environment darker"',
      ],
    },
    design: {
      heroSub: 'Nalana is your 3D studio. Describe the object. It builds. No menus, no shortcuts, no friction.',
      cmds: [
        '"model a minimal desk lamp"',
        '"add an HDRI studio background"',
        '"make it brushed aluminum"',
        '"smooth the product curves"',
        '"add a soft shadow plane"',
        '"render a clean white backdrop"',
        '"make the surface matte black"',
        '"add a subtle reflection"',
      ],
    },
    default: {
      heroSub: 'Nalana is your 3D studio. Describe what you want to build. It builds. No menus, no shortcuts, no friction.',
      cmds: [
        '"add a metallic sphere"',
        '"make the lighting warmer"',
        '"duplicate this object"',
        '"add a chrome torus"',
        '"smooth out the edges"',
        '"apply a glass material"',
        '"rotate 45 degrees"',
        '"make it bigger"',
      ],
    },
  };

  let heroSub = variants.default.heroSub;
  let voiceCmds = variants.default.cmds;

  // ── Voice command rotation ──
  let cmdIndex = 0;
  let voiceCmdEl;
  let voiceCmdText = voiceCmds[0];
  let cmdFading = false;

  // ── OS detection ──
  let detectedOS = 'unknown';

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

  // ── Interactive demo ──
  let demoMessages = [
    { role: 'assistant', text: 'Hey — what do you want to build?', steps: [] },
    { role: 'user', text: 'add a metallic sphere to the scene', steps: [] },
    { role: 'assistant', text: 'Done. Metallic sphere placed at origin — reflectivity 0.92, roughness 0.04.', steps: ['Parsing intent', 'Creating IcosphereGeometry', 'Applying PBR material'] },
  ];
  let demoInput = '';
  let demoTyping = false;
  let demoScrollEl;

  const _demoR = {
    sphere: { steps: ['Parsing intent', 'Creating geometry', 'Applying PBR material'], text: 'Done. Metallic sphere placed at origin — reflectivity 0.92, roughness 0.04.' },
    light:  { steps: ['Parsing intent', 'Creating PointLight', 'Setting intensity'], text: 'Done. Point light placed at (2, 3, 2) — 500W, warm 3200K.' },
    glass:  { steps: ['Parsing intent', 'Loading shader preset', 'Assigning to mesh'], text: 'Done. Glass material applied — IOR 1.45, transmission 1.0.' },
    floor:  { steps: ['Parsing intent', 'Creating PlaneGeometry', 'Applying material'], text: 'Done. Ground plane added — 10×10 units, centered at origin.' },
    rotate: { steps: ['Parsing intent', 'Selecting active object', 'Applying rotation'], text: 'Done. Rotated 45° on the Z axis.' },
    default:{ steps: ['Parsing intent', 'Building scene graph', 'Executing'], text: 'Done. Scene updated.' },
  };

  function _getDemoResp(msg) {
    const m = msg.toLowerCase();
    if (/sphere|ball|orb/.test(m)) return _demoR.sphere;
    if (/light|lamp|sun|glow|emit/.test(m)) return _demoR.light;
    if (/glass|transparent|crystal|refract/.test(m)) return _demoR.glass;
    if (/floor|plane|ground/.test(m)) return _demoR.floor;
    if (/rotat|spin|turn|scale|resize|move|translat/.test(m)) return _demoR.rotate;
    return _demoR.default;
  }

  async function sendDemoMessage() {
    if (!demoInput.trim() || demoTyping) return;
    const text = demoInput.trim();
    demoInput = '';
    demoMessages = [...demoMessages, { role: 'user', text, steps: [] }];
    demoTyping = true;
    setTimeout(() => { if (demoScrollEl) demoScrollEl.scrollTop = demoScrollEl.scrollHeight; }, 30);
    await new Promise(r => setTimeout(r, 1100 + Math.random() * 700));
    const resp = _getDemoResp(text);
    demoMessages = [...demoMessages, { role: 'assistant', text: resp.text, steps: resp.steps }];
    demoTyping = false;
    setTimeout(() => { if (demoScrollEl) demoScrollEl.scrollTop = demoScrollEl.scrollHeight; }, 30);
  }

  onMount(() => {
    // ── OS detection ──
    const ua = navigator.userAgent;
    if (/Mac|iPhone|iPad|iPod/.test(ua) && !/Windows/.test(ua)) {
      detectedOS = 'mac';
    } else if (/Windows/.test(ua)) {
      detectedOS = 'windows';
    }

    // ── UTM → variant swap ──
    const params = new URLSearchParams(window.location.search);
    const src = (params.get('utm_source') || '').toLowerCase();
    const campaign = (params.get('utm_campaign') || '').toLowerCase();
    const combined = src + ' ' + campaign;
    let variant = variants.default;
    if (/arch|archviz|archdaily|dezeen|houzz|build|construct/.test(combined)) {
      variant = variants.arch;
    } else if (/game|unity|unreal|indie|itch|steam/.test(combined)) {
      variant = variants.game;
    } else if (/design|product|industrial|behance|dribbble/.test(combined)) {
      variant = variants.design;
    }
    heroSub = variant.heroSub;
    voiceCmds = variant.cmds;
    voiceCmdText = voiceCmds[0];

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

    <p class="hero-sub fade-up">{heroSub}</p>

    <div class="not-blender glass fade-up" style="border-radius:100px;">
      <span class="nb-badge">Not a plugin</span>
      Nalana is its own separate software, built on top of Blender.
    </div>

    <div class="hero-ctas fade-up">
      {#if detectedOS !== 'windows'}
      <a
        href="/api/download?platform=mac"
        class="hero-dl-mac"
        on:click={() => handleDownloadClick('mac', 'hero')}
      >
        <svg class="dl-icon-lg" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
        Download for Mac
      </a>
      {/if}
      {#if detectedOS !== 'mac'}
      <a
        href="/api/download?platform=windows"
        class="hero-dl-win"
        on:click={() => handleDownloadClick('windows', 'hero')}
      >
        <svg class="dl-icon-lg" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5.557L10.173 4.5v7.145H3V5.557zM11 4.35L20.994 3v8.645H11V4.35zM3 12.345h7.173V19.5L3 18.442v-6.097zM11 12.345h9.994v8.61L11 19.63v-7.285z"/></svg>
        Download for Windows
      </a>
      {/if}
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


  <!-- ══ INTERACTIVE DEMO ══ -->
  <section class="demo-section">
    <div class="container">
      <div style="text-align:center;margin-bottom:40px;" class="fade-up">
        <div class="section-label">Interface Preview</div>
        <h2 class="section-title">The interface. Try it.</h2>
        <p class="section-sub" style="margin:0 auto;">Type a command below. This is exactly what using Nalana feels like.</p>
      </div>

      <div class="demo-window fade-up" style="transition-delay:.1s;">
        <!-- macOS window chrome -->
        <div class="demo-window-bar">
          <div class="demo-traffic-lights">
            <div class="demo-tl demo-tl-red"></div>
            <div class="demo-tl demo-tl-yellow"></div>
            <div class="demo-tl demo-tl-green"></div>
          </div>
          <span class="demo-window-title">Nalana</span>
          <div style="width:52px;"></div>
        </div>

        <div class="demo-split">
          <!-- Left: Blender viewport mockup -->
          <div class="demo-viewport">
            <svg class="demo-vp-svg" viewBox="0 0 600 420" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <radialGradient id="dSphereGrad" cx="35%" cy="30%" r="65%">
                  <stop offset="0%" stop-color="#d8d8d8"/>
                  <stop offset="45%" stop-color="#9a9a9a"/>
                  <stop offset="100%" stop-color="#2a2a2a"/>
                </radialGradient>
                <radialGradient id="dGroundGrad" cx="50%" cy="0%" r="100%">
                  <stop offset="0%" stop-color="#272727"/>
                  <stop offset="100%" stop-color="#1c1c1c"/>
                </radialGradient>
              </defs>
              <!-- Background -->
              <rect width="600" height="420" fill="#1d1d1d"/>
              <!-- Ground plane -->
              <polygon points="0,230 600,230 600,420 0,420" fill="url(#dGroundGrad)"/>
              <!-- Grid radial lines -->
              <g stroke="#2d2d2d" stroke-width="0.9">
                <line x1="300" y1="230" x2="0" y2="420"/>
                <line x1="300" y1="230" x2="60" y2="420"/>
                <line x1="300" y1="230" x2="120" y2="420"/>
                <line x1="300" y1="230" x2="180" y2="420"/>
                <line x1="300" y1="230" x2="240" y2="420"/>
                <line x1="300" y1="230" x2="300" y2="420"/>
                <line x1="300" y1="230" x2="360" y2="420"/>
                <line x1="300" y1="230" x2="420" y2="420"/>
                <line x1="300" y1="230" x2="480" y2="420"/>
                <line x1="300" y1="230" x2="540" y2="420"/>
                <line x1="300" y1="230" x2="600" y2="420"/>
              </g>
              <!-- Grid horizontal lines -->
              <g stroke="#2d2d2d" stroke-width="0.9">
                <line x1="247" y1="262" x2="353" y2="262"/>
                <line x1="210" y1="284" x2="390" y2="284"/>
                <line x1="148" y1="316" x2="452" y2="316"/>
                <line x1="96" y1="346" x2="504" y2="346"/>
                <line x1="40" y1="378" x2="560" y2="378"/>
              </g>
              <!-- Horizon line -->
              <line x1="0" y1="230" x2="600" y2="230" stroke="#353535" stroke-width="1"/>
              <!-- Sphere shadow -->
              <ellipse cx="300" cy="356" rx="64" ry="11" fill="rgba(0,0,0,0.5)"/>
              <!-- Sphere -->
              <circle cx="300" cy="292" r="72" fill="url(#dSphereGrad)"/>
              <!-- Specular highlight -->
              <ellipse cx="273" cy="264" rx="22" ry="14" fill="rgba(255,255,255,0.13)" transform="rotate(-20,273,264)"/>
              <!-- Orange selection ring (Blender style) -->
              <circle cx="300" cy="292" r="73.5" fill="none" stroke="#e88000" stroke-width="1.6"/>
              <!-- Selection handles -->
              <circle cx="300" cy="218" r="3.5" fill="#e88000"/>
              <circle cx="374" cy="292" r="3.5" fill="#e88000"/>
              <circle cx="300" cy="366" r="3.5" fill="#e88000"/>
              <circle cx="226" cy="292" r="3.5" fill="#e88000"/>
              <!-- Object name label -->
              <rect x="262" y="202" width="76" height="14" rx="2" fill="rgba(0,0,0,0.65)"/>
              <text x="300" y="212" text-anchor="middle" fill="#e88000" font-size="9" font-family="monospace">Sphere.001</text>

              <!-- TOP TOOLBAR -->
              <rect x="0" y="0" width="600" height="28" fill="#252525"/>
              <line x1="0" y1="28" x2="600" y2="28" stroke="#181818" stroke-width="1"/>
              <rect x="8" y="5" width="92" height="18" rx="3" fill="#3a3a3a"/>
              <text x="54" y="17" text-anchor="middle" fill="#ccc" font-size="10" font-family="ui-sans-serif,system-ui,sans-serif">Object Mode ▾</text>
              <text x="110" y="17" fill="#999" font-size="10" font-family="ui-sans-serif,system-ui,sans-serif">View</text>
              <text x="140" y="17" fill="#999" font-size="10" font-family="ui-sans-serif,system-ui,sans-serif">Select</text>
              <text x="178" y="17" fill="#999" font-size="10" font-family="ui-sans-serif,system-ui,sans-serif">Add</text>
              <text x="206" y="17" fill="#999" font-size="10" font-family="ui-sans-serif,system-ui,sans-serif">Object</text>
              <!-- Shading icons -->
              <g transform="translate(500,5)">
                <rect x="0" y="0" width="18" height="18" rx="3" fill="#3a3a3a"/>
                <circle cx="9" cy="9" r="5.5" fill="none" stroke="#777" stroke-width="1"/>
                <line x1="9" y1="3.5" x2="9" y2="14.5" stroke="#777" stroke-width="0.8"/>
                <line x1="3.5" y1="9" x2="14.5" y2="9" stroke="#777" stroke-width="0.8"/>
                <rect x="22" y="0" width="18" height="18" rx="3" fill="#5a5a5a"/>
                <circle cx="31" cy="9" r="5.5" fill="#a0a0a0"/>
                <rect x="44" y="0" width="18" height="18" rx="3" fill="#3a3a3a"/>
                <circle cx="53" cy="9" r="5.5" fill="#9090cc"/>
                <rect x="66" y="0" width="18" height="18" rx="3" fill="#3a3a3a"/>
                <circle cx="75" cy="9" r="5.5" fill="url(#dSphereGrad)"/>
              </g>
              <!-- Nav gizmo -->
              <g transform="translate(530,48)">
                <circle cx="25" cy="25" r="23" fill="rgba(35,35,35,0.85)"/>
                <line x1="25" y1="25" x2="25" y2="5" stroke="#5580ff" stroke-width="2.2"/>
                <circle cx="25" cy="5" r="4" fill="#5580ff"/>
                <text x="25" y="3" text-anchor="middle" fill="#7090ff" font-size="7" font-family="monospace">Z</text>
                <line x1="25" y1="25" x2="45" y2="36" stroke="#e05555" stroke-width="2.2"/>
                <circle cx="45" cy="36" r="4" fill="#e05555"/>
                <text x="51" y="39" fill="#e07070" font-size="7" font-family="monospace">X</text>
                <line x1="25" y1="25" x2="5" y2="36" stroke="#50c055" stroke-width="2.2"/>
                <circle cx="5" cy="36" r="4" fill="#50c055"/>
                <text x="-1" y="39" fill="#70d075" font-size="7" font-family="monospace">Y</text>
              </g>
              <!-- BOTTOM STATUS BAR -->
              <rect x="0" y="400" width="600" height="20" fill="#1a1a1a"/>
              <line x1="0" y1="400" x2="600" y2="400" stroke="#111" stroke-width="1"/>
              <text x="8" y="413" fill="#555" font-size="9" font-family="monospace">Verts:532  Faces:272  Tris:1040</text>
              <text x="300" y="413" text-anchor="middle" fill="#555" font-size="9" font-family="monospace">Sphere.001</text>
              <text x="592" y="413" text-anchor="end" fill="#444" font-size="9" font-family="monospace">Blender 4.x</text>
            </svg>
          </div>

          <!-- Right: Nalana chat panel -->
          <div class="demo-chat">
            <div class="demo-aurora" aria-hidden="true">
              <div class="demo-blob demo-blob-1"></div>
              <div class="demo-blob demo-blob-2"></div>
              <div class="demo-blob demo-blob-3"></div>
            </div>

            <!-- Header -->
            <div class="demo-chat-header">
              <div class="demo-chat-logo">
                <svg width="14" height="17" viewBox="0 0 69 82" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M68.5 69.3278C68.5 71.5139 66.7278 73.2861 64.5416 73.2861C62.6686 73.2861 61.07 71.9671 60.5184 70.177C59.0003 65.2496 56.2489 59.8111 52.3994 54.5664C42.7884 41.472 29.9768 34.5417 23.7842 39.0869C17.5915 43.6321 20.3627 57.9319 29.9736 71.0264C30.6518 71.9503 30.0071 73.2861 28.8611 73.2861H11.75C9.54086 73.2861 7.75 71.4953 7.75 69.2861V4C7.75 1.79086 9.54086 0 11.75 0H15.1428C17.0007 0 18.5961 1.28563 19.1747 3.05109C20.7305 7.79868 23.4053 12.9832 27.0811 17.9912C36.692 31.0856 49.5037 38.0159 55.6963 33.4707C61.8888 28.9254 59.1177 14.6256 49.5068 1.53125C49.0448 0.901696 49.4862 0 50.2671 0H64.5C66.7091 0 68.5 1.79086 68.5 4V69.3278Z" fill="rgba(255,255,255,0.7)"/>
                  <path d="M61.75 69.3283C61.75 71.5142 59.978 73.2861 57.7922 73.2861C55.9194 73.2861 54.321 71.9672 53.7695 70.1774C52.2511 65.25 49.499 59.8113 45.6494 54.5664C36.0384 41.4721 23.2268 34.5417 17.0342 39.0869C10.8418 43.6323 13.6129 57.932 23.2236 71.0264C23.9019 71.9505 23.2577 73.2861 22.1114 73.2861H5C2.79086 73.2861 1 71.4953 1 69.2861V4C1 1.79086 2.79086 0 5 0H8.39283C10.2507 0 11.8461 1.28563 12.4247 3.05109C13.9805 7.79868 16.6553 12.9832 20.3311 17.9912C29.942 31.0856 42.7537 38.0159 48.9463 33.4707C55.1388 28.9254 52.3677 14.6256 42.7568 1.53125C42.2948 0.901696 42.7362 0 43.5171 0H57.75C59.9591 0 61.75 1.79086 61.75 4V69.3283Z" fill="rgba(255,255,255,0.95)"/>
                </svg>
              </div>
              <span class="demo-chat-title">Nalana</span>
              <span class="demo-model-badge">Nalana 2</span>
              <div class="demo-status-dot"></div>
            </div>

            <!-- Thread -->
            <div class="demo-thread" bind:this={demoScrollEl}>
              {#each demoMessages as msg}
                {#if msg.role === 'user'}
                  <div class="demo-msg demo-msg-user">
                    <div class="demo-bubble demo-bubble-user">{msg.text}</div>
                  </div>
                {:else}
                  <div class="demo-msg demo-msg-assistant">
                    {#if msg.steps.length > 0}
                      <div class="demo-steps">
                        {#each msg.steps as step}
                          <div class="demo-step">
                            <span class="demo-step-dot"></span>{step}
                          </div>
                        {/each}
                      </div>
                    {/if}
                    <div class="demo-bubble demo-bubble-assistant">{msg.text}</div>
                  </div>
                {/if}
              {/each}
              {#if demoTyping}
                <div class="demo-msg demo-msg-assistant">
                  <div class="demo-bubble demo-bubble-assistant demo-typing">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              {/if}
            </div>

            <!-- Composer -->
            <div class="demo-composer">
              <div class="demo-composer-shell">
                <!-- svelte-ignore a11y-autofocus -->
                <input
                  class="demo-composer-input"
                  type="text"
                  placeholder="Type a command…"
                  bind:value={demoInput}
                  on:keydown={e => e.key === 'Enter' && sendDemoMessage()}
                  disabled={demoTyping}
                />
                <button class="demo-composer-send" on:click={sendDemoMessage} disabled={demoTyping || !demoInput.trim()}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>
                </button>
              </div>
              <p class="demo-hint">Live demo — no API call. Try: "add a glass sphere", "rotate 45 degrees", "add a floor"</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>


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
  /* ── Interactive Demo ── */
  .demo-section { padding: 80px 0 40px; }

  .demo-window {
    border-radius: 14px; overflow: hidden;
    box-shadow: 0 32px 80px rgba(0,0,0,0.28), 0 0 0 1px rgba(255,255,255,0.07);
  }
  .demo-window-bar {
    height: 40px; background: #2a2a2a;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 16px; border-bottom: 1px solid #181818;
  }
  .demo-traffic-lights { display: flex; gap: 7px; align-items: center; }
  .demo-tl { width: 12px; height: 12px; border-radius: 50%; }
  .demo-tl-red    { background: #ff5f57; }
  .demo-tl-yellow { background: #febc2e; }
  .demo-tl-green  { background: #28c840; }
  .demo-window-title { font-size: 13px; font-weight: 500; color: #999; font-family: -apple-system, 'Inter', sans-serif; }

  .demo-split { display: flex; height: 500px; }

  .demo-viewport { flex: 1.15; overflow: hidden; border-right: 1px solid #111; }
  .demo-vp-svg { width: 100%; height: 100%; display: block; }

  .demo-chat {
    flex: 1; min-width: 0;
    display: flex; flex-direction: column;
    position: relative; overflow: hidden;
    background: #f2f2f5;
  }

  /* Aurora */
  .demo-aurora { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
  .demo-blob {
    position: absolute; border-radius: 50%;
    filter: blur(45px); opacity: 0.3;
    animation: dBlobFloat 9s ease-in-out infinite;
  }
  .demo-blob-1 { width: 200px; height: 200px; background: #1085ef; top: -50px; right: -30px; }
  .demo-blob-2 { width: 160px; height: 160px; background: #ff8c69; bottom: 50px; left: -30px; animation-delay: -3.5s; }
  .demo-blob-3 { width: 120px; height: 120px; background: #a78ade; top: 45%; right: 22%; animation-delay: -7s; }
  @keyframes dBlobFloat {
    0%,100% { transform: translateY(0) scale(1); }
    50% { transform: translateY(-18px) scale(1.05); }
  }

  /* Chat header */
  .demo-chat-header {
    display: flex; align-items: center; gap: 8px;
    padding: 11px 14px;
    border-bottom: 1px solid rgba(0,0,0,0.06);
    background: rgba(255,255,255,0.75);
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    position: relative; z-index: 1; flex-shrink: 0;
  }
  .demo-chat-logo {
    width: 26px; height: 26px; border-radius: 8px;
    background: linear-gradient(135deg, #1085ef 0%, #6355ff 100%);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .demo-chat-title { font-size: 13px; font-weight: 700; color: #111; font-family: 'KonkhmerSleokchher', sans-serif; }
  .demo-model-badge { font-size: 10px; font-weight: 500; color: #999; background: rgba(0,0,0,0.06); border-radius: 6px; padding: 2px 8px; }
  .demo-status-dot { width: 7px; height: 7px; border-radius: 50%; background: #2dd07a; margin-left: auto; flex-shrink: 0; box-shadow: 0 0 6px rgba(45,208,122,0.6); }

  /* Thread */
  .demo-thread {
    flex: 1; overflow-y: auto; padding: 14px;
    display: flex; flex-direction: column; gap: 10px;
    position: relative; z-index: 1; scroll-behavior: smooth;
  }
  .demo-thread::-webkit-scrollbar { width: 4px; }
  .demo-thread::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 4px; }

  .demo-msg { display: flex; flex-direction: column; }
  .demo-msg-user { align-items: flex-end; }
  .demo-msg-assistant { align-items: flex-start; }

  .demo-bubble {
    max-width: 88%; padding: 9px 13px;
    font-size: 13px; line-height: 1.55;
    font-family: 'Inter', system-ui, sans-serif;
  }
  .demo-bubble-user {
    background: #fff; color: #111;
    border-radius: 16px 16px 4px 16px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04);
  }
  .demo-bubble-assistant {
    background: rgba(255,255,255,0.55);
    backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
    border: 1px solid rgba(255,255,255,0.75);
    border-radius: 4px 16px 16px 16px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    color: rgba(18,22,42,0.85);
  }

  /* Steps */
  .demo-steps { display: flex; flex-direction: column; gap: 3px; margin-bottom: 5px; }
  .demo-step { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #888; font-family: monospace; }
  .demo-step-dot { width: 5px; height: 5px; border-radius: 50%; background: #2dd07a; flex-shrink: 0; }

  /* Typing indicator */
  .demo-typing { display: flex; align-items: center; gap: 5px; padding: 12px 14px !important; }
  .demo-typing span {
    width: 7px; height: 7px; border-radius: 50%; background: rgba(0,0,0,0.22);
    animation: dTyping 1.2s ease-in-out infinite;
  }
  .demo-typing span:nth-child(2) { animation-delay: .2s; }
  .demo-typing span:nth-child(3) { animation-delay: .4s; }
  @keyframes dTyping {
    0%,60%,100% { transform: translateY(0); opacity: 0.4; }
    30% { transform: translateY(-6px); opacity: 1; }
  }

  /* Composer */
  .demo-composer {
    padding: 10px 12px 8px;
    border-top: 1px solid rgba(0,0,0,0.06);
    background: rgba(255,255,255,0.82);
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    position: relative; z-index: 1; flex-shrink: 0;
  }
  .demo-composer-shell {
    display: flex; align-items: center; gap: 8px;
    background: #fff; border-radius: 11px;
    padding: 5px 6px 5px 14px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.09), inset 0 1px 2px rgba(0,0,0,0.04);
    border: 1px solid rgba(0,0,0,0.07);
  }
  .demo-composer-input {
    flex: 1; border: none; outline: none; background: transparent;
    font-size: 13px; color: #1a1a1a; font-family: 'Inter', system-ui, sans-serif; min-width: 0;
  }
  .demo-composer-input::placeholder { color: #b8b8b8; }
  .demo-composer-input:disabled { opacity: 0.6; }
  .demo-composer-send {
    width: 28px; height: 28px; border-radius: 8px; border: none;
    background: linear-gradient(180deg, #1a95ff 0%, #1085ef 100%);
    color: #fff; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: opacity .14s; flex-shrink: 0;
  }
  .demo-composer-send:hover:not(:disabled) { opacity: .85; }
  .demo-composer-send:disabled { opacity: .35; cursor: not-allowed; }
  .demo-hint { font-size: 10px; color: #bbb; text-align: center; margin: 6px 0 0; line-height: 1.4; }

  @media (max-width: 700px) {
    .demo-viewport { display: none; }
    .demo-split { height: 480px; }
  }

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
