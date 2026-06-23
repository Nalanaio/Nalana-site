<script>
  import { onMount, onDestroy, tick } from 'svelte';

  // Accepted for API compatibility with the prototype (visual is fixed).
  export let theme = 'color';

  let rootEl, vpEl, messagesEl;

  let messages = [];
  let input = '';
  let objCount = 0;
  let typing = false;

  let dead = false;
  let userActed = false;
  let autoStarted = false;
  let timers = [];
  let io;

  // three.js refs
  let THREE, three = null, raf = null, onResize, extraLight;
  let vac = null;
  let active = null;

  const tabsList = ['Layout', 'Modeling', 'Sculpting', 'UV Editing', 'Texture Paint', 'Shading', 'Animation', 'Rendering', 'Compositing'];

  function seed() {
    return [{ who: 'nalana', text: 'How can I help you today?' }];
  }

  $: view = (messages.length ? messages : seed()).map((m) => {
    const isUser = m.who === 'user';
    const ops = m.ops || [];
    const revealed = m.revealed == null ? ops.length : m.revealed;
    const visible = ops.slice(0, revealed);
    const opsView = visible.map((line, i) => ({
      text: line,
      running: revealed < ops.length && i === visible.length - 1,
    }));
    return {
      align: isUser ? 'flex-end' : 'flex-start',
      who: m.who,
      text: m.text || '',
      hasOps: opsView.length > 0,
      ops: opsView,
      thinking: !!m.thinking,
    };
  });

  $: verts = objCount ? (objCount * 1282).toLocaleString() : '0';
  $: faces = objCount ? (objCount * 1280).toLocaleString() : '0';
  $: tris = objCount ? (objCount * 2560).toLocaleString() : '0';

  const sleep = (ms) => new Promise((res) => { const id = setTimeout(res, ms); timers.push(id); });
  function scrollDown() { if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight; }
  function scrollSoon() { tick().then(scrollDown); }

  function markActed() { userActed = true; typing = false; }

  function commandList() {
    return [
      { chip: 'model a Dyson-style cordless vacuum', text: 'Blocked out the full vacuum — cleaner head, brush bar, magenta wand, motor, dust bin, battery, and handle.', ops: ['create_mesh_primitive × 27', 'CleanerHead_MainNozzle + BrushRoll', 'DysonWand_MagentaTube', 'DysonMotorBarrel + DustBin', 'BatteryPack + handle grips', 'apply_transforms(scale)'], act: buildVacuum },
      { chip: 'bevel and smooth every edge', text: 'Added soft bevels to every hard edge and smooth-shaded the cylinders.', ops: ['add_bevel_modifier(width=0.012) × 27', 'shade_smooth(cylinders)'], act: () => {} },
      { chip: 'apply the Dyson material set', text: 'Created and assigned the materials — gunmetal body, metallic magenta wand, copper brush roll, smoked bin, silver caps, red triggers.', ops: ['create_material(Dyson metallic magenta wand)', 'create_material(Copper brush roll bristles)', 'create_material(Transparent smoky dust bin)', 'create_material(Brushed silver caps)', 'assign_material × 27'], act: applyMaterials },
      { chip: 'set up studio lighting', text: 'Added a key + fill area light, a 3/4 product camera, and a near-black studio world.', ops: ['add_light(AREA "Key", energy=450)', 'add_light(AREA "Fill", energy=90)', 'add_camera(Camera_Product_3Q)', 'set_world_background(0.03, 0.034, 0.05)'], act: setupLights },
    ];
  }

  function matchCommand(text) {
    const s = text.toLowerCase();
    const cmds = commandList();
    if (s.includes('vacuum') || s.includes('model') || s.includes('build') || s.includes('block')) return cmds[0];
    if (s.includes('refine') || s.includes('bevel') || s.includes('extrude')) return cmds[1];
    if (s.includes('material') || s.includes('dyson') || s.includes('texture') || s.includes('paint') || s.includes('color')) return cmds[2];
    if (s.includes('light') || s.includes('studio') || s.includes('camera') || s.includes('render')) return cmds[3];
    if (s.includes('blue')) return { text: 'Repainted the body in nalana blue.', ops: ['material.base_color = brand_blue'], act: () => setColor('#1085EF') };
    if (s.includes('rotate') || s.includes('turn') || s.includes('spin')) return { text: 'Rotated the model 30° on Z.', ops: ['transform.rotate(axis=Z, angle=30°)'], act: () => rotate(Math.PI / 6) };
    return null;
  }

  function submit() {
    const text = (input || '').trim();
    if (!text) return;
    markActed();
    const r = matchCommand(text) || { text: 'Done. Applied that to the scene.', ops: ['scene.update()'] };
    dispatch(text, r);
  }

  function dispatch(userText, r) {
    const base = messages.length ? messages : seed();
    messages = base.concat([{ who: 'user', text: userText }, { who: 'nalana', thinking: true }]);
    input = '';
    typing = false;
    scrollSoon();
    try { r.act && r.act(); } catch (e) {}
    const t1 = setTimeout(() => {
      if (dead) return;
      const ops = r.ops || [];
      const reply = { who: 'nalana', text: r.text, ops, revealed: ops.length ? 1 : 0 };
      messages = messages.slice(0, -1).concat([reply]);
      scrollSoon();
      if (ops.length > 1) {
        let rev = 1;
        const iv = setInterval(() => {
          if (dead) { clearInterval(iv); return; }
          rev++;
          messages = messages.map((m, i, a) => (i === a.length - 1 && m.who === 'nalana' ? { ...m, revealed: rev } : m));
          scrollSoon();
          if (rev >= ops.length) clearInterval(iv);
        }, 470);
        timers.push(iv);
      }
    }, 620);
    timers.push(t1);
  }

  // ── autoplay ──
  async function typeInto(text) {
    typing = true;
    for (let i = 1; i <= text.length; i++) {
      if (userActed || dead) { typing = false; return false; }
      input = text.slice(0, i);
      await sleep(34 + Math.random() * 36);
    }
    typing = false;
    return true;
  }

  async function autoplay() {
    if (userActed || dead) return;
    await sleep(1200);
    const seq = [0, 1, 2, 3].map((i) => commandList()[i]);
    for (const c of seq) {
      if (userActed || dead) return;
      const ok = await typeInto(c.chip);
      if (!ok) return;
      await sleep(360);
      if (userActed || dead) return;
      input = '';
      dispatch(c.chip, c);
      await sleep(2900);
    }
  }

  function startAutoplay() {
    if (autoStarted || userActed || dead) return;
    autoStarted = true;
    autoplay();
  }

  // ── three.js ──
  async function initThree() {
    if (three || !vpEl) return;
    const mod = await import('three');
    if (dead) return;
    THREE = mod;
    const host = vpEl;
    const w = host.clientWidth || 800, h = host.clientHeight || 460;
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(36, w / h, 0.1, 100);
    cam.position.set(1.5, 1.2, 5.2);
    cam.lookAt(0.7, -0.05, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    host.appendChild(renderer.domElement);

    const key = new THREE.DirectionalLight(0xffffff, 2.1); key.position.set(4, 6, 5); scene.add(key);
    const fill = new THREE.DirectionalLight(0x9ab8ff, 1.1); fill.position.set(-5, 1, 2); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffb38f, 1.4); rim.position.set(-2, 3, -5); scene.add(rim);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 0.8));
    extraLight = new THREE.PointLight(0xffd27a, 0, 16); extraLight.position.set(0, 4, 2); scene.add(extraLight);

    const gridY = -1.0;
    const grid = new THREE.GridHelper(40, 40, 0x9a9a9a, 0x6f6f6f);
    grid.material.transparent = true; grid.material.opacity = 0.5; grid.position.y = gridY; scene.add(grid);
    const mkLine = (color, a, b) => {
      const g = new THREE.BufferGeometry().setFromPoints([a, b]);
      const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color }));
      l.position.y = gridY + 0.002; scene.add(l);
    };
    mkLine(0xc0473f, new THREE.Vector3(-20, 0, 0), new THREE.Vector3(20, 0, 0));
    mkLine(0x5f9e4a, new THREE.Vector3(0, 0, -20), new THREE.Vector3(0, 0, 20));

    const group = new THREE.Group(); scene.add(group);
    three = { scene, cam, renderer, group, host, objs: [] };

    const tickFn = () => {
      group.rotation.y += 0.0038;
      three.objs.forEach((o, i) => { o.position.y = 0.25 + Math.sin(Date.now() * 0.0011 + i * 1.6) * 0.1; });
      renderer.render(scene, cam);
      raf = requestAnimationFrame(tickFn);
    };
    tickFn();
    onResize = () => { if (!host.clientWidth) return; cam.aspect = host.clientWidth / host.clientHeight; cam.updateProjectionMatrix(); renderer.setSize(host.clientWidth, host.clientHeight); };
    window.addEventListener('resize', onResize);
  }

  function setColor(hex) { if (vac && vac.mats.magenta) vac.mats.magenta.color.set(hex); }
  function rotate(rad) { if (vac) vac.group.rotation.y += rad; else if (active) active.rotation.z += rad; }
  function setupLights() { if (extraLight) extraLight.intensity = 900; }

  function vacParts() {
    const H = Math.PI / 2;
    return [
      { k: 'cube', dims: [0.285, 0.105, 0.055], loc: [0, -0.02, 0.0275], mat: 'gun' },
      { k: 'cube', dims: [0.245, 0.01, 0.03], loc: [0, -0.073, 0.037], mat: 'window' },
      { k: 'cyl', r: 0.017, d: 0.235, seg: 48, loc: [0, -0.048, 0.031], rot: [0, H, 0], mat: 'copper' },
      { k: 'cyl', r: 0.009, d: 0.255, seg: 48, loc: [0, -0.048, 0.031], rot: [0, H, 0], mat: 'purple' },
      { k: 'cube', dims: [0.018, 0.088, 0.04], loc: [-0.153, -0.02, 0.032], mat: 'black' },
      { k: 'cube', dims: [0.018, 0.088, 0.04], loc: [0.153, -0.02, 0.032], mat: 'black' },
      { k: 'cyl', r: 0.017, d: 0.016, seg: 32, loc: [-0.112, 0.035, 0.017], rot: [0, H, 0], mat: 'black' },
      { k: 'cyl', r: 0.017, d: 0.016, seg: 32, loc: [0.112, 0.035, 0.017], rot: [0, H, 0], mat: 'black' },
      { k: 'cyl', r: 0.024, d: 0.105, seg: 48, loc: [0, 0.045, 0.092], rot: [0, H, 0], mat: 'purple' },
      { k: 'cube', dims: [0.074, 0.04, 0.07], loc: [0, 0.04, 0.125], mat: 'gun' },
      { k: 'cyl', r: 0.017, d: 0.726, seg: 48, loc: [0, 0.015, 0.507], rot: [0.041, 0, 0], mat: 'magenta' },
      { k: 'cyl', r: 0.021, d: 0.075, seg: 32, loc: [0, 0.031, 0.167], rot: [0.027, 0, 0], mat: 'black' },
      { k: 'cyl', r: 0.021, d: 0.080, seg: 32, loc: [0, -0.0015, 0.855], rot: [0.037, 0, 0], mat: 'black' },
      { k: 'cyl', r: 0.064, d: 0.155, seg: 64, loc: [0, -0.008, 1.035], rot: [0, H, 0], mat: 'gun' },
      { k: 'cyl', r: 0.052, d: 0.009, seg: 48, loc: [-0.083, -0.008, 1.035], rot: [0, H, 0], mat: 'silver' },
      { k: 'cyl', r: 0.052, d: 0.009, seg: 48, loc: [0.083, -0.008, 1.035], rot: [0, H, 0], mat: 'silver' },
      { k: 'cyl', r: 0.052, d: 0.178, seg: 64, loc: [0, -0.052, 0.925], mat: 'smoke' },
      { k: 'cyl', r: 0.054, d: 0.014, seg: 64, loc: [0, -0.052, 0.834], mat: 'gun' },
      { k: 'cube', dims: [0.03, 0.01, 0.06], loc: [0, -0.108, 0.9], mat: 'red' },
      { k: 'cube', dims: [0.112, 0.074, 0.082], loc: [0, 0.076, 0.914], mat: 'purple' },
      { k: 'cube', dims: [0.095, 0.064, 0.025], loc: [0, 0.078, 0.865], mat: 'black' },
      { k: 'cyl', r: 0.017, d: 0.113, seg: 32, loc: [0, 0.111, 1.105], rot: [-H, Math.PI, 0], mat: 'black' },
      { k: 'cyl', r: 0.018, d: 0.170, seg: 32, loc: [0, 0.162, 1.02], rot: [3.065, 0, 0], mat: 'black' },
      { k: 'cyl', r: 0.015, d: 0.078, seg: 32, loc: [0, 0.119, 0.921], rot: [1.925, 0, 0], mat: 'black' },
      { k: 'cube', dims: [0.034, 0.012, 0.06], loc: [0, 0.061, 1.008], mat: 'red' },
      { k: 'cube', dims: [0.036, 0.03, 0.01], loc: [0, -0.008, 1.108], mat: 'red' },
      { k: 'cube', dims: [0.11, 0.044, 0.078], loc: [0, 0.067, 1.037], mat: 'purple' },
    ];
  }

  function buildVacuum() {
    if (!three || vac) return;
    const clay = new THREE.MeshStandardMaterial({ color: new THREE.Color('#b7b8bd'), metalness: 0.1, roughness: 0.62 });
    const v = new THREE.Group();
    const meshes = [];
    vacParts().forEach((p) => {
      let geo;
      if (p.k === 'cyl') { geo = new THREE.CylinderGeometry(p.r, p.r, p.d, p.seg || 32); geo.rotateX(Math.PI / 2); }
      else geo = new THREE.BoxGeometry(p.dims[0], p.dims[1], p.dims[2]);
      const m = new THREE.Mesh(geo, clay);
      m.position.set(p.loc[0], p.loc[1], p.loc[2]);
      if (p.rot) m.rotation.set(p.rot[0], p.rot[1], p.rot[2]);
      m.userData.mat = p.mat;
      v.add(m); meshes.push(m);
    });
    v.rotation.x = -Math.PI / 2;
    v.scale.setScalar(2.2);
    v.position.y = -1.2;
    three.group.add(v);
    vac = { group: v, meshes, mats: {} };
    active = v;
    objCount = 27;
  }

  function applyMaterials() {
    if (!vac || !three) return;
    const M = (hex, rough, metal, opts) => new THREE.MeshStandardMaterial(Object.assign({ color: new THREE.Color(hex), roughness: rough, metalness: metal }, opts || {}));
    const mats = {
      gun: M('#34373c', 0.38, 0.0),
      black: M('#141416', 0.72, 0.0),
      magenta: M('#d11fae', 0.25, 0.35),
      purple: M('#6a2ed0', 0.42, 0.0),
      red: M('#ef2a1c', 0.45, 0.0),
      smoke: M('#cfeeff', 0.08, 0.0, { transparent: true, opacity: 0.32 }),
      copper: M('#ef7a1f', 0.32, 0.25),
      window: M('#93d6ff', 0.07, 0.0, { transparent: true, opacity: 0.35 }),
      silver: M('#c2c5c9', 0.28, 0.6),
    };
    vac.mats = mats;
    vac.meshes.forEach((m) => { const mt = mats[m.userData.mat]; if (mt) m.material = mt; });
  }

  function onInputEvt() { markActed(); }
  function onFocusEvt() { markActed(); }
  function onKeyEvt(e) { if (e.key === 'Enter') { e.preventDefault(); submit(); } }

  onMount(() => {
    initThree();
    if (rootEl && 'IntersectionObserver' in window) {
      io = new IntersectionObserver((es) => { es.forEach((e) => { if (e.isIntersecting) startAutoplay(); }); }, { threshold: 0 });
      io.observe(rootEl);
    }
    const id = setTimeout(startAutoplay, 2000);
    timers.push(id);
  });

  onDestroy(() => {
    dead = true;
    timers.forEach((id) => { clearTimeout(id); clearInterval(id); });
    if (io) io.disconnect();
    if (raf) cancelAnimationFrame(raf);
    if (onResize) window.removeEventListener('resize', onResize);
    if (three && three.renderer) three.renderer.dispose();
  });
</script>

<div class="ide">
  <!-- title bar -->
  <div class="titlebar">
    <svg width="12" height="15" viewBox="0 0 69 82" fill="none"><path d="M68.5 69.33C68.5 71.51 66.73 73.29 64.54 73.29C62.67 73.29 61.07 71.97 60.52 70.18C59 65.25 56.25 59.81 52.4 54.57C42.79 41.47 29.98 34.54 23.78 39.09C17.59 43.63 20.36 57.93 29.97 71.03C30.65 71.95 30.01 73.29 28.86 73.29H11.75C9.54 73.29 7.75 71.5 7.75 69.29V4C7.75 1.79 9.54 0 11.75 0H15.14C17 0 18.6 1.29 19.17 3.05C20.73 7.8 23.41 12.98 27.08 17.99C36.69 31.09 49.5 38.02 55.7 33.47C61.89 28.93 59.12 14.63 49.51 1.53C49.04 0.9 49.49 0 50.27 0H64.5C66.71 0 68.5 1.79 68.5 4V69.33Z" fill="#FF8C69"/><path d="M61.75 69.33C61.75 71.51 59.98 73.29 57.79 73.29C55.92 73.29 54.32 71.97 53.77 70.18C52.25 65.25 49.5 59.81 45.65 54.57C36.04 41.47 23.23 34.54 17.03 39.09C10.84 43.63 13.61 57.93 23.22 71.03C23.9 71.95 23.26 73.29 22.11 73.29H5C2.79 73.29 1 71.5 1 69.29V4C1 1.79 2.79 0 5 0H8.39C10.25 0 11.85 1.29 12.42 3.05C13.98 7.8 16.66 12.98 20.33 17.99C29.94 31.09 42.75 38.02 48.95 33.47C55.14 28.93 52.37 14.63 42.76 1.53C42.29 0.9 42.74 0 43.52 0H57.75C59.96 0 61.75 1.79 61.75 4V69.33Z" fill="#1085EF"/></svg>
    <span class="title-text">(Unsaved) — Nalana 2.0.0</span>
    <div class="title-ctrls">
      <span class="ctrl-min"></span>
      <span class="ctrl-box"></span>
      <span class="ctrl-x">✕</span>
    </div>
  </div>

  <!-- workspace tabs -->
  <div class="tabs">
    {#each tabsList as label}
      <span class="tab" class:active={label === 'Layout'}>{label}</span>
    {/each}
    <span class="tabs-right">
      <span class="tab-pill">Scene</span>
      <span class="tab-pill quit">Quit &amp; Log</span>
    </span>
  </div>

  <!-- header -->
  <div class="hdr">
    <span class="mode-pill"><span class="mode-sq"></span>Object Mode ▾</span>
    <span class="menu-item">View</span>
    <span class="menu-item">Select</span>
    <span class="menu-item">Add</span>
    <span class="menu-item">Object</span>
    <span class="mode-pill global">⊕ Global ▾</span>
    <span class="hdr-right">
      <span class="hbtn"><span class="hbtn-circle"></span></span>
      <span class="hbtn"><span class="hbtn-sq"></span></span>
      <span class="hbtn on"><span class="hbtn-dot"></span></span>
    </span>
  </div>

  <!-- main -->
  <div class="main">
    <div class="viewport" bind:this={vpEl}></div>
    <span class="vp-label vp-persp">User Perspective</span>
    <span class="vp-label vp-coll">(1) Collection</span>

    <!-- floating assistant panel -->
    <div class="panel" bind:this={rootEl}>
      <div class="panel-glow"></div>

      <div class="panel-hdr">
        <div class="panel-brand">
          <svg width="24" height="28" viewBox="0 0 69 82" fill="none"><path d="M68.5 69.33C68.5 71.51 66.73 73.29 64.54 73.29C62.67 73.29 61.07 71.97 60.52 70.18C59 65.25 56.25 59.81 52.4 54.57C42.79 41.47 29.98 34.54 23.78 39.09C17.59 43.63 20.36 57.93 29.97 71.03C30.65 71.95 30.01 73.29 28.86 73.29H11.75C9.54 73.29 7.75 71.5 7.75 69.29V4C7.75 1.79 9.54 0 11.75 0H15.14C17 0 18.6 1.29 19.17 3.05C20.73 7.8 23.41 12.98 27.08 17.99C36.69 31.09 49.5 38.02 55.7 33.47C61.89 28.93 59.12 14.63 49.51 1.53C49.04 0.9 49.49 0 50.27 0H64.5C66.71 0 68.5 1.79 68.5 4V69.33Z" fill="#FF8C69"/><path d="M61.75 69.33C61.75 71.51 59.98 73.29 57.79 73.29C55.92 73.29 54.32 71.97 53.77 70.18C52.25 65.25 49.5 59.81 45.65 54.57C36.04 41.47 23.23 34.54 17.03 39.09C10.84 43.63 13.61 57.93 23.22 71.03C23.9 71.95 23.26 73.29 22.11 73.29H5C2.79 73.29 1 71.5 1 69.29V4C1 1.79 2.79 0 5 0H8.39C10.25 0 11.85 1.29 12.42 3.05C13.98 7.8 16.66 12.98 20.33 17.99C29.94 31.09 42.75 38.02 48.95 33.47C55.14 28.93 52.37 14.63 42.76 1.53C42.29 0.9 42.74 0 43.52 0H57.75C59.96 0 61.75 1.79 61.75 4V69.33Z" fill="#1085EF"/></svg>
          <span class="panel-status-dot"></span>
        </div>
        <div class="panel-hdr-icons">
          <span class="q">?</span>
          <span class="burger"><span></span><span></span><span></span></span>
        </div>
      </div>
      <div class="model-row">
        <span class="model-pill">Select model ▾</span>
      </div>

      <!-- messages -->
      <div class="messages" bind:this={messagesEl}>
        {#each view as m}
          <div class="msg" style="align-items:{m.align};">
            <div class="bubble {m.who}">
              {#if m.text}<span>{m.text}</span>{/if}
              {#if m.hasOps}
                <div class="ops">
                  {#each m.ops as op}
                    <div class="op" class:running={op.running}>
                      <span class="op-dot" class:running={op.running}></span><span>{op.text}</span>
                    </div>
                  {/each}
                </div>
              {/if}
              {#if m.thinking}
                <span class="thinking">
                  <span></span><span></span><span></span>
                </span>
              {/if}
            </div>
          </div>
        {/each}
      </div>

      <!-- input -->
      <div class="panel-input-wrap">
        <div class="panel-input">
          <div class="input-line">
            <input bind:value={input} on:input={onInputEvt} on:keydown={onKeyEvt} on:focus={onFocusEvt} placeholder="What do you want to build..." />
            {#if typing}<span class="caret"></span>{/if}
          </div>
          <button class="send" on:click={submit} title="Send" aria-label="Send">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="6 11 12 5 18 11"/></svg>
          </button>
        </div>
        <div class="bridge">
          <span class="bridge-dot"></span>
          <span>Bridge connected · scene synced</span>
        </div>
      </div>
    </div>
  </div>

  <!-- status bar -->
  <div class="statusbar">
    <span>Collection</span>
    <span>Verts: <span class="stat">{verts}</span></span>
    <span>Faces: <span class="stat">{faces}</span></span>
    <span>Tris: <span class="stat">{tris}</span></span>
    <span class="status-spacer">Memory: 24.8 MiB</span>
    <span>VRAM: 1.8/6.0 GiB</span>
    <span class="stat">2.0.0</span>
  </div>
</div>

<style>
  .ide {
    display: flex; flex-direction: column; width: 100%; height: 100%;
    border-radius: 12px; overflow: hidden; font-family: 'Inter', sans-serif;
    background: #1d1d1d; border: 1px solid rgba(0, 0, 0, 0.4);
    box-shadow: 0 30px 70px -20px rgba(8, 15, 40, 0.5), 0 8px 24px rgba(8, 15, 40, 0.25);
  }
  .titlebar {
    height: 30px; flex-shrink: 0; display: flex; align-items: center; gap: 9px;
    padding: 0 12px; background: #2b2b2b; border-bottom: 1px solid #1a1a1a;
  }
  .title-text { font-size: 11px; color: #b0b0b0; }
  .title-ctrls { margin-left: auto; display: flex; align-items: center; gap: 14px; color: #9a9a9a; }
  .ctrl-min { width: 11px; height: 1px; background: #9a9a9a; display: inline-block; }
  .ctrl-box { width: 9px; height: 9px; border: 1px solid #9a9a9a; display: inline-block; }
  .ctrl-x { font-size: 13px; line-height: 1; }
  .tabs {
    height: 30px; flex-shrink: 0; display: flex; align-items: center; gap: 2px;
    padding: 0 10px; background: #323232; border-bottom: 1px solid #1a1a1a; overflow: hidden;
  }
  .tab { font-size: 11px; color: #b6b6b6; padding: 5px 10px; border-radius: 5px; white-space: nowrap; }
  .tab.active { color: #fff; font-weight: 500; padding: 5px 11px; background: #1085ef; }
  .tabs-right { margin-left: auto; display: flex; align-items: center; gap: 6px; }
  .tab-pill {
    font-size: 10.5px; color: #bdbdbd; background: #3c3c3c; border: 1px solid #262626;
    border-radius: 4px; padding: 3px 9px; white-space: nowrap;
  }
  .tab-pill.quit { color: #e3b6b6; background: #3c3232; }
  .hdr {
    height: 30px; flex-shrink: 0; display: flex; align-items: center; gap: 14px;
    padding: 0 12px; background: #383838; border-bottom: 1px solid #1f1f1f;
  }
  .mode-pill {
    font-size: 10.5px; color: #cfcfcf; background: #4a4a4a; border: 1px solid #2a2a2a;
    border-radius: 4px; padding: 3px 10px; display: inline-flex; align-items: center; gap: 6px;
  }
  .mode-pill.global { margin-left: 6px; }
  .mode-sq { width: 9px; height: 9px; border: 1.5px solid #b6b6b6; border-radius: 2px; display: inline-block; }
  .menu-item { font-size: 11px; color: #b8b8b8; }
  .hdr-right { margin-left: auto; display: flex; align-items: center; gap: 5px; }
  .hbtn { width: 22px; height: 18px; border-radius: 4px; background: #454545; display: inline-flex; align-items: center; justify-content: center; }
  .hbtn.on { background: #1085ef; }
  .hbtn-circle { width: 9px; height: 9px; border: 1.4px solid #c8c8c8; border-radius: 50%; }
  .hbtn-sq { width: 9px; height: 9px; border: 1.4px solid #c8c8c8; }
  .hbtn-dot { width: 9px; height: 9px; border-radius: 50%; background: #fff; }
  .main { flex: 1; position: relative; min-height: 360px; background: linear-gradient(180deg, #5c5c5c, #373737); overflow: hidden; }
  .viewport { position: absolute; inset: 0; }
  .vp-label { position: absolute; left: 14px; font-size: 11px; }
  .vp-persp { top: 10px; color: #d8d8d8; font-weight: 500; }
  .vp-coll { top: 28px; color: #bcbcbc; }
  .panel {
    position: absolute; top: 14px; right: 14px; bottom: 14px; width: 38%; min-width: 330px; max-width: 430px;
    display: flex; flex-direction: column; border-radius: 20px; overflow: hidden;
    background: linear-gradient(150deg, rgba(255, 255, 255, 0.94), rgba(244, 247, 255, 0.86));
    backdrop-filter: blur(22px); -webkit-backdrop-filter: blur(22px);
    border: 1px solid rgba(255, 255, 255, 0.85); box-shadow: 0 20px 50px rgba(10, 15, 40, 0.4);
  }
  .panel-glow {
    position: absolute; inset: 0; pointer-events: none;
    background: radial-gradient(120% 80% at 100% 0%, rgba(255, 150, 170, 0.16), transparent 50%),
      radial-gradient(120% 90% at 0% 100%, rgba(90, 150, 255, 0.16), transparent 55%);
  }
  .panel-hdr { position: relative; display: flex; justify-content: center; align-items: center; padding: 14px 16px 6px; flex-shrink: 0; }
  .panel-brand { display: flex; flex-direction: column; align-items: center; line-height: 1; }
  .panel-status-dot { width: 5px; height: 5px; border-radius: 50%; background: #28c840; margin-top: 3px; box-shadow: 0 0 6px rgba(40, 200, 90, 0.65); }
  .panel-hdr-icons { position: absolute; top: 14px; right: 16px; display: flex; align-items: center; gap: 12px; color: #6a6f7e; }
  .q { width: 20px; height: 20px; border-radius: 50%; border: 1.4px solid #9aa0b0; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; }
  .burger { display: inline-flex; flex-direction: column; gap: 3px; }
  .burger span { width: 16px; height: 1.6px; background: #9aa0b0; }
  .model-row { position: relative; display: flex; padding: 0 16px 6px; flex-shrink: 0; }
  .model-pill {
    margin-left: auto; font-size: 11.5px; color: #3a3f4c; font-weight: 500;
    background: rgba(255, 255, 255, 0.7); border: 1px solid rgba(15, 23, 42, 0.1);
    border-radius: 9px; padding: 6px 12px; display: inline-flex; align-items: center; gap: 8px;
    box-shadow: 0 1px 3px rgba(10, 15, 40, 0.08);
  }
  .messages { position: relative; flex: 1; overflow-y: auto; padding: 10px 16px; display: flex; flex-direction: column; gap: 13px; }
  .msg { display: flex; flex-direction: column; gap: 5px; }
  .bubble { max-width: 90%; padding: 11px 15px; font-size: 13px; line-height: 1.5; border-radius: 16px; }
  .bubble.user { background: #1085ef; color: #fff; border-bottom-right-radius: 5px; }
  .bubble.nalana { background: rgba(255, 255, 255, 0.92); color: #27303f; border: 1px solid rgba(15, 23, 42, 0.07); border-bottom-left-radius: 5px; box-shadow: 0 1px 4px rgba(10, 15, 40, 0.05); }
  .ops { margin-top: 9px; border-radius: 10px; background: rgba(16, 133, 239, 0.07); border: 1px solid rgba(16, 133, 239, 0.18); padding: 9px 11px; display: flex; flex-direction: column; gap: 7px; }
  .op { display: flex; align-items: center; gap: 8px; font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 10.5px; color: #0a6fcc; line-height: 1.35; }
  .op.running { opacity: 0.78; }
  .op-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; background: #28c840; box-shadow: 0 0 6px rgba(40, 200, 90, 0.55); }
  .op-dot.running { background: #0a6fcc; box-shadow: none; animation: ndBlink 1s infinite; }
  .thinking { display: inline-flex; gap: 4px; align-items: center; }
  .thinking span { width: 6px; height: 6px; border-radius: 50%; background: #e8703f; animation: ndBlink 1.4s infinite; }
  .thinking span:nth-child(2) { animation-delay: 0.2s; }
  .thinking span:nth-child(3) { animation-delay: 0.4s; }
  .panel-input-wrap { position: relative; padding: 8px 14px 14px; flex-shrink: 0; }
  .panel-input {
    display: flex; align-items: center; gap: 8px; background: rgba(255, 255, 255, 0.85);
    border: 1px solid rgba(15, 23, 42, 0.12); border-radius: 100px; padding: 7px 7px 7px 16px;
    box-shadow: 0 1px 4px rgba(10, 15, 40, 0.06);
  }
  .input-line { flex: 1; display: flex; align-items: center; }
  .input-line input { flex: 1; background: transparent; border: none; outline: none; font-family: 'Inter', sans-serif; font-size: 13px; color: #1a1a1a; }
  .caret { width: 1.5px; height: 15px; background: #1085ef; margin-left: -2px; animation: ndCaret 0.9s steps(1) infinite; }
  .send { width: 34px; height: 34px; border-radius: 50%; border: none; background: #1085ef; box-shadow: 0 2px 10px rgba(16, 133, 239, 0.45); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
  .bridge { display: flex; align-items: center; gap: 6px; margin-top: 9px; justify-content: flex-end; }
  .bridge-dot { width: 6px; height: 6px; border-radius: 50%; background: #28c840; box-shadow: 0 0 7px rgba(40, 200, 90, 0.6); }
  .bridge span:last-child { font-size: 10.5px; color: #7a8090; }
  .statusbar {
    height: 22px; flex-shrink: 0; display: flex; align-items: center; gap: 16px;
    padding: 0 12px; background: #1f1f1f; border-top: 1px solid #141414; font-size: 10.5px; color: #8a8a8a;
  }
  .statusbar .stat { color: #bdbdbd; }
  .status-spacer { margin-left: auto; }
  @keyframes ndBlink { 0%, 80%, 100% { opacity: 0.25; } 40% { opacity: 1; } }
  @keyframes ndCaret { 0%, 100% { opacity: 0; } 50% { opacity: 1; } }
</style>
