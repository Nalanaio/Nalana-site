// Grace's source elliptical wake/ambient ripple math, driven by the owning page scheduler.
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

/** @param {HTMLCanvasElement} canvas @param {any} options */
export function createRipple(canvas, options) {
  const { width, height, origin = { x: 0, y: 0 }, rotate = null, maxK = 1.5, ambient = 1.6 } = options;
  const stage = options.stage || canvas;
  let ctx = canvas.getContext('2d');
  let destroyed = false;
  let currentScale = 1;
  const scale = () => typeof options.scale === 'function' ? options.scale() : currentScale;
  const random = options.platform?.random || Math.random;
  // Stage design coords -> canvas-local coords (undoing the water's rotation, if any).
  const map = (x, y) => {
    if (rotate) {
      const c = Math.cos(-rotate.a), sn = Math.sin(-rotate.a), dx = x - rotate.cx, dy = y - rotate.cy;
      x = rotate.cx + dx * c - dy * sn; y = rotate.cy + dx * sn + dy * c;
    }
    return { x: x - origin.x, y: y - origin.y };
  };
  const tilt = rotate ? -rotate.a : 0;
  /** @type {any} */
  const w = {
    canvas, width, height, origin, stage, map,
    addAt(x, y, opts = {}) { const q = map(x, y); this.add(q.x, q.y, opts); },
    ripples: [], visible: true, last: { x: -1e4, y: -1e4 }, nextAmbient: random() * ambient, ambient,
    add(x, y, { r = 120, dur = 2.2, a = 0.55, lw = 2.2 } = {}) {
      if (destroyed || options.signal?.aborted) return;
      if (this.ripples.length >= 70) this.ripples.shift();
      this.ripples.push({ x, y, r, dur, a, lw, t: 0 });
    },
    // Client coordinates -> this canvas's local design coordinates.
    local(clientX, clientY) {
      const r = this.stage.getBoundingClientRect();
      const s = scale() || 1;
      return map((clientX - r.left) / s, (clientY - r.top) / s);
    },
    /** @param {{ scale?: number, dpr?: number }} [layout] */
    resize({ scale: nextScale, dpr } = {}) {
      if (destroyed || !ctx) return;
      if (nextScale > 0) currentScale = nextScale;
      const deviceRatio = dpr ?? canvas.ownerDocument.defaultView?.devicePixelRatio ?? 1;
      const k = Math.min(scale() * Math.min(deviceRatio || 1, 2), maxK);
      if (!(width > 0 && height > 0 && k > 0)) return;
      canvas.width = Math.max(1, Math.round(width * k));
      canvas.height = Math.max(1, Math.round(height * k));
      ctx.setTransform(k, 0, 0, k, 0, 0);
    },
    update(dt, suppliedPointer = {}, state = {}) {
      if (destroyed || options.signal?.aborted || !ctx || !this.visible) return;
      const pointer = suppliedPointer.pointer || suppliedPointer;
      const reducedMotion = state.reducedMotion ?? suppliedPointer.reducedMotion ?? options.reducedMotion ?? false;
      if (reducedMotion) { this.renderStatic(); return; }
      dt = Math.min(Math.max(dt || 0, 0), 0.05);
      // Cursor wake. Native controls remain independent of this decorative input.
      if ((state.finePointer ?? suppliedPointer.finePointer) !== false) {
        const p = this.local(pointer.cx ?? pointer.x ?? -1e4, pointer.cy ?? pointer.y ?? -1e4);
        if (p.x > 0 && p.y > 0 && p.x < width && p.y < height && Math.hypot(p.x - this.last.x, p.y - this.last.y) > 46) {
          this.add(p.x, p.y, { r: 70, dur: 1.5, a: 0.45, lw: 1.6 });
          this.last = p;
        }
      }
      this.nextAmbient -= dt;
      if (this.nextAmbient <= 0) {
        this.nextAmbient = this.ambient * (0.6 + random() * 0.8);
        this.add(random() * width, random() * height, { r: 90 + random() * 60, dur: 2.8, a: 0.3, lw: 1.4 });
      }
      ctx.clearRect(0, 0, width, height);
      for (let i = this.ripples.length - 1; i >= 0; i--) {
        const rp = this.ripples[i];
        rp.t += dt;
        const k = rp.t / rp.dur;
        if (k >= 1) { this.ripples.splice(i, 1); continue; }
        const e = easeOutCubic(k);
        const alpha = rp.a * Math.pow(1 - k, 1.6);
        for (const [m, am] of [[1, 1], [0.66, 0.6], [0.36, 0.35]]) {
          const r = rp.r * e * m;
          if (r < 2) continue;
          ctx.beginPath();
          ctx.ellipse(rp.x, rp.y, r, r * 0.46, tilt, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255,255,255,${alpha * am})`;
          ctx.lineWidth = rp.lw * (1 - k * 0.6);
          ctx.stroke();
        }
      }
    },
    renderStatic() {
      if (destroyed || !ctx) return;
      this.ripples.length = 0;
      this.last = { x: -1e4, y: -1e4 };
      ctx.clearRect(0, 0, width, height);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      options.signal?.removeEventListener('abort', abort);
      this.ripples.length = 0;
      ctx?.clearRect(0, 0, width, height);
      canvas.width = canvas.height = 0;
      ctx = null;
    },
  };
  const abort = () => w.destroy();
  if (options.signal?.aborted) w.destroy();
  else options.signal?.addEventListener('abort', abort, { once: true });
  return w;
}
