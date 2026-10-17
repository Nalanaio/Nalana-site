// @ts-nocheck
// Source: Grace's nalana-textures.js; original material, lighting, growth and sprite math.
import { makeCanvas, ownGL } from './gpu-resources.js';

/** @param {{host:any,img:any,getScale?:()=>number,platform?:any,signal?:AbortSignal,onInvalidate?:()=>void}} options */
export function createMaterials({ host, img, getScale = () => 1, platform = {}, signal, onInvalidate = () => {} } = {}) {
  const document = host.ownerDocument || platform.document;
  const canvases = new Set(), images = new Set(), gpuOwners = new Set();
  const cancellation = new AbortController();
  const originalOpacity = img.style.opacity;
  let dead = false, reduceMotion = false, clearState = () => {};
  const live = () => !dead && !signal?.aborted;
  const destroy = () => {
    if (dead) return;
    dead = true;
    signal?.removeEventListener('abort', destroy);
    cancellation.abort();
    for (const owner of gpuOwners) owner.destroy();
    gpuOwners.clear();
    for (const c of canvases) { c.remove(); c.width = 1; c.height = 1; }
    canvases.clear(); images.clear(); clearState();
    host.classList.remove('is-hover'); img.style.opacity = originalOpacity;
  };
// Footer "floating Nalana": on hover a random real-world material grows out
// of the balloon letters (sky, forest or flowers), then idles.
//
// Surfaces are rendered in WebGL from photographed CC0 textures (albedo +
// normal maps) lit by the balloon's own 3D form. Photographed cut-outs (ivy, daisies, a honey bee,
// butterflies, cloud wisps) are animated on top and spill past the
// silhouette. Asset credits: assets/materials/CREDITS.md.

const W = 321.28, H = 409.35;         // letter box, Figma design px
const MW = 322, MH = 410;             // analysis resolution (~1 unit per design px)
const TS = 2;                         // surface render resolution multiplier
const TW = Math.round(W * TS), TH = Math.round(H * TS);
const PAD = 0.45;                     // canvas overflow around the letters
const ENTER_S = 1.0, EXIT_S = 0.6;    // transition durations (s)
const FRONT = 0.14;                   // width of the growth front in reveal-field units
const M = '/assets/site/materials/';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(hash2(xi, yi), hash2(xi + 1, yi), u), lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v);
}
function fbm(x, y) {
  let s = 0, a = 0.5, f = 1;
  for (let o = 0; o < 4; o++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; }
  return s / 0.9375;
}
// Smooth wander in roughly [-1, 1] for organic flight paths.
const wander = (t, seed) => (vnoise(t, seed * 17.3) * 2 - 1) * 0.7 + (vnoise(t * 2.3, seed * 5.1 + 40) * 2 - 1) * 0.3;

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
const loadImage = (src) => {
  if (!live()) return Promise.reject(new Error('Materials destroyed'));
  if (platform.loadImage) return Promise.resolve(platform.loadImage(src, { signal: cancellation.signal })).then(image => {
    if (!live()) throw new Error('Materials destroyed');
    images.add(image); return image;
  });
  return new Promise((resolve, reject) => {
    const image = new (document.defaultView.Image)();
    images.add(image); image.decoding = 'async';
    const clean = () => { image.onload = null; image.onerror = null; cancellation.signal.removeEventListener('abort', aborted); };
    const aborted = () => { clean(); image.src = ''; reject(new Error('Material image aborted')); };
    image.onload = () => { clean(); if (live()) resolve(image); else reject(new Error('Materials destroyed')); };
    image.onerror = () => { clean(); reject(new Error('Material image unavailable')); };
    cancellation.signal.addEventListener('abort', aborted, { once: true });
    image.src = src;
  });
};
function pixels(img, w = img.naturalWidth || img.width, h = img.naturalHeight || img.height) {
  const c = canvas(w, h);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  return { c, ctx, data: ctx.getImageData(0, 0, c.width, c.height) };
}

/* ------------------------------------------------------------------ */
/* Letter analysis                                                     */
/* ------------------------------------------------------------------ */
function analyse(img) {
  const { data } = pixels(img, MW, MH);
  const d = data.data;
  const N = MW * MH;
  const A = new Float32Array(N), L = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    A[i] = d[i * 4 + 3] / 255;
    L[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255;
  }
  const alphaAt = (x, y) => {
    const xi = Math.round(x), yi = Math.round(y);
    return xi < 0 || yi < 0 || xi >= MW || yi >= MH ? 0 : A[yi * MW + xi];
  };

  // Shading map: local highlights/shadows of the balloon (hue-independent),
  // darkened toward the silhouette for volume. 0.5 = neutral for hard-light.
  const LA = new Float32Array(N);
  for (let i = 0; i < N; i++) LA[i] = L[i] * A[i];
  const bLA = boxBlur(LA, MW, MH, 10), bA = boxBlur(A, MW, MH, 10), bA6 = boxBlur(A, MW, MH, 5);
  const shade = canvas(MW, MH);
  const sctx = shade.getContext('2d');
  const sImg = sctx.createImageData(MW, MH);
  const shadeV = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const local = bA[i] > 0.01 ? bLA[i] / bA[i] : L[i];
    shadeV[i] = clamp(0.5 + (L[i] - local) * 1.9 - (1 - bA6[i]) * 0.22, 0.2, 0.82);
    const v = shadeV[i] * 255;
    sImg.data[i * 4] = sImg.data[i * 4 + 1] = sImg.data[i * 4 + 2] = v;
    sImg.data[i * 4 + 3] = A[i] * 255;
  }
  sctx.putImageData(sImg, 0, 0);

  // Height field for surface normals: soft domes over each puffy letter.
  const b7 = boxBlur(A, MW, MH, 7), b3 = boxBlur(A, MW, MH, 3);
  const heightC = canvas(MW, MH);
  const hctx = heightC.getContext('2d');
  const hImg = hctx.createImageData(MW, MH);
  for (let i = 0; i < N; i++) {
    const h = clamp(0.55 * b7[i] + 0.45 * b3[i], 0, 1) * 255;
    hImg.data[i * 4] = hImg.data[i * 4 + 1] = hImg.data[i * 4 + 2] = h;
    hImg.data[i * 4 + 3] = 255;
  }
  hctx.putImageData(hImg, 0, 0);

  // Silhouette edge points with outward normals.
  const edges = [];
  const taken = new Set();
  for (let y = 3; y < MH - 3; y += 2) {
    for (let x = 3; x < MW - 3; x += 2) {
      const a = A[y * MW + x];
      if (a < 0.5) continue;
      if (Math.min(A[y * MW + x - 3], A[y * MW + x + 3], A[(y - 3) * MW + x], A[(y + 3) * MW + x]) >= 0.5) continue;
      const key = `${Math.floor(x / 3)},${Math.floor(y / 3)}`;
      if (taken.has(key)) continue;
      taken.add(key);
      const gx = A[y * MW + x + 2] - A[y * MW + x - 2];
      const gy = A[(y + 2) * MW + x] - A[(y - 2) * MW + x];
      const len = Math.hypot(gx, gy) || 1;
      edges.push({ x, y, nx: -gx / len, ny: -gy / len });
    }
  }

  const inside = (rand, thr = 0.6) => {
    for (let k = 0; k < 400; k++) {
      const x = rand() * W, y = rand() * H;
      if (alphaAt(x, y) > thr) return { x, y };
    }
    return { x: W / 2, y: H / 2 };
  };

  const noise = new Float32Array(N);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) noise[y * MW + x] = fbm(x * 0.028, y * 0.028);

  const shadeAt = (x, y) => shadeV[clamp(Math.round(y), 0, MH - 1) * MW + clamp(Math.round(x), 0, MW - 1)];
  return { A, alphaAt, shade, shadeAt, heightC, edges, inside, noise };
}

/* ------------------------------------------------------------------ */
/* Sprite preparation from photographed cut-outs                        */
/* ------------------------------------------------------------------ */
// Combine a colour photo with its opacity map into an RGBA canvas.
function withOpacity(colorImg, opacityImg, size = 1024) {
  const col = pixels(colorImg, size, size);
  const op = pixels(opacityImg, size, size).data.data;
  const d = col.data.data;
  for (let i = 0; i < d.length; i += 4) d[i + 3] = op[i];
  col.ctx.putImageData(col.data, 0, 0);
  return col;
}
// Tight bounding boxes of the opaque island inside each grid cell.
function cellSprites(src, cols, rows, thr = 128) {
  const { c, data } = src;
  const w = c.width, h = c.height, d = data.data;
  const out = [];
  for (let r = 0; r < rows; r++) {
    for (let q = 0; q < cols; q++) {
      const x0 = Math.floor((q * w) / cols), x1 = Math.floor(((q + 1) * w) / cols);
      const y0 = Math.floor((r * h) / rows), y1 = Math.floor(((r + 1) * h) / rows);
      let minX = x1, minY = y1, maxX = x0, maxY = y0;
      for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
        if (d[(y * w + x) * 4 + 3] > thr) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
      }
      if (maxX <= minX || maxY <= minY) continue;
      const s = canvas(maxX - minX + 4, maxY - minY + 4);
      s.getContext('2d').drawImage(c, minX - 2, minY - 2, s.width, s.height, 0, 0, s.width, s.height);
      out.push(s);
    }
  }
  return out;
}

// Tint white petals while keeping the yellow centres.
function tintPetals(src, [tr, tg, tb]) {
  const c = canvas(src.width, src.height);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const sat = mx ? (mx - mn) / mx : 0;
    const k = 1 - smooth(0.12, 0.35, sat); // petals are unsaturated
    d[i] = lerp(r, r * tr, k); d[i + 1] = lerp(g, g * tg, k); d[i + 2] = lerp(b, b * tb, k);
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
// Key a specimen photographed on black: luminance -> alpha (wings stay translucent).
function keyBlack(img) {
  const p = pixels(img);
  const d = p.data.data;
  for (let i = 0; i < d.length; i += 4) {
    const m = Math.max(d[i], d[i + 1], d[i + 2]) / 255;
    const a = smooth(0.07, 0.26, m);
    d[i + 3] = a * 255;
    if (a > 0.01 && a < 1) { // lift the black matte out of the fringe
      const k = 0.35 + 0.65 * a;
      d[i] = Math.min(255, d[i] / k); d[i + 1] = Math.min(255, d[i + 1] / k); d[i + 2] = Math.min(255, d[i + 2] / k);
    }
  }
  p.ctx.putImageData(p.data, 0, 0);
  return p.c;
}
// Split a top-down insect into body + left/right wing layers.
function splitInsect(src, bodyHalf, rootY) {
  const w = src.width, h = src.height, cx = w / 2;
  const bodyPath = (ctx) => ctx.ellipse(cx, h * 0.52, w * bodyHalf, h * 0.5, 0, 0, Math.PI * 2);
  const layer = (clip, cut) => {
    const c = canvas(w, h);
    const ctx = c.getContext('2d');
    ctx.drawImage(src, 0, 0);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath(); clip(ctx); ctx.fill();
    if (cut) { ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); bodyPath(ctx); ctx.fill(); }
    return c;
  };
  return {
    w, h,
    body: layer(bodyPath, false),
    left: layer((ctx) => ctx.rect(0, 0, cx, h), true),
    right: layer((ctx) => ctx.rect(cx, 0, cx, h), true),
    root: { lx: cx - w * bodyHalf * 0.6, rx: cx + w * bodyHalf * 0.6, y: h * rootY },
  };
}

/* ------------------------------------------------------------------ */
/* WebGL surface renderer                                              */
/* ------------------------------------------------------------------ */
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
uniform sampler2D uShape, uA, uN, uB, uBN;
uniform int uMode;
uniform float uT;
uniform vec2 uSize;
uniform vec2 uTexel;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + vec2(17.0, 9.0); a *= 0.5; }
  return s;
}
vec3 shapeNormal(float k) {
  vec2 dx = vec2(uTexel.x * 2.0, 0.0), dy = vec2(0.0, uTexel.y * 2.0);
  float hx = texture(uShape, vUv + dx).r - texture(uShape, vUv - dx).r;
  float hy = texture(uShape, vUv + dy).r - texture(uShape, vUv - dy).r;
  return normalize(vec3(-hx * k, -hy * k, 1.0));
}
vec3 detail(sampler2D nmap, vec2 uv, float s) {
  vec3 n = texture(nmap, uv).xyz * 2.0 - 1.0;
  return vec3(n.x, -n.y, 0.0) * s; // OpenGL normal map -> y-down screen space
}
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

const vec3 L = vec3(-0.4, -0.62, 0.67);
const vec3 V = vec3(0.0, 0.0, 1.0);

void main() {
  vec2 p = vUv * uSize;          // design px
  vec3 Ns = shapeNormal(9.0);
  float h = texture(uShape, vUv).r;
  vec3 Ld = normalize(L);
  vec3 col;

  if (uMode == 1) {               // SKY  if (uMode == 1) {               // SKY
    float aspect = 2048.0 / 475.0;
    vec2 uv = vec2(0.31 + vUv.x * (uSize.x / uSize.y) / aspect * 1.05 + uT * 0.0025, 0.3 + vUv.y * 0.6);
    vec3 sky = texture(uA, uv).rgb;
    float l = luma(sky);
    float g = clamp(dot(vUv, vec2(0.55, 0.75)), 0.0, 1.0);
    vec3 tint = mix(vec3(1.32, 0.84, 1.1), vec3(0.74, 0.86, 1.2), g);
    col = sky * tint;
    col = mix(col, col * vec3(1.12, 0.9, 1.02) + vec3(0.04, 0.0, 0.02), smoothstep(0.55, 0.9, l) * (1.0 - g));
    vec2 cell = floor(p / 7.0);
    float star = step(0.93, hash(cell));
    vec2 sp = (cell + vec2(hash(cell + 3.1), hash(cell + 7.7))) * 7.0;
    float tw = 0.5 + 0.5 * sin(uT * (1.5 + hash(cell) * 3.0) + hash(cell) * 40.0);
    col += vec3(1.0) * star * smoothstep(1.3, 0.0, length(p - sp)) * tw * smoothstep(0.62, 0.35, l) * 0.9;
    float diff = max(dot(Ns, Ld), 0.0);
    col *= 0.92 + 0.14 * diff;
    col += vec3(1.0, 0.95, 1.0) * pow(max(dot(reflect(-Ld, Ns), V), 0.0), 40.0) * 0.15;
  } else if (uMode == 2 || uMode == 3) { // FOREST bark + moss  |  FLOWERS ground cover
    vec2 uv = p / (uMode == 2 ? 210.0 : 100.0);
    vec3 bark = texture(uA, uv).rgb;
    bark = pow(bark, vec3(1.15)) * 1.25;
    vec3 bn = detail(uN, uv, 2.2);
    float m = uMode == 2 ? smoothstep(0.12, 0.55, -Ns.y * 1.7 + (fbm(p * 0.035) - 0.5) * 1.4) : 1.0;
    vec2 muv = p / 85.0;
    vec3 moss = texture(uB, muv).rgb * vec3(0.95, 1.08, 0.8);
    vec3 mn = detail(uBN, muv, 1.2);
    if (uMode == 3) moss *= 0.55;
    vec3 alb = mix(bark * vec3(1.08, 0.98, 0.9), moss, m);
    vec3 N = normalize(Ns + mix(bn, mn, m));
    float diff = max(dot(N, Ld), 0.0);
    col = alb * (0.28 + 1.0 * diff);
    float d = smoothstep(0.48, 0.72, fbm(p * 0.011 + vec2(uT * 0.045, uT * 0.03)));
    col *= 0.82 + d * 0.5 * vec3(1.08, 1.0, 0.82);                    // dappled canopy light
  }
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

function createSurfaceGL() {
  const c = canvas(TW, TH);
  let owner;
  try {
    owner = ownGL(c, { premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false }, destroy);
    if (!owner) return null;
    gpuOwners.add(owner);
    const gl = owner.gl;
    const prog = owner.program(VERT, FRAG);
    gl.useProgram(prog);
    const U = n => gl.getUniformLocation(prog, n);
    const loc = { mode: U('uMode'), t: U('uT') };
    ['uShape','uA','uN','uB','uBN'].forEach((n,i) => gl.uniform1i(U(n), i));
    gl.uniform2f(U('uSize'), W, H); gl.uniform2f(U('uTexel'), 1/MW, 1/MH);
    const blank = owner.texture();
    gl.bindTexture(gl.TEXTURE_2D, blank);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([128,128,255,255]));
    // The one-pixel fallback must be complete even when no optional material map is bound.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return {
      canvas: c,
      texture(src, repeat = true) {
        if (!live() || !owner.active) throw new Error('Material surface unavailable');
        const texture = owner.texture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,src);
        gl.generateMipmap(gl.TEXTURE_2D);
        const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,wrap); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,wrap);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        return texture;
      },
      render(mode,time,shape,tex) {
        if (!live() || !owner.active) return;
        gl.viewport(0,0,TW,TH); gl.useProgram(prog);
        [shape,tex.a,tex.n,tex.b,tex.bn].forEach((t,unit) => { gl.activeTexture(gl.TEXTURE0+unit); gl.bindTexture(gl.TEXTURE_2D,t||blank); });
        gl.uniform1i(loc.mode,mode); gl.uniform1f(loc.t,time); gl.drawArrays(gl.TRIANGLES,0,3);
      },
      destroy() { owner.destroy(); gpuOwners.delete(owner); }
    };
  } catch (error) { owner?.destroy(); gpuOwners.delete(owner); throw error; }
}

/* ------------------------------------------------------------------ */
/* Drawing helpers                                                     */
/* ------------------------------------------------------------------ */
function drawFlier(ctx, parts, x, y, size, heading, wings, shadow) {
  const s = size / parts.w;
  const draw = () => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(heading);
    ctx.scale(s, s);
    ctx.translate(-parts.w / 2, -parts.h / 2);
    wings(ctx, parts);
    ctx.drawImage(parts.body, 0, 0);
    ctx.restore();
  };
  if (shadow) {
    ctx.save();
    ctx.globalAlpha *= 0.2;
    ctx.filter = 'brightness(0) blur(1.5px)';
    ctx.translate(shadow.dx, shadow.dy);
    draw();
    ctx.restore();
  }
  draw();
}

/* ------------------------------------------------------------------ */
/* Materials                                                           */
/* ------------------------------------------------------------------ */
function makeMaterials(info, assets) {
  const { edges, inside, shadeAt } = info;

  const sky = {
    key: 'sky', mode: 1, rim: 0.65, bias: 'down', tex: () => ({ a: assets.t.sky }),
    setup() {
      const r = rng(9);
      this.wisps = [0.24, 0.6, 0.06, 0.82].map((yy, i) => ({ y: H * yy, speed: 7 + i * 3, off: i * 170 + r() * 60, scale: 0.7 + r() * 0.5, spr: assets.clouds[i % assets.clouds.length] }));
    },
    outside(ctx, t, reveal, presence) {
      const span = W * 1.9;
      for (const c of this.wisps) {
        const x = ((t * c.speed + c.off) % span) - W * 0.45;
        const a = presence * smooth(-W * 0.45, -W * 0.15, x) * (1 - smooth(W * 1.15, W * 1.45, x));
        if (a <= 0.01) continue;
        const w = 150 * c.scale, h = w * (c.spr.height / c.spr.width);
        ctx.globalAlpha = a * 0.92;
        ctx.drawImage(c.spr, x - w / 2, c.y - h / 2 + Math.sin(t * 0.4 + c.off) * 3, w, h);
      }
      ctx.globalAlpha = 1;
    },
  };

  const forest = {
    key: 'forest', mode: 2, rim: 0, bias: 'up', tex: () => ({ a: assets.t.bark, n: assets.t.barkN, b: assets.t.moss, bn: assets.t.mossN }),
    setup() {
      const r = rng(17);
      // Ivy vines: rooted on top surfaces, creeping along and draping down over the edges.
      const tops = edges.filter((e) => e.ny < -0.45).sort((a, b) => a.x - b.x);
      const starts = [];
      for (const e of tops) if (r() < 0.12 && !starts.some((q) => Math.hypot(q.x - e.x, q.y - e.y) < 34)) starts.push(e);
      const sides = edges.filter((e) => Math.abs(e.nx) > 0.75 && r() < 0.03);
      this.vines = [...starts, ...sides].slice(0, 11).map((e) => {
        const pts = [{ x: e.x, y: e.y }];
        let x = e.x, y = e.y, dx = e.nx * 3 + (r() - 0.5) * 4;
        const n = 4 + ((r() * 6) | 0);
        for (let i = 0; i < n; i++) { dx = dx * 0.7 + (r() - 0.5) * 3; x += dx; y += 6 + r() * 4; pts.push({ x, y }); }
        const leaves = pts.slice(0, -1).map((q, i) => ({
          i, side: i % 2 ? 1 : -1, size: lerp(20, 11, i / n) * (0.8 + r() * 0.4),
          sprI: (r() * assets.ivy.length) | 0, dark: r() < 0.35, ph: r() * 6.28, twist: (r() - 0.5) * 0.8,
        }));
        return { pts, leaves, ph: r() * 6.28 };
      });
      // Tufts clinging to the top edges.
      this.leaves = tops.filter(() => r() < 0.14).map((e) => ({
        x: e.x - e.nx * 3, y: e.y - e.ny * 3, ang: Math.atan2(e.ny, e.nx) + (r() - 0.5) * 1.6, size: 12 + r() * 8,
        sprI: (r() * assets.ivy.length) | 0, dark: r() < 0.4, ph: r() * 6.28, delay: r() * 0.25,
      }));
      this.falling = [];
      this.nextFall = 1.5;
    },
    outside(ctx, t, reveal, presence, dt) {
      // Each leaf casts a soft contact shadow onto the bark beneath it.
      const leaf = (l, x, y, ang, s, turn) => {
        const spr = (l.dark ? assets.ivyDark : assets.ivy)[l.sprI], sh = assets.ivyShadow[l.sprI];
        const asp = spr.height / spr.width;
        for (const [img, ox, oy] of [[sh, 1.6, 2.6], [spr, 0, 0]]) {
          ctx.save();
          ctx.translate(x + ox, y + oy);
          ctx.rotate(ang);
          ctx.scale(turn, 1);
          ctx.drawImage(img, 0, -s * asp / 2, s, s * asp);
          ctx.restore();
        }
      };
      for (const v of this.vines) {
        const grow = smooth(0.15, 1, reveal(v.pts[0].x, v.pts[0].y));
        if (grow <= 0.01) continue;
        const shown = grow * (v.pts.length - 1);
        // Vine sways from its root; lower segments swing more.
        const pts = v.pts.map((q, i) => ({ x: q.x + Math.sin(t * 1.1 + v.ph) * i * 0.35, y: q.y }));
        ctx.strokeStyle = 'rgba(52,70,28,0.9)';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i <= Math.ceil(shown); i++) {
          const a = pts[i - 1], b = pts[i], k = Math.min(1, shown - (i - 1));
          ctx.lineTo(lerp(a.x, b.x, k), lerp(a.y, b.y, k));
        }
        ctx.stroke();
        for (const l of v.leaves) {
          const k = clamp(shown - l.i, 0, 1);
          if (k <= 0) continue;
          const a = pts[l.i], b = pts[l.i + 1];
          const dir = Math.atan2(b.y - a.y, b.x - a.x);
          const sway = Math.sin(t * 1.6 + l.ph) * 0.18;
          leaf(l, a.x, a.y, dir + l.side * 1.05 + l.twist + sway, l.size * k, 0.8 + 0.2 * Math.sin(t * 1.9 + l.ph));
        }
      }
      for (const l of this.leaves) {
        const grow = smooth(0.25 + l.delay, 1, reveal(l.x, l.y));
        if (grow <= 0.01) continue;
        const sway = Math.sin(t * 1.5 + l.ph) * 0.14 + Math.sin(t * 3.7 + l.ph * 1.7) * 0.04;
        leaf(l, l.x, l.y, l.ang + sway, l.size * grow, 0.82 + 0.18 * Math.sin(t * 1.9 + l.ph));
      }
      // Now and then a leaf lets go and tumbles down.
      if (presence > 0.95) {
        this.nextFall -= dt;
        if (this.nextFall <= 0 && this.falling.length < 3) {
          this.nextFall = 2.5 + Math.random() * 3;
          const src = this.leaves[(Math.random() * this.leaves.length) | 0];
          if (src) this.falling.push({ x: src.x, y: src.y, vx: (Math.random() - 0.5) * 10, size: src.size * 0.85, spr: assets.ivy[src.sprI], rot: src.ang, life: 0, ph: Math.random() * 6 });
        }
      }
      for (let i = this.falling.length - 1; i >= 0; i--) {
        const f = this.falling[i];
        f.life += dt;
        if (f.life > 6) { this.falling.splice(i, 1); continue; }
        f.y += 20 * dt;
        f.x += (f.vx + Math.sin(f.life * 1.8 + f.ph) * 22) * dt;
        f.rot += Math.sin(f.life * 1.3 + f.ph) * 1.6 * dt;
        const asp = f.spr.height / f.spr.width;
        ctx.save();
        ctx.globalAlpha = Math.min(1, f.life * 3) * (1 - smooth(4.5, 6, f.life)) * presence;
        ctx.translate(f.x, f.y);
        ctx.rotate(f.rot);
        ctx.scale(Math.cos(f.life * 3.1 + f.ph), 1);
        ctx.drawImage(f.spr, -f.size / 2, -f.size * asp / 2, f.size, f.size * asp);
        ctx.restore();
      }
    },
  };

  const flowers = {
    key: 'flowers', mode: 3, rim: 0, bias: 'noise', tex: () => ({ a: assets.t.grass, n: assets.t.grassN, b: assets.t.moss, bn: assets.t.mossN }),
    setup() {
      const r = rng(7);
      // A carpet of real blossoms over the letters (baked once, masked with the surface).
      this.carpet = canvas(TW, TH);
      const cctx = this.carpet.getContext('2d');
      cctx.scale(TS, TS);
      const v = assets.daisies;
      for (let k = 0; k < 1500; k++) {
        const p = inside(r, 0.15);
        const spr = v[(r() * v.length) | 0];
        const s = 6 + r() * 7;
        cctx.save();
        cctx.translate(p.x, p.y);
        cctx.rotate(r() * 6.28);
        cctx.scale(1, 0.75 + r() * 0.25);
        cctx.globalAlpha = 0.85 + r() * 0.15;
        cctx.drawImage(spr, -s / 2, -s / 2, s, s);
        cctx.restore();
      }
      this.blooms = edges.filter((e) => e.ny < 0 && r() < 0.22).map((e) => ({
        x: e.x - e.nx, y: e.y - e.ny, s: 8 + r() * 7, rot: r() * 6.28, ph: r() * 6.28, spr: v[(r() * v.length) | 0], delay: r() * 0.3,
      }));
      this.flyers = [
        { parts: assets.butterflies[0], size: 58, seed: 1, speed: 0.11, flap: 11, cx: 0.55, cy: 0.32 },
        { parts: assets.butterflies[1], size: 46, seed: 2, speed: 0.13, flap: 13, cx: 0.4, cy: 0.62 },
      ];
      this.bee = { parts: assets.bee, size: 30, heading: 0, x: W * 0.5, y: H * 0.5 };
    },
    inside(ctx, t) {
      ctx.drawImage(this.carpet, Math.sin(t * 0.9) * 0.6, 0, W, H); // breeze across the carpet
    },
    outside(ctx, t, reveal, presence, dt) {
      for (const b of this.blooms) {
        const open = smooth(0.25 + b.delay, 1, reveal(b.x, b.y));
        if (open <= 0.01) continue;
        const s = b.s * open;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot + Math.sin(t * 1.3 + b.ph) * 0.12);
        ctx.scale(1, 0.85 + 0.15 * Math.sin(t * 1.1 + b.ph)); // nodding
        ctx.drawImage(b.spr, -s / 2, -s / 2, s, s);
        ctx.restore();
      }
      const arrive = smooth(0.5, 1, presence);
      if (arrive <= 0.01) return;
      ctx.globalAlpha = arrive;
      for (const f of this.flyers) {
        const at = (tt) => ({ x: W * (f.cx + wander(tt, f.seed) * 0.62), y: H * (f.cy + wander(tt + 50, f.seed + 9) * 0.42) });
        const a = at(t * f.speed), b = at(t * f.speed + 0.01);
        const heading = Math.atan2(b.x - a.x, -(b.y - a.y));
        const glide = smooth(0.35, 0.75, vnoise(t * 0.6, f.seed * 31)); // flap, then glide
        const open = lerp(0.18 + 0.82 * Math.abs(Math.cos(t * f.flap + f.seed)), 0.95, glide);
        drawFlier(ctx, f.parts, a.x + (1 - arrive) * W * 0.8, a.y - (1 - arrive) * 120, f.size, heading, (c, p) => {
          for (const [img, rootX] of [[p.left, p.root.lx], [p.right, p.root.rx]]) {
            c.save();
            c.translate(rootX, 0);
            c.scale(open, 1); // wings fold toward the body (foreshortened from above)
            c.translate(-rootX, 0);
            c.globalAlpha *= 0.75 + 0.25 * open;
            c.drawImage(img, 0, 0);
            c.restore();
          }
        }, { dx: 5, dy: 9 });
      }
      // Honey bee: quick darting hover, wings a translucent blur.
      const bee = this.bee;
      const tt = t * 0.22;
      const tx = W * (0.5 + wander(tt, 7) * 0.58) + Math.sin(t * 9.3) * 1.2;
      const ty = H * (0.48 + wander(tt + 30, 8) * 0.44) + Math.cos(t * 11.1) * 1.2;
      const vx = tx - bee.x, vy = ty - bee.y;
      bee.x = tx; bee.y = ty;
      if (Math.hypot(vx, vy) > 0.05) {
        let d = Math.atan2(vx, -vy) - bee.heading;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        bee.heading += d * Math.min(1, dt * 8);
      }
      drawFlier(ctx, bee.parts, bee.x + (1 - arrive) * W, bee.y, bee.size, bee.heading, (c, p) => {
        // ~230 Hz wingbeat reads as a blur: several ghosted wing positions.
        for (const k of [-1, -0.33, 0.33, 1]) {
          const a = k * 0.42 + Math.sin(t * 40) * 0.05;
          for (const [img, rootX, side] of [[p.left, p.root.lx, -1], [p.right, p.root.rx, 1]]) {
            c.save();
            c.globalAlpha *= 0.3;
            c.translate(rootX, p.root.y);
            c.rotate(a * side);
            c.translate(-rootX, -p.root.y);
            c.drawImage(img, 0, 0);
            c.restore();
          }
        }
      }, { dx: 4, dy: 7 });
      ctx.globalAlpha = 1;
    },
  };

  return [sky, forest, flowers];
}

/* ------------------------------------------------------------------ */
/* Asset loading                                                       */
/* ------------------------------------------------------------------ */
async function loadAssets(gl) {
  const names = ['grass-color.jpg', 'grass-normal.jpg', 'bark-color.jpg', 'bark-normal.jpg', 'moss-color.jpg', 'moss-normal.jpg',
    'sky-clouds.jpg', 'ivy-color.jpg', 'ivy-opacity.jpg', 'daisy-color.jpg', 'daisy-opacity.jpg',
    'bee.jpg', 'butterfly-painted-lady.png', 'butterfly-sulphur.png'];
  const imgs = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await loadImage(M + n)])));
  if (!live()) throw new Error('Materials destroyed');
  const t = {
    grass: gl.texture(imgs['grass-color.jpg']), grassN: gl.texture(imgs['grass-normal.jpg']),
    bark: gl.texture(imgs['bark-color.jpg']), barkN: gl.texture(imgs['bark-normal.jpg']),
    moss: gl.texture(imgs['moss-color.jpg']), mossN: gl.texture(imgs['moss-normal.jpg']),
    sky: gl.texture(imgs['sky-clouds.jpg']),
  };

  const ivy = cellSprites(withOpacity(imgs['ivy-color.jpg'], imgs['ivy-opacity.jpg']), 3, 3).slice(0, 7); // last two leaves are blighted
  const ivyDark = ivy.map((l) => {
    const c = canvas(l.width, l.height);
    const cx = c.getContext('2d');
    cx.filter = 'brightness(0.6) saturate(1.15) hue-rotate(-8deg)';
    cx.drawImage(l, 0, 0);
    return c;
  });
  const ivyShadow = ivy.map((l) => {
    const c = canvas(l.width, l.height);
    const cx = c.getContext('2d');
    cx.filter = 'brightness(0) blur(6px)';
    cx.globalAlpha = 0.45;
    cx.drawImage(l, 0, 0);
    return c;
  });
  const daisyBase = cellSprites(withOpacity(imgs['daisy-color.jpg'], imgs['daisy-opacity.jpg']), 3, 2);
  const daisies = [
    ...daisyBase.map((d) => tintPetals(d, [1.0, 0.62, 0.82])),
    ...daisyBase.slice(0, 3).map((d) => tintPetals(d, [0.98, 0.45, 0.72])),
    ...daisyBase.slice(0, 2),
  ];

  // Cloud wisps keyed out of the sky photo.
  const skyPx = pixels(imgs['sky-clouds.jpg']);
  const sd = skyPx.data.data;
  for (let i = 0; i < sd.length; i += 4) {
    const r = sd[i] / 255, g = sd[i + 1] / 255, b = sd[i + 2] / 255;
    const white = (r + g + b) / 3 - Math.max(0, b - r) * 0.9;
    const k = smooth(0.55, 0.74, white);
    sd[i + 3] = k * k * 255;
    sd[i] = Math.min(255, sd[i] * 1.08 + 10); sd[i + 2] = Math.min(255, sd[i + 2] * 1.02 + 6); // dusk-warm the cloud
  }
  skyPx.ctx.putImageData(skyPx.data, 0, 0);
  const sw = skyPx.c.width, sh = skyPx.c.height;
  const windows = [];
  for (let x = 560; x < 1560 - 320; x += 30) {
    let sum = 0;
    for (let y = 60; y < sh - 60; y += 6) for (let xx = x; xx < x + 320; xx += 6) sum += sd[(y * sw + xx) * 4 + 3];
    windows.push({ x, sum });
  }
  windows.sort((a, b) => b.sum - a.sum);
  const picked = [];
  for (const w of windows) {
    if (picked.length >= 4) break;
    if (picked.some((x) => Math.abs(x - w.x) < 200)) continue;
    picked.push(w.x);
  }
  const clouds = picked.map((x) => {
    const c = canvas(320, sh - 80);
    const cctx = c.getContext('2d');
    cctx.drawImage(skyPx.c, x, 40, 320, sh - 80, 0, 0, 320, sh - 80);
    const g = cctx.createRadialGradient(160, c.height / 2, 20, 160, c.height / 2, 150); // feather the crop
    g.addColorStop(0, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)');
    cctx.globalCompositeOperation = 'destination-in';
    cctx.fillStyle = g; cctx.fillRect(0, 0, 320, c.height);
    return c;
  });

  const bee = splitInsect(keyBlack(imgs['bee.jpg']), 0.15, 0.36);
  const butterflies = [imgs['butterfly-painted-lady.png'], imgs['butterfly-sulphur.png']].map((im) => splitInsect(pixels(im).c, 0.035, 0.45));

  return { t, ivy, ivyDark, ivyShadow, daisies, clouds, bee, butterflies };
}

/* ------------------------------------------------------------------ */
/* Controller                                                          */
/* ------------------------------------------------------------------ */
function initNalanaTextures() {
  const out = canvas(1, 1);
  out.className = 'fn-texture';
  out.setAttribute('aria-hidden', 'true');
  host.append(out);
  const octx = out.getContext('2d');

  const layer = canvas(TW, TH);
  const lctx = layer.getContext('2d');
  const mask = canvas(MW, MH);
  const mctx = mask.getContext('2d');
  const rim = canvas(MW, MH);
  const rctx = rim.getContext('2d');
  let maskImg = mctx.createImageData(MW, MH);
  let rimImg = rctx.createImageData(MW, MH);

  let info = null, materials = null, field = null, gl = null, shapeTex = null, assets = null, loading = null;
  let current = null, lastKey = null;
  let p = 0, target = 0, time = 0, hovered = false, k = 1, maskP = -1;

  function load() {
    if (loading) return loading;
    loading = (async () => {
      if (!live()) throw new Error('Materials destroyed');
      if (!img.complete || !img.naturalWidth) await new Promise((resolve,reject) => {
        const clean = () => { img.removeEventListener('load',done); img.removeEventListener('error',failed); cancellation.signal.removeEventListener('abort',failed); };
        const done = () => { clean(); resolve(); };
        const failed = () => { clean(); reject(new Error('Balloon image unavailable')); };
        img.addEventListener('load',done,{once:true}); img.addEventListener('error',failed,{once:true}); cancellation.signal.addEventListener('abort',failed,{once:true});
      });
      if (!live()) throw new Error('Materials destroyed');
      info = analyse(img);
      gl = createSurfaceGL();
      if (!gl) throw new Error('WebGL2 unavailable');
      shapeTex = gl.texture(info.heightC,false);
      assets = await loadAssets(gl);
      if (!live()) throw new Error('Materials destroyed');
      materials = makeMaterials(info,assets);
      materials.forEach(m => m.setup());
    })();
    // A failed set stays static; do not retry or leave earlier uploads allocated.
    loading.catch(() => destroy());
    return loading;
  }

  function resize() {
    if (!live()) return;
    k = Math.min((getScale() || 1) * Math.min(platform.getDpr?.() || document.defaultView?.devicePixelRatio || 1, 2), 2.5);
    out.width = Math.round(W * (1 + 2 * PAD) * k);
    out.height = Math.round(H * (1 + 2 * PAD) * k);
  }

  function prepareField(m) {
    const n = info.noise;
    field = new Float32Array(MW * MH);
    let lo = Infinity, hi = -Infinity;
    for (let y = 0; y < MH; y++) {
      for (let x = 0; x < MW; x++) {
        const i = y * MW + x;
        let b;
        if (m.bias === 'up') b = 0.55 * (1 - y / MH) + 0.45 * n[i];
        else if (m.bias === 'rise') b = 0.8 * (1 - y / MH) + 0.2 * n[i];
        else if (m.bias === 'down') b = 0.55 * (y / MH) + 0.45 * n[i];
        else b = n[i];
        field[i] = b;
        if (info.A[i] > 0.3) { if (b < lo) lo = b; if (b > hi) hi = b; }
      }
    }
    for (let i = 0; i < field.length; i++) field[i] = clamp((field[i] - lo) / (hi - lo || 1), 0, 1);
    maskP = -1;
  }

  const revealValue = (f, q) => clamp((q * (1 + FRONT) - f) / FRONT, 0, 1);
  const revealAt = (x, y) => {
    const xi = clamp(Math.round(x), 0, MW - 1), yi = clamp(Math.round(y), 0, MH - 1);
    return revealValue(field[yi * MW + xi], p);
  };

  // Rebuild the letter mask + growth front for the current progress.
  function buildMask(front) {
    if (Math.abs(p - maskP) < 1e-4) return;
    maskP = p;
    const { A, noise } = info;
    const strength = current.rim;
    const md = maskImg.data, rd = rimImg.data;
    const n = A.length;
    for (let i = 0; i < n; i++) {
      const a = A[i];
      if (a <= 0) { md[i * 4 + 3] = 0; rd[i * 4 + 3] = 0; continue; }
      const v = revealValue(field[i], p);
      md[i * 4 + 3] = a * v * 255;
      const glow = v > 0 && v < 1 ? 1 - Math.abs(2 * v - 1) : 0;
      // Foam/mist at the front, broken up by noise so it reads as material.
      const broken = smooth(0.35, 0.75, noise[(i * 7) % n] * 0.5 + noise[i] * 0.5 + glow * 0.4);
      rd[i * 4] = 250; rd[i * 4 + 1] = 252; rd[i * 4 + 2] = 255;
      rd[i * 4 + 3] = a * glow * broken * strength * 240;
      if (p < 1 && glow > 0.9 && (i & 63) === 0) front.push({ x: i % MW, y: (i / MW) | 0, nx: 0, ny: -1 });
    }
    mctx.putImageData(maskImg, 0, 0);
    rctx.putImageData(rimImg, 0, 0);
  }

  let selection = 0;
  async function select(key) {
    const token = ++selection;
    if (!live()) return;
    if (!key) { hovered = false; target = 0; host.classList.remove('is-hover'); onInvalidate(); return; }
    if (!['sky','forest','flowers'].includes(key)) return;
    try { await load(); } catch { return; }
    if (!live() || token !== selection) return;
    hovered = true;
    host.classList.add('is-hover');
    if (current?.key !== key) { current = materials.find(m => m.key === key); lastKey = key; prepareField(current); p = 0; }
    target = 1;
    onInvalidate();
  }

  resize();

  const handle = {
    resize, preload: load, select, destroy,
    get active() { return live() && (p > 0 || target > 0); },
    update(dt, options = {}) {
      if (!live()) return;
      reduceMotion = !!options.reducedMotion;
      dt = Math.min(Math.max(dt || 0, 0), 0.05);
      try {
      if (!current || (p === 0 && target === 0)) return;
      const step = reduceMotion ? 0 : dt;
      time += step;
      const speed = target > p ? 1 / ENTER_S : 1 / EXIT_S;
      p = reduceMotion ? target : clamp(p + Math.sign(target - p) * speed * dt, 0, 1);
      const linear = p;
      p = easeInOut(p); // shape the growth with easing
      const q = p;

      const front = [];
      buildMask(front);
      const presence = smooth(0.35, 1, q);

      // Lit surface (WebGL) + puffy balloon shading, cut to the reveal.
      gl.render(current.mode, time, shapeTex, current.tex());
      lctx.setTransform(1, 0, 0, 1, 0, 0);
      lctx.globalCompositeOperation = 'source-over';
      lctx.clearRect(0, 0, TW, TH);
      lctx.drawImage(gl.canvas, 0, 0);
      if (current.inside) {
        lctx.setTransform(TS, 0, 0, TS, 0, 0);
        current.inside(lctx, time);
        lctx.setTransform(1, 0, 0, 1, 0, 0);
      }
      lctx.globalCompositeOperation = 'hard-light';
      lctx.globalAlpha = ({ 0: 0.32, 1: 0.3, 2: 0.6, 3: 0.85, 4: 0.3 })[current.mode];
      lctx.drawImage(info.shade, 0, 0, TW, TH);
      if (current.mode === 3) { lctx.globalAlpha = 0.45; lctx.drawImage(info.shade, 0, 0, TW, TH); } // deepen creases so letters read through the blossoms
      lctx.globalAlpha = 1;
      lctx.globalCompositeOperation = 'destination-in';
      lctx.drawImage(mask, 0, 0, TW, TH);
      lctx.globalCompositeOperation = 'source-over';
      if (current.rim) lctx.drawImage(rim, 0, 0, TW, TH);

      octx.setTransform(1, 0, 0, 1, 0, 0);
      octx.clearRect(0, 0, out.width, out.height);
      octx.setTransform(k, 0, 0, k, W * PAD * k, H * PAD * k);
      octx.imageSmoothingQuality = 'high';
      octx.drawImage(layer, 0, 0, W, H);
      current.outside(octx, time, revealAt, presence, step, front);

      // Fade the tri-colour letters under the finished material so edges stay clean.
      img.style.opacity = String(1 - smooth(0.8, 1, q) * 0.85);

      p = linear;
      if (p === 0 && target === 0) {
        octx.setTransform(1, 0, 0, 1, 0, 0);
        octx.clearRect(0, 0, out.width, out.height);
        img.style.opacity = originalOpacity;
      }
      } catch { destroy(); }
    },
  };
  clearState = () => { info = materials = field = assets = current = shapeTex = gl = maskImg = rimImg = null; selection++; p = target = 0; };
  return handle;
}

  signal?.addEventListener('abort', destroy, { once: true });
  try {
    const result = initNalanaTextures();
    if (signal?.aborted) destroy();
    return result;
  } catch {
    destroy();
    return { preload: () => Promise.resolve(), select: () => Promise.resolve(), resize() {}, update() {}, active: false, destroy };
  }
}
