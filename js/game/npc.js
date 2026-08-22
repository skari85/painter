/**
 * npc.js — the people of the artworld.
 *
 * Procedural low-poly bodies with personality palettes, name sprites,
 * billboard ego bars, waypoint wandering, head-tracking, and the full
 * emotional lifecycle: idle → talk → staggered → MELTDOWN → storm off.
 */

import * as THREE from 'three';
import { Emitter, clamp, damp, rand, pick, mulberry32 } from '../core/utils.js';

/* ---------------- shared textures ---------------- */

let splatTex = null;
function getSplatTex() {
  if (splatTex) return splatTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.translate(32, 32);
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 18;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 4 + Math.random() * 9, 0, Math.PI * 2);
    ctx.fill();
  }
  splatTex = new THREE.CanvasTexture(c);
  return splatTex;
}

function labelTexture(name, role) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.textAlign = 'center';
  ctx.font = '700 44px Georgia, serif';
  ctx.fillStyle = '#f2f0ea';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 10;
  ctx.fillText(name, 256, 56);
  if (role) {
    ctx.font = '600 26px Georgia, serif';
    ctx.fillStyle = 'rgba(232,193,90,0.9)';
    ctx.fillText(role.toUpperCase(), 256, 96);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---------------- scribble faces ---------------- */

/** Deterministic hash of a character id → seed. */
function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Hand-tuned expressions for the mains; crowd faces roll from their id. */
const FACE_STYLE = {
  victoria: { brow: 0.8,  mouth: -0.5,  lip: '#8c2b2e' },  // arched, unimpressed
  kreyo:    { brow: -0.3, mouth: 0.4 },                    // smug, shades pushed up
  dolores:  { brow: 0.2,  mouth: -0.45 },                  // professional frown
  chad:     { brow: -0.35, mouth: 0.65, stubble: true },   // boat-shoe grin
  muffy:    { brow: -0.5, mouth: 0.6,   lip: '#c9566a' },
  docent:   { brow: 0.35, mouth: -0.1,  weary: true },     // year nine
  index:    { brow: 0.0,  mouth: -0.05, gaunt: true },     // the market, approximated
  barnaby:  { brow: -0.2, mouth: 0.3,   shift: 2.5 },      // shifty eyes
  petra:    { brow: 0.6,  mouth: -0.3,  lip: '#3a3a44' },  // severe
  baron:    { brow: 0.25, mouth: 0.15,  moustache: true },
  lucia:    { brow: -0.1, mouth: 0.25,  lip: '#6e2f3a' },
  doctorDrug: { brow: 0.92, mouth: -0.42, shift: 5.5, gaunt: true },
};

const faceCache = new Map();
const ridiculousFaceCache = new Map();
const texLoader = new THREE.TextureLoader();

/** A quick pen-sketch face: wobbly doubled strokes, deterministic per character. */
function faceTexture(def) {
  if (faceCache.has(def.id)) return faceCache.get(def.id);

  // The illustrated face pack — an authored portrait beats the pen sketch.
  if (def.face) {
    const tex = texLoader.load(encodeURI(def.face));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    faceCache.set(def.id, tex);
    return tex;
  }

  const rng = mulberry32(hashSeed(def.id));
  const st = FACE_STYLE[def.id]
    ?? { brow: rng() * 1.2 - 0.6, mouth: rng() * 1.1 - 0.55, shift: (rng() - 0.5) * 4 };

  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';             // white × skin tone = skin tone
  ctx.fillRect(0, 0, 256, 256);

  const INK = 'rgba(40,34,28,0.9)';
  const jit = (amt) => (rng() - 0.5) * 2 * amt;
  // every stroke drawn twice with jitter — the hand is nervous
  const stroke = (path, w = 4.5, color = INK) => {
    for (let p = 0; p < 2; p++) {
      ctx.strokeStyle = color;
      ctx.lineWidth = w - p * 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      path(p * 2.2);
      ctx.stroke();
    }
  };

  for (const side of [-1, 1]) {
    const ex = 128 + side * 46 + jit(2);
    const ey = 72 + jit(3);
    // eye — a scribbled oval
    stroke((o) => ctx.ellipse(ex + jit(o), ey + jit(o), 9.5 + jit(1.5), 8 + jit(1.5), jit(0.2), 0, Math.PI * 2));
    // pupil — the gaze wanders a little
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(ex + (st.shift ?? 0) + jit(1.5), ey + jit(1.5), 3.6, 0, Math.PI * 2);
    ctx.fill();
    // brow — tilt carries the attitude, mirrored per side
    const tilt = (st.brow ?? 0) * 9 * side;
    stroke((o) => {
      ctx.moveTo(ex - 16 + jit(o), 50 - tilt + jit(o));
      ctx.quadraticCurveTo(ex + jit(o), 46 + jit(o), ex + 16 + jit(o), 50 + tilt + jit(o));
    }, 5);
    // the docent's decade, under the eyes
    if (st.weary) {
      stroke((o) => {
        ctx.moveTo(ex - 8 + jit(o), 88 + jit(o));
        ctx.quadraticCurveTo(ex + jit(o), 92 + jit(o), ex + 8 + jit(o), 88 + jit(o));
      }, 3);
    }
  }

  // nose — one confident hook
  stroke((o) => {
    ctx.moveTo(126 + jit(o), 92 + jit(o));
    ctx.quadraticCurveTo(122 + jit(o), 112 + jit(o), 120 + jit(o), 118 + jit(o));
    ctx.quadraticCurveTo(124 + jit(o), 124 + jit(o), 134 + jit(o), 120 + jit(o));
  });

  // mouth — curvature is the whole personality
  stroke((o) => {
    ctx.moveTo(96 + jit(o), 158 + jit(o));
    ctx.quadraticCurveTo(128 + jit(o), 158 + (st.mouth ?? 0) * 22 + jit(o), 160 + jit(o), 158 + jit(o));
  }, 5.5, st.lip ?? INK);

  if (st.moustache) {
    for (const side of [-1, 1]) {
      stroke((o) => {
        ctx.moveTo(128 + side * 4 + jit(o), 148 + jit(o));
        ctx.quadraticCurveTo(128 + side * 22 + jit(o), 140 + jit(o), 128 + side * 34 + jit(o), 148 + jit(o));
      }, 5, '#6b625a');
    }
  }
  if (st.stubble) {
    ctx.fillStyle = 'rgba(40,34,28,0.35)';
    for (let i = 0; i < 30; i++) ctx.fillRect(96 + rng() * 64, 168 + rng() * 34, 1.6, 1.6);
  }
  if (st.gaunt) {
    for (const side of [-1, 1]) {
      stroke((o) => {
        ctx.moveTo(128 + side * 40 + jit(o), 108 + jit(o));
        ctx.lineTo(128 + side * 32 + jit(o), 134 + jit(o));
      }, 3, 'rgba(40,34,28,0.5)');
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  faceCache.set(def.id, tex);
  return tex;
}

/**
 * A transparent, deliberately overconfident doodle layered over every face.
 * Portrait assets stay intact underneath; this is just the institution's
 * unauthorized correction pass. The variant is deterministic per character
 * so a saved run never changes its punchline.
 */
function ridiculousFaceTexture(def) {
  if (ridiculousFaceCache.has(def.id)) return ridiculousFaceCache.get(def.id);

  const rng = mulberry32(hashSeed(`${def.id}:ridiculous`));
  const variant = hashSeed(def.id) % 5;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const jitter = (n = 2) => (rng() - 0.5) * n;
  const ink = '#17131a';
  const stroke = (color = ink, width = 7) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  };
  const eye = (x, y, r, pupilX, pupilY) => {
    ctx.fillStyle = '#fffdf3';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = ink; ctx.lineWidth = 5; ctx.stroke();
    ctx.fillStyle = variant === 2 ? '#ff315d' : '#15121b';
    ctx.beginPath(); ctx.arc(x + pupilX, y + pupilY, Math.max(4, r * 0.28), 0, Math.PI * 2); ctx.fill();
    if (variant === 0) {
      ctx.strokeStyle = '#15121b'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x + pupilX, y + pupilY, r * 0.5, 0, Math.PI * 1.3); ctx.stroke();
    }
  };
  const brow = (x, y, tilt) => {
    ctx.beginPath();
    ctx.moveTo(x - 28, y + tilt + jitter());
    ctx.quadraticCurveTo(x, y - 10 + jitter(), x + 28, y - tilt + jitter());
    stroke(ink, 9);
  };

  // Every variant gets the basic “why is this in the collection?” eyes.
  const leftR = variant === 1 ? 24 : 31;
  const rightR = variant === 1 ? 16 : 25;
  eye(82 + jitter(3), 77 + jitter(3), leftR, variant === 3 ? -8 : 6, variant === 3 ? 8 : -3);
  eye(174 + jitter(3), 73 + jitter(3), rightR, variant === 3 ? 7 : -5, variant === 3 ? -7 : 4);
  brow(82, 39, variant === 4 ? 14 : -7);
  brow(174, 37, variant === 4 ? -14 : 8);

  // A nose that has been promoted beyond its remit.
  ctx.fillStyle = variant === 2 ? '#ff8b22' : '#f06b6b';
  ctx.beginPath(); ctx.arc(128 + jitter(2), 121 + jitter(2), variant === 2 ? 16 : 11, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = ink; ctx.lineWidth = 4; ctx.stroke();

  if (variant === 1) {
    // Buck teeth and a tongue: the official smile of queue compliance.
    ctx.fillStyle = '#fffdf3';
    ctx.beginPath(); ctx.roundRect(92, 150, 30, 31, 8); ctx.roundRect(128, 150, 30, 31, 8); ctx.fill();
    ctx.strokeStyle = ink; ctx.lineWidth = 5; ctx.stroke();
    ctx.fillStyle = '#ee527d';
    ctx.beginPath(); ctx.ellipse(130, 190, 27, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = ink; ctx.lineWidth = 4; ctx.stroke();
  } else if (variant === 3) {
    // X eyes and a tragic little moustache.
    ctx.strokeStyle = '#5b2746'; ctx.lineWidth = 8;
    for (const x of [82, 174]) {
      ctx.beginPath(); ctx.moveTo(x - 18, 59); ctx.lineTo(x + 18, 94); ctx.moveTo(x + 18, 59); ctx.lineTo(x - 18, 94); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(91, 157); ctx.quadraticCurveTo(128, 187, 165, 157); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(128, 145); ctx.quadraticCurveTo(109, 134, 96, 149); ctx.moveTo(128, 145); ctx.quadraticCurveTo(147, 134, 160, 149); ctx.stroke();
  } else {
    // The mouth changes shape, but always occupies too much curatorial space.
    ctx.fillStyle = variant === 4 ? '#2b1a26' : '#c92f54';
    ctx.beginPath();
    ctx.moveTo(83, 159);
    ctx.quadraticCurveTo(128, 139 + (variant === 0 ? -12 : 18), 173, 159);
    ctx.quadraticCurveTo(128, 202 + (variant === 4 ? 10 : 0), 83, 159);
    ctx.fill();
    ctx.strokeStyle = ink; ctx.lineWidth = 6; ctx.stroke();
    if (variant === 0 || variant === 2) {
      ctx.fillStyle = '#fffdf3';
      ctx.fillRect(111, 158, 15, 18); ctx.fillRect(130, 158, 15, 18);
      ctx.strokeStyle = ink; ctx.lineWidth = 3; ctx.strokeRect(111, 158, 15, 18); ctx.strokeRect(130, 158, 15, 18);
    }
  }

  if (variant === 2) {
    // A monocle that suggests the portrait has become a financial instrument.
    ctx.strokeStyle = '#d6aa42'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(174, 73, 34, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(201, 98); ctx.lineTo(218, 128); ctx.stroke();
  }
  if (variant === 4) {
    // Sweat is mandatory when the queue moves backward.
    ctx.fillStyle = '#4bb8e9';
    for (const [x, y] of [[52, 112], [205, 119], [194, 178]]) {
      ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.quadraticCurveTo(x + 10, y + 3, x, y + 11); ctx.quadraticCurveTo(x - 10, y + 3, x, y - 12); ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  ridiculousFaceCache.set(def.id, tex);
  return tex;
}

export function ridiculousFaceOverlay(def, width, height, y, z) {
  const sticker = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      map: ridiculousFaceTexture(def), transparent: true, depthWrite: false,
      depthTest: true, toneMapped: false,
    })
  );
  sticker.position.set(0, y, z);
  sticker.name = 'ridiculous-face-overlay';
  sticker.userData.noSplat = true;
  return sticker;
}

/* ---------------- body factory ---------------- */

const ACCESSORY = {
  wine(g, mats) {
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.12, 8), mats.glass);
    glass.position.set(0.26, 1.08, 0.14);
    g.add(glass);
  },
  phone(g, mats) {
    const phone = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.01), mats.glass);
    phone.position.set(0.26, 1.35, 0.12);
    phone.rotation.x = -0.5;
    g.add(phone);
  },
  clipboard(g, mats) {
    const cb = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.015), mats.wood);
    cb.position.set(-0.26, 1.0, 0.16);
    g.add(cb);
  },
  cane(g, mats) {
    const cane = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.9, 8), mats.wood);
    cane.position.set(0.28, 0.45, 0.1);
    g.add(cane);
  },
  sunglasses(g) {
    const sg = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.05, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.2, metalness: 0.6 })
    );
    sg.position.set(0, 1.64, 0.1);
    g.add(sg);
  },
  hat(g, mats, def) {
    const hy = def?.cutout ? 1.68 : 1.82;       // on a walking photo it sits like a party hat
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.12, 12), mats.hat ?? mats.hair);
    crown.position.set(0, hy, 0);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.035, 16), mats.hat ?? mats.hair);
    brim.position.set(0, hy - 0.06, 0);
    g.add(crown, brim);
  },
  cape(g) {
    const cape = new THREE.Mesh(
      new THREE.PlaneGeometry(0.72, 1.05),
      new THREE.MeshStandardMaterial({ color: 0xc3323f, roughness: 0.82, side: THREE.DoubleSide })
    );
    cape.position.set(0, 1.03, -0.14);
    cape.rotation.x = 0.08;
    cape.userData.noSplat = true;
    g.add(cape);
  },
  drugHelmet(g) {
    const shell = new THREE.MeshStandardMaterial({
      color: 0x05060a, roughness: 0.18, metalness: 0.72,
    });
    const signal = new THREE.MeshStandardMaterial({
      color: 0x8f35ff, emissive: 0x5015b8, emissiveIntensity: 2.4,
      roughness: 0.16, metalness: 0.38,
    });
    // A five-sided crown, floating side plates and a luminous visor make the
    // helmet look like surveillance equipment designed by a frightened club.
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.245, 0.34, 5), shell);
    crown.position.set(0, 1.94, -0.015);
    crown.rotation.y = Math.PI / 5;
    for (const side of [-1, 1]) {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.43, 0.27), shell);
      plate.position.set(side * 0.185, 1.69, -0.015);
      plate.rotation.z = side * 0.16;
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.31, 7), shell);
      antenna.position.set(side * 0.16, 2.16, -0.01);
      antenna.rotation.z = side * -0.2;
      const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), signal);
      tip.position.set(side * 0.19, 2.31, -0.01);
      g.add(plate, antenna, tip);
    }
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.075, 0.07), signal);
    visor.position.set(0, 1.69, 0.16);
    const respirator = new THREE.Mesh(new THREE.OctahedronGeometry(0.105, 0), shell);
    respirator.scale.set(1.1, 0.72, 0.78);
    respirator.position.set(0, 1.52, 0.16);
    g.add(crown, visor, respirator);
  },
};

export function buildBody(def) {
  const p = def.palette;
  const g = new THREE.Group();
  const mats = {
    skin: new THREE.MeshStandardMaterial({ color: p.skin, roughness: 0.75 }),
    top: new THREE.MeshStandardMaterial({ color: p.top, roughness: 0.85 }),
    bottom: new THREE.MeshStandardMaterial({ color: p.bottom, roughness: 0.9 }),
    hair: new THREE.MeshStandardMaterial({ color: p.hair, roughness: 0.95 }),
    hat: new THREE.MeshStandardMaterial({ color: p.hat ?? p.hair, roughness: 0.8 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x8a2f3a, roughness: 0.25 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x6b4a30, roughness: 0.7 }),
  };

  let head, armL = null, armR = null, torso = null, cutout = null;

  if (def.cutout) {
    // a WALKING PHOTOGRAPH — no procedural body, the picture is the person.
    // flat card with a dark back; alpha-cut if the png has transparency.
    const H = def.cutoutHeight ?? 1.55, W = H * (def.cutoutAspect ?? (2 / 3));
    const card = new THREE.Group();
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(W + 0.06, H + 0.06, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.6 })
    );
    back.position.y = H / 2;
    const photo = new THREE.Mesh(
      new THREE.PlaneGeometry(W, H),
      new THREE.MeshStandardMaterial({
        color: 0xffffff, map: faceTexture(def), roughness: 0.85,
        transparent: true, alphaTest: 0.15,
        side: def.cutoutNoBack ? THREE.DoubleSide : THREE.FrontSide,
      })
    );
    photo.position.set(0, H / 2, 0.012);
    if (!def.cutoutNoBack) card.add(back);
    card.add(photo);
    // Authored/mockup artwork is already the finished face; leave the source
    // image untouched instead of adding the procedural scribble sticker.
    if (def.seated) {
      // sitting on the floor: the paper person sinks politely into the concrete
      card.position.y = -0.52;
      card.rotation.x = -0.05;
    }
    head = card;                  // head-tracking turns the whole photo toward you
    cutout = card;
  } else {

    const legMat = def.underwear ? mats.skin : mats.bottom;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.52, 0.13), legMat);
    legL.position.set(-0.09, 0.26, 0);
    const legR = legL.clone(); legR.position.x = 0.09;

    // Milo is not wearing a shirt: keep the torso skin-toned and add a small,
    // deliberately visible brief around the hips instead.
    torso = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.58, 0.22), def.underwear ? mats.skin : mats.top);
    torso.position.y = 0.82;
    torso.name = 'torso';
    if (def.underwear) {
      const briefs = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.18, 0.24),
        new THREE.MeshStandardMaterial({ color: p.underwear ?? p.bottom, roughness: 0.75 })
      );
      briefs.position.set(0, 0.57, 0);
      briefs.name = 'underwear';
      g.add(briefs);
    }

    armL = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.48, 0.11), def.underwear ? mats.skin : mats.top);
    armL.position.set(-0.26, 0.82, 0);
    armR = armL.clone(); armR.position.x = 0.26;

    head = new THREE.Group();
    head.position.y = 1.38;
    if (def.dildoHead) {
      // the court's dress code: a smooth, proud, featureless dome.
      // no face. the heads do not judge. the heads cannot.
      const dome = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.2, 6, 14), mats.skin);
      dome.position.y = 0.3;
      head.add(dome);
    } else {
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.14, 18, 14), mats.skin);
      skull.position.y = 0.24;
      // the face — a pen sketch wrapped over the front of the skull, under the hairline
      const face = new THREE.Mesh(
        new THREE.SphereGeometry(0.142, 18, 14, Math.PI / 2 - 1.05, 2.1, 1.45, 1.45),
        // white base for illustrated portraits so skin tone doesn't tint the art
        new THREE.MeshStandardMaterial({ color: def.face ? 0xffffff : p.skin, map: faceTexture(def), roughness: 0.75 })
      );
      face.position.y = 0.24;
      head.add(skull, face);
      if (!def.bald) {
        const hair = new THREE.Mesh(
          new THREE.SphereGeometry(0.145, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
          mats.hair
        );
        hair.position.y = 0.27;
        head.add(hair);
      }
    }
    // Keep the doodle on procedural faces, but leave authored portrait textures
    // untouched.
    if (!def.face) head.add(ridiculousFaceOverlay(def, 0.255, 0.255, 0.24, 0.151));
    g.add(legL, legR, torso, armL, armR);
  }

  const labelY = def.cutout ? (def.seated ? 1.32 : 1.88) : 2.12;
  const egoY = def.cutout ? (def.seated ? 1.18 : 1.7) : 1.9;


  // blob shadow
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.3, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;

  // name label
  const label = new THREE.Sprite(new THREE.SpriteMaterial({
    map: labelTexture(def.name, def.shortRole ?? def.role), transparent: true, depthWrite: false,
  }));
  const labelScale = def.labelScale ?? 1;
  label.scale.set(1.5 * labelScale, 0.375 * labelScale, 1);
  label.position.y = labelY;

  // ego bar (billboarded pair)
  const egoBg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x1c1c22, transparent: true, opacity: 0.85, depthWrite: false }));
  egoBg.scale.set(0.72, 0.055, 1);
  egoBg.position.y = egoY;
  const egoFill = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x8a5cf6, depthWrite: false }));
  egoFill.center.set(0, 0.5);
  egoFill.scale.set(0.7, 0.035, 1);
  egoFill.position.set(-0.35, egoY, 0);
  egoFill.visible = egoBg.visible = false;

  g.add(head, shadow, label, egoBg, egoFill);
  if (def.accessory && ACCESSORY[def.accessory]) ACCESSORY[def.accessory](g, mats, def);

  return { group: g, head, armL, armR, egoBg, egoFill, torso, mats, cutout };
}

/* ---------------- the NPC ---------------- */

let nextId = 1;

export class NPC {
  constructor(def, zoneKey) {
    this.uid = nextId++;
    this.def = def;
    this.zoneKey = zoneKey;
    this.ego = def.ego;
    this.maxEgo = def.ego;
    this.state = 'idle';
    this.dead = false;          // stormed off for good (tonight)

    const parts = buildBody(def);
    this.group = parts.group;
    if (def.bodyScale) {
      const [sx = 1, sy = 1, sz = sx] = def.bodyScale;
      this.group.scale.set(sx, sy, sz);
    }
    // brush raycasts should never treat a body as a wall
    this.group.traverse((o) => { o.userData.noSplat = true; });

    this.head = parts.head;
    this.armL = parts.armL;
    this.armR = parts.armR;
    this.egoBg = parts.egoBg;
    this.egoFill = parts.egoFill;
    this.torso = parts.torso;
    this.cutout = parts.cutout ?? null;
    this.#cutoutBaseY = this.cutout ? this.cutout.position.y : 0;
    this.homeYaw = null;          // set by spawn — static NPCs return to this facing

    this.#target = null;

    this.#idleFor = rand(1, 4);
    this.#walkPhase = rand(0, 6);
    this.#staggerT = 0;
    this.#meltdownT = 0;
    this.#exit = null;
    this.#splats = 0;
    this.#fireFx = null;
  }

  #target; #idleFor; #walkPhase; #staggerT; #meltdownT; #exit; #splats; #cutoutBaseY; #fireFx;
  #staggerDir = new THREE.Vector3();


  place(pos, faceYaw = rand(0, Math.PI * 2)) {
    this.group.position.copy(pos);
    this.group.rotation.y = faceYaw;
  }

  setWalkTarget(pos) {
    if (this.dead || this.state === 'talk' || this.state === 'meltdown' || this.state === 'leaving') return;
    this.#target = pos.clone();
    this.#idleFor = 8;
  }

  setEgoVisible(v) {
    this.egoBg.visible = this.egoFill.visible = v;
  }

  updateEgoBar() {
    const f = clamp(this.ego / this.maxEgo, 0, 1);
    this.egoFill.scale.x = 0.7 * f;
    this.egoFill.material.color.set(f > 0.4 ? 0x8a5cf6 : 0xe05d4e);
  }

  beginTalk() { this.state = 'talk'; }
  endTalk() { if (this.state === 'talk') this.state = 'idle'; this.#idleFor = rand(1, 2); }

  stagger(fromDir) {
    if (this.state === 'meltdown' || this.state === 'leaving' || this.dead) return;
    this.state = 'staggered';
    this.#staggerT = 0.75;
    this.#staggerDir.copy(fromDir).setY(0).normalize();
  }

  attachSplat(colorHex) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.24, 0.24),
      new THREE.MeshBasicMaterial({ map: getSplatTex(), color: colorHex, transparent: true, depthWrite: false })
    );
    const face = this.#splats % 3 === 2;
    if (this.def.cutout) m.position.set(rand(-0.28, 0.28), rand(0.35, 1.45), 0.02);  // paint ON the photograph
    else m.position.set(rand(-0.1, 0.1), face ? 1.62 : rand(0.7, 1.1), 0.13);
    m.rotation.z = rand(0, 6.28);
    m.scale.setScalar(rand(0.7, 1.3));
    this.group.add(m);
    this.#splats++;
  }

  /** The full public collapse. Falls over, lies there, then storms out. */
  meltdown(exitPos) {
    if (this.state === 'meltdown') return;
    this.state = 'meltdown';
    this.#meltdownT = 0;
    this.#exit = exitPos.clone();
    this.setEgoVisible(false);
    if (this.def.meltdownStyle === 'fire') this.#igniteStylized();
  }

  #igniteStylized() {
    const fx = new THREE.Group();
    const flames = [];
    const colors = [0xffd35a, 0xff7a28, 0xe52c19];
    for (let i = 0; i < 13; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: colors[i % colors.length], transparent: true, opacity: 0.88,
        depthWrite: false, blending: THREE.AdditiveBlending,
      });
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.08 + (i % 3) * 0.025, 0.42 + (i % 4) * 0.12, 8), material);
      const a = (i / 13) * Math.PI * 2;
      flame.position.set(Math.cos(a) * (0.12 + (i % 2) * 0.08), 0.35 + (i % 5) * 0.26, Math.sin(a) * 0.13);
      flame.rotation.z = Math.sin(a) * 0.18;
      flame.userData.fireFx = true;
      flame.userData.phase = i * 0.71;
      flames.push(flame);
      fx.add(flame);
    }
    const glow = new THREE.PointLight(0xff5a24, 0, 5.5, 2);
    glow.position.y = 0.9;
    glow.userData.fireFx = true;
    fx.add(glow);
    fx.scale.setScalar(0.01);
    this.group.add(fx);
    this.#fireFx = { group: fx, flames, glow };
  }

  update(dt, t, ctx) {
    if (this.dead) return;
    const pos = this.group.position;

    switch (this.state) {
      case 'staggered': {
        this.#staggerT -= dt;
        pos.addScaledVector(this.#staggerDir, dt * 2.4);
        this.group.rotation.z = Math.sin(this.#staggerT * 30) * 0.08;
        if (this.#staggerT <= 0) {
          this.group.rotation.z = 0;
          this.state = 'idle';
          this.#idleFor = rand(0.5, 1.5);
        }
        break;
      }

      case 'meltdown': {
        this.#meltdownT += dt;
        const mt = this.#meltdownT;
        if (this.def.meltdownStyle === 'fire' && this.#fireFx) {
          const grow = clamp(mt / 0.7, 0.01, 1);
          this.#fireFx.group.scale.set(0.72 + grow * 0.5, grow, 0.72 + grow * 0.5);
          this.#fireFx.glow.intensity = 1.4 + grow * 5.4 + Math.sin(mt * 25) * 0.7;
          for (const flame of this.#fireFx.flames) {
            flame.scale.y = 0.74 + Math.sin(mt * 17 + flame.userData.phase) * 0.22;
            flame.rotation.y += dt * (1.5 + flame.userData.phase * 0.04);
          }
          this.group.rotation.z = Math.sin(mt * 42) * Math.max(0, 0.055 - mt * 0.012);
          if (mt > 1.45) {
            const fade = clamp(1 - (mt - 1.45) / 1.25, 0, 1);
            this.group.traverse((o) => {
              if (!o.material || o.userData.fireFx) return;
              o.material.transparent = true;
              o.material.opacity = fade;
            });
            this.group.scale.set(1 - (1 - fade) * 0.22, 1 + (1 - fade) * 0.18, 1 - (1 - fade) * 0.22);
            for (const flame of this.#fireFx.flames) flame.material.opacity = fade * 0.9;
          }
          if (mt >= 2.75) {
            this.dead = true;
            this.group.visible = false;
          }
          break;
        }
        if (mt < 0.7) {
          // vibrate with existential intensity
          this.group.rotation.z = Math.sin(mt * 55) * 0.1;
        } else if (mt < 1.2) {
          const f = (mt - 0.7) / 0.5;
          this.group.rotation.x = -f * Math.PI / 2 * 0.92;
          this.group.rotation.z = 0;
          pos.y = -f * 0.12;
        } else if (mt < 2.2) {
          // lies there. thinking about the market.
        } else {
          this.state = 'leaving';
          this.group.rotation.x = 0;
          pos.y = 0;
        }
        break;
      }

      case 'leaving': {
        const d = this.#exit.clone().sub(pos); d.y = 0;
        const dist = d.length();
        if (dist < 0.5) {
          this.dead = true;
          this.group.visible = false;
          return;
        }
        d.normalize();
        pos.addScaledVector(d, dt * 3.1);
        this.group.rotation.y = Math.atan2(d.x, d.z);
        this.#walkPhase += dt * 14;
        this.#animateWalk(1.4);
        break;
      }

      case 'talk': {
        // face the player, twitch expressively
        const to = ctx.playerPos.clone().sub(pos);
        const yaw = Math.atan2(to.x, to.z);
        this.group.rotation.y = damp(this.group.rotation.y, yaw, 8, dt);
        if (this.armR) {
          this.armR.rotation.x = Math.sin(t * 2.2 + this.uid) * 0.28 - 0.2;
          this.armL.rotation.x = Math.sin(t * 1.9 + this.uid * 2) * 0.22;
        }
        if (this.cutout) {
          // the photograph emotes — agitated little paper person
          this.cutout.rotation.z = Math.sin(t * 3.4 + this.uid) * 0.05;
          this.cutout.position.y = this.#cutoutBaseY + Math.abs(Math.sin(t * 2.8 + this.uid)) * 0.025;
        }

        this.#trackHead(ctx.playerPos, dt);
        break;
      }

      default: { // idle / wander
        this.#idleFor -= dt;
        if (this.def.static) {
          // planted: hold the position, drift back to the argument's facing
          if (this.homeYaw != null) {
            this.group.rotation.y = damp(this.group.rotation.y, this.homeYaw, 3, dt);
          }
          this.group.rotation.z = damp(this.group.rotation.z, this.def.tilt ?? 0, 3, dt);
        } else if (this.#target) {
          const d = this.#target.clone().sub(pos); d.y = 0;
          const dist = d.length();
          if (dist < 0.35) {
            this.#target = null;
            this.#idleFor = rand(2, 6);
            if (this.armL) { this.armL.rotation.x = 0; this.armR.rotation.x = 0; }
          } else {

            d.normalize();
            pos.addScaledVector(d, dt * this.def.pace);
            this.group.rotation.y = damp(this.group.rotation.y, Math.atan2(d.x, d.z), 6, dt);
            this.#walkPhase += dt * 9;
            this.#animateWalk(1);
          }
        } else if (this.#idleFor <= 0) {
          this.#target = pick(ctx.waypoints).clone();
          this.#idleFor = rand(2, 6);
        }

        if (this.cutout && !this.#target) {
          // standing still: a quiet paper breathing
          this.cutout.rotation.z = damp(this.cutout.rotation.z, Math.sin(t * 1.6 + this.uid) * 0.03, 6, dt);
          this.cutout.position.y = damp(this.cutout.position.y, this.#cutoutBaseY, 8, dt);
        }


        // head tracks the player when near — the artworld is watching
        if (pos.distanceTo(ctx.playerPos) < 4.5) this.#trackHead(ctx.playerPos, dt);
        else this.head.rotation.y = damp(this.head.rotation.y, 0, 4, dt);
      }
    }
  }

  #animateWalk(intensity) {
    if (this.cutout) {
      // paper-doll locomotion: the photo rocks and hops its way across the room
      this.cutout.rotation.z = Math.sin(this.#walkPhase) * 0.09 * intensity;
      this.cutout.position.y = this.#cutoutBaseY + Math.abs(Math.sin(this.#walkPhase)) * 0.055 * intensity;
      return;
    }

    if (!this.armL) return;
    const s = Math.sin(this.#walkPhase) * 0.4 * intensity;
    this.armL.rotation.x = s;
    this.armR.rotation.x = -s;
  }

  #trackHead(playerPos, dt) {
    const to = playerPos.clone().sub(this.group.position);
    const worldYaw = Math.atan2(to.x, to.z);
    let local = worldYaw - this.group.rotation.y;
    while (local > Math.PI) local -= Math.PI * 2;
    while (local < -Math.PI) local += Math.PI * 2;
    this.head.rotation.y = damp(this.head.rotation.y, clamp(local, -1.1, 1.1), 8, dt);
    const pitch = clamp((1.5 - to.y + 0.4) * 0.2, -0.3, 0.35);
    this.head.rotation.x = damp(this.head.rotation.x, -pitch, 8, dt);
  }
}

/* ---------------- manager ---------------- */

export class NPCManager extends Emitter {
  #all = [];
  #barkT = 6;
  #forkFightT = rand(14, 22);
  #forkFight = null;
  #upFightT = 1.8;
  #upFight = null;
  #vacantTalkT = 2.4;
  #fartT = 5.2;
  #fartTarget = null;
  #moanT = 4.5;
  #vacantTalk = null;

  constructor(world, audio) {
    super();
    this.world = world;
    this.audio = audio;
  }

  clear() {
    for (const n of this.#all) n.group.removeFromParent();
    this.#all = [];
    this.#forkFight = null;
    this.#forkFightT = rand(14, 22);
    this.#upFight = null;
    this.#upFightT = 1.8;
    this.#vacantTalk = null;
    this.#vacantTalkT = 2.4;
    this.#fartT = 4.8;
    this.#fartTarget = null;
    this.#moanT = 4.5;
  }

  spawn(cast, zoneKey) {
    const zone = this.world.zone(zoneKey);
    const anchors = zone.anchors;
    const yaws = zone.anchorYaws ?? {};
    for (const def of cast) {
      const npc = new NPC(def, zoneKey);
      const anchor = def.anchor && anchors[def.anchor]
        ? anchors[def.anchor]
        : pick(zone.waypoints);
      const yaw = (def.anchor && yaws[def.anchor] != null) ? yaws[def.anchor] : rand(0, Math.PI * 2);
      npc.place(anchor.clone(), yaw);
      npc.homeYaw = yaw;
      zone.group.add(npc.group);
      this.#all.push(npc);
    }
  }


  get inCurrentZone() {
    return this.#all.filter((n) => !n.dead && n.zoneKey === this.world.current);
  }

  byId(id) { return this.#all.find((n) => n.def.id === id) ?? null; }

  /** Permanently remove one authored NPC from the active run. Safe to repeat. */
  retire(id) {
    const npc = this.byId(id);
    if (!npc) return false;
    npc.dead = true;
    npc.group.visible = false;
    return true;
  }

  /** Nearest duelable/talkable npc within range & rough facing. */
  nearest(playerPos, forward, range) {
    let best = null, bestScore = Infinity;
    for (const n of this.inCurrentZone) {
      if (n.state === 'meltdown' || n.state === 'leaving') continue;
      const to = n.group.position.clone().sub(playerPos); to.y = 0;
      const d = to.length();
      if (d > range) continue;
      const facing = to.normalize().dot(forward);
      const score = d - facing;   // prefer close + centered
      if (facing > 0.25 && score < bestScore) { bestScore = score; best = n; }
    }
    return best;
  }

  /** Anyone standing inside the brush arc? */
  inArc(playerPos, forward, range, arcDot) {
    let best = null, bestD = Infinity;
    for (const n of this.inCurrentZone) {
      if (n.state === 'meltdown' || n.state === 'leaving') continue;
      const to = n.group.position.clone().sub(playerPos); to.y = 0;
      const d = to.length();
      if (d > range || d < 0.01) continue;
      if (to.normalize().dot(forward) >= arcDot && d < bestD) { bestD = d; best = n; }
    }
    return best;
  }

  update(dt, t, playerPos) {
    const waypoints = this.world.waypoints();
    const ctx = { playerPos, waypoints };
    for (const n of this.#all) {
      if (n.zoneKey !== this.world.current) continue;
      n.update(dt, t, ctx);

      // soft personal space — walking through collectors is bad manners
      if (!n.dead) {
        const to = playerPos.clone().sub(n.group.position); to.y = 0;
        const d = to.length();
        if (d < 0.55 && d > 0.001) {
          playerPos.addScaledVector(to.normalize(), (0.55 - d) * 0.6);
        }
      }
    }

    this.#updateForkFight(dt);
    this.#updateUpAndCummingFight(dt);
    this.#updateVacantEditionsTalk(dt);
    this.#updateFartPrank(dt, playerPos);

    // Ambient barks — subtitles from whoever is near enough to overhear. Long
    // authored room exchanges own their subtitles while they are rolling.
    this.#barkT -= dt;
    if (this.#barkT <= 0 && !this.#upFight && !this.#vacantTalk && this.world.current !== 'vacantEditions') {
      this.#barkT = this.world.current === 'daylightClub' ? rand(24, 34) : rand(7, 15);
      const near = this.inCurrentZone.filter(
        (n) => n.state !== 'meltdown' && n.state !== 'leaving' &&
               n.def.barks?.length &&
               n.group.position.distanceTo(playerPos) < 8
      );

      if (near.length) {
        const n = pick(near);
        const line = pick(n.def.barks);
        this.emit('bark', { name: n.def.name, text: line, pitch: n.def.pitch });
      }
    }
  }

  #updateFartPrank(dt, playerPos) {
    const nuisanceZone = this.world.current === 'deathMetal'
      || this.world.current === 'documenta'
      || this.world.current === 'biennaleWaiting';
    if (!nuisanceZone) {
      this.#fartTarget = null;
      this.#fartT = Math.max(this.#fartT, 3.5);
      this.#moanT = Math.max(this.#moanT, 3.5);
      return;
    }
    const punk = this.inCurrentZone.find((n) => (n.def.fartingPunk || n.def.fartingHero) && !n.dead);
    if (!punk) return;
    if (punk.state === 'talk' || punk.state === 'meltdown' || punk.state === 'leaving') return;

    if (punk.def.fartingHero) {
      this.#moanT -= dt;
      if (this.#moanT <= 0) {
        this.#moanT = rand(7, 11);
        this.audio?.annoyingMoan?.(Math.floor(Math.random() * 4));
        this.emit('bark', { name: punk.def.name, text: pick(punk.def.barks), pitch: punk.def.pitch });
      }
    }

    if (this.#fartTarget) {
      const targetPos = this.#fartTarget.player ? playerPos : this.#fartTarget.npc?.group.position;
      if (!targetPos || this.#fartTarget.npc?.dead) {
        this.#fartTarget = null;
        this.#fartT = 1.2;
        return;
      }
      const distance = punk.group.position.distanceTo(targetPos);
      if (distance < 1.18) {
        const variant = Math.floor((Date.now() / 1000) * 7) % 5;
        this.audio?.punkFart?.(variant);
        this.emit('fartPrank', {
          name: punk.def.name,
          victim: this.#fartTarget.player ? 'YOU' : this.#fartTarget.npc.def.name,
          variant,
        });
        this.#fartTarget = null;
        this.#fartT = rand(6.5, 10.5);
      } else {
        punk.setWalkTarget(targetPos);
      }
      return;
    }

    this.#fartT -= dt;
    if (this.#fartT > 0 || punk.state !== 'idle') return;
    const guests = this.inCurrentZone.filter((n) => n !== punk && !n.dead && n.state === 'idle');
    if (!guests.length) {
      this.#fartT = 3;
      return;
    }
    this.#fartTarget = Math.random() < 0.2
      ? { player: true }
      : { npc: pick(guests) };
    const targetPos = this.#fartTarget.player ? playerPos : this.#fartTarget.npc.group.position;
    punk.setWalkTarget(targetPos);
  }

  /**
   * Dinner-party violence is theatre, not a duel: two guests stagger, trade
   * three absurd lines, and return to their seats. It never melts anyone down
   * and only exists while the Gilded Fork is the active zone.
   */
  #updateForkFight(dt) {
    if (this.world.current !== 'gildedFork') {
      this.#forkFight = null;
      this.#forkFightT = Math.max(this.#forkFightT, 4);
      return;
    }
    if (this.#forkFight) {
      this.#forkFight.t += dt;
      const f = this.#forkFight;
      if (f.t > 0.82 && !f.hit) {
        f.hit = true;
        f.b.stagger(f.dir.clone().negate());
        this.emit('fight', { phase: 'hit', a: f.a, b: f.b });
      } else if (f.t > 1.75 && !f.end) {
        f.end = true;
        this.emit('fight', { phase: 'end', a: f.a, b: f.b });
      } else if (f.t > 2.6) {
        this.#forkFight = null;
        this.#forkFightT = rand(22, 38);
      }
      return;
    }
    this.#forkFightT -= dt;
    if (this.#forkFightT > 0) return;
    const candidates = this.inCurrentZone.filter((n) =>
      !n.dead && n.state === 'idle' && n.def.id !== 'forkHost' && n.def.id !== 'forkWaiter'
    );
    if (candidates.length < 2) {
      this.#forkFightT = 8;
      return;
    }
    const a = pick(candidates);
    const b = pick(candidates.filter((n) => n !== a));
    const dir = b.group.position.clone().sub(a.group.position).setY(0).normalize();
    a.group.rotation.y = Math.atan2(dir.x, dir.z);
    b.group.rotation.y = Math.atan2(-dir.x, -dir.z);
    a.stagger(dir);
    this.#forkFight = { a, b, dir, t: 0, hit: false, end: false };
    this.emit('fight', { phase: 'start', a, b });
  }

  /** Muscle Mania protects the inventory; Zebra Zebrason protects the quarter. */
  #updateUpAndCummingFight(dt) {
    if (this.world.current !== 'upAndCumming') {
      this.#upFight = null;
      this.#upFightT = Math.max(this.#upFightT, 1.8);
      return;
    }

    const muscle = this.byId('muscleMania300');
    const zebra = this.byId('zebraZebrason');
    if (!muscle || !zebra || muscle.dead || zebra.dead) return;

    if (this.#upFight) {
      const f = this.#upFight;
      f.t += dt;
      while (f.nextBeat < f.beats.length && f.t >= f.beats[f.nextBeat].at) {
        const beat = f.beats[f.nextBeat++];
        const speaker = beat.speaker === 'zebra' ? zebra : muscle;
        if (beat.push === 'muscle') {
          muscle.stagger(f.dir);
          this.audio?.boxingImpact?.(0);
        } else if (beat.push === 'zebra') {
          zebra.stagger(f.dir.clone().negate());
          this.audio?.boxingImpact?.(2);
        }
        this.emit('bark', { name: speaker.def.name, text: beat.text, pitch: speaker.def.pitch });
      }
      const finalBeat = f.beats[f.beats.length - 1];
      if (f.nextBeat >= f.beats.length && f.t > finalBeat.at + 5.2) {
        const zone = this.world.zone('upAndCumming');
        muscle.place(zone.anchors.muscleMania300.clone(), zone.anchorYaws.muscleMania300);
        zebra.place(zone.anchors.zebraZebrason.clone(), zone.anchorYaws.zebraZebrason);
        muscle.homeYaw = zone.anchorYaws.muscleMania300;
        zebra.homeYaw = zone.anchorYaws.zebraZebrason;
        this.#upFight = null;
        this.#upFightT = rand(7.5, 11.5);
        this.#barkT = rand(8, 14);
      }
      return;
    }

    this.#upFightT -= dt;
    if (this.#upFightT > 0 || muscle.state !== 'idle' || zebra.state !== 'idle') return;
    const dir = muscle.group.position.clone().sub(zebra.group.position).setY(0).normalize();
    muscle.group.rotation.y = Math.atan2(-dir.x, -dir.z);
    zebra.group.rotation.y = Math.atan2(dir.x, dir.z);
    this.#upFight = {
      t: 0,
      nextBeat: 0,
      dir,
      // A full miniature argument: pressure, refusal, sales euphemisms,
      // then the gallerist insists that the party — and the quarter — roll on.
      beats: [
        { at: 0.00, speaker: 'zebra', text: 'Two red dots before lunch. I am trying to save your career!' },
        { at: 3.20, speaker: 'zebra', push: 'muscle', text: 'SIGN. THE. SALE. AGREEMENT.' },
        { at: 6.90, speaker: 'muscle', text: 'The work is not leaving this room. It has excellent boundaries.' },
        { at: 10.50, speaker: 'muscle', push: 'zebra', text: 'I said no. My arms are just the punctuation.' },
        { at: 14.60, speaker: 'zebra', text: 'Oh hey, the party has to roll on, baby! A red dot is a starting gun.' },
        { at: 18.00, speaker: 'muscle', text: 'Let it roll past me. The paintings are staying for breakfast.' },
        { at: 21.40, speaker: 'zebra', text: 'Collectors are already rolling in. They brought wallets and emotional weather.' },
        { at: 24.80, speaker: 'muscle', text: 'They can roll right back out. I trained the canvases to resist gravity.' },
        { at: 28.20, speaker: 'zebra', text: 'This is a rolling preview, darling. Preview becomes placement. Placement becomes commission.' },
        { at: 31.60, speaker: 'muscle', text: 'That is not a preview. That is a heist wearing a lanyard.' },
        { at: 35.00, speaker: 'zebra', text: 'I call it momentum. Momentum is just pressure with a champagne problem.' },
        { at: 38.40, speaker: 'muscle', text: 'I call it refusal. Refusal is pressure with better protein.' },
        { at: 41.80, speaker: 'zebra', text: 'One signature and the whole room gets a little more legendary.' },
        { at: 45.20, speaker: 'muscle', text: 'One signature and the whole room gets a little less mine.' },
        { at: 48.60, speaker: 'zebra', text: 'Fine. I will roll the contract under the door and call it an installation.' },
        { at: 52.00, speaker: 'muscle', text: 'I will roll the door back. The paintings and I are having a private view.' },
      ],
    };
    this.#barkT = Math.max(this.#barkT, 10);
  }

  /** Vincent and Eddie conduct an endlessly specific dildo surface seminar. */
  #updateVacantEditionsTalk(dt) {
    if (this.world.current !== 'vacantEditions') {
      this.#vacantTalk = null;
      this.#vacantTalkT = Math.max(this.#vacantTalkT, 2.4);
      return;
    }

    const vincent = this.byId('vacantVincent');
    const eddie = this.byId('editionEddie');
    if (!vincent || !eddie || vincent.dead || eddie.dead) return;

    if (this.#vacantTalk) {
      // A player conversation gets the floor; the seminar resumes afterward.
      if (vincent.state === 'talk' || eddie.state === 'talk') return;
      const c = this.#vacantTalk;
      c.t += dt;
      while (c.nextBeat < c.beats.length && c.t >= c.beats[c.nextBeat].at) {
        const beat = c.beats[c.nextBeat++];
        const speaker = beat.speaker === 'vincent' ? vincent : eddie;
        this.emit('bark', { name: speaker.def.name, text: beat.text, pitch: speaker.def.pitch });
      }
      const last = c.beats[c.beats.length - 1];
      if (c.nextBeat >= c.beats.length && c.t > last.at + 5.6) {
        const zone = this.world.zone('vacantEditions');
        vincent.place(zone.anchors.vacantVincent.clone(), zone.anchorYaws.vacantVincent);
        eddie.place(zone.anchors.editionEddie.clone(), zone.anchorYaws.editionEddie);
        vincent.homeYaw = zone.anchorYaws.vacantVincent;
        eddie.homeYaw = zone.anchorYaws.editionEddie;
        this.#vacantTalk = null;
        this.#vacantTalkT = rand(8, 12);
      }
      return;
    }

    this.#vacantTalkT -= dt;
    if (this.#vacantTalkT > 0 || vincent.state !== 'idle' || eddie.state !== 'idle') return;

    const zone = this.world.zone('vacantEditions');
    vincent.group.rotation.y = zone.anchorYaws.vacantVincent;
    eddie.group.rotation.y = zone.anchorYaws.editionEddie;
    this.#vacantTalk = {
      t: 0,
      nextBeat: 0,
      beats: [
        { at: 0.0, speaker: 'vincent', text: 'There are schools of sucking cock. I favor the slow seal: soft lips, patient suction, no panic.' },
        { at: 4.2, speaker: 'eddie', text: 'Too classical. I begin with shallow teasing and let the tongue circle the head like a tiny curator.' },
        { at: 8.4, speaker: 'vincent', text: 'The tongue should travel underneath as well. That sensitive line deserves its own retrospective.' },
        { at: 12.6, speaker: 'eddie', text: 'Yes, but no teeth unless explicitly invited. Teeth are an intervention, not a default medium.' },
        { at: 16.8, speaker: 'vincent', text: 'For rhythm, use one hand with the mouth. Two motions, one tempo, no conceptual gap.' },
        { at: 21.0, speaker: 'eddie', text: 'And change the pressure. Constant suction becomes institutional after the first minute.' },
        { at: 25.2, speaker: 'vincent', text: 'Some like deep-throating. Breathe, relax, go slowly, and stop if the body votes no.' },
        { at: 29.4, speaker: 'eddie', text: 'Exactly. Gagging is not a funding requirement. The cock does not award endurance grants.' },
        { at: 33.6, speaker: 'vincent', text: 'Others want the head focused on: tongue, lips, tiny pauses, then suction returning with purpose.' },
        { at: 37.8, speaker: 'eddie', text: 'Some prefer a wet, messy blowjob. More saliva, louder rhythm, absolutely no minimalist restraint.' },
        { at: 42.0, speaker: 'vincent', text: 'Eye contact can be hot, but it is optional. Nobody needs a performance review while sucking cock.' },
        { at: 46.2, speaker: 'eddie', text: 'The best method is feedback. Ask what feels good, then actually listen instead of defending the technique.' },
        { at: 50.4, speaker: 'vincent', text: 'Now texture: velvet dildo for looking, silicone dildo for practice, chrome dildo for alarming reflections.' },
        { at: 54.6, speaker: 'eddie', text: 'Never put the sandblasted dildo in a mouth. It is sculpture. Even sculpture should understand consent.' },
        { at: 58.8, speaker: 'vincent', text: 'The pearlescent dildo suits slow mouth work. It changes color as if receiving excellent news.' },
        { at: 63.0, speaker: 'eddie', text: 'So: vary depth, tongue, suction, hand rhythm, and pace. The cock is the audience. Read the room.' },
      ],
    };
    this.#barkT = Math.max(this.#barkT, 12);
  }
}
