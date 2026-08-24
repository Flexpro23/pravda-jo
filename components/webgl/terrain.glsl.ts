export const VERT = /* glsl */ `
precision highp float;

attribute vec3 position;
attribute float aRand;

uniform mat4  projectionMatrix;
uniform mat4  modelViewMatrix;
uniform float uTime;
uniform float uZ;         // camera travel, world units
uniform float uDepth;     // total corridor depth before wrap
uniform float uAmp;
uniform vec2  uPointer;
uniform float uDpr;

varying float vFog;
varying float vLift;
varying float vRand;

// cheap value noise
vec2 h2(vec2 p){
  p = vec2(dot(p, vec2(127.1,311.7)), dot(p, vec2(269.5,183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(dot(h2(i+vec2(0,0)), f-vec2(0,0)), dot(h2(i+vec2(1,0)), f-vec2(1,0)), u.x),
             mix(dot(h2(i+vec2(0,1)), f-vec2(0,1)), dot(h2(i+vec2(1,1)), f-vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for(int i=0;i<4;i++){ v += a*noise(p); p *= 2.03; a *= 0.5; }
  return v;
}

void main(){
  vec3 pos = position;

  // wrap the corridor so the field is infinite
  float z = mod(pos.z + uZ, uDepth) - uDepth;

  // dunes — two scales so ridges read against a slower swell
  float h  = fbm(vec2(pos.x * 0.055, z * 0.055 + uTime * 0.012)) * 1.0;
  h       += fbm(vec2(pos.x * 0.16,  z * 0.16  - uTime * 0.03 )) * 0.34;
  pos.y   += h * uAmp;
  pos.z    = z;

  // a little pointer lean, so it feels held rather than played
  pos.x += uPointer.x * 1.6;
  pos.y += uPointer.y * 0.9;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  float dist = -mv.z;

  vFog  = 1.0 - smoothstep(6.0, uDepth * 0.92, dist);
  vLift = smoothstep(-0.35, 1.25, h);
  vRand = aRand;

  gl_Position = projectionMatrix * mv;
  // near points bloom, far points collapse to specks
  gl_PointSize = uDpr * mix(1.0, 5.2, vFog) * (0.55 + aRand * 0.9);
}`;

export const FRAG = /* glsl */ `
precision highp float;

uniform vec3 uBone;
uniform vec3 uBrass;
uniform float uTime;

varying float vFog;
varying float vLift;
varying float vRand;

void main(){
  // round, soft-edged point
  vec2 c = gl_PointCoord - 0.5;
  float d = dot(c, c);
  if (d > 0.25) discard;
  float alpha = smoothstep(0.25, 0.02, d);

  // ridges catch brass, troughs stay bone-cold
  vec3 col = mix(uBone, uBrass, smoothstep(0.45, 0.95, vLift));

  // a slow twinkle on a minority of points — never a uniform pulse
  float tw = step(0.86, vRand) * (0.55 + 0.45 * sin(uTime * 1.7 + vRand * 40.0));
  col += uBrass * tw * 0.35;

  gl_FragColor = vec4(col, alpha * vFog * (0.30 + vRand * 0.70));
}`;
