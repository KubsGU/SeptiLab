import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { PALETTE, buildFigure, scatterFigures, makeSmokeTexture, buildSmokeColumn } from './builders.js';
import {
  buildTree, buildBush, buildSoilMound, buildCompost, buildSampleStation,
  buildLabBench, buildSmallFermenter, buildShakerTable, buildBioreactor, buildPipeRun,
  buildSprayDryer, buildCyclone, buildCentrifuge, buildPowderPile, buildSacks,
  buildJar, buildMixingVat, buildFlask,
  buildHouse, buildShed, buildWell, buildMailbox, buildFence, buildPath, buildDrainField, buildSepticCutaway,
  buildRock, buildGrassTuft, buildLog, buildSilo, buildPallet, buildControlPanel,
  buildLabBuilding, buildConveyorJars, buildCar, buildStreetlamp, buildGardenBed,
} from './bio.js';
import {
  buildMergePath, buildHexMarker, buildStrands, buildHeadGlow, buildPulseRing, GLOW_BLUE, GLOW_GREEN,
} from './trail.js';

gsap.registerPlugin(ScrollTrigger);

const STATIONS = {
  hero: { pos: [-23, 25, 43], tgt: [5, 1, -5] },
  nature: { pos: [-13, 12, 24], tgt: [4, 1.5, -2] },
  lab: { pos: [13, 10.5, 22], tgt: [29, 1.6, -1] },
  inoc: { pos: [37, 11.5, 22], tgt: [54, 1.6, -1] },
  bioreactor: { pos: [60, 15, 26], tgt: [79, 3, -1] },
  drying: { pos: [85, 16, 27], tgt: [104, 3.5, -1] },
  product: { pos: [112, 9, 24], tgt: [131, 4, -1] },
  home: { pos: [140, 11, 26], tgt: [154, 2.6, 0] },
  homeClose: { pos: [145.5, 6, 15.5], tgt: [152.5, 2.0, 2] },
};

const _UP = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class App {
  constructor(canvas) {
    this.canvas = canvas;
    this.time = 0;
    this.mouse = { x: 0, y: 0 };
    this.par = { x: 0, y: 0 };
    this.pulse = { x: 0, y: 0 };
    this.activeStep = 0;

    this.fills = [];       // culture-fill shader materials (uTime)
    this.motors = [];      // { m, speed }
    this.sways = [];       // { sway, base }
    this.bubbleSys = [];   // bubble groups
    this.smoke = [];       // mist columns

    this.initRenderer();
    this.initScene();
    this.buildWorld();
    this.initCamera();
    this.initPost();
    this.bindEvents();

    gsap.ticker.add((t, dt) => this.update(dt / 1000));
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.bg);
    this.scene.fog = new THREE.FogExp2(PALETTE.bg, 0.0092);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xbfcfdd, 1.05));

    const dir = new THREE.DirectionalLight(0xffffff, 1.4);
    dir.position.set(48, 60, 34);
    dir.target.position.set(70, 0, 0);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    Object.assign(dir.shadow.camera, { left: -100, right: 100, top: 60, bottom: -60, near: 10, far: 200 });
    dir.shadow.bias = -0.0004;
    dir.shadow.radius = 5;
    this.scene.add(dir, dir.target);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 500),
      new THREE.MeshStandardMaterial({ color: PALETTE.ground, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(60, 0, 0);
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  collect(obj) {
    if (obj.userData.fill) this.fills.push(obj.userData.fill.userData.mat);
    if (obj.userData.motor) this.motors.push({ m: obj.userData.motor, speed: 1.4 });
    if (obj.userData.bubbles) this.bubbleSys.push(obj.userData.bubbles);
  }

  buildWorld() {
    const S = this.scene;

    /* ---- Zone 1: nature / strain collection (x ~ 0) */
    const nature = new THREE.Group();
    const treeSpots = [[-5, -5], [9, -7], [-7, 4], [11, 5], [2, -9], [-2, 8]];
    treeSpots.forEach(([x, z], i) => {
      const t = buildTree(i + 3);
      t.position.set(x, 0, z);
      nature.add(t);
      this.sways.push({ sway: t.userData.sway, base: t.userData.swayBase });
    });
    [[-3, 4], [7, 7], [-8, -1]].forEach(([x, z], i) => {
      const b = buildBush(i + 1);
      b.position.set(x, 0, z);
      nature.add(b);
      this.sways.push({ sway: b.userData.sway, base: b.userData.swayBase });
    });
    const mound = buildSoilMound(1.8); mound.position.set(-2, 0, 1); nature.add(mound);
    const mound2 = buildSoilMound(1.2); mound2.position.set(8, 0, 1.5); nature.add(mound2);
    const compost = buildCompost(); compost.position.set(-7, 0, 6); nature.add(compost);
    this.sampleStation = buildSampleStation();
    this.sampleStation.position.set(4, 0, 0);
    nature.add(this.sampleStation);
    this.fills.push(this.sampleStation.userData.fill.userData.mat);
    S.add(nature);

    /* ---- Zone 2: laboratory testing (x ~ 28) */
    this.labBench = buildLabBench();
    this.labBench.position.set(28, 0, -1);
    this.labBench.rotation.y = 0.12;
    S.add(this.labBench);
    if (this.labBench.userData.heroFlask) this.fills.push(this.labBench.userData.heroFlask.userData.fill.userData.mat);
    S.add(scatterFigures([[24, 2.2, 0.4], [33, 2.4, -0.8], [30, -3, 1.5]]));

    const labStartsZ = [[26, 6, -3], [28, 6.5, -4], [30, 6, -3.5], [27, 5.6, -2.6]].map((p) => new THREE.Vector3(...p));
    const labEndsZ = [[26, 1.5, 0.1], [28, 1.6, 0.1], [30, 1.4, 0.1], [29, 1.5, 0.1]].map((p) => new THREE.Vector3(...p));
    this.strands = buildStrands(labStartsZ, labEndsZ, 2.6, GLOW_BLUE);
    S.add(this.strands);

    /* ---- Zone 3: inoculation culture (x ~ 52) */
    this.shaker = buildShakerTable();
    this.shaker.position.set(49, 0, 3.5);
    S.add(this.shaker);
    this.shaker.userData.flasks.forEach((f) => this.fills.push(f.userData.fill.userData.mat));
    this.fermenters = [];
    [[52, -2, 1], [55, -0.5, 0.85], [53.5, 1.5, 0.7]].forEach(([x, z, sc]) => {
      const fr = buildSmallFermenter(sc);
      fr.position.set(x, 0, z);
      S.add(fr);
      this.collect(fr);
      this.fermenters.push(fr);
    });
    S.add(scatterFigures([[47, -3, 0.5], [57, 2.5, 2.2]]));

    /* ---- Zone 4: bioreactor (x ~ 78) */
    this.reactors = [];
    const r1 = buildBioreactor(1.0); r1.position.set(79, 0, -1); S.add(r1); this.collect(r1); this.reactors.push(r1);
    const r2 = buildBioreactor(0.78); r2.position.set(74, 0, 3.5); S.add(r2); this.collect(r2); this.reactors.push(r2);
    S.add(buildPipeRun(new THREE.Vector3(76.2, 1.2, 3.2), new THREE.Vector3(77.4, 1.0, -0.6), 0.08));
    this.reactorPulse = buildPulseRing();
    this.reactorPulse.position.set(79, 0.1, -1);
    S.add(this.reactorPulse);
    S.add(scatterFigures([[73, -3.5, 0.5], [82, 2, -1], [76, 5, 1.5]]));

    /* ---- Zone 5: concentration + spray drying (x ~ 102) */
    this.dryer = buildSprayDryer(1.0);
    this.dryer.position.set(102, 0, -1);
    S.add(this.dryer);
    this.cyclone = buildCyclone(0.95);
    this.cyclone.position.set(105.5, 0, 2.4);
    S.add(this.cyclone);
    S.add(buildPipeRun(
      this.cyclone.position.clone().add(this.cyclone.userData.inlet),
      this.dryer.position.clone().add(new THREE.Vector3(0, this.dryer.userData.ductTop, 0)),
      0.09
    ));
    this.centrifuge = buildCentrifuge();
    this.centrifuge.position.set(98, 0, 3.5);
    S.add(this.centrifuge);
    this.powder = buildPowderPile(1.1);
    this.powder.position.set(101.5, 0, 4.8);
    S.add(this.powder);
    const sacks = buildSacks(4); sacks.position.set(106, 0, 5.4); S.add(sacks);

    // spray mist plume rising from dryer top
    const smokeTex = makeSmokeTexture();
    const mist = buildSmokeColumn(smokeTex, 3);
    mist.position.copy(this.dryer.position).add(this.dryer.userData.topInlet);
    mist.userData.scale = 0.8;
    S.add(mist);
    this.smoke.push(mist);

    /* ---- Zone 6: formulation + packaging / product reveal (x ~ 128) */
    this.mixingVat = buildMixingVat(1.0);
    this.mixingVat.position.set(123, 0, 3.5);
    S.add(this.mixingVat);
    this.collect(this.mixingVat);

    this.jar = buildJar(2.3, true);
    this.jar.position.set(131, 0, -0.5);
    this.jar.rotation.y = 1.1; // turn the label toward the approaching camera
    S.add(this.jar);

    this.smallJars = [];
    const jarSpots = [[126, 4, 0.5], [135, 3.5, 0.4], [128, -3.5, 0.7], [137, -1, 0.5], [124, -2, 0.45]];
    for (const [x, z, sc] of jarSpots) {
      const j = buildJar(sc, false);
      j.position.set(x, 0, z);
      S.add(j);
      this.smallJars.push(j);
    }

    /* ---- Zone 7: the product in use — home + cutaway septic tank (x ~ 153) */
    const home = new THREE.Group();
    const house = buildHouse(); house.position.set(158, 0, -4.5); house.rotation.y = -0.5; home.add(house);
    const shed = buildShed(); shed.position.set(163, 0, 3); shed.rotation.y = -0.6; home.add(shed);
    const well = buildWell(); well.position.set(162, 0, -1); home.add(well);
    const mailbox = buildMailbox(); mailbox.position.set(145, 0, 7.2); home.add(mailbox);
    home.add(buildFence([[143, -8], [167, -8], [167, 9], [143, 9]], 0.95));
    home.add(buildPath([[150.5, 5.5], [151.5, 4.2], [152.5, 3], [153.5, 1.8], [156, 0], [157.5, -1.6]]));
    [[145, -5, 4], [165, -6, 5], [146, 2, 3], [166, 6, 4], [160, 8, 2]].forEach(([x, z, s], i) => {
      const t = buildTree(s + i); t.position.set(x, 0, z); home.add(t);
      this.sways.push({ sway: t.userData.sway, base: t.userData.swayBase });
    });
    [[148, 6], [164, -3], [150, -7]].forEach(([x, z], i) => {
      const b = buildBush(i + 5); b.position.set(x, 0, z); home.add(b);
      this.sways.push({ sway: b.userData.sway, base: b.userData.swayBase });
    });
    const drain = buildDrainField(); drain.position.set(159, 0, 5.5); drain.rotation.y = 0.2; home.add(drain);
    home.add(scatterFigures([[154, 4.5, -2.4], [149.5, -2, 1]]));
    S.add(home);

    this.cutaway = buildSepticCutaway();
    this.cutaway.position.set(152, 0, 2);
    S.add(this.cutaway);
    this.tankHealth = { v: 0 };
    // mist from the house chimney
    const homeSmoke = buildSmokeColumn(makeSmokeTexture(), 2);
    homeSmoke.position.copy(house.position).add(house.userData.chimneyTop.clone().applyEuler(house.rotation));
    homeSmoke.userData.scale = 0.5;
    homeSmoke.userData.active = 1;
    S.add(homeSmoke);
    this.smoke.push(homeSmoke);

    /* ============================================================ density + feeder lines */
    this.bubbleSys.push(this.cutaway.userData.bubbles);
    this.feeders = [];
    const feed = (hub, sources, arc = 1.8, alpha = 0.5) => {
      const H = Array.isArray(hub) ? new THREE.Vector3(...hub) : hub;
      const starts = sources.map((s) => new THREE.Vector3(...s));
      const ends = sources.map(() => H.clone());
      const f = buildStrands(starts, ends, arc, GLOW_GREEN, 0.026, alpha);
      f.userData.mats.forEach((m) => (m.uniforms.uDraw.value = 1));
      S.add(f);
      this.feeders.push(f);
    };
    const addTrees = (spots, seedBase) => spots.forEach(([x, z, s], i) => {
      const t = buildTree((s || 1) + seedBase + i);
      t.position.set(x, 0, z); S.add(t);
      this.sways.push({ sway: t.userData.sway, base: t.userData.swayBase });
    });
    const addGrass = (spots, seedBase) => spots.forEach(([x, z], i) => {
      const t = buildGrassTuft(seedBase + i);
      t.position.set(x, 0, z); S.add(t);
      this.sways.push({ sway: t.userData.sway, base: t.userData.swayBase });
    });
    const addRocks = (spots) => spots.forEach(([x, z], i) => { const r = buildRock(i + 2); r.position.set(x, 0, z); S.add(r); });

    /* Zone 1 — nature: forest, rocks, grass, logs + lanes from ground & trees to the sample cauldron */
    addTrees([[-9, -6, 4], [13, -4, 5], [-11, 3, 3], [8, 11, 4], [-4, -10, 2], [13, 8, 3], [-13, -2, 4], [4, 13, 3]], 20);
    addRocks([[-4, -3], [9, -5], [-6, 6], [11, 3], [1, -8], [-9, 2], [6, 9], [3, 5]]);
    addGrass([[-2, -4], [7, -3], [-5, 5], [10, 6], [2, 7], [-7, -2], [5, 2], [0, -6], [8, 1], [-3, 8], [12, -1], [-10, 5]], 40);
    const log1 = buildLog(); log1.position.set(-4.5, 0, 3.5); log1.rotation.y = 0.6; S.add(log1);
    const log2 = buildLog(); log2.position.set(9, 0, 7); log2.rotation.y = -0.4; S.add(log2);
    feed([4, 1.0, 0], [[-5, 1.6, -5], [9, 1.8, -7], [-7, 1.4, 4], [11, 1.6, 5], [-2, 0.4, 1], [8, 0.4, 1.5], [-9, 0.4, 2], [3, 0.4, 5]], 2.4, 0.6);

    /* Zone 2 — lab: building, control panels, pallets, feeders to the bench */
    const labBld = buildLabBuilding(); labBld.position.set(24, 0, -7.5); labBld.rotation.y = 0.1; S.add(labBld);
    const cp1 = buildControlPanel(); cp1.position.set(33, 0, -3.5); cp1.rotation.y = -0.6; S.add(cp1);
    const pal1 = buildPallet(2); pal1.position.set(22.5, 0, 3); S.add(pal1);
    addGrass([[20, 4], [37, 2], [25, -4]], 60);
    feed([28, 1.6, -1], [[24, 2.6, -6], [33, 1.4, -3.2], [22.6, 1.0, 3], [31, 0.4, 2]], 1.8, 0.5);

    /* Zone 3 — inoc: extra fermenters, silo, control panel, pallets */
    const fr4 = buildSmallFermenter(0.78); fr4.position.set(49.5, 0, -2.5); S.add(fr4); this.collect(fr4); this.fermenters.push(fr4);
    const fr5 = buildSmallFermenter(0.62); fr5.position.set(56.5, 0, 1.5); S.add(fr5); this.collect(fr5); this.fermenters.push(fr5);
    const silo3 = buildSilo(0.7); silo3.position.set(58, 0, -4); S.add(silo3);
    const cp3 = buildControlPanel(); cp3.position.set(47, 0, 5.5); cp3.rotation.y = 0.5; S.add(cp3);
    const pal3 = buildPallet(3); pal3.position.set(58.5, 0, 5); S.add(pal3);
    feed([52, 1.6, -2], [[49.5, 1.2, -2.5], [56.5, 1.0, 1.5], [58, 2.2, -4], [49, 0.5, 3.5]], 1.6, 0.5);

    /* Zone 4 — bioreactor: silos, 3rd reactor, control room, pallets, pipe bridges */
    const r3 = buildBioreactor(0.62); r3.position.set(82.5, 0, 4); S.add(r3); this.collect(r3); this.reactors.push(r3);
    const silo4a = buildSilo(1.0); silo4a.position.set(85, 0, -5.5); S.add(silo4a);
    const silo4b = buildSilo(0.85); silo4b.position.set(88, 0, -3); S.add(silo4b);
    const cp4 = buildControlPanel(); cp4.position.set(74, 0, -4.5); cp4.rotation.y = 0.4; S.add(cp4);
    const pal4 = buildPallet(2); pal4.position.set(72, 0, 5.5); S.add(pal4);
    S.add(buildPipeRun(new THREE.Vector3(84, 2.5, -4), new THREE.Vector3(81, 2.2, -1.4), 0.1));
    feed([79, 3.0, -1], [[82.5, 1.4, 4], [85, 3.0, -5.5], [74, 1.0, -4], [88, 2.6, -3]], 2.2, 0.5);

    /* Zone 5 — drying: silos, conveyor, second cyclone, pallets */
    const silo5 = buildSilo(1.1); silo5.position.set(98, 0, -5.5); S.add(silo5);
    const cyc5 = buildCyclone(0.7); cyc5.position.set(106, 0, -2.5); S.add(cyc5);
    this.conveyor5 = buildConveyorJars(6, 6); this.conveyor5.position.set(104, 0, 5.5); this.conveyor5.rotation.y = -0.3; S.add(this.conveyor5);
    const pal5a = buildPallet(3); pal5a.position.set(108, 0, 4); S.add(pal5a);
    const pal5b = buildPallet(2); pal5b.position.set(96, 0, 5.5); S.add(pal5b);
    feed([102, 2.2, -1], [[98, 3.2, -5.5], [106, 1.6, -2.5], [104, 1.0, 5.5]], 2.0, 0.5);

    /* Zone 6 — packaging: conveyor of jars, pallets, delivery car */
    this.conveyor6 = buildConveyorJars(7, 8); this.conveyor6.position.set(126, 0, 4.5); this.conveyor6.rotation.y = -0.2; S.add(this.conveyor6);
    const pal6a = buildPallet(3); pal6a.position.set(122, 0, 6.5); S.add(pal6a);
    const pal6b = buildPallet(3); pal6b.position.set(124.5, 0, 6.8); S.add(pal6b);
    const car6 = buildCar(); car6.position.set(135, 0, 6.5); car6.rotation.y = 0.5; S.add(car6);
    const cp6 = buildControlPanel(); cp6.position.set(124, 0, -3.5); cp6.rotation.y = -0.4; S.add(cp6);

    /* Zone 7 — home: neighbour house, car, streetlamps, garden beds, more trees + lanes into the tank */
    const house2 = buildHouse(); house2.position.set(168, 0, 6); house2.rotation.y = -1.4; house2.scale.setScalar(0.9); S.add(house2);
    const car7 = buildCar(); car7.position.set(160, 0, -6.5); car7.rotation.y = -0.3; S.add(car7);
    const lamp1 = buildStreetlamp(); lamp1.position.set(146, 0, -2); S.add(lamp1);
    const lamp2 = buildStreetlamp(); lamp2.position.set(150, 0, 8); lamp2.rotation.y = Math.PI; S.add(lamp2);
    const bed1 = buildGardenBed(); bed1.position.set(156, 0, 6.5); S.add(bed1);
    const bed2 = buildGardenBed(); bed2.position.set(149, 0, 4.5); bed2.rotation.y = 0.5; S.add(bed2);
    addTrees([[170, -3, 4], [144, 4, 3], [167, 9, 3], [172, 2, 4]], 30);
    addGrass([[147, -4], [158, 7], [164, 4], [150, 6], [161, -3]], 80);
    addRocks([[148, -6], [163, 8], [155, 7.5]]);
    feed([152, 1.6, 2], [[158, 2.2, -4], [159, 0.6, 5.5], [146, 1.4, -2], [150, 1.0, 5]], 2.0, 0.5);

    /* ---- one straight glowing culture line running the journey into the tank */
    const xStart = 2, xEnd = 151;
    this.path = buildMergePath({ xStart, xEnd, y: 0.16, zEnd: 2 });
    S.add(this.path);
    this.pathSpan = { xStart, xEnd, zEnd: 2 };
    const prog = (x) => (x - xStart) / (xEnd - xStart);
    this.tZone = {
      nature: prog(9), lab: prog(30), inoc: prog(53), bioreactor: prog(78),
      drying: prog(102), product: prog(127), home: 1,
    };
    this.headGlow = buildHeadGlow();
    S.add(this.headGlow);

    // dotted-hexagon markers the line triggers as it passes each stage
    this.hexMarkers = [];
    [[4, 0], [28, -1], [52, -1.5], [79, -1], [102, -1], [131, -0.5], [152, 1.8]].forEach(([x, z]) => {
      const m = buildHexMarker(3.0);
      m.position.set(x, 0.08, z);
      S.add(m);
      this.hexMarkers.push({ m, prog: prog(x) });
    });
  }

  initCamera() {
    this.camera = new THREE.PerspectiveCamera(31, window.innerWidth / window.innerHeight, 0.1, 500);
    this.camPos = new THREE.Vector3(...STATIONS.hero.pos);
    this.camTgt = new THREE.Vector3(...STATIONS.hero.tgt);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTgt);
  }

  initPost() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.5, 0.45, 0.9);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      const w = window.innerWidth, h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.composer.setSize(w, h);
    });
    window.addEventListener('pointermove', (e) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    });
  }

  buildJourney(onStepChange) {
    const pos = this.camPos, tgt = this.camTgt;
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: '.top', start: 'top top', end: 'bottom bottom', scrub: 0.55,
        onUpdate: (st) => this.onScroll(st.progress, onStepChange),
      },
    });
    this.tl = tl;
    tl.to({}, { duration: 100 }, 0);

    // camera flythrough: dwell + travel segments
    const seg = (a, b, from, to, ease = 'power1.inOut') => {
      if (from === to) return;
      tl.to(pos, { x: to.pos[0], y: to.pos[1], z: to.pos[2], duration: b - a, ease }, a);
      tl.to(tgt, { x: to.tgt[0], y: to.tgt[1], z: to.tgt[2], duration: b - a, ease }, a);
    };
    const Z = STATIONS;
    seg(8, 14, Z.hero, Z.nature);
    seg(20, 27, Z.nature, Z.lab);
    seg(33, 40, Z.lab, Z.inoc);
    seg(46, 53, Z.inoc, Z.bioreactor);
    seg(60, 65, Z.bioreactor, Z.drying);
    seg(71, 76, Z.drying, Z.product);
    seg(82, 88, Z.product, Z.home);
    seg(94, 100, Z.home, Z.homeClose);

    // culture head advancing along the lanes, all the way into the tank
    const head = this.path.userData.head;
    const T = this.tZone;
    tl.to(head, { value: T.nature, duration: 5, ease: 'power1.in' }, 9);
    tl.to(head, { value: T.lab, duration: 8 }, 20);
    tl.to(head, { value: T.inoc, duration: 8 }, 33);
    tl.to(head, { value: T.bioreactor, duration: 8 }, 46);
    tl.to(head, { value: T.drying, duration: 7 }, 60);
    tl.to(head, { value: T.product, duration: 7 }, 71);
    tl.to(head, { value: T.home, duration: 7, ease: 'power1.in' }, 84);
    tl.to(this.path.userData.fade, { value: 0.32, duration: 5 }, 91);

    /* Z1 — sampling glow */
    tl.fromTo(this.sampleStation.userData.fill.userData.mat.uniforms.uLevel, { value: 0.35 }, { value: 0.72, duration: 3.5, yoyo: true, repeat: 1 }, 9);

    /* Z2 — analysis beams + culture in hero flask */
    this.strands.userData.mats.forEach((m, i) => tl.to(m.uniforms.uDraw, { value: 1, duration: 5, ease: 'power1.in' }, 27 + i * 0.6));
    if (this.labBench.userData.heroFlask)
      tl.fromTo(this.labBench.userData.heroFlask.userData.fill.userData.mat.uniforms.uLevel, { value: 0 }, { value: 0.66, duration: 5 }, 29);
    this.strands.userData.mats.forEach((m) => tl.to(m.uniforms.uDraw, { value: 1.25, duration: 4 }, 38));

    /* Z3 — fermenters fill */
    this.fermenters.forEach((fr, i) => tl.fromTo(fr.userData.fill.userData.mat.uniforms.uLevel, { value: 0 }, { value: 0.86, duration: 6 }, 40 + i * 1.2));
    this.shaker.userData.flasks.forEach((f, i) => tl.fromTo(f.userData.fill.userData.mat.uniforms.uLevel, { value: 0.2 }, { value: 0.66, duration: 4 }, 41 + i * 0.3));

    /* Z4 — bioreactor fills + bubbles + pulse */
    this.reactors.forEach((r, i) => tl.fromTo(r.userData.fill.userData.mat.uniforms.uLevel, { value: 0 }, { value: 0.9, duration: 8, ease: 'power1.inOut' }, 53 + i * 1.5));
    this.reactors.forEach((r) => tl.fromTo(r.userData.bubbles.userData, { active: 0 }, { active: 1, duration: 5 }, 55));
    tl.fromTo(this.reactorPulse.scale, { x: 0.01, y: 0.01, z: 0.01 }, { x: 13, y: 13, z: 13, duration: 6, ease: 'power2.out' }, 54);
    tl.fromTo(this.reactorPulse.material.uniforms.uOpacity, { value: 0.4 }, { value: 0, duration: 4 }, 56);

    /* Z5 — drying: mist + powder grows */
    tl.fromTo(this.smoke[0].userData, { active: 0 }, { active: 1, duration: 5 }, 65);
    tl.fromTo(this.powder.scale, { x: 0.01, y: 0.01, z: 0.01 }, { x: 1, y: 1, z: 1, duration: 6, ease: 'power2.out' }, 66);
    tl.fromTo(this.powder.userData.spark.material, { opacity: 0 }, { opacity: 0.7, duration: 3, yoyo: true, repeat: 1 }, 68);

    /* Z6 — formulation + product reveal */
    tl.fromTo(this.mixingVat.userData.fill.userData.mat.uniforms.uLevel, { value: 0 }, { value: 0.8, duration: 5 }, 76);
    tl.to(this.jar.userData.halo.material, { opacity: 0.5, duration: 2.2, ease: 'power2.in' }, 80);
    tl.to(this.jar.userData.halo.material, { opacity: 0.3, duration: 3 }, 83);
    this.smallJars.forEach((j, i) => { j.scale.setScalar(0.01); tl.to(j.scale, { x: 1, y: 1, z: 1, duration: 1.0, ease: 'back.out(1.8)' }, 78 + i * 0.4); });

    /* Z7 — pour the dose into the tank, the magic, a healthy tank */
    const dose = this.cutaway.userData.dose;
    const H = this.cutaway.userData.size.h;
    tl.to(dose.position, { y: H + 0.3, duration: 2.6, ease: 'power2.in' }, 85);
    tl.to(dose.userData.powder.scale, { x: 0.02, y: 0.02, z: 0.02, duration: 1.3, ease: 'power1.in' }, 87.6);
    tl.fromTo(dose.userData.burst.material, { opacity: 0 }, { opacity: 0.9, duration: 1.0, yoyo: true, repeat: 1 }, 87.8);
    tl.to(this.tankHealth, { v: 1, duration: 11, ease: 'power1.inOut' }, 88);
  }

  onScroll(p, onStepChange) {
    const ranges = [
      [0.10, 0.24], [0.24, 0.37], [0.37, 0.50], [0.50, 0.62], [0.62, 0.73], [0.73, 0.84], [0.84, 1.001],
    ];
    let step = 0, fill = 0;
    for (let i = 0; i < ranges.length; i++) {
      if (p >= ranges[i][0]) {
        step = i + 1;
        fill = Math.min(1, (p - ranges[i][0]) / (ranges[i][1] - ranges[i][0]));
      }
    }
    if (step !== this.activeStep) {
      this.activeStep = step;
      onStepChange?.(step);
    }
    this.stepFill = fill;
  }

  // a brief parallax kick (like a mouse hover) when a step is stepped over
  stepPulse() {
    this._pulseDir = -(this._pulseDir || 1);
    this.pulse.x = 0.8 * this._pulseDir;
    this.pulse.y = -0.45;
  }

  update(dt) {
    this.time += dt;
    const t = this.time;

    // gentle damped pointer parallax, matched to vectrfl (offset *0.6, 1-exp(-1.5*dt))
    const u = 1 - Math.exp(-1.5 * dt);
    this.par.x += (this.mouse.x - this.par.x) * u;
    this.par.y += (this.mouse.y - this.par.y) * u;
    this.pulse.x *= 0.9;
    this.pulse.y *= 0.9;
    const cam = this.camera;
    cam.position.copy(this.camPos);
    _dir.copy(this.camTgt).sub(this.camPos).normalize();
    _right.crossVectors(_dir, _UP).normalize();
    _up.crossVectors(_right, _dir).normalize();
    const px = this.par.x + this.pulse.x, py = this.par.y + this.pulse.y;
    cam.position.addScaledVector(_right, px * 0.6).addScaledVector(_up, -py * 0.6);
    cam.lookAt(this.camTgt);

    for (const f of this.fills) f.uniforms.uTime.value = t;
    for (const { m, speed } of this.motors) m.rotation.y = t * speed;
    for (const { sway, base } of this.sways) sway.rotation.z = Math.sin(t * 0.6 + base) * 0.05;
    if (this.centrifuge) this.centrifuge.userData.lid.rotation.y = t * 6;
    if (this.shaker) this.shaker.userData.platform.position.x = Math.sin(t * 7) * 0.04;

    // bubbles
    for (const bs of this.bubbleSys) {
      const { items, height, active } = bs.userData;
      for (const it of items) {
        const k = (t * it.speed + it.phase) % 1;
        it.s.position.y = k * height;
        it.s.material.opacity = active * Math.min(1, k / 0.1) * Math.max(0, 1 - k) * 0.9;
      }
    }

    // mist
    for (const col of this.smoke) {
      const sc = col.userData.scale;
      const active = col.userData.active ?? 1;
      for (const { s, phase } of col.userData.puffs) {
        const k = (t * 0.14 + phase) % 1;
        s.position.y = k * 3.2;
        s.scale.setScalar((0.9 + k * 2.4) * sc);
        s.material.opacity = active * 0.32 * Math.min(1, k / 0.12) * Math.max(0, 1 - (k - 0.45) / 0.55) ** 1.4;
      }
    }

    // culture head glow sprite rides the merged line tip
    const pd = this.path?.userData;
    if (pd) {
      pd.time.value = t;
      const h = pd.head.value;
      if (h > 0.01 && h < 0.997) {
        const x = this.pathSpan.xStart + h * (this.pathSpan.xEnd - this.pathSpan.xStart);
        const z = this.pathSpan.zEnd * smoothstep(0.9, 1.0, h);
        this.headGlow.position.set(x, 0.24, z);
        this.headGlow.scale.setScalar(1.0 * (1 + Math.sin(t * 5) * 0.1));
        this.headGlow.material.opacity = 0.3 * pd.fade.value;
      } else this.headGlow.material.opacity = 0;
    }
    for (const m of this.strands?.userData.mats || []) m.uniforms.uTime.value = t;
    for (const f of this.feeders || []) for (const m of f.userData.mats) m.uniforms.uTime.value = t;

    // dotted hexagons pulse as the culture line passes through each stage
    const hh = this.path ? this.path.userData.head.value : 0;
    for (const { m, prog: p } of this.hexMarkers || []) {
      const inten = Math.exp(-Math.pow((hh - p) * 7.0, 2));
      m.userData.mat.opacity = inten * 0.95;
      const s = 0.55 + inten * 0.75;
      m.scale.set(s, s, s);
      m.rotation.z = t * 0.4;
    }

    // tank "magic": health drives the liquid, bacteria swarm and waste dissolve
    if (this.cutaway) {
      const v = this.tankHealth.v;
      const u = this.cutaway.userData;
      u.liquid.uniforms.uHealth.value = v;
      u.liquid.uniforms.uTime.value = t;
      u.bacteria.uniforms.uHealth.value = v;
      u.bacteria.uniforms.uTime.value = t;
      u.bubbles.userData.active = Math.max(0, (v - 0.2) / 0.8);
      for (const w of u.wisps) {
        const k = (t * 0.2 + w.phase) % 1;
        w.s.position.set(w.x + Math.sin(t + w.phase * 6) * 0.2, u.tankTop + k * 1.6, 0.4);
        w.s.scale.setScalar(0.6 + k * 1.3);
        w.s.material.opacity = (1 - v) * Math.max(0, 1 - k) * 0.5;
      }
      const wd = u.waste.userData;
      for (let i = 0; i < wd.count; i++) {
        const p = wd.data[i];
        const vis = 1 - smoothstep(p.thresh - 0.08, p.thresh + 0.08, v);
        wd.dummy.position.set(p.x, p.y, p.z);
        wd.dummy.scale.set(p.s * p.sx * vis, p.s * p.sy * vis, p.s * p.sz * vis);
        wd.dummy.updateMatrix();
        u.waste.setMatrixAt(i, wd.dummy.matrix);
      }
      u.waste.instanceMatrix.needsUpdate = true;
    }

    if (this.activeStep > 0 && this.stepFill !== this._lastFill) {
      this._lastFill = this.stepFill;
      const el = document.querySelector(`.flow__step[data-step="${this.activeStep}"] .flow__track-fill`);
      if (el) el.style.height = `${(this.stepFill * 100).toFixed(1)}%`;
    }

    this.composer.render();
  }
}
