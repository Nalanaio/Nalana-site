import test from 'node:test';
import assert from 'node:assert/strict';
import { createCaustic } from '../src/lib/animations/caustic.js';
import { createGlossyRenderer } from '../src/lib/animations/glossy-text.js';
import { createMaterials } from '../src/lib/animations/materials.js';

const deferred = () => { let resolve = (_value) => {}; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

function fakeGL({ compileAt = 0, link = true, uploadAt = 0 } = {}) {
  const resources = new Set(), allocated = [], released = [], draws = [], uniforms = [];
  let shaderCount = 0, uploads = 0;
  const gl = new Proxy({
    resources, allocated, released, draws, uniforms,
    createShader() { shaderCount++; const x = { kind: 'shader', number: shaderCount }; resources.add(x); allocated.push(x); return x; },
    getShaderParameter(shader) { return shader.number !== compileAt; },
    getProgramParameter() { return link; },
    getAttribLocation() { return 0; }, getUniformLocation(_, name) { return name; },
    getShaderInfoLog() { return 'injected compile failure'; }, getProgramInfoLog() { return 'injected link failure'; },
    texImage2D() { if (++uploads === uploadAt) throw new Error('injected upload failure'); },
    uniform2f(name, x, y) { uniforms.push({ name, x, y }); },
    drawArrays() { draws.push(1); }
  }, {
    get(target, key) {
      if (key in target) return target[key];
      if (typeof key !== 'string') return undefined;
      if (/^create(Program|Buffer|Texture)$/.test(key)) return () => {
        const x = { kind: key.slice(6) }; resources.add(x); allocated.push(x); return x;
      };
      if (/^delete(Shader|Program|Buffer|Texture)$/.test(key)) return x => {
        assert.ok(resources.delete(x), `one release per ${x.kind}`); released.push(x);
      };
      if (key.toUpperCase() === key) return key;
      return () => {};
    }
  });
  return gl;
}

function context2d() {
  const imageData = (w, h) => {
    const data = new Uint8ClampedArray(w * h * 4); data.fill(255); return { width: w, height: h, data };
  };
  return new Proxy({
    createImageData: imageData, getImageData(_, __, w, h) { return imageData(w, h); },
    measureText() { return { actualBoundingBoxAscent: 10, actualBoundingBoxDescent: 0 }; },
    createRadialGradient() { return { addColorStop() {} }; }
  }, { get(target, key) { return key in target ? target[key] : () => {}; } });
}

function fixture(gl = fakeGL(), gpu = null, gpuContext = null) {
  const canvases = [];
  const document = { defaultView: { navigator: { gpu }, devicePixelRatio: 1 } };
  class Canvas extends EventTarget {
    constructor() { super(); this.width = this.height = 1; this.style = {}; this.contexts = []; this.parent = null; }
    getContext(type) { this.contexts.push(type); return type === 'webgl2' ? gl : type === 'webgpu' ? gpuContext : context2d(); }
    setAttribute() {}
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); this.parent = null; }
  }
  document.createElement = () => { const c = new Canvas(); canvases.push(c); return c; };
  const host = {
    ownerDocument: document, children: [],
    append(c) { this.children.push(c); c.parent = this; },
    getBoundingClientRect() { return { width: 640, height: 360 }; },
    classList: { add() {}, remove() {} }
  };
  const platform = { document, navigator: document.defaultView.navigator, createCanvas: document.createElement };
  return { host, platform, canvases, gl };
}

function gpuDevice({ configureThrows = false, pipelineThrows = false, mapThrows = false } = {}) {
  const resources = new Set();
  let destroyed = 0, unconfigured = 0, draws = 0;
  const lost = deferred();
  const device = {
    lost: lost.promise,
    limits: { maxTextureDimension2D: 2048 },
    createShaderModule() { return {}; },
    createBuffer({ size }) {
      const b = { getMappedRange: () => { if (mapThrows) throw new Error('mapped range unavailable'); return new ArrayBuffer(size); }, unmap() {}, destroy() { assert.ok(resources.delete(b)); } };
      resources.add(b); return b;
    },
    createRenderPipeline() { if (pipelineThrows) throw new Error('pipeline failed'); return { getBindGroupLayout() {} }; },
    createBindGroup() {},
    createCommandEncoder() { return { beginRenderPass() { return { setPipeline() {}, setBindGroup() {}, setVertexBuffer() {}, draw() { draws++; }, end() {} }; }, finish() {} }; },
    queue: { writeBuffer() {}, submit() {} }, destroy() { destroyed++; }
  };
  const context = { configure() { if (configureThrows) throw new Error('configure failed'); }, unconfigure() { unconfigured++; }, getCurrentTexture() { return { width: 1, height: 1, createView() {} }; } };
  const gpu = { requestAdapter: async () => ({ requestDevice: async () => device }), getPreferredCanvasFormat: () => 'rgba8unorm' };
  return { device, context, gpu, lost, resources, get destroyed() { return destroyed; }, get unconfigured() { return unconfigured; }, get draws() { return draws; } };
}

test('visual modules import without document, navigator, RAF, or a GPU', async () => {
  assert.equal(typeof globalThis.document, 'undefined');
  await Promise.all(['caustic', 'glossy-text', 'materials'].map(n => import(`../src/lib/animations/${n}.js`)));
});

for (const failure of [{ compileAt: 1 }, { compileAt: 2 }, { link: false }]) {
  test(`caustic frees every partial GL allocation after ${JSON.stringify(failure)}`, async () => {
    const f = fixture(fakeGL(failure));
    assert.equal(await createCaustic(f.host, { platform: f.platform }), null);
    assert.equal(f.gl.resources.size, 0); assert.equal(f.host.children.length, 0);
    assert.equal(f.gl.allocated.length, f.gl.released.length);
  });
}

test('caustic WebGPU setup failure releases buffers/device/context before fresh GL fallback', async () => {
  const g = gpuDevice({ pipelineThrows: true });
  const f = fixture(fakeGL(), g.gpu, g.context);
  const renderer = await createCaustic(f.host, { platform: f.platform });
  assert.equal(renderer.kind, 'webgl2'); assert.equal(g.resources.size, 0);
  assert.equal(g.destroyed, 1); assert.equal(g.unconfigured, 1);
  assert.equal(f.canvases.length, 2);
  assert.deepEqual(f.canvases[0].contexts, ['webgpu']); assert.deepEqual(f.canvases[1].contexts, ['webgl2']);
  assert.deepEqual(f.host.children, [f.canvases[1]]);
  renderer.destroy(); renderer.destroy(); assert.equal(f.gl.resources.size, 0);
});

test('late device returned after abort is destroyed without a canvas or renderer', async () => {
  const pending = deferred(), g = gpuDevice();
  const f = fixture(fakeGL(), { requestAdapter: async () => ({ requestDevice: () => pending.promise }) });
  const controller = new AbortController();
  const result = createCaustic(f.host, { platform: f.platform, signal: controller.signal });
  await Promise.resolve(); controller.abort(); pending.resolve(g.device);
  assert.equal(await result, null); assert.equal(g.destroyed, 1); assert.equal(f.canvases.length, 0);
});

test('abort synchronously frees GPU allocations while validation is still pending', async () => {
  const validation = deferred(), reachedValidation = deferred(), g = gpuDevice();
  const device = { ...g.device, popErrorScope() { reachedValidation.resolve(null); return validation.promise; } };
  const gpu = { ...g.gpu, requestAdapter: async () => ({ requestDevice: async () => device }) };
  const f = fixture(fakeGL(), gpu, g.context), controller = new AbortController();
  const result = createCaustic(f.host, { platform: f.platform, signal: controller.signal });
  await reachedValidation.promise;
  assert.equal(g.resources.size, 2); assert.equal(g.destroyed, 0);
  const draws = g.draws;
  controller.abort();
  try {
    assert.equal(g.resources.size, 0, 'abort must release buffers before validation settles');
    assert.equal(g.destroyed, 1); assert.equal(g.unconfigured, 1);
    assert.equal(f.host.children.length, 0);
  } finally {
    validation.resolve(null);
    assert.equal(await result, null);
  }
  assert.equal(g.draws, draws); assert.equal(g.destroyed, 1); assert.equal(g.unconfigured, 1);
  assert.equal(f.canvases.length, 1, 'a destroyed generation cannot start GL fallback');
});

for (const failure of [{ configureThrows: true }, { mapThrows: true }]) {
  test(`GPU partial ${JSON.stringify(failure)} releases allocations and falls back`, async () => {
    const g = gpuDevice(failure), f = fixture(fakeGL(), g.gpu, g.context);
    const renderer = await createCaustic(f.host, { platform: f.platform });
    assert.equal(renderer.kind, 'webgl2'); assert.equal(g.destroyed, 1); assert.equal(g.resources.size, 0);
    renderer.destroy(); assert.equal(f.gl.resources.size, 0);
  });
}

test('caustic bounds backing dimensions and keeps GL context loss terminal', async () => {
  const f = fixture();
  const renderer = await createCaustic(f.host, { platform: f.platform });
  renderer.resize({ width: 10000, height: 5000, dpr: 2 });
  assert.equal(renderer.canvas.width, 1600); assert.equal(renderer.canvas.height, 800);
  renderer.draw({ delta: 0.01 }); assert.equal(f.gl.draws.length, 1);
  renderer.canvas.dispatchEvent(new Event('webglcontextlost'));
  assert.equal(renderer.active, false); assert.equal(f.gl.resources.size, 0);
  renderer.draw({ delta: 0.01 }); renderer.canvas.dispatchEvent(new Event('webglcontextrestored'));
  assert.equal(f.gl.draws.length, 1); assert.equal(f.host.children.length, 0);
  renderer.destroy(); assert.equal(f.gl.allocated.length, f.gl.released.length);
});

test('parallax center reaches the shader without poisoning finite state or another instance', async () => {
  const params = { center: { x: 40, y: 60 } }, first = fixture(), second = fixture();
  const a = await createCaustic(first.host, { platform: first.platform, params });
  const b = await createCaustic(second.host, { platform: second.platform, params });
  a.draw({ center: { x: 0, y: 55 } });
  a.draw({ center: { x: NaN, y: Infinity } });
  b.draw();
  assert.deepEqual(first.gl.uniforms.filter(u => u.name === 'uCenter'), [
    { name: 'uCenter', x: 0, y: 55 }, { name: 'uCenter', x: 0, y: 55 }
  ]);
  assert.deepEqual(second.gl.uniforms.filter(u => u.name === 'uCenter'), [{ name: 'uCenter', x: 40, y: 60 }]);
  assert.deepEqual(params.center, { x: 40, y: 60 });
  a.destroy(); b.destroy();
});

test('WebGPU loss stops drawing and normal disposal releases only owned resources once', async () => {
  const g = gpuDevice(), f = fixture(fakeGL(), g.gpu, g.context);
  const renderer = await createCaustic(f.host, { platform: f.platform });
  assert.equal(renderer.kind, 'webgpu'); renderer.draw({ delta: 0.01 });
  const count = g.draws; g.lost.resolve({ reason: 'unknown' }); await Promise.resolve();
  renderer.draw({ delta: 0.01 }); renderer.destroy();
  assert.equal(g.draws, count); assert.equal(g.resources.size, 0); assert.equal(g.destroyed, 1); assert.equal(g.unconfigured, 1);
});

test('zero-size caustic host does not acquire a browser/GPU canvas', async () => {
  const f = fixture(); f.host.getBoundingClientRect = () => ({ width: 0, height: 0 });
  assert.equal(await createCaustic(f.host, { platform: f.platform }), null); assert.equal(f.canvases.length, 0);
});

test('glossy upload failure frees its partial texture, scratch program/shaders, and canvases', () => {
  const f = fixture(fakeGL({ uploadAt: 1 }));
  const renderer = createGlossyRenderer({ platform: f.platform });
  const mask = renderer.glyphMask({ text: 'D', font: 'sans-serif', size: 10, W: 12, H: 12, puff: 0 });
  assert.equal(renderer.renderGlossy(mask, '#d034aa'), null);
  assert.equal(f.gl.resources.size, 0); assert.equal(renderer.active, false);
  renderer.destroy(); assert.ok(f.canvases.every(c => c.width === 1 && c.height === 1));
});

test('glossy successful rendering releases each temporary upload and owns outputs until destroy', () => {
  const f = fixture(); const renderer = createGlossyRenderer({ platform: f.platform });
  const mask = renderer.glyphMask({ text: 'D', font: 'sans-serif', size: 10, W: 12, H: 12 });
  assert.ok(renderer.renderGlossy(mask, '#d034aa', { bevel: 2 }));
  assert.equal([...f.gl.resources].filter(x => x.kind === 'Texture').length, 0);
  renderer.destroy(); renderer.destroy(); assert.equal(f.gl.resources.size, 0);
});

for (const uploadAt of [1, 2, 5]) {
  test(`material upload ${uploadAt} failure releases blank, shape and earlier successful textures`, async () => {
    const f = fixture(fakeGL({ uploadAt }));
    f.platform.loadImage = async () => ({ width: 2, height: 2, naturalWidth: 2, naturalHeight: 2 });
    const img = { complete: true, naturalWidth: 2, style: { opacity: '0.9' } };
    const renderer = createMaterials({ host: f.host, img, platform: f.platform });
    await assert.rejects(renderer.preload());
    renderer.destroy(); assert.equal(f.gl.resources.size, 0); assert.equal(img.style.opacity, '0.9');
    assert.equal(f.host.children.length, 0); assert.equal(f.gl.allocated.length, f.gl.released.length);
  });
}

test('late material assets after destroy cannot upload, restore a hover, or invalidate a new owner', async () => {
  const f = fixture(), pending = [];
  f.platform.loadImage = () => { const d = deferred(); pending.push(d); return d.promise; };
  let invalidations = 0;
  const renderer = createMaterials({ host: f.host, img: { complete: true, naturalWidth: 2, style: {} }, platform: f.platform, onInvalidate: () => invalidations++ });
  const selection = renderer.select('flowers');
  assert.equal(pending.length, 14); renderer.destroy();
  for (const d of pending) d.resolve({ naturalWidth: 2, naturalHeight: 2 });
  await selection;
  assert.equal(f.gl.resources.size, 0); assert.equal(invalidations, 0); assert.equal(f.host.children.length, 0);
});

test('25 actual caustic mount/draw/destroy cycles leave zero owned allocations', async () => {
  const f = fixture();
  for (let i = 0; i < 25; i++) {
    const renderer = await createCaustic(f.host, { platform: f.platform });
    renderer.draw({ delta: 0.01 }); renderer.destroy(); renderer.destroy();
    assert.equal(f.gl.resources.size, 0); assert.equal(f.host.children.length, 0);
  }
  assert.equal(f.gl.allocated.length, f.gl.released.length);
});
