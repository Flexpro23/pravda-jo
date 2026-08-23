// The plate shader — grain, registration offset, pointer displacement.
// One draw call, one fullscreen quad. No scene graph, no loaders.

export const VERT = /* glsl */ `
precision highp float;
attribute vec2 position;
varying vec2 vUv;
void main(){
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

export const FRAG = /* glsl */ `
precision highp float;

uniform sampler2D uTex;
uniform vec2  uRes;      // canvas size
uniform vec2  uImg;      // intrinsic image size
uniform vec2  uPointer;  // -1..1, eased
uniform float uTime;
uniform float uReveal;   // 0..1 — drives the registration resolve
uniform float uGrain;
uniform float uRtl;      // 1.0 when the document is RTL

varying vec2 vUv;

// cheap hash noise — no texture fetch
float hash(vec2 p){
  p = fract(p * vec2(443.897, 441.423));
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}

// cover-fit the texture inside the canvas
vec2 cover(vec2 uv, vec2 res, vec2 img){
  float rs = res.x / res.y;
  float ri = img.x / img.y;
  vec2 s = rs < ri ? vec2(ri / rs, 1.0) : vec2(1.0, rs / ri);
  return (uv - 0.5) * s + 0.5;
}

void main(){
  vec2 uv = cover(vUv, uRes, uImg);

  // pointer displacement — falls off from the centre, very small
  float d = distance(vUv, vec2(0.5));
  vec2 push = uPointer * 0.012 * (1.0 - smoothstep(0.0, 0.85, d));
  uv += push;

  // ── the registration ──
  // channels arrive apart and snap together as uReveal -> 1
  float off = (1.0 - uReveal) * 0.010;
  float dir = mix(1.0, -1.0, uRtl);
  vec2 ro = vec2( off * dir, off * 0.35);
  vec2 bo = vec2(-off * dir, -off * 0.35);

  float r = texture2D(uTex, uv + ro).r;
  float g = texture2D(uTex, uv).g;
  float b = texture2D(uTex, uv + bo).b;
  vec3 col = vec3(r, g, b);

  // ── film grain, animated, luminance-weighted so shadows stay clean ──
  float n = hash(vUv * uRes + fract(uTime) * 137.0);
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col += (n - 0.5) * uGrain * (0.35 + lum * 0.65);

  // ── vignette toward the brand ground, not toward black ──
  vec3 ground = vec3(0.047, 0.098, 0.090); // #0C1917
  float vig = smoothstep(1.02, 0.30, d);
  col = mix(ground, col, vig * 0.58 + 0.42);

  // reveal wipe from the leading edge
  float edge = mix(vUv.x, 1.0 - vUv.x, uRtl);
  float wipe = smoothstep(0.0, 0.55, uReveal * 1.55 - edge * 0.55);
  col = mix(ground, col, wipe);

  gl_FragColor = vec4(col, 1.0);
}`;
