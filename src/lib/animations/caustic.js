// @ts-nocheck
// Grace's caustic shader, adapted to a terminal, owner-scoped renderer lifetime.
import { setup, render } from './water-caustic.js';
import { VERT, FRAG } from './caustic-shaders.js';
import { makeCanvas, ownGL } from './gpu-resources.js';

const DEFAULTS = {
  waterColor: { r: 0, g: 0.388, b: 0.706, a: 1 },
  highlightColor: { r: 0.804, g: 0.961, b: 1, a: 1 },
  center: { x: 50, y: 50 }, scale: 1, playhead: 0, intensity: 0.5
};

/** @param {any} host @param {{params?:any,platform?:any,signal?:AbortSignal}} [options] */
export async function createCaustic(host, { params = {}, platform = {}, signal } = {}) {
  const document = host.ownerDocument || platform.document;
  const navigator = platform.navigator || document?.defaultView?.navigator;
  const values = { ...DEFAULTS, ...params,
    waterColor: { ...DEFAULTS.waterColor, ...params.waterColor },
    highlightColor: { ...DEFAULTS.highlightColor, ...params.highlightColor },
    center: { ...DEFAULTS.center, ...params.center } };
  let dead = false, renderer = null;
  const live = () => !dead && !signal?.aborted;
  let gpuCanvas, device, context, frame;
  let gpuDisposed = false;
  const disposeGPU = () => {
    // Release what is owned now, even before a renderer has been returned. The
    // validation promise may never settle. Clearing handles also makes a later
    // requestDevice result releasable after an earlier, empty abort disposal.
    gpuDisposed = true;
    const ownedFrame = frame, ownedContext = context, ownedDevice = device, ownedCanvas = gpuCanvas;
    frame = context = device = gpuCanvas = null;
    try { ownedFrame?.state?.quad?.destroy(); } catch {}
    try { ownedFrame?.state?.uniformBuf?.destroy(); } catch {}
    try { ownedContext?.unconfigure(); } catch {}
    try { ownedDevice?.destroy(); } catch {}
    ownedCanvas?.remove();
    if (ownedCanvas) { ownedCanvas.width = 1; ownedCanvas.height = 1; }
    if (ownedFrame) { ownedFrame.state = {}; ownedFrame.output = null; }
  };
  const stop = () => { dead = true; renderer?.destroy(); disposeGPU(); };
  signal?.addEventListener('abort', stop, { once: true });
  const detach = () => signal?.removeEventListener('abort', stop);
  if (!live()) { detach(); return null; }
  const bounds = host.getBoundingClientRect?.();
  // Do not acquire contexts for an invalid/hidden zero-size root.
  if (bounds && (!bounds.width || !bounds.height)) { detach(); return null; }
  try {
    if (navigator?.gpu) {
      const adapter = await navigator.gpu.requestAdapter();
      if (!live()) { detach(); return null; }
      if (adapter) {
        device = await adapter.requestDevice();
        if (!live()) { disposeGPU(); detach(); return null; }
        gpuCanvas = makeCanvas(platform, document);
        context = gpuCanvas.getContext('webgpu');
        if (!context) throw new Error('WebGPU canvas unavailable');
        const format = navigator.gpu.getPreferredCanvasFormat();
        context.configure({ device, format, alphaMode: 'premultiplied' });
        frame = { state: {}, params: values, output: null };
        device.pushErrorScope?.('validation');
        setup(device, frame, platform.gpuBufferUsage || globalThis.GPUBufferUsage || { VERTEX: 32, UNIFORM: 64, COPY_DST: 8 });
        const drawGPU = () => {
          const output = context.getCurrentTexture();
          // Some implementations omit texture.format; keep the configured format authoritative.
          frame.output = { width: output.width, height: output.height, format,
            createView: () => output.createView() };
          render(device, frame);
        };
        // Compile/validate the pipeline before adopting the provisional canvas so
        // initialization failures release GPU allocations and use a fresh GL canvas.
        drawGPU();
        const validationError = await device.popErrorScope?.();
        if (!live()) { disposeGPU(); detach(); return null; }
        if (validationError) throw new Error('WebGPU shader validation failed');
        let active = true;
        renderer = finish(gpuCanvas, 'webgpu', () => active && !gpuDisposed, drawGPU,
          () => { active = false; disposeGPU(); });
        device.lost?.then(() => { active = false; renderer?.destroy(); }, () => { active = false; renderer?.destroy(); });
        if (!live()) { renderer.destroy(); return null; }
        return renderer;
      }
    }
  } catch { disposeGPU(); }
  if (!live()) { disposeGPU(); detach(); return null; }
  // A WebGPU-bound canvas cannot be rebound to WebGL. This is always a fresh canvas.
  const canvas = makeCanvas(platform, document);
  let owner;
  try {
    owner = ownGL(canvas, { premultipliedAlpha: true, antialias: false }, () => renderer?.destroy());
    if (!owner) { canvas.remove(); detach(); return null; }
    const gl = owner.gl;
    const program = owner.program(VERT, FRAG);
    const buffer = owner.buffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'pos');
    const U = Object.fromEntries(['uDims', 'uWater', 'uHighlight', 'uIntensity', 'uPlayhead', 'uScale', 'uCenter'].map(name => [name, gl.getUniformLocation(program, name)]));
    const rgba = c => [c.r, c.g, c.b, c.a];
    renderer = finish(canvas, 'webgl2', () => owner.active, () => {
      gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(U.uDims, canvas.width, canvas.height);
      gl.uniform4fv(U.uWater, rgba(values.waterColor)); gl.uniform4fv(U.uHighlight, rgba(values.highlightColor));
      gl.uniform1f(U.uIntensity, values.intensity); gl.uniform1f(U.uPlayhead, values.playhead);
      gl.uniform1f(U.uScale, values.scale); gl.uniform2f(U.uCenter, values.center.x, values.center.y);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }, () => { owner.destroy(); canvas.remove(); });
    if (!live()) { renderer.destroy(); return null; }
    return renderer;
  } catch { owner?.destroy(); canvas.remove(); detach(); return null; }

  function finish(canvas, kind, available, drawFrame, release) {
    let disposed = false;
    canvas.className = 'caustic-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    host.append(canvas);
    const result = {
      kind, canvas,
      get active() { return !disposed && live() && available(); },
      /** @param {{width?:number,height?:number,dpr?:number}} [size] */
      resize({ width, height, dpr = 1 } = {}) {
        if (!result.active || !(width > 0 && height > 0)) return;
        const cap = Math.min(params.maxWidth || 1600, device?.limits?.maxTextureDimension2D || 16384);
        const scale = Math.min(Math.max(dpr, 0.1), cap / width, cap / height);
        const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
      },
      /** @param {{delta?:number,playhead?:number,center?:{x?:number,y?:number}}} [frame] */
      draw({ delta = 0, playhead, center } = {}) {
        if (!result.active) return;
        if (Number.isFinite(center?.x)) values.center.x = center.x;
        if (Number.isFinite(center?.y)) values.center.y = center.y;
        if (Number.isFinite(playhead)) values.playhead = playhead;
        else values.playhead = (values.playhead + Math.min(Math.max(delta, 0), 0.05) * (params.speed ?? 0.55)) % 100;
        try { drawFrame(); } catch { result.destroy(); }
      },
      destroy() {
        if (disposed) return;
        disposed = true; dead = true; detach(); release(); canvas.remove();
        canvas.width = 1; canvas.height = 1;
      }
    };
    return result;
  }
}
