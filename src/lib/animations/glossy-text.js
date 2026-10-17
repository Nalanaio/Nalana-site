// @ts-nocheck
// Source: Grace's glossy-text.js. Glyph distance, bevel, and GLSL lighting math retained.
import { makeCanvas, ownGL } from './gpu-resources.js';

/** @param {{platform?:any,signal?:AbortSignal}} [options] */
export function createGlossyRenderer({ platform = {}, signal } = {}) {
  const document = platform.document || globalThis.document;
  const canvases = new Set();
  let dead = false;
  const releaseCanvas = c => { if (canvases.delete(c)) { c.width = 1; c.height = 1; c.remove(); } };
  const destroy = () => {
    if (dead) return;
    dead = true;
    signal?.removeEventListener('abort', destroy);
    scratch?.owner.destroy(); scratch = null;
    for (const c of [...canvases]) releaseCanvas(c);
  };
// Glossy solid renderings of text (the hero "3D" hover): a glyph silhouette gets
// a height field from its distance to the edge (a rounded bevel up to a flat
// face, or a full tube when inflated), then is shaded in WebGL as soft gloss.

const RES = 2;                        // analysis px per design px
const TS = 2.5;                       // surface render px per design px

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function canvas(w, h) {
  const c = makeCanvas(platform, document);
  canvases.add(c);
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  return c;
}
function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[y * w + clamp(x, 0, w - 1)];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / (2 * r + 1);
      acc += src[y * w + clamp(x + r + 1, 0, w - 1)] - src[y * w + clamp(x - r, 0, w - 1)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[clamp(y, 0, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / (2 * r + 1);
      acc += tmp[clamp(y + r + 1, 0, h - 1) * w + x] - tmp[clamp(y - r, 0, h - 1) * w + x];
    }
  }
  return out;
}
// Two-pass chamfer distance (in px) from each inside pixel to the nearest outside pixel.
function distanceField(A, w, h) {
  const INF = 1e9, d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = A[i] > 0.5 ? INF : 0;
  const a = 1, b = Math.SQRT2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (!d[i]) continue;
    let v = d[i];
    if (x > 0) v = Math.min(v, d[i - 1] + a);
    if (y > 0) { v = Math.min(v, d[i - w] + a); if (x > 0) v = Math.min(v, d[i - w - 1] + b); if (x < w - 1) v = Math.min(v, d[i - w + 1] + b); }
    d[i] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x; if (!d[i]) continue;
    let v = d[i];
    if (x < w - 1) v = Math.min(v, d[i + 1] + a);
    if (y < h - 1) { v = Math.min(v, d[i + w] + a); if (x < w - 1) v = Math.min(v, d[i + w + 1] + b); if (x > 0) v = Math.min(v, d[i + w - 1] + b); }
    d[i] = v;
  }
  return d;
}
/* ------------------------------------------------------------------ */
/* Letter analysis                                                     */
/* ------------------------------------------------------------------ */
// Draw a glyph as a puffy, rounded silhouette (a balloon pumped up from the letter).
function glyphMask({ text, font, weight = 700, size, W, H, rot = 0, skew = 0, puff = 0.06 }) {
  const MW = Math.ceil(W * RES), MH = Math.ceil(H * RES);
  const c = canvas(MW, MH);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.translate(MW / 2, MH / 2);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.transform(1, 0, Math.tan((skew * Math.PI) / 180), 1, 0, 0);
  ctx.font = `${weight} ${size * RES}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  const m = ctx.measureText(text);
  const dy = (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
  ctx.fillText(text, 0, dy);
  if (puff > 0) {
    // Inflate: blur the glyph, then re-threshold so corners round off like a balloon.
    const b = canvas(MW, MH);
    const bctx = b.getContext('2d', { willReadFrequently: true });
    bctx.filter = `blur(${size * RES * puff}px)`;
    bctx.drawImage(c, 0, 0);
    const img = bctx.getImageData(0, 0, MW, MH);
    const d = img.data;
    for (let i = 3; i < d.length; i += 4) d[i] = smooth(0.32, 0.52, d[i] / 255) * 255;
    bctx.putImageData(img, 0, 0);
    return { canvas: b, W, H, destroy: () => releaseCanvas(b) };
  }
  return { canvas: c, W, H, destroy: () => releaseCanvas(c) };
}

// Height: a quarter-round profile from the distance to the silhouette, rising
// over `bevel` px to a flat face, or over the whole stroke radius when inflated.
function heightMap({ canvas: src, W, H }, bevel) {
  const MW = src.width, MH = src.height, N = MW * MH;
  const d = src.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, MW, MH).data;
  const A = new Float32Array(N);
  for (let i = 0; i < N; i++) A[i] = d[i * 4 + 3] / 255;
  const dist = distanceField(A, MW, MH);
  let R = 0;
  for (let i = 0; i < N; i++) if (dist[i] > R) R = dist[i];
  R = bevel ? bevel * RES : Math.max(R * 0.92, 1);
  const tube = new Float32Array(N);
  for (let i = 0; i < N; i++) { const t = Math.min(dist[i] / R, 1); tube[i] = A[i] > 0.02 ? Math.sqrt(1 - (1 - t) * (1 - t)) * A[i] : 0; }
  const tubeS = boxBlur(tube, MW, MH, Math.max(1, Math.round(RES * 1.5)));
  const heightC = canvas(MW, MH);
  const hctx = heightC.getContext('2d');
  const img = hctx.createImageData(MW, MH);
  for (let i = 0; i < N; i++) {
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = clamp(tubeS[i], 0, 1) * 255;
    img.data[i * 4 + 3] = 255;
  }
  hctx.putImageData(img, 0, 0);
  return { W, H, MW, MH, TW: Math.round(W * TS), TH: Math.round(H * TS), heightC };
}

const VERT = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)) * 2.0 - 1.0;
  vUv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
  gl_Position = vec4(p, 0.0, 1.0);
}`;
const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uShape;
uniform vec2 uTexel;
uniform vec3 uColor;
const vec3 V = vec3(0.0, 0.0, 1.0);
vec3 shapeNormal(float k) {
  vec2 dx = vec2(uTexel.x * 2.0, 0.0), dy = vec2(0.0, uTexel.y * 2.0);
  float hx = texture(uShape, vUv + dx).r - texture(uShape, vUv - dx).r;
  float hy = texture(uShape, vUv + dy).r - texture(uShape, vUv - dy).r;
  return normalize(vec3(-hx * k, -hy * k, 1.0));
}
void main() {
  vec3 Ld = normalize(vec3(-0.4, -0.62, 0.67));
  vec3 col;
  {
    vec3 N = shapeNormal(8.0);
    vec3 base = uColor;
    float wrapL = clamp((dot(N, Ld) + 0.6) / 1.6, 0.0, 1.0);
    col = base * (0.66 + 0.46 * wrapL);
    col *= mix(0.8, 1.0, pow(N.z, 0.8));                                                  // gentle occlusion at the silhouette
    col = mix(col, base * vec3(0.84, 0.74, 0.9), smoothstep(0.45, 1.0, 1.0 - N.z) * 0.22); // richer colour in the curves
    col += base * 0.16 * smoothstep(0.0, 0.9, N.y);                                       // bounce light from below
    vec3 R = reflect(-V, N);
    vec3 env = mix(base * 0.9 + 0.1, vec3(0.97, 0.98, 1.0), clamp(-R.y * 0.5 + 0.5, 0.0, 1.0));
    float F = 0.04 + 0.96 * pow(1.0 - N.z, 5.0);
    col = mix(col, env, F * 0.2);
    vec3 L1 = normalize(vec3(-0.55, -0.72, 0.42));
    vec3 L2 = normalize(vec3(0.62, -0.28, 0.73));
    float s1 = smoothstep(0.76, 0.9, dot(R, L1));                                         // soft studio window
    float s2 = smoothstep(0.88, 0.95, dot(R, L2)) * 0.35;                                 // rim light
    float broad = pow(max(dot(R, L1), 0.0), 6.0) * 0.18;
    col += vec3(1.0) * (s1 * 0.6 + s2 + broad);
  }
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

let scratch = null;
function getGL() {
  if (dead || signal?.aborted) return null;
  if (scratch) return scratch;
  const c = canvas(512, 512);
  let owner;
  try {
    owner = ownGL(c, { premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false }, destroy);
    if (!owner) return null;
    const g = owner.gl;
    const prog = owner.program(VERT, FRAG);
    g.useProgram(prog);
    scratch = { owner, g, c, prog, texel: g.getUniformLocation(prog, 'uTexel'), color: g.getUniformLocation(prog, 'uColor') };
    return scratch;
  } catch { owner?.destroy(); return null; }
}

const hexToRGB = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

// A glossy image of a glyph mask, sized TS px per design px. With `bevel` (design
// px) the letter is a solid block with rounded bevelled edges; without, it is a
// fully inflated balloon.
function renderGlossy(mask, colorHex, { bevel = 0 } = {}) {
  const ctxGL = getGL();
  if (!ctxGL) return null;
  const { g, c } = ctxGL;
  const info = heightMap(mask, bevel);
  const { TW, TH } = info;
  if (c.width < TW || c.height < TH) { c.width = Math.max(c.width, TW); c.height = Math.max(c.height, TH); }
  g.viewport(0, 0, TW, TH);
  let t;
  try {
  t = ctxGL.owner.texture();
  g.activeTexture(g.TEXTURE0);
  g.bindTexture(g.TEXTURE_2D, t);
  g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, info.heightC);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
  g.uniform2f(ctxGL.texel, RES / info.MW, RES / info.MH);
  g.uniform3f(ctxGL.color, ...hexToRGB(colorHex));
  g.drawArrays(g.TRIANGLES, 0, 3);
  ctxGL.owner.deleteTexture(t);
  t = null;
  const out = canvas(TW, TH);
  const ctx = out.getContext('2d');
  ctx.drawImage(c, 0, c.height - TH, TW, TH, 0, 0, TW, TH);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(mask.canvas, 0, 0, TW, TH);
  return out;
  } catch { destroy(); return null; }
  finally { if (t) ctxGL.owner.deleteTexture(t); releaseCanvas(info.heightC); }
}

  signal?.addEventListener('abort', destroy, { once: true });
  if (signal?.aborted) destroy();
  return {
    glyphMask(options) { if (dead) return null; try { return glyphMask(options); } catch { destroy(); return null; } },
    renderGlossy(mask, color, options) {
      if (dead || !mask) return null;
      try { return renderGlossy(mask, color, options); } catch { destroy(); return null; }
    },
    get active() { return !dead; },
    destroy
  };
}
