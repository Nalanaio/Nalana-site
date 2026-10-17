// @ts-nocheck
// Small allocation ledger shared by the source-derived decorative renderers.
// No browser resources are created by importing this module.
export function makeCanvas(platform, document, width = 1, height = 1) {
  const canvas = platform?.createCanvas ? platform.createCanvas() : document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

export function ownGL(canvas, options = {}, onLoss = () => {}) {
  const gl = canvas.getContext('webgl2', options);
  if (!gl) return null;
  const shaders = new Set(), programs = new Set(), buffers = new Set(), textures = new Set();
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    canvas.removeEventListener('webglcontextlost', lost);
    for (const [items, release] of [[textures, 'deleteTexture'], [buffers, 'deleteBuffer'], [programs, 'deleteProgram'], [shaders, 'deleteShader']]) {
      for (const item of items) { try { gl[release](item); } catch { /* Already invalidated by context loss. */ } }
      items.clear();
    }
  };
  const lost = () => { dispose(); onLoss(); };
  canvas.addEventListener('webglcontextlost', lost);
  const allocate = (method, set, ...args) => {
    if (disposed) throw new Error('Renderer disposed');
    const result = gl[method](...args);
    if (!result) throw new Error(`${method} allocation failed`);
    set.add(result);
    return result;
  };
  return {
    gl, canvas,
    get active() { return !disposed; },
    shader(type, source) {
      const shader = allocate('createShader', shaders, type);
      gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'Shader compilation failed');
      return shader;
    },
    program(vertex, fragment) {
      const program = allocate('createProgram', programs);
      gl.attachShader(program, this.shader(gl.VERTEX_SHADER, vertex));
      gl.attachShader(program, this.shader(gl.FRAGMENT_SHADER, fragment));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'Shader link failed');
      return program;
    },
    buffer() { return allocate('createBuffer', buffers); },
    texture() { return allocate('createTexture', textures); },
    deleteTexture(texture) { if (textures.delete(texture)) gl.deleteTexture(texture); },
    destroy: dispose
  };
}
