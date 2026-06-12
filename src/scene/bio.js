import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PALETTE, whiteMat } from './builders.js';
import { makeGlowTexture } from './trail.js';

/* ----------------------------------------------------------- materials */
export const steelMat = new THREE.MeshStandardMaterial({
  color: 0xe7edf4,
  roughness: 0.5,
  metalness: 0.12,
});
export const accentMat = new THREE.MeshStandardMaterial({
  color: 0x44588c,
  roughness: 0.6,
  metalness: 0.1,
});
export const glassMat = new THREE.MeshStandardMaterial({
  color: 0xf2f7fc,
  roughness: 0.08,
  metalness: 0,
  transparent: true,
  opacity: 0.26,
  depthWrite: false,
});
export const labelMat = new THREE.MeshStandardMaterial({
  color: 0xeef2f8,
  roughness: 0.85,
});

const CULTURE = new THREE.Color(0.14, 0.72, 0.36);

export function liquidMat(strength = 0.35) {
  return new THREE.MeshStandardMaterial({
    color: 0x2fbf6a,
    roughness: 0.35,
    emissive: 0x2fd17a,
    emissiveIntensity: strength,
    transparent: true,
    opacity: 0.85,
  });
}

const rndCache = new Map();
function rbox(w, h, d, r = 0.05) {
  const key = `${w}|${h}|${d}|${r}`;
  if (!rndCache.has(key)) rndCache.set(key, new RoundedBoxGeometry(w, h, d, 2, Math.min(r, h / 2.2, w / 2.2, d / 2.2)));
  return rndCache.get(key);
}
export function box(w, h, d, x, y, z, mat = whiteMat, r = 0.05) {
  const m = new THREE.Mesh(rbox(w, h, d, r), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
function cyl(rt, rb, h, seg = 20, mat = whiteMat) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807 + 19) % 2147483647) & 0xfffff) / 0xfffff;
}

/* ============================================================ shared FX
   Culture fill: a glowing green liquid surface inside a tank that rises
   with uLevel (0..1) and shimmers with uTime. Cheap, blooms at the top. */
export function buildCultureFill(radius, height, seg = 22) {
  const geo = new THREE.CylinderGeometry(radius, radius, height, seg, 1, true);
  geo.translate(0, height / 2, 0); // base at y=0
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uLevel: { value: 0 },
      uTime: { value: 0 },
      uColor: { value: CULTURE.clone() },
      uHeight: { value: height },
    },
    vertexShader: /* glsl */ `
      uniform float uHeight;
      varying float vY;
      varying float vA;
      void main() {
        vY = position.y / uHeight;
        vA = atan(position.z, position.x);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uLevel;
      uniform float uTime;
      uniform vec3 uColor;
      varying float vY;
      varying float vA;
      void main() {
        if (vY > uLevel || uLevel < 0.001) discard;
        float men = smoothstep(uLevel - 0.06, uLevel, vY);
        float streak = 0.5 + 0.5 * sin(vA * 7.0 + uTime * 1.6 + vY * 5.0);
        float depth = 0.4 + 0.5 * vY;
        vec3 col = uColor * (depth + men * 1.05 + streak * 0.1);
        gl_FragColor = vec4(col, 0.8);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(geo, mat);
  m.userData.mat = mat;
  return m;
}

export function buildBubbles(radius, height, count = 16) {
  const g = new THREE.Group();
  const tex = makeGlowTexture('rgba(220,255,235,1)', 'rgba(60,210,130,0)');
  const items = [];
  const rand = rng(99);
  for (let i = 0; i < count; i++) {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        color: new THREE.Color(0.4, 1.0, 0.6),
        opacity: 0,
      })
    );
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * radius * 0.8;
    s.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    s.scale.setScalar(0.12 + rand() * 0.16);
    g.add(s);
    items.push({ s, phase: rand(), speed: 0.18 + rand() * 0.2, x: s.position.x, z: s.position.z });
  }
  g.userData = { items, height, active: 0 };
  return g;
}

/* ============================================================ ZONE 1 — nature */
export function buildTree(seed = 1) {
  const g = new THREE.Group();
  const rand = rng(seed);
  const h = 1.6 + rand() * 1.2;
  const trunk = cyl(0.08, 0.13, h, 7);
  trunk.position.y = h / 2;
  g.add(trunk);
  const foliage = new THREE.Group();
  const tiers = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < tiers; i++) {
    const r = (0.8 - i * 0.18) * (0.9 + rand() * 0.2);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, 0.95, 9), whiteMat);
    cone.position.y = h + 0.1 + i * 0.55;
    cone.castShadow = true;
    foliage.add(cone);
  }
  g.add(foliage);
  g.userData.sway = foliage;
  g.userData.swayBase = rand() * Math.PI * 2;
  return g;
}

export function buildBush(seed = 2) {
  const g = new THREE.Group();
  const rand = rng(seed);
  const n = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const r = 0.3 + rand() * 0.35;
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), whiteMat);
    blob.position.set((rand() - 0.5) * 0.8, r * 0.7, (rand() - 0.5) * 0.8);
    blob.castShadow = true;
    g.add(blob);
  }
  g.userData.sway = g;
  g.userData.swayBase = rand() * Math.PI * 2;
  return g;
}

export function buildSoilMound(radius = 1.6) {
  const g = new THREE.Group();
  const mound = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    whiteMat
  );
  mound.scale.y = 0.42;
  mound.castShadow = true;
  mound.receiveShadow = true;
  g.add(mound);
  const rand = rng(7);
  for (let i = 0; i < 5; i++) {
    const r = 0.1 + rand() * 0.16;
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), steelMat);
    const a = rand() * Math.PI * 2;
    rock.position.set(Math.cos(a) * radius * 0.7, 0.05, Math.sin(a) * radius * 0.7);
    rock.castShadow = true;
    g.add(rock);
  }
  return g;
}

export function buildCompost() {
  const g = new THREE.Group();
  // open wooden-bin compost as a low rounded heap inside a frame
  g.add(box(2.0, 0.9, 1.6, 0, 0.45, 0, steelMat, 0.06));
  const heap = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95, 1), whiteMat);
  heap.scale.set(1, 0.55, 0.8);
  heap.position.y = 0.95;
  heap.castShadow = true;
  g.add(heap);
  return g;
}

/* glowing sampling flask on a tripod — origin of the culture path */
export function buildSampleStation() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = cyl(0.025, 0.025, 1.1, 5, steelMat);
    leg.position.set(Math.cos(a) * 0.32, 0.5, Math.sin(a) * 0.32);
    leg.rotation.z = Math.cos(a) * 0.18;
    leg.rotation.x = -Math.sin(a) * 0.18;
    g.add(leg);
  }
  const flask = buildFlask(0.55, true);
  flask.position.y = 1.0;
  g.add(flask);
  g.userData.fill = flask.userData.fill;
  g.userData.glow = flask.userData.glow;
  return g;
}

/* ============================================================ ZONE 2 — lab */
export function buildFlask(scale = 1, glowing = false) {
  const g = new THREE.Group();
  // Erlenmeyer: truncated cone body + neck
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * scale, 0.5 * scale, 0.7 * scale, 18, 1, true), glassMat);
  body.position.y = 0.35 * scale;
  g.add(body);
  const baseDisc = new THREE.Mesh(new THREE.CircleGeometry(0.5 * scale, 18), glassMat);
  baseDisc.rotation.x = -Math.PI / 2;
  baseDisc.position.y = 0.001;
  g.add(baseDisc);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * scale, 0.18 * scale, 0.4 * scale, 14, 1, true), glassMat);
  neck.position.y = 0.9 * scale;
  g.add(neck);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.17 * scale, 0.03 * scale, 6, 14), glassMat);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = 1.1 * scale;
  g.add(lip);
  // liquid
  const fill = buildCultureFill(0.46 * scale, 0.5 * scale, 16);
  fill.scale.set(1, 1, 1);
  fill.position.y = 0.02;
  fill.userData.mat.uniforms.uLevel.value = glowing ? 0.62 : 0.0;
  g.add(fill);
  g.userData.fill = fill;
  if (glowing) {
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeGlowTexture('rgba(225,255,235,1)', 'rgba(50,205,125,0)'),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        color: new THREE.Color(0.4, 1.1, 0.7),
        opacity: 0.32,
      })
    );
    glow.scale.setScalar(1.15 * scale);
    glow.position.y = 0.4 * scale;
    g.add(glow);
    g.userData.glow = glow;
  }
  g.castShadow = true;
  return g;
}

export function buildTestTube(fillLevel = 0.55) {
  const g = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.7, 12, 1, true), glassMat);
  tube.position.y = 0.45;
  g.add(tube);
  const bottom = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), glassMat);
  bottom.position.y = 0.1;
  g.add(bottom);
  const liq = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.4 * fillLevel + 0.1, 12), liquidMat(0.4));
  liq.position.y = 0.18 + (0.4 * fillLevel + 0.1) / 2 - 0.05;
  g.add(liq);
  return g;
}

export function buildTubeRack(n = 6) {
  const g = new THREE.Group();
  g.add(box(n * 0.26 + 0.2, 0.12, 0.45, (n - 1) * 0.13, 0.18, 0, steelMat, 0.03));
  g.add(box(n * 0.26 + 0.2, 0.34, 0.45, (n - 1) * 0.13, 0.34, 0, steelMat, 0.03));
  const rand = rng(21);
  for (let i = 0; i < n; i++) {
    const t = buildTestTube(0.4 + rand() * 0.5);
    t.position.set(i * 0.26, 0.22, 0);
    g.add(t);
  }
  return g;
}

export function buildPetriStack(count = 3) {
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const dish = cyl(0.42, 0.42, 0.1, 22, glassMat);
    dish.position.y = 0.06 + i * 0.12;
    g.add(dish);
    const agar = cyl(0.36, 0.36, 0.05, 22, liquidMat(0.18));
    agar.material.opacity = 0.9;
    agar.position.y = 0.05 + i * 0.12;
    g.add(agar);
  }
  return g;
}

export function buildMicroscope() {
  const g = new THREE.Group();
  g.add(box(0.6, 0.12, 0.5, 0, 0.06, 0, steelMat, 0.04));
  const arm = box(0.16, 0.9, 0.16, -0.12, 0.5, 0, steelMat, 0.04);
  g.add(arm);
  const head = box(0.2, 0.18, 0.45, 0.05, 0.92, 0, accentMat, 0.05);
  g.add(head);
  const ocular = cyl(0.05, 0.07, 0.3, 10, accentMat);
  ocular.position.set(0.05, 1.12, -0.16);
  ocular.rotation.x = 0.5;
  g.add(ocular);
  const lens = cyl(0.05, 0.05, 0.18, 10, steelMat);
  lens.position.set(0.12, 0.74, 0.0);
  g.add(lens);
  const stage = box(0.34, 0.05, 0.34, 0.12, 0.6, 0, steelMat, 0.02);
  g.add(stage);
  return g;
}

export function buildLabBench() {
  const g = new THREE.Group();
  g.add(box(6.4, 0.9, 2.0, 0, 0.45, 0, steelMat, 0.05));
  g.add(box(6.4, 0.12, 2.0, 0, 0.97, 0, whiteMat, 0.03));

  const rack = buildTubeRack(6);
  rack.position.set(-2.4, 1.0, 0.2);
  g.add(rack);
  const petri = buildPetriStack(3);
  petri.position.set(-0.7, 1.0, 0.3);
  g.add(petri);
  const scope = buildMicroscope();
  scope.position.set(1.2, 1.0, 0.0);
  g.add(scope);
  for (let i = 0; i < 3; i++) {
    const f = buildFlask(0.6, i === 1);
    f.position.set(2.4 + i * 0.7, 1.0, 0.2);
    g.add(f);
    if (i === 1) g.userData.heroFlask = f;
  }
  return g;
}

/* ============================================================ ZONE 3 — inoculation */
export function buildSmallFermenter(scale = 1) {
  const g = new THREE.Group();
  const r = 0.7 * scale;
  const h = 1.7 * scale;
  // legs
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = cyl(0.04, 0.04, 0.6 * scale, 6, steelMat);
    leg.position.set(Math.cos(a) * r * 0.7, 0.3 * scale, Math.sin(a) * r * 0.7);
    g.add(leg);
  }
  const body = cyl(r, r, h, 22, steelMat);
  body.position.y = 0.6 * scale + h / 2;
  g.add(body);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2), steelMat);
  dome.position.y = 0.6 * scale + h;
  g.add(dome);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(r, 0.5 * scale, 22), steelMat);
  cone.rotation.x = Math.PI;
  cone.position.y = 0.6 * scale - 0.25 * scale;
  g.add(cone);
  // stir motor
  const motor = cyl(0.13 * scale, 0.16 * scale, 0.34 * scale, 10, accentMat);
  motor.position.y = 0.6 * scale + h + r * 0.55;
  g.add(motor);
  // sight glass
  const sight = cyl(0.07 * scale, 0.07 * scale, 0.5 * scale, 8, accentMat);
  sight.position.set(r, 0.6 * scale + h * 0.5, 0);
  g.add(sight);
  // culture fill
  const fill = buildCultureFill(r * 0.93, h, 22);
  fill.position.y = 0.6 * scale;
  g.add(fill);
  g.userData.fill = fill;
  g.userData.topY = 0.6 * scale + h;
  g.userData.radius = r;
  return g;
}

export function buildShakerTable() {
  const g = new THREE.Group();
  g.add(box(2.4, 0.7, 1.6, 0, 0.35, 0, steelMat, 0.05));
  const platform = box(2.2, 0.1, 1.4, 0, 0.75, 0, accentMat, 0.03);
  g.add(platform);
  const flasks = [];
  const rand = rng(33);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 2; j++) {
      const f = buildFlask(0.55, true);
      f.position.set(-0.6 + i * 0.6, 0.8, -0.35 + j * 0.7);
      platform.add(f);
      flasks.push(f);
    }
  g.userData.platform = platform;
  g.userData.flasks = flasks;
  return g;
}

/* ============================================================ ZONE 4 — bioreactor */
export function buildBioreactor(scale = 1) {
  const g = new THREE.Group();
  const r = 1.5 * scale;
  const h = 4.0 * scale;
  const baseY = 0.9 * scale;
  // legs
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = cyl(0.07 * scale, 0.07 * scale, baseY + 0.4 * scale, 8, steelMat);
    leg.position.set(Math.cos(a) * r * 0.78, (baseY + 0.4 * scale) / 2, Math.sin(a) * r * 0.78);
    g.add(leg);
  }
  const cone = new THREE.Mesh(new THREE.ConeGeometry(r, 0.9 * scale, 26), steelMat);
  cone.rotation.x = Math.PI;
  cone.position.y = baseY + 0.45 * scale;
  g.add(cone);
  const body = cyl(r, r, h, 28, steelMat);
  body.position.y = baseY + 0.9 * scale + h / 2;
  g.add(body);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), steelMat);
  dome.position.y = baseY + 0.9 * scale + h;
  g.add(dome);
  // agitator motor (spins)
  const motorBase = cyl(0.2 * scale, 0.24 * scale, 0.3 * scale, 12, steelMat);
  motorBase.position.y = baseY + 0.9 * scale + h + r * 0.62;
  g.add(motorBase);
  const motor = cyl(0.18 * scale, 0.18 * scale, 0.5 * scale, 12, accentMat);
  motor.position.y = baseY + 0.9 * scale + h + r * 0.62 + 0.4 * scale;
  g.add(motor);
  // control box + sight glasses + ladder
  g.add(box(0.5 * scale, 0.8 * scale, 0.2 * scale, r + 0.18 * scale, baseY + 1.6 * scale, 0, accentMat, 0.04));
  for (let i = 0; i < 3; i++) {
    const sg = cyl(0.09 * scale, 0.09 * scale, 0.55 * scale, 8, accentMat);
    sg.position.set(r, baseY + 1.2 * scale + i * 1.0 * scale, 0.5 * scale);
    g.add(sg);
  }
  // vertical pipe
  const pipe = cyl(0.08 * scale, 0.08 * scale, h, 8, steelMat);
  pipe.position.set(-r - 0.12 * scale, baseY + 0.9 * scale + h / 2, 0.3 * scale);
  g.add(pipe);
  // culture
  const fill = buildCultureFill(r * 0.95, h, 28);
  fill.position.y = baseY + 0.9 * scale;
  g.add(fill);
  const bubbles = buildBubbles(r * 0.85, h, scale > 0.9 ? 18 : 10);
  bubbles.position.y = baseY + 0.9 * scale;
  g.add(bubbles);

  g.userData = { motor, fill, bubbles, topY: baseY + 0.9 * scale + h, radius: r, fillBaseY: baseY + 0.9 * scale, fillHeight: h };
  return g;
}

export function buildPipeRun(a, b, radius = 0.1) {
  const mid1 = a.clone().lerp(b, 0.4);
  mid1.y = Math.min(a.y, b.y) - 0.0;
  const curve = new THREE.CatmullRomCurve3([a, new THREE.Vector3(a.x, b.y, a.z).lerp(b, 0.1), b]);
  const geo = new THREE.TubeGeometry(curve, 24, radius, 8, false);
  const m = new THREE.Mesh(geo, steelMat);
  m.castShadow = true;
  return m;
}

/* ============================================================ ZONE 5 — drying */
export function buildSprayDryer(scale = 1) {
  const g = new THREE.Group();
  const r = 1.3 * scale;
  const chamberH = 2.8 * scale;
  const coneH = 2.4 * scale;
  const baseY = coneH + 0.6 * scale;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = cyl(0.07 * scale, 0.07 * scale, baseY, 8, steelMat);
    leg.position.set(Math.cos(a) * r * 0.7, baseY / 2, Math.sin(a) * r * 0.7);
    g.add(leg);
  }
  const cone = new THREE.Mesh(new THREE.ConeGeometry(r, coneH, 26), steelMat);
  cone.rotation.x = Math.PI;
  cone.position.y = baseY + coneH / 2;
  g.add(cone);
  const chamber = cyl(r, r, chamberH, 28, steelMat);
  chamber.position.y = baseY + coneH + chamberH / 2;
  g.add(chamber);
  const top = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2), steelMat);
  top.position.y = baseY + coneH + chamberH;
  g.add(top);
  // hot-air box on top + inlet duct
  g.add(box(0.7 * scale, 0.5 * scale, 0.7 * scale, 0, baseY + coneH + chamberH + r * 0.5, 0, accentMat, 0.04));
  // mist sprite anchor near the cone tip (outlet)
  g.userData.outlet = new THREE.Vector3(0, baseY - 0.1 * scale, 0);
  g.userData.topInlet = new THREE.Vector3(0, baseY + coneH + chamberH + r * 0.5, 0);
  g.userData.ductTop = baseY + coneH + chamberH * 0.6;
  g.userData.r = r;
  return g;
}

export function buildCyclone(scale = 1) {
  const g = new THREE.Group();
  const r = 0.7 * scale;
  const cylH = 1.0 * scale;
  const coneH = 1.6 * scale;
  const baseY = coneH + 0.5 * scale;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = cyl(0.05 * scale, 0.05 * scale, baseY, 6, steelMat);
    leg.position.set(Math.cos(a) * r * 0.7, baseY / 2, Math.sin(a) * r * 0.7);
    g.add(leg);
  }
  const cone = new THREE.Mesh(new THREE.ConeGeometry(r, coneH, 20), steelMat);
  cone.rotation.x = Math.PI;
  cone.position.y = baseY + coneH / 2;
  g.add(cone);
  const body = cyl(r, r, cylH, 20, steelMat);
  body.position.y = baseY + coneH + cylH / 2;
  g.add(body);
  const lid = cyl(r, r, 0.12 * scale, 20, accentMat);
  lid.position.y = baseY + coneH + cylH;
  g.add(lid);
  g.userData.inlet = new THREE.Vector3(0, baseY + coneH + cylH * 0.7, 0);
  return g;
}

export function buildCentrifuge() {
  const g = new THREE.Group();
  g.add(box(1.8, 0.6, 1.8, 0, 0.3, 0, steelMat, 0.06));
  const drum = cyl(0.8, 0.8, 0.7, 24, steelMat);
  drum.position.y = 0.95;
  g.add(drum);
  const lid = cyl(0.82, 0.82, 0.14, 24, accentMat);
  lid.position.y = 1.35;
  g.add(lid);
  const knob = cyl(0.1, 0.1, 0.16, 10, accentMat);
  knob.position.y = 1.48;
  g.add(knob);
  g.userData.lid = lid;
  return g;
}

export function buildPowderPile(radius = 1.1) {
  const g = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, radius * 0.7, 26), labelMat);
  cone.position.y = radius * 0.35;
  cone.castShadow = true;
  cone.receiveShadow = true;
  g.add(cone);
  // faint sparkle
  const spark = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeGlowTexture('rgba(255,255,255,1)', 'rgba(170,235,200,0)'),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0,
    })
  );
  spark.scale.setScalar(1.6);
  spark.position.y = radius * 0.5;
  g.add(spark);
  g.scale.setScalar(0.001);
  g.userData.spark = spark;
  return g;
}

export function buildSacks(n = 4) {
  const g = new THREE.Group();
  const rand = rng(12);
  for (let i = 0; i < n; i++) {
    const sack = box(0.8, 0.55, 0.55, (i % 2) * 0.9, 0.28 + Math.floor(i / 2) * 0.56, (i % 3) * 0.1, labelMat, 0.18);
    sack.rotation.y = (rand() - 0.5) * 0.3;
    g.add(sack);
  }
  return g;
}

/* ============================================================ ZONE 6 — product */
function makeJarLabel() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f4f6fa';
  ctx.fillRect(0, 0, 1024, 512);
  // hex watermark
  ctx.strokeStyle = 'rgba(60,90,170,0.06)';
  ctx.lineWidth = 3;
  const hr = 34;
  for (let y = -hr; y < 512 + hr; y += hr * 1.5)
    for (let x = -hr, row = 0; x < 1024 + hr; x += hr * 1.73, row++) {
      const ox = (Math.round(y / (hr * 1.5)) % 2) * hr * 0.87;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 3) * k + Math.PI / 6;
        const px = x + ox + Math.cos(a) * hr;
        const py = y + Math.sin(a) * hr;
        k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
  // front panel is centered (faces +Z when seam at back)
  const cx = 512;
  // SYNTEBIO
  ctx.textAlign = 'center';
  ctx.fillStyle = '#7c8596';
  ctx.font = '700 38px Inter, Arial';
  ctx.fillText('SYNTE', cx - 38, 150);
  ctx.fillStyle = '#2f6fb0';
  ctx.fillText('BIO', cx + 70, 150);
  ctx.fillStyle = '#43b95f';
  ctx.beginPath();
  ctx.ellipse(cx + 140, 138, 12, 18, -0.5, 0, Math.PI * 2);
  ctx.fill();
  // SeptiLab wordmark
  ctx.font = '800 120px Inter, Arial';
  ctx.fillStyle = '#26356b';
  ctx.fillText('Septi', cx - 95, 285);
  ctx.fillStyle = '#3a6fc6';
  ctx.fillText('Lab', cx + 185, 285);
  // tagline
  ctx.font = '600 30px Inter, Arial';
  ctx.fillStyle = '#3a4a72';
  ctx.fillText('EKSPLOATACJA SZAMB I OCZYSZCZALNI', cx, 345);
  // 1 KG badge
  ctx.fillStyle = '#26356b';
  ctx.font = '800 44px Inter, Arial';
  ctx.fillText('1 KG', cx, 420);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  return tex;
}

export function buildJar(scale = 1, withLabel = true) {
  const g = new THREE.Group();
  const r = 0.95 * scale;
  const h = 2.1 * scale;
  const bodyMat = withLabel
    ? new THREE.MeshStandardMaterial({ map: makeJarLabel(), roughness: 0.6, metalness: 0 })
    : labelMat;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 40), bodyMat);
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  // rounded shoulder, tucked just under the lid
  const shoulder = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 10, 0, Math.PI * 2, 0, Math.PI / 2.4), labelMat);
  shoulder.scale.y = 0.32;
  shoulder.position.y = h - 0.05 * scale;
  g.add(shoulder);
  // lid, seated flush on the body top with a slight overhang
  const lidH = 0.42 * scale;
  const lid = cyl(r * 1.07, r * 1.07, lidH, 40, new THREE.MeshStandardMaterial({ color: 0xf7f9fc, roughness: 0.5 }));
  lid.position.y = h + lidH / 2 - 0.04 * scale;
  lid.castShadow = true;
  g.add(lid);
  // base rim
  const rim = cyl(r * 1.01, r * 1.01, 0.1 * scale, 40, labelMat);
  rim.position.y = 0.05 * scale;
  g.add(rim);
  // halo for finale reveal
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeGlowTexture('rgba(225,255,235,1)', 'rgba(60,210,130,0)'),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: new THREE.Color(0.45, 1.1, 0.72),
      opacity: 0,
    })
  );
  halo.scale.setScalar(5 * scale);
  halo.position.y = h * 0.55;
  g.add(halo);
  g.userData = { body, halo, h, r };
  return g;
}

export function buildMixingVat(scale = 1) {
  const g = new THREE.Group();
  const r = 1.1 * scale;
  const h = 1.4 * scale;
  const baseY = 0.8 * scale;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = cyl(0.06 * scale, 0.06 * scale, baseY + 0.3 * scale, 6, steelMat);
    leg.position.set(Math.cos(a) * r * 0.7, (baseY + 0.3 * scale) / 2, Math.sin(a) * r * 0.7);
    g.add(leg);
  }
  const cone = new THREE.Mesh(new THREE.ConeGeometry(r, 0.7 * scale, 24), steelMat);
  cone.rotation.x = Math.PI;
  cone.position.y = baseY + 0.35 * scale;
  g.add(cone);
  const body = cyl(r, r, h, 26, steelMat);
  body.position.y = baseY + 0.7 * scale + h / 2;
  g.add(body);
  const motor = cyl(0.16 * scale, 0.18 * scale, 0.34 * scale, 10, accentMat);
  motor.position.y = baseY + 0.7 * scale + h + 0.2 * scale;
  g.add(motor);
  const fill = buildCultureFill(r * 0.93, h, 26);
  fill.position.y = baseY + 0.7 * scale;
  g.add(fill);
  g.userData = { motor, fill, topY: baseY + 0.7 * scale + h };
  return g;
}

/* re-export for convenience */
export { whiteMat };
