export const VERT = `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;

// Line-for-line port of fs_main from water-caustic.js.
export const FRAG = `#version 300 es
precision highp float;
uniform vec2 uDims;
uniform vec4 uWater;
uniform vec4 uHighlight;
uniform float uIntensity;
uniform float uPlayhead;
uniform float uScale;
uniform vec2 uCenter;
out vec4 outColor;
void main() {
  vec2 dims = max(uDims, vec2(1.0));
  vec2 outputUv = vec2(gl_FragCoord.x / dims.x, 1.0 - gl_FragCoord.y / dims.y);
  vec2 uvRaw = outputUv;
  float cx = uCenter.x / 100.0;
  float cy = uCenter.y / 100.0;
  vec2 uv = (uvRaw - vec2(cx, cy)) / uScale + vec2(1.0 - cx, 1.0 - cy);
  float TAU = 6.28318530718;
  float t_val = uPlayhead * TAU / 100.0 + 23.0;
  float minDim = min(dims.x, dims.y);
  vec2 uvPx = uv * dims / minDim;
  vec2 p = (fract(uvPx) * TAU) - 250.0;
  vec2 i = p;
  float c = 1.0;
  float inten = mix(0.002519, 0.01178, uIntensity);
  for (int n = 0; n < 5; n++) {
    float nt = t_val * float(n + 1);
    i = p + vec2(cos(nt - i.x) + sin(nt + i.y), sin(nt - i.y) + cos(nt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + nt) / inten), p.y / (cos(i.y + nt) / inten)));
  }
  c /= 5.0;
  c = 1.17 - pow(c, 1.4);
  float causticMask = clamp(pow(abs(c), 8.0), 0.0, 1.0);
  float alpha = mix(uWater.a, uHighlight.a, causticMask);
  vec3 colour = mix(uWater.rgb, uHighlight.rgb, causticMask);
  outColor = vec4(colour * alpha, alpha);
}`;
