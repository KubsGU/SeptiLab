import * as THREE from 'three';

/* Shared palette + generic primitives reused across the bio scene. */
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

/* ---- people (scale/scene dressing) ---- */
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

/* ---- smoke / mist sprites ---- */
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
  return new THREE.CanvasTexture(c);
}

export function buildSmokeColumn(tex, count = 3) {
  const g = new THREE.Group();
  const puffs = [];
  for (let i = 0; i < count; i++) {
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false });
    const s = new THREE.Sprite(mat);
    g.add(s);
    puffs.push({ s, phase: i / count });
  }
  g.userData.puffs = puffs;
  return g;
}
