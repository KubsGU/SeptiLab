import * as THREE from 'three';

/* Shared glow palette (values > 1 push into bloom) */
export const GLOW_BLUE = new THREE.Color(0.42, 0.62, 1.45);
export const GLOW_RED = new THREE.Color(1.55, 0.36, 0.24);
export const GLOW_GREEN = new THREE.Color(0.16, 0.82, 0.4);

function gauss(rand) {
  return (rand() + rand() + rand() + rand() - 2) / 2; // approx normal in [-1, 1]
}

function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 19) % 2147483647;
    return (s & 0xfffff) / 0xfffff;
  };
}

/* ------------------------------------------------------------------
   Dotted comet trail: instanced flat discs scattered in a band along
   a curve. A bright wavefront ("head") travels with uHead (0..1),
   leaving a dimming afterglow behind it.
------------------------------------------------------------------- */
export function buildTrailDots(curve, { count = 2600, width = 1.9, seed = 5 } = {}) {
  const base = new THREE.CircleGeometry(0.085, 10);
  base.rotateX(-Math.PI / 2);

  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.attributes.position = base.attributes.position;
  geo.attributes.uv = base.attributes.uv;

  const rand = rng(seed);
  const offsets = new Float32Array(count * 3);
  const ts = new Float32Array(count);
  const sizes = new Float32Array(count);
  const rands = new Float32Array(count);

  const pt = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i < count; i++) {
    const t = rand();
    const lat = gauss(rand) * width;
    curve.getPointAt(t, pt);
    curve.getTangentAt(t, tan);
    nrm.crossVectors(tan, UP).normalize();
    const latFrac = Math.min(Math.abs(lat) / width, 1);
    offsets[i * 3] = pt.x + nrm.x * lat;
    offsets[i * 3 + 1] = 0.045 + rand() * 0.02;
    offsets[i * 3 + 2] = pt.z + nrm.z * lat;
    ts[i] = t;
    sizes[i] = (0.55 + rand() * 0.85) * (1.15 - latFrac * 0.75);
    rands[i] = rand();
  }

  geo.setAttribute('iOffset', new THREE.InstancedBufferAttribute(offsets, 3));
  geo.setAttribute('iT', new THREE.InstancedBufferAttribute(ts, 1));
  geo.setAttribute('iSize', new THREE.InstancedBufferAttribute(sizes, 1));
  geo.setAttribute('iRand', new THREE.InstancedBufferAttribute(rands, 1));
  geo.instanceCount = count;

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uHead: { value: 0 },
      uHeadBoost: { value: 1 },
      uTime: { value: 0 },
      uFade: { value: 1 },
      uColor: { value: GLOW_GREEN.clone() },
    },
    vertexShader: /* glsl */ `
      attribute vec3 iOffset;
      attribute float iT;
      attribute float iSize;
      attribute float iRand;
      uniform float uHead;
      uniform float uHeadBoost;
      uniform float uTime;
      varying float vB;
      void main() {
        float d = uHead - iT;
        float head = exp(-pow(d * 26.0, 2.0)) * uHeadBoost;
        float trail = d > 0.0 ? exp(-d * 7.5) * 0.42 : 0.0;
        float flick = 0.85 + 0.3 * sin(uTime * 2.8 + iRand * 6.2831);
        float b = (head * 0.72 + trail) * flick;
        b *= smoothstep(0.0, 0.015, iT);
        b *= smoothstep(0.0, 0.02, uHead);
        vB = b;
        vec3 p = position * iSize * (1.0 + head * 0.8) + iOffset;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uFade;
      varying float vB;
      void main() {
        float b = vB * uFade;
        if (b < 0.015) discard;
        gl_FragColor = vec4(uColor * b, min(b, 1.0));
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

/* ------------------------------------------------------------------
   Static halftone dot band (e.g. around the arrow / beam corridor)
------------------------------------------------------------------- */
export function buildDotField(cx, cz, w, d, { pitch = 0.55, seed = 11 } = {}) {
  const cols = Math.floor(w / pitch);
  const rows = Math.floor(d / pitch);
  const count = cols * rows;
  const base = new THREE.CircleGeometry(0.07, 8);
  base.rotateX(-Math.PI / 2);

  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.attributes.position = base.attributes.position;
  geo.attributes.uv = base.attributes.uv;

  const rand = rng(seed);
  const offsets = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const rands = new Float32Array(count);
  let i = 0;
  for (let a = 0; a < cols; a++)
    for (let b = 0; b < rows; b++) {
      const x = cx - w / 2 + a * pitch;
      const z = cz - d / 2 + b * pitch;
      const fz = 1 - Math.abs(z - cz) / (d / 2);
      offsets[i * 3] = x;
      offsets[i * 3 + 1] = 0.04;
      offsets[i * 3 + 2] = z;
      sizes[i] = (0.5 + rand() * 0.6) * (0.35 + fz * 0.85);
      rands[i] = rand();
      i++;
    }
  geo.setAttribute('iOffset', new THREE.InstancedBufferAttribute(offsets, 3));
  geo.setAttribute('iSize', new THREE.InstancedBufferAttribute(sizes, 1));
  geo.setAttribute('iRand', new THREE.InstancedBufferAttribute(rands, 1));
  geo.instanceCount = count;

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uWave: { value: -0.2 }, // 0..1 sweep across width (x)
      uAmbient: { value: 0.1 },
      uColor: { value: GLOW_GREEN.clone() },
      uMinX: { value: cx - w / 2 },
      uMaxX: { value: cx + w / 2 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 iOffset;
      attribute float iSize;
      attribute float iRand;
      uniform float uTime;
      uniform float uWave;
      uniform float uAmbient;
      uniform float uMinX;
      uniform float uMaxX;
      varying float vB;
      void main() {
        float fx = (iOffset.x - uMinX) / (uMaxX - uMinX);
        float d = uWave - fx;
        float wave = exp(-pow(d * 9.0, 2.0)) * 1.4 + (d > 0.0 ? exp(-d * 4.0) * 0.5 : 0.0);
        float tw = 0.75 + 0.25 * sin(uTime * 2.2 + iRand * 6.2831);
        vB = (uAmbient * tw + wave) ;
        vec3 p = position * iSize + iOffset;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vB;
      void main() {
        if (vB < 0.02) discard;
        gl_FragColor = vec4(uColor * vB, min(vB, 1.0));
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

/* ------------------------------------------------------------------
   Red strands: parallel tubes arcing from the city into the HQ face,
   with flowing dashes. uDraw draws them on; uTime flows the dashes.
------------------------------------------------------------------- */
export function buildStrands(startPoints, endPoints, arcHeight = 5, color = GLOW_BLUE) {
  const g = new THREE.Group();
  const mats = [];
  for (let k = 0; k < startPoints.length; k++) {
    const a = startPoints[k];
    const b = endPoints[k];
    const mid1 = a.clone().lerp(b, 0.34);
    mid1.y = Math.max(a.y, b.y) + arcHeight * (0.85 + k * 0.06);
    const mid2 = a.clone().lerp(b, 0.72);
    mid2.y = Math.max(a.y, b.y) + arcHeight * 0.45;
    const curve = new THREE.CatmullRomCurve3([a, mid1, mid2, b]);
    const geo = new THREE.TubeGeometry(curve, 90, 0.055, 6, false);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uDraw: { value: 0 },
        uTime: { value: 0 },
        uColor: { value: color.clone() },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uDraw;
        uniform float uTime;
        uniform vec3 uColor;
        varying vec2 vUv;
        void main() {
          float visible = 1.0 - smoothstep(uDraw - 0.04, uDraw, vUv.x);
          if (visible < 0.01) discard;
          float dash = 0.62 + 0.38 * sin(vUv.x * 70.0 - uTime * 6.0);
          float headGlow = exp(-pow((vUv.x - uDraw) * 18.0, 2.0)) * 0.7;
          vec3 col = uColor * (0.6 + 0.4 * dash + headGlow);
          gl_FragColor = vec4(col, visible * (0.72 + 0.22 * dash));
        }
      `,
      transparent: true,
      depthWrite: false,
    });
    mats.push(mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    g.add(mesh);
  }
  g.userData.mats = mats;
  return g;
}

/* ------------------------------------------------------------------
   Glow head sprite + utility textures
------------------------------------------------------------------- */
export function makeGlowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(120,170,255,0)') {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.32, 'rgba(210,245,225,0.5)');
  grad.addColorStop(1, outer);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function buildHeadGlow() {
  const mat = new THREE.SpriteMaterial({
    map: makeGlowTexture('rgba(225,255,235,1)', 'rgba(50,205,125,0)'),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    color: new THREE.Color(0.7, 1.4, 1.0),
    opacity: 0,
  });
  const s = new THREE.Sprite(mat);
  s.scale.setScalar(3.4);
  return s;
}

/* ------------------------------------------------------------------
   Beam: stretched additive plane + tip flare, for the finale
------------------------------------------------------------------- */
export function buildBeam(length = 16, y = 3) {
  const g = new THREE.Group();
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');
  const lg = ctx.createLinearGradient(0, 0, 256, 0);
  lg.addColorStop(0, 'rgba(120,235,165,0)');
  lg.addColorStop(0.75, 'rgba(210,255,228,0.85)');
  lg.addColorStop(1, 'rgba(255,255,255,1)');
  ctx.fillStyle = lg;
  ctx.fillRect(0, 0, 256, 64);
  // vertical falloff
  const ig = ctx.createLinearGradient(0, 0, 0, 64);
  ig.addColorStop(0, 'rgba(0,0,0,1)');
  ig.addColorStop(0.5, 'rgba(0,0,0,0)');
  ig.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = ig;
  ctx.fillRect(0, 0, 256, 64);
  const tex = new THREE.CanvasTexture(c);

  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    color: new THREE.Color(0.8, 1.5, 1.1),
    side: THREE.DoubleSide,
    opacity: 0,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(length, 0.6), mat);
  plane.position.set(-length / 2, 0, 0);
  g.add(plane);

  const flare = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeGlowTexture('rgba(230,255,238,1)', 'rgba(60,210,130,0)'),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      color: new THREE.Color(0.9, 1.6, 1.2),
      opacity: 0,
    })
  );
  flare.scale.setScalar(1.6);
  g.add(flare);

  g.position.y = y;
  g.userData = { plane, mat, flare, length };
  return g;
}

/* ------------------------------------------------------------------
   Expanding pulse ring (grid step)
------------------------------------------------------------------- */
export function buildPulseRing() {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: GLOW_GREEN.clone().multiplyScalar(1.4) },
      uOpacity: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float r = length(vUv - 0.5) * 2.0;
        float ring = smoothstep(0.62, 0.92, r) * (1.0 - smoothstep(0.92, 1.0, r));
        float fill = (1.0 - smoothstep(0.0, 0.9, r)) * 0.1;
        float a = (ring + fill) * uOpacity;
        if (a < 0.01) discard;
        gl_FragColor = vec4(uColor, a);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  m.rotation.x = -Math.PI / 2;
  m.scale.setScalar(0.001);
  return m;
}

/* ------------------------------------------------------------------
   Dashed highlight rectangle (zone marker around the HQ)
------------------------------------------------------------------- */
export function buildZoneRect(w, d, color = 0x3b66ff) {
  const pts = [];
  const hw = w / 2;
  const hd = d / 2;
  const corners = [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
    [-hw, -hd],
  ];
  for (const [x, z] of corners) pts.push(new THREE.Vector3(x, 0.06, z));
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineDashedMaterial({
    color,
    dashSize: 0.42,
    gapSize: 0.3,
    transparent: true,
    opacity: 0,
  });
  const line = new THREE.Line(geo, mat);
  line.computeLineDistances();
  return line;
}
