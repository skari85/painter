/**
 * world.js — the four rooms of the scene.
 *
 *   THE GARRET            warm, wrecked, yours. Easel, mattress, shrine.
 *   GALLERIA BIANCA       cold white cube. Pedestals, wine, judgment.
 *   THE VAULT             dark freeport. Caged masterpieces, one throne.
 *   THE LEATHER & LATEX   the collector's house. Hide up front, shine
 *   ROOMS                 in the back — one house, two material moods.
 *   THE GILDED FORK       one long table, every artworld big shot,
 *                         all of them drunk and messed up.
 *
 * Everything uses procedural geometry with generated and locally stored textures.
 * Collision is XZ axis-aligned boxes (single-floor zones by design).
 * Paint splats are pooled decal planes, recycled ring-buffer style.
 */

import * as THREE from 'three';
import { mulberry32, rand, pick } from '../core/utils.js';
import { MAXPRO } from '../core/config.js';


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

/** The MAX PRO masterpiece: 11 × 8 cm of quiet confidence. */
function tinyMasterpieceTexture() {
  return canvasTexture(220, 160, (ctx, w, h) => {
    ctx.fillStyle = '#e9e2d2'; ctx.fillRect(0, 0, w, h);
    // one confident umber gesture, slightly crooked
    ctx.strokeStyle = '#3a2c22'; ctx.lineWidth = 13; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(38, 108); ctx.quadraticCurveTo(104, 44, 178, 86); ctx.stroke();
    // a cadmium red square, off-centre, on purpose
    ctx.fillStyle = '#b0402a'; ctx.fillRect(138, 34, 26, 26);
    // a faint horizon that is doing more than it should
    ctx.strokeStyle = 'rgba(58,44,34,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(20, 118); ctx.lineTo(202, 116); ctx.stroke();
  });
}

/** A cucumber with duct-tape repairs and the sort of confidence that reads as sold. */
function ductTapedCucumberTexture() {
  return canvasTexture(420, 520, (ctx, w, h) => {
    ctx.fillStyle = '#efe7dc'; ctx.fillRect(0, 0, w, h);

    const cx = w * 0.5;
    const cy = h * 0.52;
    ctx.translate(cx, cy);

    ctx.beginPath();
    ctx.moveTo(-112, 130);
    ctx.bezierCurveTo(-168, 32, -154, -128, -30, -172);
    ctx.bezierCurveTo(110, -210, 184, -88, 184, 18);
    ctx.bezierCurveTo(184, 132, 100, 202, 10, 188);
    ctx.bezierCurveTo(-62, 174, -100, 156, -112, 130);
    ctx.closePath();
    ctx.fillStyle = '#82af6b';
    ctx.fill();
    ctx.strokeStyle = '#3b5a3a';
    ctx.lineWidth = 12;
    ctx.stroke();

    for (let i = -2; i <= 2; i++) {
      const y = i * 30;
      ctx.beginPath();
      ctx.moveTo(-104, y + 18);
      ctx.quadraticCurveTo(-14, y - 16, 104, y + 8);
      ctx.strokeStyle = 'rgba(38, 55, 35, 0.44)';
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    ctx.fillStyle = '#5d7d4d';
    for (const px of [-60, -14, 42, 90]) {
      ctx.beginPath();
      ctx.arc(px, 20, 9 + Math.abs(px % 18), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.translate(-cx, -cy);

    const tape = ['#c8c1b2', '#adb0b8', '#d7cfbf'];
    for (let i = 0; i < tape.length; i++) {
      const y = 90 + i * 82;
      ctx.fillStyle = tape[i];
      ctx.beginPath();
      ctx.moveTo(w * 0.18, y + 12);
      ctx.lineTo(w * 0.82, y + 38);
      ctx.lineTo(w * 0.74, y + 86);
      ctx.lineTo(w * 0.14, y + 62);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(32, 34, 38, 0.35)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    ctx.fillStyle = '#d53636';
    ctx.beginPath();
    ctx.arc(w * 0.78, h * 0.22, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.72)';
    ctx.lineWidth = 3;
    ctx.stroke();
  });
}

/** The small wall label beside the tiny painting. Reads exactly like the truth. */
function wallLabelTexture() {
  return canvasTexture(512, 384, (ctx, w) => {
    ctx.fillStyle = '#f6f4ee'; ctx.fillRect(0, 0, w, 384);
    ctx.fillStyle = '#22242a'; ctx.textAlign = 'left';
    ctx.font = '700 34px Georgia, serif';
    ctx.fillText('UNTITLED, 2026', 36, 72);
    ctx.font = '400 26px Georgia, serif';
    ctx.fillText('Oil on canvas', 36, 122);
    ctx.fillText('11 × 8 cm', 36, 158);
    ctx.font = 'italic 400 22px Georgia, serif';
    ctx.fillStyle = '#6a675f';
    ctx.fillText('Price on application.', 36, 220);
    ctx.font = '400 15px Georgia, serif';
    ctx.fillText('The gallery thanks the wall for its cooperation.', 36, 330);
  });
}

/** The enormous exhibition label: fourteen times larger than the work it describes. */
function bigLabelTexture() {
  const LINES = [
    'The work declines scale.',
    'In declining, it acquires it.',
    'The wall is not empty.',
    'The wall is working.',
    'The painting is not small.',
    'The painting is precise.',
    'Precision, at this scale, reads as silence.',
    'Silence, at this rent, reads as confidence.',
    'The viewer is encouraged to approach.',
    'Approaching changes nothing.',
    'This is the tension.',
    'The tension is the work.',
    'The work is eleven centimetres wide.',
    'The room is forty metres wide.',
    'Both numbers are correct.',
    'Neither number helps.',
    'The bench has been positioned',
    'at the exact distance of understanding.',
    'Understanding remains elsewhere.',
    'The red dot is not a sale.',
    'The red dot is a position.',
  ];
  return canvasTexture(640, 900, (ctx, w, h) => {
    ctx.fillStyle = '#f6f4ee'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#22242a'; ctx.textAlign = 'left';
    ctx.font = '700 44px Georgia, serif';
    ctx.fillText('UNTITLED, 2026', 40, 80);
    ctx.font = '400 24px Georgia, serif'; ctx.fillStyle = '#55524b';
    ctx.fillText('Oil on canvas · 11 × 8 cm', 40, 120);
    ctx.strokeStyle = '#c9c5bc'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(40, 152); ctx.lineTo(w - 40, 152); ctx.stroke();
    ctx.font = '400 19px Georgia, serif'; ctx.fillStyle = '#3a3833';
    let y = 200;
    for (const ln of LINES) { ctx.fillText(ln, 40, y); y += 30; }
    ctx.font = 'italic 400 18px Georgia, serif'; ctx.fillStyle = '#6a675f';
    ctx.fillText('Continued in the catalogue (200 pp.).', 40, h - 40);
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
function shell(zone, { w, d, floorColor, wallColor, ceilColor, h = WALL_H }) {
  const hw = w / 2, hd = d / 2, t = 0.4;
  box(zone, { w, h: 0.2, d, y: -0.2, material: mat(floorColor), solid: false, name: 'floor' });
  box(zone, { w, h: 0.2, d, y: h, material: mat(ceilColor), solid: false, noSplat: true });
  box(zone, { w, h, d: t, z: -hd - t / 2, material: mat(wallColor), name: 'wallN' });
  box(zone, { w, h, d: t, z: hd + t / 2, material: mat(wallColor), name: 'wallS' });
  box(zone, { w: t, h, d, x: -hw - t / 2, material: mat(wallColor), name: 'wallW' });
  box(zone, { w: t, h, d, x: hw + t / 2, material: mat(wallColor), name: 'wallE' });
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

/** The royal set: a heavily blurred adult film, mid-broadcast. Skin tones
 *  only — the court's censorship division works in smears. */
function pornScreenTexture() {
  const c = document.createElement('canvas');
  c.width = 96; c.height = 64;
  const ctx = c.getContext('2d');
  // murky satin-sheet ground
  const grad = ctx.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, '#8a5060');
  grad.addColorStop(1, '#4a2438');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 96, 64);
  // the talent, abstracted to soft blobs of blush
  const SKIN = ['#d9a186', '#c98a72', '#e8b89a', '#b87468'];
  const blobs = [];
  for (let i = 0; i < 7; i++) {
    blobs.push({
      x: 10 + Math.random() * 76, y: 8 + Math.random() * 48,
      r: 7 + Math.random() * 13, color: SKIN[i % SKIN.length],
      dx: (Math.random() - 0.5) * 2.2, dy: (Math.random() - 0.5) * 1.4,
      pulse: Math.random() * Math.PI * 2,
    });
  }
  return { canvas: c, blobs };
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
    this.#buildGildedFork();
    this.#buildMaxPro();
    this.#buildDildoBall();
    this.#buildDaylightClub();
    this.#buildUpAndCumming();
    this.#buildRecordPlayers();
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

  /** A synchronized communal turntable in every room. */
  #buildRecordPlayers() {
    const placements = {
      garret:       { x: 4.65,  z: 3.55,  ry: -Math.PI / 2 },
      galleria:     { x: 7.75,  z: 5.35,  ry: Math.PI },
      vault:        { x: -5.45, z: 4.15,  ry: Math.PI / 2 },
      leatherLatex: { x: -9.35, z: 4.65,  ry: Math.PI },
      gildedFork:   { x: 8.45,  z: 5.75,  ry: Math.PI },
      maxPro:       { x: -18.4, z: 9.75,  ry: Math.PI },
      dildoBall:    { x: -6.35, z: 4.75,  ry: Math.PI },
      daylightClub: { x: 8.4,   z: 5.25,  ry: Math.PI },
      upAndCumming: { x: 7.9,   z: 6.35,  ry: Math.PI },
    };

    for (const [key, p] of Object.entries(placements)) {
      const z = this.zones.get(key);
      if (!z) continue;
      const g = new THREE.Group();
      g.position.set(p.x, 0, p.z);
      g.rotation.y = p.ry;
      const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.72, 0.62), mat(0x2c211b, { roughness: 0.5, metalness: 0.08 }));
      cabinet.position.y = 0.36; cabinet.name = 'recordPlayer';
      const deck = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.09, 0.52), mat(0x16151a, { roughness: 0.28, metalness: 0.42 }));
      deck.position.y = 0.77; deck.name = 'recordPlayer';
      const platter = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.025, 32), new THREE.MeshStandardMaterial({ color: 0x111116, roughness: 0.3, metalness: 0.28 }));
      platter.position.set(-0.13, 0.84, 0); platter.name = 'recordPlayer';
      const label = new THREE.Mesh(new THREE.CircleGeometry(0.062, 20), new THREE.MeshBasicMaterial({ color: 0xe8c15a }));
      label.position.set(-0.13, 0.854, 0); label.rotation.x = -Math.PI / 2; label.name = 'recordPlayer';
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.34), mat(0xd4cbc0, { roughness: 0.22, metalness: 0.82 }));
      arm.position.set(0.29, 0.87, 0.02); arm.rotation.y = -0.38; arm.name = 'recordPlayer';
      const lamp = new THREE.PointLight(0xe8c15a, 0, 2.8, 2);
      lamp.position.set(-0.13, 1.05, 0.15); lamp.userData.base = 1.25;
      g.add(cabinet, deck, platter, label, arm, lamp);
      g.traverse((o) => { o.userData.noSplat = true; });
      z.group.add(g);
      z.colliders.push({ minX: p.x - 0.58, maxX: p.x + 0.58, minZ: p.z - 0.42, maxZ: p.z + 0.42 });
      z.interactables.push({ id: `record-player-${key}`, type: 'recordPlayer', label: 'Change the record', pos: new THREE.Vector3(p.x, 0.9, p.z), radius: 2.05 });
      z.animated.recordPlayer = { platter, label, lamp, playing: false };
    }
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

    // The studio keeps its original shell and collision, but receives a close
    // inset skin of lightweight CC0 Poly Haven maps. One source texture is
    // loaded per slot and cloned across differently scaled surfaces so the
    // browser shares image data without stretching the short walls.
    const studioLoader = new THREE.TextureLoader();
    const applyStudioMap = (targets, slot, url, srgb = false) => {
      studioLoader.load(encodeURI(url), (source) => {
        targets.forEach(({ material, repeat }) => {
          const tex = source.clone();
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
          tex.repeat.set(repeat[0], repeat[1]);
          tex.anisotropy = 4;
          if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
          tex.needsUpdate = true;
          material[slot] = tex;
          material.needsUpdate = true;
        });
        source.dispose();
      });
    };

    const floorMaterial = mat(0x9a7659, { roughness: 0.92 });
    floorMaterial.normalScale.set(0.42, 0.42);
    const woodRoot = 'puplic/polyhaven/studio/old_wood_floor';
    const floorTargets = [{ material: floorMaterial, repeat: [4, 3] }];
    applyStudioMap(floorTargets, 'map', `${woodRoot}/old_wood_floor_diff_1k.jpg`, true);
    applyStudioMap(floorTargets, 'normalMap', `${woodRoot}/old_wood_floor_nor_gl_1k.jpg`);
    applyStudioMap(floorTargets, 'roughnessMap', `${woodRoot}/old_wood_floor_rough_1k.jpg`);
    plane(z, {
      w: 11.9, h: 8.9, y: 0.012, rx: -Math.PI / 2,
      material: floorMaterial, name: 'garret worn wood floor',
    });

    const longWallMaterial = mat(0x6d5e54, { roughness: 0.96 });
    const shortWallMaterial = longWallMaterial.clone();
    const ceilingMaterial = mat(0x554b45, { roughness: 0.98 });
    longWallMaterial.normalScale.set(0.34, 0.34);
    shortWallMaterial.normalScale.set(0.34, 0.34);
    ceilingMaterial.normalScale.set(0.24, 0.24);
    const plasterRoot = 'puplic/polyhaven/studio/worn_plaster_wall';
    const plasterTargets = [
      { material: longWallMaterial, repeat: [5, 1.5] },
      { material: shortWallMaterial, repeat: [3.75, 1.5] },
      { material: ceilingMaterial, repeat: [5, 3.75] },
    ];
    applyStudioMap(plasterTargets, 'map', `${plasterRoot}/worn_plaster_wall_diff_1k.jpg`, true);
    applyStudioMap(plasterTargets, 'normalMap', `${plasterRoot}/worn_plaster_wall_nor_gl_1k.jpg`);
    applyStudioMap(plasterTargets, 'roughnessMap', `${plasterRoot}/worn_plaster_wall_rough_1k.jpg`);
    plane(z, { w: 11.9, h: 3.48, y: 1.74, z: -4.485, material: longWallMaterial, name: 'garret worn plaster north' });
    plane(z, { w: 11.9, h: 3.48, y: 1.74, z: 4.485, ry: Math.PI, material: longWallMaterial, name: 'garret worn plaster south' });
    plane(z, { w: 8.9, h: 3.48, x: -5.985, y: 1.74, ry: Math.PI / 2, material: shortWallMaterial, name: 'garret worn plaster west' });
    plane(z, { w: 8.9, h: 3.48, x: 5.985, y: 1.74, ry: -Math.PI / 2, material: shortWallMaterial, name: 'garret worn plaster east' });
    plane(z, {
      w: 11.9, h: 8.9, y: 3.485, rx: Math.PI / 2,
      material: ceilingMaterial, noSplat: true, name: 'garret worn plaster ceiling',
    });

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
    hangingPhoto(z, { x: 1.2, y: 1.9, z: -6.28, ry: 0, url: 'puplic/penis banana.jpg', h: 1.3 });

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
    door(z, { x: 8.8, z: -4.4, ry: -Math.PI / 2, label: 'DAYLIGHT FLESH GARDEN →', to: 'daylightClub' });
    door(z, { x: 8.8, z: 4.4, ry: -Math.PI / 2, label: 'UP AND CUMMING ARTIST →', to: 'upAndCumming' });
    door(z, { x: 0, z: 6.62, ry: Math.PI, label: 'THE GILDED FORK →', to: 'gildedFork' });
    door(z, { x: 6.8, z: 6.62, ry: Math.PI, label: 'MAX PRO KUNST 2000 →', to: 'maxPro' });


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
    z.fog = { color: 0x9aabba, density: 0.012 };

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

    /* ---- latex menagerie: four glossy animals under gallery lights ---- */
    const sculpturePart = (g, geometry, material, x, y, zz, scale = null, ry = 0) => {
      const part = new THREE.Mesh(geometry, material);
      part.position.set(x, y, zz);
      part.rotation.y = ry;
      if (scale) part.scale.set(...scale);
      part.userData.noSplat = true;
      g.add(part);
      return part;
    };
    const sculptureMat = (color) => latexMat(color);
    const sculptureEye = latexMat(0x050509);
    const sculptureAccent = new THREE.MeshPhysicalMaterial({
      color: 0xf5e9ff, emissive: 0xd946ef, emissiveIntensity: 0.8,
      roughness: 0.08, metalness: 0.18, clearcoat: 1, clearcoatRoughness: 0.03,
    });
    const sculpturePlinth = (x, zz, accent = 0xd946ef) => {
      const g = new THREE.Group();
      g.position.set(x, 0, zz);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.86, 0.22, 32), latexMat(0x17151d));
      base.position.y = 0.11;
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.7, 0.06, 32), latexMat(0xd8d4df));
      top.position.y = 0.25;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.025, 8, 32), new THREE.MeshBasicMaterial({ color: accent }));
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.25;
      g.add(base, top, ring);
      g.traverse((o) => { o.userData.noSplat = true; });
      z.group.add(g);
      return 0.28;
    };
    const animal = (kind, x, zz, color, ry = 0, accent = 0xd946ef) => {
      const g = new THREE.Group();
      g.position.set(x, sculpturePlinth(x, zz, accent), zz);
      g.rotation.y = ry;
      const body = sculptureMat(color);
      const accentMat = latexMat(accent);
      const eye = sculptureEye;
      const sphere = (radius, px, py, pz, scale = [1, 1, 1], material = body) =>
        sculpturePart(g, new THREE.SphereGeometry(radius, 20, 14), material, px, py, pz, scale);
      const cone = (r1, r2, h, px, py, pz, material = body, rotation = [0, 0, 0]) => {
        const part = sculpturePart(g, new THREE.ConeGeometry(r1, h, 16), material, px, py, pz);
        part.rotation.set(...rotation);
        return part;
      };
      const torus = (major, minor, px, py, pz, material = accentMat, rotation = [Math.PI / 2, 0, 0]) => {
        const part = sculpturePart(g, new THREE.TorusGeometry(major, minor, 10, 24), material, px, py, pz);
        part.rotation.set(...rotation);
        return part;
      };

      if (kind === 'panther') {
        sphere(0.58, 0, 0.76, 0, [1.65, 0.72, 0.72]);
        sphere(0.42, 0.9, 1.02, -0.02, [1.05, 0.9, 0.86]);
        sphere(0.25, 1.15, 1.02, 0, [1.25, 0.7, 0.75]);
        for (const px of [-0.5, 0.5]) sphere(0.13, px, 0.42, -0.22, [0.7, 1.5, 0.7]);
        for (const pz of [-0.23, 0.23]) sphere(0.07, 1.23, 1.1, pz, [1, 1, 0.7], accentMat);
        cone(0.18, 0, 0.34, 0.72, 1.4, -0.24, body, [0, 0, -0.35]);
        cone(0.18, 0, 0.34, 0.72, 1.4, 0.24, body, [0, 0, 0.35]);
        torus(0.42, 0.045, -0.86, 0.93, 0, accentMat, [0, Math.PI / 2, 0]);
      } else if (kind === 'dachshund') {
        sphere(0.42, 0, 0.75, 0, [2.1, 0.7, 0.68]);
        sphere(0.35, 1.0, 0.9, 0, [1.05, 0.85, 0.8]);
        sphere(0.22, 1.3, 0.82, 0, [1.35, 0.7, 0.7]);
        for (const px of [-0.53, -0.12, 0.42, 0.72]) sphere(0.1, px, 0.38, 0, [0.7, 1.5, 0.7]);
        sphere(0.08, 1.46, 0.94, -0.17, [1, 1, 0.7], eye);
        sphere(0.08, 1.46, 0.94, 0.17, [1, 1, 0.7], eye);
        sphere(0.1, 1.55, 0.82, 0, [1, 0.8, 0.8], accentMat);
        cone(0.16, 0, 0.36, 0.88, 1.18, -0.22, body, [0, 0, -0.35]);
        cone(0.16, 0, 0.36, 0.88, 1.18, 0.22, body, [0, 0, 0.35]);
        cone(0.12, 0, 0.62, -1.05, 1.0, 0, body, [0, 0, -Math.PI / 3]);
      } else if (kind === 'swan') {
        sphere(0.48, 0, 0.74, 0, [1.15, 0.82, 0.82]);
        sphere(0.16, 0.35, 1.35, 0, [0.9, 2.4, 0.9]);
        sphere(0.2, 0.48, 1.78, 0, [1.15, 0.9, 0.9]);
        cone(0.12, 0.025, 0.34, 0.7, 1.78, 0, accentMat, [0, 0, Math.PI / 2]);
        sphere(0.05, 0.53, 1.84, -0.13, [1, 1, 0.7], eye);
        sphere(0.05, 0.53, 1.84, 0.13, [1, 1, 0.7], eye);
        sphere(0.58, -0.16, 0.85, 0, [0.45, 1.0, 1.15], body);
        torus(0.32, 0.045, -0.42, 0.82, 0, accentMat);
      } else {
        // An inflatable-looking horse: long neck, muzzle, ears, and a proud mane.
        sphere(0.5, -0.1, 0.72, 0, [1.05, 0.82, 0.72]);
        sphere(0.3, 0.35, 1.38, 0, [0.72, 1.65, 0.72]);
        sphere(0.3, 0.62, 2.0, 0, [1.0, 0.88, 0.82]);
        sphere(0.22, 0.9, 1.92, 0, [1.3, 0.72, 0.72]);
        for (const px of [-0.42, 0.38]) sphere(0.1, px, 0.34, 0, [0.7, 1.8, 0.7]);
        for (const pz of [-0.15, 0.15]) sphere(0.06, 1.0, 2.05, pz, [1, 1, 0.7], eye);
        cone(0.13, 0, 0.32, 0.45, 2.35, -0.17, body, [0, 0, -0.25]);
        cone(0.13, 0, 0.32, 0.45, 2.35, 0.17, body, [0, 0, 0.25]);
        torus(0.25, 0.04, -0.04, 1.58, 0, accentMat, [0, Math.PI / 2, 0]);
      }
      g.traverse((o) => { o.userData.noSplat = true; });
      z.group.add(g);
    };
    animal('panther', 2.1, -0.85, 0x13131b, -0.25, 0x33d6ff);
    animal('dachshund', 4.8, -0.85, 0x7e1439, 0.1, 0xffd166);
    animal('swan', 7.5, -0.85, 0xf1f2f7, -0.2, 0xff4fb3);
    animal('horse', 9.7, -0.85, 0x28728a, Math.PI, 0xd946ef);

    const gallerySign = new THREE.Mesh(
      new THREE.PlaneGeometry(5.6, 0.52),
      new THREE.MeshBasicMaterial({ map: textTexture('LATEX MENAGERIE', { fg: '#fff5ff', bg: '#64164e', size: 42 }), transparent: true })
    );
    gallerySign.position.set(6.5, 3.05, -5.91);
    gallerySign.rotation.y = Math.PI;
    gallerySign.userData.noSplat = true;
    z.group.add(gallerySign);

    // A clean white key light makes the rubber read as rubber; magenta/cyan rims keep it weird.
    const showroomKey = new THREE.SpotLight(0xfff7ff, 18, 14, Math.PI / 5, 0.62, 1.4);
    showroomKey.position.set(6.2, 3.35, -0.5);
    showroomKey.target.position.set(6.2, 0, -0.85);
    z.group.add(showroomKey, showroomKey.target);
    const showroomFill = new THREE.PointLight(0xe8f7ff, 6.5, 11, 1.5);
    showroomFill.position.set(9.4, 2.3, -1.1); z.group.add(showroomFill);
    const pinkRim = new THREE.PointLight(0xff3da8, 5.5, 9, 1.7);
    pinkRim.position.set(4.0, 2.1, -4.8); z.group.add(pinkRim);
    const cyanRim = new THREE.PointLight(0x28d7ff, 5.5, 9, 1.7);
    cyanRim.position.set(8.5, 2.0, 3.9); z.group.add(cyanRim);
    z.group.add(new THREE.HemisphereLight(0xffe9f7, 0x111827, 0.82));
    for (const x of [2.1, 4.8, 7.5, 9.7]) {
      box(z, { w: 0.055, h: 2.25, d: 0.055, x, y: 0.35, z: -5.55, material: new THREE.MeshBasicMaterial({ color: 0xff4fb3 }), solid: false, noSplat: true });
    }

    // Daylight treatment: a pale ceiling wash keeps the room bright while the
    // latex still gets its pink/cyan nightclub edges from the smaller lamps.
    const daylight = new THREE.DirectionalLight(0xeaf7ff, 2.8);
    daylight.position.set(4.5, 6.5, -3.5);
    daylight.target.position.set(5.5, 0, 0);
    z.group.add(daylight, daylight.target);
    const skylight = new THREE.Mesh(
      new THREE.PlaneGeometry(9.8, 4.8),
      new THREE.MeshBasicMaterial({ color: 0xdff6ff, transparent: true, opacity: 0.78 })
    );
    skylight.position.set(5.4, 3.48, 0);
    skylight.rotation.x = Math.PI / 2;
    skylight.userData.noSplat = true;
    z.group.add(skylight);
    for (const x of [1.6, 4.2, 6.8, 9.4]) {
      const ceilingPanel = new THREE.Mesh(
        new THREE.BoxGeometry(1.65, 0.035, 1.05),
        new THREE.MeshBasicMaterial({ color: 0xf4fbff, transparent: true, opacity: 0.9 })
      );
      ceilingPanel.position.set(x, 3.42, 0);
      ceilingPanel.userData.noSplat = true;
      z.group.add(ceilingPanel);
    }

    /* ---- latex balloons everywhere: soft, glossy, slightly unprofessional ---- */
    const balloonColors = [0xff4fb3, 0x35d7ff, 0xffd166, 0x9b5cff, 0xf5f7ff, 0xff6b6b, 0x59e391];
    const balloon = (x, zz, y, color, scale = 1, lean = 0) => {
      const g = new THREE.Group();
      g.position.set(x, 0, zz);
      g.rotation.z = lean;
      const rubber = latexMat(color);
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 16), rubber);
      body.position.y = y;
      body.scale.set(0.82 * scale, 1.18 * scale, 0.82 * scale);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045 * scale, 0.06 * scale, 0.12 * scale, 10), rubber);
      neck.position.y = y - 0.3 * scale;
      const knot = new THREE.Mesh(new THREE.TetrahedronGeometry(0.075 * scale, 0), rubber);
      knot.position.y = y - 0.39 * scale;
      const string = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008 * scale, 0.008 * scale, Math.max(0.35, y - 0.42 * scale), 6),
        mat(0xe9edf2, { roughness: 0.72 })
      );
      string.position.y = (y - 0.42 * scale) / 2;
      g.add(body, neck, knot, string);
      g.traverse((o) => { o.userData.noSplat = true; });
      z.group.add(g);
    };
    const balloonCluster = (x, zz, baseY, count, seed) => {
      for (let i = 0; i < count; i++) {
        const a = seed + i * 2.41;
        const radius = 0.18 + ((Math.sin(a * 3.7) + 1) * 0.5) * 0.5;
        balloon(
          x + Math.cos(a) * radius,
          zz + Math.sin(a) * radius,
          baseY + 0.18 + ((Math.sin(a * 2.2) + 1) * 0.5) * 0.72,
          balloonColors[(i + Math.floor(seed * 3)) % balloonColors.length],
          0.72 + ((Math.sin(a * 4.1) + 1) * 0.5) * 0.32,
          Math.sin(a * 1.7) * 0.12
        );
      }
    };
    balloonCluster(1.5, -4.35, 1.35, 5, 0.4);
    balloonCluster(3.5, 3.8, 1.2, 6, 1.7);
    balloonCluster(6.0, -4.35, 1.45, 5, 2.8);
    balloonCluster(8.7, 3.8, 1.1, 6, 4.2);
    balloonCluster(10.0, -1.0, 1.25, 4, 5.5);
    // A few loose ceiling balloons make the entire back room feel inflated.
    balloon(2.0, 1.0, 2.95, 0xffd166, 0.9, -0.08);
    balloon(4.2, -1.8, 3.08, 0x35d7ff, 0.8, 0.1);
    balloon(7.0, 1.8, 2.9, 0xff4fb3, 0.86, -0.06);
    balloon(9.4, -3.0, 3.12, 0xf5f7ff, 0.78, 0.08);

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
    door(z, { x: 4, z: 6.12, ry: Math.PI, label: 'THE DILDO BALL →', to: 'dildoBall' });


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

  /* ---------------------------------------------------------- */
  /*  ZONE 5 — THE GILDED FORK                                  */
  /*                                                            */
  /*  One long table, every artworld big shot, all of them      */
  /*  drunk and messed up. Warm wood, gold light, and a         */
  /*  centerpiece that is definitely a sculpture and            */
  /*  definitely on fire. The chairs are priced like            */
  /*  small apartments. The wine is priced like the chairs.      */
  /* ---------------------------------------------------------- */
  #buildGildedFork() {
    const z = this.#newZone('gildedFork');
    shell(z, { w: 20, d: 14, floorColor: 0x2a1c14, wallColor: 0x241a12, ceilColor: 0x14100c });
    z.spawn.set(-8.4, 0, 0);
    z.spawnYaw = -Math.PI / 2;         // face east, straight at the table
    // Keep the old-gold mood, but let the food, faces, and absurd props read
    // clearly from the doorway instead of disappearing into brown fog.
    z.fog = { color: 0x3b2a22, density: 0.012 };

    /* ---- floor: herringbone-ish planks, mostly wine ---- */
    for (let i = 0; i < 12; i++) {
      const x = -9.5 + i * 1.7;
      plane(z, {
        w: 1.65, h: 13.96, x, y: 0.011, z: 0, rx: -Math.PI / 2,
        material: mat(i % 2 === 0 ? 0x2e2016 : 0x342418, { roughness: 0.85 }),
        noSplat: true, name: 'floor plank',
      });
    }
    // a rug that has seen things
    plane(z, {
      w: 16, h: 4.2, x: 0, y: 0.012, z: 0, rx: -Math.PI / 2,
      material: mat(0x3a1a1e, { roughness: 0.95 }), noSplat: true, name: 'rug',
    });

    /* ---- the table: one long, one legendary, one sticky ---- */
    const tableMat = mat(0x4a3220, { roughness: 0.35, metalness: 0.05 });
    const table = box(z, {
      w: 12.8, h: 0.12, d: 2.2, x: 0.5, y: 0.72, z: 0,
      material: tableMat, name: 'the long table',
    });
    // legs — four sturdy trestles
    for (const x of [-5.5, -1.9, 1.9, 5.5]) {
      box(z, { w: 0.22, h: 0.72, d: 1.9, x, z: 0, material: mat(0x3a2818, { roughness: 0.6 }), name: 'table leg' });
    }
    // a lip so the wine doesn't escape (it will anyway)
    box(z, { w: 12.8, h: 0.03, d: 0.06, x: 0.5, y: 0.84, z: -1.05, material: tableMat, solid: false, noSplat: true });
    box(z, { w: 12.8, h: 0.03, d: 0.06, x: 0.5, y: 0.84, z: 1.05, material: tableMat, solid: false, noSplat: true });

    /* ---- chairs: thrones, really ---- */
    const chairMat = mat(0x2a1c14, { roughness: 0.55 });
    const seatMat = mat(0x6b2a2e, { roughness: 0.7 });
    const chair = (x, zz, ry = 0) => {
      const g = new THREE.Group();
      g.position.set(x, 0, zz); g.rotation.y = ry;
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.08, 0.5), seatMat);
      seat.position.y = 0.48;
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.52, 1.0, 0.06), chairMat);
      back.position.set(0, 0.98, -0.24);
      const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.48, 8), chairMat);
      legL.position.set(-0.22, 0.24, 0.2);
      const legR = legL.clone(); legR.position.x = 0.22;
      const legB = legL.clone(); legB.position.set(0, 0.24, -0.2);
      g.add(seat, back, legL, legR, legB);
      g.traverse((o) => { o.userData.noSplat = true; });
      z.group.add(g);
      z.colliders.push({ minX: x - 0.3, maxX: x + 0.3, minZ: zz - 0.3, maxZ: zz + 0.3 });
    };
    // north side (facing south into the table)
    chair(-4.5, -1.9, 0);
    chair(-1.5, -1.9, 0);
    chair(1.5, -1.9, 0);
    chair(4.5, -1.9, 0);
    // south side (facing north)
    chair(-4.5, 1.9, Math.PI);
    chair(-1.5, 1.9, Math.PI);
    chair(1.5, 1.9, Math.PI);
    chair(4.5, 1.9, Math.PI);
    // the head of the table — the host's chair, bigger and stupider
    {
      const g = new THREE.Group();
      g.position.set(7.4, 0, 0); g.rotation.y = -Math.PI / 2;
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.1, 0.62), seatMat);
      seat.position.y = 0.52;
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.68, 1.3, 0.08), chairMat);
      back.position.set(0, 1.12, -0.3);
      const crown = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.06), mat(0x8a6a3a, { metalness: 0.5, roughness: 0.3 }));
      crown.position.set(0, 1.82, -0.28);
      g.add(seat, back, crown);
      g.traverse((o) => { o.userData.noSplat = true; });
      z.group.add(g);
      z.colliders.push({ minX: 7.0, maxX: 7.8, minZ: -0.35, maxZ: 0.35 });
    }

    /* ---- the mess ---- */
    // wine bottles, standing and fallen
    const bottleMat = mat(0x1a3a1e, { roughness: 0.15, metalness: 0.3 });
    const bottle = (x, zz, tipped = false) => {
      const b = new THREE.Group();
      b.position.set(x, 0.78, zz);
      if (tipped) { b.rotation.z = Math.PI / 2; b.position.y = 0.82; }
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.22, 10), bottleMat);
      body.position.y = 0.11;
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.028, 0.1, 8), bottleMat);
      neck.position.y = 0.27;
      b.add(body, neck);
      b.traverse((o) => { o.userData.noSplat = true; });
      z.group.add(b);
    };
    bottle(-5.2, -0.4);
    bottle(-3.8, 0.6, true);
    bottle(-0.8, -0.7);
    bottle(2.4, 0.3);
    bottle(4.9, -0.5, true);
    bottle(6.1, 0.4);
    // glasses — some standing, some on their sides
    const glassMat = mat(0xd8d2c2, { roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.6 });
    const glass = (x, zz, tipped = false) => {
      const g = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.022, 0.12, 8), glassMat);
      g.position.set(x, 0.82, zz);
      if (tipped) { g.rotation.z = Math.PI / 2; g.position.y = 0.78; }
      g.userData.noSplat = true;
      z.group.add(g);
    };
    glass(-5.8, 0.2);
    glass(-2.1, -0.3, true);
    glass(0.6, 0.7);
    glass(3.3, -0.6);
    glass(5.7, 0.1, true);
    // plates with bones and dignity
    const plateMat = mat(0xe8e0cc, { roughness: 0.25 });
    for (const [x, zz] of [[-4.5, -0.5], [-1.5, 0.4], [1.5, -0.4], [4.5, 0.5], [6.9, 0]]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.02, 12), plateMat);
      p.position.set(x, 0.79, zz);
      p.userData.noSplat = true;
      z.group.add(p);
    }

    /* ---- the menu has escaped: food sculptures, bottles, and found PNGs ---- */
    const foodMat = (color, roughness = 0.42) => new THREE.MeshStandardMaterial({
      color, roughness, metalness: 0.05,
    });
    const food = (x, zz, color, scale = 1, tilt = 0) => {
      const g = new THREE.Group();
      g.position.set(x, 0.82, zz);
      g.rotation.z = tilt;
      const mound = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), foodMat(color));
      mound.scale.set(1.35 * scale, 0.62 * scale, 1.1 * scale);
      mound.position.y = 0.08 * scale;
      const garnish = new THREE.Mesh(new THREE.TorusGeometry(0.1 * scale, 0.018 * scale, 6, 16), foodMat(0x5d9b52, 0.8));
      garnish.rotation.x = Math.PI / 2;
      garnish.position.y = 0.19 * scale;
      g.add(mound, garnish);
      g.traverse((o) => { o.userData.noSplat = true; });
      z.group.add(g);
    };
    for (const [x, zz, color, scale, tilt] of [
      [-4.5, -0.5, 0xc94d39, 1.1, 0.05], [-1.5, 0.4, 0xe8c15a, 0.8, -0.08],
      [1.5, -0.4, 0x6f9d55, 0.95, 0.1], [4.5, 0.5, 0x9b3d72, 1.2, -0.04],
    ]) food(x, zz, color, scale, tilt);
    // A soup tureen in the middle, with a glowing red broth that is too alive.
    const tureen = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 10), foodMat(0x5b2330, 0.22));
    tureen.scale.y = 0.55;
    tureen.position.set(0.5, 0.93, 0);
    tureen.userData.noSplat = true;
    z.group.add(tureen);
    const broth = new THREE.Mesh(new THREE.CircleGeometry(0.23, 16), new THREE.MeshBasicMaterial({ color: 0xff5b67 }));
    broth.rotation.x = -Math.PI / 2;
    broth.position.set(0.5, 1.12, 0);
    broth.userData.noSplat = true;
    z.group.add(broth);

    // The authored freak PNGs become hovering dinner-party heraldry: a rubber
    // duck, spaghetti, and toaster arguing with the silverware.
    const foundProp = (url, x, y, zz, w, h, ry = 0) => {
      const g = new THREE.Group();
      g.position.set(x, 0, zz);
      g.rotation.y = ry;
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, alphaTest: 0.08, side: THREE.DoubleSide })
      );
      mesh.position.y = y;
      mesh.userData.noSplat = true;
      new THREE.TextureLoader().load(encodeURI(url), (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        mesh.material.map = tex;
        mesh.material.needsUpdate = true;
      });
      g.add(mesh);
      g.traverse((o) => { o.userData.noSplat = true; });
      z.group.add(g);
    };
    foundProp('puplic/fashion art freaks/assets/artfreaks/rubber-duck-freak.png', -6.7, 1.55, -5.45, 1.15, 1.15, 0.15);
    foundProp('puplic/fashion art freaks/assets/artfreaks/spaghetti-freak.png', 0.2, 1.35, 5.9, 1.55, 1.15, Math.PI);
    foundProp('puplic/fashion art freaks/assets/artfreaks/toaster-freak.png', 6.4, 1.25, 5.85, 1.25, 1.1, Math.PI);

    // A fork chandelier: suspended cutlery makes the room feel like it is
    // trying to eat the guests back.
    const cutleryMat = mat(0xe8e0cc, { metalness: 0.8, roughness: 0.18 });
    for (let i = 0; i < 11; i++) {
      const utensil = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.72, 0.025), cutleryMat);
      const a = i * 1.91;
      utensil.position.set(Math.cos(a) * (2.2 + (i % 3) * 0.35), 2.25 + (i % 2) * 0.22, Math.sin(a) * 2.2);
      utensil.rotation.z = Math.sin(a) * 0.35;
      utensil.rotation.x = Math.cos(a) * 0.25;
      utensil.userData.noSplat = true;
      z.group.add(utensil);
    }

    /* ---- the centerpiece: a candelabra, on fire, expensive ---- */
    {
      const c = new THREE.Group();
      c.position.set(0.5, 0.78, 0);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.05, 12), mat(0x8a6a3a, { metalness: 0.7, roughness: 0.2 }));
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.55, 8), mat(0x8a6a3a, { metalness: 0.7, roughness: 0.2 }));
      stem.position.y = 0.3;
      const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 6), mat(0x8a6a3a, { metalness: 0.7, roughness: 0.2 }));
      armL.position.set(-0.12, 0.52, 0); armL.rotation.z = 0.6;
      const armR = armL.clone(); armR.position.x = 0.12; armR.rotation.z = -0.6;
      c.add(base, stem, armL, armR);
      c.traverse((o) => { o.userData.noSplat = true; });
      z.group.add(c);
      // three flames that lean with the room's pulse
      for (const [fx, fy] of [[-0.22, 0.62], [0, 0.62], [0.22, 0.62]]) {
        const flame = new THREE.PointLight(0xffb35c, 1.8, 4, 1.9);
        flame.position.set(0.5 + fx, 0.78 + fy, 0);
        flame.userData.base = 1.8;
        z.group.add(flame);
        z.animated.candles.push(flame);
        const wick = new THREE.Mesh(
          new THREE.SphereGeometry(0.02, 8, 6),
          new THREE.MeshBasicMaterial({ color: 0xfff2d8 })
        );
        wick.position.set(0.5 + fx, 0.78 + fy - 0.03, 0);
        wick.userData.noSplat = true;
        z.group.add(wick);
      }
    }

    /* ---- the walls: heavy frames, heavier opinions ---- */
    hangingArt(z, { x: -5, y: 1.9, z: -6.78, ry: 0, w: 1.4, h: 1.8, seed: 401 });
    hangingArt(z, { x: 0, y: 1.9, z: -6.78, ry: 0, w: 1.4, h: 1.8, seed: 403 });
    hangingArt(z, { x: 5, y: 1.9, z: -6.78, ry: 0, w: 1.4, h: 1.8, seed: 405 });
    hangingArt(z, { x: -3, y: 1.9, z: 6.78, ry: Math.PI, w: 1.4, h: 1.8, seed: 407 });
    hangingArt(z, { x: 3, y: 1.9, z: 6.78, ry: Math.PI, w: 1.4, h: 1.8, seed: 409 });

    // a tapestry that is definitely not a curtain
    {
      const g = new THREE.Group();
      g.position.set(-9.78, 2.0, 0);
      g.rotation.y = Math.PI / 2;
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 3.2, 8), mat(0x5a4a3a, { metalness: 0.5, roughness: 0.3 }));
      rod.rotation.z = Math.PI / 2;
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.2), mat(0x4a1a2e, { roughness: 0.9 }));
      cloth.position.y = -1.1;
      cloth.userData.noSplat = true;
      g.add(rod, cloth);
      z.group.add(g);
    }

    /* ---- the chandelier: gold, heavy, judging ---- */
    {
      const g = new THREE.Group();
      g.position.set(0.5, 0, 0);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.06, 12, 32), mat(0x8a6a3a, { metalness: 0.75, roughness: 0.2 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 2.9;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.7, 8), mat(0x8a6a3a, { metalness: 0.75, roughness: 0.2 }));
      stem.position.y = 3.25;
      g.add(ring, stem);
      // six little candles around the ring
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const cx = Math.cos(a) * 1.1;
        const cz = Math.sin(a) * 1.1;
        const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.14, 8), mat(0xe8e0cc, { roughness: 0.3 }));
        candle.position.set(cx, 2.95, cz);
        candle.userData.noSplat = true;
        g.add(candle);
        const flame = new THREE.PointLight(0xffd9a0, 1.2, 3.5, 1.8);
        flame.position.set(cx, 3.05, cz);
        flame.userData.base = 1.2;
        g.add(flame);
        z.animated.candles.push(flame);
      }
      z.group.add(g);
    }

    /* ---- the sideboard: more wine, a cheese wheel, a bust of someone ---- */
    box(z, { w: 3.4, h: 1.0, d: 0.7, x: -8.6, z: -4.2, material: mat(0x2a1c14, { roughness: 0.6 }), name: 'sideboard' });
    // cheese wheel, half-eaten by the conversation
    {
      const cheese = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 0.14, 16, 1, false, 0, Math.PI * 1.6),
        mat(0xe8c15a, { roughness: 0.6 })
      );
      cheese.position.set(-8.6, 1.08, -4.2);
      cheese.rotation.x = Math.PI / 2;
      cheese.userData.noSplat = true;
      z.group.add(cheese);
    }
    // a bust that has seen too much
    {
      const bust = new THREE.Group();
      bust.position.set(-9.4, 1.0, 3.8);
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.3), mat(0x8a8a92, { roughness: 0.4 }));
      plinth.position.y = 0.2;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), mat(0xd8d2c2, { roughness: 0.5 }));
      head.position.y = 0.55;
      const nose = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.06), mat(0xc9bfae, { roughness: 0.5 }));
      nose.position.set(0, 0.55, 0.15);
      bust.add(plinth, head, nose);
      bust.traverse((o) => { o.userData.noSplat = true; });
      z.group.add(bust);
      z.colliders.push({ minX: -9.6, maxX: -9.2, minZ: 3.6, maxZ: 4.0 });
    }

    /* ---- light: warm pools, gold, and one red exit sign ---- */
    const warm1 = new THREE.PointLight(0xffd9a0, 6, 12, 1.7);
    warm1.position.set(-4, 2.8, -2); warm1.userData.base = 6; z.group.add(warm1);
    const warm2 = new THREE.PointLight(0xffd9a0, 5, 11, 1.8);
    warm2.position.set(4, 2.8, 2); warm2.userData.base = 5; z.group.add(warm2);
    const gold = new THREE.PointLight(0xe8c15a, 4, 10, 1.9);
    gold.position.set(0.5, 2.2, 0); gold.userData.base = 4; z.group.add(gold);
    z.animated.candles.push(warm1, warm2, gold);
    // Brighter house light: warm enough for the gold, neutral enough to see
    // every suspicious canapé. The colored lamps remain as strange accents.
    z.group.add(new THREE.HemisphereLight(0xfff3df, 0x3a241c, 1.18));
    const daylight = new THREE.DirectionalLight(0xfff8e8, 1.55);
    daylight.position.set(-2, 6.5, 4);
    daylight.target.position.set(0, 0, 0);
    z.group.add(daylight, daylight.target);
    const ceilingWash = new THREE.Mesh(
      new THREE.PlaneGeometry(12.5, 5.2),
      new THREE.MeshBasicMaterial({ color: 0xfff7df, transparent: true, opacity: 0.82 })
    );
    ceilingWash.rotation.x = Math.PI / 2;
    ceilingWash.position.set(0.5, 3.48, 0);
    ceilingWash.userData.noSplat = true;
    z.group.add(ceilingWash);

    /* ---- a standing neon menu, because the room has one hunger ---- */
    {
      const neon = new THREE.Group();
      neon.position.set(6.8, 0, -4.8);
      neon.rotation.y = -Math.PI * 0.72;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 2.45, 8), mat(0x9aa0a8, { metalness: 0.9, roughness: 0.15 }));
      pole.position.y = 1.22;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.32, 0.09, 14), mat(0x20151a, { metalness: 0.35, roughness: 0.3 }));
      base.position.y = 0.045;
      const letters = new THREE.Mesh(
        new THREE.PlaneGeometry(2.25, 0.52),
        new THREE.MeshBasicMaterial({ map: textTexture('I AM HUNGRY', { fg: '#ff5bcb', size: 68, w: 768, h: 144 }), transparent: true })
      );
      letters.position.set(0, 2.28, 0.025);
      const glow = new THREE.PointLight(0xff5bcb, 4.6, 7, 1.7);
      glow.position.set(0, 2.28, 0.35);
      glow.userData.base = 4.6;
      neon.add(pole, base, letters, glow);
      neon.traverse((o) => { o.userData.noSplat = true; });
      z.group.add(neon);
      z.animated.hungryNeon = { mat: letters.material, glow, base: 4.6 };
      z.interactables.push({
        id: 'fork-hungry-neon', type: 'flavor', label: 'Read the hungry neon sign',
        pos: new THREE.Vector3(6.8, 1.5, -4.8), radius: 1.7,
        lines: [
          'I AM HUNGRY, says the sign. It has been saying this since the first course.',
          'The neon hums in B-flat and appears to be looking at the soup.',
          'You read the sign twice. The second reading costs more.',
        ],
      });
    }

    door(z, { x: -9.8, z: 0, ry: Math.PI / 2, label: '← GALLERIA BIANCA', to: 'galleria' });

    /* ---- anchors: the big shots at their seats ---- */
    z.anchors.forkHost = new THREE.Vector3(7.4, 0, 0);
    z.anchors.fork1 = new THREE.Vector3(-4.5, 0, -1.9);
    z.anchors.fork2 = new THREE.Vector3(-1.5, 0, -1.9);
    z.anchors.fork3 = new THREE.Vector3(1.5, 0, -1.9);
    z.anchors.fork4 = new THREE.Vector3(4.5, 0, -1.9);
    z.anchors.fork5 = new THREE.Vector3(-4.5, 0, 1.9);
    z.anchors.fork6 = new THREE.Vector3(-1.5, 0, 1.9);
    z.anchors.fork7 = new THREE.Vector3(1.5, 0, 1.9);
    z.anchors.fork8 = new THREE.Vector3(4.5, 0, 1.9);
    z.anchors.forkWaiter = new THREE.Vector3(-8.6, 0, -4.2);

    /* ---- flavor: the table remembers ---- */
    z.interactables.push({
      id: 'fork-table', type: 'flavor', label: 'Read the table\'s stains',
      pos: new THREE.Vector3(0.5, 0.8, 0), radius: 2.2,
      lines: [
        'A ring of red where someone set down a glass and a secret at the same time.',
        'The wood remembers every deal, every divorce, every “just one more”.',
        'Someone carved initials into the leg. They are not the artist\'s.',
      ],
    });
    z.interactables.push({
      id: 'fork-candelabra', type: 'flavor', label: 'Warm your hands on the candelabra',
      pos: new THREE.Vector3(0.5, 1.2, 0), radius: 1.8,
      lines: [
        'The flames lean toward the gossip. They have excellent taste.',
        'Three candles, one table, zero survivors of the seating chart.',
        'The wax drips like it is trying to leave.',
      ],
    });
    z.interactables.push({
      id: 'fork-bust', type: 'flavor', label: 'Apologize to the bust',
      pos: new THREE.Vector3(-9.4, 1.5, 3.8), radius: 1.6,
      lines: [
        'The bust is of someone who once mattered. The nose has been replaced twice.',
        'It stares at the table with the patience of a man who has already been paid.',
        'You apologize. The bust accepts. It has heard worse.',
      ],
    });

    z.waypoints = [
      new THREE.Vector3(-6, 0, 3.5), new THREE.Vector3(-2, 0, 4.0),
      new THREE.Vector3(2, 0, -4.0), new THREE.Vector3(6, 0, -3.5),
      new THREE.Vector3(0, 0, 5.0), new THREE.Vector3(-7.5, 0, 0),
      new THREE.Vector3(8, 0, 3.0), new THREE.Vector3(-3, 0, -5.0),
    ];
  }

  /* ---------------------------------------------------------- */
  /*  ZONE 6 — MAX PRO KUNST 2000                               */
  /*                                                            */
  /*  An oversized white cube invaded by a football broadcast,  */
  /*  a Berlin club, a newsroom office, and a boxing match.      */
  /*  The tiny painting debate continues beside the ring as if  */
  /*  nothing about this arrangement requires explanation.      */
  /* ---------------------------------------------------------- */
  #buildMaxPro() {
    const z = this.#newZone('maxPro');
    const { w, d, h } = MAXPRO.room;
    shell(z, { w, d, h, floorColor: 0xb9b7b2, wallColor: 0xf2f0ec, ceilColor: 0xf6f5f1 });
    z.spawn.set(0, 0, 10.7);
    z.spawnYaw = Math.PI;            // face north — from here the painting is a rumour
    z.fog = { color: 0xf4f3ef, density: 0.016 };   // daylight haze, not the usual murk

    const P = MAXPRO.painting;

    // polished concrete — the floor is doing the work of three paintings
    plane(z, {
      w: w - 0.1, h: d - 0.1, x: 0, y: 0.011, z: 0, rx: -Math.PI / 2,
      material: new THREE.MeshStandardMaterial({ color: 0xbebcb7, roughness: 0.34, metalness: 0.05 }),
      noSplat: true, name: 'floor',
    });

    /* ---- KUNST 2000: newsroom boxing as an unresolved football fixture ---- */
    {
      const ringX = 8.2, ringZ = -1.2;
      const white = mat(0xf4f3ef, { roughness: 0.72 });
      const steel = mat(0x282c33, { metalness: 0.68, roughness: 0.28 });
      const blue = mat(0x1648d8, { roughness: 0.42 });
      const red = mat(0xd42632, { roughness: 0.42 });

      // Raised broadcast ring: regulation-ish, but nobody checked which regulation.
      box(z, { w: 6.4, h: 0.34, d: 5.2, x: ringX, z: ringZ, material: mat(0xd8d9dc, { roughness: 0.62 }), name: 'kunstRing' });
      plane(z, {
        w: 5.9, h: 4.7, x: ringX, y: 0.352, z: ringZ, rx: -Math.PI / 2,
        material: new THREE.MeshStandardMaterial({ color: 0xf6f7f8, roughness: 0.58 }),
        noSplat: false, name: 'kunstCanvas',
      });
      for (const [dx, dz] of [[-3, -2.4], [3, -2.4], [-3, 2.4], [3, 2.4]]) {
        cylinder(z, { rT: 0.07, rB: 0.09, h: 1.6, x: ringX + dx, y: 0.34, z: ringZ + dz, material: steel, solid: false, noSplat: true });
      }
      for (const y of [0.76, 1.12, 1.48]) {
        for (const dz of [-2.4, 2.4]) box(z, { w: 6.0, h: 0.035, d: 0.035, x: ringX, y, z: ringZ + dz, material: y === 1.12 ? red : white, solid: false, noSplat: true });
        for (const dx of [-3, 3]) box(z, { w: 0.035, h: 0.035, d: 4.8, x: ringX + dx, y, z: ringZ, material: y === 1.12 ? blue : white, solid: false, noSplat: true });
      }

      // Two coded figures: full gloves, boxing shorts, guards up. One white boxer, one Black boxer.
      const makeBoxer = ({ x, skin, shorts, gloves, trim, phase }) => {
        const g = new THREE.Group();
        g.position.set(x, 0.35, ringZ);
        const skinMat = mat(skin, { roughness: 0.7 });
        const shortsMat = mat(shorts, { roughness: 0.46 });
        const gloveMat = mat(gloves, { roughness: 0.3 });
        const trimMat = mat(trim, { roughness: 0.5 });
        const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.55, 6, 12), skinMat);
        torso.position.y = 1.12;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 12), skinMat);
        head.position.y = 1.72;
        const shortsBody = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.34, 0.34), shortsMat);
        shortsBody.position.y = 0.75;
        const waistband = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.075, 0.35), trimMat);
        waistband.position.y = 0.91;
        const legs = [];
        for (const sx of [-1, 1]) {
          const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.42, 5, 8), skinMat);
          leg.position.set(sx * 0.16, 0.37, 0);
          leg.rotation.z = sx * 0.05;
          legs.push(leg);
        }
        const arms = [];
        for (const sx of [-1, 1]) {
          const arm = new THREE.Group();
          arm.position.set(sx * 0.31, 1.34, 0.04);
          const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.32, 5, 8), skinMat);
          forearm.position.set(sx * 0.06, 0.02, 0.1);
          forearm.rotation.z = sx * 0.55;
          const glove = new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 10), gloveMat);
          glove.scale.set(1.08, 0.92, 1.18);
          glove.position.set(sx * 0.15, 0.22, 0.24);
          arm.add(forearm, glove);
          arms.push(arm);
        }
        g.add(torso, head, shortsBody, waistband, ...legs, ...arms);
        g.traverse((o) => { o.userData.noSplat = true; });
        z.group.add(g);
        return {
          group: g, torso, head, shortsBody, arms, legs,
          baseX: x, baseZ: ringZ, baseY: 0.35, phase,
        };
      };
      const boxerA = makeBoxer({ x: ringX - 1.15, skin: 0xe2b28d, shorts: 0xf1f1ed, gloves: 0xd42632, trim: 0xd42632, phase: 0 });
      const boxerB = makeBoxer({ x: ringX + 1.15, skin: 0x4f2f22, shorts: 0x15171c, gloves: 0x1648d8, trim: 0xf0d447, phase: Math.PI });
      boxerA.group.rotation.y = Math.PI / 2;
      boxerB.group.rotation.y = -Math.PI / 2;
      boxerA.direction = 1;
      boxerB.direction = -1;
      z.animated.boxers = [boxerA, boxerB];
      z.animated.boxing = { lastImpactSlot: -1 };

      // News-station office: desks, glowing monitors, rolling chairs, no journalists.
      for (const [x, zz, headline] of [[-13.6, -6.9, 'BREAKING: ROUND 0'], [-13.6, -3.8, 'POSSESSION 50 / 50'], [-13.6, -0.7, 'ART REMAINS LIVE']]) {
        box(z, { w: 3.4, h: 0.78, d: 1.1, x, z: zz, material: mat(0xd7d9dc, { roughness: 0.38 }), name: 'kunstNewsDesk' });
        const screenMat = new THREE.MeshBasicMaterial({ map: textTexture(headline, { fg: '#f5f7ff', bg: '#102a66', size: 36, w: 768, h: 192 }), side: THREE.DoubleSide });
        plane(z, { w: 1.65, h: 0.72, x, y: 1.25, z: zz - 0.48, material: screenMat, ry: 0, noSplat: true, name: 'kunstMonitor' });
        cylinder(z, { rT: 0.25, rB: 0.25, h: 0.08, x: x + 1.2, z: zz + 1.0, material: mat(0x252932), solid: false });
      }

      // Football score wall. Nobody scores; the clock is emotionally stopped.
      plane(z, {
        w: 8.2, h: 2.0, x: 8.2, y: 4.7, z: -11.77,
        material: new THREE.MeshBasicMaterial({ map: textTexture('MAX PRO KUNST 2000     0  —  0     90:00 + ∞', { fg: '#f5f7ff', bg: '#092151', size: 42, w: 1400, h: 260, font: '800' }) }),
        noSplat: true, name: 'kunstScoreboard',
      });

      // Bright office fluorescents with just enough violet to imply the club downstairs.
      for (const x of [-13, -6, 1, 8, 15]) {
        const strip = box(z, { w: 4.6, h: 0.055, d: 0.24, x, y: h - 0.18, z: 2.2, material: new THREE.MeshBasicMaterial({ color: 0xffffff }), solid: false, noSplat: true });
        strip.userData.noSplat = true;
      }
      const ringWhite = new THREE.PointLight(0xffffff, 22, 15, 1.4);
      ringWhite.position.set(ringX, 6.8, ringZ); ringWhite.userData.base = 22; z.group.add(ringWhite);
      const clubViolet = new THREE.PointLight(0x6d28d9, 4.2, 13, 1.7);
      clubViolet.position.set(14, 2.1, 4.5); clubViolet.userData.base = 4.2; z.group.add(clubViolet);
      const clubBlue = new THREE.PointLight(0x175de5, 3.4, 12, 1.7);
      clubBlue.position.set(3, 2.0, 5.5); clubBlue.userData.base = 3.4; z.group.add(clubBlue);
      z.animated.strobes = [clubViolet, clubBlue];

      z.interactables.push({
        id: 'kunst-ring', type: 'flavor', label: 'Watch the office boxing broadcast',
        pos: new THREE.Vector3(ringX, 1.0, ringZ + 3.1), radius: 2.4,
        lines: [
          'White gloves? No. Red gloves. Blue gloves. White office. Black shorts. Nobody agrees what counts as away colors.',
          'The match is nil–nil after infinity minutes. Both boxers are winning on possession.',
          'They box in full gloves beneath newsroom lights. A bassline files the incident as quarterly performance.',
          'The referee is a spreadsheet. The spreadsheet has gone to the club.',
        ],
      });
      z.interactables.push({
        id: 'kunst-newsdesk', type: 'flavor', label: 'Approach the breaking-news desk',
        pos: new THREE.Vector3(-13.6, 1.0, -3.8), radius: 2.2,
        lines: [
          'BREAKING: nothing has happened. We now go live to the ring where it continues happening.',
          'The office has three desks, nine deadlines, and no employees. This improves morale.',
          'A monitor says ART REMAINS LIVE. Legal has asked it to be less specific.',
        ],
      });
    }

    // the skylight — no visible lamps, just one rectangle of expensive daylight
    plane(z, {
      w: 9, h: 4, x: 0, y: h - 0.03, z: -2, rx: Math.PI / 2,
      material: new THREE.MeshBasicMaterial({ color: 0xffffff }),
      noSplat: true, name: 'skylight',
    });

    /* ---- THE WORK — one ridiculously tiny painting, alone on the big wall ---- */
    {
      const tiny = new THREE.Group();
      tiny.position.set(0, P.y, P.z);
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(P.w + 0.03, P.h + 0.03, 0.02),
        mat(0xd8d4cc, { roughness: 0.4 })
      );
      frame.name = 'maxProPainting';
      const art = new THREE.Mesh(
        new THREE.PlaneGeometry(P.w, P.h),
        new THREE.MeshStandardMaterial({ map: tinyMasterpieceTexture(), roughness: 0.85 })
      );
      art.position.z = 0.012;
      art.userData.noSplat = true;
      art.name = 'maxProPainting';
      tiny.add(frame, art);
      z.group.add(tiny);
    }

    // the wildly sincere cucumber — duct-taped, framed, and professionally embarrassing
    {
      const cucumber = new THREE.Group();
      cucumber.position.set(-4.8, 1.82, -11.8);
      cucumber.rotation.y = 0.18;

      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 1.4, 0.04),
        mat(0x2b2118, { roughness: 0.5 })
      );
      frame.name = 'maxProCucumberFrame';

      const art = new THREE.Mesh(
        new THREE.PlaneGeometry(1.06, 1.26),
        new THREE.MeshStandardMaterial({
          map: ductTapedCucumberTexture(),
          roughness: 0.82,
        })
      );
      art.position.z = 0.024;
      art.userData.noSplat = true;
      art.name = 'maxProCucumberArt';

      const sold = new THREE.Mesh(
        new THREE.CircleGeometry(0.082, 18),
        new THREE.MeshBasicMaterial({ color: 0xc02a2a })
      );
      sold.position.set(0.38, -0.44, 0.045);
      sold.userData.noSplat = true;
      sold.name = 'maxProCucumberSoldDot';

      cucumber.add(frame, art, sold);
      z.group.add(cucumber);
    }

    // the tiny red sales dot — not a sale, a position
    {
      const dot = new THREE.Mesh(
        new THREE.CircleGeometry(0.012, 12),
        new THREE.MeshBasicMaterial({ color: 0xc02a2a })
      );
      dot.position.set(0.32, 1.56, -11.79);
      dot.userData.noSplat = true;
      dot.name = 'maxProRedDot';
      z.group.add(dot);
    }

    // the honest little wall label
    plane(z, {
      w: 0.4, h: 0.3, x: 0.66, y: 1.52, z: -11.79,
      material: new THREE.MeshBasicMaterial({ map: wallLabelTexture() }),
      noSplat: true, name: 'maxProLabel',
    });

    // the enormous exhibition label, fourteen times larger than the work
    plane(z, {
      w: 1.1, h: 1.55, x: 2.8, y: 1.75, z: -11.79,
      material: new THREE.MeshBasicMaterial({ map: bigLabelTexture() }),
      noSplat: true, name: 'maxProLabelBig',
    });

    // the bench — positioned at the exact distance of understanding
    box(z, { w: 2.2, h: 0.42, d: 0.55, x: -1.5, z: MAXPRO.benchZ, material: mat(0x1c1c22, { roughness: 0.5 }), name: 'maxProBench' });

    // the attendant's desk — huge, black, quietly judging
    box(z, { w: 3.4, h: 1.05, d: 0.9, x: -10, z: 8.6, material: mat(0x141419, { roughness: 0.3 }), name: 'maxProDesk' });

    // one champagne glass, abandoned mid-argument
    {
      const flute = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.02, 0.17, 8),
        new THREE.MeshStandardMaterial({ color: 0xd8d2c2, roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.55 })
      );
      flute.position.set(3.4, 0.035, 2.2);
      flute.rotation.z = Math.PI / 2 - 0.12;
      flute.userData.noSplat = true;
      flute.name = 'maxProGlass';
      z.group.add(flute);
    }

    // the catalogue — 200 pages about one tiny painting, open at the whereas
    {
      box(z, { w: 0.45, h: 0.95, d: 0.45, x: -4.5, z: -2.5, material: mat(0xf2f0ec, { roughness: 0.4 }), name: 'maxProPlinth' });
      const cat = new THREE.Group();
      cat.position.set(-4.5, 0.97, -2.5);
      const cover = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.035, 0.26), mat(0x1c1c22, { roughness: 0.5 }));
      cover.name = 'maxProCatalogue';
      const pageMat = new THREE.MeshStandardMaterial({ color: 0xf6f4ee, roughness: 0.9, side: THREE.DoubleSide });
      const pageL = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.22), pageMat);
      pageL.rotation.x = -Math.PI / 2; pageL.rotation.y = 0.14;
      pageL.position.set(-0.08, 0.035, 0);
      const pageR = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.22), pageMat);
      pageR.rotation.x = -Math.PI / 2; pageR.rotation.y = -0.14;
      pageR.position.set(0.08, 0.035, 0);
      pageL.userData.noSplat = pageR.userData.noSplat = true;
      cat.add(cover, pageL, pageR);
      cat.traverse((o) => { o.userData.noSplat = true; });
      z.group.add(cat);
    }

    // soft, sourceless daylight — the room hums with nothing
    z.group.add(new THREE.HemisphereLight(0xffffff, 0x9a968e, 1.15));
    const day = new THREE.DirectionalLight(0xfefdf8, 1.0);
    day.position.set(3, 8.5, 4);
    z.group.add(day);

    // the gallery name, discreet, near the entrance, in overly elegant type
    plane(z, {
      w: 2.4, h: 0.3, x: 2.9, y: 2.15, z: 11.96, ry: Math.PI,
      material: new THREE.MeshBasicMaterial({
        map: textTexture('M A X   P R O   K U N S T   2 0 0 0', { fg: '#817d76', size: 42, w: 1400, h: 128, font: '700' }),
        transparent: true,
      }),
      noSplat: true, name: 'maxProSign',
    });

    door(z, { x: 0, z: 12.12, ry: Math.PI, label: '← GALLERIA BIANCA', to: 'galleria' });

    /* ---- the debaters, arranged like an accusation ---- */
    z.anchors.promax1 = new THREE.Vector3(2.6, 0, -9.3);     // close to the work, optimizing
    z.anchors.promax2 = new THREE.Vector3(-5.2, 0, -3.4);    // mid-distance, near the catalogue
    z.anchors.promax3 = new THREE.Vector3(0.8, 0, 1.6);      // dead centre, arms folded
    z.anchors.post1 = new THREE.Vector3(20.3, 0, -2.0);      // leaning on the east wall
    z.anchors.post2 = new THREE.Vector3(-2.8, 0, 0.8);       // sitting on the floor
    z.anchors.post3 = new THREE.Vector3(3.2, 0, 10.6);       // absurdly far, seeing the scale
    z.anchors.attendant = new THREE.Vector3(-10, 0, 9.7);    // behind the huge desk
    // all of them face the painting (0, -11.78) — the attendant faces the room
    z.anchorYaws = {
      promax1: -2.33, promax2: 2.59, promax3: -3.08,
      post1: -2.02, post2: 2.92, post3: -3.0,
      attendant: Math.PI,
    };

    /* ---- things the player may inspect between opinions ---- */
    z.interactables.push({
      id: 'maxpro-painting', type: 'flavor', label: 'Inspect the tiny painting',
      pos: new THREE.Vector3(0, 1.4, -11.7), radius: 2.6,
      lines: [
        'It is eleven by eight centimetres. You counted. Everyone counts.',
        'Up close it is confident. From the bench it is a rumour. From the door it is a warranty card.',
        'The wall could hold four thousand of these. It holds one. That is the whole argument.',
        'Somewhere a museum is building a wing for this. The wing will also be mostly wall.',
        'You lean in. The painting does not. Respect.',
      ],
    });
    z.interactables.push({
      id: 'maxpro-labelbig', type: 'flavor', label: 'Read the exhibition label',
      pos: new THREE.Vector3(2.8, 1.6, -11.7), radius: 2.2,
      lines: [
        'The label is fourteen times larger than the work. This is described as “generous”.',
        'Paragraph six argues the painting is a building. Paragraph seven apologizes for paragraph six.',
        'It mentions the wall 212 times. It mentions the painting twice, once as a footnote.',
      ],
    });
    z.interactables.push({
      id: 'maxpro-catalogue', type: 'flavor', label: 'Open the catalogue',
      pos: new THREE.Vector3(-4.5, 1.0, -2.5), radius: 1.8,
      lines: [
        'Two hundred pages. One painting. Page 80 is the word “whereas” set in Caslon.',
        'The catalogue weighs more than the painting. So does the receipt.',
        'Chapter 12: “The Wall As Collaborator”. Chapter 13 is about the bench.',
      ],
    });
    z.interactables.push({
      id: 'maxpro-bench', type: 'flavor', label: 'Sit at the exact distance of understanding',
      pos: new THREE.Vector3(-1.5, 0.6, MAXPRO.benchZ), radius: 1.9,
      lines: [
        'You sit. The painting is out there somewhere, being important at a distance.',
        'From here the work is exactly as visible as the artist’s intentions.',
        'The bench is the optimal viewing position. The bench is also a comment on benches.',
      ],
    });
    z.interactables.push({
      id: 'maxpro-glass', type: 'flavor', label: 'Consider the abandoned champagne glass',
      pos: new THREE.Vector3(3.4, 0.2, 2.2), radius: 1.5,
      lines: [
        'A champagne glass, abandoned mid-argument. The argument continued without it.',
        'Someone toasted the scale of the room and walked off. The glass stayed to reflect.',
        'It is the second smallest artwork here. The debate rages on about the first.',
      ],
    });

    z.waypoints = [
      new THREE.Vector3(-6, 0, 4), new THREE.Vector3(6, 0, -4),
      new THREE.Vector3(0, 0, -6),
    ];
  }

  /* ---------------------------------------------------------- */
  /*  ZONE 7 — THE DILDO BALL                                   */
  /*                                                            */
  /*  The collector's other back room. A court of smooth,       */
  /*  proud, featureless heads wobbling under one disco ball,   */
  /*  presided over by His Majesty and a duck of uncertain      */
  /*  provenance. The heads do not judge. The heads cannot.     */
  /* ---------------------------------------------------------- */
  #buildDildoBall() {
    const z = this.#newZone('dildoBall');
    shell(z, { w: 16, d: 12, floorColor: 0x111a26, wallColor: 0x18283a, ceilColor: 0x0b1420 });
    z.spawn.set(-6.9, 0, 0);
    z.spawnYaw = -Math.PI / 2;         // face east, straight into the court
    z.fog = { color: 0x07131f, density: 0.02 };

    /* ---- the dance floor: dark gloss, ancient confetti ---- */
    plane(z, {
      w: 15.9, h: 11.9, x: 0, y: 0.011, z: 0, rx: -Math.PI / 2,
      material: new THREE.MeshPhysicalMaterial({
        color: 0x081522, roughness: 0.1, metalness: 0.38,
        clearcoat: 1, clearcoatRoughness: 0.035,
      }),
      noSplat: true, name: 'ice mirror dance floor',
    });

    /* ---- frozen render polish: bevel-like chrome ribs and impossible ice ---- */
    const chrome = new THREE.MeshPhysicalMaterial({
      color: 0xb9d8ef, roughness: 0.12, metalness: 0.92,
      clearcoat: 0.75, clearcoatRoughness: 0.05,
    });
    const ice = new THREE.MeshPhysicalMaterial({
      color: 0x9de4ff, roughness: 0.08, metalness: 0.02,
      transmission: 0.72, thickness: 0.9, ior: 1.31,
      transparent: true, opacity: 0.82,
      clearcoat: 1, clearcoatRoughness: 0.025,
    });
    for (const zz of [-5.82, 5.82]) {
      for (let i = 0; i < 7; i++) {
        box(z, {
          w: 0.045, h: 2.95, d: 0.08, x: -6.6 + i * 2.2, y: 0.25, z: zz,
          material: chrome, solid: false, noSplat: true, name: 'chrome wall rib',
        });
      }
    }
    const iceClusters = [];
    for (const [x, zz, scale, tilt] of [[-4.6, 4.2, 1.0, 0.22], [4.5, 4.1, 0.85, -0.2], [5.4, -1.2, 0.72, 0.32]]) {
      const cluster = new THREE.Group();
      cluster.position.set(x, 0, zz);
      cluster.rotation.y = tilt;
      for (let i = 0; i < 5; i++) {
        const shard = new THREE.Mesh(
          new THREE.ConeGeometry((0.13 + i * 0.025) * scale, (0.8 + i * 0.23) * scale, 5),
          ice
        );
        shard.position.set((i - 2) * 0.14 * scale, shard.geometry.parameters.height / 2, Math.sin(i * 2.1) * 0.11);
        shard.rotation.z = (i - 2) * 0.075;
        shard.castShadow = true;
        shard.userData.noSplat = true;
        cluster.add(shard);
      }
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.48 * scale, 0.025, 10, 36), chrome);
      halo.position.y = 0.66 * scale;
      halo.rotation.x = Math.PI / 2;
      halo.userData.noSplat = true;
      cluster.add(halo);
      z.group.add(cluster);
      iceClusters.push(cluster);
    }
    z.animated.iceClusters = iceClusters;
    const CONFETTI = [0xd98cff, 0xe8c15a, 0x7fb285, 0xc02a2a, 0x3b6ea5, 0xefe9dc];
    for (let i = 0; i < 42; i++) {
      const dot = new THREE.Mesh(
        new THREE.CircleGeometry(rand(0.012, 0.035), 8),
        new THREE.MeshBasicMaterial({ color: pick(CONFETTI) })
      );
      dot.rotation.x = -Math.PI / 2;
      dot.position.set(rand(-7.4, 7.4), 0.013 + i * 0.00004, rand(-5.4, 5.4));
      dot.userData.noSplat = true;
      z.group.add(dot);
    }

    /* ---- the throne of the Dildo King: a dais, a chair, a crown ---- */
    box(z, { w: 4.2, h: 0.24, d: 2.6, x: 0, z: -4.6, material: latexMat(0x120a16), name: 'the dais' });
    {
      const g = new THREE.Group();
      g.position.set(0, 0.24, -4.9);
      const seatMat = mat(0x6e1f3a, { roughness: 0.6 });
      const goldMat = mat(0xe8c15a, { metalness: 0.7, roughness: 0.25 });
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.1, 0.62), seatMat);
      seat.position.y = 0.5;
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.35, 0.08), seatMat);
      back.position.set(0, 1.14, -0.3);
      // the crown-back: five proud points, one of them slightly wrong
      for (let i = 0; i < 5; i++) {
        const spike = new THREE.Mesh(
          new THREE.ConeGeometry(0.055, i === 2 ? 0.34 : 0.24, 8),
          goldMat
        );
        spike.position.set(-0.28 + i * 0.14, 1.92 + (i === 2 ? 0.05 : 0), -0.3);
        if (i === 3) spike.rotation.z = -0.22;   // the bent one. it has seen things.
        g.add(spike);
      }
      g.add(seat, back);
      g.traverse((o) => { o.userData.noSplat = true; });
      z.group.add(g);
      z.colliders.push({ minX: -0.5, maxX: 0.5, minZ: -5.3, maxZ: -4.5 });
    }

    /* ---- the disco ball: the only crown that matters tonight ---- */
    {
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 6), mat(0x3a3a44, { metalness: 0.7, roughness: 0.3 }));
      chain.position.set(0, 3.35, -0.4);
      chain.userData.noSplat = true;
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.34, 20, 14),
        new THREE.MeshStandardMaterial({ color: 0xd8d8e0, metalness: 0.95, roughness: 0.12 })
      );
      ball.position.set(0, 3.0, -0.4);
      ball.userData.noSplat = true;
      z.group.add(chain, ball);
      z.animated.glows.push(ball);       // she spins up on the kick
      const ballLight = new THREE.PointLight(0xe8e8ff, 7, 13, 1.8);
      ballLight.position.set(0, 2.6, -0.4);
      ballLight.userData.base = 7;
      z.group.add(ballLight);
    }

    /* ---- the strobe court: violet leads, blue answers, pink presides ---- */
    const pink = new THREE.PointLight(0xd946a8, 6.5, 10, 1.6);
    pink.position.set(-5.6, 2.0, -3.6); pink.userData.base = 6.5; z.group.add(pink);
    const violet = new THREE.PointLight(0x6b36a8, 4.6, 11, 1.7);
    violet.position.set(4.8, 2.2, 3.2); violet.userData.base = 4.6; z.group.add(violet);
    const blue = new THREE.PointLight(0x263b8f, 3.6, 10, 1.8);
    blue.position.set(5.8, 2.3, -3.4); blue.userData.base = 3.6; z.group.add(blue);
    const gold = new THREE.PointLight(0xe8c15a, 4.2, 8, 1.9);
    gold.position.set(0, 2.0, -4.6); gold.userData.base = 4.2; z.group.add(gold);   // the throne glows, regally
    z.animated.strobes = [pink, violet, blue, gold];
    // the house lights came up a touch — the court likes to see itself
    z.group.add(new THREE.HemisphereLight(0x5a3a58, 0x14101c, 0.95));
    // a warm chandelier glow over the dance floor, steady through the strobes
    const chandelier = new THREE.PointLight(0xffd9a0, 3.4, 12, 1.7);
    chandelier.position.set(0, 3.1, 0.8);
    chandelier.userData.base = 3.4;
    z.group.add(chandelier);
    z.animated.candles.push(chandelier);

    // A cold cinematic key creates actual soft-edged form and contact shadow,
    // while the colored practicals remain the court's animated fill lights.
    const iceKey = new THREE.SpotLight(0xb9ecff, 34, 18, Math.PI * 0.28, 0.72, 1.35);
    iceKey.position.set(-4.8, 3.35, 4.6);
    iceKey.target.position.set(0, 0.7, -0.8);
    iceKey.castShadow = true;
    iceKey.shadow.mapSize.set(1024, 1024);
    iceKey.shadow.bias = -0.00035;
    z.group.add(iceKey, iceKey.target);
    const rim = new THREE.SpotLight(0x5a78ff, 22, 16, Math.PI * 0.24, 0.8, 1.5);
    rim.position.set(5.8, 3.1, 4.6);
    rim.target.position.set(0, 1.0, -3.6);
    z.group.add(rim, rim.target);

    /* ---- the royal bar: an ice bucket, bottles, one abandoned crown ---- */
    box(z, { w: 2.6, h: 1.0, d: 0.7, x: -6.9, z: 2.6, material: mat(0x14101a, { roughness: 0.35 }), name: 'royal bar' });
    for (let i = 0; i < 4; i++) {
      cylinder(z, {
        rT: 0.03, rB: 0.04, h: rand(0.2, 0.3), x: -7.3 + i * 0.28, y: 1.0, z: 2.6 + rand(-0.12, 0.12),
        material: mat(pick([0x1a3a1e, 0x6e1f3a, 0x2b3a67]), { roughness: 0.2, metalness: 0.3 }), solid: false,
      });
    }
    {   // a second crown, in the ice bucket, on ice. succession is a party game.
      const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.24, 12), mat(0x8a8a92, { metalness: 0.8, roughness: 0.25 }));
      bucket.position.set(-6.4, 1.12, 2.9);
      bucket.userData.noSplat = true;
      const spare = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.08, 10), mat(0xe8c15a, { metalness: 0.7, roughness: 0.25 }));
      spare.position.set(-6.4, 1.22, 2.9);
      spare.rotation.z = 0.4;
      spare.userData.noSplat = true;
      z.group.add(bucket, spare);
    }

    /* ---- the royal television: a CRT in the corner, broadcasting the
     *  kingdom's only channel. The film is adult. The blur is royal.
     *  The court watches respectfully, the way one watches a fireplace. ---- */
    {
      const tv = new THREE.Group();
      tv.position.set(6.9, 0, 4.6);
      tv.rotation.y = -Math.PI * 0.78;          // angled into the room, toward the court
      // the cabinet: faux-wood veneer, slightly too proud of itself
      const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.78, 0.62), mat(0x3a2418, { roughness: 0.55 }));
      cabinet.position.y = 0.85;
      // the screen bezel
      const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.62, 0.04), mat(0x14100c, { roughness: 0.4 }));
      bezel.position.set(0, 0.85, 0.32);
      // the screen itself — a live canvas of heavily blurred cinema
      const { canvas: pornCanvas, blobs } = pornScreenTexture();
      const pornTex = new THREE.CanvasTexture(pornCanvas);
      pornTex.colorSpace = THREE.SRGBColorSpace;
      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(0.84, 0.54),
        new THREE.MeshBasicMaterial({ map: pornTex })
      );
      screen.position.set(0, 0.85, 0.345);
      screen.userData.noSplat = true;
      screen.name = 'royalTV';
      // the glow the film throws on the court — warm, pinkish, unbothered
      const tvGlow = new THREE.PointLight(0xd98ca8, 2.6, 5.5, 1.9);
      tvGlow.position.set(0, 0.9, 0.9);
      tvGlow.userData.base = 2.6;
      // little antenna ears, because even royalty receives a signal
      const antMat = mat(0x8a8a92, { metalness: 0.8, roughness: 0.3 });
      const antL = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 6), antMat);
      antL.position.set(-0.18, 1.42, 0); antL.rotation.z = 0.5;
      const antR = antL.clone(); antR.position.x = 0.18; antR.rotation.z = -0.5;
      tv.add(cabinet, bezel, screen, tvGlow, antL, antR);
      tv.traverse((o) => { o.userData.noSplat = true; });
      z.group.add(tv);
      z.colliders.push({ minX: 6.3, maxX: 7.5, minZ: 4.1, maxZ: 5.1 });
      z.animated.tv = { canvas: pornCanvas, ctx: pornCanvas.getContext('2d'), tex: pornTex, blobs, glow: tvGlow, t: 0 };
      z.interactables.push({
        id: 'dildoball-tv', type: 'flavor', label: 'Watch the royal broadcast',
        pos: new THREE.Vector3(6.9, 0.9, 4.6), radius: 2.0,
        lines: [
          'The film is extremely adult and extremely blurred. The censorship division works in smears.',
          'Two figures, or possibly three, move with the confidence of people who cannot be identified.',
          'The King insists it is a documentary about the human condition. The condition appears to be horizontal.',
          'The duck is watching. The duck has seen the director’s cut. The duck does not blink.',
        ],
      });
    }

    /* ---- the royal menagerie: a cow, because every court needs one ---- */
    {
      const cow = new THREE.Group();
      cow.position.set(-5.2, 0, -3.4);
      cow.rotation.y = 0.4;
      const hide = mat(0xe8e0cc, { roughness: 0.9 });
      const spot = mat(0x2a1c14, { roughness: 0.9 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.72, 0.62), hide);
      body.position.y = 0.72;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.38), hide);
      head.position.set(0, 1.28, 0.42);
      const snout = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.12), mat(0xd9a8a0, { roughness: 0.8 }));
      snout.position.set(0, 1.18, 0.62);
      // the spots: irregular, proud, slightly wrong
      for (const [sx, sy, sz, sw, sh] of [[-0.3, 0.8, 0.32, 0.28, 0.22], [0.25, 0.65, -0.28, 0.32, 0.26], [0.1, 0.95, 0.3, 0.2, 0.18]]) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, 0.02), spot);
        s.position.set(sx, sy, sz);
        s.rotation.y = sz > 0 ? 0 : Math.PI;
        cow.add(s);
      }
      // horns: small, apologetic
      const hornMat = mat(0xd8d2c2, { roughness: 0.4 });
      const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.18, 8), hornMat);
      hornL.position.set(-0.14, 1.52, 0.42); hornL.rotation.z = 0.3;
      const hornR = hornL.clone(); hornR.position.x = 0.14; hornR.rotation.z = -0.3;
      // ears: alert, listening to the jazz
      const earL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.1), hide);
      earL.position.set(-0.24, 1.38, 0.42); earL.rotation.z = 0.4;
      const earR = earL.clone(); earR.position.x = 0.24; earR.rotation.z = -0.4;
      // legs: four sturdy columns of beef
      for (const [lx, lz] of [[-0.4, 0.22], [0.4, 0.22], [-0.4, -0.22], [0.4, -0.22]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.72, 0.14), hide);
        leg.position.set(lx, 0.36, lz);
        cow.add(leg);
      }
      // tail: a rope with a opinion
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.5, 6), hide);
      tail.position.set(0, 0.95, -0.34); tail.rotation.x = 0.3;
      const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), spot);
      tailTip.position.set(0, 0.68, -0.42);
      cow.add(body, head, snout, hornL, hornR, earL, earR, tail, tailTip);
      cow.traverse((o) => { o.userData.noSplat = true; });
      z.group.add(cow);
      z.anchors.cow = new THREE.Vector3(-5.2, 0, -3.4);
      z.colliders.push({ minX: -5.9, maxX: -4.5, minZ: -4.0, maxZ: -2.8 });
      z.interactables.push({
        id: 'dildoball-cow', type: 'flavor', label: 'Address the cow',
        pos: new THREE.Vector3(-5.2, 1.0, -3.4), radius: 1.8,
        lines: [
          'The cow is wearing a tiny crown. The cow does not explain. The cow does not have to.',
          'It regards the disco ball with the calm of an animal that has never paid rent.',
          'The King insists the cow is a "moo-saenger". The court pretends this is a word.',
          'Somewhere, a field is missing its most diplomatic resident.',
          '"Moo," says the cow. It lands like a verdict. The court nods gravely.',
          '"Moo moo." — the cow, declining to elaborate.',
          'The cow says "moooo". Somewhere, a critic feels seen.',
          '"Moo?" The cow has heard your question and is considering it. Forever.',
        ],
      });
    }

    /* ---- the neon declaration: I AM ART, standing in the corner ---- */
    {
      const neon = new THREE.Group();
      neon.position.set(6.8, 0, -4.8);
      neon.rotation.y = -Math.PI * 0.72;
      // the pole: a slender chrome spine
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 2.4, 8), mat(0x8a8a92, { metalness: 0.85, roughness: 0.2 }));
      pole.position.y = 1.2;
      // the base: a heavy little plinth of self-regard
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.08, 12), mat(0x14101a, { roughness: 0.3 }));
      base.position.y = 0.04;
      // the letters: hot pink neon, slightly buzzing, completely certain
      const neonMat = new THREE.MeshBasicMaterial({ color: 0xff2d95 });
      const letters = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 0.4),
        new THREE.MeshBasicMaterial({
          map: textTexture('I AM ART', { fg: '#ff2d95', size: 72, w: 512, h: 128, font: '700' }),
          transparent: true,
        })
      );
      letters.position.set(0, 2.2, 0.02);
      letters.userData.noSplat = true;
      letters.name = 'neonSign';
      // the glow: pink, insistent, slightly too close
      const neonGlow = new THREE.PointLight(0xff2d95, 3.2, 6, 1.8);
      neonGlow.position.set(0, 2.2, 0.4);
      neonGlow.userData.base = 3.2;
      neon.add(pole, base, letters, neonGlow);
      neon.traverse((o) => { o.userData.noSplat = true; });
      z.group.add(neon);
      z.colliders.push({ minX: 6.4, maxX: 7.2, minZ: -5.2, maxZ: -4.4 });
      z.animated.neon = { mat: letters.material, glow: neonGlow, base: 3.2 };
      z.interactables.push({
        id: 'dildoball-neon', type: 'flavor', label: 'Read the neon declaration',
        pos: new THREE.Vector3(6.8, 1.4, -4.8), radius: 1.8,
        lines: [
          'I AM ART. The letters are pink, buzzing, and legally binding in this room.',
          'The sign was a gift. The sign is a threat. The sign is a little warm to the touch.',
          'The King had it installed after the incident with the performance piece. No one asks about the performance piece.',
          'It flickers once, as if winking. You pretend not to notice. The sign knows you noticed.',
        ],
      });
    }

    /* ---- flavor ---- */


    z.interactables.push({
      id: 'dildoball-throne', type: 'flavor', label: 'Approach the throne respectfully',
      pos: new THREE.Vector3(0, 0.9, -4.6), radius: 2.4,
      lines: [
        'The throne is a bar stool with a crown on it. Nobody here cares. That is what makes it a throne.',
        'The bent spike on the crown-back predates the monarchy. It is the kingdom’s oldest subject.',
        'You bow slightly. The dais accepts. Somewhere a court photographer does not capture it.',
      ],
    });
    z.interactables.push({
      id: 'dildoball-bar', type: 'flavor', label: 'Survey the royal bar',
      pos: new THREE.Vector3(-6.9, 1.0, 2.6), radius: 1.9,
      lines: [
        'The spare crown sits in the ice bucket, chilling. Succession is a party game here.',
        'The punch has a small crown floating in it. Do not ask the punch questions.',
        'Every bottle is open. Every bottle is ceremonial. The ceremony is ongoing.',
      ],
    });
    z.interactables.push({
      id: 'dildoball-ball', type: 'flavor', label: 'Gaze up at the disco ball',
      pos: new THREE.Vector3(0, 1.6, -0.4), radius: 2.6,
      lines: [
        'The disco ball turns like a conscience, if a conscience were chrome and had excellent timing.',
        'Every coronation needs one. History forgot this. The King did not.',
        'It reflects everyone in the room at once, which is more than the art world has ever managed.',
      ],
    });
    // the missing crown — a bizarre little mission, hidden in the royal bar
    z.interactables.push({
      id: 'dildoball-crown', type: 'crownQuest', label: 'Notice something behind the bar',
      pos: new THREE.Vector3(-6.9, 1.0, 2.6), radius: 2.1,
    });


    door(z, { x: -7.8, z: 0, ry: Math.PI / 2, label: '← THE BACK ROOM', to: 'leatherLatex' });

    /* ---- the court ---- */
    z.anchors.dildoKing = new THREE.Vector3(0, 0.24, -4.35);   // on the dais, holding court
    z.anchors.duck = new THREE.Vector3(-6.5, 0, 3.5);          // near the bar, near the truth
    z.anchors.gimp = new THREE.Vector3(5.2, 0, -3.2);          // near the neon, near the void
    z.anchorYaws = { dildoKing: 0, duck: Math.PI / 2, gimp: -Math.PI / 2 };  // the King faces his people; the duck faces the room; the gimp faces the wall


    z.waypoints = [
      new THREE.Vector3(-4, 0, -2.5), new THREE.Vector3(-1.5, 0, 0.5),
      new THREE.Vector3(2.5, 0, -1.5), new THREE.Vector3(4.5, 0, 2.5),
      new THREE.Vector3(-4.5, 0, 3.5), new THREE.Vector3(1, 0, 4.2),
      new THREE.Vector3(5.5, 0, -3.5), new THREE.Vector3(-2.5, 0, -3.8),
    ];

    z.group.traverse((o) => {
      if (!o.isMesh) return;
      o.receiveShadow = o.name === 'ice mirror dance floor' || o.name === 'the dais';
      if (o.geometry?.type === 'CapsuleGeometry' || o.geometry?.type === 'SphereGeometry') o.castShadow = true;
    });
  }

  /* ---------------------------------------------------------- */
  /*  ZONE 8 — THE DAYLIGHT FLESH GARDEN                        */
  /* ---------------------------------------------------------- */
  #buildDaylightClub() {
    const z = this.#newZone('daylightClub');
    shell(z, { w: 18, d: 13, floorColor: 0x536348, wallColor: 0xd8ccb7, ceilColor: 0xdce9df });
    z.spawn.set(-7.7, 0, 0);
    z.spawnYaw = -Math.PI / 2;
    z.fog = { color: 0xc7d8ca, density: 0.012 };

    // A mossy floor beneath a bright, overconfident conservatory roof. The
    // local Poly Haven maps arrive asynchronously; these colors remain useful
    // fallbacks if an asset is missing or the browser declines the request.
    const textureLoader = new THREE.TextureLoader();
    const applyGardenMap = (material, slot, url, repeat, srgb = false, tint = 0xffffff) => {
      textureLoader.load(encodeURI(url), (tex) => {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(repeat[0], repeat[1]);
        tex.anisotropy = 4;
        if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
        material[slot] = tex;
        if (slot === 'map') material.color.set(tint);
        material.needsUpdate = true;
      });
    };
    const mossMaterial = mat(0x40563a, { roughness: 0.96 });
    const mossRoot = 'puplic/polyhaven/daylight-garden/forest_ground_04';
    applyGardenMap(mossMaterial, 'map', `${mossRoot}/forest_ground_04_diff_1k.jpg`, [4.5, 3.25], true, 0x91a982);
    applyGardenMap(mossMaterial, 'normalMap', `${mossRoot}/forest_ground_04_nor_gl_1k.jpg`, [4.5, 3.25]);
    applyGardenMap(mossMaterial, 'roughnessMap', `${mossRoot}/forest_ground_04_rough_1k.jpg`, [4.5, 3.25]);
    plane(z, {
      w: 17.9, h: 12.9, x: 0, y: 0.012, z: 0, rx: -Math.PI / 2,
      material: mossMaterial,
      noSplat: true, name: 'daylight moss floor',
    });

    const plasterMaterial = mat(0xd8ccb7, { roughness: 0.94 });
    const plasterRoot = 'puplic/polyhaven/daylight-garden/painted_plaster_wall';
    applyGardenMap(plasterMaterial, 'map', `${plasterRoot}/painted_plaster_wall_diff_1k.jpg`, [3.8, 1.15], true);
    applyGardenMap(plasterMaterial, 'normalMap', `${plasterRoot}/painted_plaster_wall_nor_gl_1k.jpg`, [3.8, 1.15]);
    applyGardenMap(plasterMaterial, 'roughnessMap', `${plasterRoot}/painted_plaster_wall_rough_1k.jpg`, [3.8, 1.15]);
    plane(z, {
      w: 17.7, h: 3.42, x: 0, y: 1.79, z: -6.485,
      material: plasterMaterial, noSplat: false, name: 'daylight painted plaster wall',
    });
    plane(z, {
      w: 12, h: 5.2, x: 1.2, y: 3.56, z: 0, rx: Math.PI / 2,
      material: new THREE.MeshBasicMaterial({ color: 0xeaf7ee, transparent: true, opacity: 0.72, side: THREE.DoubleSide }),
      noSplat: true, name: 'daylight skylight',
    });

    const gardenLife = { unicorns: [], flowers: [], rainbowMaterials: [], orbs: [] };
    z.animated.daylightGarden = gardenLife;

    // The room's thesis statement: a wide rainbow, authored as geometry rather
    // than imported spectacle, so it remains proudly theatrical and strange.
    const rainbow = new THREE.Group();
    rainbow.position.set(1.5, 0.18, -6.22);
    rainbow.scale.x = 1.46;
    const rainbowColors = [0xff315f, 0xff8c24, 0xffdb3d, 0x44dd72, 0x39bfff, 0x7665ff, 0xd34cff];
    for (let i = 0; i < rainbowColors.length; i++) {
      const color = rainbowColors[i];
      const rainbowMat = new THREE.MeshStandardMaterial({
        color, emissive: color, emissiveIntensity: 0.28,
        roughness: 0.34, metalness: 0.08,
      });
      const arc = new THREE.Mesh(new THREE.TorusGeometry(2.43 - i * 0.25, 0.135, 10, 72, Math.PI), rainbowMat);
      arc.userData.noSplat = true;
      arc.castShadow = true;
      rainbow.add(arc);
      gardenLife.rainbowMaterials.push(rainbowMat);
    }
    z.group.add(rainbow);

    const unicornMaterials = {
      pearl: new THREE.MeshPhysicalMaterial({
        color: 0xfff4fb, roughness: 0.3, metalness: 0.04,
        clearcoat: 0.65, clearcoatRoughness: 0.12,
      }),
      hoof: mat(0x7b4fa0, { roughness: 0.36, metalness: 0.22 }),
      eye: new THREE.MeshBasicMaterial({ color: 0x22142f }),
      horn: new THREE.MeshStandardMaterial({
        color: 0xffe985, emissive: 0xffb62e, emissiveIntensity: 0.8,
        roughness: 0.22, metalness: 0.55,
      }),
      mane: [0xff4fa3, 0xffc83d, 0x45dcff, 0x8b5cff].map((color) => mat(color, { roughness: 0.42 })),
    };
    const buildUnicorn = ({ x, y = 0, zz, scale = 1, ry = 0, collider = true, phase = 0 }) => {
      const g = new THREE.Group();
      g.position.set(x, y, zz);
      g.rotation.y = ry;
      g.scale.setScalar(scale);

      const body = new THREE.Mesh(new THREE.SphereGeometry(0.52, 16, 12), unicornMaterials.pearl);
      body.position.y = 0.82; body.scale.set(1.52, 0.7, 0.72);
      const chest = new THREE.Mesh(new THREE.SphereGeometry(0.33, 14, 10), unicornMaterials.pearl);
      chest.position.set(0.48, 1.02, 0); chest.scale.set(0.78, 1.25, 0.78);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.23, 0.78, 10), unicornMaterials.pearl);
      neck.position.set(0.53, 1.34, 0); neck.rotation.z = -0.3;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), unicornMaterials.pearl);
      head.position.set(0.73, 1.73, 0); head.scale.set(1.18, 0.82, 0.82);
      const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 8), unicornMaterials.pearl);
      muzzle.position.set(0.99, 1.64, 0); muzzle.scale.set(1.2, 0.68, 0.72);
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.55, 12), unicornMaterials.horn);
      horn.position.set(0.73, 2.16, 0); horn.rotation.z = -0.2;
      g.add(body, chest, neck, head, muzzle, horn);

      for (const side of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 8), unicornMaterials.pearl);
        ear.position.set(0.57, 1.99, side * 0.17);
        ear.rotation.z = side * 0.08;
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 6), unicornMaterials.eye);
        eye.position.set(0.92, 1.79, side * 0.245);
        eye.scale.set(1, 1, 0.48);
        g.add(ear, eye);
      }
      for (const [lx, lz] of [[-0.43, -0.22], [-0.43, 0.22], [0.38, -0.22], [0.38, 0.22]]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.72, 8), unicornMaterials.pearl);
        leg.position.set(lx, 0.4, lz);
        const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.105, 0.12, 8), unicornMaterials.hoof);
        hoof.position.set(lx, 0.06, lz);
        g.add(leg, hoof);
      }
      const maneSegments = [];
      for (let i = 0; i < 6; i++) {
        const mane = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), unicornMaterials.mane[i % unicornMaterials.mane.length]);
        mane.position.set(0.37 - i * 0.12, 1.82 - i * 0.16, 0);
        mane.scale.set(0.62, 1.12, 1.2);
        g.add(mane); maneSegments.push(mane);
      }
      const tail = new THREE.Group();
      tail.position.set(-0.78, 0.93, 0);
      for (let i = 0; i < 4; i++) {
        const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), unicornMaterials.mane[(i + 1) % unicornMaterials.mane.length]);
        tuft.position.set(-i * 0.15, -i * 0.1, Math.sin(i * 1.8) * 0.06);
        tuft.scale.set(1.25, 0.75, 0.8);
        tail.add(tuft);
      }
      g.add(tail);
      g.traverse((o) => { o.userData.noSplat = true; if (o.isMesh) o.castShadow = true; });
      z.group.add(g);
      gardenLife.unicorns.push({ group: g, tail, maneSegments, baseY: y, phase });
      if (collider) {
        z.colliders.push({ minX: x - 0.82 * scale, maxX: x + 0.82 * scale, minZ: zz - 0.48 * scale, maxZ: zz + 0.48 * scale });
      }
      return g;
    };

    buildUnicorn({ x: -5.6, zz: -3.25, scale: 0.92, ry: -0.3, phase: 0.2 });
    buildUnicorn({ x: 4.65, zz: 4.45, scale: 0.82, ry: Math.PI * 0.72, phase: 2.1 });
    // This one has climbed onto the rainbow and now refuses curatorial help.
    buildUnicorn({ x: 1.5, y: 2.48, zz: -5.92, scale: 0.47, ry: Math.PI * 0.08, collider: false, phase: 4.2 });

    // Saturated flora, glow fruit and translucent ribbons keep the imported
    // ground texture from pulling the room toward realism.
    const stemMat = mat(0x2e8f59, { roughness: 0.82 });
    const flowerColors = [0xff3c8e, 0xffd43b, 0x46d9ff, 0x9f55ff, 0xff653d];
    const flowerSpots = [[-7, -4.5], [-4.3, 4.8], [-1.1, -4.7], [1.9, 4.8], [3.8, -4.5], [7.2, 3.2], [7.2, -1.5], [-1.1, 2.1], [3.1, 2.6]];
    for (let i = 0; i < flowerSpots.length; i++) {
      const [x, zz] = flowerSpots[i];
      const flower = new THREE.Group();
      flower.position.set(x, 0, zz);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.62, 7), stemMat);
      stem.position.y = 0.31;
      const center = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), mat(0xffa82e, { roughness: 0.5 }));
      center.position.y = 0.67;
      flower.add(stem, center);
      const petalMat = mat(flowerColors[i % flowerColors.length], { roughness: 0.46 });
      for (let p = 0; p < 5; p++) {
        const a = p / 5 * Math.PI * 2;
        const petal = new THREE.Mesh(new THREE.SphereGeometry(0.11, 9, 7), petalMat);
        petal.position.set(Math.cos(a) * 0.14, 0.67 + Math.sin(a) * 0.14, 0);
        petal.scale.set(1.25, 0.72, 0.42);
        petal.rotation.z = a;
        flower.add(petal);
      }
      flower.traverse((o) => { o.userData.noSplat = true; });
      z.group.add(flower);
      gardenLife.flowers.push({ group: flower, phase: i * 0.71 });
    }
    for (let i = 0; i < 8; i++) {
      const a = i * 2.17;
      const x = Math.sin(a) * 7.2;
      const zz = Math.cos(a * 1.31) * 5.1;
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.08, 0.28, 8), mat(0xffe8c9));
      stalk.position.set(x, 0.14, zz);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), mat(flowerColors[i % flowerColors.length], { roughness: 0.5 }));
      cap.position.set(x, 0.34, zz); cap.scale.y = 0.48;
      stalk.userData.noSplat = cap.userData.noSplat = true;
      z.group.add(stalk, cap);
    }
    for (let i = 0; i < 7; i++) {
      const color = flowerColors[i % flowerColors.length];
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.08 + (i % 2) * 0.025, 10, 8),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.4, roughness: 0.2 })
      );
      orb.position.set(-6.4 + i * 2.05, 1.0 + (i % 3) * 0.55, -5.65 + (i % 2) * 0.2);
      orb.userData.noSplat = true;
      z.group.add(orb);
      gardenLife.orbs.push({ mesh: orb, baseY: orb.position.y, phase: i * 0.9 });
    }
    for (const [x, color, tilt] of [[-3.5, 0xff4fa3, -0.18], [0.2, 0x45dcff, 0.12], [5.7, 0xffd43b, -0.1]]) {
      const ribbon = new THREE.Mesh(
        new THREE.PlaneGeometry(1.8, 0.28, 5, 1),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.48, side: THREE.DoubleSide, depthWrite: false })
      );
      ribbon.position.set(x, 2.85, 5.92);
      ribbon.rotation.set(0.08, Math.PI, tilt);
      ribbon.userData.noSplat = true;
      z.group.add(ribbon);
    }

    const chrome = mat(0xd7dde0, { metalness: 0.92, roughness: 0.12 });
    for (const [x, zz] of [[-2.6, -2.4], [1.2, 0], [5.0, 2.4]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 3.25, 16), chrome);
      pole.position.set(x, 1.625, zz);
      pole.userData.noSplat = true;
      pole.name = 'daylight chrome pole';
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.08, 24), chrome);
      base.position.set(x, 0.04, zz);
      base.userData.noSplat = true;
      z.group.add(pole, base);
      z.colliders.push({ minX: x - 0.34, maxX: x + 0.34, minZ: zz - 0.34, maxZ: zz + 0.34 });
    }

    // Glam flesh-garden regulars: complete faces, impossible wigs and heavy cartoon boots.
    const skin = [0xd7a07e, 0x9b624b, 0x6b3f31, 0xe3b89b];
    const wigs = [0xff5aa5, 0x65d9e8, 0xf4c542, 0x9a63ff];
    const outfits = [0x6c173f, 0x123d45, 0x8f342c, 0x35205f];
    for (const [i, x, zz, scale] of [[0, -3.4, -1.7, 1.0], [1, 0.4, 0.7, 1.2], [2, 4.2, 1.7, 0.92], [3, 5.8, -2.8, 1.08]]) {
      const figure = new THREE.Group();
      figure.position.set(x, 0, zz);
      figure.rotation.y = [0.35, -0.65, 0.8, -1.15][i];

      const skinMat = mat(skin[i], { roughness: 0.72 });
      const outfitMat = mat(outfits[i], { roughness: 0.42, metalness: 0.12 });
      const wigMat = mat(wigs[i], { roughness: 0.48 });
      const bootMat = mat(i % 2 ? 0xf0e650 : 0x17131d, { roughness: 0.3, metalness: 0.35 });
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 20, 14),
        outfitMat
      );
      body.position.set(0, 1.12 * scale, 0);
      body.scale.set(0.82 * scale, 1.25 * scale, 0.72 * scale);
      body.name = 'daylight figure';

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.29 * scale, 18, 14), skinMat);
      head.position.set(0, 1.92 * scale, 0.01);
      head.scale.set(0.9, 1.08, 0.86);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.055 * scale, 0.14 * scale, 10), skinMat);
      nose.position.set(0, 1.92 * scale, -0.275 * scale);
      nose.rotation.x = -Math.PI / 2;
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xf7fbff });
      const pupilMat = new THREE.MeshBasicMaterial({ color: 0x17131d });
      for (const sx of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06 * scale, 10, 8), eyeMat);
        eye.position.set(sx * 0.105 * scale, 2.01 * scale, -0.235 * scale);
        eye.scale.set(1, 1.25, 0.38);
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.024 * scale, 8, 6), pupilMat);
        pupil.position.set(sx * 0.105 * scale, 2.01 * scale, -0.287 * scale);
        figure.add(eye, pupil);
      }
      const mouth = new THREE.Mesh(
        new THREE.TorusGeometry(0.08 * scale, 0.018 * scale, 6, 14, Math.PI),
        new THREE.MeshBasicMaterial({ color: i % 2 ? 0x4a1420 : 0xd51f52 })
      );
      mouth.position.set(0, 1.81 * scale, -0.27 * scale);
      mouth.rotation.z = Math.PI;

      // Tiered bouffant wig with side curls: big readable silhouette from across the room.
      const wigCap = new THREE.Mesh(new THREE.SphereGeometry(0.34 * scale, 16, 12), wigMat);
      wigCap.position.set(0, 2.18 * scale, 0.03);
      wigCap.scale.set(1.12, 0.72, 1.02);
      const wigTop = new THREE.Mesh(new THREE.SphereGeometry(0.24 * scale, 14, 10), wigMat);
      wigTop.position.set(0, 2.47 * scale, 0.04);
      wigTop.scale.set(0.9, 1.35, 0.82);
      figure.add(body, head, nose, mouth, wigCap, wigTop);
      for (const sx of [-1, 1]) {
        const curl = new THREE.Mesh(new THREE.TorusGeometry(0.12 * scale, 0.055 * scale, 7, 12), wigMat);
        curl.position.set(sx * 0.27 * scale, 2.15 * scale, 0);
        curl.rotation.y = Math.PI / 2;
        figure.add(curl);

        const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.105 * scale, 0.48 * scale, 5, 8), outfitMat);
        leg.position.set(sx * 0.23 * scale, 0.52 * scale, 0);
        const boot = new THREE.Mesh(new THREE.BoxGeometry(0.3 * scale, 0.34 * scale, 0.48 * scale), bootMat);
        boot.position.set(sx * 0.23 * scale, 0.18 * scale, -0.09 * scale);
        boot.rotation.z = sx * 0.05;
        const sole = new THREE.Mesh(new THREE.BoxGeometry(0.35 * scale, 0.09 * scale, 0.57 * scale), chrome);
        sole.position.set(sx * 0.23 * scale, 0.035 * scale, -0.1 * scale);
        const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.075 * scale, 0.48 * scale, 5, 8), skinMat);
        arm.position.set(sx * 0.58 * scale, 1.25 * scale, 0);
        arm.rotation.z = sx * (0.48 + i * 0.1);
        figure.add(leg, boot, sole, arm);
      }
      const belt = new THREE.Mesh(new THREE.TorusGeometry(0.39 * scale, 0.045 * scale, 7, 18), chrome);
      belt.position.set(0, 1.06 * scale, 0);
      belt.rotation.x = Math.PI / 2;
      figure.add(belt);
      figure.traverse((o) => { o.userData.noSplat = true; if (o.isMesh) o.castShadow = true; });
      z.group.add(figure);
      const bodyRadius = 0.42 * scale;
      z.colliders.push({
        minX: x - bodyRadius, maxX: x + bodyRadius,
        minZ: zz - bodyRadius, maxZ: zz + bodyRadius,
      });
    }

    // The animals have no guest list and considerably better boundaries.
    for (const [x, zz, ry] of [[-5.6, 3.7, 0.5], [6.4, -3.8, -0.8]]) {
      const deer = new THREE.Group();
      deer.position.set(x, 0, zz);
      deer.rotation.y = ry;
      const hide = mat(0x9a6b45, { roughness: 0.9 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), hide);
      body.position.y = 0.78; body.scale.set(1.35, 0.72, 0.68);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.72, 10), hide);
      neck.position.set(0.42, 1.18, 0); neck.rotation.z = -0.32;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), hide);
      head.position.set(0.58, 1.55, 0); head.scale.set(1.1, 0.72, 0.72);
      deer.add(body, neck, head);
      for (const lx of [-0.28, 0.28]) {
        for (const lz of [-0.18, 0.18]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.72, 8), hide);
          leg.position.set(lx, 0.36, lz);
          deer.add(leg);
        }
      }
      deer.traverse((o) => { o.userData.noSplat = true; if (o.isMesh) o.castShadow = true; });
      z.group.add(deer);
      z.colliders.push({ minX: x - 0.75, maxX: x + 0.75, minZ: zz - 0.55, maxZ: zz + 0.55 });
    }

    z.group.add(new THREE.HemisphereLight(0xf5fff1, 0x385034, 1.65));
    const sun = new THREE.DirectionalLight(0xfff1cf, 2.1);
    sun.position.set(-4, 8, 3);
    sun.castShadow = true;
    z.group.add(sun);

    z.interactables.push({
      id: 'daylight-poles', type: 'flavor', label: 'Critique the daylight performance',
      title: 'THE DAYLIGHT FLESH GARDEN',
      pos: new THREE.Vector3(1.2, 1.2, 0), radius: 3.2,
      lines: [
        'Noon pours through the roof. Nobody has located the off switch.',
        'The chrome poles are listed as structural, emotional, and tax deductible.',
        'The deer critique the bass by continuing to be deer.',
      ],
    });
    z.interactables.push({
      id: 'daylight-rainbow', type: 'flavor', label: 'Interpret the enormous rainbow',
      title: 'THE RAINBOW, APPARENTLY',
      pos: new THREE.Vector3(1.5, 1.55, -5.65), radius: 3.1,
      lines: [
        'Seven arcs, one wall, no irony waiver. A unicorn has claimed the top as a residency.',
        'The rainbow emits optimism at a frequency the market has not yet securitized.',
        'Its wall text says “post-spectrum.” The colors have declined to comment.',
      ],
    });
    z.interactables.push({
      id: 'daylight-unicorn', type: 'flavor', label: 'Ask the unicorn whether artists think',
      title: 'THE UNICORN THINK TANK',
      pos: new THREE.Vector3(-5.6, 1.0, -3.25), radius: 2.0,
      lines: [
        'The unicorn thinks artists think. It is less certain about panels discussing whether artists think.',
        'One hoof taps the lo-fi kick. The horn appears to be receiving peer review.',
        'It has no statement, no edition size, and excellent boundaries. Revolutionary.',
      ],
    });
    door(z, { x: -8.8, z: 0, ry: Math.PI / 2, label: '← GALLERIA BIANCA', to: 'galleria' });
    z.waypoints = [
      new THREE.Vector3(-7.0, 0, -4.5), new THREE.Vector3(-6.4, 0, 3.2),
      new THREE.Vector3(-3.9, 0, -4.75), new THREE.Vector3(-3.1, 0, 4.75),
      new THREE.Vector3(-0.9, 0, -4.75), new THREE.Vector3(-0.7, 0, 4.75),
      new THREE.Vector3(2.2, 0, -4.65), new THREE.Vector3(2.0, 0, 4.7),
      new THREE.Vector3(6.4, 0, -4.35), new THREE.Vector3(6.3, 0, 4.45),
      new THREE.Vector3(7.2, 0, -3.0), new THREE.Vector3(6.8, 0, 3.9),
    ];
    const gardenCastIds = [
      'garden-aura', 'garden-pixel', 'garden-maybe', 'garden-loop', 'garden-oracle',
      'garden-sincere', 'garden-caption', 'garden-sleeper', 'garden-chaos', 'garden-witness',
    ];
    for (let i = 0; i < gardenCastIds.length; i++) {
      z.anchors[gardenCastIds[i]] = z.waypoints[i].clone();
    }
  }

  /* ---------------------------------------------------------- */
  /*  UP AND CUMMING ARTIST — daylight, pressure, huge paintings */
  /* ---------------------------------------------------------- */
  #buildUpAndCumming() {
    const z = this.#newZone('upAndCumming');
    const roomH = 5.6;
    shell(z, {
      w: 20, d: 16, h: roomH,
      floorColor: 0xd7d8d4, wallColor: 0xf7f7f2, ceilColor: 0xf2f5f5,
    });
    z.spawn.set(-8.2, 0, 2.8);
    z.spawnYaw = -Math.PI / 2;
    z.fog = { color: 0xe9f2f3, density: 0.009 };

    // A roof made of false promises and convincing daylight.
    for (const x of [-6, -2, 2, 6]) {
      const sky = plane(z, {
        w: 3.2, h: 5.4, x, y: roomH - 0.08, z: 0, rx: Math.PI / 2,
        material: new THREE.MeshBasicMaterial({ color: 0xe8fbff }), noSplat: true, name: 'skylight',
      });
      sky.userData.noSplat = true;
    }
    // Tall east-facing window rhythm; the wall remains solid for collision.
    for (const zz of [-5.7, -1.9, 1.9, 5.7]) {
      plane(z, {
        w: 2.7, h: 3.9, x: 9.79, y: 3.05, z: zz, ry: -Math.PI / 2,
        material: new THREE.MeshBasicMaterial({ color: 0xdff6fb }), noSplat: true, name: 'skylight',
      });
    }

    const artLoader = new THREE.TextureLoader();
    const works = [];
    const hangWork = ({ url, title, subtitle, x, y, z: zz, ry, w, h, sold = false }) => {
      const g = new THREE.Group();
      g.position.set(x, y, zz);
      g.rotation.y = ry;

      const shadow = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.16, h + 0.16, 0.075),
        mat(0xdddcd6, { roughness: 0.55 })
      );
      shadow.castShadow = true;
      const artMat = new THREE.MeshStandardMaterial({ color: 0xf0f0ec, roughness: 0.82 });
      const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h), artMat);
      art.position.z = 0.043;
      art.name = 'ownPhoto';
      art.userData.noSplat = true;
      art.receiveShadow = true;
      artLoader.load(encodeURI(url), (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        artMat.map = tex;
        artMat.color.set(0xffffff);
        artMat.needsUpdate = true;
      });

      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.min(2.65, w * 0.72), 0.38),
        new THREE.MeshBasicMaterial({
          map: textTexture(`${title}  ·  ${subtitle}`, {
            fg: '#181a1d', bg: '#fbfbf7', size: 27, w: 1200, h: 170, font: '600',
          }),
        })
      );
      label.position.set(0, -h / 2 - 0.3, 0.047);
      label.userData.noSplat = true;
      g.add(shadow, art, label);

      if (sold) {
        const dot = new THREE.Mesh(
          new THREE.CircleGeometry(0.105, 28),
          new THREE.MeshBasicMaterial({ color: 0xd4111b })
        );
        dot.position.set(Math.min(w * 0.43, 1.55), -h / 2 - 0.3, 0.054);
        dot.userData.noSplat = true;
        g.add(dot);
      }

      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      z.group.add(g);
      works.push({ group: g, title, sold });
    };

    hangWork({
      url: 'puplic/up-and-cumming-artist/01-muscle-memory.png',
      title: 'MUSCLE MEMORY BEFORE THE MARKET', subtitle: 'digital painting, 2026',
      x: -6.6, y: 2.82, z: -7.78, ry: 0, w: 2.65, h: 2.83,
    });
    hangWork({
      url: 'puplic/up-and-cumming-artist/02-blue-dealer.png',
      title: 'BLUE DEALER, OPEN INVENTORY', subtitle: 'digital painting, 2026',
      x: -2.35, y: 2.82, z: -7.78, ry: 0, w: 4.0, h: 2.6, sold: true,
    });
    hangWork({
      url: 'puplic/up-and-cumming-artist/03-red-dealer.png',
      title: 'RED DEALER, CLOSED HEART', subtitle: 'digital painting, 2026',
      x: 4.45, y: 2.82, z: -7.78, ry: 0, w: 4.85, h: 3.15,
    });
    hangWork({
      url: 'puplic/up-and-cumming-artist/04-angel-offer.png',
      title: 'ANGEL WITH A BLUE OFFER', subtitle: 'digital painting, 2026',
      x: -4.55, y: 2.82, z: 7.78, ry: Math.PI, w: 5.2, h: 3.38, sold: true,
    });
    hangWork({
      url: 'puplic/up-and-cumming-artist/05-devil-red-dot.png',
      title: 'DEVIL HOLDING THE RED DOT', subtitle: 'digital painting, 2026',
      x: 3.55, y: 2.82, z: 7.78, ry: Math.PI, w: 5.2, h: 3.38,
    });
    z.works = works;

    // Exhibition title: restrained typography, deeply unrestrained spelling.
    plane(z, {
      w: 6.8, h: 0.62, x: 9.76, y: 4.85, z: 0, ry: -Math.PI / 2,
      material: new THREE.MeshBasicMaterial({
        map: textTexture('UP AND CUMMING ARTIST', { fg: '#14161c', bg: '#fbfbf7', size: 58, w: 1400, h: 160, font: '800' }),
      }),
      noSplat: true,
    });

    // One desk, because one desk is all Zebra needs to turn resistance into paperwork.
    const deskMat = mat(0xeee9df, { roughness: 0.34, metalness: 0.03 });
    box(z, { w: 2.7, h: 0.12, d: 1.05, x: 5.95, y: 0.9, z: 2.35, material: deskMat, name: 'desk' });
    for (const dx of [-1.12, 1.12]) {
      for (const dz of [-0.4, 0.4]) {
        box(z, { w: 0.09, h: 0.9, d: 0.09, x: 5.95 + dx, z: 2.35 + dz, material: mat(0xbcb9b2, { metalness: 0.55, roughness: 0.3 }) });
      }
    }
    const contract = plane(z, {
      w: 0.72, h: 0.95, x: 5.75, y: 1.04, z: 2.34, rx: -Math.PI / 2,
      material: new THREE.MeshBasicMaterial({
        map: textTexture('SALE\nAGREEMENT\n\n90 / 10', { fg: '#15171a', bg: '#f8f5eb', size: 34, w: 500, h: 660, font: '700' }),
      }), noSplat: true, name: 'desk',
    });
    contract.rotation.z = -0.12;
    contract.userData.noSplat = true;

    // Coded birds: seven low-poly loops, each with its own orbit and wing phase.
    z.animated.birds = [];
    const birdInk = [0x15171a, 0x263b4a, 0x8e2b31];
    for (let i = 0; i < 7; i++) {
      const bird = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.1, 9, 7), mat(birdInk[i % birdInk.length], { roughness: 0.65 }));
      body.scale.set(1.7, 0.8, 0.75);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.18, 6), mat(0xe8a23a));
      beak.rotation.z = -Math.PI / 2;
      beak.position.x = 0.22;
      const wingMat = mat(birdInk[i % birdInk.length], { roughness: 0.7 });
      const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.025, 0.14), wingMat);
      const wingR = wingL.clone();
      wingL.position.set(-0.03, 0.04, -0.16);
      wingR.position.set(-0.03, 0.04, 0.16);
      bird.add(body, beak, wingL, wingR);
      bird.traverse((o) => { o.userData.noSplat = true; });
      z.group.add(bird);
      z.animated.birds.push({
        group: bird, wingL, wingR,
        radiusX: 2.3 + i * 0.63,
        radiusZ: 1.5 + (i % 3) * 0.9,
        speed: 0.22 + i * 0.035,
        phase: i * 0.91,
        y: 3.72 + (i % 3) * 0.42,
      });
    }

    z.group.add(new THREE.HemisphereLight(0xffffff, 0xb9c3bf, 2.35));
    const sun = new THREE.DirectionalLight(0xfff4d6, 3.0);
    sun.position.set(-7, 11, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -11; sun.shadow.camera.right = 11;
    sun.shadow.camera.top = 9; sun.shadow.camera.bottom = -9;
    z.group.add(sun);

    z.anchors.muscleMania300 = new THREE.Vector3(0.95, 0, 0.1);
    z.anchors.zebraZebrason = new THREE.Vector3(-0.95, 0, 0.1);
    z.anchorYaws = { muscleMania300: -Math.PI / 2, zebraZebrason: Math.PI / 2 };
    z.waypoints = [
      new THREE.Vector3(-7.2, 0, 4.8), new THREE.Vector3(-6.4, 0, -4.4),
      new THREE.Vector3(-3.0, 0, 4.4), new THREE.Vector3(-2.6, 0, -3.6),
      new THREE.Vector3(2.8, 0, 4.3), new THREE.Vector3(2.9, 0, -3.6),
      new THREE.Vector3(6.7, 0, -3.8), new THREE.Vector3(6.8, 0, 4.6),
    ];

    z.interactables.push({
      id: 'up-cumming-desk', type: 'flavor', label: 'Read the sale agreement',
      title: 'THE DESK', pos: new THREE.Vector3(5.95, 1.0, 2.35), radius: 2.2,
      lines: [
        'The agreement says 90 / 10. Zebra has circled both numbers and claimed the larger one.',
        'Muscle Mania 300 has signed the contract “NOT FOR SALE” in permanent marker.',
        'A red dot waits in the top drawer like a loaded opinion.',
      ],
    });
    door(z, { x: -9.8, z: 0, ry: Math.PI / 2, label: '← GALLERIA BIANCA', to: 'galleria' });
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

  /** Keep every physical copy visually synchronized with the selected record. */
  setRecordPlayerState(trackKey) {
    const colors = { title: 0xff5bcb, garret: 0xe8c15a, ending: 0x8a5cf6 };
    for (const z of this.zones.values()) {
      const r = z.animated.recordPlayer;
      if (!r) continue;
      r.playing = !!trackKey;
      r.label.material.color.set(colors[trackKey] ?? 0x6b6872);
      r.lamp.color.set(colors[trackKey] ?? 0xe8c15a);
      r.lamp.intensity = trackKey ? r.lamp.userData.base : 0;
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
    let event = null;
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
    if (z.animated.birds) {
      for (const b of z.animated.birds) {
        const a = t * b.speed + b.phase;
        const x = Math.cos(a) * b.radiusX;
        const zz = Math.sin(a) * b.radiusZ;
        b.group.position.set(x, b.y + Math.sin(a * 2.7) * 0.18, zz);
        const dx = -Math.sin(a) * b.radiusX;
        const dz = Math.cos(a) * b.radiusZ;
        b.group.rotation.y = Math.atan2(dx, dz) + Math.PI / 2;
        const flap = Math.sin(t * 8.5 + b.phase) * 0.72;
        b.wingL.rotation.x = flap;
        b.wingR.rotation.x = -flap;
        b.group.rotation.z = Math.sin(a * 1.7) * 0.09;
      }
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
    if (z.animated.boxers) {
      const exchangeLength = 3.15;
      const slot = Math.floor(t / exchangeLength);
      const attackTime = t - slot * exchangeLength;
      const attackerIndex = slot % 2;
      const smooth = (a, b, value) => {
        const x = Math.max(0, Math.min(1, (value - a) / (b - a)));
        return x * x * (3 - 2 * x);
      };
      const extend = smooth(0.55, 0.88, attackTime) * (1 - smooth(1.03, 1.3, attackTime));
      const windup = smooth(0.18, 0.55, attackTime) * (1 - smooth(0.82, 1.0, attackTime));
      const impact = smooth(0.86, 0.98, attackTime) * (1 - smooth(1.0, 1.22, attackTime));

      for (let i = 0; i < z.animated.boxers.length; i++) {
        const b = z.animated.boxers[i];
        const attacking = i === attackerIndex;
        const pulse = t * 4.4 + b.phase;
        const circle = Math.sin(t * 0.82 + b.phase) * 0.24;
        const advance = attacking ? extend * 0.48 - windup * 0.14 : -impact * 0.34;
        const attackArm = slot % 2;

        b.group.position.x = b.baseX + b.direction * advance;
        b.group.position.z = b.baseZ + circle;
        b.group.position.y = b.baseY + Math.abs(Math.sin(pulse)) * 0.05 - (!attacking ? impact * 0.045 : 0);
        b.group.rotation.z = Math.sin(pulse * 0.5) * 0.022 + (!attacking ? b.direction * impact * 0.11 : -b.direction * extend * 0.05);
        b.torso.rotation.z = Math.sin(pulse) * 0.035 + (attacking ? -b.direction * extend * 0.16 : b.direction * impact * 0.18);
        b.torso.rotation.x = attacking ? -extend * 0.12 : impact * 0.16;
        b.head.rotation.y = Math.sin(t * 1.7 + b.phase) * 0.1 + (!attacking ? b.direction * impact * 0.34 : 0);
        b.head.rotation.z = !attacking ? -b.direction * impact * 0.12 : 0;
        b.shortsBody.rotation.y = Math.sin(pulse * 0.5) * 0.04;

        for (let armIndex = 0; armIndex < b.arms.length; armIndex++) {
          const arm = b.arms[armIndex];
          const throwing = attacking && armIndex === attackArm;
          arm.position.z = 0.04 + (throwing ? extend * 0.62 : 0);
          arm.position.y = 1.34 + (throwing ? extend * 0.04 : (!attacking ? impact * 0.08 : 0));
          arm.rotation.x = throwing ? -extend * 0.22 : -0.08;
          arm.rotation.y = throwing ? (armIndex ? -1 : 1) * extend * 0.16 : 0;
        }
        for (let legIndex = 0; legIndex < b.legs.length; legIndex++) {
          b.legs[legIndex].rotation.z = (legIndex ? 1 : -1) * (0.05 + Math.sin(pulse) * 0.035);
          b.legs[legIndex].rotation.x = Math.sin(pulse + legIndex * Math.PI) * 0.08;
        }
      }

      if (attackTime >= 0.94 && attackTime < 1.12 && z.animated.boxing?.lastImpactSlot !== slot) {
        z.animated.boxing.lastImpactSlot = slot;
        event = { type: 'boxingImpact', variant: slot % 3 };
      }
    }
    if (z.animated.iceClusters) {
      for (let i = 0; i < z.animated.iceClusters.length; i++) {
        const cluster = z.animated.iceClusters[i];
        cluster.rotation.y += dt * (0.025 + i * 0.012) + kick * dt * 0.18;
      }
    }
    if (z.animated.recordPlayer?.playing) {
      const r = z.animated.recordPlayer;
      r.platter.rotation.y -= dt * 2.35;
      r.label.rotation.z -= dt * 2.35;
      r.lamp.intensity = (r.lamp.userData.base ?? 1.25) * (0.9 + Math.sin(t * 3.4) * 0.1);
    }
    if (z.animated.seance) {
      const { ball, aura, baseY } = z.animated.seance;
      ball.rotation.y += dt * 0.7;
      ball.position.y = baseY + Math.sin(t * 1.4) * 0.02;
      const pulse = 0.7 + Math.sin(t * 2.3) * 0.25;
      ball.material.emissiveIntensity = pulse;
      aura.intensity = pulse * ((aura.userData.base ?? 0.7) / 0.7);
    }
    // the royal broadcast: soft blurred cinema, forever mid-scene
    if (z.animated.tv) {
      const tv = z.animated.tv;
      tv.t += dt;
      if (tv.t > 0.12) {                       // ~8fps: the film's frame rate, like dignity, is low
        tv.t = 0;
        const { ctx, canvas, blobs } = tv;
        const w = canvas.width, h = canvas.height;
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#8a5060');
        grad.addColorStop(1, '#4a2438');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
        for (const b of blobs) {
          b.x += b.dx; b.y += b.dy; b.pulse += 0.09;
          if (b.x < b.r || b.x > w - b.r) b.dx *= -1;
          if (b.y < b.r || b.y > h - b.r) b.dy *= -1;
          const r = b.r * (0.82 + Math.sin(b.pulse) * 0.28);
          const rg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
          rg.addColorStop(0, b.color);
          rg.addColorStop(1, 'rgba(74,36,56,0)');
          ctx.fillStyle = rg;
          ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill();
        }
        tv.tex.needsUpdate = true;
      }
      // the glow flickers like the film is breathing
      const b = tv.glow.userData.base ?? 2.6;
      tv.glow.intensity = b + Math.sin(t * 7.3) * 0.5 + Math.sin(t * 17.7) * 0.3;
    }
    // the neon declaration: pink, buzzing, legally binding
    if (z.animated.neon) {
      const n = z.animated.neon;
      const flicker = 0.85 + Math.sin(t * 31) * 0.08 + Math.sin(t * 7.7) * 0.07;
      n.mat.opacity = flicker;
      n.glow.intensity = n.base * (0.75 + flicker * 0.25);
    }
    if (z.animated.hungryNeon) {
      const n = z.animated.hungryNeon;
      const flicker = 0.78 + Math.sin(t * 18.5) * 0.08 + Math.sin(t * 43.1) * 0.05;
      n.mat.opacity = flicker;
      n.glow.intensity = n.base * (0.72 + flicker * 0.34) + kick * 1.5;
    }
    if (z.animated.daylightGarden) {
      const garden = z.animated.daylightGarden;
      for (const u of garden.unicorns) {
        u.group.position.y = u.baseY + Math.sin(t * 1.35 + u.phase) * 0.025 + kick * 0.045;
        u.group.rotation.z = Math.sin(t * 0.8 + u.phase) * 0.018;
        u.tail.rotation.z = Math.sin(t * 2.1 + u.phase) * 0.24;
        for (let i = 0; i < u.maneSegments.length; i++) {
          u.maneSegments[i].rotation.x = Math.sin(t * 1.8 + u.phase + i * 0.55) * 0.08;
        }
      }
      for (const flower of garden.flowers) {
        flower.group.rotation.z = Math.sin(t * 1.05 + flower.phase) * 0.09 + kick * 0.025;
      }
      for (let i = 0; i < garden.rainbowMaterials.length; i++) {
        garden.rainbowMaterials[i].emissiveIntensity = 0.25 + kick * 0.42 + Math.sin(t * 0.8 + i * 0.45) * 0.045;
      }
      for (const orb of garden.orbs) {
        orb.mesh.position.y = orb.baseY + Math.sin(t * 1.25 + orb.phase) * 0.1;
        orb.mesh.material.emissiveIntensity = 1.1 + kick * 1.4 + Math.sin(t * 1.9 + orb.phase) * 0.22;
      }
    }
    return event;
  }
}
