export const VERT = /* glsl */ `
precision highp float;

attribute vec3 position;
attribute float aRand;
attribute vec3 aTarget;   // where this point sits when the form is resolved
attribute vec3 aNormal;   // the surface there, for a solid form; zero for a drawn one

uniform mat4  projectionMatrix;
uniform mat4  modelViewMatrix;
uniform float uTime;
uniform float uZ;         // camera travel, world units
uniform float uDepth;     // total corridor depth before wrap
uniform float uAmp;
uniform vec2  uPointer;
uniform float uDpr;
uniform float uIn;      // 0..1 entrance
uniform float uMorph;   // 0 = terrain, 1 = the form fully resolved
uniform float uJoin;    // aRand threshold above which a point joins the form
uniform vec3  uFormPos; // where the object sits in the corridor
uniform float uFormSize;// world units across the object's longest side
uniform vec2  uSpin;    // yaw, pitch of the object

// four ripple slots — xy = origin in world XZ, z = start time, w = strength
uniform vec4 uRipples[4];

varying float vFog;
varying float vLift;
varying float vRand;
varying float vRing;
varying float vDust;
varying float vMorph;
varying float vForm;
varying float vRim;

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
  // Three scales rather than two. The slowest carries the large forms that give
  // the field a horizon; the middle carries dunes; the fastest carries the
  // grain that keeps it from looking like a smooth cloth.
  float wind = uTime * 0.014;
  float h  = fbm(vec2(pos.x * 0.021, z * 0.021 + wind * 0.5)) * 1.62;   // landforms
  h       += fbm(vec2(pos.x * 0.062, z * 0.062 + wind)) * 0.86;         // dunes
  h       += fbm(vec2(pos.x * 0.185, z * 0.185 - wind * 2.1)) * 0.26;   // grain

  // a ridge line that drifts across the field, so the silhouette never repeats
  float ridge = 1.0 - abs(fbm(vec2(pos.x * 0.034 + wind * 0.4, z * 0.034)));
  h += pow(ridge, 3.0) * 0.72;

  // ── ripples ──
  // A travelling ring: a wave packet whose crest moves outward at uSpeed and
  // decays both with distance and with age, so it reads as a struck surface
  // rather than a standing pattern.
  float ring = 0.0;
  for (int i = 0; i < 4; i++) {
    vec4 rp = uRipples[i];
    if (rp.w <= 0.0) continue;
    float age = uTime - rp.z;
    if (age < 0.0 || age > 15.0) continue;

    float d = distance(vec2(pos.x, z), rp.xy);

    // The packet must be WIDER than its own wavelength or you see less than one
    // oscillation and it reads as jitter rather than a wave.
    //   wavelength = 2pi / 0.20  ~= 31 units
    //   envelope   = 1 / 0.042   ~= 24 units either side of the crest
    // so roughly one and a half cycles live inside the band: a crest with a
    // trough on each shoulder, which is what reads as a struck surface.
    float speed = 7.0;                      // was 15 — a slow, deliberate sweep
    float front = age * speed;
    float band  = exp(-pow((d - front) * 0.034, 2.0));
    float wave  = sin((d - front) * 0.20);
    float fade  = exp(-age * 0.17) * exp(-d * 0.0040);
    ring += wave * band * fade * rp.w;
  }
  h += ring * 2.15;

  pos.y   += h * uAmp;
  pos.z    = z;

  vRing = clamp(abs(ring) * 1.9, 0.0, 1.0);

  // a little pointer lean, so it feels held rather than played
  pos.x += uPointer.x * 1.6;
  pos.y += uPointer.y * 0.9;

  // ── resolve ──
  // Every point carries a second address: where it belongs when the image is
  // formed. The field is raw material; the form is what we make out of it.
  // Points arrive at slightly different rates so the picture assembles rather
  // than snapping into place.
  // Only part of the field joins the form. The rest stays as field, so the
  // image sits IN the material rather than replacing it — and so the form's
  // point density never spikes. How large that part is depends on how much
  // drawing there is: a sparse diagram needs far fewer points than a filled
  // shape, or every line resolves into a row of hot beads.
  float joins = step(uJoin, aRand);
  float lead = 0.62 + aRand * 0.38;
  float m = clamp((uMorph - (1.0 - lead)) / max(lead, 0.001), 0.0, 1.0);
  m = m * m * (3.0 - 2.0 * m) * joins;
  // The object is stored about its own centre; turn it, then set it down.
  vec3 local = aTarget * uFormSize;
  vec3 nrm = aNormal;
  float cy = cos(uSpin.x), sy = sin(uSpin.x);
  local.xz = vec2(local.x * cy + local.z * sy, -local.x * sy + local.z * cy);
  nrm.xz   = vec2(nrm.x * cy + nrm.z * sy, -nrm.x * sy + nrm.z * cy);
  float cp = cos(uSpin.y), sp = sin(uSpin.y);
  local.yz = vec2(local.y * cp - local.z * sp, local.y * sp + local.z * cp);
  nrm.yz   = vec2(nrm.y * cp - nrm.z * sp, nrm.y * sp + nrm.z * cp);
  vec3 formed = uFormPos + local;
  // a little residual drift so a held form still breathes
  formed.x += sin(uTime * 0.5 + aRand * 24.0) * 0.10;
  formed.y += cos(uTime * 0.42 + aRand * 31.0) * 0.10;
  // Between field and form the points do not fly straight: they lift and
  // scatter on the way, so the object gathers out of the air rather than
  // sliding into place along a rail.
  float arc = m * (1.0 - m) * 4.0;
  vec3 via = vec3(sin(aRand * 61.0) * 9.0, 6.0 + aRand * 10.0, cos(aRand * 47.0) * 9.0);
  // The field clears around the object. Points that stay as terrain but sit
  // under or behind it go quiet, so the object is read against dark rather
  // than through the bright ridge it happens to share a screen with.
  float under = smoothstep(uFormSize * 1.05, uFormSize * 0.30,
                           distance(vec2(pos.x, pos.z), uFormPos.xz));
  float clear = under * uMorph * (1.0 - joins);
  pos = mix(pos, formed, m) + via * arc;
  vMorph = m;
  // depth inside the object: the far side dims, so it reads as a solid
  vForm = 0.5 + local.z / max(uFormSize, 1.0);

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  float dist = -mv.z;

  // A solid is drawn by its rim. Faces square to the eye go thin, faces seen
  // edge-on go bright, so the object reads as an outline with a body behind
  // it — a drawing again, not a cloud. A drawn form carries no normal and is
  // lit evenly.
  float hasN = step(0.5, length(aNormal));
  vec3 nv = normalize((modelViewMatrix * vec4(nrm, 0.0)).xyz + vec3(0.0, 0.0, 1.0 - hasN));
  float fs = dot(nv, normalize(-mv.xyz));
  float rim = pow(1.0 - abs(fs), 1.4);
  // the far side of a solid is dimmed, not hidden: enough that the object
  // has a front, not so much that its silhouette loses the far edge
  float back = mix(1.0, 0.36, smoothstep(0.05, -0.15, fs));
  vRim = mix(1.0, (0.50 + rim * 0.50) * back, hasN);

  // Depth cue in two directions. Far points fade into the ground as before —
  // but points very close to the camera must fade too, or perspective balloons
  // them into blown-out discs and the whole field reads as cheap beading.
  float far  = 1.0 - smoothstep(8.0, uDepth * 0.94, dist);
  float near = smoothstep(3.0, 26.0, dist);
  // Entrance: the field arrives from the far end and settles, so the first
  // thing the page does is compose itself rather than snap on.
  float arrive = smoothstep(0.0, 1.0, uIn * 1.9 - (dist / uDepth) * 0.9);
  vFog  = mix(far * near, far, vMorph) * arrive * (1.0 - clear * 0.78);
  pos.y *= mix(0.35, 1.0, arrive);
  vLift = smoothstep(-0.35, 1.25, h);
  vRand = aRand;

  // A third of the field is dust: finer, dimmer, sitting slightly lower. It
  // gives the surface texture between the structural points instead of a
  // uniform lattice.
  vDust = step(0.66, aRand);
  pos.y -= vDust * 0.55;

  gl_Position = projectionMatrix * mv;

  // Small. A point that reads as a grain of light is elegant; one that reads as
  // a bead is not. Ceiling is ~4px at dpr 2, not 13.
  float base = mix(0.94, 3.45, vFog) * (0.80 + aRand * 0.40);
  base *= mix(1.0, 0.46, vDust);
  base *= 1.0 - vMorph * 0.22;
  gl_PointSize = uDpr * base * (1.0 + vRing * 1.15);
}`;

export const FRAG = /* glsl */ `
precision highp float;

uniform vec3 uBone;
uniform vec3 uBrass;
uniform vec3 uDeep;
uniform float uTime;

varying float vFog;
varying float vLift;
varying float vRand;
varying float vRing;
varying float vDust;
varying float vMorph;
varying float vForm;
varying float vRim;

void main(){
  // round, soft-edged point
  vec2 c = gl_PointCoord - 0.5;
  float d = dot(c, c);
  if (d > 0.25) discard;
  float alpha = smoothstep(0.25, 0.02, d);

  // Ridges catch brass, troughs stay cold — and distance cools the whole thing,
  // so the far field recedes in temperature as well as in value.
  vec3 warm = mix(uBone, uBrass, smoothstep(0.48, 0.96, vLift));
  vec3 cool = mix(uDeep, uBone, 0.34);
  vec3 col  = mix(cool, warm, smoothstep(0.15, 0.78, vFog));
  // the object is lit from the front: its near surface takes bone, its far
  // side falls to brass and shade, which is what gives it a body
  vec3 lit = mix(uBrass * 0.55, uBone, smoothstep(0.15, 0.95, vForm));
  col = mix(col, lit, vMorph * 0.85);

  // a slow twinkle on a small minority — never a uniform pulse
  float tw = step(0.93, vRand) * (0.5 + 0.5 * sin(uTime * 1.4 + vRand * 40.0));
  col += uBrass * tw * 0.30;

  // the wavefront lifts out of the field
  col += uBrass * vRing * 1.05;

  // Low alpha. Additive blending accumulates, so density does the work — this
  // is what stops crowded areas clipping to white.
  // brighter overall, and brighter still where the form is resolved
  float a = alpha * vFog * (0.38 + vRand * 0.74);
  a *= mix(1.0, 0.80 * vRim, vMorph);   // rim-weighted, front-lit — see the vertex stage
  a *= mix(1.0, 0.42, vDust);
  a *= (1.0 + vRing * 1.25);

  gl_FragColor = vec4(col, a);
}`;
