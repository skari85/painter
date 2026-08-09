/**
 * world.js — the four rooms of the scene.
 *
 *   THE GARRET            warm, wrecked, yours. Easel, mattress, shrine.
 *   GALLERIA BIANCA       cold white cube. Pedestals, wine, judgment.
 *   THE VAULT             dark freeport. Caged masterpieces, one throne.
 *   THE LEATHER & LATEX   the collector's house. Hide up front, shine
 *   ROOMS                 in the back — one house, two material moods.
 *
 * Everything is procedural geometry + generated canvas textures.
 * Collision is XZ axis-aligned boxes (single-floor zones by design).
 * Paint splats are pooled decal planes, recycled ring-buffer style.
 */

import * as THREE from 'three';
import { mulberry32, rand, pick } from '../core/utils.js';


const WALL_H = 3.6;

/** The artist's own paintings — compressed JPEGs, hung around the garret. */
const GARRET_PHOTOS = [
  { url: 'puplic/paintings/IMG_6335.jpg', x: -1.4, y: 2.0, z: -4.28, ry: 0, h: 1.05 },
  { url: 'puplic/paintings/IMG_7416.jpg', x: 1.6,  y: 2.0, z: -4.28, ry: 0, h: 1.15 },
  { url: 'puplic/paintings/IMG_7417.jpg', x: -2.6, y: 1.9, z: 4.28,  ry: Math.PI, h: 1.15 },
  { url: 'puplic/paintings/IMG_8067.jpg', x: 0,    y: 1.9, z: 4.28,  ry: Math.PI, h: 1.15 },
  { url: 'puplic/paintings/IMG_8555.jpg', x: 2.6,  y: 1.9, z: 4.28,  ry: Math.PI, h: 1.15 },
  { url: 'puplic/paintings/IMG_7064.jpg', x: -5.78, y: 2.1, z: -1.6, ry: Math.PI / 2, h: 1.1 },
  { url: 'puplic/paintings/IMG_8428.jpg', x: -5.78, y: 2.1, z: 0.8,  ry: Math.PI / 2, h: 1.0 },
];

/* ============================================================
   Texture factories
   ============================================================ */

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Every pedestal piece is a unique "work" — deterministic per seed. */
export function artworkTexture(seed) {
  const rng = mulberry32(seed);
  const grounds = ['#e8e2d4', '#1d1f2a', '#c9bfae', '#2e3a33', '#3a2c33', '#d8d2c2'];
  const inks = ['#c96f2e', '#8c3b2e', '#2b3a67', '#e8c15a', '#7fb285', '#8a5cf6', '#1f2430', '#efe9dc'];
  return canvasTexture(128, 160, (ctx, w, h) => {
    ctx.fillStyle = grounds[Math.floor(rng() * grounds.length)];
    ctx.fillRect(0, 0, w, h);
    const strokes = 4 + Math.floor(rng() * 6);
    for (let i = 0; i < strokes; i++) {
      ctx.fillStyle = inks[Math.floor(rng() * inks.length)];
      ctx.globalAlpha = 0.55 + rng() * 0.45;
      const kind = rng();
      if (kind < 0.45) {
        ctx.fillRect(rng() * w, rng() * h, 12 + rng() * 70, 6 + rng() * 40);
      } else if (kind < 0.75) {
        ctx.beginPath();
        ctx.arc(rng() * w, rng() * h, 6 + rng() * 30, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.save();
        ctx.translate(rng() * w, rng() * h);
        ctx.rotate(rng() * Math.PI);
        ctx.fillRect(-40, -3, 80, 6);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  });
}

function textTexture(text, { fg = '#efe9dc', bg = 'rgba(0,0,0,0)', size = 44, w = 512, h = 96, font = '700' } = {}) {
  return canvasTexture(w, h, (ctx) => {
    ctx.clearRect(0, 0, w, h);
    if (bg !== 'rgba(0,0,0,0)') { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
    ctx.fillStyle = fg;
    ctx.font = `${font} ${size}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2);
  });
}

/** Irregular splat blot. */
function splatTexture() {
  return canvasTexture(128, 128, (ctx) => {
    ctx.translate(64, 64);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = 14 + Math.random() * 34;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, 8 + Math.random() * 16, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.fill();
  });
}

/* ============================================================
   Small builders
   ============================================================ */

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.92, ...opts });
}

/** The house speaks two materials: soft hide in the lounge, hard shine on the runway. */
function leatherMat(color = 0x1a0e17) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.48, metalness: 0.04 });
}

function latexMat(color = 0x08080c) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.13,
    metalness: 0.12,
    clearcoat: 0.92,
    clearcoatRoughness: 0.06,
  });
}

/** Box mesh + optional collider registration. */
function box(zone, { w, h, d, x = 0, y = 0, z = 0, material, ry = 0, solid = true, noSplat = false, name = '' }) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y + h / 2, z);
  m.rotation.y = ry;
  m.userData.noSplat = noSplat;
  m.name = name;
  zone.group.add(m);
  if (solid && Math.abs(ry) < 0.01) {
    zone.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  } else if (solid) {
    // rotated boxes: conservative square footprint
    const r = Math.max(w, d) / 2;
    zone.colliders.push({ minX: x - r, maxX: x + r, minZ: z - r, maxZ: z + r });
  }
  return m;
}

function cylinder(zone, { rT, rB, h, x = 0, y = 0, z = 0, material, seg = 12, solid = true, noSplat = false }) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rT, rB, h, seg), material);
  m.position.set(x, y + h / 2, z);
  m.userData.noSplat = noSplat;
  zone.group.add(m);
  if (solid) zone.colliders.push({ minX: x - rB, maxX: x + rB, minZ: z - rB, maxZ: z + rB });
  return m;
}

function plane(zone, { w, h, x = 0, y = 0, z = 0, material, ry = 0, rx = 0, noSplat = true, name = '' }) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.rotation.x = rx;
  m.userData.noSplat = noSplat;
  m.name = name;
  zone.group.add(m);
  return m;
}

/** A bare hanging bulb: cord, socket, glowing glass, warm point light. */
function bulb(zone, { x, z, y = 2.6, intensity = 12, distance = 14, color = 0xffd9a0 }) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const drop = WALL_H - y;
  const cord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, drop, 6),
    mat(0x14100c, { roughness: 0.7 })
  );
  cord.position.y = y + drop / 2;
  cord.userData.noSplat = true;

  const socket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.045, 0.08, 10),
    mat(0x3a332a, { roughness: 0.5, metalness: 0.4 })
  );
  socket.position.y = y + 0.08;
  socket.userData.noSplat = true;

  const glass = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 16, 12),
    new THREE.MeshStandardMaterial({
      color: 0xfff2d8, emissive: 0xffc873, emissiveIntensity: 2.4, roughness: 0.25,
    })
  );
  glass.position.y = y;
  glass.userData.noSplat = true;

  const light = new THREE.PointLight(color, intensity, distance, 1.8);
  light.position.y = y - 0.06;

  g.add(cord, socket, glass, light);
  zone.group.add(g);
  return light;
}

/** Room shell: floor, ceiling, four walls (with collision). */
function shell(zone, { w, d, floorColor, wallColor, ceilColor }) {
  const hw = w / 2, hd = d / 2, t = 0.4;
  box(zone, { w, h: 0.2, d, y: -0.2, material: mat(floorColor), solid: false, name: 'floor' });
  box(zone, { w, h: 0.2, d, y: WALL_H, material: mat(ceilColor), solid: false, noSplat: true });
  box(zone, { w, h: WALL_H, d: t, z: -hd - t / 2, material: mat(wallColor), name: 'wallN' });
  box(zone, { w, h: WALL_H, d: t, z: hd + t / 2, material: mat(wallColor), name: 'wallS' });
  box(zone, { w: t, h: WALL_H, d, x: -hw - t / 2, material: mat(wallColor), name: 'wallW' });
  box(zone, { w: t, h: WALL_H, d, x: hw + t / 2, material: mat(wallColor), name: 'wallE' });
}

/** Doorway + glowing sign + interactable. */
function door(zone, { x, z, ry, label, to, lockedUnlessFlag = null, lockedLabel = '' }) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  zone.group.add(g);

  const frameMat = mat(0x17181d, { roughness: 0.6 });
  const jambL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.4, 0.3), frameMat);
  jambL.position.set(-0.75, 1.2, 0);
  const jambR = jambL.clone();
  jambR.position.x = 0.75;
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.2, 0.3), frameMat);
  lintel.position.set(0, 2.5, 0);
  const portal = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 2.4),
    new THREE.MeshBasicMaterial({ color: 0x050507 })
  );
  portal.position.set(0, 1.2, 0);
  portal.userData.noSplat = true;

  const signMat = new THREE.MeshBasicMaterial({
    map: textTexture(label, { fg: '#e8c15a', size: 40 }),
    transparent: true,
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.36), signMat);
  sign.position.set(0, 2.85, 0.05);
  sign.userData.noSplat = true;

  g.add(jambL, jambR, lintel, portal, sign);
  zone.animated.signs.push(signMat);

  zone.interactables.push({
    id: `door-${to}`,
    type: 'door',
    to,
    label: `Enter — ${label}`,
    pos: new THREE.Vector3(x, 1.2, z),
    radius: 1.9,
    lockedUnlessFlag,
    lockedLabel,
  });
}

/** Framed artwork on a wall. */
function hangingArt(zone, { x, y, z, ry, w = 1.1, h = 1.4, seed }) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, h + 0.1, 0.05), mat(0x2b2118, { roughness: 0.5 }));
  const art = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: artworkTexture(seed), roughness: 0.85 })
  );
  art.position.z = 0.03;
  art.userData.noSplat = true;
  g.add(frame, art);
  zone.group.add(g);
  return art;
}

/** A framed real painting from puplic/paintings — frame sized to the photo's true aspect. */
function hangingPhoto(zone, { x, y, z, ry, url, h = 1.15 }) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.05), mat(0x2b2118, { roughness: 0.5 }));
  const art = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.85 })
  );
  art.position.z = 0.03;
  art.userData.noSplat = true;
  art.name = 'ownPhoto';                 // Q knows whose work this is
  g.add(frame, art);
  zone.group.add(g);
  new THREE.TextureLoader().load(encodeURI(url), (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    const aspect = tex.image.width / tex.image.height;
    const hh = Math.min(h, 1.6 / aspect);          // cap width at 1.6m
    frame.scale.set(aspect * hh + 0.1, hh + 0.1, 1);
    art.scale.set(aspect * hh, hh, 1);
    art.material.map = tex;
    art.material.color.set(0xffffff);
    art.material.needsUpdate = true;
  });
  return art;
}

/* ============================================================
   The World
   ============================================================ */

export class World {
  #scene;
  #splatTex;

  constructor(scene) {
    this.#scene = scene;
    this.#splatTex = splatTexture();
    this.zones = new Map();
    this.current = null;
    this.#buildGarret();
    this.#buildGalleria();
    this.#buildVault();
    this.#buildLeatherLatex();
    for (const [key, z] of this.zones) z.group.visible = false;
  }

  #newZone(key) {
    const zone = {
      key,
      group: new THREE.Group(),
      colliders: [],
      waypoints: [],
      interactables: [],
      anchors: {},
      animated: { candles: [], signs: [], glows: [] },
      splats: { meshes: [], i: 0 },
      spawn: new THREE.Vector3(),
      spawnYaw: 0,
      fog: { color: 0x0b0b0f, density: 0.03 },
    };
    this.zones.set(key, zone);
    this.#scene.add(zone.group);
    return zone;
  }

  /* ---------------------------------------------------------- */
  /*  ZONE 1 — THE GARRET                                       */
  /* ---------------------------------------------------------- */
  #buildGarret() {
    const z = this.#newZone('garret');
    shell(z, { w: 12, d: 9, floorColor: 0x5c3f28, wallColor: 0x39302b, ceilColor: 0x241d19 });
    z.spawn.set(0, 0, 3.2);
    z.spawnYaw = Math.PI;            // face -z toward the easel
    z.fog = { color: 0x18120e, density: 0.03 };

    // easel: two legs + crossbar + canvas tray
    const wood = mat(0x7a5a36, { roughness: 0.7 });
    const easel = new THREE.Group();
    easel.position.set(0, 0, -1.6);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.1, 0.07), wood);
    legL.position.set(-0.45, 1.05, 0); legL.rotation.z = 0.1;
    const legR = legL.clone(); legR.position.x = 0.45; legR.rotation.z = -0.1;
    const legB = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.1, 0.07), wood);
    legB.position.set(0, 1.05, -0.35); legB.rotation.x = -0.28;
    const tray = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.08, 0.12), wood);
    tray.position.set(0, 0.85, 0.06);
    const easelCanvas = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 1.2, 0.04),
      mat(0xefe9dc, { roughness: 0.85 })
    );
    easelCanvas.position.set(0, 1.5, 0);
    easelCanvas.name = 'easelCanvas';
    easel.add(legL, legR, legB, tray, easelCanvas);
    z.group.add(easel);
    z.colliders.push({ minX: -0.6, maxX: 0.6, minZ: -2.0, maxZ: -1.2 });
    z.easelCanvas = easelCanvas;
    z.interactables.push({
      id: 'easel', type: 'easel', label: 'Paint',
      pos: new THREE.Vector3(0, 1.2, -1.6), radius: 2.0,
    });

    // mattress
    box(z, { w: 2.2, h: 0.32, d: 1.5, x: -4.4, z: -3.2, material: mat(0x8a8078) });
    box(z, { w: 2.0, h: 0.14, d: 1.2, x: -4.4, y: 0.32, z: -3.2, material: mat(0x4a3a52), solid: false });
    z.interactables.push({
      id: 'bed', type: 'bed', label: 'Sleep — end the night',
      pos: new THREE.Vector3(-4.4, 0.6, -3.2), radius: 1.8,
    });

    // shrine: candle-lit corner of old honest work
    box(z, { w: 1.1, h: 0.8, d: 0.5, x: 4.7, z: -3.6, material: mat(0x3a2c22) });
    for (let i = 0; i < 3; i++) {
      const candle = cylinder(z, {
        rT: 0.03, rB: 0.035, h: 0.16 + i * 0.05, x: 4.45 + i * 0.24, y: 0.8, z: -3.6,
        material: mat(0xe8e0cc), solid: false,
      });
      const flame = new THREE.PointLight(0xffb35c, 1.6, 3.2);
      flame.position.set(4.45 + i * 0.24, 1.15 + i * 0.05, -3.6);
      flame.userData.base = 1.6;
      z.group.add(flame);
      z.animated.candles.push(flame);
      candle.userData.noSplat = true;
    }
    hangingArt(z, { x: 4.7, y: 2.1, z: -4.28, ry: 0, w: 0.8, h: 1.0, seed: 7 });
    z.interactables.push({
      id: 'shrine', type: 'shrine', label: 'Remember why you paint',
      pos: new THREE.Vector3(4.7, 1.0, -3.5), radius: 1.7,
    });

    // the GARRET-2000 memorial — framed, canonized, still not for sale
    {
      const mem = new THREE.Group();
      mem.position.set(5.78, 1.9, -3.2);
      mem.rotation.y = -Math.PI / 2;
      const mFrame = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.46, 0.05), mat(0x2b2118, { roughness: 0.5 }));
      const mFace = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.4),
        new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.85 })
      );
      mFace.position.z = 0.03;
      mFrame.name = 'radio';
      mFace.name = 'radio';
      mFace.userData.noSplat = true;
      new THREE.TextureLoader().load(encodeURI('puplic/visual assets/radio.png'), (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        mFace.material.map = tex;
        mFace.material.color.set(0xffffff);
        mFace.material.needsUpdate = true;
      });
      mem.add(mFrame, mFace);
      z.group.add(mem);
    }

    // the crystal ball — a small table, a violet sphere, the dead on hold
    {
      cylinder(z, { rT: 0.3, rB: 0.36, h: 0.72, x: -4.7, z: 1.4, material: mat(0x2a2033, { roughness: 0.6 }) });
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 24, 18),
        new THREE.MeshStandardMaterial({
          color: 0x2a1a4a, emissive: 0x8a5cf6, emissiveIntensity: 0.9,
          roughness: 0.15, transparent: true, opacity: 0.92,
        })
      );
      ball.position.set(-4.7, 0.95, 1.4);
      ball.userData.noSplat = true;
      const aura = new THREE.PointLight(0x8a5cf6, 2.4, 3.4);
      aura.position.set(-4.7, 1.1, 1.4);
      aura.userData.base = 2.4;
      z.group.add(ball, aura);
      z.animated.seance = { ball, aura, baseY: 0.95 };
      z.interactables.push({
        id: 'seance', type: 'seance', label: 'Consult the dead',
        pos: new THREE.Vector3(-4.7, 1.0, 1.4), radius: 1.8,
      });
    }


    // window + moonlight — the real Oslo-dirty skyline glows out there
    const winMat = new THREE.MeshBasicMaterial({ color: 0x9db8d9 });
    plane(z, { w: 1.5, h: 1.7, x: -3, y: 2.2, z: -4.48, material: winMat, noSplat: true });
    new THREE.TextureLoader().load(encodeURI('puplic/visual assets/oslo-dirty-game-assets.png'), (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.repeat.set(0.59, 1);              // center-crop the wide skyline to the tall pane
      tex.offset.x = 0.205;
      winMat.map = tex;
      winMat.color.set(0xbfbfbf);           // night-dimmed; the street owes you money
      winMat.needsUpdate = true;
    });
    const moon = new THREE.SpotLight(0xa8c4e8, 25, 12, 0.6, 0.5);
    moon.position.set(-3, 2.6, -4.2);
    moon.target.position.set(-1.5, 0, 0.5);
    z.group.add(moon, moon.target);

    // clutter
    for (let i = 0; i < 5; i++) {
      cylinder(z, {
        rT: 0.09, rB: 0.1, h: rand(0.18, 0.3), x: 2.6 + rand(-0.5, 0.5), z: -3.5 + rand(-0.4, 0.4),
        material: mat(pick([0x8c3b2e, 0x2b3a67, 0xe8c15a, 0x2e5f4a])), solid: false,
      });
    }
    box(z, { w: 0.9, h: 1.15, d: 0.06, x: -5.3, y: 0, z: 0.4, ry: 0.22, material: mat(0xd8d2c2), solid: false });
    box(z, { w: 0.8, h: 1.0, d: 0.06, x: -5.0, y: 0, z: 0.9, ry: 0.35, material: mat(0xc9bfae), solid: false });
    box(z, { w: 1.3, h: 0.75, d: 0.7, x: 4.5, z: 1.8, material: mat(0x4a3626), name: 'desk' });

    z.interactables.push({
      id: 'desk', type: 'flavor', label: 'Read rejection letters',
      pos: new THREE.Vector3(4.5, 0.9, 1.8), radius: 1.6,
      lines: [
        '“We love your energy. We are going with someone richer.”',
        '“Your work is exactly what we would show if we still took risks.”',
        '“Have you considered being more like KREYO?”',
      ],
    });

    // rug
    plane(z, {
      w: 3.2, h: 2.4, x: 0, y: 0.012, z: 1.2, rx: -Math.PI / 2,
      material: mat(0x6e3532, { roughness: 1 }), noSplat: true,
    });

    // your real work, framed — the walls of the garret are yours
    for (const p of GARRET_PHOTOS) hangingPhoto(z, p);

    // the garret's wiring is honest: three bare bulbs, always on
    bulb(z, { x: 0, z: -0.6, y: 2.5, intensity: 16 });          // over the easel
    bulb(z, { x: -3.6, z: 2.4, y: 2.7, intensity: 10 });        // séance corner
    bulb(z, { x: 3.9, z: 1.8, y: 2.7, intensity: 10 });         // desk & radio
    z.group.add(new THREE.HemisphereLight(0x8a7a66, 0x2a221c, 0.9));

    door(z, { x: 5.8, z: 1.6, ry: -Math.PI / 2, label: 'THE SCENE →', to: 'galleria' });

    // the framed scene-map by the door — diegetic fast travel
    const mapFrame = new THREE.Group();
    mapFrame.position.set(5.86, 2.0, -0.6);
    mapFrame.rotation.y = -Math.PI / 2;
    const mapBack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.05), mat(0x2b2118, { roughness: 0.5 }));
    const mapFace = new THREE.Mesh(
      new THREE.PlaneGeometry(1.08, 0.78),
      new THREE.MeshBasicMaterial({ map: textTexture('THE SCENE\n~ a map ~', { fg: '#e8c15a', bg: '#14161c', size: 40, h: 192 }) })
    );
    mapFace.position.z = 0.03;
    mapFace.userData.noSplat = true;
    mapFrame.add(mapBack, mapFace);
    z.group.add(mapFrame);
    z.interactables.push({
      id: 'map', type: 'map', label: 'Study the scene map',
      pos: new THREE.Vector3(5.6, 1.5, -0.6), radius: 2.0,
    });

    z.waypoints = [

      new THREE.Vector3(-3, 0, 2.5), new THREE.Vector3(3, 0, 2.8),
      new THREE.Vector3(-2, 0, -0.5), new THREE.Vector3(2.5, 0, 0.2),
      new THREE.Vector3(0.5, 0, 3.5), new THREE.Vector3(-4.5, 0, -1.5),
    ];
  }

  /* ---------------------------------------------------------- */
  /*  ZONE 2 — GALLERIA BIANCA                                  */
  /* ---------------------------------------------------------- */
  #buildGalleria() {
    const z = this.#newZone('galleria');
    shell(z, { w: 18, d: 13, floorColor: 0x8f8f93, wallColor: 0xe9e6df, ceilColor: 0xd9d6cf });
    z.spawn.set(-7.4, 0, 0);
    z.spawnYaw = -Math.PI / 2;       // face east into the room
    z.fog = { color: 0x101014, density: 0.028 };

    // pedestals with unique works
    const pedestalSpots = [
      [-3.5, -2.8, 11], [0.5, -3.4, 23], [4, -2.2, 35],
      [-2, 2.6, 47], [2.2, 3.6, 59], [5.5, 2.0, 71],
    ];
    for (const [x, zz, seed] of pedestalSpots) {
      box(z, { w: 0.7, h: 1.05, d: 0.7, x, z: zz, material: mat(0xf2f0ec, { roughness: 0.4 }) });
      const art = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.5, 0.08),
        new THREE.MeshStandardMaterial({ map: artworkTexture(seed), roughness: 0.8 })
      );
      art.position.set(x, 1.32, zz);
      art.rotation.y = rand(-0.4, 0.4);
      art.userData.noSplat = true;
      z.group.add(art);
    }

    // wall works
    hangingArt(z, { x: -5.5, y: 1.9, z: -6.28, ry: 0, seed: 101 });
    hangingArt(z, { x: -8.78, y: 1.9, z: -3.5, ry: Math.PI / 2, seed: 103 });
    hangingArt(z, { x: 6.5, y: 1.9, z: -6.28, ry: 0, seed: 107 });
    hangingArt(z, { x: -4, y: 1.9, z: 6.28, ry: Math.PI, seed: 109 });
    hangingArt(z, { x: 4.5, y: 1.9, z: 6.28, ry: Math.PI, seed: 113 });

    // YOUR SPOT — where the player's work gets hung
    const spotFrame = box(z, {
      w: 1.3, h: 1.6, d: 0.06, x: -1.2, y: 1.1, z: -6.3,
      material: mat(0x2b2118, { roughness: 0.5 }), solid: false, name: 'displayFrame',
    });
    const displayArt = plane(z, {
      w: 1.16, h: 1.46, x: -1.2, y: 1.92, z: -6.26,
      material: new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 0.9 }),
      noSplat: true, name: 'displayArt',
    });
    const spotSign = plane(z, {
      w: 0.9, h: 0.18, x: -1.2, y: 0.95, z: -6.26,
      material: new THREE.MeshBasicMaterial({
        map: textTexture('RESERVED — “THE ARTIST”', { fg: '#8f8a7a', size: 34 }), transparent: true,
      }),
      noSplat: true,
    });
    z.displayArt = displayArt;
    z.displaySign = spotSign;
    z.displayOccupied = false;
    z.interactables.push({
      id: 'display', type: 'display', label: 'Hang your work',
      pos: new THREE.Vector3(-1.2, 1.4, -6.2), radius: 2.2,
    });
    void spotFrame;

    // reception desk
    box(z, { w: 2.4, h: 1.0, d: 0.8, x: -6.8, z: -4.8, material: mat(0x1c1c22, { roughness: 0.35 }) });
    z.anchors.victoria = new THREE.Vector3(-6.8, 0, -5.6);

    // the gift shop — capitalism's little hat stand
    box(z, { w: 1.5, h: 1.1, d: 0.6, x: -8.0, z: 5.6, material: mat(0x2a2c36, { roughness: 0.4 }), name: 'giftshop' });
    for (let i = 0; i < 3; i++) {
      plane(z, {
        w: 0.34, h: 0.42, x: -8.45 + i * 0.45, y: 1.35, z: 5.29, ry: Math.PI, rx: -0.1,
        material: new THREE.MeshStandardMaterial({ map: artworkTexture(501 + i), roughness: 0.8 }),
        noSplat: true,
      });
    }
    z.interactables.push({
      id: 'giftshop', type: 'giftshop', label: 'The Gift Shop — own yourself',
      pos: new THREE.Vector3(-8.0, 1.1, 5.6), radius: 2.1,
    });

    // wine table
    cylinder(z, { rT: 0.55, rB: 0.5, h: 0.95, x: 3.2, z: 0.4, material: mat(0xf2f0ec, { roughness: 0.4 }) });
    for (let i = 0; i < 5; i++) {
      cylinder(z, {
        rT: 0.028, rB: 0.02, h: 0.16, x: 3.2 + rand(-0.35, 0.35), y: 0.95, z: 0.4 + rand(-0.35, 0.35),
        material: mat(0xd8d2c2, { roughness: 0.2, metalness: 0.3 }), solid: false,
      });
    }

    // bench
    box(z, { w: 2.0, h: 0.42, d: 0.6, x: 0.6, z: 0.2, material: mat(0x1c1c22, { roughness: 0.5 }) });

    // track lighting
    for (const [x, zz] of [[-4, -2], [0, 0], [4, 2], [1, -4]]) {
      const spot = new THREE.SpotLight(0xf4f1e8, 32, 13, 0.7, 0.6);
      spot.position.set(x, 3.4, zz);
      spot.target.position.set(x, 0, zz);
      z.group.add(spot, spot.target);
    }
    z.group.add(new THREE.HemisphereLight(0xdad6cc, 0x3a3a40, 0.8));

    door(z, { x: -8.8, z: 0, ry: Math.PI / 2, label: '← THE GARRET', to: 'garret' });
    door(z, {
      x: 8.8, z: 0, ry: -Math.PI / 2, label: 'PRIVATE VIEWING →', to: 'vault',
      lockedUnlessFlag: 'vaultOpen',
      lockedLabel: 'PRIVATE VIEWING — by invitation. Come back on Night Three.',
    });
    door(z, { x: 0, z: -6.62, ry: 0, label: 'LEATHER & LATEX →', to: 'leatherLatex' });

    z.anchors.docent = new THREE.Vector3(1.5, 0, -4.5);
    z.anchors.kreyo = new THREE.Vector3(5.5, 0, 2.8);
    z.anchors.dolores = new THREE.Vector3(-3, 0, 4.2);
    z.anchors.chadMuffy = new THREE.Vector3(3.6, 0, 1.6);
    z.waypoints = [
      new THREE.Vector3(-6, 0, 3.5), new THREE.Vector3(-1, 0, 4.5),
      new THREE.Vector3(4, 0, 4.6), new THREE.Vector3(6.5, 0, -1),
      new THREE.Vector3(1, 0, -1.5), new THREE.Vector3(-5, 0, -2.5),
      new THREE.Vector3(6.8, 0, 4.2), new THREE.Vector3(-7.5, 0, -1.5),
    ];
  }

  /* ---------------------------------------------------------- */
  /*  ZONE 3 — THE VAULT                                        */
  /* ---------------------------------------------------------- */
  #buildVault() {
    const z = this.#newZone('vault');
    shell(z, { w: 14, d: 11, floorColor: 0x232429, wallColor: 0x191a1f, ceilColor: 0x101014 });
    z.spawn.set(-5.9, 0, 0);
    z.spawnYaw = -Math.PI / 2;
    z.fog = { color: 0x050507, density: 0.05 };

    // red carpet from door to throne
    plane(z, {
      w: 11, h: 1.6, x: 0.2, y: 0.012, z: 0, rx: -Math.PI / 2,
      material: mat(0x5e1f24, { roughness: 1 }), noSplat: true,
    });

    // caged "masterpieces"
    const cageSpots = [[-2.5, -3.4, 201], [0.8, -3.8, 203], [4.2, -3.2, 205], [-2.8, 3.4, 207], [1.2, 3.8, 209]];
    for (const [x, zz, seed] of cageSpots) {
      const cage = new THREE.Group();
      cage.position.set(x, 0, zz);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(1.5, 2.6, 1.5)),
        new THREE.LineBasicMaterial({ color: 0x8a8358 })
      );
      edges.position.y = 1.3;
      const glowArt = new THREE.Mesh(
        new THREE.PlaneGeometry(0.8, 1.0),
        new THREE.MeshBasicMaterial({ map: artworkTexture(seed) })
      );
      glowArt.position.set(0, 1.35, 0);
      glowArt.userData.noSplat = true;
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.14, 1.5), mat(0x2e2f36));
      base.position.y = 0.07;
      const lamp = new THREE.PointLight(0xd9b36a, 2.5, 5);
      lamp.position.set(0, 2.4, 0);
      cage.add(edges, glowArt, base, lamp);
      cage.userData.noSplat = true;
      z.group.add(cage);
      z.animated.glows.push(glowArt);
      z.colliders.push({ minX: x - 0.8, maxX: x + 0.8, minZ: zz - 0.8, maxZ: zz + 0.8 });
    }

    // the throne: Index's desk
    box(z, { w: 2.6, h: 1.05, d: 1.0, x: 5.4, z: 0, material: mat(0x101014, { roughness: 0.25 }) });
    const lampGold = new THREE.PointLight(0xe8c15a, 6, 7);
    lampGold.position.set(5.4, 2.2, 0);
    z.group.add(lampGold);
    z.anchors.index = new THREE.Vector3(6.2, 0, 0);
    z.anchors.lucia = new THREE.Vector3(4.2, 0, 2.2);

    // gold trim strips
    for (const y of [0.08, 3.3]) {
      box(z, { w: 13.6, h: 0.06, d: 0.06, y, z: -5.28, material: mat(0x8a8358, { metalness: 0.7, roughness: 0.35 }), solid: false, noSplat: true });
      box(z, { w: 13.6, h: 0.06, d: 0.06, y, z: 5.28, material: mat(0x8a8358, { metalness: 0.7, roughness: 0.35 }), solid: false, noSplat: true });
    }

    // hanging cage-art on walls
    hangingArt(z, { x: -1, y: 2.0, z: -5.28, ry: 0, w: 1.0, h: 1.3, seed: 301 });
    hangingArt(z, { x: 2.5, y: 2.0, z: 5.28, ry: Math.PI, w: 1.0, h: 1.3, seed: 303 });

    const dim = new THREE.HemisphereLight(0x4a4438, 0x0a0a0e, 0.6);
    z.group.add(dim);

    door(z, { x: -6.8, z: 0, ry: Math.PI / 2, label: '← THE WHITE CUBE', to: 'galleria' });

    z.waypoints = [
      new THREE.Vector3(-4, 0, -2.5), new THREE.Vector3(-1, 0, 1.8),
      new THREE.Vector3(2.5, 0, -1.6), new THREE.Vector3(-4.5, 0, 2.6),
      new THREE.Vector3(3.4, 0, 2.8),
    ];
  }

  /* ---------------------------------------------------------- */
  /*  ZONE 4 — THE LEATHER & LATEX ROOMS                        */
  /*                                                            */
  /*  One house, one bassline, two material moods.              */
  /*  WEST (x<0)  — the leather lounge: padded hides, seams,    */
  /*    amber light, the host's underwear-adjacent hospitality. */
  /*  EAST (x>0)  — the latex runway: black gloss, strobes,     */
  /*    buckle posts, a plinth that prices everyone on it.      */
  /*  A low threshold strip marks where the warm room admits    */
  /*  the dark one. No door. The bass is the door.              */
  /* ---------------------------------------------------------- */
  #buildLeatherLatex() {
    const z = this.#newZone('leatherLatex');
    shell(z, { w: 22, d: 12, floorColor: 0x120c08, wallColor: 0x20140e, ceilColor: 0x14100c });
    z.spawn.set(-9.6, 0, 0);
    z.spawnYaw = -Math.PI / 2;         // face east, straight down the house
    z.fog = { color: 0x0e0a07, density: 0.026 };

    /* ---- floors: soft hide west, hard shine east ---- */
    plane(z, { w: 10.96, h: 11.94, x: -5.5, y: 0.011, z: 0, rx: -Math.PI / 2, material: leatherMat(0x2b1a12), noSplat: true, name: 'leather floor' });
    plane(z, { w: 10.96, h: 11.94, x: 5.5, y: 0.011, z: 0, rx: -Math.PI / 2, material: latexMat(0x040406), noSplat: true, name: 'latex floor' });

    /* ---- the threshold: where the warm room admits the dark one ---- */
    box(z, { w: 0.3, h: 0.026, d: 11.9, x: 0, y: 0.012, z: 0, material: mat(0xb72d50, { metalness: 0.55, roughness: 0.25 }), solid: false, noSplat: true, name: 'threshold strip' });
    const throb = new THREE.PointLight(0xb72d50, 1.6, 5.5, 1.8);
    throb.position.set(0, 0.9, 0); throb.userData.base = 1.6;
    z.group.add(throb);
    z.interactables.push({
      id: 'threshold', type: 'flavor', label: 'Cross the threshold',
      pos: new THREE.Vector3(0, 0.8, 0), radius: 1.7,
      lines: [
        'One step: warm hide and amber. Next step: cold shine and strobes. The house calls this “range”.',
        'The red strip is a border. Nobody stamps your passport; the bass does that.',
        'The collector priced the threshold. It came back “transitional”. He framed the invoice.',
      ],
    });

    /* ---- walls: padded leather west + north/south-west, gloss panels east ---- */
    const wallLeather = leatherMat(0x2a1c15);
    const seam = mat(0x6b3a2a, { roughness: 0.34, metalness: 0.18 });
    for (let i = 0; i < 4; i++) {   // west wall, padded
      const zz = -4.45 + i * 2.95;
      box(z, { w: 0.05, h: 2.55, d: 2.72, x: -10.94, y: 0.18, z: zz, material: wallLeather, solid: false, noSplat: true, name: 'side leather panel' });
      box(z, { w: 0.07, h: 2.55, d: 0.025, x: -10.94, y: 0.18, z: zz + 1.34, material: seam, solid: false, noSplat: true });
    }
    for (const zz of [-5.94, 5.94]) {   // long walls: leather panels on the west half
      for (let i = 0; i < 4; i++) {
        const x = -9.53 + i * 2.66;
        box(z, { w: 2.48, h: 2.95, d: 0.05, x, y: 0.18, z: zz, material: wallLeather, solid: false, noSplat: true, name: 'padded leather panel' });
        box(z, { w: 0.025, h: 2.95, d: 0.07, x: x + 1.25, y: 0.18, z: zz, material: seam, solid: false, noSplat: true });
      }
      box(z, { w: 10.9, h: 0.045, d: 0.08, x: -5.5, y: 1.0, z: zz, material: seam, solid: false, noSplat: true });
      box(z, { w: 10.9, h: 0.045, d: 0.08, x: -5.5, y: 2.92, z: zz, material: seam, solid: false, noSplat: true });
      // east half: black latex sheets with a plum metal rail
      box(z, { w: 10.9, h: 2.8, d: 0.05, x: 5.5, y: 1.4, z: zz, material: latexMat(0x060608), solid: false, noSplat: true, name: 'latex wall panel' });
      box(z, { w: 10.9, h: 0.04, d: 0.08, x: 5.5, y: 2.82, z: zz, material: mat(0x1a0a18, { metalness: 0.6, roughness: 0.2 }), solid: false, noSplat: true });
    }
    box(z, { w: 0.05, h: 2.8, d: 11.9, x: 10.94, y: 1.4, z: 0, material: latexMat(0x060608), solid: false, noSplat: true, name: 'latex wall panel' });   // east wall

    /* ================= WEST — the leather lounge ================= */
    const sofa = (x, zz, color, w = 2.7, d = 1.05, ry = 0) => {
      const g = new THREE.Group();
      g.position.set(x, 0, zz); g.rotation.y = ry;
      const base = new THREE.Mesh(new THREE.BoxGeometry(w, 0.38, d), leatherMat(color));
      base.position.y = 0.38;
      const back = new THREE.Mesh(new THREE.BoxGeometry(w, 1.0, 0.26), leatherMat(color));
      back.position.set(0, 0.92, -d / 2 + 0.13);
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.66, d), leatherMat(color));
      armL.position.set(-w / 2 + 0.14, 0.66, 0);
      const armR = armL.clone(); armR.position.x *= -1;
      for (const cx of [-0.86, 0, 0.86]) {
        const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.12, 0.72), mat(0x3a2a22, { roughness: 0.85 }));
        cushion.position.set(cx, 0.62, 0.08);
        cushion.rotation.z = (cx / 0.86) * 0.012;
        g.add(cushion);
      }
      g.add(base, back, armL, armR);
      g.traverse((o) => { o.userData.noSplat = true; });
      z.group.add(g);
      z.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: zz - d / 2, maxZ: zz + d / 2 });
      return g;
    };
    sofa(-4.45, -1.25, 0x2b101e, 2.85, 1.1);
    sofa(-2.2, 4.75, 0x101017, 2.5, 1.0, Math.PI);

    const lowTable = (x, zz, w = 1.6, d = 0.7) => {
      const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), mat(0x1c1410, { roughness: 0.55 }));
      top.position.set(x, 0.58, zz); top.userData.noSplat = true; z.group.add(top);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.58, 8), mat(0x3a2a20, { metalness: 0.5, roughness: 0.35 }));
      leg.position.set(x, 0.29, zz); z.group.add(leg);
      z.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: zz - d / 2, maxZ: zz + d / 2 });
    };
    lowTable(-3.2, 0.35, 1.4, 0.6);

    const sideboard = (x, zz, ry = 0) => {
      const g = new THREE.Group();
      g.position.set(x, 0, zz); g.rotation.y = ry;
      const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, 0.65), mat(0x1f1814, { roughness: 0.7 }));
      body.position.y = 0.55;
      const top = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.06, 0.7), mat(0x3a2a20, { metalness: 0.45, roughness: 0.3 }));
      top.position.y = 1.12;
      for (const hx of [-1.1, 0, 1.1]) {
        const handle = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.015, 8, 12, Math.PI), mat(0x5c3a28, { metalness: 0.7, roughness: 0.25 }));
        handle.position.set(hx, 0.55, 0.34); handle.rotation.y = Math.PI / 2; z.group.add(handle);
      }
      g.add(body, top);
      g.traverse((o) => { o.userData.noSplat = true; });
      z.group.add(g);
      z.colliders.push({ minX: x - 1.7, maxX: x + 1.7, minZ: zz - 0.35, maxZ: zz + 0.35 });
      return g;
    };
    sideboard(-9.4, -4.5, Math.PI / 2);
    sideboard(-9.4, 4.5, Math.PI / 2);

    const artFrame = (x, zz, ry = 0, color = 0x8c3b2e) => {
      const g = new THREE.Group();
      g.position.set(x, 0, zz); g.rotation.y = ry;
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.4, 0.04), mat(0x3a2a20, { metalness: 0.35, roughness: 0.45 }));
      frame.position.y = 1.5;
      const canvas = new THREE.Mesh(
        new THREE.PlaneGeometry(0.95, 1.25),
        mat(color, { roughness: 0.85 }),
      );
      canvas.position.z = 0.025; canvas.position.y = 1.5;
      g.add(frame, canvas);
      g.traverse((o) => { o.userData.noSplat = true; });
      z.group.add(g);
      return g;
    };
    artFrame(-10.6, -1.5, Math.PI / 2, 0x8c3b2e);
    artFrame(-10.6, 2.5, Math.PI / 2, 0x4a2c2a);
    artFrame(-5.0, 5.8, 0, 0x2b3a67);

    const rug = new THREE.Mesh(
      new THREE.PlaneGeometry(4.5, 3.0),
      mat(0x4a3028, { roughness: 0.95 }),
    );
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(-3.5, 0.012, -0.5);
    rug.userData.noSplat = true;
    z.group.add(rug);
    z.colliders.push({ minX: -5.75, maxX: -1.25, minZ: -2.0, maxZ: 1.0 });

    /* ================= EAST — the latex runway ================= */
    box(z, { w: 2.4, h: 0.18, d: 0.9, x: 6.7, z: -2.55, material: latexMat(0x0b0b10), name: 'latex runway plinth' });
    const runwayEdge = mat(0xb72d50, { metalness: 0.45, roughness: 0.28 });
    box(z, { w: 2.4, h: 0.025, d: 0.035, x: 6.7, y: 0.18, z: -3.0, material: runwayEdge, solid: false, noSplat: true });
    box(z, { w: 2.4, h: 0.025, d: 0.035, x: 6.7, y: 0.18, z: -2.1, material: runwayEdge, solid: false, noSplat: true });

    const chair = (x, zz, color, ry = 0) => {
      const g = new THREE.Group();
      g.position.set(x, 0, zz); g.rotation.y = ry;
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.12, 0.78), latexMat(color));
      seat.position.y = 0.72;
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.0, 0.12), latexMat(color));
      back.position.set(0, 1.18, -0.32);
      for (const sx of [-0.28, 0.28]) {
        for (const sz of [-0.27, 0.27]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.72, 8), mat(0x5c1a2c, { metalness: 0.65, roughness: 0.24 }));
          leg.position.set(sx, 0.36, sz); g.add(leg);
        }
      }
      g.add(seat, back); g.traverse((o) => { o.userData.noSplat = true; });
      z.group.add(g);
      z.colliders.push({ minX: x - 0.45, maxX: x + 0.45, minZ: zz - 0.45, maxZ: zz + 0.45 });
    };
    chair(2.3, 2.45, 0x7f1d3b, 0.2);
    chair(5.65, 2.45, 0x15151d, -0.2);
    chair(9.4, 2.55, 0x241225, -Math.PI / 2);

    for (const [x, zz] of [[2.2, -4.75], [3.8, -4.75], [8.1, -4.75], [9.6, -4.75]]) {
      cylinder(z, { rT: 0.025, rB: 0.03, h: 1.45, x, z: zz, material: mat(0x5a1727, { metalness: 0.7, roughness: 0.22 }), solid: false, noSplat: true });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.018, 8, 20), mat(0xb14b63, { metalness: 0.75, roughness: 0.18 }));
      ring.position.set(x, 1.32, zz); ring.rotation.x = Math.PI / 2; ring.userData.noSplat = true; z.group.add(ring);
    }

    /* ---- light: amber pools west, strobe rig east, one fog to bind them ---- */
    const warm = new THREE.PointLight(0xffa866, 4.2, 10, 1.8);
    warm.position.set(-5.5, 2.4, -3.0); warm.userData.base = 4.2; z.group.add(warm);
    const amber = new THREE.PointLight(0xff8c42, 2.8, 9, 1.9);
    amber.position.set(-8.0, 2.0, 1.5); amber.userData.base = 2.8; z.group.add(amber);
    const cream = new THREE.PointLight(0xffd9a0, 2.2, 8, 1.7);
    cream.position.set(-2.5, 2.0, 2.5); cream.userData.base = 2.2; z.group.add(cream);
    z.animated.candles = [warm, amber, cream];
    const red = new THREE.PointLight(0xa1163d, 4.5, 7, 1.6);
    red.position.set(6.5, 1.8, -3.4); red.userData.base = 4.5; z.group.add(red);
    const violet = new THREE.PointLight(0x6b36a8, 3.0, 8, 1.7);
    violet.position.set(3.2, 2.1, 1.8); violet.userData.base = 3.0; z.group.add(violet);
    const blue = new THREE.PointLight(0x263b8f, 2.2, 7, 1.8);
    blue.position.set(9.8, 2.2, 3.8); blue.userData.base = 2.2; z.group.add(blue);
    z.animated.strobes = [red, violet, blue, throb];
    z.group.add(new THREE.HemisphereLight(0x3a2418, 0x060608, 0.45));

    box(z, { w: 2.3, h: 0.12, d: 0.28, x: -10.8, y: 2.8, z: 0, material: mat(0x3a2a20, { metalness: 0.3 }), solid: false, noSplat: true });
    door(z, { x: -10.8, z: 0, ry: Math.PI / 2, label: '← GALLERIA BIANCA', to: 'galleria' });

    /* ---- the whole house, under one bassline ---- */
    z.anchors.milo = new THREE.Vector3(-4.45, 0, -1.25);
    z.anchors.sol = new THREE.Vector3(-2.2, 0, 4.75);
    z.anchors.bea = new THREE.Vector3(-3.2, 0, 0.35);
    z.anchors.gimp = new THREE.Vector3(6.7, 0, -3.55);
    z.anchors.fashion = new THREE.Vector3(0.2, 0, 0.35);
    z.anchors.bob = new THREE.Vector3(-4.45, 0, 1.4);
    z.anchors.bobgirl = new THREE.Vector3(-2.2, 0, 3.4);
    z.anchors.rook = new THREE.Vector3(5.3, 0, -3.2);
    z.anchors.violet = new THREE.Vector3(4.8, 0, -3.3);
    z.anchors.chrome = new THREE.Vector3(2.6, 0, 2.2);
    z.anchors.blue = new THREE.Vector3(8.1, 0, -1.2);

    z.interactables.push({
      id: 'leather-wall', type: 'flavor', label: 'Press your palm to the leather wall',
      pos: new THREE.Vector3(-9.4, 1.3, -5.65), radius: 1.7,
      lines: [
        'The wall is padded, stitched, and priced like a small apartment.',
        'It absorbs the bass, the heat, and one entire school of criticism.',
        'Someone embossed the word “AUTHENTIC” into the leather. The leather disagrees.',
      ],
    });
    z.interactables.push({
      id: 'leather-sofa', type: 'flavor', label: 'Sink into the leather sofa',
      pos: new THREE.Vector3(-4.45, 0.7, -1.25), radius: 1.5,
      lines: [
        'The sofa has the posture of someone who knows the dress code.',
        'No one is collecting this room. The room is collecting everyone.',
        'A seam gives a tiny, expensive creak. It approves of you.',
      ],
    });
    z.interactables.push({
      id: 'sideboard', type: 'flavor', label: 'Inspect the sideboard',
      pos: new THREE.Vector3(-9.4, 0.9, -4.5), radius: 1.5,
      lines: [
        'A row of unframed canvases leans behind glass. The collector\'s eye is restless.',
        'There is a catalogue raisonné open to a page that has been pressed flat by something heavy.',
        'Someone left a glass of red wine here. It is still breathing.',
      ],
    });
    z.interactables.push({
      id: 'latex-runway', type: 'flavor', label: 'Step onto the latex runway',
      pos: new THREE.Vector3(6.7, 0.45, -2.55), radius: 1.6,
      lines: [
        'A runway for people who refuse to be background decoration.',
        'The lights make every buckle look like a thesis statement.',
        'The room is naughty in the way a gallery is naughty: it wants a review.',
      ],
    });

    z.waypoints = [
      new THREE.Vector3(-8.5, 0, -3.2), new THREE.Vector3(-5.5, 0, -3.4),
      new THREE.Vector3(-2.7, 0, -3.4), new THREE.Vector3(-0.5, 0, 2.5),
      new THREE.Vector3(2.7, 0, -2.5), new THREE.Vector3(4.4, 0, -1.1),
      new THREE.Vector3(5.4, 0, 2.8), new THREE.Vector3(8.6, 0, 2.6),
      new THREE.Vector3(9.4, 0, -3.8), new THREE.Vector3(-4.8, 0, 2.3),
    ];
  }
  /* ============================================================
     Runtime API
     ============================================================ */

  zone(key = this.current) { return this.zones.get(key); }
  colliders() { return this.zone().colliders; }
  interactables() { return this.zone().interactables; }
  anchors() { return this.zone().anchors; }
  waypoints() { return this.zone().waypoints; }

  setZone(key) {
    if (this.current) this.zone().group.visible = false;
    this.current = key;
    const z = this.zone();
    z.group.visible = true;
    return z;
  }

  /** Raycast against the current zone for paint splats. */
  raycastSplat(raycaster) {
    const hits = raycaster.intersectObjects(this.zone().group.children, true);
    return hits.find((h) => h.object.visible && !h.object.userData.noSplat) ?? null;
  }

  addSplat(point, normal, colorHex, size = null) {
    const pool = this.zone().splats;
    const s = size ?? rand(0.3, 0.62);
    let mesh;
    if (pool.meshes.length < 140) {
      mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          map: this.#splatTex, transparent: true, depthWrite: false,
          polygonOffset: true, polygonOffsetFactor: -2,
        })
      );
      pool.meshes.push(mesh);
      this.zone().group.add(mesh);
    } else {
      mesh = pool.meshes[pool.i];
    }
    pool.i = (pool.i + 1) % 140;

    mesh.material.color.set(colorHex);
    mesh.position.copy(point).addScaledVector(normal, 0.015);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    mesh.rotateZ(rand(0, Math.PI * 2));
    mesh.scale.setScalar(s);
    mesh.visible = true;
  }

  clearSplats() {
    for (const z of this.zones.values()) {
      for (const m of z.splats.meshes) m.visible = false;
    }
  }

  /* ---- the gallery display slot ---- */

  hangOnDisplay(texture, title) {
    const z = this.zones.get('galleria');
    z.displayArt.material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85 });
    z.displaySign.material.map = textTexture(`“${title}” — THE ARTIST`, { fg: '#e8c15a', size: 30 });
    z.displaySign.material.needsUpdate = true;
    z.displayOccupied = true;
  }

  clearDisplay() {
    const z = this.zones.get('galleria');
    z.displayArt.material = new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 0.9 });
    z.displaySign.material.map = textTexture('RESERVED — “THE ARTIST”', { fg: '#8f8a7a', size: 34 });
    z.displaySign.material.needsUpdate = true;
    z.displayOccupied = false;
  }

  /** Your own poster, bought at the gift shop, hung with tape. Forever. */
  hangPoster(texture) {
    const z = this.zones.get('garret');
    if (z.poster) return;                    // one poster. dignity has limits
    const g = new THREE.Group();
    g.position.set(-5.78, 1.95, -3.2);
    g.rotation.y = Math.PI / 2;
    g.rotation.z = 0.07;                     // hung with tape, obviously
    const poster = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.78),
      new THREE.MeshStandardMaterial({ map: texture, roughness: 1 })
    );
    poster.userData.noSplat = true;
    g.add(poster);
    const tapeMat = new THREE.MeshBasicMaterial({ color: 0xd8d2c2 });
    for (const tx of [-0.27, 0.27]) {
      const tape = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.035), tapeMat);
      tape.position.set(tx, 0.37, 0.002);
      tape.rotation.z = tx > 0 ? 0.5 : -0.5;
      tape.userData.noSplat = true;
      g.add(tape);
    }
    z.group.add(g);
    z.poster = g;
  }

  /* ---- ambient life ---- */

  /**
   * @param beatPhase 0..1 within the current beat, or -1 when the room is
   * silent. When the house rig plays, every lamp in here snaps on the kick.
   */
  update(dt, t, beatPhase = -1) {
    const z = this.zone();
    if (!z) return;
    const beat = beatPhase >= 0;
    // a sharp percussive envelope: full on the kick, decays through the beat
    const kick = beat ? Math.pow(1 - beatPhase, 2.6) : 0;

    for (const c of z.animated.candles) {
      const b = c.userData.base ?? 0.45;
      c.intensity = b + Math.sin(t * 9 + c.position.x * 7) * 0.15 * b + Math.sin(t * 23) * 0.08 * b
        + kick * b * 0.35;                 // the flames lean with the sub
    }
    for (const s of z.animated.signs) {
      s.opacity = 0.85 + Math.sin(t * 1.8) * 0.15;
    }
    for (const g of z.animated.glows) {
      g.rotation.y += dt * (beat ? 0.12 + kick * 1.6 : 0.12);   // the ball spins up on the kick
    }
    // party strobes: idle shimmer when quiet, hard snap to the beat when the room plays
    if (z.animated.strobes) {
      for (let i = 0; i < z.animated.strobes.length; i++) {
        const lamp = z.animated.strobes[i];
        const b = lamp.userData.base ?? 0.6;
        lamp.intensity = beat
          ? b * 0.4 + kick * (i % 2 === 0 ? 26 : 16)          // violet leads, blue answers
          : b + Math.sin(t * 2.1 + i * 2.4) * b * 0.4;
      }
    }
    if (z.animated.seance) {
      const { ball, aura, baseY } = z.animated.seance;
      ball.rotation.y += dt * 0.7;
      ball.position.y = baseY + Math.sin(t * 1.4) * 0.02;
      const pulse = 0.7 + Math.sin(t * 2.3) * 0.25;
      ball.material.emissiveIntensity = pulse;
      aura.intensity = pulse * ((aura.userData.base ?? 0.7) / 0.7);
    }
  }
}
