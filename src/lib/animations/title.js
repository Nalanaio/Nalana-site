import { createGlossyRenderer } from './glossy-text.js';

// Pure source contour/simplification math. No DOM is read until an owned mount.
let nextTitleId = 0;
function traceContours(alpha, w, h, k) {
  const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h && alpha[(y * w + x) * 4 + 3] > 127;
  const next = new Map();
  const key = (x, y) => `${x},${y}`;
  const seg = (ax, ay, bx, by) => next.set(key(ax, ay), [bx, by]);
  // Edge midpoints are on a doubled grid; segments run with the inside on their right.
  for (let y = -1; y < h; y++) for (let x = -1; x < w; x++) {
    const c = (inside(x, y) ? 1 : 0) | (inside(x + 1, y) ? 2 : 0) | (inside(x + 1, y + 1) ? 4 : 0) | (inside(x, y + 1) ? 8 : 0);
    const T = [2 * x + 1, 2 * y], R = [2 * x + 2, 2 * y + 1], B = [2 * x + 1, 2 * y + 2], L = [2 * x, 2 * y + 1];
    switch (c) {
      case 1: seg(...L, ...T); break;      case 2: seg(...T, ...R); break;
      case 3: seg(...L, ...R); break;      case 4: seg(...R, ...B); break;
      case 5: seg(...L, ...T); seg(...R, ...B); break;
      case 6: seg(...T, ...B); break;      case 7: seg(...L, ...B); break;
      case 8: seg(...B, ...L); break;      case 9: seg(...B, ...T); break;
      case 10: seg(...T, ...R); seg(...B, ...L); break;
      case 11: seg(...B, ...R); break;     case 12: seg(...R, ...L); break;
      case 13: seg(...R, ...T); break;     case 14: seg(...T, ...L); break;
      default: break;
    }
  }
  const loops = [];
  for (const start of [...next.keys()]) {
    if (!next.has(start)) continue;
    const pts = [];
    let cur = start;
    while (next.has(cur)) {
      const [x, y] = cur.split(',').map(Number);
      pts.push({ x: x / 2 / k, y: y / 2 / k });
      const n = next.get(cur);
      next.delete(cur);
      cur = key(...n);
    }
    if (pts.length > 8) loops.push(pts);
  }
  return loops;
}
// Ramer–Douglas–Peucker on a closed loop: the surviving points read as a font's anchor nodes.
function simplifyLoop(pts, eps) {
  const rdp = (a, b, out) => {
    let md = 0, mi = -1;
    const A = pts[a], B = pts[b % pts.length], dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i].x - A.x) * dy - (pts[i].y - A.y) * dx) / len;
      if (d > md) { md = d; mi = i; }
    }
    if (md > eps) { rdp(a, mi, out); rdp(mi, b, out); } else out.push(A);
  };
  const out = [];
  const half = pts.length >> 1;
  rdp(0, half, out);
  rdp(half, pts.length, out);
  return out;
}


/** @param {HTMLElement} root @param {any} [options] */
export async function createTitleEffects(root, options = {}) {
  const doc = root.ownerDocument;
  const span3d = /** @type {HTMLElement} */ (root.querySelector('.tw-3d'));
  const ws = /** @type {HTMLElement} */ (root.querySelector('.tw-ws'));
  const host3d = span3d?.querySelector('.title-overlay');
  const hostWs = ws?.querySelector('.title-overlay');
  let destroyed = false;
  const owned = [];
  const surfaces = [];
  const layouts = [];
  let glossy = null;
  const alive = () => !destroyed && !options.signal?.aborted;
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    options.signal?.removeEventListener('abort', destroy);
    owned.splice(0).forEach((node) => node.remove());
    layouts.length = 0;
    surfaces.splice(0).forEach((canvas) => { canvas.width = canvas.height = 0; });
    glossy?.destroy();
    glossy = null;
    span3d?.classList.remove('has-block');
    ws?.classList.remove('has-pencil');
  };
  const handle = { destroy, resize() {
    if (!alive()) return;
    // The glyph silhouette remains the source glyph; resize its owned decorative copy
    // with the semantic word when responsive typography changes after font readiness.
    for (const item of layouts) {
      const sx = item.word.offsetWidth / item.w, sy = item.word.offsetHeight / item.h;
      if (!(sx > 0 && sy > 0)) continue;
      Object.assign(item.node.style, { left: `${-item.pad * sx}px`, top: `${-item.pad * sy}px`,
        width: `${(item.w + item.pad * 2) * sx}px`, height: `${(item.h + item.pad * 2) * sy}px` });
    }
  } };
  if (!alive() || !host3d || !hostWs) return handle;
  options.signal?.addEventListener('abort', destroy, { once: true });
  let fontAbort;
  try {
    const platform = options.platform || {};
    const fontReady = typeof platform.fontsReady === 'function' ? platform.fontsReady() : platform.fontsReady;
    const loaded = platform.loadFonts ? platform.loadFonts('700 56px Amulya') : doc.fonts?.load('700 56px Amulya');
    const fonts = Promise.all([loaded, fontReady ?? doc.fonts?.ready]);
    const abort = new Promise((resolve) => {
      fontAbort = () => resolve(null);
      options.signal?.addEventListener('abort', fontAbort, { once: true });
    });
    await Promise.race([fonts, abort]);
    if (!alive()) return handle;
    const computed = doc.defaultView?.getComputedStyle(span3d);
    const size = Number.parseFloat(computed?.fontSize || '56') || 56;
    const pad = 14;
    const w = span3d.offsetWidth, h = span3d.offsetHeight;
    if (w > 0 && h > 0) {
      try {
        glossy = createGlossyRenderer({ platform: { ...platform, document: doc }, signal: options.signal });
        const mask = glossy?.glyphMask({ text: '3D', font: 'Amulya', size, W: w + pad * 2, H: h + pad * 2, puff: 0 });
        const face = mask && glossy.renderGlossy(mask, '#d35fe6', { bevel: 4.2 });
        if (face && alive()) {
          const block = doc.createElement('canvas');
          surfaces.push(block);
          block.width = face.width; block.height = face.height;
          const bctx = block.getContext('2d');
          if (bctx) {
            const k = face.width / (w + pad * 2), depth = 5;
            bctx.filter = 'brightness(.55) saturate(1.15)';
            for (let d = depth; d > 0; d -= 0.5) bctx.drawImage(face, d * 0.55 * k, d * k);
            bctx.filter = 'none';
            bctx.drawImage(face, 0, 0);
            block.className = 'block-3d';
            Object.assign(block.style, { left: `${-pad}px`, top: `${-pad}px`, width: `${w + pad * 2}px`, height: `${h + pad * 2}px` });
            block.setAttribute('aria-hidden', 'true');
            if (alive()) { host3d.append(block); owned.push(block); layouts.push({ node: block, word: span3d, w, h, pad }); span3d.classList.add('has-block'); }
          }
        }
        mask?.destroy?.();
      } catch { /* A failed scratch renderer leaves the semantic word visible. */ }
      finally { glossy?.destroy(); glossy = null; }
    }
    if (!alive()) return handle;
    const text = options.workspaceText || ws.getAttribute('data-word') || 'workspace.';
    const W = ws.offsetWidth, H = ws.offsetHeight, P = 6;
    if (!(W > 0 && H > 0)) return handle;
    const wsSize = Number.parseFloat(doc.defaultView?.getComputedStyle(ws).fontSize || '56') || 56;
    const VW = W + P * 2, VH = H + P * 2, RK = 4;
    const c = doc.createElement('canvas');
    surfaces.push(c);
    c.width = Math.ceil(VW * RK); c.height = Math.ceil(VH * RK);
    const m = c.getContext('2d', { willReadFrequently: true });
    if (!m) return handle;
    m.font = `700 ${wsSize}px Amulya`;
    const fm = m.measureText(text);
    const ascent = fm.fontBoundingBoxAscent ?? fm.actualBoundingBoxAscent ?? wsSize * 0.8;
    const descent = fm.fontBoundingBoxDescent ?? fm.actualBoundingBoxDescent ?? wsSize * 0.2;
    const base = P + (H - (ascent + descent)) / 2 + ascent;
    m.scale(RK, RK);
    m.fillText(text, P, base);
    const loops = traceContours(m.getImageData(0, 0, c.width, c.height).data, c.width, c.height, RK);
    const nodes = loops.flatMap((loop) => {
      let last = null;
      return simplifyLoop(loop, 1.6).filter((n) => {
        if (last && Math.hypot(n.x - last.x, n.y - last.y) < 4) return false;
        last = n;
        return true;
      });
    });
    c.width = c.height = 0;
    if (!alive()) return handle;
    const NS = 'http://www.w3.org/2000/svg';
    const id = `nalana-pencil-grain-${++nextTitleId}`;
    const svg = doc.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'pencil'); svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('viewBox', `0 0 ${VW} ${VH}`);
    Object.assign(svg.style, { left: `${-P}px`, top: `${-P}px`, width: `${VW}px`, height: `${VH}px` });
    const defs = doc.createElementNS(NS, 'defs');
    const filter = doc.createElementNS(NS, 'filter');
    for (const [name, value] of Object.entries({ id, x: '-5%', y: '-5%', width: '110%', height: '110%' })) filter.setAttribute(name, value);
    const noise = doc.createElementNS(NS, 'feTurbulence');
    for (const [name, value] of Object.entries({ type: 'fractalNoise', baseFrequency: '1.4', numOctaves: '2', seed: '3' })) noise.setAttribute(name, value);
    const displacement = doc.createElementNS(NS, 'feDisplacementMap');
    displacement.setAttribute('in', 'SourceGraphic'); displacement.setAttribute('scale', '0.7');
    filter.append(noise, displacement); defs.append(filter);
    const line = doc.createElementNS(NS, 'text');
    for (const [name, value] of Object.entries({ class: 'pc-line', x: String(P), y: String(base), 'font-family': 'Amulya, Inter, sans-serif', 'font-weight': '700', 'font-size': String(wsSize), filter: `url(#${id})` })) line.setAttribute(name, value);
    line.textContent = text;
    const group = doc.createElementNS(NS, 'g'); group.setAttribute('class', 'pc-nodes');
    const order = nodes.sort((a, b) => a.x - b.x);
    order.forEach((n, r) => {
      const rect = doc.createElementNS(NS, 'rect');
      for (const [name, value] of Object.entries({ class: 'pc-node', x: (n.x - 0.9).toFixed(2), y: (n.y - 0.9).toFixed(2), width: '1.8', height: '1.8' })) rect.setAttribute(name, value);
      rect.style.setProperty('--d', `${(0.25 + (r / order.length) * 0.75).toFixed(3)}s`);
      group.append(rect);
    });
    svg.append(defs, line, group);
    if (alive()) { hostWs.append(svg); owned.push(svg); layouts.push({ node: svg, word: ws, w: W, h: H, pad: P }); ws.classList.add('has-pencil'); }
  } catch { /* Font/canvas failures remain decorative and do not change heading text. */ }
  finally { options.signal?.removeEventListener('abort', fontAbort); }
  return handle;
}
