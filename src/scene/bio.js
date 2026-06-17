import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PALETTE, whiteMat, leafMat, soilMat } from './builders.js';
import { makeGlowTexture } from './trail.js';
import { applyReveal } from './reveal.js';

/* ----------------------------------------------------------- materials */
export const steelMat = new THREE.MeshStandardMaterial({
  color: 0xe7edf4,
  roughness: 0.5,
  metalness: 0.12,
});
// equipment reveals realistic stainless near the cursor
applyReveal(steelMat, 0x8a98ad, 0.55);
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
  const trunk = cyl(0.08, 0.13, h, 7, soilMat);
  trunk.position.y = h / 2;
  g.add(trunk);
  const foliage = new THREE.Group();
  const tiers = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < tiers; i++) {
    const r = (0.8 - i * 0.18) * (0.9 + rand() * 0.2);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, 0.95, 9), leafMat);
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
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), leafMat);
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
    soilMat
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
  const heap = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95, 1), soilMat);
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
  const W = 2048, H = 940;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const BLUE = '#3f5cb6', NAVY = '#26356b', LAB = '#3a6fc6', GRAY = '#586280', LEAF = '#57b85a';
  ctx.fillStyle = '#f5f7fb';
  ctx.fillRect(0, 0, W, H);

  // hex watermark
  ctx.strokeStyle = 'rgba(74,98,176,0.05)';
  ctx.lineWidth = 3;
  const hr = 42;
  for (let y = -hr; y < H + hr; y += hr * 1.5)
    for (let x = -hr; x < W + hr; x += hr * 1.732) {
      const ox = (Math.round(y / (hr * 1.5)) % 2) * hr * 0.866;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 3) * k + Math.PI / 6;
        const px = x + ox + Math.cos(a) * hr, py = y + Math.sin(a) * hr;
        k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }

  const cx = W / 2;
  let s = 7;
  const rnd = () => (((s = (s * 16807 + 19) % 2147483647) & 0xffff) / 0xffff);

  /* ---- icons (blue line art) ---- */
  const bacteria = (x, y, sz) => {
    ctx.fillStyle = BLUE;
    for (let i = 0; i < 18; i++) {
      const a = rnd() * 6.28, rr = rnd() * sz * 0.52;
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      const len = sz * 0.15 + rnd() * sz * 0.1, w = sz * 0.07;
      ctx.save(); ctx.translate(px, py); ctx.rotate(rnd() * 6.28);
      ctx.beginPath(); ctx.roundRect(-len / 2, -w / 2, len, w, w / 2); ctx.fill(); ctx.restore();
    }
  };
  const tank = (x, y, sz) => {
    ctx.strokeStyle = BLUE; ctx.lineWidth = sz * 0.05; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const w = sz * 1.0, h = sz * 0.52;
    ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, h * 0.5); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(x - sz * 0.11, y - h / 2 - sz * 0.17, sz * 0.22, sz * 0.2, 4); ctx.stroke();
    for (const bx of [-w * 0.3, w * 0.3]) { ctx.beginPath(); ctx.moveTo(x + bx, y - h / 2 + 6); ctx.lineTo(x + bx, y + h / 2 - 6); ctx.stroke(); }
  };
  const leaves = (x, y, sz) => {
    const leaf = (dx, rot, fill) => {
      ctx.save(); ctx.translate(x + dx, y); ctx.rotate(rot);
      ctx.fillStyle = BLUE; ctx.strokeStyle = BLUE; ctx.lineWidth = sz * 0.045; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(0, sz * 0.42);
      ctx.quadraticCurveTo(sz * 0.36, sz * 0.05, 0, -sz * 0.46);
      ctx.quadraticCurveTo(-sz * 0.36, sz * 0.05, 0, sz * 0.42);
      fill ? ctx.fill() : ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, sz * 0.36); ctx.lineTo(0, -sz * 0.4);
      ctx.lineWidth = sz * 0.03; ctx.strokeStyle = fill ? '#f5f7fb' : BLUE; ctx.stroke();
      ctx.restore();
    };
    leaf(-sz * 0.14, -0.32, true); leaf(sz * 0.16, 0.36, false);
  };
  const enzyme = (x, y, sz) => {
    ctx.strokeStyle = BLUE; ctx.lineWidth = sz * 0.05; ctx.lineJoin = 'round';
    const R = sz * 0.26;
    const hex = (hx, hy) => {
      ctx.beginPath();
      for (let k = 0; k < 6; k++) { const a = (Math.PI / 3) * k + Math.PI / 6; const px = hx + Math.cos(a) * R, py = hy + Math.sin(a) * R; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.closePath(); ctx.stroke();
    };
    hex(x - R * 0.85, y - R * 0.45); hex(x + R * 0.85, y - R * 0.45); hex(x, y + R * 0.72);
    ctx.fillStyle = BLUE;
    for (const [nx, ny] of [[x - R * 1.7, y - R * 0.45], [x + R * 1.7, y - R * 0.45], [x, y + R * 1.75]]) { ctx.beginPath(); ctx.arc(nx, ny, sz * 0.05, 0, 6.28); ctx.fill(); }
  };
  const drop = (x, y, sz) => {
    ctx.fillStyle = '#2a3f8f';
    ctx.beginPath(); ctx.moveTo(x, y - sz * 0.52);
    ctx.bezierCurveTo(x + sz * 0.44, y - sz * 0.04, x + sz * 0.36, y + sz * 0.46, x, y + sz * 0.46);
    ctx.bezierCurveTo(x - sz * 0.36, y + sz * 0.46, x - sz * 0.44, y - sz * 0.04, x, y - sz * 0.52);
    ctx.fill();
  };
  const nose = (x, y, sz) => {
    ctx.strokeStyle = BLUE; ctx.lineWidth = sz * 0.05; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x - sz * 0.12, y - sz * 0.42);
    ctx.quadraticCurveTo(x - sz * 0.2, y + sz * 0.12, x - sz * 0.06, y + sz * 0.32);
    ctx.quadraticCurveTo(x + sz * 0.06, y + sz * 0.44, x + sz * 0.2, y + sz * 0.32);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(x + sz * 0.04, y + sz * 0.3, sz * 0.055, 0, 6.28); ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const wy = y - sz * 0.18 + i * sz * 0.24;
      ctx.beginPath(); ctx.moveTo(x + sz * 0.34, wy);
      ctx.quadraticCurveTo(x + sz * 0.5, wy - sz * 0.09, x + sz * 0.66, wy);
      ctx.quadraticCurveTo(x + sz * 0.82, wy + sz * 0.09, x + sz * 0.98, wy);
      ctx.stroke();
    }
  };
  const caption = (lines, x, y) => {
    ctx.fillStyle = NAVY; ctx.font = '700 27px Inter, Arial'; ctx.textAlign = 'center';
    lines.forEach((ln, i) => ctx.fillText(ln, x, y + i * 33));
  };

  /* ---- SYNTEBIO logo (above the wordmark, shifted right like the photo) ---- */
  ctx.textAlign = 'left';
  ctx.font = '800 50px Inter, Arial';
  const synW = ctx.measureText('SYNTE').width, bioW = ctx.measureText('BIO').width;
  const lx = cx + 90 - (synW + bioW + 46) / 2;
  ctx.fillStyle = GRAY; ctx.fillText('SYNTE', lx, 150);
  ctx.fillStyle = '#2f6fb0'; ctx.fillText('BIO', lx + synW, 150);
  ctx.fillStyle = LEAF;
  ctx.save(); ctx.translate(lx + synW + bioW + 28, 132); ctx.rotate(-0.4);
  ctx.beginPath(); ctx.moveTo(0, 18); ctx.quadraticCurveTo(20, -2, 0, -22); ctx.quadraticCurveTo(-12, -2, 0, 18); ctx.fill(); ctx.restore();

  /* ---- SeptiLab wordmark ---- */
  ctx.font = '800 172px Inter, Arial';
  const sepW = ctx.measureText('Septi').width, labW = ctx.measureText('Lab').width;
  const sx = cx - (sepW + labW) / 2;
  ctx.fillStyle = NAVY; ctx.fillText('Septi', sx, 330);
  ctx.fillStyle = LAB; ctx.fillText('Lab', sx + sepW, 330);

  /* ---- tagline ---- */
  ctx.textAlign = 'center'; ctx.font = '700 31px Inter, Arial'; ctx.fillStyle = GRAY;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
  ctx.fillText('EKSPLOATACJA SZAMB I PRZYDOMOWYCH OCZYSZCZALNI', cx, 405);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

  /* ---- 2 x 3 icon grid with captions ---- */
  const col = [cx - 300, cx, cx + 300];
  bacteria(col[0], 535, 95); caption(['Do 100 miliardów', 'aktywnych', 'bakterii w dawce'], col[0], 625);
  tank(col[1], 535, 95); caption(['Do wszystkich', 'typów szamb', 'i oczyszczalni'], col[1], 625);
  leaves(col[2], 535, 95); caption(['Produkt', 'bezpieczny dla', 'środowiska'], col[2], 625);
  enzyme(col[0], 770, 95); caption(['Kompleks 4', 'enzymów'], col[0], 855);
  drop(col[1], 770, 95); caption(['Redukcja osadów', 'i zanieczyszczeń'], col[1], 855);
  nose(col[2], 770, 95); caption(['Likwidacja', 'nieprzyjemnych', 'zapachów'], col[2], 855);

  /* ---- right-side info panel (wraps toward the side) ---- */
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(40,53,107,0.4)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(1715, 250, 270, 470, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = GRAY; ctx.font = '700 18px Inter, Arial'; ctx.textAlign = 'left';
  const rows = [['Producent', 305], ['Sposób użycia', 430], ['Przechowywanie', 560], ['Data ważności', 660]];
  for (const [t, ry] of rows) {
    ctx.fillText(t, 1735, ry);
    ctx.strokeStyle = 'rgba(40,53,107,0.18)';
    ctx.beginPath(); ctx.moveTo(1735, ry + 16); ctx.lineTo(1965, ry + 16); ctx.stroke();
    ctx.fillStyle = 'rgba(88,98,128,0.5)';
    for (let i = 0; i < 2; i++) { ctx.fillRect(1735, ry + 30 + i * 14, 210 - i * 40, 5); }
    ctx.fillStyle = GRAY;
  }

  /* ---- faint wrapped fragments on the left edge ---- */
  ctx.fillStyle = 'rgba(88,98,128,0.35)';
  for (let i = 0; i < 6; i++) ctx.fillRect(70, 430 + i * 26, 150 - (i % 2) * 40, 6);

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  return tex;
}

/* a knurled (vertically fluted) cylinder for the screw cap */
function fluteCylinder(r, h, mat, flutes = 46, amp = 0.016) {
  const geo = new THREE.CylinderGeometry(r, r, h, flutes * 2, 1, false);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const rr = Math.hypot(x, z);
    if (rr > 1e-3) {
      const ang = Math.atan2(z, x);
      const k = 1 + amp * (0.5 + 0.5 * Math.cos(ang * flutes));
      p.setX(i, (x / rr) * r * k);
      p.setZ(i, (z / rr) * r * k);
    }
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}

export function buildJar(scale = 1, withLabel = true) {
  const g = new THREE.Group();
  const r = 0.9 * scale;
  const h = 2.6 * scale;
  const seg = withLabel ? 48 : 22;
  const lidMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.42 });
  const seamMat = new THREE.MeshStandardMaterial({ color: 0xd6dde7, roughness: 0.6 });

  // body (label printed directly on it)
  const bodyMat = withLabel
    ? new THREE.MeshStandardMaterial({ map: makeJarLabel(), roughness: 0.55, metalness: 0 })
    : labelMat;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.985, h, seg), bodyMat);
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  // rounded shoulder
  const shoulder = new THREE.Mesh(new THREE.SphereGeometry(r, seg, 12, 0, Math.PI * 2, 0, Math.PI / 2.6), labelMat);
  shoulder.scale.y = 0.4;
  shoulder.position.y = h - 0.02 * scale;
  g.add(shoulder);

  // base foot
  const rim = cyl(r * 1.0, r * 0.95, 0.13 * scale, seg, labelMat);
  rim.position.y = 0.065 * scale;
  g.add(rim);

  // lid
  const lidR = r * 1.04, lidH = 0.52 * scale, lidBottom = h + 0.04 * scale;
  if (withLabel) {
    const lidSide = fluteCylinder(lidR, lidH, lidMat);
    lidSide.position.y = lidBottom + lidH / 2;
    g.add(lidSide);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(lidR, seg, 12, 0, Math.PI * 2, 0, Math.PI / 2.2), lidMat);
    dome.scale.y = 0.22;
    dome.position.y = lidBottom + lidH;
    g.add(dome);
    const edge = new THREE.Mesh(new THREE.TorusGeometry(lidR * 0.92, lidR * 0.08, 10, seg), lidMat);
    edge.rotation.x = Math.PI / 2;
    edge.position.y = lidBottom + lidH - 0.015 * scale;
    g.add(edge);
    const seam = cyl(lidR * 1.006, lidR * 1.006, 0.045 * scale, seg, seamMat);
    seam.position.y = lidBottom + 0.012 * scale;
    g.add(seam);
  } else {
    const lid = cyl(lidR, lidR, lidH, seg, lidMat);
    lid.position.y = lidBottom + lidH / 2;
    lid.castShadow = true;
    g.add(lid);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(lidR, seg, 8, 0, Math.PI * 2, 0, Math.PI / 2.2), lidMat);
    dome.scale.y = 0.2;
    dome.position.y = lidBottom + lidH;
    g.add(dome);
  }

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
  halo.scale.setScalar(5.5 * scale);
  halo.position.y = h * 0.5;
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

/* ============================================================ ZONE 7 — the product in use (home + septic tank)
   "to po prostu proszek — wsypujesz do szamba, dzieje się magia,
    i szambo jest zdrowe; utrzymuje odpowiednią pracę zbiornika." */

const roofMat = new THREE.MeshStandardMaterial({ color: 0x3c4d7a, roughness: 0.7 });
const woodMat = new THREE.MeshStandardMaterial({ color: 0xdfe6ee, roughness: 0.9 });
const gravelMat = new THREE.MeshStandardMaterial({ color: 0xcdd7e1, roughness: 1 });
applyReveal(roofMat, 0x7a4a39, 0.62);   // terracotta roof
applyReveal(woodMat, 0x9c7448, 0.85);   // wood
applyReveal(gravelMat, 0xb6a888, 0.7);  // gravel / path

export function buildHouse() {
  const g = new THREE.Group();
  g.add(box(4.6, 3.0, 3.6, 0, 1.5, 0)); // walls
  // gable roof (triangular prism)
  const tri = new THREE.Shape();
  tri.moveTo(-2.55, 0); tri.lineTo(2.55, 0); tri.lineTo(0, 1.8); tri.closePath();
  const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 3.9, bevelEnabled: false }), roofMat);
  roof.position.set(0, 3.0, -1.95);
  roof.castShadow = true;
  g.add(roof);
  // chimney
  const chim = box(0.5, 1.2, 0.5, 1.4, 3.9, -0.6, roofMat, 0.04);
  g.add(chim);
  // door + windows
  g.add(box(0.95, 1.7, 0.12, -1.0, 0.85, 1.82, accentMat, 0.03));
  g.add(box(0.85, 0.85, 0.1, 1.1, 1.9, 1.82, accentMat, 0.03));
  g.add(box(0.85, 0.85, 0.1, 2.32, 1.9, 0, accentMat, 0.03));
  g.userData.chimneyTop = new THREE.Vector3(1.4, 4.6, -0.6);
  return g;
}

export function buildShed() {
  const g = new THREE.Group();
  g.add(box(2.4, 1.8, 2.0, 0, 0.9, 0));
  const roof = box(2.7, 0.16, 2.3, 0, 1.95, 0, roofMat, 0.02);
  roof.rotation.z = 0.12;
  g.add(roof);
  g.add(box(0.8, 1.2, 0.1, 0, 0.6, 1.02, accentMat, 0.02));
  return g;
}

export function buildWell() {
  const g = new THREE.Group();
  const base = cyl(0.7, 0.78, 1.0, 16, woodMat);
  base.position.y = 0.5;
  g.add(base);
  for (const s of [-1, 1]) {
    const post = box(0.12, 1.3, 0.12, s * 0.55, 1.55, 0, roofMat, 0.03);
    g.add(post);
  }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.95, 0.6, 4), roofMat);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 2.5;
  roof.castShadow = true;
  g.add(roof);
  const bucket = cyl(0.16, 0.13, 0.22, 10, accentMat);
  bucket.position.y = 1.5;
  g.add(bucket);
  return g;
}

export function buildMailbox() {
  const g = new THREE.Group();
  g.add(box(0.12, 1.2, 0.12, 0, 0.6, 0, woodMat, 0.03));
  const bx = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.42, 12, 1, false, 0, Math.PI), accentMat);
  bx.rotation.z = Math.PI / 2;
  bx.position.set(0, 1.25, 0);
  g.add(bx);
  g.add(box(0.42, 0.02, 0.36, 0, 1.04, 0, accentMat, 0.01));
  return g;
}

export function buildFence(corners, h = 0.95) {
  const g = new THREE.Group();
  const postGeo = new THREE.BoxGeometry(0.1, h, 0.1);
  for (let i = 0; i < corners.length; i++) {
    const a = new THREE.Vector3(corners[i][0], 0, corners[i][1]);
    const b = new THREE.Vector3(corners[(i + 1) % corners.length][0], 0, corners[(i + 1) % corners.length][1]);
    const len = a.distanceTo(b);
    const n = Math.max(1, Math.round(len / 1.2));
    for (let k = 0; k <= n; k++) {
      const p = a.clone().lerp(b, k / n);
      const post = new THREE.Mesh(postGeo, woodMat);
      post.position.set(p.x, h / 2, p.z);
      post.castShadow = true;
      g.add(post);
    }
    for (const ry of [0.32, 0.66]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, len), woodMat);
      const mid = a.clone().lerp(b, 0.5);
      rail.position.set(mid.x, h * ry, mid.z);
      rail.lookAt(b.x, h * ry, b.z);
      g.add(rail);
    }
  }
  return g;
}

export function buildPath(points) {
  const g = new THREE.Group();
  for (const [x, z] of points) {
    const stone = box(0.7, 0.08, 0.55, x, 0.04, z, gravelMat, 0.12);
    stone.rotation.y = (Math.random() - 0.5) * 0.3;
    g.add(stone);
  }
  return g;
}

export function buildDrainField() {
  const g = new THREE.Group();
  // distribution box
  g.add(box(1.0, 0.7, 1.0, 0, 0.35, 0, steelMat, 0.04));
  for (let r = 0; r < 3; r++) {
    const z = (r - 1) * 1.3;
    const bed = box(5.5, 0.18, 0.9, 3.0, 0.09, z, gravelMat, 0.04);
    g.add(bed);
    const pipe = cyl(0.16, 0.16, 5.2, 12, steelMat);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(3.0, 0.32, z);
    g.add(pipe);
  }
  return g;
}

/* ---- the cutaway septic tank: the "magic" happens here ---- */
function buildTankLiquid(w, h, d) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uHealth: { value: 0 }, uTime: { value: 0 }, uHeight: { value: h } },
    vertexShader: /* glsl */ `
      uniform float uHeight;
      varying float vY; varying vec3 vN;
      void main() {
        vY = (position.y + uHeight * 0.5) / uHeight;
        vN = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uHealth; uniform float uTime;
      varying float vY; varying vec3 vN;
      void main() {
        float sludgeTop = mix(0.42, 0.13, uHealth);
        float scumBot = mix(0.74, 0.94, uHealth);
        vec3 murky = vec3(0.34, 0.31, 0.25);
        vec3 clear = vec3(0.40, 0.66, 0.52);
        vec3 col = mix(murky, clear, uHealth);
        if (vY < sludgeTop) {
          col = mix(vec3(0.20, 0.17, 0.13), vec3(0.30, 0.34, 0.25), uHealth);
        } else if (vY > scumBot) {
          col = mix(vec3(0.31, 0.28, 0.21), vec3(0.50, 0.62, 0.50), uHealth);
        } else {
          float fleck = 0.5 + 0.5 * sin(vY * 42.0 + uTime * 2.0);
          col += vec3(0.05, 0.34, 0.18) * uHealth * (0.45 + 0.25 * fleck);
        }
        // a bright treatment front sweeps upward while the flora establishes
        float front = uHealth * 1.1;
        float band = exp(-pow((vY - front) * 5.0, 2.0)) * smoothstep(0.02, 0.18, uHealth) * smoothstep(1.0, 0.72, uHealth);
        col += vec3(0.12, 0.62, 0.32) * band * 1.3;
        float shade = 0.78 + 0.22 * clamp(dot(vN, normalize(vec3(0.4, 0.8, 0.5))), 0.0, 1.0);
        gl_FragColor = vec4(col * shade, 1.0);
      }
    `,
  });
  const m = new THREE.Mesh(geo, mat);
  m.userData.mat = mat;
  return m;
}

function buildWaste(w, h, d, count = 64) {
  const geo = new THREE.IcosahedronGeometry(0.16, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0x6f655a, roughness: 1 });
  const inst = new THREE.InstancedMesh(geo, mat, count);
  const rand = rng(77);
  const data = [];
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const x = (rand() - 0.5) * w * 0.88;
    const y = -h / 2 + 0.2 + rand() * h * 0.62;
    const z = (rand() - 0.5) * d * 0.7;
    const s = 0.5 + rand() * 1.0;
    data.push({ x, y, z, s, thresh: 0.15 + rand() * 0.7, sx: 0.7 + rand(), sy: 0.5 + rand() * 0.6, sz: 0.7 + rand() });
    dummy.position.set(x, y, z);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
  }
  inst.userData = { data, dummy, count };
  return inst;
}

function buildBacteria(w, h, d, count = 240) {
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.attributes.position = base.attributes.position;
  geo.attributes.uv = base.attributes.uv;
  const off = new Float32Array(count * 3);
  const ph = new Float32Array(count);
  const th = new Float32Array(count);
  const sz = new Float32Array(count);
  const rand = rng(123);
  for (let i = 0; i < count; i++) {
    off[i * 3] = (rand() - 0.5) * w * 0.92;
    off[i * 3 + 1] = -h / 2 + 0.2 + rand() * h * 0.86;
    off[i * 3 + 2] = (rand() - 0.5) * d * 0.8;
    ph[i] = rand() * 6.2831;
    th[i] = rand() * 0.85;
    sz[i] = 0.06 + rand() * 0.07;
  }
  geo.setAttribute('iOffset', new THREE.InstancedBufferAttribute(off, 3));
  geo.setAttribute('iPhase', new THREE.InstancedBufferAttribute(ph, 1));
  geo.setAttribute('iThresh', new THREE.InstancedBufferAttribute(th, 1));
  geo.setAttribute('iSize', new THREE.InstancedBufferAttribute(sz, 1));
  geo.instanceCount = count;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uHealth: { value: 0 }, uTime: { value: 0 }, uColor: { value: new THREE.Color(0.4, 1.6, 0.8) } },
    vertexShader: /* glsl */ `
      attribute vec3 iOffset; attribute float iPhase; attribute float iThresh; attribute float iSize;
      uniform float uHealth; uniform float uTime;
      varying float vB; varying vec2 vUv;
      void main() {
        vUv = uv;
        float born = smoothstep(iThresh, iThresh + 0.12, uHealth);
        float tw = 0.7 + 0.3 * sin(uTime * 3.0 + iPhase);
        vB = born * tw;
        vec3 drift = vec3(sin(uTime * 0.8 + iPhase), sin(uTime * 0.6 + iPhase * 1.3), cos(uTime * 0.7 + iPhase)) * 0.12;
        vec4 mv = modelViewMatrix * vec4(iOffset + drift, 1.0);
        mv.xy += position.xy * iSize * (0.6 + born);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; varying float vB; varying vec2 vUv;
      void main() {
        float r = length(vUv - 0.5) * 2.0;
        float a = (1.0 - smoothstep(0.4, 1.0, r)) * vB;
        if (a < 0.02) discard;
        gl_FragColor = vec4(uColor * a, a);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.userData.mat = mat;
  return mesh;
}

export function buildSepticCutaway() {
  const g = new THREE.Group();
  const w = 5.2, h = 3.0, d = 3.4;
  const wall = 0.16;
  // shell: bottom, back, sides, top (front open for the cutaway view)
  g.add(box(w, wall, d, 0, wall / 2, 0, steelMat, 0.03));
  g.add(box(w, h, wall, 0, h / 2, -d / 2 + wall / 2, steelMat, 0.03));
  g.add(box(wall, h, d, -w / 2 + wall / 2, h / 2, 0, steelMat, 0.03));
  g.add(box(wall, h, d, w / 2 - wall / 2, h / 2, 0, steelMat, 0.03));
  g.add(box(w, wall, d, 0, h - wall / 2, 0, steelMat, 0.03));
  // front bottom lip so liquid doesn't look like it spills
  g.add(box(w, 0.5, wall, 0, 0.25, d / 2 - wall / 2, steelMat, 0.03));

  // manhole on top + lid
  const collar = cyl(0.5, 0.5, 0.22, 18, steelMat);
  collar.position.set(0, h + 0.11, 0);
  g.add(collar);
  const lid = cyl(0.56, 0.56, 0.1, 18, accentMat);
  lid.position.set(0, h + 0.27, 0);
  g.add(lid);
  g.userData.lid = lid;

  // inlet (from house) + outlet (to drain field) pipes
  const inlet = cyl(0.22, 0.22, 1.6, 12, steelMat);
  inlet.rotation.z = Math.PI / 2.3;
  inlet.position.set(-w / 2 - 0.4, h - 0.6, 0);
  g.add(inlet);
  const outlet = cyl(0.2, 0.2, 1.4, 12, steelMat);
  outlet.rotation.z = Math.PI / 2;
  outlet.position.set(w / 2 + 0.6, h - 0.9, 0);
  g.add(outlet);

  // interior liquid (the cross-section)
  const liquid = buildTankLiquid(w - 2 * wall - 0.04, h - 0.55, d - 2 * wall - 0.04);
  liquid.position.set(0, (h - 0.55) / 2 + wall + 0.02, 0);
  g.add(liquid);

  const waste = buildWaste(w - 0.6, h - 0.7, d - 0.6, 64);
  waste.position.copy(liquid.position);
  g.add(waste);

  const bacteria = buildBacteria(w - 0.5, h - 0.6, d - 0.5, 380);
  bacteria.position.copy(liquid.position);
  g.add(bacteria);

  // rising gas bubbles (a sign of an active, healthy tank)
  const bubbles = buildBubbles(Math.min(w, d) / 2 - 0.5, h - 0.7, 20);
  bubbles.position.copy(liquid.position).add(new THREE.Vector3(0, -(h - 0.55) / 2, 0));
  g.add(bubbles);

  // murky odor wisps that fade away as the tank recovers
  const wtex = makeGlowTexture('rgba(120,112,96,0.9)', 'rgba(120,112,96,0)');
  const wisps = [];
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: wtex, transparent: true, depthWrite: false, opacity: 0,
      color: new THREE.Color(0.55, 0.5, 0.42),
    }));
    s.position.set((i - 2) * 0.7, h, 0.3);
    g.add(s);
    wisps.push({ s, phase: i / 5, x: (i - 2) * 0.7 });
  }

  // falling powder dose + green burst (animated from the journey)
  const dose = new THREE.Group();
  const powder = cyl(0.16, 0.13, 0.4, 12, labelMat);
  powder.position.y = 0;
  dose.add(powder);
  const burst = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture('rgba(225,255,235,1)', 'rgba(50,205,125,0)'),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    color: new THREE.Color(0.5, 1.5, 0.85), opacity: 0,
  }));
  burst.scale.setScalar(2.2);
  dose.add(burst);
  dose.position.set(0, h + 1.6, 0);
  dose.userData = { powder, burst };
  g.add(dose);

  g.userData = {
    liquid: liquid.userData.mat,
    waste,
    bacteria: bacteria.userData.mat,
    bubbles,
    wisps,
    tankTop: h,
    dose,
    inletWorld: new THREE.Vector3(-w / 2 - 1.0, h - 0.4, 0),
    manholeWorld: new THREE.Vector3(0, h + 0.3, 0),
    size: { w, h, d },
  };
  return g;
}

/* ============================================================ extra props (densify every zone) */
const stoneMat = new THREE.MeshStandardMaterial({ color: 0xbcc7d3, roughness: 1 });
const darkGlass = new THREE.MeshStandardMaterial({ color: 0x2b3a63, roughness: 0.3, metalness: 0.2 });
applyReveal(stoneMat, 0x9b9387, 0.55);  // stone / rock

export function buildRock(seed = 1) {
  const g = new THREE.Group();
  const rand = rng(seed * 13 + 1);
  const n = 1 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const r = 0.18 + rand() * 0.4;
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), stoneMat);
    rock.position.set((rand() - 0.5) * 0.8, r * 0.5, (rand() - 0.5) * 0.8);
    rock.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    rock.scale.y = 0.65 + rand() * 0.4;
    rock.castShadow = true;
    g.add(rock);
  }
  return g;
}

export function buildGrassTuft(seed = 1) {
  const g = new THREE.Group();
  const rand = rng(seed * 7 + 3);
  const n = 4 + Math.floor(rand() * 5);
  for (let i = 0; i < n; i++) {
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.32 + rand() * 0.32, 4), leafMat);
    blade.position.set((rand() - 0.5) * 0.45, 0.18, (rand() - 0.5) * 0.45);
    blade.rotation.z = (rand() - 0.5) * 0.5;
    g.add(blade);
  }
  g.userData.sway = g;
  g.userData.swayBase = rand() * 6.28;
  return g;
}

export function buildLog() {
  const g = new THREE.Group();
  const log = cyl(0.18, 0.2, 1.5, 10, soilMat);
  log.rotation.z = Math.PI / 2;
  log.position.y = 0.2;
  log.castShadow = true;
  g.add(log);
  return g;
}

export function buildSilo(scale = 1) {
  const g = new THREE.Group();
  const r = 0.95 * scale, h = 3.6 * scale;
  const skirt = cyl(r, r * 1.04, 0.5 * scale, 22, accentMat);
  skirt.position.y = 0.25 * scale; g.add(skirt);
  const body = cyl(r, r, h, 24, steelMat);
  body.position.y = 0.5 * scale + h / 2; g.add(body);
  const top = new THREE.Mesh(new THREE.ConeGeometry(r, 0.95 * scale, 24), steelMat);
  top.position.y = 0.5 * scale + h + 0.47 * scale; g.add(top);
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035, 6, 24), accentMat);
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.5 * scale + h * (0.28 + i * 0.26); g.add(ring);
  }
  g.userData.topY = 0.5 * scale + h + 0.95 * scale;
  return g;
}

export function buildPallet(stack = 3) {
  const g = new THREE.Group();
  g.add(box(1.2, 0.16, 1.0, 0, 0.08, 0, woodMat, 0.02));
  const rand = rng(stack * 5 + 2);
  for (let i = 0; i < stack; i++) {
    g.add(box(1.0, 0.42, 0.8, (rand() - 0.5) * 0.12, 0.16 + 0.23 + i * 0.44, 0, labelMat, 0.12));
  }
  return g;
}

export function buildControlPanel() {
  const g = new THREE.Group();
  g.add(box(1.4, 1.6, 0.5, 0, 0.8, 0, steelMat, 0.05));
  g.add(box(1.12, 0.74, 0.06, 0, 1.16, 0.27, darkGlass, 0.03));
  for (let i = 0; i < 4; i++) {
    const knob = cyl(0.05, 0.05, 0.06, 8, accentMat);
    knob.rotation.x = Math.PI / 2;
    knob.position.set(-0.45 + i * 0.3, 0.55, 0.27); g.add(knob);
  }
  return g;
}

export function buildLabBuilding() {
  const g = new THREE.Group();
  g.add(box(7.2, 3.4, 4.6, 0, 1.7, 0));
  g.add(box(7.4, 0.32, 4.8, 0, 3.5, 0, accentMat, 0.04));
  for (let i = 0; i < 5; i++) g.add(box(0.9, 1.1, 0.08, -2.7 + i * 1.35, 1.95, 2.32, darkGlass, 0.03));
  g.add(box(1.2, 2.0, 0.12, 0, 1.0, 2.34, accentMat, 0.03));
  g.add(box(1.0, 0.5, 1.0, -2.1, 3.85, -1, steelMat, 0.05));
  g.add(box(0.8, 0.4, 0.8, 1.9, 3.8, 0.6, steelMat, 0.05));
  return g;
}

export function buildConveyorJars(len = 6, n = 7) {
  const g = new THREE.Group();
  g.add(box(len, 0.45, 0.95, 0, 0.55, 0, steelMat, 0.04));
  g.add(box(len, 0.08, 0.72, 0, 0.82, 0, accentMat, 0.02));
  for (const x of [-len / 2 + 0.3, len / 2 - 0.3]) g.add(box(0.12, 0.55, 0.7, x, 0.27, 0, steelMat, 0.02));
  const jars = [];
  for (let i = 0; i < n; i++) {
    const j = buildJar(0.34, false);
    j.position.set(-len / 2 + 0.7 + (i * (len - 1.4)) / (n - 1), 0.86, 0);
    g.add(j); jars.push(j);
  }
  g.userData.jars = jars;
  return g;
}

export function buildCar() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe2e9f1, roughness: 0.45, metalness: 0.1 });
  g.add(box(3.4, 0.7, 1.5, 0, 0.62, 0, bodyMat, 0.2));
  g.add(box(1.9, 0.62, 1.36, -0.1, 1.18, 0, bodyMat, 0.22));
  g.add(box(1.78, 0.46, 1.4, -0.1, 1.22, 0, darkGlass, 0.12));
  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.24, 14);
  wheelGeo.rotateX(Math.PI / 2);
  const wm = new THREE.MeshStandardMaterial({ color: 0x3a4a72, roughness: 0.8 });
  for (const [x, z] of [[-1.0, 0.72], [1.0, 0.72], [-1.0, -0.72], [1.0, -0.72]]) {
    const w = new THREE.Mesh(wheelGeo, wm);
    w.position.set(x, 0.32, z); w.castShadow = true; g.add(w);
  }
  return g;
}

export function buildStreetlamp() {
  const g = new THREE.Group();
  const pole = cyl(0.06, 0.09, 3.2, 8, accentMat);
  pole.position.y = 1.6; g.add(pole);
  g.add(box(0.85, 0.08, 0.08, 0.38, 3.2, 0, accentMat, 0.02));
  g.add(box(0.5, 0.16, 0.26, 0.72, 3.12, 0, accentMat, 0.04));
  const bulb = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.2), new THREE.MeshBasicMaterial({ color: 0xfff2cf }));
  bulb.rotation.x = Math.PI / 2; bulb.position.set(0.72, 3.03, 0); g.add(bulb);
  return g;
}

export function buildGardenBed() {
  const g = new THREE.Group();
  g.add(box(1.8, 0.24, 1.0, 0, 0.12, 0, woodMat, 0.03));
  const rand = rng(9);
  const colors = [0x4ca64c, 0x43b95f, 0x6fc98a, 0xe7b6c8];
  for (let i = 0; i < 9; i++) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6),
      new THREE.MeshStandardMaterial({ color: colors[Math.floor(rand() * colors.length)], roughness: 0.7 }));
    f.position.set((rand() - 0.5) * 1.5, 0.3, (rand() - 0.5) * 0.8); g.add(f);
  }
  return g;
}

/* re-export for convenience */
export { whiteMat };
