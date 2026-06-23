<script>
  import { onMount, onDestroy } from 'svelte';

  let rootEl, vpEl;
  let input = '';
  let bubbles = [];

  // three.js refs (client-only)
  let THREE, scene, cam, renderer, group, mesh, mat;
  let second = null;
  let raf = null;
  let inited = false;
  let spin = 0;
  let io, onResize;

  let dead = false;
  let timers = [];
  let queue = [];
  let running = false;

  const buckets = [
    { key: 'color', re: /\b(blue|red|green|orange|salmon|black|white|purple|lavender|pink|yellow|gold|teal|brown|navy|crimson|magenta|cyan|beige|copper|bronze|silver|maroon|olive|indigo|turquoise|coral|mint|darker|lighter|recolou?r|paint|colou?r|tint|hue)\b/, replies: ['Recolored it for you.', 'New color applied.', 'Done — fresh coat.', 'Updated the material color.'] },
    { key: 'scale', re: /\b(bigger|larger|smaller|tinier|taller|shorter|wider|thinner|shrink|grow|scale|size|huge|massive|tiny)\b/, replies: ['Resized.', 'Scaled it.', 'New size, done.'] },
    { key: 'smooth', re: /\b(smooth|smoother|round|rounder|organic|soft|subdivide|subdivided)\b/, replies: ['Smoothed the surface.', 'Rounder now.', 'Subdivided and smoothed.'] },
    { key: 'sharp', re: /\b(sharp|sharper|faceted|facet|low.?poly|angular|crystal|hard.?edge|blocky)\b/, replies: ['Faceted it.', 'Sharper edges now.', 'Flat-shaded for facets.'] },
    { key: 'material', re: /\b(metal|metallic|chrome|glass|matte|shiny|gloss|glossy|rough|reflective|mirror|wood|wooden|plastic|ceramic|stone|marble|concrete|rubber|brushed|satin)\b/, replies: ['Material updated.', 'New finish applied.', 'Reworked the surface.'] },
    { key: 'rotate', re: /\b(rotate|spin|turn|flip|tilt|orient)\b/, replies: ['Rotated.', 'Spun it around.', 'Turned it for you.'] },
    { key: 'move', re: /\b(move|nudge|shift|reposition|left|right|up|down|center|centre)\b/, replies: ['Repositioned.', 'Moved it.', 'Nudged into place.'] },
    { key: 'add', re: /\b(add|another|more|second|duplicate|copy|two|clone)\b/, replies: ['Added another one.', 'Dropped in a second.', 'Now there are two.'] },
    { key: 'shape', re: /\b(cube|box|sphere|ball|torus|donut|ring|pyramid|cylinder|cone|knot)\b/, replies: ['Swapped the shape.', 'New geometry in.', 'Reshaped it.'] },
  ];

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function send() {
    const text = (input || '').trim();
    if (!text) return;
    input = '';
    queue.push(text);
    if (!running) drain();
  }

  function push(who, text) {
    bubbles = [...bubbles, { who, text }].slice(-3);
  }

  function drain() {
    if (!queue.length) { running = false; return; }
    running = true;
    const text = queue.shift();
    push('user', text);
    const b = buckets.find((x) => x.re.test(text.toLowerCase()));
    let reply;
    if (b) {
      reply = pick(b.replies);
      applyIntent(b.key, text);
    } else {
      const frag = text.split(/\s+/).slice(0, 4).join(' ');
      reply = pick([`"${frag}" — nudging it that way.`, `On it — tweaking toward "${frag}".`, `Got it: ${frag}. Adjusting.`]);
      catchAll();
    }
    const t = setTimeout(() => {
      push('nalana', reply);
      const t2 = setTimeout(() => drain(), 520);
      timers.push(t2);
    }, 480);
    timers.push(t);
  }

  // ── 3D reactions ──
  function applyIntent(key, text) {
    const s = text.toLowerCase();
    if (key === 'color') {
      const map = { blue: '#1085EF', red: '#e0392b', green: '#37b24d', orange: '#ff8c42', salmon: '#FF8C69', black: '#1c1c22', white: '#eef0f4', purple: '#7c4ddb', lavender: '#A78ADE', pink: '#e84d8a', yellow: '#f2c14e', gold: '#d4af37', teal: '#13a8a8', brown: '#8a5a2b', navy: '#1f2f6b', crimson: '#b00020', magenta: '#c026a8', cyan: '#1bb4c9', beige: '#d9c9a3', copper: '#b3633a', bronze: '#9c7a3c', silver: '#c2c6cc', maroon: '#6e1f2b', olive: '#6b7233', indigo: '#4636c9', turquoise: '#1fc7a8', coral: '#ff6f5e', mint: '#69d6a3' };
      let hex = null;
      Object.keys(map).forEach((k) => { if (s.includes(k)) hex = map[k]; });
      if (s.includes('darker')) return shade(-0.18);
      if (s.includes('lighter')) return shade(0.18);
      if (hex) setColor(hex);
    } else if (key === 'scale') {
      const up = /\b(bigger|larger|taller|grow|huge|massive)\b/.test(s);
      scaleBy(up ? 1.22 : 0.82);
    } else if (key === 'smooth') setDetail(true);
    else if (key === 'sharp') setDetail(false);
    else if (key === 'material') {
      if (s.includes('glass')) setMat({ metalness: 0, roughness: 0.05, opacity: 0.4, transparent: true });
      else if (s.includes('wood')) { setColor('#8a5a2b'); setMat({ metalness: 0.0, roughness: 0.7, opacity: 1, transparent: false }); }
      else if (s.includes('stone') || s.includes('marble') || s.includes('concrete')) { setColor('#b8b8b2'); setMat({ metalness: 0.0, roughness: 0.9, opacity: 1, transparent: false }); }
      else if (s.includes('plastic') || s.includes('rubber')) setMat({ metalness: 0.0, roughness: 0.55, opacity: 1, transparent: false });
      else if (s.includes('ceramic') || s.includes('satin')) setMat({ metalness: 0.1, roughness: 0.35, opacity: 1, transparent: false });
      else if (s.includes('matte') || s.includes('rough')) setMat({ metalness: 0.1, roughness: 0.85, opacity: 1, transparent: false });
      else setMat({ metalness: 0.95, roughness: 0.12, opacity: 1, transparent: false });
    } else if (key === 'rotate') bumpSpin();
    else if (key === 'move') { bumpSpin(0.4); if (mesh) mesh.position.x = Math.random() * 0.8 - 0.4; }
    else if (key === 'add') addSecond();
    else if (key === 'shape') {
      if (s.includes('cube') || s.includes('box')) swap('cube');
      else if (s.includes('torus') || s.includes('donut') || s.includes('ring')) swap('torus');
      else swap('ico');
    }
  }

  function catchAll() {
    bumpSpin(0.4);
    if (mat) { const h = mat.color.getHSL({}); mat.color.setHSL((h.h + 0.04) % 1, h.s, h.l); }
  }

  function setColor(hex) { if (mat) mat.color.set(hex); }
  function shade(d) { if (!mat) return; const h = mat.color.getHSL({}); mat.color.setHSL(h.h, h.s, Math.max(0, Math.min(1, h.l + d))); }
  function scaleBy(f) { if (!mesh) return; const sv = Math.max(0.4, Math.min(2.2, mesh.scale.x * f)); mesh.scale.setScalar(sv); }
  function setDetail(smooth) {
    if (!mesh || !THREE) return;
    const geo = smooth ? new THREE.IcosahedronGeometry(1.05, 5) : new THREE.IcosahedronGeometry(1.05, 0);
    mesh.geometry.dispose();
    mesh.geometry = geo;
    mat.flatShading = !smooth;
    mat.needsUpdate = true;
  }
  function setMat(o) { if (!mat) return; Object.assign(mat, o); mat.needsUpdate = true; }
  function bumpSpin(amt) { spin = (spin || 0) + (amt || 0.7); }
  function swap(kind) {
    if (!mesh || !THREE) return;
    let geo;
    if (kind === 'cube') geo = new THREE.BoxGeometry(1.5, 1.5, 1.5, 3, 3, 3);
    else if (kind === 'torus') geo = new THREE.TorusKnotGeometry(0.7, 0.26, 140, 20);
    else geo = new THREE.IcosahedronGeometry(1.05, 4);
    mesh.geometry.dispose();
    mesh.geometry = geo;
  }
  function addSecond() {
    if (!group || second || !THREE) return;
    mesh.position.x = -1.1;
    second = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 4), mat.clone());
    second.position.x = 1.2;
    group.add(second);
  }

  // ── three.js (lazy + offscreen pause) ──
  async function initThree() {
    if (inited || !vpEl) return;
    const mod = await import('three');
    if (dead) return;
    THREE = mod;
    inited = true;
    const host = vpEl;
    const w = host.clientWidth || 500;
    const h = host.clientHeight || 340;
    scene = new THREE.Scene();
    cam = new THREE.PerspectiveCamera(38, w / h, 0.1, 100);
    cam.position.set(0, 0.3, 5);
    cam.lookAt(0, 0, 0);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    host.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x223044, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(4, 6, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x6aa6ff, 1.6);
    rim.position.set(-4, 2, -3);
    scene.add(rim);
    mat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#1085EF'), metalness: 0.9, roughness: 0.18 });
    group = new THREE.Group();
    scene.add(group);
    mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05, 4), mat);
    group.add(mesh);
    onResize = () => {
      if (!host.clientWidth) return;
      cam.aspect = host.clientWidth / host.clientHeight;
      cam.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
    };
    window.addEventListener('resize', onResize);
    spin = 0;
  }

  function play() {
    if (raf || !renderer) return;
    const tick = () => {
      group.rotation.y += 0.005 + (spin || 0);
      if (spin) spin *= 0.92;
      group.position.y = Math.sin(Date.now() * 0.0012) * 0.1;
      renderer.render(scene, cam);
      raf = requestAnimationFrame(tick);
    };
    tick();
  }
  function pause() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

  function onKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); send(); }
  }

  onMount(() => {
    if (!('IntersectionObserver' in window) || !rootEl) {
      initThree().then(() => { if (!dead) play(); });
      return;
    }
    io = new IntersectionObserver(
      (entries) => {
        entries.forEach(async (e) => {
          if (e.isIntersecting) {
            if (!inited) await initThree();
            if (!dead) play();
          } else pause();
        });
      },
      { threshold: 0.15 }
    );
    io.observe(rootEl);
  });

  onDestroy(() => {
    dead = true;
    pause();
    timers.forEach((id) => clearTimeout(id));
    if (io) io.disconnect();
    if (onResize) window.removeEventListener('resize', onResize);
    if (renderer) renderer.dispose();
  });
</script>

<div class="tryit" bind:this={rootEl}>
  <div class="grid-overlay"></div>

  <div class="viewport" bind:this={vpEl}></div>

  <div class="online-badge">
    <span class="dot"></span>Online
  </div>

  <div class="panel">
    <div class="panel-glow"></div>
    <div class="replies">
      {#each bubbles as b (b.who + b.text)}
        <div class="row" style="justify-content:{b.who === 'user' ? 'flex-end' : 'flex-start'};">
          <div class="cbub {b.who}">{b.text}</div>
        </div>
      {/each}
    </div>
    <div class="input-wrap">
      <div class="input">
        <input bind:value={input} on:keydown={onKey} placeholder="What do you want to change…" />
        <button class="send" on:click={send} title="Send" aria-label="Send">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="6 11 12 5 18 11"></polyline></svg>
        </button>
      </div>
      <div class="bridge">
        <span class="dot"></span>
        <span>Bridge connected</span>
      </div>
    </div>
  </div>
</div>

<style>
  .tryit {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: 24px;
    overflow: hidden;
    background: linear-gradient(150deg, rgba(255, 255, 255, 0.96), rgba(244, 247, 255, 0.9));
    border: 1px solid rgba(255, 255, 255, 0.85);
    box-shadow: 0 18px 44px -24px rgba(20, 30, 80, 0.28);
    font-family: 'Inter', sans-serif;
  }
  .grid-overlay {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(rgba(15, 23, 42, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(15, 23, 42, 0.05) 1px, transparent 1px);
    background-size: 32px 32px;
    -webkit-mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, #000 40%, transparent 82%);
    mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, #000 40%, transparent 82%);
  }
  .viewport { position: absolute; left: 0; top: 0; bottom: 0; right: 46%; }
  .online-badge {
    position: absolute; top: 14px; left: 16px;
    display: inline-flex; align-items: center; gap: 7px; padding: 5px 12px;
    border-radius: 100px; background: rgba(255, 255, 255, 0.75);
    border: 1px solid rgba(15, 23, 42, 0.1); font-size: 11px; font-weight: 600; color: #3a3f4c;
    box-shadow: 0 1px 3px rgba(10, 15, 40, 0.08);
  }
  .online-badge .dot, .bridge .dot {
    width: 6px; height: 6px; border-radius: 50%; background: #28c840; box-shadow: 0 0 7px #28c840;
  }
  .panel {
    position: absolute; top: 14px; right: 14px; bottom: 14px; width: 44%; min-width: 200px;
    display: flex; flex-direction: column; border-radius: 18px; overflow: hidden;
    background: linear-gradient(150deg, rgba(255, 255, 255, 0.95), rgba(244, 247, 255, 0.88));
    backdrop-filter: blur(22px); -webkit-backdrop-filter: blur(22px);
    border: 1px solid rgba(255, 255, 255, 0.85); box-shadow: 0 16px 40px rgba(10, 15, 40, 0.4);
  }
  .panel-glow {
    position: absolute; inset: 0; pointer-events: none;
    background: radial-gradient(120% 80% at 100% 0%, rgba(255, 150, 170, 0.16), transparent 50%),
      radial-gradient(120% 90% at 0% 100%, rgba(90, 150, 255, 0.16), transparent 55%);
  }
  .replies {
    position: relative; flex: 1; overflow: hidden; padding: 14px 13px 6px;
    display: flex; flex-direction: column; justify-content: flex-end; gap: 9px;
  }
  .row { display: flex; }
  .cbub { font-size: 12.5px; line-height: 1.45; animation: tiRise 0.35s ease both; }
  .cbub.user {
    max-width: 90%; padding: 9px 13px; border-radius: 15px; border-bottom-right-radius: 5px;
    background: #1085ef; color: #fff; box-shadow: 0 4px 14px rgba(16, 133, 239, 0.4);
  }
  .cbub.nalana {
    max-width: 92%; padding: 9px 13px; border-radius: 15px; border-bottom-left-radius: 5px;
    background: rgba(255, 255, 255, 0.92); border: 1px solid rgba(15, 23, 42, 0.07);
    color: #27303f; box-shadow: 0 1px 4px rgba(10, 15, 40, 0.05);
  }
  .input-wrap { position: relative; padding: 6px 11px 11px; flex-shrink: 0; }
  .input {
    display: flex; align-items: center; gap: 7px; background: rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(16, 133, 239, 0.25); border-radius: 100px; padding: 6px 6px 6px 14px;
    box-shadow: 0 1px 4px rgba(10, 15, 40, 0.06);
  }
  .input input {
    flex: 1; background: transparent; border: none; outline: none;
    font-family: 'Inter', sans-serif; font-size: 12.5px; color: #1a1a1a; min-width: 0;
  }
  .send {
    width: 30px; height: 30px; border-radius: 50%; border: none; background: #1085ef;
    box-shadow: 0 2px 10px rgba(16, 133, 239, 0.45);
    display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;
  }
  .bridge {
    display: flex; align-items: center; gap: 6px; margin-top: 8px; justify-content: flex-end;
  }
  .bridge span:last-child { font-size: 10px; color: #7a8090; }
  @keyframes tiRise {
    0% { opacity: 0; transform: translateY(10px); }
    12%, 100% { opacity: 1; transform: translateY(0); }
  }
</style>
