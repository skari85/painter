/**
 * world.js — the three studios.
 *
 *   THE GARRET        warm, wrecked, yours. Easel, mattress, shrine.
 *   GALLERIA BIANCA   cold white cube. Pedestals, wine, judgment.
 *   THE VAULT         dark freeport. Caged masterpieces, one throne.
 *
 * Everything is procedural geometry + generated canvas textures.
 * Collision is XZ axis-aligned boxes (single-floor zones by design).
 * Paint splats are pooled decal planes, recycled ring-buffer style.
 */

import * as THREE from 'three';
import { mulberry32, rand, pick } from '../core/utils.js';


const WALL_H = 3.6;

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
    this.radioOn = false;      // main syncs this from the deck each frame

    this.#buildGarret();
    this.#buildGalleria();
    this.#buildVault();
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
    z.fog = { color: 0x140f0c, density: 0.045 };

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
      const flame = new THREE.PointLight(0xffb35c, 0.55, 3.2);
      flame.position.set(4.45 + i * 0.24, 1.15 + i * 0.05, -3.6);
      z.group.add(flame);
      z.animated.candles.push(flame);
      candle.userData.noSplat = true;
    }
    hangingArt(z, { x: 4.7, y: 2.1, z: -4.28, ry: 0, w: 0.8, h: 1.0, seed: 7 });
    z.interactables.push({
      id: 'shrine', type: 'shrine', label: 'Remember why you paint',
      pos: new THREE.Vector3(4.7, 1.0, -3.5), radius: 1.7,
    });

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
      const aura = new THREE.PointLight(0x8a5cf6, 0.7, 3.4);
      aura.position.set(-4.7, 1.1, 1.4);
      z.group.add(ball, aura);
      z.animated.seance = { ball, aura, baseY: 0.95 };
      z.interactables.push({
        id: 'seance', type: 'seance', label: 'Consult the dead',
        pos: new THREE.Vector3(-4.7, 1.0, 1.4), radius: 1.8,
      });
    }


    // window + moonlight
    const win = plane(z, {
      w: 1.5, h: 1.7, x: -3, y: 2.2, z: -4.48,
      material: new THREE.MeshBasicMaterial({ color: 0x9db8d9 }), noSplat: true,
    });
    win.material.color.multiplyScalar(0.9);
    const moon = new THREE.SpotLight(0xa8c4e8, 2.4, 12, 0.6, 0.5);
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

    // the radio on the desk — radio.png face, bent antenna, gold LED
    {
      const radio = new THREE.Group();
      radio.position.set(4.35, 0.75, 1.55);
      radio.rotation.y = -Math.PI / 2 - 0.25;   // face the room
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.3, 0.2), mat(0x5e2430, { roughness: 0.55 }));
      body.position.y = 0.15;
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(0.48, 0.26),
        new THREE.MeshStandardMaterial({ color: 0xd8d2c2, roughness: 0.8 })
      );
      face.position.set(0, 0.15, 0.105);
      face.userData.noSplat = true;
      new THREE.TextureLoader().load(encodeURI('puplic/visual assets/radio.png'), (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        face.material.map = tex;
        face.material.color.set(0xffffff);
        face.material.needsUpdate = true;
      });
      const antenna = new THREE.Mesh(
        new THREE.CylinderGeometry(0.006, 0.008, 0.5, 6),
        mat(0xb8b2a4, { metalness: 0.8, roughness: 0.3 })
      );
      antenna.position.set(-0.2, 0.48, 0);
      antenna.rotation.z = 0.5;
      const led = new THREE.Mesh(
        new THREE.CircleGeometry(0.014, 8),
        new THREE.MeshBasicMaterial({ color: 0xe8c15a })
      );
      led.position.set(0.19, 0.06, 0.106);
      led.userData.noSplat = true;
      radio.add(body, face, antenna, led);
      z.group.add(radio);
      z.animated.radioLed = led;
      z.interactables.push({
        id: 'radio', type: 'radio', label: 'The radio — remix the tapes',
        pos: new THREE.Vector3(4.35, 1.0, 1.55), radius: 1.8,
      });
    }

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

    // warm core light
    const warm = new THREE.PointLight(0xffd9a0, 1.1, 15);
    warm.position.set(0, 3.0, 0.5);
    z.group.add(warm);
    z.group.add(new THREE.HemisphereLight(0x6b5a48, 0x1c1512, 0.5));

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
      const spot = new THREE.SpotLight(0xf4f1e8, 1.5, 12, 0.7, 0.6);
      spot.position.set(x, 3.4, zz);
      spot.target.position.set(x, 0, zz);
      z.group.add(spot, spot.target);
    }
    z.group.add(new THREE.HemisphereLight(0xdad6cc, 0x3a3a40, 0.65));

    door(z, { x: -8.8, z: 0, ry: Math.PI / 2, label: '← THE GARRET', to: 'garret' });
    door(z, {
      x: 8.8, z: 0, ry: -Math.PI / 2, label: 'PRIVATE VIEWING →', to: 'vault',
      lockedUnlessFlag: 'vaultOpen',
      lockedLabel: 'PRIVATE VIEWING — by invitation. Come back on Night Three.',
    });

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
      const lamp = new THREE.PointLight(0xd9b36a, 0.5, 4);
      lamp.position.set(0, 2.4, 0);
      cage.add(edges, glowArt, base, lamp);
      cage.userData.noSplat = true;
      z.group.add(cage);
      z.animated.glows.push(glowArt);
      z.colliders.push({ minX: x - 0.8, maxX: x + 0.8, minZ: zz - 0.8, maxZ: zz + 0.8 });
    }

    // the throne: Index's desk
    box(z, { w: 2.6, h: 1.05, d: 1.0, x: 5.4, z: 0, material: mat(0x101014, { roughness: 0.25 }) });
    const lampGold = new THREE.PointLight(0xe8c15a, 0.9, 6);
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

    const dim = new THREE.HemisphereLight(0x4a4438, 0x0a0a0e, 0.45);
    z.group.add(dim);

    door(z, { x: -6.8, z: 0, ry: Math.PI / 2, label: '← THE WHITE CUBE', to: 'galleria' });

    z.waypoints = [
      new THREE.Vector3(-4, 0, -2.5), new THREE.Vector3(-1, 0, 1.8),
      new THREE.Vector3(2.5, 0, -1.6), new THREE.Vector3(-4.5, 0, 2.6),
      new THREE.Vector3(3.4, 0, 2.8),
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

  /* ---- ambient life ---- */

  update(dt, t) {
    const z = this.zone();
    if (!z) return;
    for (const c of z.animated.candles) {
      c.intensity = 0.45 + Math.sin(t * 9 + c.position.x * 7) * 0.08 + Math.sin(t * 23) * 0.05;
    }
    for (const s of z.animated.signs) {
      s.opacity = 0.85 + Math.sin(t * 1.8) * 0.15;
    }
    for (const g of z.animated.glows) {
      g.rotation.y += dt * 0.12;
    }
    if (z.animated.seance) {
      const { ball, aura, baseY } = z.animated.seance;
      ball.rotation.y += dt * 0.7;
      ball.position.y = baseY + Math.sin(t * 1.4) * 0.02;
      const pulse = 0.7 + Math.sin(t * 2.3) * 0.25;
      ball.material.emissiveIntensity = pulse;
      aura.intensity = pulse;
    }
    if (z.animated.radioLed) {

      // green pulse while a tape plays, dim gold standby otherwise
      z.animated.radioLed.material.color.set(
        this.radioOn
          ? (Math.sin(t * 6) > 0 ? 0x7fb285 : 0x2e5f4a)
          : 0x6b5a28
      );
    }
  }
}


