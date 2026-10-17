// Source geometry, cropping and conveyor math adapted from Grace's pinned design.
// Browser resources belong to one controller root; this module is safe to import during SSR.
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const easeOutBack = (t) => { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const DESIGN_W = 1440;
const HERO_H = 1200;
export const HERO_OBJECTS = [
  { name: 'Squiggle tool', slot: 4, lane: -0.5, src: '/assets/site/squiggle-tool.png', box: [407, 318, 415.712, 416.597], inner: [415.209, 416.094], rot: 0.07 },
  { name: 'Wicker chair', slot: 3, lane: 0.5, src: '/assets/site/wicker-chair.png', box: [698, 28, 468.849, 512.219], inner: [333, 415], rot: 23.04, crop: [-132.27, -15.84, 321.07, 144.97] },
  { name: 'Lounge chair', slot: 5, lane: 0.5, src: '/assets/site/lounge-chair.png', box: [430.42, 658.73, 406.119, 510.733], inner: [355.595, 474.126], rot: -6.39 },
  { name: 'Heart', slot: 9, lane: -0.5, src: '/assets/site/heart.png', box: [1101, 115, 249.925, 277.132], inner: [209, 243], rot: 10.54, crop: [-10.3, -41.18, 125.25, 191.71] },
  { name: 'Brush head', slot: 8, lane: 0.5, src: '/assets/site/brush-head.png', box: [1117, -115, 592.84, 609.634], inner: [381, 476], rot: -37.82 },
  { name: 'Carrot', slot: 0, lane: -0.4, src: '/assets/site/carrot.png', box: [129, 574, 561.682, 561.682], inner: [424, 424], rot: 24.51 },
  { name: 'Mug', slot: 6, lane: -0.5, src: '/assets/site/mug.png', box: [791.07, 532.69, 309.85, 277.842], inner: [272, 232], rot: 10.54, crop: [-38.7, -45.47, 177.92, 209.03] },
  { name: 'Headphones', slot: 7, lane: -0.15, src: '/assets/site/headphones.png', box: [-220, 704, 587.672, 684.495], inner: [485, 606], rot: 10.54 },
  { name: 'Plane', slot: 1, lane: 0.5, src: '/assets/site/plane.png', box: [1040.86, 254.48, 743.434, 465.766], inner: [692, 345], rot: 10.54, crop: [-28.78, -16.5, 128.86, 145.45] },
  { name: 'Shopping cart', slot: 2, lane: -0.2, src: '/assets/site/cart.png', box: [-10, 523, 439.845, 323.072], inner: [417, 289], rot: -4.83, crop: [-38.37, -46.37, 180.34, 146.37] },
];

const RIVER_CENTER = { x: 719.5, y: 601.5 };
const RIVER_ROT = (10.54 * Math.PI) / 180;
const RIVER_LINE = (() => {
  const src = [
    [-330, 1760, 480], [-215, 1420, 480], [-151, 1187, 609], [-85, 1091, 669], [2, 1024, 693], [113, 990, 654],
    [224, 954, 642], [332, 916, 642], [434, 870, 651], [528, 812, 672], [616, 746, 651], [698, 671, 585],
    [770, 584, 480], [842, 495, 372], [934, 435, 348], [1030, 380, 372], [1118, 315, 435], [1197, 235, 537],
    [1266, 144, 657], [1326, 39, 738], [1436, 3, 591], [1508, -85, 588], [1595, -152, 594], [1820, -430, 594],
  ];
  const c = Math.cos(RIVER_ROT), sn = Math.sin(RIVER_ROT);
  let pts = src.map(([x, y, w]) => {
    const dx = x - RIVER_CENTER.x, dy = y + 9 - RIVER_CENTER.y; // the vector also moved down 9px
    return [RIVER_CENTER.x + dx * c - dy * sn, RIVER_CENTER.y + dx * sn + dy * c, w];
  });
  for (let pass = 0; pass < 3; pass++) {
    pts = pts.map((q, i) => (i === 0 || i === pts.length - 1 ? q : [0, 1, 2].map((k) => (pts[i - 1][k] + 2 * q[k] + pts[i + 1][k]) / 4)));
  }
  return pts;
})();
function buildPath(pts) {
  const cr = (p0, p1, p2, p3, t, k) => {
    const t2 = t * t, t3 = t2 * t;
    return 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
  };
  const samples = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, pts.length - 1)];
    for (let t = 0; t < 1; t += 1 / 40) samples.push([cr(p0, p1, p2, p3, t, 0), cr(p0, p1, p2, p3, t, 1), lerp(p1[2], p2[2], t)]);
  }
  samples.push(pts[pts.length - 1]);
  const lens = [0];
  for (let i = 1; i < samples.length; i++) lens.push(lens[i - 1] + Math.hypot(samples[i][0] - samples[i - 1][0], samples[i][1] - samples[i - 1][1]));
  const length = lens[lens.length - 1];
  return {
    length,
    at(s) {
      s = clamp(s, 0, length);
      let lo = 0, hi = lens.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (lens[m] < s) lo = m; else hi = m; }
      const seg = lens[hi] - lens[lo] || 1, t = (s - lens[lo]) / seg;
      const a = samples[lo], b = samples[hi];
      const tx = (b[0] - a[0]) / seg, ty = (b[1] - a[1]) / seg;
      return { x: lerp(a[0], b[0], t), y: lerp(a[1], b[1], t), nx: -ty, ny: tx, half: lerp(a[2], b[2], t) / 2 };
    },
    nearest(x, y) {
      let best = 0, bd = Infinity;
      for (let i = 0; i < samples.length; i++) {
        const d = (samples[i][0] - x) ** 2 + (samples[i][1] - y) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
      return lens[best];
    },
  };
}

// A drift line at a fixed fraction of the channel half-width, smoothed so it has
// no tight kinks, and parametrised by its own arc length so an object moving along
// it at constant speed never stalls on the inside of a bend or surges on the outside.
function lanePath(path, lane) {
  const STEP = 2;
  let pts = [];
  for (let s = 0; s <= path.length; s += STEP) {
    const p = path.at(s);
    pts.push([p.x + p.nx * lane * p.half, p.y + p.ny * lane * p.half]);
  }
  const R = 40; // moving-average radius in samples (~80px)
  for (let pass = 0; pass < 2; pass++) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      let x = 0, y = 0, n = 0;
      for (let j = Math.max(0, i - R); j <= Math.min(pts.length - 1, i + R); j++) { x += pts[j][0]; y += pts[j][1]; n++; }
      out.push([x / n, y / n]);
    }
    pts = out;
  }
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return {
    length: cum[cum.length - 1],
    fromS: (s) => cum[clamp(Math.round(s / STEP), 0, cum.length - 1)],
    at(l) {
      l = clamp(l, 0, cum[cum.length - 1]);
      let lo = 0, hi = cum.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] < l) lo = m; else hi = m; }
      const t = (l - cum[lo]) / (cum[hi] - cum[lo] || 1);
      return { x: lerp(pts[lo][0], pts[hi][0], t), y: lerp(pts[lo][1], pts[hi][1], t) };
    },
  };
}


/** @param {HTMLElement} root @param {any} [options] */
export function createHero(root, options = {}) {
  const doc = root.ownerDocument;
  const hero = root.querySelector('.hero') || root;
  const objectsLayer = root.querySelector('.objects-layer');
  if (!objectsLayer || options.signal?.aborted) return { update() {}, resize() {}, setWater() {}, destroy() {} };
  let destroyed = false;
  let reduceMotion = !!options.reducedMotion;
  let finePointer = false;
  let heroS = 1;
  let heroWater = options.water;
  const pointer = { cx: -1e4, cy: -1e4 };
  const owned = doc.createElement('div');
  owned.className = 'hero-objects-enhancement';
  owned.setAttribute('aria-hidden', 'true');
  Object.assign(owned.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
  const fallback = [...objectsLayer.querySelectorAll('.hero-object-static')].filter((el) => el instanceof doc.defaultView.HTMLElement);
  const fallbackVisibility = fallback.map((el) => el.style.visibility);
  const cleanups = [];
  const path = buildPath(RIVER_LINE);
/** @param {any} def */
function objectVisual(def) {
  const rotEl = doc.createElement('div');
  rotEl.className = 'obj-rot';
  rotEl.style.transform = `rotate(${def.rot}deg)`;
  const inner = doc.createElement('div');
  inner.className = 'obj-inner';
  inner.style.width = `${def.inner[0]}px`;
  inner.style.height = `${def.inner[1]}px`;
  const img = doc.createElement('img');
  img.src = def.src;
  img.alt = '';
  img.draggable = false;
  img.decoding = 'async';
  if (def.crop) {
    const [l, t, w, h] = def.crop;
    Object.assign(img.style, { left: `${l}%`, top: `${t}%`, width: `${w}%`, height: `${h}%` });
  } else {
    img.className = 'cover';
  }
  inner.append(img);
  rotEl.append(inner);
  return { rotEl, img };
}

// Alpha mask per object so hover only triggers over visible pixels.
/** @param {any} o */
function makeHitMask(o) {
  const k = 0.25;
  const [, , W, H] = o.box;
  const [w, h] = o.inner;
  const c = doc.createElement('canvas');
  c.width = Math.ceil(W * k); c.height = Math.ceil(H * k);
  try {
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  ctx.scale(k, k);
  ctx.translate(W / 2, H / 2);
  ctx.rotate((o.rot * Math.PI) / 180);
  ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); ctx.clip();
  const img = o.img;
  if (o.crop) {
    const [l, t, cw, ch] = o.crop;
    ctx.drawImage(img, -w / 2 + (l / 100) * w, -h / 2 + (t / 100) * h, (cw / 100) * w, (ch / 100) * h);
  } else {
    const ia = img.naturalWidth / img.naturalHeight, ba = w / h;
    let dw = w, dh = h;
    if (ia > ba) dw = h * ia; else dh = w / ia;
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  }
  try {
    o.mask = { k, w: c.width, h: c.height, d: ctx.getImageData(0, 0, c.width, c.height).data };
  } catch {
    o.mask = null; // tainted canvas (e.g. opened via file://) — fall back to an ellipse test
  }
  } finally { c.width = c.height = 0; }
}

/** @param {any} o */
function hitTest(o, px, py, generous) {
  const [, , W, H] = o.box;
  const sc = 1 + 0.04 * o.lift;
  const lx = (px - o.x) / sc + W / 2;
  const ly = (py - (o.y - 22 * o.lift)) / sc + H / 2;
  if (lx < 0 || ly < 0 || lx >= W || ly >= H) return false;
  if (o.mask) {
    const { k, w, h, d } = o.mask;
    const cx = Math.floor(lx * k), cy = Math.floor(ly * k);
    const rad = generous ? 3 : 0;
    for (let yy = Math.max(0, cy - rad); yy <= Math.min(h - 1, cy + rad); yy++) {
      for (let xx = Math.max(0, cx - rad); xx <= Math.min(w - 1, cx + rad); xx++) {
        if (d[(yy * w + xx) * 4 + 3] > 40) return true;
      }
    }
    return false;
  }
  const a = (-o.rot * Math.PI) / 180;
  const dx = lx - W / 2, dy = ly - H / 2;
  const rx = dx * Math.cos(a) - dy * Math.sin(a), ry = dx * Math.sin(a) + dy * Math.cos(a);
  return (rx / (o.inner[0] * 0.42)) ** 2 + (ry / (o.inner[1] * 0.42)) ** 2 < 1;
}

const LOOP = 2351;
const SLOT = LOOP / HERO_OBJECTS.length;

/** @param {any} def */
function makeInstance(def, i, k) {
  const [, , W, H] = def.box;
  const el = doc.createElement('div');
  el.className = 'obj';
  el.style.width = `${W}px`;
  el.style.height = `${H}px`;
  el.style.zIndex = i + 1;
  el.style.visibility = 'hidden';
  const shadow = doc.createElement('div');
  shadow.className = 'obj-shadow';
  const sw = def.inner[0] * 0.72, sh = Math.min(def.inner[1] * 0.2, 110);
  Object.assign(shadow.style, { width: `${sw}px`, height: `${sh}px`, marginLeft: `${-sw / 2}px`, marginTop: `${def.inner[1] * 0.3 - sh / 2}px` });
  const liftEl = doc.createElement('div');
  liftEl.className = 'obj-lift';
  const { rotEl, img } = objectVisual(def);
  liftEl.append(rotEl);
  el.append(shadow, liftEl);
  owned.append(el);
  return {
    ...def, k, el, shadow, liftEl, rotEl, img, x: 0, y: 0, lift: 0, phase: i * 1.7 + k * 2.3,
    drop: reduceMotion ? 1 : 0, dropDelay: 0.25 + def.slot * 0.09, splashed: reduceMotion,
    nextWake: 2 + Math.random() * 3, mask: null, away: true,
  };
}

const objs = [];
const defs = HERO_OBJECTS.map((def, i) => {
  // Each object drifts along its own lane: a fixed fraction of the channel's
  // half-width, so it follows the banks through every bend.
  const [L, T, W, H] = def.box;
  const lp = lanePath(path, def.lane);
  const s0 = lp.fromS(path.nearest(L + W / 2, T + H / 2));
  // Stretch of the lane where the object's box overlaps the frame.
  const pad = 12;
  const visible = (l) => {
    const { x, y } = lp.at(l);
    return x + W / 2 > -pad && x - W / 2 < DESIGN_W + pad && y + H / 2 > -pad && y - H / 2 < HERO_H + pad;
  };
  let first = -1, last = -1;
  for (let l = 0; l <= lp.length; l += 4) if (visible(l)) { if (first < 0) first = l; last = l; }
  // Two instances: repeats alternate between them, so each keeps its own hover/lift state.
  const inst = [makeInstance(def, i, 0), makeInstance(def, i, 1)];
  objs.push(...inst);
  const onLoad = () => {
    if (destroyed || options.signal?.aborted) return;
    try { makeHitMask(inst[0]); inst[1].mask = inst[0].mask; } catch { /* Keep the ellipse fallback on allocation/readback failure. */ }
  };
  if (inst[0].img.complete && inst[0].img.naturalWidth) onLoad();
  else { inst[0].img.addEventListener('load', onLoad, { once: true }); cleanups.push(() => inst[0].img.removeEventListener('load', onLoad)); }
  return { ...def, lp, s0, sEnter: Math.max(0, first - 4), sExit: Math.min(lp.length, last + 4), inst };
});
// Start the conveyor where it best matches the Figma composition.
const wrapD = (v) => ((v % LOOP) + LOOP * 1.5) % LOOP - LOOP / 2;
let start = 0, bestErr = Infinity;
for (let off = 0; off < LOOP; off += 4) {
  const err = defs.reduce((a, d) => a + wrapD(d.slot * SLOT + off - d.s0) ** 2, 0);
  if (err < bestErr) { bestErr = err; start = off; }
}
let travel = 0;  // distance the conveyor has moved (design px)
let introSet = false;

let hovered = null;
function heroLocal(clientX, clientY) {
  const r = objectsLayer.getBoundingClientRect();
  return { x: (clientX - r.left) / heroS, y: (clientY - r.top) / heroS };
}
function blockedByUI(clientX, clientY) {
  const el = doc.elementFromPoint(clientX, clientY);
  return !el || !hero.contains(el) || !!el.closest('a, button, input, select, textarea, [role=dialog], .nav, .trusted, .tw');
}
function pickObject() {
  if (!finePointer || reduceMotion) return null;
  const hr = hero.getBoundingClientRect();
  if (pointer.cx < hr.left || pointer.cx > hr.right || pointer.cy < hr.top || pointer.cy > hr.bottom) return null;
  if (blockedByUI(pointer.cx, pointer.cy)) return null;
  const p = heroLocal(pointer.cx, pointer.cy);
  const order = [...objs].sort((a, b) => b.el.style.zIndex - a.el.style.zIndex);
  for (const o of order) {
    if (o.drop < 0.9 || o.away) continue;
    if (hitTest(o, p.x, p.y, o === hovered)) return o;
  }
  return null;
}
/** @param {any} o */
function setHover(o) {
  if (hovered === o) return;
  if (hovered) hovered.el.classList.remove('is-hover');
  hovered = o;
  if (o) o.el.classList.add('is-hover');
  hero.classList.toggle('is-object-hover', !!o);
}

let time = 0;
function updateHero(dt) {
  time += dt;
  setHover(pickObject());

  if (!reduceMotion) travel += 11 * dt;
  // Place every repeat of every slot that is inside the frame on its instance.
  for (const d of defs) {
    const base = d.slot * SLOT + start + travel;
    const nMin = Math.ceil((d.sEnter - base) / LOOP), nMax = Math.floor((d.sExit - base) / LOOP);
    for (const o of d.inst) {
      let s = null;
      for (let n = nMin; n <= nMax; n++) if (((n % 2) + 2) % 2 === o.k) { s = base + n * LOOP; break; }
      const away = s === null;
      if (away !== o.away) {
        o.away = away;
        o.el.style.visibility = away ? 'hidden' : '';
        if (away && hovered === o) setHover(null);
      }
      if (away) continue;
      const p = d.lp.at(s);
      o.x = p.x;
      o.y = p.y;
    }
  }

  // Only what is on screen at load drops in; later repeats simply drift into view.
  if (!introSet) {
    introSet = true;
    for (const o of objs) if (o.away) { o.drop = 1; o.splashed = true; }
  }

  for (const o of objs) {
    if (o.away) continue;
    if (reduceMotion) { o.drop = 1; o.splashed = true; o.lift = 0; }
    // Intro: objects drop onto the water one by one.
    if (o.drop < 1) {
      o.dropDelay -= dt;
      if (o.dropDelay <= 0) o.drop = Math.min(1, o.drop + dt / 1.1);
      if (!o.splashed && o.drop > 0.55) {
        o.splashed = true;
        heroWater?.addAt(o.x, o.y + o.inner[1] * 0.3, { r: 220, dur: 2.4, a: 0.8, lw: 3 });
      }
    }

    o.lift = damp(o.lift, o === hovered ? 1 : 0, 8, dt);
    const bob = reduceMotion ? 0 : Math.sin(time * 0.9 + o.phase) * 6 * (1 - o.lift);
    const sway = reduceMotion ? 0 : Math.sin(time * 0.55 + o.phase * 1.3) * 2.4 * (1 - o.lift);

    const dropT = clamp(o.drop, 0, 1);
    const dropY = reduceMotion ? 0 : (1 - easeOutBack(dropT)) * -260;
    const opacity = clamp(dropT * 2.2, 0, 1);

    const [, , W, H] = o.box;
    o.el.style.transform = `translate3d(${o.x - W / 2}px, ${o.y - H / 2 + bob}px, 0)`;
    o.el.style.opacity = opacity;
    o.liftEl.style.transform = `translate3d(0, ${-22 * o.lift + dropY}px, 0) scale(${1 + 0.04 * o.lift})`;
    o.rotEl.style.transform = `rotate(${o.rot + sway}deg)`;
    const sh = 1 + 0.3 * o.lift - bob * 0.01;
    o.shadow.style.transform = `translateY(${-bob * 0.6}px) scale(${sh}, ${sh * 0.9})`;
    o.shadow.style.opacity = clamp(1 - 0.45 * o.lift, 0.25, 1) * clamp(dropT * 1.4 - 0.4, 0, 1);

    // Wake rings while floating.
    if (o.drop >= 1 && !reduceMotion) {
      o.nextWake -= dt;
      if (o.nextWake <= 0) {
        o.nextWake = 2.4 + Math.random() * 2.6;
        if (opacity > 0.5) heroWater?.addAt(o.x, o.y + o.inner[1] * 0.3 + bob, { r: 110, dur: 2.6, a: 0.38, lw: 1.6 });
      }
    }
  }
}


  // The SSR art remains visible until this complete, source-positioned static frame exists.
  for (const o of objs) {
    const [L, T] = o.box;
    o.el.style.visibility = o.k === 0 ? '' : 'hidden';
    o.el.style.opacity = '1';
    o.el.style.transform = `translate3d(${L}px, ${T}px, 0)`;
  }
  objectsLayer.append(owned);
  fallback.forEach((el) => { el.style.visibility = 'hidden'; });
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    options.signal?.removeEventListener('abort', destroy);
    cleanups.splice(0).forEach((fn) => fn());
    hovered = null;
    hero.classList.remove('is-object-hover');
    owned.remove();
    fallback.forEach((el, i) => { el.style.visibility = fallbackVisibility[i]; });
    for (const o of objs) { o.mask = null; o.img.removeAttribute('src'); }
    objs.length = 0;
    defs.length = 0;
    heroWater = null;
  };
  options.signal?.addEventListener('abort', destroy, { once: true });
  return {
    /** @param {any} [state] */
    update(dt, state = {}) {
      if (destroyed || options.signal?.aborted) return;
      reduceMotion = !!state.reducedMotion;
      finePointer = !!state.finePointer;
      if (state.pointer) {
        pointer.cx = state.pointer.cx ?? state.pointer.x ?? -1e4;
        pointer.cy = state.pointer.cy ?? state.pointer.y ?? -1e4;
      }
      updateHero(reduceMotion ? 0 : Math.min(Math.max(dt || 0, 0), 0.05));
    },
    resize({ scale = 1 } = {}) { if (!destroyed && scale > 0) heroS = scale; },
    setWater(water) { if (!destroyed) heroWater = water; },
    destroy,
  };
}
