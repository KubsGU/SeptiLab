import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const PALETTE = {
  bg: 0xdbe6ef,
  white: 0xf3f6fa,
  ground: 0xdde7ef,
  ink: 0x1b2a52,
  blue: 0x2f55c0,
  green: 0x43b95f,
};

export const whiteMat = new THREE.MeshStandardMaterial({
  color: PALETTE.white,
  roughness: 0.94,
  metalness: 0,
});

export const blueMat = new THREE.MeshStandardMaterial({
  color: PALETTE.blue,
  roughness: 0.55,
  metalness: 0,
  emissive: PALETTE.blue,
  emissiveIntensity: 0.25,
});

export const greenMat = new THREE.MeshStandardMaterial({
  color: PALETTE.green,
  roughness: 0.6,
  metalness: 0,
  emissive: PALETTE.green,
  emissiveIntensity: 0.2,
});

export { RoundedBoxGeometry };

const rndCache = new Map();
function roundedBox(w, h, d, r = 0.05) {
  const key = `${w}|${h}|${d}|${r}`;
  if (!rndCache.has(key)) rndCache.set(key, new RoundedBoxGeometry(w, h, d, 2, r));
  return rndCache.get(key);
}

export function box(w, h, d, x, y, z, mat = whiteMat, r = 0.05) {
  const m = new THREE.Mesh(roundedBox(w, h, d, Math.min(r, h / 3, w / 3, d / 3)), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 19) % 2147483647;
    return (s & 0xfffff) / 0xfffff;
  };
}

/* ------------------------------------------------- city */
export function buildCity() {
  const g = new THREE.Group();
  const rand = rng(7);
  const towers = [
    // [x, z, w, h, d, tiers]
    [-5.5, -3.5, 2.6, 9.5, 2.6, 2],
    [-2.0, 0.5, 2.2, 13.5, 2.2, 3],
    [1.6, -2.8, 2.8, 11, 2.8, 2],
    [4.8, 0.8, 2.4, 15, 2.4, 3],
    [-6.0, 1.8, 2.0, 6, 2.0, 1],
    [0.4, 3.6, 2.4, 8, 2.4, 2],
    [4.2, 4.6, 1.8, 5.5, 1.8, 1],
    [-3.2, 5.0, 1.6, 4, 1.6, 1],
    [8.0, -1.6, 2.0, 7, 2.0, 2],
  ];
  for (const [x, z, w, h, d, tiers] of towers) {
    let yy = 0;
    let ww = w;
    let dd = d;
    for (let t = 0; t < tiers; t++) {
      const hh = (h / tiers) * (1 - t * 0.12);
      g.add(box(ww, hh, dd, x, yy + hh / 2, z));
      yy += hh;
      ww *= 0.72;
      dd *= 0.72;
    }
    if (rand() > 0.5) {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.1, 6), whiteMat);
      ant.position.set(x, yy + 0.55, z);
      ant.castShadow = true;
      g.add(ant);
    }
  }
  // low podium blocks
  const pods = [[-0.5, -5.5, 4, 1.2, 2.4], [7.2, 3.4, 2.6, 1.0, 3.4], [-7.8, -1.0, 2.2, 1.4, 2.2]];
  for (const [x, z, w, h, d] of pods) g.add(box(w, h, d, x, h / 2, z));
  return g;
}

/* ------------------------------------------------- wind turbine */
export function buildTurbine() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 2.6, 8), whiteMat);
  pole.position.y = 1.3;
  pole.castShadow = true;
  g.add(pole);
  const nac = box(0.26, 0.16, 0.4, 0, 2.62, 0.02);
  g.add(nac);
  const hub = new THREE.Group();
  hub.position.set(0, 2.62, 0.26);
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.05, 0.03), whiteMat);
    blade.geometry.translate(0, 0.55, 0);
    blade.rotation.z = (i * Math.PI * 2) / 3;
    blade.castShadow = true;
    hub.add(blade);
  }
  g.add(hub);
  g.userData.hub = hub;
  return g;
}

export function buildTurbineFarm(positions) {
  const g = new THREE.Group();
  const hubs = [];
  for (const [x, z, ry] of positions) {
    const t = buildTurbine();
    t.position.set(x, 0, z);
    t.rotation.y = ry;
    g.add(t);
    hubs.push({ hub: t.userData.hub, speed: 0.7 + Math.random() * 0.7 });
  }
  g.userData.hubs = hubs;
  return g;
}

/* ------------------------------------------------- HQ */
export function buildHQ() {
  const g = new THREE.Group();
  g.add(box(6.4, 1.5, 4.6, 0, 0.75, 0));
  g.add(box(5.2, 1.4, 3.8, 0, 2.2, 0));
  g.add(box(3.0, 1.9, 2.6, 0.4, 3.85, 0));
  // rooftop helipad-style logo pad
  const pad = new THREE.Mesh(roundedBox(1.7, 0.12, 1.7, 0.05), blueMat.clone());
  pad.position.set(0.4, 4.86, 0);
  pad.castShadow = true;
  g.add(pad);
  // entrance canopy
  g.add(box(1.8, 0.18, 1.2, -1.2, 0.42, 2.7));
  // small vents
  g.add(box(0.5, 0.3, 0.5, -1.8, 3.05, 0.9));
  g.add(box(0.4, 0.45, 0.4, 1.9, 3.12, -0.8));
  return g;
}

/* ------------------------------------------------- cooling towers */
export function buildCoolingTower(scale = 1) {
  const pts = [];
  const H = 4.6 * scale;
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const y = t * H;
    // hyperboloid-ish profile
    const r = (1.55 - 1.05 * t + 0.62 * t * t) * 1.55 * scale;
    pts.push(new THREE.Vector2(r, y));
  }
  const geo = new THREE.LatheGeometry(pts, 36);
  const m = new THREE.Mesh(geo, whiteMat);
  m.castShadow = true;
  m.receiveShadow = true;
  const g = new THREE.Group();
  g.add(m);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.12 * 1.55 * scale * 0.78, 0.05, 8, 40), whiteMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = H;
  g.add(rim);
  g.userData.topY = H;
  g.userData.topR = (1.55 - 1.05 + 0.62) * 1.55 * scale;
  return g;
}

/* ------------------------------------------------- pipe racks / containers */
export function buildRacks(rows, cols, levels, pitch = 0.62) {
  const n = rows * cols * levels;
  const geo = roundedBox(0.46, 0.46, 0.46, 0.04);
  const inst = new THREE.InstancedMesh(geo, whiteMat, n);
  const dummy = new THREE.Object3D();
  let i = 0;
  const rand = rng(31);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const stack = 1 + Math.floor(rand() * levels);
      for (let l = 0; l < levels; l++) {
        if (l < stack) {
          dummy.position.set(c * pitch, 0.24 + l * 0.5, r * pitch);
          dummy.rotation.y = 0;
          dummy.updateMatrix();
          inst.setMatrixAt(i, dummy.matrix);
        } else {
          dummy.position.set(0, -10, 0);
          dummy.updateMatrix();
          inst.setMatrixAt(i, dummy.matrix);
        }
        i++;
      }
    }
  inst.castShadow = true;
  inst.receiveShadow = true;
  return inst;
}

/* ------------------------------------------------- warehouses */
export function buildQuonset(len = 4.2, r = 1.25) {
  const g = new THREE.Group();
  const geo = new THREE.CylinderGeometry(r, r, len, 24, 1, false, 0, Math.PI);
  geo.rotateZ(Math.PI / 2);
  geo.rotateY(Math.PI / 2);
  const m = new THREE.Mesh(geo, whiteMat);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  const capGeo = new THREE.CircleGeometry(r, 24, 0, Math.PI);
  const c1 = new THREE.Mesh(capGeo, whiteMat);
  c1.position.z = len / 2;
  const c2 = new THREE.Mesh(capGeo, whiteMat);
  c2.position.z = -len / 2;
  c2.rotation.y = Math.PI;
  g.add(c1, c2);
  return g;
}

export function buildSawtoothFactory() {
  const g = new THREE.Group();
  g.add(box(7.0, 1.9, 4.2, 0, 0.95, 0));
  const tri = new THREE.Shape();
  tri.moveTo(0, 0);
  tri.lineTo(1.55, 0);
  tri.lineTo(0, 1.0);
  tri.closePath();
  const triGeo = new THREE.ExtrudeGeometry(tri, { depth: 4.0, bevelEnabled: false });
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(triGeo, whiteMat);
    m.position.set(-3.3 + i * 1.65, 1.9, -2.0);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }
  return g;
}

export function buildChimneyFactory() {
  const g = new THREE.Group();
  g.add(box(2.0, 1.5, 1.7, 0, 0.75, 0));
  g.add(box(1.4, 0.55, 1.2, -0.1, 1.77, 0));
  const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.21, 1.7, 10), whiteMat);
  ch.position.set(0.55, 1.9, -0.3);
  ch.castShadow = true;
  g.add(ch);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.035, 6, 16), whiteMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0.55, 2.72, -0.3);
  g.add(ring);
  g.userData.chimneyTop = new THREE.Vector3(0.55, 2.8, -0.3);
  return g;
}

export function buildWaterTower() {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), whiteMat);
    leg.position.set(Math.cos(a) * 0.62, 1.2, Math.sin(a) * 0.62);
    leg.castShadow = true;
    g.add(leg);
  }
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 1.25, 18), whiteMat);
  tank.position.y = 2.95;
  tank.castShadow = true;
  g.add(tank);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.95, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2), whiteMat);
  cap.position.y = 3.57;
  cap.castShadow = true;
  g.add(cap);
  return g;
}

export function buildTruck() {
  const g = new THREE.Group();
  g.add(box(0.8, 0.75, 0.95, -1.45, 0.62, 0, whiteMat, 0.07));
  g.add(box(2.3, 0.95, 1.0, 0.25, 0.78, 0, whiteMat, 0.05));
  const wheelGeo = new THREE.CylinderGeometry(0.21, 0.21, 0.16, 12);
  wheelGeo.rotateX(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0xb9c6d6, roughness: 0.9 });
  const wp = [[-1.55, 0.45], [-0.5, 0.45], [0.6, 0.45], [1.1, 0.45]];
  for (const [x, z] of wp)
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(x, 0.21, z * s + (s > 0 ? 0.08 : -0.08));
      w.castShadow = true;
      g.add(w);
    }
  return g;
}

/* ------------------------------------------------- people */
export function buildFigure() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.22, 3, 8), whiteMat);
  body.position.y = 0.26;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), whiteMat);
  head.position.y = 0.52;
  head.castShadow = true;
  g.add(body, head);
  return g;
}

export function scatterFigures(spots) {
  const g = new THREE.Group();
  for (const [x, z, ry] of spots) {
    const f = buildFigure();
    f.position.set(x, 0, z);
    f.rotation.y = ry || 0;
    g.add(f);
  }
  return g;
}

/* ------------------------------------------------- tile grid */
export function buildTileGrid(cols = 11, rows = 9, pitch = 1.62) {
  const g = new THREE.Group();
  const tiles = [];
  const geo = roundedBox(1.28, 0.18, 1.28, 0.07);
  const cx = (cols - 1) / 2;
  const cz = (rows - 1) / 2;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      // soften footprint corners: skip far corners for elliptical feel
      const dx = (i - cx) / cx;
      const dz = (j - cz) / cz;
      if (dx * dx + dz * dz > 1.45) continue;
      const mat = whiteMat.clone();
      mat.emissive = new THREE.Color(0x4d7dff);
      mat.emissiveIntensity = 0;
      const m = new THREE.Mesh(geo, mat);
      m.position.set((i - cx) * pitch, 0.42, (j - cz) * pitch);
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.ring = Math.max(Math.abs(i - cx), Math.abs(j - cz));
      m.userData.baseY = 0.42;
      g.add(m);
      tiles.push(m);
      if (i === Math.floor(cx) && j === Math.floor(cz)) g.userData.centerTile = m;
    }
  }
  g.userData.tiles = tiles;
  return g;
}

/* ------------------------------------------------- arrow monument */
function steppedExtrude(shape, layers, baseDepth, shrink, mat) {
  const g = new THREE.Group();
  let scale = 1;
  let z = 0;
  for (let i = 0; i < layers; i++) {
    const depth = baseDepth * (i === 0 ? 1 : 0.42);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 2,
    });
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(scale, scale, 1);
    m.position.z = z;
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    z += depth + 0.04;
    scale *= shrink;
  }
  return g;
}

export function buildArrowMonument() {
  const g = new THREE.Group();
  const mat = whiteMat.clone();
  mat.emissive = new THREE.Color(0x6f9bff);
  mat.emissiveIntensity = 0;

  // chevron `>` shape, centered on its midline
  const t = 1.35; // arm thickness (horizontal inset)
  const s = 3.1; // half-span
  const shape = new THREE.Shape();
  shape.moveTo(0, -s);
  shape.lineTo(s, 0);
  shape.lineTo(0, s);
  shape.lineTo(-t, s);
  shape.lineTo(s - t, 0);
  shape.lineTo(-t, -s);
  shape.closePath();

  const chevron = steppedExtrude(shape, 3, 0.7, 0.78, mat);
  chevron.position.set(-1.2, s + 0.55, 0.0);
  g.add(chevron);

  // surrounding diamonds (logo cubes), in the chevron's plane
  const diaPos = [
    [3.4, 3.1, 0.9, 1.05],
    [4.6, 0.0, 0.4, 1.2],
    [3.4, -3.0, 0.7, 1.0],
    [0.6, 4.6, 0.5, 0.95],
    [0.6, -4.6, 0.6, 0.95],
    [-2.6, 3.9, 0.3, 0.8],
    [-2.6, -3.9, 0.4, 0.8],
    [5.6, 2.2, 0.2, 0.7],
  ];
  const diamonds = [];
  for (const [dx, dy, dz, sc] of diaPos) {
    const dShape = new THREE.Shape();
    const r = 0.62 * sc;
    dShape.moveTo(0, -r);
    dShape.lineTo(r, 0);
    dShape.lineTo(0, r);
    dShape.lineTo(-r, 0);
    dShape.closePath();
    const d = steppedExtrude(dShape, 3, 0.34, 0.7, mat);
    d.position.set(dx * 0.92 - 0.4, s + 0.55 + dy * 0.92, dz);
    g.add(d);
    diamonds.push(d);
  }
  g.userData.diamonds = diamonds;
  g.userData.mat = mat;
  // stand vertical facing the camera side (+Z), journey arrives along +X
  g.rotation.y = -Math.PI / 2 + 0.12;
  return g;
}

/* ------------------------------------------------- smoke sprites */
export function makeSmokeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.32)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

export function buildSmokeColumn(tex, count = 3) {
  const g = new THREE.Group();
  const puffs = [];
  for (let i = 0; i < count; i++) {
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const s = new THREE.Sprite(mat);
    g.add(s);
    puffs.push({ s, phase: i / count });
  }
  g.userData.puffs = puffs;
  return g;
}
