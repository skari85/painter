/**
 * world.js — the expanding rooms of the scene.
 *
 *   THE GARRET            warm, wrecked, yours. Easel, mattress, shrine.
 *   GALLERIA BIANCA       cold white cube. Pedestals, wine, judgment.
 *   THE VAULT             dark freeport. Caged masterpieces, one throne.
 *   THE LEATHER & LATEX   the collector's house. Hide up front, shine
 *   ROOMS                 in the back — one house, two material moods.
 *   THE GILDED FORK       one long table, every artworld big shot,
 *                         all of them drunk and messed up.
 *   U WISH U HAD HAIR     chrome salon stations for an entirely bald cast.
 *   PUBLIC RESTROOM       tiled stalls, plumbing, bodily techno zamba.
 *
 * Everything uses procedural geometry with generated and locally stored textures.
 * Collision is XZ axis-aligned boxes (single-floor zones by design).
 * Paint splats are pooled decal planes, recycled ring-buffer style.
 */

import * as THREE from 'three';
import { clamp, mulberry32, rand, pick } from '../core/utils.js';
import { MAXPRO } from '../core/config.js';
import { lotNumberFor } from './narrative.js';
// Cache-bust this tiny shared renderer import so long-lived local preview tabs
// pick up newly drawn guest faces without serving yesterday's module graph.
import { ridiculousFaceOverlay } from './npc.js?ridiculous-faces=1';


const WALL_H = 3.6;
const CHAR_COLOR = new THREE.Color(0x080706);


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

const ART_LEGENDS = [
  { id: 'picasso', name: 'PABLO PICASSO', years: '1881—1973', quote: '“To me, there is no past or present in art.”', colors: ['#d7b55b', '#244a66', '#d45b44'], style: 0 },
  { id: 'kahlo', name: 'FRIDA KAHLO', years: '1907—1954', quote: '“I never painted dreams. I painted my own reality.”', colors: ['#173f38', '#b8373f', '#efb13c'], style: 1 },
  { id: 'basquiat', name: 'JEAN-MICHEL BASQUIAT', years: '1960—1988', quote: '“I cross out words so you will see them more.”', colors: ['#1f1d1a', '#d8aa32', '#b54435'], style: 2 },
  { id: 'okeeffe', name: 'GEORGIA O’KEEFFE', years: '1887—1986', quote: '“The abstraction is often the most definite form for the intangible thing in myself.”', colors: ['#d6d0c6', '#5f8290', '#9d493a'], style: 3 },
  { id: 'bourgeois', name: 'LOUISE BOURGEOIS', years: '1911—2010', quote: '“Art is a guaranty of sanity.”', colors: ['#ede5d9', '#bd2d3e', '#252126'], style: 4 },
  { id: 'hockney', name: 'DAVID HOCKNEY', years: '1937—2026', quote: '“I paint what I like, when I like, and where I like.”', colors: ['#65b9d1', '#f0d33f', '#e86443'], style: 5 },
  { id: 'ringgold', name: 'FAITH RINGGOLD', years: '1930—2024', quote: '“It is powerful to know who you are.”', colors: ['#542f72', '#e29632', '#2e6d67'], style: 6 },
  { id: 'matisse', name: 'HENRI MATISSE', years: '1869—1954', quote: '“What I dream of is an art of balance, of purity and serenity.”', colors: ['#b3262e', '#24499a', '#e8c544'], style: 7 },
  { id: 'bacon', name: 'FRANCIS BACON', years: '1909—1992', quote: '“I think art is an obsession with life.”', colors: ['#311f29', '#8e243e', '#d6a35d'], style: 8 },
  { id: 'pollock', name: 'JACKSON POLLOCK', years: '1912—1956', quote: '“The painting has a life of its own.”', colors: ['#e0d5bd', '#1c2528', '#b83e31'], style: 9 },
  { id: 'krasner', name: 'LEE KRASNER', years: '1908—1984', quote: '“I like a canvas to breathe and be alive.”', colors: ['#d67842', '#4e236f', '#258a83'], style: 10 },
  { id: 'kusama', name: 'YAYOI KUSAMA', years: '1929—', quote: '“I paint the work imagining the vastness of the universe.”', colors: ['#e62e35', '#f3d739', '#241d22'], style: 11 },
];

/** Coded portraits with artist-specific graphic signatures. They stay original
 * and painterly while carrying enough facial structure to read from the aisle. */
function legendPortraitTexture(legend) {
  const [ground, accent, spark] = legend.colors;
  return canvasTexture(512, 640, (ctx, w, h) => {
    const rng = mulberry32(8100 + legend.style * 977);
    const ellipse = (x, y, rx, ry, color, rotation = 0) => {
      ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2); ctx.fill();
    };
    ctx.fillStyle = ground; ctx.fillRect(0, 0, w, h);

    // A distinct visual rhythm for every legend: references to their language,
    // never copies of a specific work.
    ctx.globalAlpha = 0.88;
    if (legend.style === 0) {
      for (let i = 0; i < 14; i++) {
        ctx.fillStyle = i % 2 ? accent : spark;
        ctx.beginPath(); ctx.moveTo(rng() * w, rng() * h); ctx.lineTo(rng() * w, rng() * h); ctx.lineTo(rng() * w, rng() * h); ctx.fill();
      }
    } else if (legend.style === 1) {
      for (let i = 0; i < 20; i++) {
        const a = i / 20 * Math.PI * 2;
        ellipse(w / 2 + Math.cos(a) * 190, 104 + Math.sin(a) * 48, 13 + (i % 3) * 5, 13 + (i % 3) * 5, i % 3 ? spark : accent);
      }
    } else if (legend.style === 2) {
      ctx.strokeStyle = spark; ctx.lineWidth = 13;
      for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(rng() * w, rng() * h); ctx.lineTo(rng() * w, rng() * h); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(176, 118); ctx.lineTo(206, 50); ctx.lineTo(256, 104); ctx.lineTo(306, 50); ctx.lineTo(338, 118); ctx.stroke();
    } else if (legend.style === 3) {
      ctx.fillStyle = spark; ctx.fillRect(0, 398, w, 242);
      ctx.fillStyle = accent; ctx.beginPath(); ctx.moveTo(0, 430); ctx.quadraticCurveTo(170, 310, 330, 450); ctx.quadraticCurveTo(420, 505, w, 390); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();
    } else if (legend.style === 4) {
      ctx.strokeStyle = accent; ctx.lineWidth = 4;
      for (let r = 26; r < 250; r += 28) { ctx.beginPath(); ctx.arc(w / 2, 265, r, Math.PI, Math.PI * 2); ctx.stroke(); }
      for (let a = 0; a <= Math.PI; a += Math.PI / 10) { ctx.beginPath(); ctx.moveTo(w / 2, 265); ctx.lineTo(w / 2 + Math.cos(a) * 250, 265 - Math.sin(a) * 250); ctx.stroke(); }
    } else if (legend.style === 5) {
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 9;
      for (let x = -40; x < w + 80; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x - 140, h); ctx.stroke(); }
      for (let y = 0; y < h; y += 58) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    } else if (legend.style === 6) {
      const cols = [ground, accent, spark, '#d2c17b'];
      for (let y = 0; y < h; y += 72) for (let x = 0; x < w; x += 72) {
        ctx.fillStyle = cols[(x / 72 + y / 72) % cols.length | 0]; ctx.fillRect(x + 5, y + 5, 62, 62);
      }
    } else if (legend.style === 7) {
      for (let i = 0; i < 16; i++) ellipse(80 + rng() * 350, 80 + rng() * 460, 20 + rng() * 32, 70 + rng() * 55, i % 2 ? accent : spark, rng() * Math.PI);
    } else if (legend.style === 8) {
      // Bacon: a dark stage, triptych rails and dragged, fleshy passages.
      ctx.strokeStyle = spark; ctx.lineWidth = 7; ctx.strokeRect(44, 45, 128, 520); ctx.strokeRect(192, 45, 128, 520); ctx.strokeRect(340, 45, 128, 520);
      for (let i = 0; i < 11; i++) ellipse(80 + rng() * 360, 100 + rng() * 390, 28 + rng() * 70, 9 + rng() * 24, i % 2 ? accent : '#c98d75', rng() * Math.PI);
    } else if (legend.style === 9) {
      // Pollock: looping enamel trajectories and suspended drops.
      ctx.lineCap = 'round';
      for (let i = 0; i < 20; i++) {
        ctx.strokeStyle = [accent, spark, '#f4eee1'][i % 3]; ctx.lineWidth = 2 + rng() * 7;
        ctx.beginPath(); ctx.moveTo(-30, rng() * h); ctx.bezierCurveTo(rng() * w, rng() * h, rng() * w, rng() * h, w + 30, rng() * h); ctx.stroke();
        ellipse(rng() * w, rng() * h, 2 + rng() * 8, 2 + rng() * 8, ctx.strokeStyle);
      }
    } else if (legend.style === 10) {
      // Krasner: muscular, breathing arcs with shifting interiors.
      ctx.lineCap = 'round';
      for (let i = 0; i < 13; i++) {
        ctx.strokeStyle = [accent, spark, '#e9caa1'][i % 3]; ctx.lineWidth = 15 + rng() * 22;
        ctx.beginPath(); ctx.moveTo(-60 + rng() * 160, 80 + rng() * 520); ctx.bezierCurveTo(140, rng() * h, 360, rng() * h, 560, 80 + rng() * 520); ctx.stroke();
      }
    } else {
      // Kusama: an optically dense field of hand-shifted dots.
      for (let y = 20; y < h; y += 34) for (let x = 18; x < w; x += 34) {
        const r = 7 + ((x + y) / 34 % 3) * 2;
        ellipse(x + (rng() - 0.5) * 8, y + (rng() - 0.5) * 8, r, r, (x + y) % 68 ? spark : accent);
      }
    }
    ctx.globalAlpha = 1;

    const skins = ['#d1a47f', '#b86f4f', '#8a5337', '#d3b092', '#d0aa8d', '#d6a57e', '#8a553a', '#d2aa83', '#d2a080', '#c99c7c', '#d3aa8f', '#e0b18e'];
    const skin = skins[legend.style];
    const shadow = ['#9a6854', '#7e4336', '#573224', '#a27e68', '#9a7763', '#a4775e', '#5f3729', '#a27a60', '#94634f', '#8e624f', '#9b7565', '#aa775e'][legend.style];
    const ink = '#171515';
    const faceTilt = legend.style === 8 ? -0.09 : (legend.style % 2 ? -0.035 : 0.035);

    // Shoulders and neck sit behind the head, replacing the old blocky bust.
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.moveTo(70, 640); ctx.quadraticCurveTo(90, 500, 205, 476); ctx.lineTo(307, 476); ctx.quadraticCurveTo(422, 500, 442, 640); ctx.closePath(); ctx.fill();
    ctx.fillStyle = skin; ctx.fillRect(215, 415, 82, 104);
    ellipse(215, 426, 30, 44, shadow, -0.2); ellipse(297, 426, 30, 44, shadow, 0.2);

    // Ears, face volume, cheek planes and jaw shading.
    ellipse(132, 310, 27, 52, skin, -0.08); ellipse(380, 310, 27, 52, skin, 0.08);
    ctx.strokeStyle = ink; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(137, 313, 12, -1.2, 1.15); ctx.moveTo(375, 296); ctx.arc(375, 313, 12, -1.95, 1.95); ctx.stroke();
    const faceGradient = ctx.createLinearGradient(150, 190, 350, 430);
    faceGradient.addColorStop(0, skin); faceGradient.addColorStop(0.72, skin); faceGradient.addColorStop(1, shadow);
    ctx.fillStyle = faceGradient; ctx.beginPath(); ctx.ellipse(256, 300, 125, 154, faceTilt, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = ink; ctx.lineWidth = 10; ctx.stroke();
    ctx.globalAlpha = 0.23;
    ellipse(198, 345, 46, 36, shadow, -0.2); ellipse(319, 345, legend.style === 8 ? 68 : 43, legend.style === 8 ? 50 : 34, shadow, 0.18);
    ctx.globalAlpha = 1;

    // Hair silhouettes and internal strands carry the quickest likeness cues.
    let hair = '#211a18';
    if ([3, 4].includes(legend.style)) hair = '#ece6db';
    if (legend.style === 5) hair = '#d8cfb0';
    if (legend.style === 11) hair = '#d93935';
    ctx.fillStyle = hair;
    if (legend.style === 2) {
      for (let i = 0; i < 20; i++) {
        const a = i / 20 * Math.PI * 2; ellipse(256 + Math.cos(a) * 128, 215 + Math.sin(a) * 101, 17, 58, hair, a);
      }
    } else if (legend.style === 11) {
      ctx.beginPath(); ctx.arc(256, 252, 145, Math.PI, Math.PI * 2); ctx.lineTo(397, 360); ctx.quadraticCurveTo(360, 445, 326, 437); ctx.lineTo(326, 242); ctx.lineTo(186, 242); ctx.lineTo(186, 437); ctx.quadraticCurveTo(145, 436, 116, 360); ctx.closePath(); ctx.fill();
      ctx.fillRect(151, 198, 210, 62);
    } else if (legend.style === 10) {
      ctx.beginPath(); ctx.arc(256, 246, 142, Math.PI, Math.PI * 2); ctx.lineTo(389, 353); ctx.quadraticCurveTo(350, 418, 325, 390); ctx.quadraticCurveTo(371, 226, 255, 176); ctx.quadraticCurveTo(132, 224, 184, 408); ctx.quadraticCurveTo(132, 411, 120, 350); ctx.closePath(); ctx.fill();
    } else if (legend.style === 9) {
      for (let i = 0; i < 13; i++) ellipse(151 + i * 17, 207 + Math.sin(i * 1.7) * 22, 25, 52, hair, -0.5 + i * 0.09);
    } else if (legend.style === 8) {
      ctx.beginPath(); ctx.moveTo(132, 260); ctx.quadraticCurveTo(158, 161, 282, 170); ctx.quadraticCurveTo(350, 177, 385, 248); ctx.quadraticCurveTo(302, 210, 213, 221); ctx.quadraticCurveTo(164, 230, 132, 260); ctx.fill();
      ctx.strokeStyle = '#4c3932'; ctx.lineWidth = 8;
      for (let x = 155; x < 365; x += 24) { ctx.beginPath(); ctx.moveTo(x, 214); ctx.quadraticCurveTo(x + 18, 178, x + 40, 204); ctx.stroke(); }
    } else if (![0, 5].includes(legend.style)) {
      ctx.beginPath(); ctx.arc(256, 250, 137, Math.PI, Math.PI * 2); ctx.lineTo(388, 306); ctx.quadraticCurveTo(345, 180, 256, 174); ctx.quadraticCurveTo(160, 184, 126, 310); ctx.closePath(); ctx.fill();
    } else if (legend.style === 5) {
      ctx.beginPath(); ctx.arc(256, 235, 134, Math.PI, Math.PI * 2); ctx.lineTo(370, 250); ctx.quadraticCurveTo(256, 176, 142, 250); ctx.closePath(); ctx.fill();
    }

    // Brows, eyelids, whites, irises and highlights give the faces an actual gaze.
    ctx.strokeStyle = ink; ctx.lineCap = 'round'; ctx.lineWidth = legend.style === 10 ? 14 : 10;
    ctx.beginPath(); ctx.moveTo(174, 270); ctx.quadraticCurveTo(209, 250, 239, 271); ctx.moveTo(274, 271); ctx.quadraticCurveTo(308, 249, 344, 269); ctx.stroke();
    if (legend.style === 1) { ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(178, 253); ctx.quadraticCurveTo(254, 235, 340, 254); ctx.stroke(); }
    const leftEyeY = legend.style === 8 ? 295 : 292;
    const rightEyeY = legend.style === 8 ? 286 : 292;
    ellipse(211, leftEyeY, 30, 15, '#f3eadc', -0.04); ellipse(306, rightEyeY, 30, 15, '#f3eadc', 0.04);
    ctx.strokeStyle = ink; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(180, leftEyeY); ctx.quadraticCurveTo(211, leftEyeY - 19, 241, leftEyeY); ctx.moveTo(276, rightEyeY); ctx.quadraticCurveTo(306, rightEyeY - 19, 337, rightEyeY); ctx.stroke();
    const iris = legend.style === 5 ? '#426f83' : legend.style === 1 ? '#513424' : '#332a26';
    ellipse(214, leftEyeY, 11, 11, iris); ellipse(303, rightEyeY, 11, 11, iris);
    ellipse(214, leftEyeY, 5, 6, ink); ellipse(303, rightEyeY, 5, 6, ink);
    ellipse(218, leftEyeY - 4, 2.5, 2.5, '#ffffff'); ellipse(307, rightEyeY - 4, 2.5, 2.5, '#ffffff');

    if (legend.style === 5) {
      ctx.strokeStyle = '#3b2632'; ctx.lineWidth = 11; ctx.strokeRect(165, 257, 86, 64); ctx.strokeRect(264, 257, 86, 64); ctx.beginPath(); ctx.moveTo(251, 282); ctx.lineTo(264, 282); ctx.stroke();
    }

    // Nose, nostrils, philtrum, lips, chin and age lines.
    ctx.strokeStyle = ink; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(257, 302); ctx.quadraticCurveTo(245, 331, 244, 353); ctx.quadraticCurveTo(258, 365, 276, 353); ctx.stroke();
    ellipse(247, 356, 5, 3, ink); ellipse(272, 356, 5, 3, ink);
    ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(258, 366); ctx.lineTo(258, 379); ctx.stroke();
    const lip = [1, 4, 6, 10, 11].includes(legend.style) ? '#7d2939' : '#5b302b';
    ctx.fillStyle = lip; ctx.beginPath(); ctx.moveTo(204, 399); ctx.quadraticCurveTo(240, 381, 258, 394); ctx.quadraticCurveTo(278, 381, 316, 398); ctx.quadraticCurveTo(263, 433, 204, 399); ctx.fill();
    ctx.strokeStyle = ink; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(205, 399); ctx.quadraticCurveTo(258, 411, 315, 398); ctx.stroke();
    ctx.globalAlpha = 0.45; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(199, 431); ctx.quadraticCurveTo(258, 448, 316, 429); ctx.moveTo(165, 333); ctx.quadraticCurveTo(183, 346, 194, 358); ctx.moveTo(349, 331); ctx.quadraticCurveTo(331, 346, 322, 358); ctx.stroke();
    if ([3, 4, 7, 8].includes(legend.style)) {
      ctx.beginPath(); ctx.moveTo(174, 244); ctx.quadraticCurveTo(205, 229, 238, 245); ctx.moveTo(277, 244); ctx.quadraticCurveTo(310, 227, 341, 243); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    if (legend.style === 9) {
      // Pollock's rough stubble, kept subtle enough not to flatten the face.
      ctx.fillStyle = '#493b35'; ctx.globalAlpha = 0.56;
      for (let i = 0; i < 56; i++) ellipse(178 + rng() * 158, 365 + rng() * 85, 1.5, 1.5, '#493b35');
      ctx.globalAlpha = 1;
    }
    if ([0, 5, 7].includes(legend.style)) {
      ctx.strokeStyle = spark; ctx.lineWidth = 15;
      for (let y = 522; y < 640; y += 34) { ctx.beginPath(); ctx.moveTo(82, y); ctx.lineTo(430, y); ctx.stroke(); }
    } else if (legend.style === 11) {
      for (let y = 530; y < 640; y += 30) for (let x = 110; x < 410; x += 30) ellipse(x, y, 6, 6, spark);
    }
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
    const lines = String(text).split('\n');
    const lineHeight = size * 1.22;
    const firstY = h / 2 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, index) => ctx.fillText(line, w / 2, firstY + index * lineHeight));
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
    // Keep these as explicit finite curves rather than arc() calls. A few
    // browsers surface an IndexSizeError from the canvas arc fast-path here
    // even though the calculated radii are positive.
    for (const [px, radius] of [[-60, 15], [-14, 23], [42, 15], [90, 9]]) {
      ctx.beginPath();
      ctx.moveTo(px, 20 - radius);
      ctx.bezierCurveTo(px + radius, 20 - radius, px + radius, 20 + radius, px, 20 + radius);
      ctx.bezierCurveTo(px - radius, 20 + radius, px - radius, 20 - radius, px, 20 - radius);
      ctx.closePath();
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
  #t = 0;
  #documentaScarred;

  constructor(scene, { documentaScarred = false } = {}) {
    this.#scene = scene;
    this.#splatTex = splatTexture();
    this.#documentaScarred = documentaScarred;
    this.zones = new Map();
    this.current = null;
    this.#buildGarret();
    this.#buildGalleria();
    this.#buildDocumenta();
    this.#buildBiennaleWaiting();
    this.#buildVault();
    this.#buildInvisibleCollection();
    this.#buildLeatherLatex();
    this.#buildGildedFork();
    this.#buildMaxPro();
    this.#buildDildoBall();
    this.#buildDaylightClub();
    this.#buildUpAndCumming();
    this.#buildVacantEditions();
    this.#buildHairSalon();
    this.#buildRageRoom();
    this.#buildDeathMetal();
    this.#buildPublicRestroom();
    this.#buildBlackForest();
    this.#buildListeningRoom();
    this.#buildMtvCribs();
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
      documenta:    { x: -9.6, z: 6.9,   ry: Math.PI },
      biennaleWaiting: { x: -14.7, z: 8.9, ry: Math.PI },
      vault:        { x: -5.45, z: 4.15,  ry: Math.PI / 2 },
      invisibleCollection: { x: -7.65, z: 5.15, ry: Math.PI },
      leatherLatex: { x: -9.35, z: 4.65,  ry: Math.PI },
      gildedFork:   { x: 8.45,  z: 5.75,  ry: Math.PI },
      maxPro:       { x: -18.4, z: 9.75,  ry: Math.PI },
      dildoBall:    { x: -6.35, z: 4.75,  ry: Math.PI },
      daylightClub: { x: 8.4,   z: 5.25,  ry: Math.PI },
      upAndCumming: { x: 7.9,   z: 6.35,  ry: Math.PI },
      vacantEditions: { x: 7.55, z: 5.45, ry: Math.PI },
      rageRoom: { x: 9.1, z: 5.1, ry: Math.PI },
      listeningRoom: { x: 0, z: -1.85, ry: 0 },
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
      z.interactables.push({ id: `record-player-${key}`, type: 'recordPlayer', label: 'Open the record case', pos: new THREE.Vector3(p.x, 0.9, p.z), radius: 2.05 });
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
      clueKey: 'provenanceSeen', requiresPainting: true,
      clueLines: [
        'A carbon copy has appeared beneath the rejection letters. It carries a red dot and lot number {{lot}}.',
        'In the smallest type: “For the archive.” You have not agreed to an archive.',
      ],
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
    hangingArt(z, { x: -8.78, y: 1.9, z: -2.5, ry: Math.PI / 2, seed: 103 });
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
    const archiveDot = new THREE.Mesh(
      new THREE.CircleGeometry(0.075, 18),
      new THREE.MeshBasicMaterial({ color: 0xc3263e, transparent: true, opacity: 0 })
    );
    archiveDot.position.set(-1.73, 0.75, -6.22);
    archiveDot.userData.noSplat = true;
    const archiveLabel = plane(z, {
      w: 0.85, h: 0.14, x: -1.2, y: 0.72, z: -6.22,
      material: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }),
      noSplat: true, name: 'archive label',
    });
    z.group.add(archiveDot);
    z.archiveDot = archiveDot;
    z.archiveLabel = archiveLabel;
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
    door(z, { x: -8.8, z: -4.65, ry: Math.PI / 2, label: 'DOCUMENTA →', to: 'documenta' });
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
    door(z, { x: -6.7, z: -6.62, ry: 0, label: 'COCKBURN →', to: 'blackForest' });
    door(z, { x: -6.35, z: 6.62, ry: Math.PI, label: 'PUBLIC RESTROOM →', to: 'publicRestroom' });
    door(z, { x: 6.8, z: -6.62, ry: 0, label: 'THE GLASS BOXES →', to: 'rageRoom' });
    door(z, { x: -8.8, z: 4.4, ry: Math.PI / 2, label: 'BARBIE DEATH METAL →', to: 'deathMetal' });
    door(z, { x: 3.45, z: -6.62, ry: 0, label: 'THE LISTENING ROOM →', to: 'listeningRoom' });
    door(z, { x: 3.45, z: 6.62, ry: Math.PI, label: 'THE BIENNALE OF WAITING →', to: 'biennaleWaiting' });


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
  /*  DOCUMENTA: THE DOCUMENTING                                */
  /* ---------------------------------------------------------- */
  #buildDocumenta() {
    const z = this.#newZone('documenta');
    shell(z, { w: 26, d: 18, floorColor: 0xb7b8b5, wallColor: 0xe8e7e1, ceilColor: 0xd8d9d7, h: 4.2 });
    z.spawn.set(-10.45, 0, 0);
    z.spawnYaw = -Math.PI / 2;
    z.fog = { color: 0x181b1e, density: 0.017 };

    const white = mat(0xeeeeea, { roughness: 0.42 });
    const office = mat(0x2a2d31, { roughness: 0.5, metalness: 0.18 });
    const cable = mat(0x18191c, { roughness: 0.7 });
    const accent = mat(0xc8323f, { roughness: 0.6 });
    const qrMap = canvasTexture(128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#f5f3eb'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#17191c';
      for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) {
        if (((x * 7 + y * 11 + x * y) % 5) < 2) ctx.fillRect(8 + x * 5.3, 8 + y * 5.3, 5.4, 5.4);
      }
      for (const [x, y] of [[7, 7], [84, 7], [7, 84]]) {
        ctx.fillStyle = '#f5f3eb'; ctx.fillRect(x, y, 37, 37);
        ctx.fillStyle = '#17191c'; ctx.fillRect(x + 3, y + 3, 31, 31);
        ctx.fillStyle = '#f5f3eb'; ctx.fillRect(x + 9, y + 9, 19, 19);
        ctx.fillStyle = '#17191c'; ctx.fillRect(x + 14, y + 14, 9, 9);
      }
    });

    // Temporary architecture that has somehow become permanent.
    box(z, { w: 0.18, h: 3.4, d: 5.6, x: -7.25, z: -5.7, material: white });
    box(z, { w: 0.18, h: 3.4, d: 4.8, x: 2.95, z: 5.7, material: white });
    box(z, { w: 5.4, h: 3.4, d: 0.18, x: 10.1, z: 2.85, material: white });
    box(z, { w: 5.4, h: 3.4, d: 0.18, x: 10.1, z: -2.85, material: white });

    // Fluorescent grid: very bright, very neutral, absolutely implicated.
    const fluorescentMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0xe9f3ee, emissiveIntensity: 2.2, roughness: 0.2,
    });
    for (const x of [-9, -5, -1, 3, 7, 11]) {
      for (const zz of [-6, 0, 6]) {
        box(z, { w: 1.45, h: 0.055, d: 0.17, x, y: 4.02, z: zz, material: fluorescentMat, solid: false, noSplat: true });
      }
    }
    z.group.add(new THREE.HemisphereLight(0xf2f5ef, 0x676a70, 1.45));

    // Huge institutional heading and its smaller legal correction.
    plane(z, {
      w: 8.2, h: 0.82, x: -7.4, y: 3.38, z: -8.78,
      material: new THREE.MeshBasicMaterial({ map: textTexture('DOCUMENTA: THE DOCUMENTING', { fg: '#17191c', bg: '#efeee8', size: 43, w: 1100, h: 120 }), transparent: true }),
      name: 'documentaMonitor',
    });
    plane(z, {
      w: 5.4, h: 0.28, x: -7.4, y: 2.82, z: -8.77,
      material: new THREE.MeshBasicMaterial({ map: textTexture('THE EXHIBITION HAS NOT BEGUN. DOCUMENTATION IS NEARLY COMPLETE.', { fg: '#8b1f2a', size: 22, w: 1200, h: 90 }), transparent: true }),
    });
    for (let i = 0; i < 7; i++) {
      plane(z, {
        w: 0.58, h: 0.58, x: -9 + i * 3, y: 1.25 + (i % 2) * 0.35, z: 8.78, ry: Math.PI,
        material: new THREE.MeshBasicMaterial({ map: qrMap }), name: 'documenta QR label',
      });
    }

    // STATION ONE — Accreditation and its paper avalanche.
    box(z, { w: 3.6, h: 1.02, d: 0.9, x: -9.0, z: -3.55, material: office, name: 'documentaBadgePrinter' });
    const badgePrinter = box(z, { w: 1.18, h: 0.55, d: 0.72, x: -9.0, y: 1.02, z: -3.55, material: accent, solid: false, name: 'documentaBadgePrinter' });
    for (let i = 0; i < 5; i++) {
      const clipboard = plane(z, {
        w: 0.36, h: 0.52, x: -10.25 + i * 0.62, y: 1.57 + i * 0.006, z: -3.48 + (i % 2) * 0.18,
        rx: -Math.PI / 2, material: new THREE.MeshBasicMaterial({ map: textTexture(i % 2 ? 'CONSENT\nASSUMED' : 'RELEASE\nPENDING', { fg: '#24262a', bg: '#eee9dc', size: 24, w: 360, h: 520 }) }),
        name: 'documenta consent clipboard',
      });
      clipboard.rotation.z = (i - 2) * 0.09;
    }
    const badgeSign = plane(z, {
      w: 2.9, h: 0.38, x: -9.0, y: 2.08, z: -4.02,
      material: new THREE.MeshBasicMaterial({ map: textTexture('1 · ACCREDITATION · PRESS E', { fg: '#17191c', bg: '#f4f2eb', size: 32, w: 900 }), transparent: true }),
      name: 'documentaBadgePrinter',
    });
    const badgePapers = [];
    for (let i = 0; i < 28; i++) {
      const paper = new THREE.Mesh(
        new THREE.PlaneGeometry(0.28, 0.18),
        new THREE.MeshBasicMaterial({ map: textTexture(i % 3 === 0 ? 'ARTIST' : i % 3 === 1 ? 'SUBJECT' : 'AVAILABLE', { fg: '#191a1d', bg: '#f4f2e8', size: 18, w: 280, h: 180 }), side: THREE.DoubleSide })
      );
      paper.position.set(-10.45 + (i % 8) * 0.4, 0.02 + Math.floor(i / 8) * 0.008, -2.75 + Math.floor(i / 8) * 0.42);
      paper.rotation.set(-Math.PI / 2, 0, (i * 1.73) % Math.PI);
      paper.visible = false;
      paper.userData.baseY = paper.position.y;
      paper.userData.phase = i * 0.63;
      paper.userData.noSplat = true;
      z.group.add(paper);
      badgePapers.push(paper);
    }
    z.interactables.push({
      id: 'documenta-accreditation', type: 'documentaAccreditation', label: 'Accredit yourself — issue several identities',
      pos: new THREE.Vector3(-9.0, 1.2, -3.25), radius: 2.25,
    });

    // A reusable camera/tripod. The hero lens is a real paint target.
    const documentaCameras = [];
    const buildCamera = ({ x, zz, ry = 0, hero = false, scale = 1 }) => {
      const g = new THREE.Group();
      g.position.set(x, 0, zz); g.rotation.y = ry; g.scale.setScalar(scale);
      const legMat = mat(0x24262b, { roughness: 0.4, metalness: 0.65 });
      for (const a of [-0.55, 0, 0.55]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, 1.35, 7), legMat);
        leg.position.set(Math.sin(a) * 0.32, 0.68, Math.cos(a) * 0.2);
        leg.rotation.z = Math.sin(a) * 0.16;
        g.add(leg);
      }
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.36, 0.42), office);
      body.position.y = 1.46; body.name = hero ? 'documentaCameraLens' : 'documenta camera';
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.17, 0.28, 18), mat(0x0a0b0e, { roughness: 0.15, metalness: 0.75 }));
      lens.rotation.x = Math.PI / 2; lens.position.set(0, 1.46, -0.32);
      lens.name = hero ? 'documentaCameraLens' : 'documenta camera lens';
      lens.userData.documentaCameraLens = hero;
      const tally = new THREE.PointLight(0xff283f, hero ? 2.2 : 0.7, 2.6, 2);
      tally.position.set(0.21, 1.61, -0.22);
      g.add(body, lens, tally);
      z.group.add(g);
      const camera = { group: g, body, lens, tally, baseRy: ry };
      documentaCameras.push(camera);
      return camera;
    };

    // STATION TWO — the camera staring back down the entrance axis.
    const heroCamera = buildCamera({ x: -1.05, zz: 0, ry: Math.PI / 2, hero: true, scale: 1.18 });
    plane(z, {
      w: 4.1, h: 0.42, x: -1.05, y: 2.85, z: -2.0,
      material: new THREE.MeshBasicMaterial({ map: textTexture('2 · LIVE DOCUMENTATION · PAINT THE LENS', { fg: '#17191c', bg: '#f4f2eb', size: 29, w: 980 }), transparent: true }),
    });
    box(z, { w: 3.5, h: 0.12, d: 3.5, x: -1.05, z: 0, material: mat(0xd9d8d1), solid: false, name: 'documentation capture zone' });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      buildCamera({ x: -1.05 + Math.cos(a) * 3.25, zz: Math.sin(a) * 3.2, ry: -a + Math.PI / 2, scale: 0.72 });
    }

    // Recursive feeds are deliberately fake: cheap canvas labels are funnier
    // than an expensive real feedback buffer and do not punish low-end GPUs.
    const monitorMats = [];
    for (let i = 0; i < 9; i++) {
      const mx = -3.8 + (i % 5) * 1.9;
      const my = i < 5 ? 2.65 : 1.35;
      const normalMap = textTexture(`LIVE ${String(i + 1).padStart(2, '0')} · CAMERA ${String((i + 2) % 9 + 1).padStart(2, '0')} FILMING CAMERA ${String(i + 1).padStart(2, '0')}`, { fg: '#d8f1df', bg: '#11161a', size: 23, w: 600, h: 350 });
      const screenMat = new THREE.MeshBasicMaterial({ map: normalMap });
      screenMat.userData.normalMap = normalMap;
      box(z, { w: 1.68, h: 1.02, d: 0.12, x: mx, y: my - 0.51, z: -8.72, material: mat(0x17191d), solid: false, noSplat: true });
      plane(z, { w: 1.55, h: 0.88, x: mx, y: my, z: -8.64, material: screenMat, name: 'documentaMonitor' });
      monitorMats.push(screenMat);
    }

    // A permanent tell from a past run: one monitor never came back online.
    const staticTex = this.#documentaScarred
      ? canvasTexture(96, 54, (ctx, w, h) => {
          for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const v = (Math.random() * 255) | 0;
            ctx.fillStyle = `rgb(${v},${v},${v})`;
            ctx.fillRect(x, y, 1, 1);
          }
        })
      : null;

    // STATION THREE — archive intake, reached after the lens is corrupted.
    box(z, { w: 3.3, h: 0.92, d: 1.15, x: 4.95, z: 5.3, material: office, name: 'documentaArchiveScanner' });
    const scanner = box(z, { w: 1.45, h: 0.23, d: 0.82, x: 4.95, y: 0.92, z: 5.3, material: accent, solid: false, name: 'documentaArchiveScanner' });
    scanner.userData.documentaArchiveScanner = true;
    const subjectMat = new THREE.MeshStandardMaterial({ color: 0x17191d, roughness: 0.85 });
    const subject = plane(z, { w: 1.24, h: 1.52, x: 6.05, y: 2.05, z: 5.86, ry: Math.PI, material: subjectMat, name: 'documentaArchiveScanner' });
    const subjectLabel = plane(z, {
      w: 4.8, h: 0.5, x: 4.95, y: 2.96, z: 5.86, ry: Math.PI,
      material: new THREE.MeshBasicMaterial({ map: textTexture('3 · ARCHIVE INTAKE · PRESS Q TO APPRAISE THE SCANNER', { fg: '#17191c', bg: '#f4f2eb', size: 25, w: 1100 }), transparent: true }),
      name: 'documentaArchiveScanner',
    });
    z.interactables.push({
      id: 'documenta-archive-help', type: 'flavor', label: 'Archive Intake — press Q to appraise', title: 'ARCHIVE INTAKE',
      pos: new THREE.Vector3(4.95, 1.1, 4.85), radius: 2.2,
      lines: ['The scanner is waiting to value itself. Press Q while looking directly at it.', 'No intake occurs before accreditation and lens corruption. Bureaucracy respects sequence.'],
    });

    // A permanent tell from a past run: nobody ever explains these.
    if (this.#documentaScarred) {
      const crackTex = canvasTexture(256, 256, (ctx, w, h) => {
        ctx.strokeStyle = 'rgba(20,18,16,0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        let cx = w * 0.5, cy = 0;
        ctx.moveTo(cx, cy);
        for (let i = 0; i < 9; i++) {
          cx += (Math.random() - 0.5) * 46;
          cy += h / 9;
          ctx.lineTo(cx, cy);
        }
        ctx.stroke();
        ctx.lineWidth = 1;
        for (let b = 0; b < 3; b++) {
          const bx = w * (0.3 + Math.random() * 0.4), by = h * (0.2 + Math.random() * 0.6);
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + (Math.random() - 0.5) * 60, by + (Math.random() - 0.5) * 60);
          ctx.stroke();
        }
      });
      const scorchTex = canvasTexture(256, 256, (ctx, w, h) => {
        const grad = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
        grad.addColorStop(0, 'rgba(15,12,10,0.5)');
        grad.addColorStop(0.6, 'rgba(15,12,10,0.22)');
        grad.addColorStop(1, 'rgba(15,12,10,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      });
      plane(z, {
        w: 1.8, h: 2.0, x: 8.3, y: 0.011, z: 0, rx: -Math.PI / 2,
        material: new THREE.MeshBasicMaterial({ map: crackTex, transparent: true }), name: 'documenta scar',
      });
      plane(z, {
        w: 2.8, h: 2.8, x: 10.6, y: 0.012, z: 0, rx: -Math.PI / 2,
        material: new THREE.MeshBasicMaterial({ map: scorchTex, transparent: true }), name: 'documenta scar',
      });
    }

    // Gate and boss office. The collider is removed when all three stations
    // are corrupted; the bars then rise into the ceiling.
    const gate = new THREE.Group(); gate.position.set(7.45, 0, 0); z.group.add(gate);
    for (let i = -4; i <= 4; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.09, 3.45, 0.09), mat(0x555a60, { roughness: 0.3, metalness: 0.82 }));
      bar.position.set(0, 1.72, i * 0.42); gate.add(bar);
    }
    const gateLabel = plane(z, {
      w: 4.0, h: 0.42, x: 7.38, y: 3.66, z: 0, ry: -Math.PI / 2,
      material: new THREE.MeshBasicMaterial({ map: textTexture('HEAD OF DOCUMENTATION · METADATA REQUIRED', { fg: '#c8323f', bg: '#ecebe5', size: 25, w: 1000 }), transparent: true }),
    });
    const gateCollider = { minX: 7.18, maxX: 7.72, minZ: -2.15, maxZ: 2.15 };
    z.colliders.push(gateCollider);

    // Boss office: a chair, a server altar, and the authoritative description.
    box(z, { w: 3.1, h: 0.82, d: 1.2, x: 10.55, z: 0, material: office, name: 'metadata desk' });
    for (const zz of [-2.9, 2.9]) {
      box(z, { w: 1.4, h: 3.1, d: 1.0, x: 11.5, z: zz, material: mat(0x171a1e, { roughness: 0.25, metalness: 0.42 }), name: 'server archive' });
      for (let i = 0; i < 7; i++) {
        const led = new THREE.PointLight(i % 3 ? 0x60ff9c : 0xff3148, 0.45, 1.2, 2);
        led.position.set(10.76, 0.45 + i * 0.38, zz - 0.34 + (i % 2) * 0.68); z.group.add(led);
      }
    }
    const authorityMat = new THREE.MeshBasicMaterial({ map: textTexture('THE AUTHORITATIVE DESCRIPTION\nSUPERSEDES THE EVENT', { fg: '#f0eee5', bg: '#16191d', size: 37, w: 900, h: 300 }) });
    plane(z, { w: 4.5, h: 1.5, x: 12.76, y: 2.25, z: 0, ry: -Math.PI / 2, material: authorityMat, name: 'documentaMonitor' });

    // Moving camera crews: simple articulated operators on intersecting orbits.
    const crews = [];
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.72, 0.24), mat(i % 2 ? 0x353941 : 0x202329)); torso.position.y = 0.92;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 9), mat(0xc99878)); head.position.y = 1.46;
      const rig = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.38), office); rig.position.set(0, 1.34, -0.34);
      const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.35, 7), cable); boom.rotation.z = Math.PI / 2; boom.position.set(0.35, 1.72, 0);
      g.add(torso, head, rig, boom); z.group.add(g);
      crews.push({ group: g, torso, head, phase: i * 1.57, radiusX: 3.6 + i * 0.45, radiusZ: 2.8 + (i % 2) * 0.7, speed: 0.13 + i * 0.014 });
    }

    // Cables and empty plinths: documentation has occupied every useful path.
    for (let i = 0; i < 11; i++) {
      box(z, { w: 0.035, h: 0.025, d: 4.5 + (i % 3), x: -5.5 + i * 1.05, y: 0.005, z: (i % 2 ? 2.6 : -2.6), ry: (i - 5) * 0.09, material: cable, solid: false, noSplat: true });
    }
    for (const [x, zz] of [[-5.2, 5.2], [1.8, 5.5], [3.6, -4.7], [6.0, -5.6]]) {
      box(z, { w: 0.72, h: 0.92, d: 0.72, x, z: zz, material: white, name: 'empty documented plinth' });
      const tinyCam = buildCamera({ x: x + 1.0, zz, ry: Math.PI / 2, scale: 0.42 });
      tinyCam.group.userData.plinthCamera = true;
    }

    door(z, { x: -12.8, z: 0, ry: Math.PI / 2, label: '← GALLERIA BIANCA', to: 'galleria' });

    z.anchors['doc-consent'] = new THREE.Vector3(-9.6, 0, -5.2);
    z.anchors['doc-timecode'] = new THREE.Vector3(-5.5, 0, 3.8);
    z.anchors['doc-caption'] = new THREE.Vector3(-2.8, 0, -4.9);
    z.anchors['doc-qr'] = new THREE.Vector3(1.7, 0, 4.0);
    z.anchors['doc-witness'] = new THREE.Vector3(3.5, 0, -4.5);
    z.anchors['doc-archive'] = new THREE.Vector3(5.6, 0, 6.5);
    z.anchors['doc-head'] = new THREE.Vector3(10.35, 0, -1.35);
    z.anchorYaws = { 'doc-head': -Math.PI / 2 };
    z.waypoints = [
      new THREE.Vector3(-10, 0, 4.8), new THREE.Vector3(-6.2, 0, 5.8),
      new THREE.Vector3(-5.8, 0, -2.0), new THREE.Vector3(-2.6, 0, 4.7),
      new THREE.Vector3(0.7, 0, -4.2), new THREE.Vector3(2.5, 0, 2.1),
      new THREE.Vector3(4.8, 0, -5.0), new THREE.Vector3(5.7, 0, 5.8),
    ];
    z.animated.documenta = {
      badgePrinter, badgeSign, badgePapers, heroCamera, monitorMats, subject, subjectLabel,
      gate, gateLabel, gateCollider, gateOpen: false, crews, cameras: documentaCameras, authorityMat,
      accredited: false, cameraCorrupted: false, archiveCorrupted: false,
      complete: false, outcome: null, shutterT: 0.7, paperT: 0,
      scarred: this.#documentaScarred, staticTex,
    };
  }

  /* ---------------------------------------------------------- */
  /*  THE BIENNALE OF WAITING                                  */
  /* ---------------------------------------------------------- */
  #buildBiennaleWaiting() {
    const z = this.#newZone('biennaleWaiting');
    shell(z, { w: 34, d: 24, floorColor: 0xb8b9b6, wallColor: 0xeeeDE7, ceilColor: 0xd8d8d2, h: 4.15 });
    z.spawn.set(-15.2, 0, 0);
    z.spawnYaw = -Math.PI / 2;
    z.fog = { color: 0x161719, density: 0.018 };

    z.group.add(new THREE.HemisphereLight(0xf4f1e8, 0x35373d, 1.15));
    for (const [x, zz] of [[-13, -6], [-13, 6], [-5, 0], [3, -6], [3, 6], [10, -6], [10, 6], [15, 0]]) {
      const light = new THREE.PointLight(0xf4f0df, 24, 11, 1.65);
      light.position.set(x, 3.45, zz);
      z.group.add(light);
    }

    const white = mat(0xefeee8, { roughness: 0.84 });
    const black = mat(0x17181d, { roughness: 0.52, metalness: 0.22 });
    const chrome = mat(0x73777d, { roughness: 0.3, metalness: 0.78 });
    const red = mat(0xb52d35, { roughness: 0.72 });
    const blue = mat(0x345b7d, { roughness: 0.72 });
    const yellow = mat(0xe0bc3e, { roughness: 0.68 });
    const dampMat = new THREE.MeshStandardMaterial({ color: 0x55717d, transparent: true, opacity: 0.42, roughness: 0.22 });

    const makeLabel = (text, x, zz, { w = 3.4, h = 0.55, ry = 0, fg = '#1b1c20', bg = '#f4f2eb', name = '' } = {}) =>
      plane(z, { w, h, x, y: 2.55, z: zz, ry, material: new THREE.MeshBasicMaterial({ map: textTexture(text, { fg, bg, size: 32, w: 900, h: 170 }), transparent: true }), name });

    const beltPosts = [];
    const makeLane = (id, bounds, color = 0x1d1e23) => {
      const y = 0.72;
      const points = [
        [bounds.minX, bounds.minZ], [bounds.maxX, bounds.minZ],
        [bounds.minX, bounds.maxZ], [bounds.maxX, bounds.maxZ],
      ];
      for (const [x, zz] of points) {
        const post = cylinder(z, { rT: 0.055, rB: 0.07, h: y, x, z: zz, material: chrome, seg: 10, solid: false, noSplat: true });
        post.userData.waitingLane = id;
        beltPosts.push(post);
      }
      for (const zz of [bounds.minZ, bounds.maxZ]) {
        const rope = box(z, { w: bounds.maxX - bounds.minX, h: 0.045, d: 0.045, x: (bounds.minX + bounds.maxX) / 2, y, z: zz, material: mat(color), solid: false, noSplat: true });
        rope.userData.waitingLane = id;
      }
    };

    const makeFigure = (x, zz, suit = 0x2b2d35, skin = 0xc58e6f, scale = 1, faceId = 'waiting-guest') => {
      const g = new THREE.Group();
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.54, 4, 8), mat(suit, { roughness: 0.88 }));
      torso.position.y = 1.05;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), mat(skin, { roughness: 0.95 }));
      head.position.y = 1.62;
      // The queue visitors are bespoke procedural figures, not NPC defs, so
      // give them the same deterministic ridiculous-face sticker explicitly.
      head.add(ridiculousFaceOverlay({ id: faceId }, 0.34, 0.34, 0, 0.205));
      const legs = [];
      for (const lx of [-0.1, 0.1]) {
        const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.48, 3, 6), mat(0x1a1b20));
        leg.position.set(lx, 0.43, 0); g.add(leg); legs.push(leg);
      }
      g.add(torso, head); g.position.set(x, 0, zz); g.scale.setScalar(scale);
      g.traverse((o) => { o.userData.noSplat = true; });
      z.group.add(g);
      return { group: g, torso, head, legs };
    };

    // Four preliminary queues occupy the western concourse.
    const lanes = {
      accreditation: { minX: -15.5, maxX: -11.4, minZ: -3.2, maxZ: 3.2 },
      closed: { minX: -10.5, maxX: -6.7, minZ: -9.6, maxZ: -4.0 },
      recursive: { minX: -10.5, maxX: -6.7, minZ: 4.0, maxZ: 9.6 },
      vip: { minX: -5.7, maxX: -1.1, minZ: -3.2, maxZ: 3.2 },
      nordic: { minX: 0.3, maxX: 5.6, minZ: 3.7, maxZ: 9.7 },
      german: { minX: 6.2, maxX: 11.5, minZ: 3.7, maxZ: 9.7 },
      american: { minX: 11.8, maxX: 16.1, minZ: -3.1, maxZ: 3.1 },
      french: { minX: 6.2, maxX: 11.5, minZ: -9.7, maxZ: -3.7 },
      british: { minX: 0.3, maxX: 5.6, minZ: -9.7, maxZ: -3.7 },
    };
    for (const [id, bounds] of Object.entries(lanes)) makeLane(id, bounds, id === 'american' ? 0x9b2235 : id === 'french' ? 0x315a8a : 0x24262c);

    box(z, { w: 0.9, h: 1.05, d: 0.75, x: -13.45, z: 0, material: black, name: 'waitingTicketMachine' });
    const ticketGlow = plane(z, { w: 0.36, h: 0.18, x: -13.45, y: 1.2, z: -0.39, rx: 0, material: new THREE.MeshBasicMaterial({ map: textTexture('A-404', { fg: '#d5f6d9', bg: '#102016', size: 38 }), transparent: true }), name: 'waitingTicketMachine' });
    makeLabel('1 · ACCREDITATION\nTAKE A NUMBER. BECOME SEVERAL PEOPLE.', -13.45, -3.35, { w: 4.2, h: 0.7 });
    z.interactables.push({ id: 'waiting-accreditation', type: 'waitingQueue', queue: 'accreditation', label: 'Join accreditation queue', pos: new THREE.Vector3(-13.45, 1.1, 0), radius: 2.25 });

    const closedPlaque = makeLabel('2 · THE ARTWORK\nCLOSED YESTERDAY', -8.6, -9.82, { w: 3.5, h: 0.75, name: 'waitingClosedArtwork' });
    closedPlaque.userData.waitingClosedArtwork = true;
    box(z, { w: 2.4, h: 2.8, d: 0.18, x: -8.6, z: -9.92, material: white, name: 'waitingClosedArtwork' });
    z.interactables.push({ id: 'waiting-closed', type: 'waitingQueue', queue: 'closed', label: 'Join queue for yesterday’s artwork', pos: new THREE.Vector3(-8.6, 1.1, -5.2), radius: 2.25 });

    const recursiveSigns = [];
    for (let i = 0; i < 3; i++) {
      const sign = makeLabel(`${i + 1} → QUEUE FOR QUEUE ${i + 2}`, -9.65 + (i % 2) * 2.1, 5.05 + i * 1.85, { w: 2.4, h: 0.42, name: 'waitingRecursiveSign' });
      recursiveSigns.push(sign);
    }
    z.interactables.push({ id: 'waiting-recursive', type: 'waitingQueue', queue: 'recursive', label: 'Join queue to enter another queue', pos: new THREE.Vector3(-8.6, 1.1, 5.2), radius: 2.25 });

    makeLabel('4 · VIP ACCESS\nTHIS QUEUE MOVES BACKWARD', -3.4, -3.35, { w: 4.2, h: 0.7, fg: '#e9d18a', bg: '#18191d', name: 'waitingVipBarrier' });
    const vipArrows = [];
    for (let i = 0; i < 4; i++) {
      const arrow = plane(z, { w: 0.8, h: 0.42, x: -1.8 - i * 0.95, y: 0.025, z: 0, rx: -Math.PI / 2, material: new THREE.MeshBasicMaterial({ map: textTexture('←', { fg: '#e8c15a', bg: 'rgba(0,0,0,0)', size: 70 }), transparent: true }), name: 'waitingVipBarrier' });
      vipArrows.push(arrow);
    }
    z.interactables.push({ id: 'waiting-vip', type: 'waitingQueue', queue: 'vip', label: 'Join the backward VIP queue', pos: new THREE.Vector3(-2.0, 1.1, 0), radius: 2.25 });

    // A low partition makes the pavilion court feel temporarily permanent.
    box(z, { w: 0.18, h: 3.25, d: 22.4, x: -0.25, z: 0, material: white, name: 'temporary pavilion wall' });
    makeLabel('NATIONAL PAVILION ENDURANCE COURT', 0.02, 0, { w: 5.4, h: 0.62, ry: -Math.PI / 2 });

    const pavilionSigns = {};
    const addPavilionSign = (key, text, x, zz, opts = {}) => {
      const sign = makeLabel(text, x, zz, { ...opts, name: `waiting${key[0].toUpperCase()}${key.slice(1)}Sign` });
      sign.userData.waitingPavilionSign = key;
      sign.userData.noSplat = false;
      pavilionSigns[key] = sign;
      return sign;
    };

    addPavilionSign('nordic', 'NORDIC PAVILION\nWE ARE SO SORRY', 2.95, 9.82, { w: 4.5, h: 0.72, fg: '#23455e' });
    box(z, { w: 2.2, h: 0.42, d: 0.62, x: 2.9, z: 7.15, material: mat(0x8b6a46), name: 'waitingNordicSign' });
    z.interactables.push({ id: 'waiting-nordic', type: 'waitingPavilion', pavilion: 'nordic', label: 'Join the Nordic queue', pos: new THREE.Vector3(2.9, 1.0, 5.1), radius: 2.15 });
    z.interactables.push({ id: 'waiting-nordic-support', type: 'waitingSupport', pavilion: 'nordic', label: 'Accept the apology', pos: new THREE.Vector3(2.9, 1.0, 7.2), radius: 1.9 });

    addPavilionSign('german', 'GERMAN PAVILION\nDOOR 1 OF ∞', 8.85, 9.82, { w: 4.5, h: 0.72 });
    const germanDoors = [];
    for (let i = 0; i < 4; i++) {
      const size = 3.3 - i * 0.62;
      const frame = box(z, { w: 0.16, h: size, d: size, x: 7.35 + i * 1.05, y: 0, z: 7.0, ry: Math.PI / 2, material: black, solid: false, name: 'waitingGermanDoor' });
      frame.userData.waitingGermanDoor = i;
      germanDoors.push(frame);
    }
    z.interactables.push({ id: 'waiting-german', type: 'waitingPavilion', pavilion: 'german', label: 'Join the German queue', pos: new THREE.Vector3(8.8, 1.0, 5.0), radius: 2.15 });
    z.interactables.push({ id: 'waiting-german-support', type: 'waitingSupport', pavilion: 'german', label: 'Open the next smaller door', pos: new THREE.Vector3(8.4, 1.2, 7.0), radius: 2.2 });

    addPavilionSign('american', 'AMERICAN PAVILION™\nGIFT SHOP SECURITY', 16.23, 0, { w: 4.8, h: 0.72, ry: -Math.PI / 2, fg: '#f7e6a5', bg: '#7d1930' });
    for (let i = 0; i < 3; i++) box(z, { w: 0.72, h: 1.4 + i * 0.18, d: 0.55, x: 14.1 + (i % 2) * 1.0, z: -1.15 + i * 1.15, material: i % 2 ? blue : red, name: 'waitingAmericanSponsor' });
    const sponsor = box(z, { w: 1.35, h: 0.9, d: 0.72, x: 13.4, z: 0, material: yellow, name: 'waitingAmericanSponsor' });
    sponsor.userData.waitingSupport = 'american';
    z.interactables.push({ id: 'waiting-american', type: 'waitingPavilion', pavilion: 'american', label: 'Join the sponsored queue', pos: new THREE.Vector3(12.8, 1.0, 0), radius: 2.0 });

    addPavilionSign('french', 'PAVILLON FRANÇAIS\nEN GRÈVE', 8.85, -9.82, { w: 4.5, h: 0.72, fg: '#234d76' });
    const placards = [];
    for (let i = 0; i < 4; i++) {
      const placard = plane(z, { w: 0.86, h: 0.52, x: 7.2 + i * 1.05, y: 1.75, z: -6.7 + (i % 2) * 0.7, material: new THREE.MeshBasicMaterial({ map: textTexture(i % 2 ? 'NON' : 'EN GRÈVE', { fg: '#202126', bg: '#eee7d8', size: 34 }), transparent: true }), name: 'waitingFrenchPlacard' });
      placards.push(placard);
    }
    z.interactables.push({ id: 'waiting-french', type: 'waitingPavilion', pavilion: 'french', label: 'Join the picket queue', pos: new THREE.Vector3(8.8, 1.0, -5.1), radius: 2.15 });
    z.interactables.push({ id: 'waiting-french-support', type: 'waitingSupport', pavilion: 'french', label: 'Join the strike chant', pos: new THREE.Vector3(8.8, 1.0, -7.0), radius: 2.0 });

    addPavilionSign('british', 'BRITISH PAVILION\nDAMP, AS INSTALLED', 2.95, -9.82, { w: 4.5, h: 0.72, fg: '#dbe8ea', bg: '#354b54' });
    const puddles = [];
    for (let i = 0; i < 6; i++) {
      const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.45 + i * 0.08, 20), dampMat.clone());
      puddle.position.set(1.0 + (i % 3) * 1.65, 0.014, -5.3 - Math.floor(i / 3) * 2.4);
      puddle.rotation.x = -Math.PI / 2; puddle.scale.setScalar(0.45); puddle.name = 'waitingBritishLeak'; puddle.userData.waitingSupport = 'british';
      z.group.add(puddle); puddles.push(puddle);
    }
    z.interactables.push({ id: 'waiting-british', type: 'waitingPavilion', pavilion: 'british', label: 'Join the damp queue', pos: new THREE.Vector3(2.9, 1.0, -5.1), radius: 2.15 });

    const scoreboard = plane(z, { w: 6.2, h: 2.7, x: -0.02, y: 2.15, z: -6.8, ry: -Math.PI / 2, material: new THREE.MeshBasicMaterial({ map: textTexture('QUEUE SURVIVAL\nWAITING FOR QUALIFICATION', { fg: '#d9f2dc', bg: '#102017', size: 43, w: 1200, h: 520 }), transparent: true }), name: 'waitingScoreboard' });
    const juryDesk = box(z, { w: 2.8, h: 1.02, d: 0.9, x: 14.35, z: 8.25, material: black, name: 'waitingJuryDesk' });
    makeLabel('INTERNATIONAL JURY\nRATIFICATION AFTER ATTRITION', 14.35, 9.82, { w: 4.2, h: 0.7, fg: '#e8c15a', bg: '#17181d', name: 'waitingJuryDesk' });
    z.interactables.push({ id: 'waiting-jury', type: 'waitingJury', label: 'Ask the jury to ratify the survivor', pos: new THREE.Vector3(14.35, 1.1, 8.25), radius: 2.35 });

    const visitors = [];
    const visitorDefs = [
      ['accreditation', [-14.6, -2.1], [-12.1, 2.1]], ['closed', [-9.7, -5.1], [-7.4, -8.6]],
      ['recursive', [-9.7, 5.2], [-7.4, 8.7]], ['vip', [-1.8, -2.0], [-5.0, 2.0]],
      ['nordic', [1.2, 4.8], [4.8, 8.7]], ['german', [7.0, 4.8], [10.7, 8.7]],
      ['american', [12.4, -2.2], [15.2, 2.2]], ['french', [7.0, -4.8], [10.7, -8.7]],
      ['british', [1.2, -4.8], [4.8, -8.7]],
    ];
    let vi = 0;
    for (const [lane, from, to] of visitorDefs) {
      for (let j = 0; j < 3; j++) {
        const figure = makeFigure(from[0], from[1], [0x34323b, 0x53616a, 0x6d4d52][(vi + j) % 3], [0xd2a080, 0x8a563e, 0xb87555][(vi + j) % 3], 0.92 + (j % 2) * 0.08, `waiting-${lane}-${j}`);
        visitors.push({ ...figure, lane, from: new THREE.Vector2(...from), to: new THREE.Vector2(...to), phase: (j / 3 + vi * 0.07) % 1, speed: lane === 'vip' ? -0.032 : 0.022 + j * 0.004 });
      }
      vi++;
    }

    door(z, { x: -16.8, z: 0, ry: Math.PI / 2, label: '← GALLERIA BIANCA', to: 'galleria' });
    z.anchors['waiting-marshal'] = new THREE.Vector3(-15.25, 0, -3.45);
    z.anchors['waiting-closed'] = new THREE.Vector3(-8.0, 0, -8.6);
    z.anchors['waiting-apologist'] = new THREE.Vector3(4.9, 0, 9.15);
    z.anchors['waiting-sponsor-a'] = new THREE.Vector3(15.6, 0, -2.45);
    z.anchors['waiting-sponsor-b'] = new THREE.Vector3(15.6, 0, 2.45);
    z.anchors['waiting-striker'] = new THREE.Vector3(10.9, 0, -8.95);
    z.anchors['waiting-damp'] = new THREE.Vector3(4.4, 0, -7.8);
    z.anchors['waiting-jury'] = new THREE.Vector3(12.0, 0, 6.1);
    z.anchorYaws = { 'waiting-jury': Math.PI, 'waiting-marshal': 0 };
    z.waypoints = Object.values(z.anchors).map((p) => p.clone());
    z.animated.waiting = {
      lanes, visitors, beltPosts, ticketGlow, recursiveSigns, vipArrows, pavilionSigns,
      germanDoors, placards, puddles, scoreboard, juryDesk,
      stage: 0, activeQueue: null, finalStarted: false, finalElapsed: 0,
      pavilions: {}, complete: false, winner: null, visualKey: '',
    };
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

    const archivePlate = plane(z, {
      w: 2.8, h: 0.38, x: 3.8, y: 2.05, z: -5.24,
      material: new THREE.MeshBasicMaterial({
        map: textTexture('ARCHIVE · EDITION OF ONE', { fg: '#e8c15a', bg: '#17151b', size: 32, w: 900, h: 140, font: '800' }),
      }),
      noSplat: true, name: 'archive plate',
    });
    z.archivePlate = archivePlate;
    z.interactables.push({
      id: 'vault-archive', type: 'flavor', label: 'Read the archive plate',
      pos: new THREE.Vector3(3.8, 1.8, -4.9), radius: 2.1,
      lines: [
        'The plate is smaller than the wall text and heavier than the painting deserves.',
        'The red dot is not a price. It is a decision someone made before you arrived.',
        'The archive has a file on the Artist. The file is not the work. Not yet.',
      ],
    });

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
    door(z, { x: -4.9, z: -5.32, ry: 0, label: 'THE INVISIBLE COLLECTION →', to: 'invisibleCollection' });

    z.waypoints = [
      new THREE.Vector3(-4, 0, -2.5), new THREE.Vector3(-1, 0, 1.8),
      new THREE.Vector3(2.5, 0, -1.6), new THREE.Vector3(-4.5, 0, 2.6),
      new THREE.Vector3(3.4, 0, 2.8),
    ];
  }

  /* ---------------------------------------------------------- */
  /*  THE INVISIBLE COLLECTION                                  */
  /* ---------------------------------------------------------- */
  #buildInvisibleCollection() {
    const z = this.#newZone('invisibleCollection');
    shell(z, { w: 20, d: 14, floorColor: 0xc8ccc6, wallColor: 0xe4e8e2, ceilColor: 0xf1f3ef });
    z.spawn.set(-8.35, 0, 0);
    z.spawnYaw = -Math.PI / 2;
    z.fog = { color: 0xd9ded8, density: 0.012 };

    // Fluorescent institutional ceiling grid: elegant enough to be expensive,
    // bleak enough to feel like a conservation office after closing.
    const fixtureMat = mat(0xf7fff4, { emissive: 0xd9f1df, emissiveIntensity: 0.75, roughness: 0.22 });
    for (const x of [-6, -2, 2, 6]) {
      for (const zz of [-4.5, 0, 4.5]) {
        box(z, { w: 2.1, h: 0.035, d: 0.34, x, y: 3.92, z: zz, material: fixtureMat, solid: false, noSplat: true, name: 'conservation fluorescent' });
        const light = new THREE.PointLight(0xdff5e5, 2.8, 8.5, 2.2);
        light.position.set(x, 3.65, zz);
        z.group.add(light);
      }
    }

    // Large live auction board. The texture is replaced only when valuation
    // state changes, so the room can persist without a DOM overlay dependency.
    const board = plane(z, {
      w: 6.5, h: 2.05, x: 2.5, y: 2.48, z: -6.78,
      material: new THREE.MeshBasicMaterial({
        map: textTexture('LIVE VALUATION  €15,000\nNO OBJECTS ADMITTED', { fg: '#c8f7d1', bg: '#102319', size: 52, w: 1200, h: 380, font: '800' }),
      }),
      noSplat: true, name: 'live valuation board',
    });
    board.userData.value = -1;

    const works = [
      { title: 'UNTITLED — AIR ON LOAN', x: -4.8, z: -3.25, w: 2.25, d: 1.55, h: 2.2 },
      { title: 'PORTRAIT OF THE COLLECTOR, FACING AWAY', x: 0, z: -3.2, w: 1.55, d: 1.25, h: 2.45 },
      { title: 'THE ABSENCE OF A HORSE', x: 4.65, z: -3.0, w: 2.75, d: 1.25, h: 1.8 },
      { title: 'MONUMENT TO SOMETHING THAT HAS LEFT', x: -2.8, z: 2.25, w: 1.7, d: 1.7, h: 3.0 },
      { title: 'A VERY EXPENSIVE CUBE', x: 3.2, z: 2.45, w: 1.65, d: 1.65, h: 1.65 },
    ];
    const tapeMat = new THREE.MeshBasicMaterial({ color: 0xe5e36d, transparent: true, opacity: 0.92, side: THREE.DoubleSide });
    const barrierMat = mat(0x222b27, { metalness: 0.52, roughness: 0.32 });
    const invisibleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, roughness: 1 });
    const alarmLights = [];
    const contactZones = [];
    const workMeshes = [];

    works.forEach((work, index) => {
      const pad = 0.48;
      const tw = work.w + pad * 2;
      const td = work.d + pad * 2;
      for (const [w, d, x, zz] of [
        [tw, 0.075, work.x, work.z - td / 2], [tw, 0.075, work.x, work.z + td / 2],
        [0.075, td, work.x - tw / 2, work.z], [0.075, td, work.x + tw / 2, work.z],
      ]) plane(z, { w, h: d, x, y: 0.016, z: zz, rx: -Math.PI / 2, material: tapeMat, noSplat: true, name: 'taped acquisition footprint' });

      const hidden = box(z, {
        w: work.w, h: work.h, d: work.d, x: work.x, z: work.z,
        material: invisibleMat.clone(), solid: true, noSplat: false, name: work.title,
      });
      hidden.userData.invisibleWorkIndex = index;
      workMeshes.push(hidden);
      contactZones.push({
        index, title: work.title,
        minX: work.x - work.w / 2 - 0.52, maxX: work.x + work.w / 2 + 0.52,
        minZ: work.z - work.d / 2 - 0.52, maxZ: work.z + work.d / 2 + 0.52,
        triggered: false,
      });

      // Two severe museum posts and a hovering title card are the only proof.
      for (const sx of [-1, 1]) {
        cylinder(z, { rT: 0.055, rB: 0.07, h: 0.86, x: work.x + sx * tw / 2, z: work.z + td / 2 + 0.16, material: barrierMat, seg: 12, solid: false, noSplat: true });
      }
      box(z, { w: tw, h: 0.035, d: 0.035, x: work.x, y: 0.72, z: work.z + td / 2 + 0.16, material: mat(0x9e1f2a), solid: false, noSplat: true });
      plane(z, {
        w: Math.min(3.3, tw + 0.65), h: 0.48, x: work.x, y: 0.48, z: work.z + td / 2 + 0.21, ry: Math.PI,
        material: new THREE.MeshBasicMaterial({ map: textTexture(`${String(index + 1).padStart(2, '0')}  ${work.title}`, { fg: '#17201c', bg: '#e9ece7', size: 23, w: 900, h: 145, font: '800' }) }),
        noSplat: true, name: 'invisible work label',
      });
      const alarm = new THREE.PointLight(0xff1f18, 0, 4.2, 2);
      alarm.position.set(work.x, 0.9, work.z);
      alarm.userData.base = 0;
      z.group.add(alarm);
      alarmLights.push(alarm);
      z.interactables.push({
        id: `invisible-work-${index}`, type: 'collectionAction', action: 'inspect', workIndex: index,
        label: `Inspect empty work ${index + 1}`, pos: new THREE.Vector3(work.x, 1.1, work.z + td / 2 + 0.55), radius: 1.55,
      });
    });

    // The paperwork spine: each station advances the clean institutional con.
    const stations = [
      ['authenticate', 'AUTHENTICATION\nEMPTY AIR / VERIFIED', -7.9, -5.95],
      ['damageClaim', 'INSURANCE\nINCIDENT / NO DAMAGE', -4.9, -5.95],
      ['reportStolen', 'REGISTRAR\nREPORT ABSENCE STOLEN', -1.8, -5.95],
      ['auction', 'AUCTION DESK\nCERTIFICATE ONLY', 6.95, -5.95],
    ];
    for (const [action, label, x, zz] of stations) {
      box(z, { w: 2.25, h: 0.82, d: 0.74, x, z: zz, material: mat(0x58635d, { metalness: 0.18, roughness: 0.5 }), noSplat: true, name: 'institutional desk' });
      plane(z, { w: 2.05, h: 0.52, x, y: 1.16, z: zz + 0.39, ry: Math.PI, material: new THREE.MeshBasicMaterial({ map: textTexture(label, { fg: '#dff5e5', bg: '#17231d', size: 25, w: 800, h: 190, font: '800' }) }), noSplat: true });
      z.interactables.push({ id: `collection-${action}`, type: 'collectionAction', action, label: label.split('\n')[0], pos: new THREE.Vector3(x, 1, zz + 0.9), radius: 1.65 });
    }

    // Final route choice occupies a freestanding acquisition gate.
    box(z, { w: 0.12, h: 2.55, d: 4.3, x: 9.25, z: 2.35, material: mat(0x1d2923), noSplat: true, name: 'acquisition gate' });
    for (const [action, label, zz, color] of [
      ['accept', 'ACCEPT\nACQUISITION', 1.25, '#f3d874'],
      ['declareEmpty', 'DECLARE THE\nCOLLECTION EMPTY', 3.45, '#c8f7d1'],
    ]) {
      plane(z, { w: 0.92, h: 1.2, x: 9.17, y: 1.55, z: zz, ry: -Math.PI / 2, material: new THREE.MeshBasicMaterial({ map: textTexture(label, { fg: color, bg: '#111a16', size: 28, w: 500, h: 650, font: '800' }) }), noSplat: true });
      z.interactables.push({ id: `collection-${action}`, type: 'collectionAction', action, label: label.replace('\n', ' '), pos: new THREE.Vector3(8.55, 1.2, zz), radius: 1.35 });
    }

    // Three intentionally over-serious staff figures. Faces are procedural but
    // include brows, noses, mouths, badges and distinct silhouettes.
    const staff = [];
    const staffDefs = [
      ['CHIEF CONSERVATOR OF NOTHING', -7.3, 4.95, 0xbcc8c2],
      ['SENIOR ABSENCE GUARD', 0.3, 5.65, 0x26312c],
      ['INSURANCE REGISTRAR', 6.6, 5.05, 0x8d918b],
    ];
    for (let i = 0; i < staffDefs.length; i++) {
      const [role, x, zz, suitColor] = staffDefs[i];
      const g = new THREE.Group();
      g.position.set(x, 0, zz);
      const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.82, 0.32), mat(0x202522)); legs.position.y = 0.41;
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.92, 0.38), mat(suitColor)); torso.position.y = 1.22;
      const headPivot = new THREE.Group(); headPivot.position.y = 1.96;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 18, 14), mat(i === 1 ? 0x8b5e43 : 0xc99170));
      head.scale.set(0.86, 1.08, 0.88);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 8), mat(i === 1 ? 0x82543d : 0xbe8163)); nose.rotation.x = Math.PI / 2; nose.position.set(0, -0.01, 0.25);
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.018, 0.012), mat(0x4c2825)); mouth.position.set(0, -0.115, 0.242);
      for (const ex of [-0.09, 0.09]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), mat(0x101513)); eye.position.set(ex, 0.055, 0.232); headPivot.add(eye);
        const brow = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.018, 0.014), mat(0x332923)); brow.position.set(ex, 0.115, 0.228); brow.rotation.z = ex < 0 ? 0.12 : -0.12; headPivot.add(brow);
      }
      headPivot.add(head, nose, mouth);
      const badge = plane(z, { w: 0.56, h: 0.19, x, y: 1.3, z: zz - 0.205, material: new THREE.MeshBasicMaterial({ map: textTexture(role, { fg: '#152019', bg: '#dff5e5', size: 16, w: 850, h: 160, font: '800' }) }), noSplat: true });
      z.group.remove(badge); badge.position.set(0, 0.12, -0.205); badge.rotation.y = Math.PI;
      g.add(legs, torso, headPivot, badge); g.rotation.y = Math.PI;
      g.traverse((o) => { o.userData.noSplat = true; });
      z.group.add(g);
      staff.push({ group: g, headPivot, baseX: x, phase: i * 1.7 });
    }

    door(z, { x: -9.8, z: 0, ry: Math.PI / 2, label: '← THE VAULT', to: 'vault' });
    z.animated.invisibleCollection = { board, works, workMeshes, alarmLights, contactZones, staff, alarmUntil: 0, alarmIndex: -1, value: 15000, clean: true, complete: false };
    z.waypoints = [new THREE.Vector3(-7, 0, 3), new THREE.Vector3(-4, 0, 0), new THREE.Vector3(0, 0, 0.5), new THREE.Vector3(5.5, 0, 0), new THREE.Vector3(7.5, 0, 4.5)];
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
      clueKey: 'privateCollectionSeen', requiresPainting: true,
      clueLines: [
        'Behind the glass, one frame uses the same cheap wood as the Artist’s Garret.',
        'A typed note says: “for the house.” The room is very pleased with itself.',
      ],
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
      clueKey: 'titleCirculating', requiresPainting: true,
      clueLines: [
        'A guest has written “{{title}}” beside a wine ring. The ink is dry. You have not shown it here.',
        'Underneath: “for the archive.” The table has become a press office.',
      ],
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

    // Two lightweight CC0 Poly Haven material sets give the oversized room a
    // photographed surface vocabulary: chipped painted concrete underfoot and
    // wrinkled leather across the ring equipment. All maps are local 1K JPGs.
    const maxProLoader = new THREE.TextureLoader();
    const maxProMap = (path, repeatX, repeatY, srgb = false) => {
      const tex = maxProLoader.load(encodeURI(`puplic/polyhaven/max-pro/${path}`));
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(repeatX, repeatY);
      tex.anisotropy = 4;
      if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };
    const concretePbr = {
      map: maxProMap('concrete_floor_painted/concrete_floor_painted_diff_1k.jpg', 10.5, 6, true),
      normalMap: maxProMap('concrete_floor_painted/concrete_floor_painted_nor_gl_1k.jpg', 10.5, 6),
      roughnessMap: maxProMap('concrete_floor_painted/concrete_floor_painted_rough_1k.jpg', 10.5, 6),
    };
    const leatherPbr = {
      map: maxProMap('fabric_leather_02/fabric_leather_02_diff_1k.jpg', 2.4, 2.4, true),
      normalMap: maxProMap('fabric_leather_02/fabric_leather_02_nor_gl_1k.jpg', 2.4, 2.4),
      roughnessMap: maxProMap('fabric_leather_02/fabric_leather_02_rough_1k.jpg', 2.4, 2.4),
    };

    // Weathered painted concrete — still a gallery floor, now with enough
    // scuffs and chipped pigment to remember every prior office match.
    plane(z, {
      w: w - 0.1, h: d - 0.1, x: 0, y: 0.011, z: 0, rx: -Math.PI / 2,
      material: new THREE.MeshStandardMaterial({
        color: 0xb8b9bc, ...concretePbr, roughness: 0.72, metalness: 0.025,
        normalScale: new THREE.Vector2(0.36, 0.36),
      }),
      noSplat: true, name: 'floor',
    });

    /* ---- KUNST 2000: newsroom boxing as an unresolved football fixture ---- */
    {
      const ringX = 8.2, ringZ = -1.2;
      const white = mat(0xf4f3ef, { roughness: 0.72 });
      const steel = mat(0x282c33, { metalness: 0.68, roughness: 0.28 });
      const blue = mat(0x1648d8, { roughness: 0.42 });
      const red = mat(0xd42632, { roughness: 0.42 });
      const leatherMaterial = (color, clearcoat = 0.46) => new THREE.MeshPhysicalMaterial({
        color, ...leatherPbr, roughness: 0.48, metalness: 0.02,
        normalScale: new THREE.Vector2(0.52, 0.52), clearcoat, clearcoatRoughness: 0.24,
      });
      const apronLeather = leatherMaterial(0x232938, 0.24);
      const canvasLeather = new THREE.MeshStandardMaterial({
        color: 0xd5d9dd, normalMap: leatherPbr.normalMap, roughnessMap: leatherPbr.roughnessMap,
        normalScale: new THREE.Vector2(0.22, 0.22), roughness: 0.76,
      });

      // Raised broadcast ring: stitched leather apron, four rope levels,
      // padded turnbuckles, corner steps and a canvas carrying its own chyron.
      box(z, { w: 6.55, h: 0.46, d: 5.35, x: ringX, z: ringZ, material: apronLeather, name: 'kunstRing' });
      plane(z, {
        w: 6.05, h: 4.85, x: ringX, y: 0.472, z: ringZ, rx: -Math.PI / 2,
        material: canvasLeather,
        noSplat: false, name: 'kunstCanvas',
      });
      for (const [dx, dz] of [[-3, -2.4], [3, -2.4], [-3, 2.4], [3, 2.4]]) {
        cylinder(z, { rT: 0.085, rB: 0.11, h: 1.78, x: ringX + dx, y: 0.46, z: ringZ + dz, material: steel, solid: false, noSplat: true });
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), steel);
        cap.position.set(ringX + dx, 2.27, ringZ + dz);
        cap.userData.noSplat = true;
        z.group.add(cap);
        const padMat = dx < 0 ? leatherMaterial(0xcf1f2c) : leatherMaterial(0x173fbd);
        for (const y of [0.93, 1.25, 1.57, 1.89]) {
          box(z, {
            w: 0.32, h: 0.24, d: 0.2, x: ringX + dx * 0.965, y: y - 0.12, z: ringZ + dz * 0.965,
            ry: Math.atan2(dx, dz), material: padMat, solid: false, noSplat: true, name: 'turnbuckle pad',
          });
        }
      }
      for (const [ropeIndex, y] of [0.93, 1.25, 1.57, 1.89].entries()) {
        const ropeMat = ropeIndex % 2 ? white : (ropeIndex === 0 ? blue : red);
        for (const dz of [-2.4, 2.4]) box(z, { w: 6.0, h: 0.052, d: 0.052, x: ringX, y, z: ringZ + dz, material: ropeMat, solid: false, noSplat: true });
        for (const dx of [-3, 3]) box(z, { w: 0.052, h: 0.052, d: 4.8, x: ringX + dx, y, z: ringZ, material: ropeMat, solid: false, noSplat: true });
      }
      plane(z, {
        w: 2.9, h: 0.58, x: ringX, y: 0.25, z: ringZ + 2.685,
        material: new THREE.MeshBasicMaterial({
          map: textTexture('MAX PRO  ·  ROUND ∞', { fg: '#f4f6fb', bg: '#151923', size: 45, w: 1000, h: 190, font: '900' }),
        }),
        noSplat: true, name: 'ring apron title',
      });
      plane(z, {
        w: 2.55, h: 1.1, x: ringX, y: 0.485, z: ringZ, rx: -Math.PI / 2,
        material: new THREE.MeshBasicMaterial({
          map: textTexture('KUNST 2000\n0 — 0', { fg: '#173c9f', bg: '#e8eaec', size: 52, w: 900, h: 390, font: '900' }),
          transparent: true,
        }),
        noSplat: true, name: 'ring canvas logo',
      });
      for (let step = 0; step < 3; step++) {
        box(z, {
          w: 1.2 - step * 0.13, h: 0.16, d: 0.42, x: ringX - 3.75, y: step * 0.16,
          z: ringZ + 1.55, material: steel, name: 'ring access step',
        });
      }

      // Two detailed broadcast fighters: facial features, taped wrists,
      // articulated limbs, stitched trunks, boots, glove thumbs and sweat.
      const makeBoxer = ({ x, skin, shorts, gloves, trim, boots, phase, code, bruise = false }) => {
        const g = new THREE.Group();
        g.position.set(x, 0.47, ringZ);
        const skinMat = new THREE.MeshPhysicalMaterial({
          color: skin, roughness: 0.42, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.5,
        });
        const shortsMat = new THREE.MeshStandardMaterial({
          color: shorts, normalMap: leatherPbr.normalMap, roughnessMap: leatherPbr.roughnessMap,
          normalScale: new THREE.Vector2(0.18, 0.18), roughness: 0.56,
        });
        const gloveMat = leatherMaterial(gloves, 0.74);
        const trimMat = mat(trim, { roughness: 0.5 });
        const bootMat = leatherMaterial(boots, 0.62);
        const wrapMat = mat(0xe9e4da, { roughness: 0.72 });

        const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.29, 0.56, 8, 16), skinMat);
        torso.position.y = 1.16;
        torso.scale.set(1.08, 1, 0.82);
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.13, 0.22, 12), skinMat);
        neck.position.y = 1.57;
        const chest = [];
        for (const sx of [-1, 1]) {
          const pec = new THREE.Mesh(new THREE.SphereGeometry(0.155, 12, 8), skinMat);
          pec.scale.set(1.15, 0.62, 0.5);
          pec.position.set(sx * 0.145, 1.3, 0.205);
          chest.push(pec);
        }
        const abs = [];
        for (const [ax, ay] of [[-0.08, 1.08], [0.08, 1.08], [-0.075, 0.94], [0.075, 0.94]]) {
          const muscle = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 7), skinMat);
          muscle.scale.set(0.9, 0.65, 0.34);
          muscle.position.set(ax, ay, 0.24);
          abs.push(muscle);
        }

        const head = new THREE.Group();
        head.position.y = 1.74;
        const skull = new THREE.Mesh(new THREE.SphereGeometry(0.205, 20, 15), skinMat);
        skull.scale.set(0.92, 1.08, 0.94);
        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.044, 0.12, 7), skinMat);
        nose.rotation.x = Math.PI / 2;
        nose.position.set(0, -0.015, 0.21);
        const earL = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 7), skinMat);
        earL.scale.set(0.55, 1, 0.55); earL.position.set(-0.195, 0, 0);
        const earR = earL.clone(); earR.position.x = 0.195;
        const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xf2eee5, roughness: 0.35 });
        const pupilMat = new THREE.MeshBasicMaterial({ color: 0x101116 });
        const browMat = new THREE.MeshStandardMaterial({ color: bruise ? 0x1d1412 : 0x2c2019, roughness: 0.9 });
        for (const sx of [-1, 1]) {
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 7), eyeWhite);
          eye.scale.y = bruise && sx > 0 ? 0.45 : 0.72;
          eye.position.set(sx * 0.078, 0.035, 0.184);
          const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), pupilMat);
          pupil.position.set(sx * 0.078, 0.035, 0.214);
          const brow = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.018, 0.022), browMat);
          brow.position.set(sx * 0.078, 0.105, 0.188);
          brow.rotation.z = sx * -0.16;
          head.add(eye, pupil, brow);
        }
        const mouthMat = new THREE.MeshStandardMaterial({ color: 0x481823, emissive: 0x1f060c, emissiveIntensity: 0.35, roughness: 0.5 });
        const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.026, 0.024), mouthMat);
        mouth.position.set(0, -0.105, 0.195);
        const mouthguard = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.012, 0.026), mat(0xeef6ff, { roughness: 0.3 }));
        mouthguard.position.set(0, -0.096, 0.211);
        head.add(skull, nose, earL, earR, mouth, mouthguard);

        const shortsBody = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.285, 0.39, 12), shortsMat);
        shortsBody.position.y = 0.78;
        const waistband = new THREE.Mesh(new THREE.CylinderGeometry(0.347, 0.347, 0.085, 12), trimMat);
        waistband.position.y = 0.985;
        const beltCode = new THREE.Mesh(
          new THREE.PlaneGeometry(0.22, 0.075),
          new THREE.MeshBasicMaterial({ map: textTexture(code, { fg: '#ffffff', bg: '#12141b', size: 48, w: 512, h: 170, font: '900' }) })
        );
        beltCode.position.set(0, 0.987, 0.35);
        const sidePanels = [];
        for (const sx of [-1, 1]) {
          const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.31, 0.29), trimMat);
          stripe.position.set(sx * 0.31, 0.77, 0);
          sidePanels.push(stripe);
        }
        const legs = [];
        for (const sx of [-1, 1]) {
          const leg = new THREE.Group();
          leg.position.set(sx * 0.16, 0, 0);
          const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.23, 6, 10), skinMat);
          thigh.position.y = 0.53;
          const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.22, 6, 10), skinMat);
          shin.position.y = 0.24;
          const boot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.19, 0.35), bootMat);
          boot.position.set(0, 0.095, 0.065);
          const bootCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.105, 0.13, 10), trimMat);
          bootCuff.position.y = 0.2;
          leg.add(thigh, shin, boot, bootCuff);
          leg.rotation.z = sx * 0.05;
          legs.push(leg);
        }
        const arms = [];
        const gloveMeshes = [];
        for (const sx of [-1, 1]) {
          const arm = new THREE.Group();
          arm.position.set(sx * 0.31, 1.34, 0.04);
          const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.24, 6, 10), skinMat);
          upperArm.position.set(sx * 0.025, -0.05, 0.035);
          upperArm.rotation.z = sx * 0.32;
          const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.072, 0.27, 6, 10), skinMat);
          forearm.position.set(sx * 0.08, 0.11, 0.13);
          forearm.rotation.z = sx * 0.62;
          const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.085, 0.13, 10), wrapMat);
          wrap.position.set(sx * 0.135, 0.22, 0.22);
          wrap.rotation.z = sx * 0.6;
          const glove = new THREE.Group();
          glove.position.set(sx * 0.16, 0.27, 0.29);
          const fist = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), gloveMat);
          fist.scale.set(1.08, 0.94, 1.2);
          const thumb = new THREE.Mesh(new THREE.SphereGeometry(0.072, 12, 8), gloveMat);
          thumb.position.set(-sx * 0.105, -0.045, 0.04);
          const gloveSeam = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.012, 7, 18, Math.PI * 1.35), trimMat);
          gloveSeam.rotation.set(Math.PI / 2, 0, sx > 0 ? 0.6 : -2.5);
          gloveSeam.position.z = 0.105;
          glove.add(fist, thumb, gloveSeam);
          arm.add(upperArm, forearm, wrap, glove);
          arms.push(arm);
          gloveMeshes.push(glove);
        }
        g.add(torso, neck, ...chest, ...abs, head, shortsBody, waistband, beltCode, ...sidePanels, ...legs, ...arms);
        g.traverse((o) => {
          o.userData.noSplat = true;
          if (o.isMesh) o.castShadow = true;
        });
        z.group.add(g);
        return {
          group: g, torso, head, mouth, mouthguard, shortsBody, arms, legs, gloves: gloveMeshes,
          baseX: x, baseZ: ringZ, baseY: 0.47, phase,
        };
      };
      const boxerA = makeBoxer({
        x: ringX - 1.15, skin: 0xe2b28d, shorts: 0xe8e9eb, gloves: 0xd42632,
        trim: 0xd42632, boots: 0x9d1824, phase: 0, code: 'RED / 01', bruise: true,
      });
      const boxerB = makeBoxer({
        x: ringX + 1.15, skin: 0x4f2f22, shorts: 0x15171c, gloves: 0x1648d8,
        trim: 0xf0d447, boots: 0x12358f, phase: Math.PI, code: 'BLUE / 02',
      });
      boxerA.group.rotation.y = Math.PI / 2;
      boxerB.group.rotation.y = -Math.PI / 2;
      boxerA.direction = 1;
      boxerB.direction = -1;
      z.animated.boxers = [boxerA, boxerB];
      z.animated.boxing = { lastImpactSlot: -1, flash: null };

      // Corner equipment: leather stools, enamel buckets, towels and water
      // bottles make the ring feel maintained between its endless rounds.
      for (const [side, cornerColor] of [[-1, 0xd42632], [1, 0x1648d8]]) {
        const cornerX = ringX + side * 2.45;
        const stoolMat = leatherMaterial(cornerColor, 0.58);
        const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.25, 0.11, 16), stoolMat);
        seat.position.set(cornerX, 0.67, ringZ - 1.84);
        const stoolStem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.34, 10), steel);
        stoolStem.position.set(cornerX, 0.46, ringZ - 1.84);
        const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.14, 0.25, 14), mat(0xe8ebef, { metalness: 0.55, roughness: 0.22 }));
        bucket.position.set(cornerX + side * 0.45, 0.59, ringZ - 1.72);
        const towel = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.025, 0.22), mat(0xf4f1e9, { roughness: 1 }));
        towel.position.set(cornerX - side * 0.34, 0.56, ringZ - 2.12);
        towel.rotation.y = side * 0.18;
        z.group.add(seat, stoolStem, bucket, towel);
      }

      // A square broadcast truss and four targeted fixtures put proper pools
      // of light on the fighters while leaving the office edges cool and flat.
      const trussY = 6.85;
      for (const dz of [-3.2, 3.2]) box(z, { w: 8.0, h: 0.12, d: 0.12, x: ringX, y: trussY, z: ringZ + dz, material: steel, solid: false, noSplat: true, name: 'broadcast truss' });
      for (const dx of [-4.0, 4.0]) box(z, { w: 0.12, h: 0.12, d: 6.4, x: ringX + dx, y: trussY, z: ringZ, material: steel, solid: false, noSplat: true, name: 'broadcast truss' });
      for (const [dx, dz, color] of [[-2.6, -2.1, 0xffded0], [2.6, -2.1, 0xd7e4ff], [-2.6, 2.1, 0xffffff], [2.6, 2.1, 0xffffff]]) {
        const fixture = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 0.3, 12), steel);
        fixture.position.set(ringX + dx, trussY - 0.18, ringZ + dz);
        fixture.rotation.x = Math.PI;
        fixture.userData.noSplat = true;
        const spot = new THREE.SpotLight(color, 14, 13, Math.PI * 0.2, 0.58, 1.15);
        spot.position.set(ringX + dx, trussY - 0.35, ringZ + dz);
        spot.target.position.set(ringX + dx * 0.18, 0.8, ringZ + dz * 0.12);
        spot.castShadow = true;
        spot.shadow.mapSize.set(512, 512);
        z.group.add(fixture, spot, spot.target);
      }

      const makeCamera = (x, zz, ry, tallyColor) => {
        const camera = new THREE.Group();
        camera.position.set(x, 0, zz);
        camera.rotation.y = ry;
        const tripodMat = mat(0x20242c, { metalness: 0.62, roughness: 0.3 });
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.34, 0.72), tripodMat);
        body.position.y = 1.65;
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.4, 16), mat(0x111620, { metalness: 0.72, roughness: 0.14 }));
        lens.rotation.x = Math.PI / 2; lens.position.set(0, 1.65, 0.47);
        const glass = new THREE.Mesh(new THREE.CircleGeometry(0.135, 18), new THREE.MeshBasicMaterial({ color: 0x416ba2 }));
        glass.position.set(0, 1.65, 0.675);
        const tally = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.035), new THREE.MeshBasicMaterial({ color: tallyColor }));
        tally.position.set(0, 1.88, 0.18);
        camera.add(body, lens, glass, tally);
        for (const sx of [-1, 0, 1]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, 1.42, 7), tripodMat);
          leg.position.set(sx * 0.22, 0.71, -0.04);
          leg.rotation.z = sx * 0.19;
          camera.add(leg);
        }
        camera.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.userData.noSplat = true; } });
        z.group.add(camera);
      };
      makeCamera(ringX - 5.15, ringZ + 3.75, 0.62, 0xff334d);
      makeCamera(ringX + 4.95, ringZ + 3.65, -0.65, 0x34e27b);

      // A textured concrete broadcast wall frames the scoreboard rather than
      // letting it float on an untouched white expanse.
      plane(z, {
        w: 11.2, h: 4.15, x: 8.2, y: 4.65, z: -11.74,
        material: new THREE.MeshStandardMaterial({
          color: 0x8e9299, ...concretePbr, roughness: 0.78,
          normalScale: new THREE.Vector2(0.25, 0.25),
        }),
        noSplat: true, name: 'max pro broadcast wall',
      });

      // News-station office: desks, glowing monitors, rolling chairs, no journalists.
      for (const [x, zz, headline] of [[-13.6, -6.9, 'BREAKING: ROUND 0'], [-13.6, -3.8, 'POSSESSION 50 / 50'], [-13.6, -0.7, 'ART REMAINS LIVE']]) {
        box(z, { w: 3.4, h: 0.78, d: 1.1, x, z: zz, material: mat(0xd7d9dc, { roughness: 0.38 }), name: 'kunstNewsDesk' });
        const screenMat = new THREE.MeshBasicMaterial({ map: textTexture(headline, { fg: '#f5f7ff', bg: '#102a66', size: 36, w: 768, h: 192 }), side: THREE.DoubleSide });
        plane(z, { w: 1.65, h: 0.72, x, y: 1.25, z: zz - 0.48, material: screenMat, ry: 0, noSplat: true, name: 'kunstMonitor' });
        cylinder(z, { rT: 0.25, rB: 0.25, h: 0.08, x: x + 1.2, z: zz + 1.0, material: mat(0x252932), solid: false });
      }

      // Football score wall. Nobody scores; the clock is emotionally stopped.
      plane(z, {
        w: 8.2, h: 2.0, x: 8.2, y: 4.7, z: -11.69,
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
      clueKey: 'theorySeen', requiresPainting: true,
      clueLines: [
        'Page 80 describes the Artist as “a context-bearing unit.” Page 81 adds “for the archive.”',
        'The language is enormous. The transaction underneath it is very small.',
      ],
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

    const ridiculousFace = (index) => canvasTexture(540, 780, (ctx, w, h) => {
      const palettes = [
        ['#dff6fb', '#ffd73e', '#22152f', '#fa4f70'],
        ['#dff6fb', '#76e7bc', '#2b1743', '#ff8647'],
        ['#dff6fb', '#ff8dc5', '#26173c', '#fff2a8'],
        ['#dff6fb', '#ff9d3f', '#17204c', '#74f2e1'],
      ];
      const [ground, skin, ink, accent] = palettes[index];
      ctx.fillStyle = ground;
      ctx.fillRect(0, 0, w, h);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      // A deliberately unstable head silhouette.
      ctx.beginPath();
      if (index === 0) {
        ctx.moveTo(112, 620); ctx.bezierCurveTo(24, 420, 76, 128, 272, 96);
        ctx.bezierCurveTo(470, 124, 512, 430, 420, 626); ctx.quadraticCurveTo(270, 718, 112, 620);
      } else if (index === 1) {
        ctx.moveTo(132, 670); ctx.bezierCurveTo(64, 540, 116, 90, 282, 70);
        ctx.bezierCurveTo(430, 102, 446, 514, 390, 674); ctx.quadraticCurveTo(260, 724, 132, 670);
      } else if (index === 2) {
        ctx.moveTo(98, 628); ctx.bezierCurveTo(32, 346, 132, 112, 270, 100);
        ctx.bezierCurveTo(420, 106, 514, 360, 438, 632); ctx.quadraticCurveTo(268, 734, 98, 628);
      } else {
        ctx.moveTo(74, 600); ctx.lineTo(110, 174); ctx.lineTo(266, 66);
        ctx.lineTo(442, 174); ctx.lineTo(486, 600); ctx.lineTo(274, 706); ctx.closePath();
      }
      ctx.fillStyle = skin;
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 22;
      ctx.stroke();

      if (index === 0) {
        // One eye, three pupils, antennae, and lipstick with no restraint.
        ctx.strokeStyle = ink; ctx.lineWidth = 18;
        ctx.beginPath(); ctx.moveTo(196, 102); ctx.quadraticCurveTo(152, 18, 126, 38); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(340, 104); ctx.quadraticCurveTo(402, 16, 430, 48); ctx.stroke();
        ctx.fillStyle = '#fffdf5';
        ctx.beginPath(); ctx.ellipse(270, 318, 132, 92, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        for (const px of [216, 270, 324]) {
          ctx.fillStyle = ink; ctx.beginPath(); ctx.ellipse(px, 318, 22, 40, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(px - 6, 304, 6, 10, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = accent;
        ctx.beginPath(); ctx.moveTo(126, 514); ctx.quadraticCurveTo(270, 420, 418, 514);
        ctx.quadraticCurveTo(270, 672, 126, 514); ctx.fill(); ctx.stroke();
      } else if (index === 1) {
        // Mismatched eyes and a nose that has entered the adjacent postcode.
        ctx.fillStyle = '#fffdf5';
        ctx.beginPath(); ctx.ellipse(190, 270, 62, 78, -0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(340, 288, 88, 42, 0.16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = ink;
        ctx.beginPath(); ctx.ellipse(204, 280, 18, 34, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(316, 282, 28, 16, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = accent; ctx.strokeStyle = ink; ctx.lineWidth = 18;
        ctx.beginPath(); ctx.moveTo(262, 326); ctx.lineTo(484, 430); ctx.lineTo(260, 452); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(104, 522); ctx.quadraticCurveTo(208, 442, 270, 526);
        ctx.quadraticCurveTo(338, 438, 438, 524); ctx.quadraticCurveTo(338, 650, 270, 560);
        ctx.quadraticCurveTo(194, 646, 104, 522); ctx.fillStyle = ink; ctx.fill();
      } else if (index === 2) {
        // Tiny crown, alarmed eyes, and an exhibition-opening scream.
        ctx.fillStyle = accent; ctx.strokeStyle = ink; ctx.lineWidth = 18;
        ctx.beginPath(); ctx.moveTo(168, 128); ctx.lineTo(184, 22); ctx.lineTo(254, 92);
        ctx.lineTo(312, 14); ctx.lineTo(370, 128); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fffdf5';
        ctx.beginPath(); ctx.ellipse(188, 284, 58, 98, -0.18, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(350, 284, 58, 98, 0.18, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = ink;
        ctx.beginPath(); ctx.ellipse(202, 308, 16, 36, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(334, 308, 16, 36, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(270, 530, 112, 142, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fffdf5';
        for (let i = 0; i < 6; i++) ctx.fillRect(202 + i * 25, 414, 18, 42);
        ctx.fillStyle = '#f44c75'; ctx.beginPath(); ctx.ellipse(270, 596, 66, 38, 0, 0, Math.PI); ctx.fill();
      } else {
        // Four eyes, one tongue, and a bow tie negotiating its own commission.
        const eyes = [[174, 250], [254, 226], [332, 226], [404, 256]];
        for (const [ex, ey] of eyes) {
          ctx.fillStyle = '#fffdf5'; ctx.beginPath(); ctx.ellipse(ex, ey, 46, 58, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.fillStyle = ink; ctx.beginPath(); ctx.ellipse(ex + 8, ey + 8, 15, 24, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = ink; ctx.lineWidth = 24;
        ctx.beginPath(); ctx.moveTo(136, 440); ctx.quadraticCurveTo(274, 540, 420, 430); ctx.stroke();
        ctx.fillStyle = accent; ctx.beginPath(); ctx.moveTo(250, 500); ctx.quadraticCurveTo(270, 674, 334, 500); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = ink;
        ctx.beginPath(); ctx.moveTo(270, 654); ctx.lineTo(120, 724); ctx.lineTo(118, 620); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(270, 654); ctx.lineTo(424, 724); ctx.lineTo(426, 620); ctx.closePath(); ctx.fill();
        ctx.fillStyle = accent; ctx.beginPath(); ctx.ellipse(270, 654, 42, 38, 0, 0, Math.PI * 2); ctx.fill();
      }
    });

    // Four luminous wall portraits; the wall remains solid for collision.
    for (const [index, zz] of [-5.7, -1.9, 1.9, 5.7].entries()) {
      plane(z, {
        w: 2.7, h: 3.9, x: 9.79, y: 3.05, z: zz, ry: -Math.PI / 2,
        material: new THREE.MeshBasicMaterial({ map: ridiculousFace(index) }),
        noSplat: true, name: 'ridiculous wall portrait',
      });
    }

    const artLoader = new THREE.TextureLoader();
    const frameWood = mat(0x765033, { roughness: 0.7, metalness: 0.01 });
    const works = [];
    const hangWork = ({ url, title, subtitle, x, y, z: zz, ry, w, h, sold = false }) => {
      const g = new THREE.Group();
      g.position.set(x, y, zz);
      g.rotation.y = ry;

      // Slim wooden gallery rails replace the old pale backing border.
      const frame = new THREE.Group();
      const rail = 0.055;
      const depth = 0.085;
      const topRail = new THREE.Mesh(
        new THREE.BoxGeometry(w + rail * 2, rail, depth),
        frameWood
      );
      topRail.position.y = h / 2 + rail / 2;
      const bottomRail = topRail.clone();
      bottomRail.position.y = -h / 2 - rail / 2;
      const leftRail = new THREE.Mesh(
        new THREE.BoxGeometry(rail, h, depth),
        frameWood
      );
      leftRail.position.x = -w / 2 - rail / 2;
      const rightRail = leftRail.clone();
      rightRail.position.x = w / 2 + rail / 2;
      frame.add(topRail, bottomRail, leftRail, rightRail);

      const artMat = new THREE.MeshStandardMaterial({ color: 0xf0f0ec, roughness: 0.82 });
      const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h), artMat);
      art.position.z = depth / 2 + 0.002;
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
      label.position.set(0, -h / 2 - 0.3, depth / 2 + 0.006);
      label.userData.noSplat = true;
      g.add(frame, art, label);

      if (sold) {
        const dot = new THREE.Mesh(
          new THREE.CircleGeometry(0.105, 28),
          new THREE.MeshBasicMaterial({ color: 0xd4111b })
        );
        dot.position.set(Math.min(w * 0.43, 1.55), -h / 2 - 0.3, depth / 2 + 0.013);
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

    // An anabolic weather system: one swollen cloud continuously rains
    // ampoules and capsules behind the artist/gallerist argument.
    {
      const rng = mulberry32(300); // Muscle Mania's extremely specific forecast.
      const cloud = new THREE.Group();
      const cloudX = 0.15;
      const cloudZ = 2.85;
      const cloudY = 4.62;
      cloud.position.set(cloudX, cloudY, cloudZ);
      const cloudMat = new THREE.MeshStandardMaterial({
        color: 0xc9c8d5, roughness: 0.84, metalness: 0.02,
        emissive: 0x33284c, emissiveIntensity: 0.16,
      });
      for (let i = 0; i < 10; i++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(0.46 + rng() * 0.34, 14, 10), cloudMat);
        puff.position.set(-1.55 + i * 0.34 + (rng() - 0.5) * 0.2, (rng() - 0.5) * 0.42, (rng() - 0.5) * 0.78);
        puff.scale.y = 0.62 + rng() * 0.32;
        puff.castShadow = true;
        puff.userData.noSplat = true;
        cloud.add(puff);
      }
      const cloudLight = new THREE.PointLight(0xb68cff, 3.2, 6.5, 1.8);
      cloudLight.position.set(0, -0.4, 0);
      cloudLight.userData.base = 3.2;
      cloud.add(cloudLight);
      z.group.add(cloud);
      z.animated.steroidCloud = { group: cloud, light: cloudLight, baseY: cloudY };

      const forecast = new THREE.Mesh(
        new THREE.PlaneGeometry(2.7, 0.34),
        new THREE.MeshBasicMaterial({
          map: textTexture('100% CHANCE OF GAINS', { fg: '#7f43ba', bg: '#f7f5ef', size: 42, w: 1000, h: 150, font: '800' }),
        })
      );
      forecast.position.set(cloudX - 0.02, cloudY - 0.72, cloudZ - 0.02);
      forecast.rotation.y = -Math.PI / 2;
      forecast.userData.noSplat = true;
      z.group.add(forecast);

      const glass = new THREE.MeshPhysicalMaterial({
        color: 0xcbeaff, roughness: 0.1, metalness: 0.03,
        transparent: true, opacity: 0.7, transmission: 0.25,
        clearcoat: 0.7, clearcoatRoughness: 0.04,
      });
      const capMats = [
        mat(0xe84b63, { roughness: 0.42 }),
        mat(0x7f43ba, { roughness: 0.42 }),
        mat(0x29a8c7, { roughness: 0.42 }),
        mat(0xf0b72c, { roughness: 0.42 }),
      ];
      z.animated.steroidRain = [];
      for (let i = 0; i < 30; i++) {
        const drop = new THREE.Group();
        if (i % 4 === 0) {
          // Oversized capsules tumble between the ampoules.
          const capsule = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.12, 5, 10), capMats[i % capMats.length]);
          capsule.rotation.z = Math.PI / 2;
          drop.add(capsule);
        } else {
          const vial = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.052, 0.22, 10), glass);
          const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.037, 0.041, 0.105, 9), capMats[i % capMats.length]);
          liquid.position.y = -0.045;
          const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.055, 10), capMats[(i + 1) % capMats.length]);
          cap.position.y = 0.137;
          drop.add(vial, liquid, cap);
        }
        const baseX = cloudX - 1.45 + rng() * 2.9;
        const baseZ = cloudZ - 0.95 + rng() * 1.9;
        const bottom = 0.22 + rng() * 0.28;
        const top = cloudY - 0.7 + rng() * 0.35;
        drop.position.set(baseX, bottom + rng() * (top - bottom), baseZ);
        drop.scale.setScalar(0.8 + rng() * 0.65);
        drop.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.userData.noSplat = true; } });
        z.group.add(drop);
        z.animated.steroidRain.push({
          group: drop, baseX, baseZ, bottom, top,
          speed: 0.38 + rng() * 0.72,
          drift: 0.08 + rng() * 0.2,
          phase: rng() * Math.PI * 2,
          spin: (rng() - 0.5) * 2.7,
        });
      }

      z.interactables.push({
        id: 'up-steroid-cloud', type: 'flavor', label: 'Check the anabolic forecast',
        title: 'ANABOLIC WEATHER', pos: new THREE.Vector3(cloudX, 1.2, cloudZ), radius: 2.8,
        lines: [
          'Thirty ampoules fall forever. Muscle Mania calls it precipitation. Zebra calls it sponsored content.',
          'The cloud smells faintly of lavender, locker rooms, and a medical disclaimer printed too small to read.',
          'Today’s forecast: heavy gains, scattered mood swings, and a one hundred percent chance of enlarged sculpture.',
        ],
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
    door(z, { x: -9.8, z: 5.35, ry: Math.PI / 2, label: 'U WISH U HAD HAIR BUT U DONT →', to: 'hairSalon' });
  }

  /* ---------------------------------------------------------- */
  /*  VACANT EDITIONS — an over-serious tactile product library */
  /* ---------------------------------------------------------- */
  #buildVacantEditions() {
    const z = this.#newZone('vacantEditions');
    const roomH = 4.8;
    shell(z, {
      w: 18, d: 14, h: roomH,
      floorColor: 0xb5afa6, wallColor: 0xe7e2d8, ceilColor: 0x25252b,
    });
    z.spawn.set(-6.55, 0, 0);
    z.spawnYaw = -Math.PI / 2;
    z.fog = { color: 0xdad3c8, density: 0.011 };

    // A smoked-rubber runway turns the room into a material library rather
    // than another white cube, while brass seams divide the edition bays.
    plane(z, {
      w: 16.8, h: 2.35, x: 0, y: 0.012, z: 0, rx: -Math.PI / 2,
      material: new THREE.MeshPhysicalMaterial({
        color: 0x24232a, roughness: 0.24, metalness: 0.08,
        clearcoat: 0.42, clearcoatRoughness: 0.18,
      }),
      name: 'vacant runway', noSplat: true,
    });
    for (const x of [-6.2, -2.1, 2.1, 6.2]) {
      box(z, {
        w: 0.035, h: 0.018, d: 12.2, x, y: 0.013, z: 0,
        material: mat(0xc59c54, { metalness: 0.72, roughness: 0.22 }), solid: false, noSplat: true,
      });
    }

    const fleckTexture = (kind) => canvasTexture(256, 256, (ctx, w, h) => {
      const rng = mulberry32(kind === 'terrazzo' ? 9182 : kind === 'cork' ? 4417 : 7731);
      if (kind === 'terrazzo') {
        ctx.fillStyle = '#ded6c8'; ctx.fillRect(0, 0, w, h);
        const chips = ['#20212a', '#ad593c', '#668f88', '#e5b95b', '#f1eee7'];
        for (let i = 0; i < 230; i++) {
          const s = 2 + rng() * 10;
          ctx.fillStyle = chips[Math.floor(rng() * chips.length)];
          ctx.save(); ctx.translate(rng() * w, rng() * h); ctx.rotate(rng() * Math.PI);
          ctx.fillRect(-s / 2, -s / 3, s, s * 0.66); ctx.restore();
        }
      } else if (kind === 'cork') {
        ctx.fillStyle = '#a97645'; ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 280; i++) {
          ctx.strokeStyle = rng() > 0.45 ? '#69452d' : '#d0a36c';
          ctx.lineWidth = 1 + rng() * 3;
          const px = rng() * w; const py = rng() * h;
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 3 + rng() * 18, py + (rng() - 0.5) * 8); ctx.stroke();
        }
      } else {
        ctx.fillStyle = '#d9ddea'; ctx.fillRect(0, 0, w, h);
        for (let yy = 18; yy < h; yy += 34) {
          for (let xx = 18; xx < w; xx += 34) {
            const px = xx + ((yy / 34) % 2) * 17;
            ctx.fillStyle = 'rgba(255,255,255,0.72)';
            ctx.beginPath(); ctx.ellipse(px, yy, 12, 12, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(67,75,105,0.46)'; ctx.lineWidth = 2; ctx.stroke();
            ctx.fillStyle = 'rgba(126,139,184,0.2)';
            ctx.beginPath(); ctx.ellipse(px - 3, yy + 3, 7, 7, 0, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
    });

    const terrazzoMap = fleckTexture('terrazzo');
    const corkMap = fleckTexture('cork');
    const bubbleMap = fleckTexture('bubble');
    const materials = {
      velvet: new THREE.MeshStandardMaterial({ color: 0x6e1636, roughness: 1, metalness: 0 }),
      chrome: new THREE.MeshPhysicalMaterial({ color: 0xdce7ed, roughness: 0.07, metalness: 0.96, clearcoat: 1, clearcoatRoughness: 0.03 }),
      cork: new THREE.MeshStandardMaterial({ color: 0xffffff, map: corkMap, roughness: 0.96 }),
      terrazzo: new THREE.MeshStandardMaterial({ color: 0xffffff, map: terrazzoMap, roughness: 0.72 }),
      bubble: new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: bubbleMap, roughness: 0.18, metalness: 0.02, clearcoat: 0.85, clearcoatRoughness: 0.08 }),
      moss: new THREE.MeshStandardMaterial({ color: 0x52713d, roughness: 1 }),
      granite: new THREE.MeshStandardMaterial({ color: 0x77767b, roughness: 1, bumpMap: terrazzoMap, bumpScale: 0.11 }),
      pearl: new THREE.MeshPhysicalMaterial({ color: 0xe4b8e8, roughness: 0.18, metalness: 0.12, clearcoat: 1, clearcoatRoughness: 0.06, iridescence: 0.7, iridescenceIOR: 1.45 }),
    };

    const editions = [
      { key: 'velvet', name: 'VELVET NAP', sub: 'flocked silicone · 1/3', x: -6.0, z: -4.75, style: 'ribbed', color: 0x6e1636,
        line: 'The velvet nap changes direction when stroked. Vincent calls the dark stripe “viewer participation.” Eddie calls it lint.' },
      { key: 'chrome', name: 'MIRROR CHROME', sub: 'polished alloy · AP', x: -2.0, z: -4.75, style: 'smooth', color: 0xdce7ed,
        line: 'The chrome dildo reflects your face, the track lights, and several choices you thought were private.' },
      { key: 'cork', name: 'CORK BREATHER', sub: 'sealed cork · 2/8', x: 2.0, z: -4.75, style: 'knobbed', color: 0xa97645,
        line: 'The cork edition is warm, porous-looking, and sealed under twelve coats of professional reassurance.' },
      { key: 'terrazzo', name: 'AGGREGATE DESIRE', sub: 'cast terrazzo · 4/7', x: 6.0, z: -4.75, style: 'faceted', color: 0xded6c8,
        line: 'Each terrazzo chip has been distributed by hand. Eddie rejected three compositions for excessive pebble hierarchy.' },
      { key: 'bubble', name: 'POP PROOF', sub: 'bubble membrane · unique', x: -6.0, z: 4.75, style: 'knobbed', color: 0xcad5ed,
        line: 'Every bubble remains unpopped. The certificate describes popping one as “an irreversible edition event.”' },
      { key: 'moss', name: 'AFTERCARE', sub: 'living moss · 3/5', x: -2.0, z: 4.75, style: 'mossy', color: 0x52713d,
        line: 'The moss dildo needs mist, indirect sun, and reassurance that institutional acquisition will not change it.' },
      { key: 'granite', name: 'FRICTION STUDY', sub: 'sandblasted stone · 1/6', x: 2.0, z: 4.75, style: 'ridged', color: 0x77767b,
        line: 'The sandblasted edition is strictly conceptual in use. A nearby waiver uses the phrase “tactile ambition.”' },
      { key: 'pearl', name: 'MOTHER OF PEARL', sub: 'iridescent silicone · 7/9', x: 6.0, z: 4.75, style: 'smooth', color: 0xe4b8e8,
        line: 'The pearlescent skin changes from pink to blue as you move. The object considers this a personality.' },
    ];

    z.animated.editions = [];
    const plinthMat = mat(0xece8df, { roughness: 0.48, metalness: 0.04 });
    const railMat = mat(0x8a765e, { roughness: 0.32, metalness: 0.4 });
    for (let i = 0; i < editions.length; i++) {
      const e = editions[i];
      box(z, { w: 1.32, h: 0.72, d: 1.32, x: e.x, z: e.z, material: plinthMat, name: `${e.name} plinth` });
      box(z, { w: 1.4, h: 0.045, d: 1.4, x: e.x, y: 0.72, z: e.z, material: railMat, solid: false, noSplat: true });

      const sculpture = new THREE.Group();
      sculpture.position.set(e.x, 0.78, e.z);
      const surface = materials[e.key];
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.31, 0.13, 28), surface);
      cup.position.y = 0.065;
      const bodyGeom = e.style === 'faceted'
        ? new THREE.CapsuleGeometry(0.18, 0.66, 3, 7)
        : new THREE.CapsuleGeometry(0.18, 0.66, 8, 22);
      const body = new THREE.Mesh(bodyGeom, surface);
      body.position.y = 0.62;
      body.scale.set(1 + (i % 3) * 0.06, 0.92 + (i % 2) * 0.13, 1 + (i % 3) * 0.06);
      sculpture.add(cup, body);

      if (e.style === 'ribbed' || e.style === 'ridged') {
        const count = e.style === 'ribbed' ? 5 : 8;
        for (let ring = 0; ring < count; ring++) {
          const ridge = new THREE.Mesh(new THREE.TorusGeometry(0.185, e.style === 'ribbed' ? 0.025 : 0.014, 8, 28), surface);
          ridge.rotation.x = Math.PI / 2;
          ridge.position.y = 0.34 + ring * (0.085 - (e.style === 'ridged' ? 0.02 : 0));
          sculpture.add(ridge);
        }
      }
      if (e.style === 'knobbed' || e.style === 'mossy') {
        const rng = mulberry32(8100 + i);
        const count = e.style === 'mossy' ? 34 : 18;
        for (let n = 0; n < count; n++) {
          const a = rng() * Math.PI * 2;
          const yy = 0.26 + rng() * 0.68;
          const bump = new THREE.Mesh(
            new THREE.SphereGeometry(e.style === 'mossy' ? 0.035 + rng() * 0.035 : 0.038, 7, 5),
            surface
          );
          bump.position.set(Math.cos(a) * 0.17, yy, Math.sin(a) * 0.17);
          sculpture.add(bump);
        }
      }
      sculpture.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.userData.noSplat = true;
      });
      z.group.add(sculpture);
      z.animated.editions.push({ group: sculpture, phase: i * 0.77, baseY: 0.78, direction: i % 2 ? 1 : -1 });

      const facesSouth = e.z < 0;
      plane(z, {
        w: 1.72, h: 0.34, x: e.x, y: 0.43, z: e.z + (facesSouth ? 0.666 : -0.666), ry: facesSouth ? 0 : Math.PI,
        material: new THREE.MeshBasicMaterial({
          map: textTexture(`${e.name}\n${e.sub}`, { fg: '#1e2026', bg: '#f7f2e8', size: 29, w: 900, h: 190, font: '700' }),
        }),
        noSplat: true,
      });
      z.interactables.push({
        id: `vacant-${e.key}`, type: 'flavor', label: `Inspect ${e.name}`,
        title: e.name, pos: new THREE.Vector3(e.x, 1.0, e.z), radius: 1.8,
        lines: [e.line],
      });
    }

    // The pair talk across a low central platform, presented as two living
    // photographic editions rather than pretending the source images are 3D.
    box(z, { w: 4.5, h: 0.12, d: 2.2, x: 0, z: 0, material: mat(0x6e655c, { roughness: 0.5 }), name: 'live edition platform' });
    plane(z, {
      w: 3.8, h: 0.42, x: 0, y: 0.135, z: 1.11, ry: Math.PI,
      material: new THREE.MeshBasicMaterial({
        map: textTexture('LIVE EDITIONS A + B  ·  CONVERSATION ON LOOP', { fg: '#e9c56d', bg: '#222229', size: 31, w: 1200, h: 150, font: '800' }),
      }), noSplat: true,
    });

    plane(z, {
      w: 7.6, h: 0.72, x: 0, y: 4.15, z: -6.78,
      material: new THREE.MeshBasicMaterial({
        map: textTexture('V A C A N T   E D I T I O N S', { fg: '#191a20', bg: '#e7e2d8', size: 62, w: 1500, h: 180, font: '800' }),
      }), noSplat: true,
    });
    plane(z, {
      w: 5.4, h: 0.42, x: 0, y: 3.56, z: -6.775,
      material: new THREE.MeshBasicMaterial({
        map: textTexture('SURFACE / FRICTION / FINISH / EDITION', { fg: '#74604b', bg: '#e7e2d8', size: 34, w: 1200, h: 150, font: '700' }),
      }), noSplat: true,
    });

    // The wall masterpiece: banana, cock, and structural faith in duct tape.
    {
      const artwork = new THREE.Group();
      artwork.position.set(8.78, 2.5, -2.55);
      artwork.rotation.y = -Math.PI / 2;
      const frameSize = 3.42;
      const aluminum = mat(0xaeb2b6, { roughness: 0.24, metalness: 0.82 });
      const frame = new THREE.Mesh(new THREE.BoxGeometry(frameSize + 0.16, frameSize + 0.16, 0.09), aluminum);
      frame.castShadow = true;
      const artMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.72 });
      const image = new THREE.Mesh(new THREE.PlaneGeometry(frameSize, frameSize), artMat);
      image.position.z = 0.052;
      image.userData.noSplat = true;
      new THREE.TextureLoader().load(encodeURI('puplic/penis banana.jpg'), (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        artMat.map = tex;
        artMat.color.set(0xffffff);
        artMat.needsUpdate = true;
      });

      // Four literal pieces of tape make the hanging system part of the work.
      const tapeMat = new THREE.MeshStandardMaterial({ color: 0xc9c9c4, roughness: 0.62, metalness: 0.18 });
      for (const [tx, ty, rz] of [
        [-1.48, 1.48, -0.72], [1.48, 1.48, 0.72],
        [-1.48, -1.48, 0.72], [1.48, -1.48, -0.72],
      ]) {
        const tab = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.17), tapeMat);
        tab.position.set(tx, ty, 0.058);
        tab.rotation.z = rz;
        tab.userData.noSplat = true;
        artwork.add(tab);
      }

      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(3.25, 0.46),
        new THREE.MeshBasicMaterial({
          map: textTexture('BANANA COCK, HELD TOGETHER  ·  duct tape and digital drawing, 2026  ·  UNIQUE', {
            fg: '#1e2026', bg: '#f7f2e8', size: 28, w: 1400, h: 190, font: '700',
          }),
        })
      );
      label.position.set(0, -2.02, 0.052);
      label.userData.noSplat = true;
      artwork.add(frame, image, label);
      artwork.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      z.group.add(artwork);

      const bananaSpot = new THREE.SpotLight(0xffd7a0, 22, 9, Math.PI * 0.25, 0.72, 1.35);
      bananaSpot.position.set(5.4, 4.45, -2.55);
      bananaSpot.target.position.set(8.7, 2.35, -2.55);
      bananaSpot.castShadow = true;
      z.group.add(bananaSpot, bananaSpot.target);

      z.interactables.push({
        id: 'vacant-banana-cock', type: 'flavor', label: 'Inspect the duct-taped banana cock',
        title: 'BANANA COCK, HELD TOGETHER', pos: new THREE.Vector3(8.1, 2.2, -2.55), radius: 2.5,
        lines: [
          'A banana cock meets a silver cross of duct tape. Conservation has classified the adhesive as emotionally permanent.',
          'The black field makes the tape look structural, ceremonial, and slightly worried about what it is holding together.',
          'Vincent calls the peach texture “post-fruit skin.” Eddie has already requested a stronger roll of tape.',
        ],
      });
    }

    // Track lighting: a neutral wash plus individual warm pools on the works.
    z.group.add(new THREE.HemisphereLight(0xf4f7ff, 0x554d48, 1.55));
    for (const x of [-6, -2, 2, 6]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 11.2), mat(0x15161b, { metalness: 0.56, roughness: 0.3 }));
      rail.position.set(x, roomH - 0.18, 0);
      rail.userData.noSplat = true;
      z.group.add(rail);
      for (const zz of [-4.7, 0, 4.7]) {
        const spot = new THREE.SpotLight(0xffe6bb, zz === 0 ? 15 : 12, 8, Math.PI * 0.22, 0.74, 1.4);
        spot.position.set(x, roomH - 0.28, zz * 0.65);
        spot.target.position.set(zz === 0 ? Math.sign(x) * 0.7 : x, zz === 0 ? 1.1 : 0.9, zz);
        spot.castShadow = zz !== 0;
        z.group.add(spot, spot.target);
      }
    }

    z.anchors.vacantVincent = new THREE.Vector3(-0.9, 0.12, -0.72);
    z.anchors.editionEddie = new THREE.Vector3(0.9, 0.12, 0.72);
    z.anchorYaws = { vacantVincent: 0.9, editionEddie: -2.24 };
    z.waypoints = [
      new THREE.Vector3(-6.2, 0, -2.5), new THREE.Vector3(-6.2, 0, 2.5),
      new THREE.Vector3(-3.0, 0, -2.5), new THREE.Vector3(-3.0, 0, 2.5),
      new THREE.Vector3(3.0, 0, -2.5), new THREE.Vector3(3.0, 0, 2.5),
      new THREE.Vector3(6.2, 0, -2.5), new THREE.Vector3(6.2, 0, 2.5),
    ];

    z.interactables.push({
      id: 'vacant-material-index', type: 'flavor', label: 'Read the material index',
      title: 'MATERIAL INDEX', pos: new THREE.Vector3(0, 1.2, -6.5), radius: 2.2,
      clueKey: 'editionSeen', requiresPainting: true,
      clueLines: [
        'The next entry is “ARTIST — EDITION OF ONE.” Its lot number begins A-, like yours.',
        'The maintenance plan says: “Keep identity sealed. Display only under controlled conditions.”',
      ],
      lines: [
        'Eight dildos, eight surfaces, eight maintenance plans. “Vacant” refers to availability, not restraint.',
        'The checklist asks: glossy or matte, porous or sealed, ribbed or legally smooth, unique or aggressively editioned.',
      ],
    });

    door(z, { x: -8.8, z: 0, ry: Math.PI / 2, label: '← UP AND CUMMING ARTIST', to: 'upAndCumming' });
  }

  /* ---------------------------------------------------------- */
  /*  U WISH U HAD HAIR BUT U DONT — a strictly bald hair salon */
  /* ---------------------------------------------------------- */
  #buildHairSalon() {
    const z = this.#newZone('hairSalon');
    const roomH = 4.7;
    shell(z, {
      w: 18, d: 12, h: roomH,
      floorColor: 0xd7cfca, wallColor: 0xf2e2e7, ceilColor: 0x342f38,
    });
    z.spawn.set(-6.45, 0, 0);
    z.spawnYaw = -Math.PI / 2;
    z.fog = { color: 0xe7cfd8, density: 0.012 };

    const chrome = new THREE.MeshPhysicalMaterial({
      color: 0xdce5e8, metalness: 0.94, roughness: 0.08,
      clearcoat: 1, clearcoatRoughness: 0.03,
    });
    const blackVinyl = new THREE.MeshPhysicalMaterial({
      color: 0x17161b, metalness: 0.05, roughness: 0.24,
      clearcoat: 0.68, clearcoatRoughness: 0.16,
    });
    const blush = mat(0xd987a3, { roughness: 0.55 });
    const warmWhite = mat(0xf4ece7, { roughness: 0.56 });

    // Large terrazzo-like checker tiles make the whole room read as a salon
    // before any furniture loads, without adding one mesh per tile.
    const floorMap = canvasTexture(512, 512, (ctx, w, h) => {
      const size = w / 8;
      for (let yy = 0; yy < 8; yy++) {
        for (let xx = 0; xx < 8; xx++) {
          ctx.fillStyle = (xx + yy) % 2 ? '#eee7e2' : '#cfc4c1';
          ctx.fillRect(xx * size, yy * size, size, size);
        }
      }
      ctx.strokeStyle = 'rgba(98,78,87,0.18)';
      ctx.lineWidth = 3;
      for (let i = 0; i <= 8; i++) {
        ctx.beginPath(); ctx.moveTo(i * size, 0); ctx.lineTo(i * size, h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * size); ctx.lineTo(w, i * size); ctx.stroke();
      }
    });
    floorMap.wrapS = floorMap.wrapT = THREE.RepeatWrapping;
    floorMap.repeat.set(2.25, 1.5);
    plane(z, {
      w: 17.6, h: 11.6, y: 0.012, rx: -Math.PI / 2,
      material: new THREE.MeshStandardMaterial({ color: 0xffffff, map: floorMap, roughness: 0.68 }),
      name: 'salon tile', noSplat: true,
    });

    // The name is deliberately too large and too certain for a room with no
    // hair in it. It sits above six identical chrome-framed mirrors.
    plane(z, {
      w: 12.8, h: 0.58, x: 0, y: 4.15, z: -5.785,
      material: new THREE.MeshBasicMaterial({
        map: textTexture('U WISH U HAD HAIR BUT U DONT', {
          fg: '#fff5f8', bg: '#b82e64', size: 68, w: 1800, h: 180, font: '900',
        }),
      }),
      name: 'salon name', noSplat: true,
    });
    plane(z, {
      w: 8.4, h: 0.3, x: 0, y: 3.72, z: -5.78,
      material: new THREE.MeshBasicMaterial({
        map: textTexture('CUT  /  COLOR  /  SHINE  /  ACCEPTANCE', {
          fg: '#7b2448', bg: '#f2e2e7', size: 36, w: 1300, h: 130, font: '800',
        }),
      }),
      noSplat: true,
    });

    const stationXs = [-6, -3.6, -1.2, 1.2, 3.6, 6];
    for (let i = 0; i < stationXs.length; i++) {
      const x = stationXs[i];

      // A pale blue metallic plane gives a strong mirror impression while
      // staying cheap enough to keep six stations lit at once.
      plane(z, {
        w: 1.72, h: 2.55, x, y: 2.15, z: -5.77,
        material: new THREE.MeshPhysicalMaterial({
          color: 0xcbdde1, metalness: 0.88, roughness: 0.09,
          clearcoat: 1, clearcoatRoughness: 0.02,
        }),
        name: `salon mirror ${i + 1}`, noSplat: true,
      });
      box(z, { w: 1.9, h: 0.075, d: 0.08, x, y: 0.82, z: -5.72, material: chrome, solid: false, noSplat: true });
      box(z, { w: 1.9, h: 0.075, d: 0.08, x, y: 3.42, z: -5.72, material: chrome, solid: false, noSplat: true });
      for (const side of [-1, 1]) {
        box(z, { w: 0.075, h: 2.67, d: 0.08, x: x + side * 0.95, y: 0.82, z: -5.72, material: chrome, solid: false, noSplat: true });
      }

      // Empty counters emphasize that there are no brushes full of hair and
      // no loose clippings anywhere in the building.
      box(z, { w: 1.95, h: 0.12, d: 0.56, x, y: 0.74, z: -5.25, material: warmWhite, solid: false, noSplat: true });
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.3, 10), i % 2 ? blush : chrome);
      bottle.position.set(x + 0.56, 1.01, -5.24);
      bottle.userData.noSplat = true;
      z.group.add(bottle);

      // Barber chair: broad vinyl seat, tall back, chrome pump and circular
      // foot. It is deliberately usable-looking despite the impossible menu.
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.54, 0.08, 24), chrome);
      foot.position.set(x, 0.04, -3.72);
      const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.58, 14), chrome);
      pump.position.set(x, 0.36, -3.72);
      z.group.add(foot, pump);
      box(z, { w: 0.92, h: 0.18, d: 0.82, x, y: 0.65, z: -3.72, material: blackVinyl, name: 'salon chair' });
      box(z, { w: 0.88, h: 0.92, d: 0.16, x, y: 0.82, z: -4.06, material: blackVinyl, solid: false, noSplat: true });
      for (const side of [-1, 1]) {
        box(z, { w: 0.12, h: 0.08, d: 0.72, x: x + side * 0.53, y: 0.98, z: -3.7, material: chrome, solid: false, noSplat: true });
      }
    }

    // Three washing stations line the opposite wall. The black torus reads as
    // the rolled lip of a shampoo basin; not one drain contains a hair.
    for (const x of [-4.1, 0, 4.1]) {
      box(z, { w: 2.35, h: 0.78, d: 1.05, x, y: 0, z: 4.78, material: warmWhite, name: 'wash station' });
      const basin = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.115, 12, 28), blackVinyl);
      basin.position.set(x, 0.88, 4.56);
      basin.rotation.x = Math.PI / 2;
      basin.userData.noSplat = true;
      const drain = new THREE.Mesh(new THREE.CircleGeometry(0.085, 18), chrome);
      drain.position.set(x, 0.77, 4.56);
      drain.rotation.x = -Math.PI / 2;
      drain.userData.noSplat = true;
      z.group.add(basin, drain);
      box(z, { w: 0.86, h: 0.16, d: 0.9, x, y: 0.42, z: 3.92, material: blackVinyl, solid: false, noSplat: true });
    }

    // Reception and the entirely empty hair inventory.
    box(z, { w: 2.8, h: 1.08, d: 0.82, x: 6.85, y: 0, z: 2.1, material: blush, name: 'salon reception' });
    plane(z, {
      w: 2.35, h: 0.43, x: 6.85, y: 0.66, z: 1.685, ry: Math.PI,
      material: new THREE.MeshBasicMaterial({
        map: textTexture('CHECK IN / GIVE UP', { fg: '#fff7f4', bg: '#b82e64', size: 40, w: 900, h: 180, font: '900' }),
      }),
      noSplat: true,
    });
    box(z, { w: 0.36, h: 2.85, d: 3.2, x: 8.48, y: 0.34, z: -1.3, material: chrome, name: 'product cabinet' });
    for (const yy of [0.95, 1.7, 2.45]) {
      box(z, { w: 0.62, h: 0.07, d: 2.7, x: 8.13, y: yy, z: -1.3, material: warmWhite, solid: false, noSplat: true });
    }
    plane(z, {
      w: 2.55, h: 0.45, x: 8.075, y: 3.45, z: -1.3, ry: -Math.PI / 2,
      material: new THREE.MeshBasicMaterial({
        map: textTexture('HAIR — OUT OF STOCK', { fg: '#fff5f8', bg: '#7b2448', size: 37, w: 900, h: 180, font: '900' }),
      }),
      noSplat: true,
    });
    for (const [yy, zz] of [[1.12, -2.1], [1.12, -0.5], [1.87, -1.3], [2.62, -2.05], [2.62, -0.55]]) {
      const emptyDome = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
        mat(0xd4a17f, { roughness: 0.72 })
      );
      emptyDome.position.set(8.03, yy, zz);
      emptyDome.userData.noSplat = true;
      z.group.add(emptyDome);
    }

    // Pink-white ceiling bars and warmer mirror lights keep every bald head
    // legible and throw polished highlights across the chairs and counters.
    z.group.add(new THREE.HemisphereLight(0xfff3f6, 0x604954, 1.55));
    for (const x of [-6, -3, 0, 3, 6]) {
      box(z, {
        w: 0.16, h: 0.08, d: 8.8, x, y: roomH - 0.18, z: 0,
        material: new THREE.MeshBasicMaterial({ color: x % 6 ? 0xffc4d8 : 0xfff7ee }),
        solid: false, noSplat: true,
      });
      const light = new THREE.PointLight(x % 6 ? 0xffb0cc : 0xffead7, 8.5, 7.5, 1.6);
      light.position.set(x, roomH - 0.34, -2.1);
      z.group.add(light);
    }
    const receptionSpot = new THREE.SpotLight(0xffaac8, 18, 9, Math.PI * 0.3, 0.65, 1.25);
    receptionSpot.position.set(5.8, 4.25, 2.25);
    receptionSpot.target.position.set(6.85, 0.6, 2.1);
    z.group.add(receptionSpot, receptionSpot.target);

    z.anchors.gretaGleam = new THREE.Vector3(5.55, 0, 1.55);
    z.anchors.bjornBare = new THREE.Vector3(-5.95, 0, -2.35);
    z.anchors.monaDome = new THREE.Vector3(-3.55, 0, -2.35);
    z.anchors.sisselShine = new THREE.Vector3(-1.15, 0, -2.35);
    z.anchors.gunnarGloss = new THREE.Vector3(0, 0, 3.45);
    z.anchors.nilsNoFringe = new THREE.Vector3(4.55, 0, 2.55);
    z.anchorYaws = {
      gretaGleam: -Math.PI / 2, bjornBare: Math.PI, monaDome: Math.PI,
      sisselShine: Math.PI, gunnarGloss: 0, nilsNoFringe: 2.4,
    };
    z.waypoints = [
      new THREE.Vector3(-6.4, 0, 1.8), new THREE.Vector3(-4.1, 0, 1.7),
      new THREE.Vector3(-1.8, 0, 1.8), new THREE.Vector3(1.4, 0, 1.8),
      new THREE.Vector3(3.8, 0, 1.6), new THREE.Vector3(6.2, 0, -0.2),
    ];

    z.interactables.push(
      {
        id: 'salon-mirror', type: 'flavor', label: 'Inspect the mirrors',
        title: 'SIX-WAY CONFIRMATION', pos: new THREE.Vector3(0, 1.6, -4.7), radius: 2.4,
        lines: [
          'Six mirrors confirm the same result from six professional angles: nobody here has hair.',
          'The lighting is forgiving. The evidence is not.',
        ],
      },
      {
        id: 'salon-menu', type: 'flavor', label: 'Read the treatment menu',
        title: 'FULL SERVICE MENU', pos: new THREE.Vector3(6.85, 1.0, 2.1), radius: 2.2,
        clueKey: 'brandSeen', requiresPainting: true,
        clueLines: [
          'PERSONAL BRAND MAINTENANCE — market price. ARTIST IDENTITY CONSOLIDATION — ask receptionist.',
          'A prepared client card already has your name and “{{title}}” written on it.',
        ],
        lines: [
          'INVISIBLE TRIM — 90. CONCEPTUAL COLOR — 140. SCALP POLISH — market price.',
          'The cancellation policy is longer than every haircut in the building combined.',
        ],
      },
      {
        id: 'salon-inventory', type: 'flavor', label: 'Check the hair inventory',
        title: 'HAIR — OUT OF STOCK', pos: new THREE.Vector3(8.05, 1.6, -1.3), radius: 2.15,
        lines: [
          'Five smooth display heads wait on empty shelves. Even the wig stands are bald.',
          'A stock card reads: ORDERED — NEVER. RECEIVED — NONE. SHRINKAGE — EMOTIONAL.',
        ],
      },
      {
        id: 'salon-wash', type: 'flavor', label: 'Inspect the wash basins',
        title: 'THE CLEANEST DRAINS IN TOWN', pos: new THREE.Vector3(0, 0.9, 4.25), radius: 2.2,
        lines: [
          'Three spotless drains have never caught a clipping. Gunnar cleans them anyway.',
          'The conditioner promises volume, repair, and a tactful refusal to discuss raw materials.',
        ],
      },
    );

    door(z, { x: -8.8, z: 0, ry: Math.PI / 2, label: '← UP AND CUMMING ARTIST', to: 'upAndCumming' });
  }

  /* ---------------------------------------------------------- */
  /*  THE GLASS BOXES — scream therapy with a deductible       */
  /* ---------------------------------------------------------- */
  #buildRageRoom() {
    const z = this.#newZone('rageRoom');
    const roomH = 5.3;
    shell(z, { w: 24, d: 14, h: roomH, floorColor: 0xb8b5ad, wallColor: 0xeee9dd, ceilColor: 0xf7f4ea });
    z.spawn.set(-10.3, 0, 0);
    z.spawnYaw = -Math.PI / 2;
    z.fog = { color: 0xdcebf0, density: 0.007 };

    // Poly Haven CC0 PBR surfaces keep the room tactile without making the
    // daylight white cube feel dirty. The glass remains physically shaded.
    const textureLoader = new THREE.TextureLoader();
    const loadPbr = (folder, file, repeatX, repeatY, srgb = false) => {
      const tex = textureLoader.load(encodeURI(`puplic/polyhaven/${folder}/${file}`));
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(repeatX, repeatY);
      tex.anisotropy = 4;
      if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };
    const marblePbr = {
      map: loadPbr('glass-boxes/marble_01', 'marble_01_diff_1k.jpg', 9, 5, true),
      normalMap: loadPbr('glass-boxes/marble_01', 'marble_01_nor_gl_1k.jpg', 9, 5),
      roughnessMap: loadPbr('glass-boxes/marble_01', 'marble_01_rough_1k.jpg', 9, 5),
    };
    const plasterPbr = {
      map: loadPbr('glass-boxes/beige_wall_001', 'beige_wall_001_diff_1k.jpg', 4, 1.2, true),
      normalMap: loadPbr('glass-boxes/beige_wall_001', 'beige_wall_001_nor_gl_1k.jpg', 4, 1.2),
      roughnessMap: loadPbr('glass-boxes/beige_wall_001', 'beige_wall_001_rough_1k.jpg', 4, 1.2),
    };
    plane(z, { w: 23.7, h: 13.7, x: 0, y: 0.012, z: 0, rx: -Math.PI / 2,
      material: new THREE.MeshStandardMaterial({ color: 0xfff9ea, ...marblePbr, roughness: 0.48, normalScale: new THREE.Vector2(0.2, 0.2) }), noSplat: true, name: 'glass boxes PBR floor' });
    plane(z, { w: 23.7, h: 5.0, x: 0, y: 2.65, z: -7.19,
      material: new THREE.MeshStandardMaterial({ color: 0xfffbef, ...plasterPbr, roughness: 0.88, normalScale: new THREE.Vector2(0.22, 0.22) }), noSplat: true, name: 'glass boxes plaster wall' });

    // The Flesh Garden's big conservatory move, translated into institutional
    // architecture: one luminous roof plane above a forest of glass edges.
    plane(z, { w: 18.6, h: 8.2, x: 1.4, y: roomH - 0.08, z: 0, rx: Math.PI / 2,
      material: new THREE.MeshBasicMaterial({ color: 0xe7f8fb, transparent: true, opacity: 0.82, side: THREE.DoubleSide }),
      noSplat: true, name: 'glass boxes skylight' });
    const skylightRail = mat(0xd3d9d9, { metalness: 0.72, roughness: 0.26 });
    for (const x of [-7.8, -3.2, 1.4, 6.0, 10.6]) {
      box(z, { w: 0.065, h: 0.07, d: 8.25, x, y: roomH - 0.12, z: 0, material: skylightRail, solid: false, noSplat: true });
    }

    const glass = new THREE.MeshPhysicalMaterial({
      color: 0xd9f6ff, transparent: true, opacity: 0.3,
      transmission: 0.74, roughness: 0.11, metalness: 0,
      thickness: 0.08, ior: 1.45, clearcoat: 1, clearcoatRoughness: 0.035,
    });
    const frameMat = mat(0xb9c3c8, { metalness: 0.88, roughness: 0.2 });
    const oak = mat(0x9b6c3f, { roughness: 0.62, metalness: 0.02 });
    const breakables = [];
    const shards = [];
    const boothLabels = ['CHAOS', 'THE WOUND', 'JESUS FM', 'FREEGLASS', 'NO MASTER'];
    const boothLines = [
      ['Chaos has been acoustically treated. It still refuses to sit still.', 'A card reads: RHYTHM IS PANIC THAT FOUND A POCKET.'],
      ['The glass keeps fingerprints and releases grudges.', 'Someone has written FORGIVE THE WALL, NOT THE CAGE in tiny pencil.'],
      ['A battered radio receives one station: sermons chopped into hi-hats.', 'The dial points somewhere between doubt and grace.'],
      ['MC Freeglass performs to one microphone and five reflections.', 'The box is soundproof. The freedom is not.'],
      ['The exit is unlocked. The manifesto insists you notice that yourself.', 'A chair waits for authority, then collapses under the concept.'],
    ];

    const makeBreakable = (label, x, y, zz, geometry, material) => {
      const group = new THREE.Group(); group.position.set(x, 0, zz);
      const original = new THREE.Mesh(geometry, material);
      original.position.y = y; original.castShadow = true; group.add(original); z.group.add(group);
      const fragments = [];
      for (let i = 0; i < 6; i++) {
        const fragment = new THREE.Mesh(new THREE.BoxGeometry(0.11 + (i % 3) * 0.07, 0.08 + (i % 2) * 0.06, 0.06 + (i % 3) * 0.04), material.clone());
        fragment.position.set(x, y, zz); fragment.visible = false; fragment.userData.noSplat = true; z.group.add(fragment);
        fragments.push(fragment);
      }
      const target = { label, group, fragments, pos: new THREE.Vector3(x, y, zz), broken: false, brokenAt: 0, variant: breakables.length % 4 };
      breakables.push(target); shards.push(...fragments); return target;
    };

    const makeFrame = (x, zz, i) => {
      for (const [px, pz] of [[x - 1.75, zz - 2.55], [x + 1.75, zz - 2.55], [x - 1.75, zz + 2.55], [x + 1.75, zz + 2.55]]) {
        box(z, { w: 0.09, h: 3.0, d: 0.09, x: px, z: pz, material: frameMat, solid: false, noSplat: true });
      }
      for (const y of [0.05, 2.95]) {
        box(z, { w: 3.6, h: 0.09, d: 0.09, x, y, z: zz - 2.55, material: frameMat, solid: false, noSplat: true });
        box(z, { w: 3.6, h: 0.09, d: 0.09, x, y, z: zz + 2.55, material: frameMat, solid: false, noSplat: true });
        box(z, { w: 0.09, h: 0.09, d: 5.1, x: x - 1.75, y, z: zz, material: frameMat, solid: false, noSplat: true });
        box(z, { w: 0.09, h: 0.09, d: 5.1, x: x + 1.75, y, z: zz, material: frameMat, solid: false, noSplat: true });
      }
      box(z, { w: 3.55, h: 0.075, d: 0.22, x, y: 0.035, z: zz + 2.51, material: oak, solid: false, noSplat: true, name: 'oak glass threshold' });
      box(z, { w: 3.5, h: 2.82, d: 0.035, x, y: 0.08, z: zz - 2.53, material: glass, solid: false, noSplat: true, name: 'rage glass back' });
      box(z, { w: 0.035, h: 2.82, d: 5.0, x: x - 1.73, y: 0.08, z: zz, material: glass, solid: false, noSplat: true, name: 'rage glass side' });
      box(z, { w: 0.035, h: 2.82, d: 5.0, x: x + 1.73, y: 0.08, z: zz, material: glass, solid: false, noSplat: true, name: 'rage glass side' });
      plane(z, {
        w: 2.35, h: 0.34, x, y: 3.25, z: zz - 2.58,
        material: new THREE.MeshBasicMaterial({ map: textTexture(`BOX ${String(i + 1).padStart(2, '0')} · ${boothLabels[i]}`, { fg: '#152a31', bg: '#d6eef0', size: 28, w: 900, h: 150, font: '900' }) }),
        noSplat: true,
      });
      // Cool daylight reflected in the booth roof, with a warmer strip near
      // the occupant so faces remain readable through two panes of glass.
      const roofGlow = plane(z, { w: 2.9, h: 1.35, x, y: 3.72, z: zz, rx: Math.PI / 2,
        material: new THREE.MeshBasicMaterial({ color: i === 3 ? 0xfff2c4 : 0xd8f6ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide }), noSplat: true });
      roofGlow.userData.daylightPanel = true;
    };

    const boothX = [-8, -4, 0, 4, 8];
    for (let i = 0; i < boothX.length; i++) {
      const x = boothX[i]; const zz = 0.5; makeFrame(x, zz, i);
      makeBreakable(`${boothLabels[i]} chair`, x - 0.72, 0.58, zz + 0.35, new THREE.BoxGeometry(0.9, 0.16, 0.82), mat([0x7c2737, 0x344e67, 0x6f5b2c, 0x536c5e, 0x6b3b62][i], { roughness: 0.76 }));
      makeBreakable(`${boothLabels[i]} table`, x + 0.72, 0.7, zz - 0.45, new THREE.BoxGeometry(0.72, 0.14, 0.55), mat(0xb5a28c, { roughness: 0.82 }));
      makeBreakable(`${boothLabels[i]} object`, x, 0.42, zz + 1.35, new THREE.SphereGeometry(0.34, 12, 8), mat(0xc3263e, { roughness: 0.42 }));
      z.interactables.push({
        id: `rage-booth-${i}`, type: 'flavor', label: `Scream into ${boothLabels[i]} box`,
        title: `GLASS BOX ${String(i + 1).padStart(2, '0')}`, pos: new THREE.Vector3(x, 1.1, zz + 2.05), radius: 2.2,
        lines: boothLines[i],
      });
    }

    // The centre booth is a one-person stage: MC Freeglass, a microphone and
    // a tiny sampler desk. His bars arrive as paced subtitles over the coded
    // room score, while his body keeps time with the beat.
    const dude = new THREE.Group(); dude.position.set(0, 0, 0.5);
    const skin = mat(0x8e5538, { roughness: 0.78 });
    const shirt = mat(0x49336e, { roughness: 0.54, metalness: 0.08 });
    const trousers = mat(0x16222a, { roughness: 0.7 });
    const gold = mat(0xd8a52d, { roughness: 0.22, metalness: 0.82 });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.5, 6, 10), shirt); torso.position.y = 1.03;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), skin); head.position.y = 1.69;
    const makeArm = (side) => {
      const pivot = new THREE.Group(); pivot.position.set(side * 0.34, 1.28, 0);
      const limb = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.36, 5, 8), skin); limb.position.y = -0.25;
      const fist = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), skin); fist.position.y = -0.5;
      pivot.add(limb, fist); dude.add(pivot); return pivot;
    };
    const armL = makeArm(-1); const armR = makeArm(1);
    const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.44, 5, 8), trousers); legL.position.set(-0.14, 0.38, 0);
    const legR = legL.clone(); legR.position.x = 0.14;
    dude.add(torso, head, legL, legR);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.235, 0.11, 14), trousers); cap.position.y = 1.87; dude.add(cap);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.035, 0.19), trousers); brim.position.set(0, 1.82, 0.18); dude.add(brim);
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.018, 7, 20, Math.PI), gold); chain.position.set(0, 1.34, 0.285); chain.rotation.x = Math.PI / 2; dude.add(chain);
    const shades = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.07, 0.035), mat(0x12181d, { metalness: 0.62, roughness: 0.18 })); shades.position.set(0, 1.72, 0.205); dude.add(shades);
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.025, 0.018), mat(0xffd4b8, { roughness: 0.58 })); mouth.position.set(0, 1.61, 0.218); dude.add(mouth);
    dude.traverse((o) => { o.userData.noSplat = true; if (o.isMesh) o.castShadow = true; }); z.group.add(dude);
    dude.add(plane(z, { w: 2.55, h: 0.34, x: 0, y: 2.3, z: -0.02, material: new THREE.MeshBasicMaterial({ map: textTexture('MC FREEGLASS · BOXED BUT UNBROKEN', { fg: '#fff8d6', bg: '#392556', size: 28, w: 1100, h: 140, font: '900' }) }), noSplat: true }));

    const micStand = new THREE.Group(); micStand.position.set(0.42, 0, 0.82);
    const standPole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 1.46, 8), frameMat); standPole.position.y = 0.73;
    const mic = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.16, 5, 8), mat(0x202b32, { roughness: 0.26, metalness: 0.72 })); mic.position.set(-0.08, 1.48, 0); mic.rotation.z = 1.08;
    const standBase = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.26, 0.045, 14), trousers); standBase.position.y = 0.022;
    micStand.add(standPole, mic, standBase); micStand.traverse((o) => { o.userData.noSplat = true; }); z.group.add(micStand);
    box(z, { w: 1.25, h: 0.72, d: 0.58, x: 0, y: 0.01, z: -0.55, material: oak, solid: false, noSplat: true, name: 'MC sampler desk' });
    box(z, { w: 0.92, h: 0.08, d: 0.43, x: 0, y: 0.74, z: -0.55, material: trousers, solid: false, noSplat: true });
    for (let i = 0; i < 8; i++) box(z, { w: 0.065, h: 0.025, d: 0.065, x: -0.3 + (i % 4) * 0.2, y: 0.79, z: -0.66 + Math.floor(i / 4) * 0.16, material: mat(i % 3 === 0 ? 0xf46f61 : 0x9edbe0, { emissive: i % 3 === 0 ? 0x57120d : 0x173c42, emissiveIntensity: 0.38 }), solid: false, noSplat: true });
    for (const sx of [-1.18, 1.18]) {
      box(z, { w: 0.46, h: 0.82, d: 0.4, x: sx, y: 0.02, z: -0.52, material: trousers, solid: false, noSplat: true });
      for (const y of [0.25, 0.58]) {
        const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.025, 16), mat(0x344d56, { roughness: 0.48 }));
        cone.position.set(sx, y, -0.725); cone.rotation.x = Math.PI / 2; cone.userData.noSplat = true; z.group.add(cone);
      }
    }

    // Floating signal lights and translucent acoustic ribbons borrow the
    // garden's layered silhouettes without turning the room into foliage.
    const signalColors = [0x40cfe5, 0xffcb4d, 0xff6b73, 0x8267df];
    const signalOrbs = [];
    for (let i = 0; i < 9; i++) {
      const color = signalColors[i % signalColors.length];
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.09 + (i % 3) * 0.02, 12, 9),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.1, roughness: 0.2 })
      );
      orb.position.set(-8.2 + i * 2.05, 0.85 + (i % 3) * 0.48, 5.65 + Math.sin(i * 1.7) * 0.22);
      orb.userData.noSplat = true; z.group.add(orb);
      signalOrbs.push({ mesh: orb, baseY: orb.position.y, phase: i * 0.77 });
    }
    for (const [x, color, tilt] of [[-5.7, 0xff6b73, -0.15], [0.2, 0x40cfe5, 0.11], [6.5, 0xffcb4d, -0.08]]) {
      const ribbon = new THREE.Mesh(
        new THREE.PlaneGeometry(2.9, 0.3, 6, 1),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })
      );
      ribbon.position.set(x, 4.18, 5.85); ribbon.rotation.set(0.08, Math.PI, tilt);
      ribbon.userData.noSplat = true; z.group.add(ribbon);
    }

    z.interactables.push({
      id: 'mc-freeglass', type: 'mcJukebox', label: 'Touch MC Freeglass’s jukebox · E',
      title: 'THE FREEDOM FREQUENCY', pos: new THREE.Vector3(0, 1.1, 2.45), radius: 2.35,
      lines: [
        'A sampler chews daylight into crooked drums. The booth returns every word as a softer revolution.',
        'MC FREEGLASS: “Freedom is not silence. Freedom is choosing what the echo gets to keep.”',
      ],
    });

    z.animated.rageRoom = {
      breakables, shards, dude, torso, head, armL, armR, signalOrbs, rageLight: null, timer: 1.5, nextIndex: 0, shoutIndex: 0,
      lines: [
        'Chaos on the kick drum, but I keep my breath in time.',
        'Jesus in the reverb saying mercy still can rhyme.',
        'I met fear in a glass box. Fear asked me for the key.',
        'I said freedom is a practice, not a door somebody gives me.',
        'Break the throne in your head, leave the window where it stood.',
        'Grace is not obedience. Grace is choosing what is good.',
        'No master in the mirror, no market in my chest.',
        'Let the crooked jazz confess what the straight line has suppressed.',
        'If the world arrives as chaos, make a rhythm, make a name.',
        'Jesus flipped the tables; I just sample what remains.',
        'The box can hold my body, not the weather in my voice.',
        'To be free is not escape. It is the muscle of a choice.',
      ],
    };
    plane(z, { w: 8.5, h: 0.55, x: 0, y: 4.65, z: -7.16, material: new THREE.MeshBasicMaterial({ map: textTexture('THE GLASS BOXES  ·  CHAOS / GRACE / FREEDOM', { fg: '#15333b', bg: '#e4f5f3', size: 37, w: 1600, h: 180, font: '900' }) }), noSplat: true });
    plane(z, { w: 6.2, h: 0.28, x: 0, y: 4.12, z: -7.15, material: new THREE.MeshBasicMaterial({ map: textTexture('DAYLIGHT IN · FEAR OUT · WEIRD JAZZ FOREVER', { fg: '#6e4a21', bg: '#fff2c9', size: 24, w: 1500, h: 120, font: '700' }) }), noSplat: true });

    // A long false clerestory creates a convincing source for the daylight,
    // rather than simply raising ambient intensity across the whole room.
    for (let i = 0; i < 7; i++) {
      const x = -9 + i * 3;
      plane(z, { w: 2.55, h: 1.28, x, y: 3.8, z: 7.18, ry: Math.PI,
        material: new THREE.MeshBasicMaterial({ color: i % 2 ? 0xc9ecf5 : 0xe7f8fb, side: THREE.DoubleSide }), noSplat: true, name: 'clerestory sky' });
      box(z, { w: 0.06, h: 1.4, d: 0.08, x: x - 1.31, y: 3.1, z: 7.05, material: frameMat, solid: false, noSplat: true });
    }
    const sun = new THREE.DirectionalLight(0xfff0cf, 3.0); sun.position.set(-7, 11, 5); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -13; sun.shadow.camera.right = 13;
    sun.shadow.camera.top = 9; sun.shadow.camera.bottom = -9; z.group.add(sun);
    const sky = new THREE.HemisphereLight(0xe7fbff, 0xa39a88, 2.25); z.group.add(sky);
    const red = new THREE.PointLight(0x78d8e7, 1.65, 10, 1.7); red.position.set(0, 3.0, 0.4); red.userData.baseIntensity = 1.65; z.group.add(red); z.animated.rageLight = red; z.animated.rageRoom.rageLight = red;
    door(z, { x: -11.8, z: 0, ry: Math.PI / 2, label: '← GALLERIA BIANCA', to: 'galleria' });
    z.waypoints = [new THREE.Vector3(-9, 0, -5), new THREE.Vector3(-5, 0, -5), new THREE.Vector3(5, 0, -5), new THREE.Vector3(9, 0, -5)];
  }

  /* ---------------------------------------------------------- */
  /*  BARBIE DEATH METAL — pink plastic, black eyeliner, no nuance */
  /* ---------------------------------------------------------- */
  #buildDeathMetal() {
    const z = this.#newZone('deathMetal');
    shell(z, { w: 26, d: 16, floorColor: 0x18151d, wallColor: 0x0d0b12, ceilColor: 0x09070c });
    z.spawn.set(-10.7, 0, 0);
    z.spawnYaw = -Math.PI / 2;
    z.fog = { color: 0x09070f, density: 0.021 };

    // Reuse the local Poly Haven studio library: worn wood under the crowd and
    // damaged plaster behind the stage keep the room grounded in a real venue.
    const textureLoader = new THREE.TextureLoader();
    const loadPbr = (folder, file, repeatX, repeatY, srgb = false) => {
      const tex = textureLoader.load(encodeURI(`puplic/polyhaven/studio/${folder}/${file}`));
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(repeatX, repeatY);
      tex.anisotropy = 4;
      if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };
    const woodPbr = {
      map: loadPbr('old_wood_floor', 'old_wood_floor_diff_1k.jpg', 8, 5, true),
      normalMap: loadPbr('old_wood_floor', 'old_wood_floor_nor_gl_1k.jpg', 8, 5),
      roughnessMap: loadPbr('old_wood_floor', 'old_wood_floor_rough_1k.jpg', 8, 5),
    };
    const plasterPbr = {
      map: loadPbr('worn_plaster_wall', 'worn_plaster_wall_diff_1k.jpg', 4, 2, true),
      normalMap: loadPbr('worn_plaster_wall', 'worn_plaster_wall_nor_gl_1k.jpg', 4, 2),
      roughnessMap: loadPbr('worn_plaster_wall', 'worn_plaster_wall_rough_1k.jpg', 4, 2),
    };
    plane(z, { w: 25.7, h: 15.7, x: 0, y: 0.012, z: 0, rx: -Math.PI / 2, material: new THREE.MeshStandardMaterial({ color: 0x5e344b, ...woodPbr, roughness: 0.76, normalScale: new THREE.Vector2(0.5, 0.5) }), noSplat: true, name: 'death metal wood floor' });
    // The floor keeps full PBR detail. Walls retain the plaster albedo but skip
    // normal/roughness maps: that cuts the room's heaviest fragment work.
    plane(z, { w: 25.7, h: 3.35, x: 0, y: 1.75, z: -7.99, material: new THREE.MeshLambertMaterial({ color: 0x332036, map: plasterPbr.map }), noSplat: true, name: 'death metal plaster wall' });
    plane(z, { w: 15.7, h: 3.35, x: -12.99, y: 1.75, z: 0, ry: Math.PI / 2, material: new THREE.MeshLambertMaterial({ color: 0x25172c, map: plasterPbr.map }), noSplat: true });
    plane(z, { w: 15.7, h: 3.35, x: 12.99, y: 1.75, z: 0, ry: -Math.PI / 2, material: new THREE.MeshLambertMaterial({ color: 0x25172c, map: plasterPbr.map }), noSplat: true });

    const black = mat(0x101018, { roughness: 0.72, metalness: 0.12 });
    const iron = mat(0x26212e, { roughness: 0.35, metalness: 0.8 });
    const pink = new THREE.MeshPhysicalMaterial({
      color: 0xff2c9c, emissive: 0x6e0b47, emissiveIntensity: 0.65,
      roughness: 0.28, metalness: 0.16, clearcoat: 0.7,
    });
    const acid = new THREE.MeshBasicMaterial({ color: 0xd8ff3e });
    const white = mat(0xe7e0e8, { roughness: 0.88 });

    // The stage is intentionally too small for the certainty of the opinions.
    box(z, { w: 10.4, h: 0.42, d: 3.4, x: 1.1, y: 0, z: -5.15, material: black, solid: false, name: 'barbie death metal stage' });
    for (const x of [-4.1, 6.3]) {
      box(z, { w: 1.25, h: 3.1, d: 1.0, x, y: 0.42, z: -5.0, material: iron, solid: false, noSplat: true, name: 'death metal speaker' });
      for (const y of [0.95, 1.65, 2.35]) {
        cylinder(z, { rT: 0.24, rB: 0.24, h: 0.04, x, y, z: -5.53, material: black, seg: 16, solid: false, noSplat: true });
      }
    }

    // A Barbie-like museum object: impossible waist, crown, hair, and a black
    // metal halo. It is art because the room has installed enough cable around it.
    const barbie = new THREE.Group(); barbie.position.set(1.1, 0.42, -4.05);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.62, 6, 12), pink); body.position.y = 0.78;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 16, 12), pink); head.position.y = 1.52;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.29, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), black); hair.position.set(0, 1.58, -0.02);
    const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.52, 0.48, 12), pink); skirt.position.y = 0.32;
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.035, 8, 32), acid); halo.position.set(0, 1.6, -0.08); halo.rotation.x = Math.PI / 2;
    barbie.add(body, head, hair, skirt, halo); barbie.traverse((o) => { o.userData.noSplat = true; }); z.group.add(barbie);
    plane(z, {
      w: 3.5, h: 0.42, x: 1.1, y: 2.45, z: -4.07,
      material: new THREE.MeshBasicMaterial({ map: textTexture('BARBIE · PLASTIC / POWER / APOCALYPSE', { fg: '#ffb6e3', bg: '#1a0715', size: 28, w: 1300, h: 160, font: '900' }) }),
      noSplat: true,
    });

    // Flyer walls: the room's curatorial vocabulary is all eyeliner and footnotes.
    for (const [x, text, color] of [
      [-9.4, 'PUNK IS A COLOR OF PINK', '#ff4bb4'],
      [-4.9, 'BARBIE HAS ENTERED THE MOSHPIT', '#d8ff3e'],
      [7.8, 'NO HEELS · ONLY HEAVY RIFFS', '#ff4bb4'],
    ]) {
      plane(z, {
        w: 3.25, h: 1.0, x, y: 1.72, z: 7.78, ry: Math.PI,
        material: new THREE.MeshBasicMaterial({ map: textTexture(text, { fg: color, bg: '#120b16', size: 27, w: 900, h: 260, font: '900' }) }),
        noSplat: true,
      });
    }
    for (const x of [-8.5, -5.7, 6.5, 8.8]) {
      box(z, { w: 0.12, h: 2.6, d: 0.12, x, y: 0.02, z: 4.8, material: iron, solid: false, noSplat: true });
      box(z, { w: 0.12, h: 0.12, d: 3.4, x, y: 2.5, z: 4.8, material: iron, solid: false, noSplat: true });
    }

    // A tiny merch table: every revolution eventually acquires a tote bag.
    box(z, { w: 2.2, h: 0.78, d: 0.8, x: -7.8, y: 0, z: -1.8, material: black, name: 'barbie death metal merch' });
    for (let i = 0; i < 4; i++) {
      box(z, { w: 0.34, h: 0.42, d: 0.05, x: -8.4 + i * 0.4, y: 0.78, z: -2.23, material: i % 2 ? pink : white, solid: false, noSplat: true });
    }

    // Full little club rig: two guitarists, a drummer, and an unreasonable
    // amount of black cable. Instruments are deliberately readable at game scale.
    const instrumentMat = mat(0x090910, { roughness: 0.3, metalness: 0.65 });
    const chrome = mat(0xc9d1d7, { roughness: 0.2, metalness: 0.9 });
    const makeMusician = (x, zz, shirtColor, kind) => {
      const group = new THREE.Group(); group.position.set(x, 0.42, zz);
      const shirt = mat(shirtColor, { roughness: 0.8 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.62, 0.25), shirt); body.position.y = 0.76;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), mat(0xc98f70, { roughness: 0.82 })); head.position.y = 1.35;
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.7), black); hair.position.y = 1.42;
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.52, 0.12), shirt); armL.position.set(-0.27, 0.78, 0.02);
      const armR = armL.clone(); armR.position.x = 0.27;
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.56, 0.14), black); legL.position.set(-0.11, 0.28, 0);
      const legR = legL.clone(); legR.position.x = 0.11;
      group.add(body, head, hair, armL, armR, legL, legR);
      const guitar = new THREE.Group();
      const guitarBody = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 8), kind === 'bass' ? pink : instrumentMat); guitarBody.scale.set(1.0, 0.72, 0.34); guitarBody.position.set(0, 0.83, 0.22);
      const guitarNeck = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.58, 0.06), chrome); guitarNeck.position.set(0, 1.12, 0.18); guitarNeck.rotation.z = kind === 'bass' ? -0.35 : 0.32;
      const guitarHead = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.12, 0.06), chrome); guitarHead.position.set(kind === 'bass' ? -0.14 : 0.14, 1.39, 0.1);
      guitar.add(guitarBody, guitarNeck, guitarHead); guitar.rotation.z = kind === 'bass' ? -0.22 : 0.22; group.add(guitar);
      group.traverse((o) => { o.userData.noSplat = true; if (o.isMesh) o.castShadow = true; });
      z.group.add(group);
      return { group, body, head, armL, armR, guitar, kind };
    };
    const guitarist = makeMusician(-2.2, -5.18, 0x2a1027, 'guitar');
    const bassist = makeMusician(4.15, -5.18, 0x141d32, 'bass');
    const drumGroup = new THREE.Group(); drumGroup.position.set(1.15, 0.42, -5.42);
    const drumKick = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.34, 18), pink); drumKick.rotation.x = Math.PI / 2; drumKick.position.y = 0.55;
    const drumTop = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 16), white); drumTop.position.set(-0.55, 0.83, 0.08);
    const cymbal = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.025, 24), chrome); cymbal.position.set(0.55, 1.36, 0);
    const stickL = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.64, 7), chrome); stickL.position.set(-0.25, 1.13, 0.12); stickL.rotation.z = -0.7;
    const stickR = stickL.clone(); stickR.position.x = 0.25; stickR.rotation.z = 0.7;
    drumGroup.add(drumKick, drumTop, cymbal, stickL, stickR); drumGroup.traverse((o) => { o.userData.noSplat = true; }); z.group.add(drumGroup);

    // Truss, beams, and a proper pit boundary give the room concert geometry.
    box(z, { w: 12.4, h: 0.14, d: 0.14, x: 1.1, y: 3.22, z: -3.75, material: iron, solid: false, noSplat: true });
    for (const x of [-4.8, 7.0]) box(z, { w: 0.14, h: 3.2, d: 0.14, x, y: 0.02, z: -3.75, material: iron, solid: false, noSplat: true });
    const beamMeshes = [];
    const concertLights = [];
    for (const [x, color] of [[-4.2, 0xff187f], [-1.0, 0xd8ff3e], [2.4, 0x6f55ff], [5.6, 0xff187f]]) {
      const spot = new THREE.SpotLight(color, 12, 15, 0.32, 0.72, 1.8); spot.position.set(x, 3.12, -3.6); spot.target.position.set(x * 0.32, 0, -1.6); z.group.add(spot, spot.target); concertLights.push(spot);
      const beam = new THREE.Mesh(new THREE.ConeGeometry(0.62, 5.8, 14, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.075, depthWrite: false, side: THREE.DoubleSide }));
      beam.position.set(x, 1.05, -2.5); beam.rotation.x = Math.PI; beam.userData.noSplat = true; z.group.add(beam); beamMeshes.push(beam);
    }

    const pitRing = new THREE.Mesh(new THREE.RingGeometry(3.1, 4.0, 64), new THREE.MeshBasicMaterial({ color: 0x7a163e, transparent: true, opacity: 0.62, side: THREE.DoubleSide }));
    pitRing.rotation.x = -Math.PI / 2; pitRing.position.set(0, 0.026, 2.25); pitRing.userData.noSplat = true; z.group.add(pitRing);
    plane(z, { w: 3.5, h: 0.78, x: 0, y: 0.035, z: 2.25, rx: -Math.PI / 2, material: new THREE.MeshBasicMaterial({ map: textTexture('MOSHPIT', { fg: '#d8ff3e', bg: '#251021', size: 58, w: 900, h: 220, font: '900' }), transparent: true, opacity: 0.7 }), noSplat: true });
    for (const x of [-4.35, 4.35]) {
      box(z, { w: 0.14, h: 0.85, d: 4.0, x, y: 0, z: 2.25, material: iron, solid: false, noSplat: true });
      for (const zz of [0.7, 1.9, 3.1]) box(z, { w: 0.28, h: 0.08, d: 0.08, x, y: 0.65, z: zz, material: acid, solid: false, noSplat: true });
    }

    const makeMosher = (index) => {
      const group = new THREE.Group();
      const clothes = mat(index % 3 === 0 ? 0x17121d : index % 3 === 1 ? 0x2b1429 : 0x111820, { roughness: 0.88 });
      const skinMat = mat(index % 2 ? 0xc98f70 : 0xd8a58d, { roughness: 0.86 });
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.48, 0.18), clothes); torso.position.y = 0.67;
      const shirtGraphic = new THREE.Mesh(new THREE.PlaneGeometry(0.19, 0.12), new THREE.MeshBasicMaterial({ map: textTexture(index % 2 ? 'B' : 'PUNK', { fg: index % 2 ? '#ff83c8' : '#d8ff3e', bg: '#100b14', size: 17, w: 260, h: 150, font: '900' }) }));
      shirtGraphic.position.set(0, 0.7, 0.101); shirtGraphic.userData.noSplat = true;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), skinMat); head.position.y = 1.08;
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.72), index % 2 ? pink : black); hair.position.y = 1.15;
      const spikes = [];
      for (const x of [-0.09, 0, 0.09]) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.17, 6), index % 2 ? pink : acid);
        spike.position.set(x, 1.29, 0); spike.rotation.z = x * 1.8; spikes.push(spike);
      }
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.1), skinMat); arm.position.set(-0.22, 0.74, 0.03);
      const arm2 = arm.clone(); arm2.position.x = 0.22;
      const fist = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), skinMat); fist.position.set(-0.22, 0.51, 0.03);
      const fist2 = fist.clone(); fist2.position.x = 0.22;
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.12), black); leg.position.set(-0.09, 0.25, 0);
      const leg2 = leg.clone(); leg2.position.x = 0.09;
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, 0.2), iron); boot.position.set(-0.09, 0.035, 0.035);
      const boot2 = boot.clone(); boot2.position.x = 0.09;
      const prop = new THREE.Group();
      const propBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.12, 4, 6), pink); propBody.position.y = 0.07;
      const propHead = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), pink); propHead.position.y = 0.19;
      const propHair = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.65), black); propHair.position.y = 0.21;
      prop.add(propBody, propHead, propHair); prop.position.set(0.26, 0.91, 0.16);
      group.add(torso, shirtGraphic, head, hair, ...spikes, arm, arm2, fist, fist2, leg, leg2, boot, boot2, prop); group.traverse((o) => { o.userData.noSplat = true; }); z.group.add(group);
      return {
        group, torso, head, arm, arm2, fist, fist2, leg, leg2, prop,
        angle: index * (Math.PI * 2 / 12), radius: 3.35 + (index % 3) * 0.24,
        speed: 0.55 + (index % 4) * 0.1, phase: index * 0.8,
        style: index % 4 === 0 ? 'slam' : index % 4 === 1 ? 'surge' : 'circle',
      };
    };
    const moshers = Array.from({ length: 12 }, (_, i) => makeMosher(i));
    z.animated.deathMetal = { barbie, guitarist, bassist, drumGroup, drumKick, cymbal, stickL, stickR, concertLights, beamMeshes, moshers, pitRing, lastStep: -1 };

    const wash = new THREE.PointLight(0xff218f, 9, 16, 1.7); wash.position.set(1.1, 3.0, -4.3); z.group.add(wash);
    const green = new THREE.PointLight(0xd8ff3e, 5, 13, 1.8); green.position.set(-7.5, 2.8, 3.5); z.group.add(green);
    z.group.add(new THREE.HemisphereLight(0x3b163b, 0x08070d, 0.64));
    plane(z, { w: 6.8, h: 0.48, x: 0, y: 3.36, z: -7.82, material: new THREE.MeshBasicMaterial({ map: textTexture('BARBIE DEATH METAL  ·  ART IS A RIFF', { fg: '#ff9fd6', bg: '#180814', size: 40, w: 1500, h: 180, font: '900' }) }), noSplat: true });
    plane(z, { w: 5.4, h: 0.28, x: 0, y: 2.82, z: -7.81, material: new THREE.MeshBasicMaterial({ map: textTexture('PUNKS AND DEATHMETAL GOTHS ONLY · NO CLEAN VERSIONS', { fg: '#d8ff3e', bg: '#0c1010', size: 23, w: 1500, h: 120, font: '800' }) }), noSplat: true });

    z.interactables.push({
      id: 'barbie-art', type: 'flavor', label: 'Inspect the Barbie artwork',
      title: 'BARBIE, AFTER THE END OF THE WORLD', pos: new THREE.Vector3(1.1, 1.2, -3.85), radius: 2.2,
      lines: [
        'The figure is pink, crowned, and surrounded by enough black cable to qualify as a band.',
        'A wall text asks whether Barbie is a feminist icon, a corporate ghost, or both on tour.',
        'The halo is acid green. The label says “empowerment object.” The amp says nothing.',
        'Someone has written PUNK IS A COLOR OF PINK across the catalogue in eyeliner.',
      ],
    });
    door(z, { x: -12.8, z: 0, ry: Math.PI / 2, label: '← GALLERIA BIANCA', to: 'galleria' });
    z.anchors.razorKen = new THREE.Vector3(-6.2, 0, 1.0);
    z.anchors.baronessBlastbeat = new THREE.Vector3(-1.7, 0, 2.5);
    z.anchors.kikiKillswitch = new THREE.Vector3(4.0, 0, 2.3);
    z.anchors.morticiaPlastic = new THREE.Vector3(7.8, 0, 0.3);
    z.anchors.boneBarbie = new THREE.Vector3(1.2, 0, -1.3);
    z.anchors.fatPunk = new THREE.Vector3(-8.5, 0, 1.1);
    z.anchorYaws = {
      razorKen: -0.4, baronessBlastbeat: 0.1, kikiKillswitch: -0.2,
      morticiaPlastic: 1.1, boneBarbie: Math.PI, fatPunk: -0.3,
    };
    z.waypoints = [
      new THREE.Vector3(-8, 0, 3.5), new THREE.Vector3(-3, 0, 4.8),
      new THREE.Vector3(3, 0, 4.6), new THREE.Vector3(8, 0, 3.2),
      new THREE.Vector3(-7, 0, -0.4), new THREE.Vector3(6, 0, -1.2),
    ];
  }

  /* ---------------------------------------------------------- */
  /*  THE PUBLIC RESTROOM — ceramic acoustics, no polite sounds */
  /* ---------------------------------------------------------- */
  #buildPublicRestroom() {
    const z = this.#newZone('publicRestroom');
    const roomW = 16;
    const roomD = 12;
    const roomH = 4.2;
    shell(z, {
      w: roomW, d: roomD, h: roomH,
      floorColor: 0x65716c, wallColor: 0xb9c4bd, ceilColor: 0x7d8580,
    });
    // Clear the return door's interaction radius so arrival begins with the
    // room, not an immediate invitation to leave again.
    z.spawn.set(0, 0, 3.55);
    z.spawnYaw = 0;
    z.fog = { color: 0x18221f, density: 0.024 };

    // Grimy sea-green ceramic tile remains highly readable in the low club
    // light. The grout is drawn once and repeated by the GPU.
    const tileSource = canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#9eaaa3'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#657069';
      ctx.fillRect(0, 0, w, 9); ctx.fillRect(0, 0, 9, h);
      ctx.fillStyle = 'rgba(235,245,239,0.16)';
      ctx.fillRect(14, 14, w - 24, 4);
      ctx.fillStyle = 'rgba(38,54,48,0.11)';
      for (let i = 0; i < 22; i++) {
        const x = (i * 71) % w; const y = (i * 113) % h;
        ctx.fillRect(x, y, 2 + (i % 5), 2 + ((i * 3) % 7));
      }
    });
    const tiled = (repeatX, repeatY, color = 0xffffff) => {
      const map = tileSource.clone();
      map.wrapS = map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(repeatX, repeatY);
      map.needsUpdate = true;
      return new THREE.MeshStandardMaterial({ color, map, roughness: 0.26, metalness: 0.04 });
    };
    plane(z, {
      w: roomW - 0.45, h: roomD - 0.45, y: 0.012, rx: -Math.PI / 2,
      material: tiled(12, 9, 0x89968f), noSplat: false, name: 'restroom tile floor',
    });
    plane(z, { w: roomW - 0.45, h: roomH - 0.25, y: roomH / 2, z: -5.785, material: tiled(14, 4), noSplat: false });
    plane(z, { w: roomW - 0.45, h: roomH - 0.25, y: roomH / 2, z: 5.785, ry: Math.PI, material: tiled(14, 4), noSplat: false });
    plane(z, { w: roomD - 0.45, h: roomH - 0.25, x: -7.785, y: roomH / 2, ry: Math.PI / 2, material: tiled(10, 4), noSplat: false });
    plane(z, { w: roomD - 0.45, h: roomH - 0.25, x: 7.785, y: roomH / 2, ry: -Math.PI / 2, material: tiled(10, 4), noSplat: false });

    // A genuine local Poly Haven material from the project's texture library
    // skins the damp ceiling, including its normal and roughness maps.
    const ceilingMat = new THREE.MeshStandardMaterial({ color: 0xaab4ad, roughness: 0.92 });
    plane(z, {
      w: roomW - 0.42, h: roomD - 0.42, y: roomH - 0.105, rx: Math.PI / 2,
      material: ceilingMat, noSplat: true, name: 'Poly Haven painted plaster ceiling',
    });
    const restroomLoader = new THREE.TextureLoader();
    const ceilingRoot = 'puplic/polyhaven/daylight-garden/painted_plaster_wall';
    const loadCeiling = (slot, file, srgb = false) => {
      restroomLoader.load(encodeURI(`${ceilingRoot}/${file}`), (tex) => {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(4, 3);
        tex.anisotropy = 4;
        if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
        ceilingMat[slot] = tex;
        ceilingMat.needsUpdate = true;
      });
    };
    loadCeiling('map', 'painted_plaster_wall_diff_1k.jpg', true);
    loadCeiling('normalMap', 'painted_plaster_wall_nor_gl_1k.jpg');
    loadCeiling('roughnessMap', 'painted_plaster_wall_rough_1k.jpg');

    const porcelain = new THREE.MeshPhysicalMaterial({
      color: 0xe9eee9, roughness: 0.15, metalness: 0.02,
      clearcoat: 0.82, clearcoatRoughness: 0.08,
    });
    const steel = new THREE.MeshStandardMaterial({ color: 0xabb9b6, roughness: 0.18, metalness: 0.84 });
    const partitionMat = new THREE.MeshStandardMaterial({ color: 0x29463f, roughness: 0.44, metalness: 0.36 });
    const blackRubber = mat(0x111817, { roughness: 0.88, metalness: 0.02 });

    // Four stalls form the back wall. Their laminated fronts use one of the
    // user's blue painterly textures from puplic/textures as a shared library
    // image, so the restroom still belongs to this particular art world.
    const stallDoorMat = new THREE.MeshStandardMaterial({ color: 0x5f8d9d, roughness: 0.46, metalness: 0.08 });
    restroomLoader.load(encodeURI('puplic/textures/8.jpg'), (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      stallDoorMat.map = tex;
      stallDoorMat.color.set(0xb9d7df);
      stallDoorMat.needsUpdate = true;
    });
    const stallCenters = [-5.7, -1.9, 1.9, 5.7];
    let impossiblePoop = null;
    let doomedFlush = null;
    let containmentBeacon = null;
    for (const x of [-7.55, -3.8, 0, 3.8, 7.55]) {
      box(z, {
        w: 0.11, h: 2.48, d: 3.95, x, y: 0.18, z: -3.75,
        material: partitionMat, noSplat: true, name: 'restroom stall partition',
      });
    }
    for (let i = 0; i < stallCenters.length; i++) {
      const x = stallCenters[i];
      const doorPanel = box(z, {
        w: 2.68, h: 2.2, d: 0.09, x, y: 0.25, z: -1.79,
        material: stallDoorMat, solid: false, noSplat: false, name: 'painted restroom stall door',
      });
      doorPanel.rotation.y = (i % 2 ? -1 : 1) * (0.08 + i * 0.025);
      const latch = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.09), steel);
      latch.position.set(x + 1.03, 1.35, -1.71);
      z.group.add(latch);

      const toilet = new THREE.Group();
      toilet.position.set(x, 0, -4.75);
      const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.38, 20, 12), porcelain);
      bowl.scale.set(1, 0.58, 1.32); bowl.position.set(0, 0.39, 0.08);
      const seat = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.052, 9, 28), porcelain);
      seat.rotation.x = Math.PI / 2; seat.scale.z = 1.24; seat.position.set(0, 0.57, 0.06);
      const cistern = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.72, 0.26), porcelain);
      cistern.position.set(0, 0.74, -0.38);
      const flush = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.035, 14), steel);
      flush.rotation.z = Math.PI / 2; flush.position.set(0.39, 0.86, -0.38);
      toilet.add(bowl, seat, cistern, flush);
      toilet.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      z.group.add(toilet);

      if (i === 2) {
        // Stall three contains an object whose scale is incompatible with both
        // the toilet and municipal optimism. Coiled glossy forms rise far above
        // the seat, with extra overflow parked on the tile.
        const poopMat = new THREE.MeshPhysicalMaterial({
          color: 0x4a1f0d, roughness: 0.34, metalness: 0.02,
          clearcoat: 0.68, clearcoatRoughness: 0.19,
        });
        impossiblePoop = new THREE.Group();
        impossiblePoop.position.set(x, 0.55, -4.67);
        const coils = [
          [0.48, 0.18, 0.07, -0.06],
          [0.43, 0.17, 0.32, 0.05],
          [0.35, 0.155, 0.56, -0.04],
          [0.27, 0.135, 0.77, 0.035],
        ];
        for (const [radius, tube, yy, offsetX] of coils) {
          const coil = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 12, 32), poopMat);
          coil.rotation.x = Math.PI / 2;
          coil.position.set(offsetX, yy, 0);
          coil.castShadow = true;
          impossiblePoop.add(coil);
        }
        const crown = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.48, 22), poopMat);
        crown.position.set(0.045, 1.03, 0.01);
        crown.rotation.z = -0.13;
        crown.castShadow = true;
        impossiblePoop.add(crown);
        for (const [ox, oz, scale] of [[-0.52, 0.16, 0.48], [0.48, 0.28, 0.4], [0.32, -0.36, 0.33]]) {
          const overflow = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 10), poopMat);
          overflow.position.set(ox, -0.34, oz);
          overflow.scale.set(scale * 1.35, scale * 0.42, scale);
          overflow.castShadow = true;
          impossiblePoop.add(overflow);
        }
        impossiblePoop.traverse((o) => { if (o.isMesh) o.userData.noSplat = true; });
        z.group.add(impossiblePoop);
        doomedFlush = flush;

        plane(z, {
          w: 2.2, h: 0.33, x, y: 2.06, z: -1.735,
          material: new THREE.MeshBasicMaterial({
            map: textTexture('STALL 3 · CONTAINMENT', { fg: '#fff2a8', bg: '#491d18', size: 31, w: 900, h: 145, font: '800' }),
          }), noSplat: true,
        });
        const warning = new THREE.PointLight(0xff3c32, 3.4, 4.5, 1.7);
        warning.position.set(x, 2.35, -3.8);
        z.group.add(warning);

        // The door is now a tiny crime scene: crossed tape and a rotating red
        // beacon make the incident legible before the player enters the stall.
        const tapeMat = new THREE.MeshBasicMaterial({
          map: textTexture('DO NOT CROSS  ·  POOP CRIME SCENE  ·  DO NOT CROSS', {
            fg: '#17130a', bg: '#f4d13f', size: 27, w: 1400, h: 115, font: '800',
          }),
        });
        for (const [yy, rz] of [[1.18, 0.1], [1.5, -0.1]]) {
          const tape = plane(z, { w: 3.0, h: 0.18, x, y: yy, z: -1.685, material: tapeMat, noSplat: true });
          tape.rotation.z = rz;
        }
        const beaconBase = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.08, 16), blackRubber);
        beaconBase.position.set(x, 2.62, -1.69);
        const beaconDome = new THREE.Mesh(
          new THREE.SphereGeometry(0.145, 16, 9, 0, Math.PI * 2, 0, Math.PI * 0.58),
          new THREE.MeshPhysicalMaterial({
            color: 0xff3328, emissive: 0xff1f18, emissiveIntensity: 3.2,
            transparent: true, opacity: 0.82, roughness: 0.12, clearcoat: 1,
          })
        );
        beaconDome.position.set(x, 2.69, -1.69);
        const beaconLight = new THREE.PointLight(0xff3028, 4.5, 5.2, 1.7);
        beaconLight.position.set(x, 2.73, -1.56);
        beaconBase.userData.noSplat = beaconDome.userData.noSplat = true;
        z.group.add(beaconBase, beaconDome, beaconLight);
        containmentBeacon = { dome: beaconDome, light: beaconLight };
      }

      z.colliders.push({ minX: x - 0.48, maxX: x + 0.48, minZ: -5.38, maxZ: -4.18 });
      z.interactables.push({
        id: `restroom-toilet-${i}`, type: 'restroomFixture', sound: 'fart', variant: i,
        label: `Test stall ${i + 1}`, title: `STALL ${i + 1}`,
        lines: i === 2
          ? [
            'GUARD: “Sir, the bowl has constitutional limits.” The poop declines to comment.',
            'GUARD: “We have flushed twelve times. You are now infrastructure.”',
            'GUARD: “Please reduce yourself to a standard municipal volume.” The poop remains huge.',
          ]
          : null,
        line: i === 2 ? null : 'The porcelain answers with the only review this room permits.',
        pos: new THREE.Vector3(x, 0.9, -3.75), radius: 2.0,
      });
    }

    // The Toilet Guard has one duty and no useful equipment. He faces the
    // impossible poop, points at it continuously and delivers a rotating silent
    // lecture so the room's piss-and-fart-only audio policy remains unbroken.
    {
      const guard = new THREE.Group();
      guard.position.set(3.0, 0, -0.55);
      guard.rotation.y = -0.27;
      const uniform = new THREE.MeshStandardMaterial({ color: 0x182b3e, roughness: 0.72 });
      const skin = new THREE.MeshStandardMaterial({ color: 0xc18d68, roughness: 0.86 });
      const gold = new THREE.MeshStandardMaterial({ color: 0xe0b948, roughness: 0.3, metalness: 0.58 });
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.34, 0.84, 14), uniform);
      torso.position.y = 1.05;
      const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.345, 0.345, 0.075, 14), blackRubber);
      belt.position.y = 0.72;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.225, 18, 13), skin);
      head.position.y = 1.67;
      const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.25, 0.15, 16), uniform);
      hat.position.y = 1.88;
      const brim = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.035, 0.22), uniform);
      brim.position.set(0, 1.82, 0.1);
      const badge = new THREE.Mesh(new THREE.OctahedronGeometry(0.095, 0), gold);
      badge.position.set(0.17, 1.2, 0.245);
      badge.scale.y = 1.28;
      const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.075, 0.045), gold);
      buckle.position.set(0, 0.72, 0.19);
      const radio = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.08), blackRubber);
      radio.position.set(-0.2, 1.36, 0.2);
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.2, 6), blackRubber);
      antenna.position.set(-0.23, 1.54, 0.2);
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0x171313 });
      for (const ex of [-0.07, 0.07]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), eyeMat);
        eye.position.set(ex, 1.7, 0.208);
        guard.add(eye);
      }
      const moustache = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.028, 0.028), eyeMat);
      moustache.position.set(0, 1.59, 0.224);
      guard.add(torso, belt, head, hat, brim, badge, buckle, radio, antenna, moustache);
      for (const side of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.105, 0.72, 10), uniform);
        leg.position.set(side * 0.15, 0.36, 0);
        const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.31), blackRubber);
        shoe.position.set(side * 0.15, 0.055, 0.07);
        guard.add(leg, shoe);
      }
      const armQuiet = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.64, 10), uniform);
      armQuiet.position.set(0.35, 1.08, 0);
      armQuiet.rotation.z = 0.12;
      const armPoint = new THREE.Group();
      armPoint.position.set(-0.31, 1.36, 0);
      armPoint.rotation.set(-1.18, -0.18, 0.28);
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.078, 0.68, 10), uniform);
      sleeve.position.y = -0.29;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 9), skin);
      hand.position.y = -0.65;
      armPoint.add(sleeve, hand);
      guard.add(armQuiet, armPoint);
      const clipboard = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.035), new THREE.MeshStandardMaterial({ color: 0x6a4628, roughness: 0.82 }));
      clipboard.position.set(0.43, 0.97, 0.23);
      clipboard.rotation.z = -0.18;
      const report = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.34), new THREE.MeshBasicMaterial({ color: 0xf2ead1 }));
      report.position.set(0.43, 0.99, 0.25);
      report.rotation.z = -0.18;
      guard.add(clipboard, report);
      guard.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.userData.noSplat = true;
      });
      z.group.add(guard);

      const guardLines = [
        '“WHO DID THIS? STEP FORWARD.”',
        '“THE POOPER IS UNDER ARREST.”',
        '“I WILL DUST THE FLUSH HANDLE.”',
        '“THIS IS A CUSTODIAL FELONY.”',
        '“CONFESS BEFORE I CHECK THE CCTV.”',
      ];
      const bubbleMaps = guardLines.map((line) => canvasTexture(1200, 190, (ctx, w, h) => {
        const pad = 10; const radius = 38;
        ctx.clearRect(0, 0, w, h);
        ctx.beginPath();
        ctx.moveTo(pad + radius, pad);
        ctx.lineTo(w - pad - radius, pad);
        ctx.quadraticCurveTo(w - pad, pad, w - pad, pad + radius);
        ctx.lineTo(w - pad, h - pad - radius);
        ctx.quadraticCurveTo(w - pad, h - pad, w - pad - radius, h - pad);
        ctx.lineTo(pad + radius, h - pad);
        ctx.quadraticCurveTo(pad, h - pad, pad, h - pad - radius);
        ctx.lineTo(pad, pad + radius);
        ctx.quadraticCurveTo(pad, pad, pad + radius, pad);
        ctx.closePath();
        ctx.fillStyle = '#f5f0d8'; ctx.fill();
        ctx.strokeStyle = '#17221e'; ctx.lineWidth = 8; ctx.stroke();
        ctx.fillStyle = '#17221e';
        ctx.font = '800 31px Georgia, serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(line, w / 2, h / 2 + 2);
      }));
      const bubble = plane(z, {
        w: 3.2, h: 0.56, x: 2.55, y: 2.65, z: -0.43,
        material: new THREE.MeshBasicMaterial({ map: bubbleMaps[0], transparent: true }), noSplat: true,
        name: 'toilet guard speech bubble',
      });
      const tailGeom = new THREE.BufferGeometry();
      tailGeom.setAttribute('position', new THREE.Float32BufferAttribute([
        0, 0, 0, 0.28, 0, 0, 0.2, -0.28, 0,
      ], 3));
      tailGeom.computeVertexNormals();
      const tail = new THREE.Mesh(tailGeom, new THREE.MeshBasicMaterial({ color: 0xf5f0d8, side: THREE.DoubleSide }));
      tail.position.set(2.85, 2.39, -0.425);
      tail.userData.noSplat = true;
      z.group.add(tail);
      plane(z, {
        w: 1.75, h: 0.25, x: 3.0, y: 2.2, z: -0.42,
        material: new THREE.MeshBasicMaterial({
          map: textTexture('TOILET GUARD · POOP CRIMES UNIT', { fg: '#ffd75e', bg: '#182b3e', size: 25, w: 980, h: 130, font: '800' }),
        }), noSplat: true,
      });
      z.animated.toiletGuard = {
        group: guard, head, arm: armPoint, bubble, bubbleMaps,
        lineIndex: 0, bubbleChangedAt: 0, poop: impossiblePoop, flush: doomedFlush,
        beacon: containmentBeacon,
      };
      z.interactables.push({
        id: 'toilet-guard', type: 'restroomFixture', sound: 'fart', variant: 11,
        label: 'Ask who is under arrest', title: 'THE TOILET GUARD',
        lines: [
          '“Whoever produced stall three is under arrest. I am building a stool profile.”',
          '“Nobody leaves until the poop has an alibi and the pooper has a lawyer.”',
          '“I will fingerprint the flush handle. Laugh now. Regret it at processing.”',
          '“One of these patrons knows something. Bodies always talk eventually.”',
        ],
        pos: new THREE.Vector3(3.0, 1.2, -0.55), radius: 2.0,
      });
    }

    // Three wall urinals and privacy dividers make the west aisle an actual
    // public facility rather than a gallery that merely owns some toilets.
    for (let i = 0; i < 3; i++) {
      const zz = -0.55 + i * 2.05;
      const urinal = new THREE.Group();
      urinal.position.set(-7.56, 0, zz);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.86, 0.62), porcelain);
      back.position.set(0.12, 0.78, 0);
      const cup = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 12), porcelain);
      cup.scale.set(0.55, 0.82, 1); cup.position.set(0.31, 0.48, 0);
      const drain = new THREE.Mesh(new THREE.CircleGeometry(0.075, 16), blackRubber);
      drain.rotation.y = Math.PI / 2; drain.position.set(0.505, 0.49, 0);
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.55, 10), steel);
      pipe.position.set(0.29, 1.45, 0);
      urinal.add(back, cup, drain, pipe);
      z.group.add(urinal);
      box(z, {
        w: 0.78, h: 1.32, d: 0.075, x: -7.25, y: 0.48, z: zz + 0.98,
        material: partitionMat, ry: Math.PI / 2, solid: false, noSplat: true,
      });
      z.colliders.push({ minX: -7.78, maxX: -6.96, minZ: zz - 0.42, maxZ: zz + 0.42 });
      z.interactables.push({
        id: `restroom-urinal-${i}`, type: 'restroomFixture', sound: 'piss', variant: i,
        label: `Use urinal ${i + 1}`, title: `URINAL ${i + 1}`,
        line: 'A bright stream joins the rhythm. The tiled room approves without words.',
        pos: new THREE.Vector3(-6.9, 1.0, zz), radius: 1.65,
      });
    }

    // Communal sink, mirror and exposed plumbing on the east wall.
    box(z, { w: 0.78, h: 0.16, d: 5.65, x: 6.85, y: 0.76, z: 1.15, material: porcelain, name: 'communal sink' });
    for (const zz of [-0.65, 1.15, 2.95]) {
      const basin = new THREE.Mesh(new THREE.SphereGeometry(0.35, 18, 10), porcelain);
      basin.scale.set(0.58, 0.25, 1.0); basin.position.set(6.53, 0.88, zz);
      z.group.add(basin);
      const tap = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.025, 7, 14, Math.PI), steel);
      tap.rotation.z = Math.PI / 2; tap.position.set(6.45, 1.14, zz);
      z.group.add(tap);
    }
    z.colliders.push({ minX: 6.22, maxX: 7.78, minZ: -1.95, maxZ: 4.25 });
    const mirrorMat = new THREE.MeshPhysicalMaterial({
      color: 0x9fb7b4, roughness: 0.08, metalness: 0.92, clearcoat: 1, clearcoatRoughness: 0.03,
    });
    plane(z, { w: 5.75, h: 1.45, x: 7.765, y: 2.16, z: 1.15, ry: -Math.PI / 2, material: mirrorMat, noSplat: true, name: 'fogged mirror' });
    plane(z, {
      w: 5.2, h: 0.32, x: 7.755, y: 3.12, z: 1.15, ry: -Math.PI / 2,
      material: new THREE.MeshBasicMaterial({ map: textTexture('YOU LOOK EXPENSIVE WHEN DAMP', { fg: '#ccffe9', bg: '#1a322b', size: 31, w: 1100, h: 130, font: '800' }) }),
      noSplat: true,
    });

    // The restroom is occupied: two patrons use the urinals, one scrubs at the
    // sink, and one waits outside the stalls while pretending not to hear the
    // Poop Crimes Unit. Bodies are simple procedural geometry so they remain
    // readable under the hard green/magenta club light.
    const buildPatron = ({ x, z: zz, ry, shirt, trousers, skinColor, hairColor }) => {
      const group = new THREE.Group();
      group.position.set(x, 0, zz);
      group.rotation.y = ry;
      const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.78 });
      const trouserMat = new THREE.MeshStandardMaterial({ color: trousers, roughness: 0.82 });
      const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.88 });
      const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.96 });
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.45, 4, 10), shirtMat);
      torso.position.y = 1.16;
      const shoulders = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.18, 0.3), shirtMat);
      shoulders.position.y = 1.38;
      const hips = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.3), trouserMat);
      hips.position.y = 0.73;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), skinMat);
      head.position.y = 1.77;
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.225, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.52), hairMat);
      hair.position.y = 1.84;
      group.add(torso, shoulders, hips, head, hair);
      const legs = [];
      for (const side of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.105, 0.72, 9), trouserMat);
        leg.position.set(side * 0.145, 0.35, 0);
        const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.095, 0.3), trouserMat);
        shoe.position.set(side * 0.145, 0.05, 0.07);
        group.add(leg, shoe);
        legs.push(leg);
      }
      const arms = [];
      for (const side of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.073, 0.58, 9), shirtMat);
        arm.position.set(side * 0.31, 1.12, 0.06);
        arm.rotation.z = side * 0.38;
        group.add(arm);
        arms.push(arm);
      }
      group.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.userData.noSplat = true;
      });
      z.group.add(group);
      return { group, torso, head, arms, legs };
    };

    const peeMat = new THREE.MeshPhysicalMaterial({
      color: 0xffe35d, emissive: 0xa86b08, emissiveIntensity: 0.8,
      transparent: true, opacity: 0.72, roughness: 0.12, depthWrite: false,
    });
    const peeing = [];
    const peeDefs = [
      { zz: -0.55, shirt: 0xa73e72, trousers: 0x222631, skinColor: 0xb97c58, hairColor: 0x2c1710 },
      { zz: 1.5, shirt: 0x396f8f, trousers: 0x28231f, skinColor: 0xd0a078, hairColor: 0xd4b55e },
    ];
    for (let i = 0; i < peeDefs.length; i++) {
      const def = peeDefs[i];
      const patron = buildPatron({ x: -6.42, z: def.zz, ry: -Math.PI / 2, ...def });
      // Hands hover awkwardly at the waist; nobody makes eye contact.
      patron.arms[0].rotation.z = -0.76;
      patron.arms[1].rotation.z = 0.76;
      patron.arms[0].position.y = patron.arms[1].position.y = 1.0;
      const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.68, 8), peeMat.clone());
      stream.rotation.z = Math.PI / 2;
      stream.position.set(-7.01, 0.69, def.zz);
      stream.userData.noSplat = true;
      z.group.add(stream);
      const drops = [];
      for (let d = 0; d < 4; d++) {
        const drop = new THREE.Mesh(new THREE.SphereGeometry(0.024, 7, 5), peeMat.clone());
        drop.position.set(-6.78 - d * 0.11, 0.69 - d * 0.018, def.zz + (d % 2 ? 0.012 : -0.01));
        drop.userData.noSplat = true;
        z.group.add(drop);
        drops.push(drop);
      }
      peeing.push({ ...patron, stream, drops, phase: i * 1.7, z: def.zz });
    }

    const washing = buildPatron({
      x: 6.0, z: 1.15, ry: Math.PI / 2,
      shirt: 0x7b5aaa, trousers: 0x242832, skinColor: 0x8f604d, hairColor: 0x151318,
    });
    washing.arms[0].rotation.x = -0.92;
    washing.arms[1].rotation.x = -0.92;
    washing.arms[0].position.y = washing.arms[1].position.y = 1.06;
    const waiting = buildPatron({
      x: -2.15, z: 1.05, ry: -0.18,
      shirt: 0xc28735, trousers: 0x31343b, skinColor: 0xe0b18d, hairColor: 0x5b271c,
    });
    waiting.arms[0].rotation.z = -0.92;
    waiting.arms[1].rotation.z = 0.92;
    z.animated.restroomPatrons = { peeing, washing, waiting };
    z.interactables.push(
      {
        id: 'restroom-patron-waiting', type: 'restroomFixture', sound: 'fart', variant: 14,
        label: 'Ask the nervous patron', title: 'NERVOUS PATRON',
        lines: [
          'They stare at stall three and silently shake their head much too quickly.',
          '“I came in after it happened.” The guard writes that down without blinking.',
        ],
        pos: new THREE.Vector3(-2.15, 1.1, 1.05), radius: 1.75,
      },
      {
        id: 'restroom-patron-sink', type: 'restroomFixture', sound: 'piss', variant: 15,
        label: 'Observe the hand washing', title: 'THE SINK WITNESS',
        lines: ['They have been washing the same hands since the guard said “fingerprints.”'],
        pos: new THREE.Vector3(6.0, 1.1, 1.15), radius: 1.75,
      },
    );

    // Puddles, drains and exposed pipes sell the dampness from eye level.
    const puddleMat = new THREE.MeshPhysicalMaterial({
      color: 0x8cb49c, transparent: true, opacity: 0.38, roughness: 0.08,
      metalness: 0.05, clearcoat: 1, depthWrite: false,
    });
    for (const [x, zz, sx, sz] of [[-5.6, 0.2, 1.3, 0.5], [1.3, 2.6, 0.8, 1.4], [5.4, -0.3, 1.1, 0.55]]) {
      const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.72, 26), puddleMat);
      puddle.rotation.x = -Math.PI / 2; puddle.position.set(x, 0.026, zz); puddle.scale.set(sx, sz, 1);
      puddle.userData.noSplat = true; z.group.add(puddle);
    }
    for (const [x, zz] of [[-2.1, 0.5], [3.5, 3.5]]) {
      const drain = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.018, 20), steel);
      drain.position.set(x, 0.025, zz); drain.userData.noSplat = true; z.group.add(drain);
    }
    for (const x of [-6.75, 6.05]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 3.7, 10), steel);
      pipe.position.set(x, 1.85, -5.56); pipe.userData.noSplat = true; z.group.add(pipe);
    }

    // Fluorescent slabs stay sickly white; hidden colored bulbs punch the fart
    // downbeats into the wet floor without turning the room into a clean club.
    z.animated.strobes = [];
    for (let i = 0; i < 4; i++) {
      const x = -5.4 + i * 3.6;
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(2.25, 0.06, 0.28),
        new THREE.MeshStandardMaterial({ color: 0xe7fff3, emissive: 0xb8ffe0, emissiveIntensity: 1.8, roughness: 0.24 })
      );
      slab.position.set(x, roomH - 0.19, 0.65); slab.userData.noSplat = true; z.group.add(slab);
      const pulse = new THREE.PointLight(i % 2 ? 0x50ffb0 : 0xff5dbb, 0.8, 7.5, 1.8);
      pulse.position.set(x, roomH - 0.36, 0.65); pulse.userData.base = 0.62; z.group.add(pulse);
      z.animated.strobes.push(pulse);
    }
    z.group.add(new THREE.HemisphereLight(0xcfffe6, 0x10221c, 1.15));

    plane(z, {
      w: 7.8, h: 0.78, x: 0, y: 3.48, z: -5.77,
      material: new THREE.MeshBasicMaterial({
        map: textTexture('T E C H N O   Z A M B A', { fg: '#ff83d3', bg: '#162b26', size: 64, w: 1500, h: 190, font: '800' }),
      }), noSplat: true,
    });
    plane(z, {
      w: 6.7, h: 0.45, x: 0, y: 2.91, z: -5.765,
      material: new THREE.MeshBasicMaterial({
        map: textTexture('ACOUSTIC POLICY: PISS + FART ONLY', { fg: '#bfffe5', bg: '#162b26', size: 34, w: 1300, h: 150, font: '800' }),
      }), noSplat: true,
    });
    plane(z, {
      w: 5.4, h: 0.38, x: 0, y: 3.25, z: 5.77, ry: Math.PI,
      material: new THREE.MeshBasicMaterial({
        map: textTexture('PUBLIC RESTROOM · EVERY BODY IS ON THE LIST', { fg: '#d8f5e8', bg: '#223c34', size: 29, w: 1300, h: 140, font: '800' }),
      }), noSplat: true,
    });
    z.interactables.push({
      id: 'restroom-policy', type: 'restroomFixture', sound: 'fart', variant: 7,
      label: 'Read the acoustic policy', title: 'ACOUSTIC POLICY',
      line: 'No speech, no melody, no applause. The room recognizes only pressure and plumbing.',
      pos: new THREE.Vector3(0, 2.9, -5.3), radius: 2.35,
    });

    // Doctor Drug keeps to the sink-side corner where the magenta fixture
    // light can catch the visor of his strange black helmet.
    z.anchors.doctorDrug = new THREE.Vector3(4.55, 0, 3.45);
    z.anchorYaws = { doctorDrug: -2.26 };
    const drugLight = new THREE.PointLight(0xa24cff, 5.8, 4.6, 1.8);
    drugLight.position.set(4.5, 2.35, 3.35);
    z.group.add(drugLight);
    // Doctor Drug's counter is a tiny point-of-view mission station: buy the
    // sealed supplies from him, then assemble the Muscle Mania delivery here.
    const drugCounter = mat(0x191321, { roughness: 0.5, metalness: 0.24 });
    box(z, { w: 1.65, h: 0.88, d: 0.58, x: 6.0, y: 0, z: 3.85, material: drugCounter, solid: false, noSplat: true, name: 'doctor drug counter' });
    const drugPackColors = [0xa24cff, 0xff5da9, 0xc9d7e6];
    for (let i = 0; i < 3; i++) {
      const packet = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.08), new THREE.MeshStandardMaterial({ color: drugPackColors[i], emissive: drugPackColors[i], emissiveIntensity: 0.32, roughness: 0.35 }));
      packet.position.set(5.52 + i * 0.47, 0.99, 3.66); packet.rotation.y = 0.12 - i * 0.1; packet.userData.noSplat = true; z.group.add(packet);
    }
    plane(z, { w: 1.9, h: 0.26, x: 6.0, y: 1.47, z: 3.54, material: new THREE.MeshBasicMaterial({ map: textTexture('DOCTOR DRUG · SEALED SUPPLIES', { fg: '#e6d5ff', bg: '#2a1640', size: 21, w: 900, h: 130, font: '800' }) }), noSplat: true });
    z.interactables.push({
      id: 'doctor-drug-packing', type: 'drugPacking', label: 'Pack the Muscle Mania delivery',
      pos: new THREE.Vector3(6.0, 1.0, 3.72), radius: 2.0,
    });

    z.waypoints = [
      new THREE.Vector3(-4.6, 0, 3.3), new THREE.Vector3(-2.1, 0, 1.0),
      new THREE.Vector3(1.2, 0, 3.4), new THREE.Vector3(4.4, 0, 0.4),
    ];
    door(z, { x: 0, z: 5.82, ry: Math.PI, label: '← GALLERIA BIANCA', to: 'galleria' });
  }

  /* ---------------------------------------------------------- */
  /*  THE BLACK FOREST                                          */
  /* ---------------------------------------------------------- */
  #buildBlackForest() {
    const z = this.#newZone('blackForest');
    z.spawn.set(0, 0, 20.2);
    z.spawnYaw = 0;
    z.fog = { color: 0x101817, density: 0.085 };

    const groundMat = new THREE.MeshStandardMaterial({ color: 0x273329, roughness: 1 });
    const ground = new THREE.Mesh(new THREE.CircleGeometry(25, 64), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.015;
    ground.name = 'black forest floor';
    z.group.add(ground);
    new THREE.TextureLoader().load(encodeURI('puplic/polyhaven/daylight-garden/forest_ground_04/forest_ground_04_diff_1k.jpg'), (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(9, 9);
      groundMat.map = tex;
      groundMat.color.set(0x586258);
      groundMat.needsUpdate = true;
    });

    // Invisible thicket at the perimeter keeps the player inside the clearing.
    z.colliders.push(
      { minX: -26, maxX: 26, minZ: -26, maxZ: -24 },
      { minX: -26, maxX: 26, minZ: 24, maxZ: 26 },
      { minX: -26, maxX: -24, minZ: -26, maxZ: 26 },
      { minX: 24, maxX: 26, minZ: -26, maxZ: 26 },
    );

    const rng = mulberry32(0xB04A5);
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 5.2, 7);
    const crownGeo = new THREE.ConeGeometry(1.25, 4.8, 8);
    const trunks = new THREE.InstancedMesh(trunkGeo, mat(0x201b17, { roughness: 1 }), 132);
    const crowns = new THREE.InstancedMesh(crownGeo, mat(0x13241d, { roughness: 1 }), 132);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 132; i++) {
      const a = rng() * Math.PI * 2;
      const radius = i < 84 ? 17.5 + rng() * 6.2 : 8 + rng() * 15.5;
      let x = Math.cos(a) * radius;
      let zz = Math.sin(a) * radius;
      // Keep the arrival path and the central conversation readable.
      if (Math.abs(x) < 2.6 && zz > 10) x += x < 0 ? -3.2 : 3.2;
      const scale = 0.72 + rng() * 0.76;
      dummy.position.set(x, 2.6 * scale, zz);
      dummy.rotation.set(0, rng() * Math.PI * 2, (rng() - 0.5) * 0.06);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      dummy.position.y = (5.2 + 2.0) * scale;
      dummy.rotation.y += rng();
      dummy.updateMatrix();
      crowns.setMatrixAt(i, dummy.matrix);
    }
    trunks.castShadow = crowns.castShadow = true;
    trunks.receiveShadow = true;
    z.group.add(trunks, crowns);

    const churchWood = mat(0x211914, { roughness: 0.94 });
    const roofWood = mat(0x0e1110, { roughness: 0.86 });
    const churchPositions = [];
    const churchStates = [];
    const makeChurch = (index, x, zz, yaw) => {
      const church = new THREE.Group();
      church.position.set(x, 0, zz);
      church.rotation.y = yaw;
      const nave = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.05, 3.2), churchWood);
      nave.position.y = 1.025;
      const naveRoof = new THREE.Mesh(new THREE.ConeGeometry(2.1, 1.7, 4), roofWood);
      naveRoof.position.y = 2.85;
      naveRoof.rotation.y = Math.PI / 4;
      naveRoof.scale.z = 1.32;
      const tower = new THREE.Mesh(new THREE.BoxGeometry(1.18, 3.7, 1.2), churchWood);
      tower.position.set(0, 2.45, -0.82);
      const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(1.15, 2.35, 4), roofWood);
      towerRoof.position.set(0, 5.45, -0.82);
      towerRoof.rotation.y = Math.PI / 4;
      const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.66, 0.38), churchWood);
      lantern.position.set(0, 6.82, -0.82);
      const spire = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.7, 4), roofWood);
      spire.position.set(0, 7.95, -0.82);
      spire.rotation.y = Math.PI / 4;
      const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.62, 0.07), roofWood);
      crossV.position.set(0, 9.05, -0.82);
      const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.07), roofWood);
      crossH.position.set(0, 9.1, -0.82);
      church.add(nave, naveRoof, tower, towerRoof, lantern, spire, crossV, crossH);
      church.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      z.group.add(church);
      churchPositions.push(new THREE.Vector3(x, 0, zz));
      z.colliders.push({ minX: x - 1.65, maxX: x + 1.65, minZ: zz - 1.9, maxZ: zz + 1.9 });
      const item = {
        id: `forest-church-${index + 1}`, type: 'church', label: `Douse stave church ${index + 1} of 10 with gasoline`,
        title: `STAVE CHURCH ${index + 1} / 10`, pos: new THREE.Vector3(x, 1.2, zz), radius: 2.35,
        lines: [
          'Black timber, stacked roofs, dragon-dark silhouette. The fog has filled every seat.',
          'It is unmistakably a traditional Norwegian stave church, built here at the scale of a memory.',
          'No flame touches it. The lighter throws one small gold reflection across the old wood.',
        ],
        churchIndex: index,
      };
      z.interactables.push(item);
      churchStates.push({
        index, group: church, pos: new THREE.Vector3(x, 0, zz), item,
        primed: false, burning: false, fireT: 0, fx: null, burnMeshes: [],
      });
    };

    // Exactly ten stave churches, arranged like a broken clock around the clearing.
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.18;
      const radius = 13.1 + (i % 2) * 2.3;
      makeChurch(i, Math.cos(a) * radius, Math.sin(a) * radius - 1.2, -a + Math.PI / 2);
    }
    z.anchors.churches = churchPositions;
    z.animated.forestChurches = churchStates;
    z.animated.churchCrackleT = 0.4;

    // The apparition waits in the one place the ring of buildings cannot hide.
    z.anchors.varg = new THREE.Vector3(0, 0, -2.3);
    z.anchorYaws = { varg: 0 };
    z.waypoints = [
      new THREE.Vector3(-5, 0, 4), new THREE.Vector3(5, 0, 5),
      new THREE.Vector3(-6, 0, -5), new THREE.Vector3(6, 0, -6),
      new THREE.Vector3(0, 0, 8), new THREE.Vector3(0, 0, -10),
    ];

    // A lot of boars. They roam in overlapping crooked ellipses and never
    // collide with the player; the forest is already crowded enough.
    const boars = [];
    const boarBodyMat = mat(0x302820, { roughness: 1 });
    const boarDarkMat = mat(0x171514, { roughness: 1 });
    for (let i = 0; i < 34; i++) {
      const boar = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.48, 4, 8), boarBodyMat);
      body.rotation.z = Math.PI / 2;
      body.position.y = 0.42;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), boarBodyMat);
      head.position.set(0, 0.43, 0.43);
      const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.17, 0.28, 9), boarDarkMat);
      snout.rotation.x = Math.PI / 2;
      snout.position.set(0, 0.39, 0.69);
      const tuskMat = mat(0xc9b98f, { roughness: 0.8 });
      for (const side of [-1, 1]) {
        const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.15, 7), tuskMat);
        tusk.rotation.x = Math.PI / 2;
        tusk.position.set(side * 0.12, 0.35, 0.82);
        boar.add(tusk);
      }
      for (const [lx, lz] of [[-0.18, -0.23], [0.18, -0.23], [-0.18, 0.2], [0.18, 0.2]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.3, 0.075), boarDarkMat);
        leg.position.set(lx, 0.16, lz);
        boar.add(leg);
      }
      boar.add(body, head, snout);
      const a = rng() * Math.PI * 2;
      const r = 4 + rng() * 16;
      const centerX = Math.cos(a) * r;
      const centerZ = Math.sin(a) * r;
      boar.position.set(centerX, 0, centerZ);
      const scale = 0.7 + rng() * 0.58;
      boar.scale.setScalar(scale);
      z.group.add(boar);
      boars.push({
        group: boar, centerX, centerZ, phase: rng() * Math.PI * 2,
        speed: 0.12 + rng() * 0.22, radiusX: 0.9 + rng() * 3.1,
        radiusZ: 0.8 + rng() * 2.7, bob: rng() * Math.PI * 2,
      });
    }
    z.animated.forestBoars = boars;
    z.animated.boarSqueakT = 0.9;

    // Low fog banks supplement the scene fog so nearby fog has readable motion.
    const fogTex = canvasTexture(192, 96, (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
      grad.addColorStop(0, 'rgba(190,205,197,0.34)');
      grad.addColorStop(0.55, 'rgba(145,165,157,0.16)');
      grad.addColorStop(1, 'rgba(100,120,114,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    });
    z.animated.forestFog = [];
    for (let i = 0; i < 28; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: fogTex, transparent: true, opacity: 0.34, depthWrite: false }));
      sprite.position.set(-21 + rng() * 42, 0.65 + rng() * 1.25, -21 + rng() * 42);
      sprite.scale.set(6 + rng() * 8, 2.2 + rng() * 2.5, 1);
      z.group.add(sprite);
      z.animated.forestFog.push({ sprite, speed: 0.08 + rng() * 0.16, phase: rng() * Math.PI * 2 });
    }

    z.group.add(new THREE.HemisphereLight(0x506965, 0x080b09, 0.72));
    const moon = new THREE.DirectionalLight(0x9bb9b4, 1.3);
    moon.position.set(-9, 14, 7);
    moon.castShadow = true;
    z.group.add(moon);

    door(z, { x: 0, z: 23.2, ry: Math.PI, label: '← GALLERIA BIANCA', to: 'galleria' });
    z.interactables.push({
      id: 'forest-count', type: 'flavor', label: 'Read the moss-covered marker',
      title: 'CHURCH BURNING FIRE SENSATION COCKBURN', pos: new THREE.Vector3(2.1, 0.7, 20.3), radius: 2.0,
      lines: ['TEN CHURCHES. THIRTY-FOUR BOARS. ONE CONVERSATION THE FOG CANNOT FINISH.'],
    });
  }

  /* ---------------------------------------------------------- */
  /*  THE LISTENING ROOM — live band, two speakers, twelve witnesses */
  /* ---------------------------------------------------------- */
  #buildListeningRoom() {
    const z = this.#newZone('listeningRoom');
    const roomH = 5.4;
    shell(z, { w: 18, d: 15, h: roomH, floorColor: 0x4a3023, wallColor: 0x191d22, ceilColor: 0x0c0e12 });
    z.spawn.set(0, 0, 6.05);
    z.spawnYaw = Math.PI;
    z.fog = { color: 0x11161b, density: 0.018 };

    // Oiled walnut underfoot and vertical felt/slat absorption make the room
    // read as serious hi-fi architecture without adding furniture clutter.
    const walnut = mat(0x6f472d, { roughness: 0.58, metalness: 0.02 });
    plane(z, { w: 17.7, h: 14.7, y: 0.012, rx: -Math.PI / 2, material: walnut, noSplat: true, name: 'listening walnut floor' });
    const felt = mat(0x20272e, { roughness: 0.98 });
    const slat = mat(0x8a5d3d, { roughness: 0.62 });
    for (let i = 0; i < 31; i++) {
      const x = -8.45 + i * 0.56;
      box(z, { w: 0.075, h: 4.75, d: 0.11, x, y: 0.18, z: -7.42, material: slat, solid: false, noSplat: true });
    }
    plane(z, { w: 17.4, h: 4.8, x: 0, y: 2.65, z: -7.45, material: felt, noSplat: true });

    // Exactly two full-range speakers frame the live stage. The communal
    // turntable stays forward in the room where it remains easy to reach.
    const speakerCabinet = new THREE.MeshPhysicalMaterial({ color: 0x161719, roughness: 0.24, metalness: 0.2, clearcoat: 0.72, clearcoatRoughness: 0.12 });
    const driverMat = mat(0xb89552, { roughness: 0.32, metalness: 0.72 });
    const coneMat = mat(0x0a0b0c, { roughness: 0.48, metalness: 0.18 });
    z.animated.listeningDrivers = [];
    for (const sx of [-6.15, 6.15]) {
      const cabinet = box(z, { w: 1.55, h: 3.35, d: 1.05, x: sx, y: 0.12, z: -5.75, material: speakerCabinet, name: 'reference speaker' });
      cabinet.castShadow = true;
      for (const [y, r] of [[0.86, 0.42], [1.82, 0.36], [2.78, 0.19]]) {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.055, 12, 36), driverMat);
        rim.position.set(sx, y, -5.205); rim.rotation.x = Math.PI / 2; rim.userData.noSplat = true; z.group.add(rim);
        const cone = new THREE.Mesh(new THREE.CircleGeometry(r * 0.82, 36), coneMat);
        cone.position.set(sx, y, -5.15); cone.rotation.y = Math.PI; cone.userData.noSplat = true; z.group.add(cone);
        z.animated.listeningDrivers.push({ mesh: cone, base: cone.scale.clone(), phase: y + sx });
      }
      const plinth = box(z, { w: 1.82, h: 0.09, d: 1.32, x: sx, y: 0.02, z: -5.75, material: mat(0xa78951, { metalness: 0.75, roughness: 0.23 }), solid: false, noSplat: true });
      plinth.castShadow = true;
    }

    // The record is embodied by a four-piece band. Small joints, instrument
    // hardware, cables and a proper backline keep the figures readable as a
    // performance rather than four decorative mannequins.
    const stageBlack = mat(0x101216, { roughness: 0.46, metalness: 0.16 });
    const stageGold = mat(0xc7a35b, { roughness: 0.24, metalness: 0.84 });
    const chrome = mat(0xcbd2d7, { roughness: 0.17, metalness: 0.92 });
    const instrumentBlack = mat(0x111319, { roughness: 0.23, metalness: 0.42 });
    box(z, { w: 10.65, h: 0.3, d: 3.15, x: 0, y: 0, z: -5.35, material: stageBlack, solid: false, noSplat: true, name: 'listening live stage' });
    box(z, { w: 10.65, h: 0.055, d: 0.09, x: 0, y: 0.3, z: -3.79, material: stageGold, solid: false, noSplat: true });
    for (const x of [-4.8, -1.6, 1.6, 4.8]) {
      const foot = new THREE.PointLight(0xffc76e, 1.2, 3.8, 1.9); foot.position.set(x, 0.42, -3.72); foot.userData.base = 1.2; z.group.add(foot);
    }

    const makePerformer = ({ x, zz, shirt, skin, hair, role, seated = false }) => {
      const group = new THREE.Group(); group.position.set(x, 0.3, zz);
      const shirtMat = mat(shirt, { roughness: 0.75 });
      const skinMat = mat(skin, { roughness: 0.82 });
      const hairMat = mat(hair, { roughness: 0.92 });
      const trousers = mat(0x171a20, { roughness: 0.76 });
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.52, 6, 12), shirtMat); torso.position.y = seated ? 0.96 : 1.05;
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 7, 18, Math.PI), stageBlack); collar.position.set(0, torso.position.y + 0.35, 0.19); collar.rotation.z = Math.PI;
      const headPivot = new THREE.Group(); headPivot.position.y = seated ? 1.48 : 1.62;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.205, 18, 14), skinMat); head.scale.set(0.9, 1.12, 0.92);
      const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.63), hairMat); hairCap.position.set(0, 0.055, -0.018);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.09, 8), skinMat); nose.position.set(0, -0.005, 0.202); nose.rotation.x = Math.PI / 2;
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0x171515 });
      const eyes = [-0.066, 0.066].map((ex) => {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), eyeMat); eye.position.set(ex, 0.04, 0.185); headPivot.add(eye); return eye;
      });
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.092, 0.018, 0.015), new THREE.MeshBasicMaterial({ color: role === 'singer' ? 0x8d2942 : 0x48231f })); mouth.position.set(0, -0.09, 0.206);
      headPivot.add(head, hairCap, nose, mouth);
      const arms = [];
      for (const side of [-1, 1]) {
        const pivot = new THREE.Group(); pivot.position.set(side * 0.32, torso.position.y + 0.25, 0.01);
        const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.38, 5, 8), shirtMat); upper.position.y = -0.23;
        const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), skinMat); hand.position.set(0, -0.49, 0.02);
        pivot.add(upper, hand); group.add(pivot); arms.push(pivot);
      }
      const legs = [];
      for (const side of [-1, 1]) {
        const pivot = new THREE.Group(); pivot.position.set(side * 0.13, seated ? 0.72 : 0.55, 0);
        const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, seated ? 0.3 : 0.48, 5, 8), trousers); leg.position.y = seated ? -0.12 : -0.27; if (seated) leg.rotation.x = -0.72;
        const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.29), stageBlack); shoe.position.set(0, seated ? -0.34 : -0.58, seated ? 0.18 : 0.07);
        pivot.add(leg, shoe); group.add(pivot); legs.push(pivot);
      }
      group.add(torso, collar, headPivot);
      group.traverse((o) => { o.userData.noSplat = true; if (o.isMesh) o.castShadow = true; });
      z.group.add(group);
      return { group, torso, headPivot, head, mouth, arms, legs, eyes, role, instrument: null, phase: x * 0.73 + zz * 0.17 };
    };

    const addGuitar = (performer, color, bass = false) => {
      const guitar = new THREE.Group(); guitar.position.set(0, 0.91, 0.31); guitar.rotation.z = bass ? -0.18 : 0.17;
      const lacquer = new THREE.MeshPhysicalMaterial({ color, roughness: 0.2, metalness: 0.22, clearcoat: 0.9, clearcoatRoughness: 0.1 });
      const lower = new THREE.Mesh(new THREE.SphereGeometry(bass ? 0.23 : 0.26, 18, 12), lacquer); lower.scale.set(1.0, 0.82, 0.26); lower.position.y = -0.08;
      const upper = new THREE.Mesh(new THREE.SphereGeometry(bass ? 0.17 : 0.19, 18, 12), lacquer); upper.scale.set(1.0, 0.78, 0.25); upper.position.set(bass ? -0.06 : 0.07, 0.16, 0);
      const neck = new THREE.Mesh(new THREE.BoxGeometry(0.085, bass ? 0.88 : 0.72, 0.055), mat(0x6b462e, { roughness: 0.55 })); neck.position.y = bass ? 0.63 : 0.54;
      const headstock = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.19, 0.07), stageGold); headstock.position.y = bass ? 1.11 : 0.94;
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.045, 0.045), chrome); bridge.position.set(0, -0.08, 0.145);
      const pickups = [-0.01, 0.16].map((yy) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.035), instrumentBlack); p.position.set(0, yy, 0.15); return p; });
      guitar.add(lower, upper, neck, headstock, bridge, ...pickups);
      for (let i = 0; i < (bass ? 4 : 6); i++) {
        const string = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, bass ? 1.17 : 1.02, 4), chrome); string.position.set((i - (bass ? 1.5 : 2.5)) * 0.009, 0.48, 0.165); guitar.add(string);
      }
      const strap = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.018, 6, 28, Math.PI * 1.25), stageBlack); strap.position.set(0, 0.2, -0.06); strap.rotation.z = 0.95; guitar.add(strap);
      guitar.traverse((o) => { o.userData.noSplat = true; if (o.isMesh) o.castShadow = true; }); performer.group.add(guitar); performer.instrument = guitar;
      performer.arms[0].rotation.set(-0.62, 0, bass ? -0.54 : -0.36);
      performer.arms[1].rotation.set(-0.84, 0, bass ? 0.28 : 0.48);
    };

    const guitarist = makePerformer({ x: -2.85, zz: -4.95, shirt: 0x804d35, skin: 0xb97858, hair: 0x241812, role: 'guitar' });
    const bassist = makePerformer({ x: 2.85, zz: -4.98, shirt: 0x284f5c, skin: 0x7e4d39, hair: 0x17151a, role: 'bass' });
    const singer = makePerformer({ x: 0, zz: -4.18, shirt: 0x9d354b, skin: 0xd09a78, hair: 0x1d1717, role: 'singer' });
    const drummer = makePerformer({ x: 0, zz: -6.2, shirt: 0x3d4056, skin: 0xc58c6e, hair: 0x39231b, role: 'drums', seated: true });
    addGuitar(guitarist, 0xc76d38, false); addGuitar(bassist, 0x315f72, true);

    // Vocal mic, coiled cable and floor monitor.
    const micStand = new THREE.Group(); micStand.position.set(0, 0.31, -3.94);
    const standPole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 1.5, 8), chrome); standPole.position.y = 0.75;
    const standBase = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.035, 20), stageBlack); standBase.position.y = 0.02;
    const microphone = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.14, 5, 8), instrumentBlack); microphone.position.set(0, 1.52, 0.02); microphone.rotation.x = Math.PI / 2;
    micStand.add(standPole, standBase, microphone); micStand.traverse((o) => { o.userData.noSplat = true; }); z.group.add(micStand);
    const cablePoints = [new THREE.Vector3(0, 0.34, -3.94), new THREE.Vector3(0.55, 0.34, -3.7), new THREE.Vector3(0.28, 0.34, -3.46), new THREE.Vector3(0.9, 0.34, -3.35)];
    const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cablePoints), 32, 0.012, 6, false), instrumentBlack); cable.userData.noSplat = true; z.group.add(cable);
    box(z, { w: 0.86, h: 0.34, d: 0.6, x: 0, y: 0.3, z: -3.45, material: instrumentBlack, solid: false, noSplat: true });

    // Complete drum kit: kick, snare, rack toms, floor tom, hi-hat and crash.
    const drumShell = new THREE.MeshPhysicalMaterial({ color: 0x764833, roughness: 0.24, metalness: 0.16, clearcoat: 0.82 });
    const drumHead = mat(0xe7e0d5, { roughness: 0.62 });
    const kit = new THREE.Group(); kit.position.set(0, 0.31, -5.62);
    const kickDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.48, 24), drumShell); kickDrum.rotation.x = Math.PI / 2; kickDrum.position.set(0, 0.49, 0);
    const kickHead = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), drumHead); kickHead.position.set(0, 0.49, 0.245);
    const snare = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.16, 20), chrome); snare.position.set(-0.55, 0.79, 0.05);
    const toms = [-0.26, 0.26].map((x) => { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.27, 20), drumShell); d.position.set(x, 0.96, -0.08); d.rotation.x = 0.16; return d; });
    const floorTom = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.48, 20), drumShell); floorTom.position.set(0.7, 0.57, -0.05);
    const cymbals = [];
    for (const [x, y, r] of [[-0.83, 1.22, 0.3], [0.84, 1.46, 0.4], [0.64, 1.1, 0.27]]) {
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, y, 7), chrome); stand.position.set(x, y / 2, -0.08);
      const cymbal = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.91, 0.024, 28), stageGold); cymbal.position.set(x, y, -0.08); cymbal.rotation.z = x * 0.035; kit.add(stand, cymbal); cymbals.push(cymbal);
    }
    kit.add(kickDrum, kickHead, snare, ...toms, floorTom); kit.traverse((o) => { o.userData.noSplat = true; if (o.isMesh) o.castShadow = true; }); z.group.add(kit);
    const sticks = drummer.arms.map((arm, i) => {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.62, 7), mat(0xd2a768, { roughness: 0.62 })); stick.position.set(0, -0.63, 0.12); stick.rotation.x = 0.32; arm.add(stick); arm.rotation.z = i ? 0.58 : -0.58; arm.rotation.x = -0.62; return stick;
    });

    // Restrained gallery lighting at low BPM; increasingly theatrical as the
    // selected track gets faster.
    const bandLights = [];
    for (const [x, color] of [[-4.2, 0xffb85c], [-1.4, 0xe76f51], [1.4, 0x66b7d3], [4.2, 0xffd994]]) {
      const spot = new THREE.SpotLight(color, 4.5, 10, 0.34, 0.72, 1.7); spot.position.set(x, 4.75, -4.0); spot.target.position.set(x * 0.55, 1.0, -5.1); spot.userData.base = 3.8; z.group.add(spot, spot.target); bandLights.push(spot);
    }
    z.animated.listeningBand = { performers: [guitarist, bassist, singer, drummer], guitarist, bassist, singer, drummer, kit, kickDrum, cymbals, sticks, bandLights, nextVocal: 0 };
    z.colliders.push({ minX: -5.35, maxX: 5.35, minZ: -6.95, maxZ: -3.72 });
    z.interactables.push({
      id: 'listening-live-band', type: 'flavor', label: 'Watch the live take', title: 'THE HOUSE BAND',
      pos: new THREE.Vector3(0, 1.1, -3.55), radius: 2.2,
      lines: [
        'They do not know which record comes next. The player changes; their hands find it anyway.',
        'At slow tempos they breathe with the room. At fast tempos the drummer begins negotiating directly with gravity.',
        'The portraits watch the band. The band refuses to look back.',
      ],
    });

    plane(z, {
      w: 7.6, h: 0.58, x: 0, y: 4.72, z: -7.38,
      material: new THREE.MeshBasicMaterial({ map: textTexture('THE LISTENING ROOM  ·  TWO SPEAKERS / NO SMALL TALK', { fg: '#f0d79e', bg: '#161b20', size: 36, w: 1500, h: 170, font: '900' }) }), noSplat: true,
    });
    z.interactables.push({
      id: 'listening-speakers', type: 'flavor', label: 'Stand in the sweet spot', title: 'THE SWEET SPOT',
      pos: new THREE.Vector3(0, 1.2, -0.7), radius: 2.25,
      lines: [
        'Two speakers. One chair-shaped absence. The room has removed everything that could pretend to be the point.',
        'The left speaker knows what the right speaker means. You stand between them and briefly do too.',
        'Press E at the player to switch songs. The walls have agreed not to review your choice.',
      ],
    });

    // Six women and six men, each rendered as a coded portrait rather than
    // archival photography. The centre gap keeps the MTV doorway unobstructed.
    const wallZ = [-6.15, -4, -1.85, 1.85, 4, 6.15];
    const positions = [
      ...wallZ.map((wallPos) => ({ x: -8.78, z: wallPos, ry: Math.PI / 2 })),
      ...[...wallZ].reverse().map((wallPos) => ({ x: 8.78, z: wallPos, ry: -Math.PI / 2 })),
    ];
    ART_LEGENDS.forEach((legend, i) => {
      const p = positions[i];
      const g = new THREE.Group(); g.position.set(p.x, 2.72, p.z); g.rotation.y = p.ry;
      const frame = new THREE.Mesh(new THREE.BoxGeometry(2.05, 2.58, 0.12), mat(i % 2 ? 0xc5a15f : 0x121419, { roughness: 0.28, metalness: i % 2 ? 0.72 : 0.34 }));
      const portrait = new THREE.Mesh(new THREE.PlaneGeometry(1.86, 2.32), new THREE.MeshStandardMaterial({ map: legendPortraitTexture(legend), roughness: 0.76 }));
      portrait.position.z = 0.067; portrait.userData.noSplat = true;
      const label = new THREE.Mesh(new THREE.PlaneGeometry(2.05, 0.34), new THREE.MeshBasicMaterial({ map: textTexture(`${legend.name}  ·  ${legend.years}`, { fg: '#15171a', bg: '#efe7d5', size: 25, w: 1000, h: 150, font: '900' }) }));
      label.position.set(0, -1.49, 0.07); label.userData.noSplat = true;
      g.add(frame, portrait, label); g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); z.group.add(g);
      z.interactables.push({
        id: `legend-${legend.id}`, type: 'flavor', label: `Look closer — ${legend.name}`,
        title: `${legend.name} · WALL OF FAME`, pos: new THREE.Vector3(p.x * 0.93, 1.65, p.z), radius: 2.15,
        lines: [legend.quote],
      });
      const spot = new THREE.SpotLight(0xffe3ae, 17, 6.5, 0.52, 0.7);
      spot.position.set(p.x * 0.72, 4.8, p.z); spot.target.position.set(p.x, 2.2, p.z); z.group.add(spot, spot.target);
    });

    const ceilingGlow = plane(z, { w: 8.8, h: 2.2, x: 0, y: roomH - 0.08, z: -2.2, rx: Math.PI / 2, material: new THREE.MeshBasicMaterial({ color: 0xf7dab0, transparent: true, opacity: 0.88, side: THREE.DoubleSide }), noSplat: true });
    ceilingGlow.userData.noSplat = true;
    z.group.add(new THREE.HemisphereLight(0xd9e8f0, 0x1c1612, 0.78));
    const warm = new THREE.PointLight(0xffc781, 8, 11, 1.7); warm.position.set(0, 3.8, -2.1); z.group.add(warm);
    door(z, { x: 0, z: 7.32, ry: Math.PI, label: '← GALLERIA BIANCA', to: 'galleria' });
    door(z, { x: 8.78, z: 0, ry: -Math.PI / 2, label: 'MTV CRIBS: BABY MONEY →', to: 'mtvCribs' });
    z.waypoints = [new THREE.Vector3(-5.8, 0, 4.8), new THREE.Vector3(-5.8, 0, -3), new THREE.Vector3(5.8, 0, -3), new THREE.Vector3(5.8, 0, 4.8)];
  }

  /* ---------------------------------------------------------- */
  /*  MTV CRIBS: BABY MONEY — a grown-up tantrum in gold leaf   */
  /* ---------------------------------------------------------- */
  #buildMtvCribs() {
    const z = this.#newZone('mtvCribs');
    const roomH = 6.2;
    shell(z, { w: 27, d: 18, h: roomH, floorColor: 0xede5d9, wallColor: 0xf2c8d8, ceilColor: 0x201522 });
    z.spawn.set(-11.9, 0, 0);
    z.spawnYaw = -Math.PI / 2;
    z.fog = { color: 0x6a3f56, density: 0.012 };

    const gold = mat(0xd5a63d, { roughness: 0.22, metalness: 0.86 });
    const pink = new THREE.MeshPhysicalMaterial({ color: 0xf17aac, roughness: 0.24, clearcoat: 0.74, clearcoatRoughness: 0.13 });
    const cream = mat(0xfff1dc, { roughness: 0.72 });
    const black = mat(0x17131b, { roughness: 0.35, metalness: 0.2 });
    plane(z, { w: 26.7, h: 17.7, y: 0.012, rx: -Math.PI / 2, material: new THREE.MeshPhysicalMaterial({ color: 0xe5d7ca, roughness: 0.18, metalness: 0.08, clearcoat: 0.5 }), noSplat: true, name: 'cribs marble floor' });
    plane(z, { w: 11.2, h: 3.1, x: 2.5, y: 0.025, z: 0, rx: -Math.PI / 2, material: pink, noSplat: true, name: 'cribs pink carpet' });

    // The set: one enormous sectional, a gold bottle-service table, trophy
    // fridge and a money fountain. Luxury is framed as a television prop.
    box(z, { w: 7.8, h: 0.52, d: 2.35, x: 4.2, z: -5.75, material: cream, name: 'cloud sectional' });
    box(z, { w: 7.8, h: 1.15, d: 0.42, x: 4.2, y: 0.35, z: -6.73, material: cream, name: 'cloud sectional back' });
    for (const [i, x] of [1.2, 3.2, 5.2, 7.2].entries()) {
      const cushion = new THREE.Mesh(new THREE.SphereGeometry(0.72, 18, 12), i % 2 ? pink : cream);
      cushion.position.set(x, 0.78, -5.72); cushion.scale.set(1.25, 0.62, 0.7); cushion.userData.noSplat = true; z.group.add(cushion);
    }
    cylinder(z, { rT: 1.25, rB: 0.86, h: 0.56, x: 3.2, z: -1.65, material: gold });
    const ice = new THREE.Mesh(new THREE.IcosahedronGeometry(0.46, 1), new THREE.MeshPhysicalMaterial({ color: 0xbceeff, transparent: true, opacity: 0.7, transmission: 0.45, roughness: 0.06 }));
    ice.position.set(3.2, 1.16, -1.65); ice.userData.noSplat = true; z.group.add(ice);
    box(z, { w: 2.65, h: 4.5, d: 1.25, x: 10.9, z: -5.8, material: gold, name: 'formula fridge' });
    plane(z, { w: 2.15, h: 3.9, x: 10.24, y: 2.35, z: -5.8, ry: Math.PI / 2, material: new THREE.MeshBasicMaterial({ map: textTexture('FORMULA · RESERVE', { fg: '#f7d9e6', bg: '#211821', size: 46, w: 700, h: 1000, font: '900' }) }), noSplat: true });
    z.interactables.push({ id: 'cribs-fridge', type: 'flavor', label: 'Open the trophy fridge', title: 'THE FORMULA FRIDGE', pos: new THREE.Vector3(10.1, 1.2, -5.8), radius: 2.25, lines: ['Every bottle has a vintage. None has a nipple. The insurance company insisted.', 'The host whispers that the fridge is rented. The owner whispers that ownership is for people without liquidity.'] });

    const fountain = new THREE.Group(); fountain.position.set(8.5, 0, 4.75);
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.7, 0.42, 32), gold); basin.position.y = 0.21;
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 2.5, 18), gold); column.position.y = 1.4;
    const dollar = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.12, 10, 28), gold); dollar.position.y = 2.95;
    fountain.add(basin, column, dollar); fountain.traverse((o) => { o.userData.noSplat = true; }); z.group.add(fountain);
    z.animated.cribsMoney = dollar;

    plane(z, { w: 12.8, h: 0.9, x: 1.5, y: 5.25, z: -8.75, material: new THREE.MeshBasicMaterial({ map: textTexture('MTV CRIBS: BABY MONEY', { fg: '#fff4ce', bg: '#7b1d4e', size: 72, w: 1800, h: 190, font: '900' }) }), noSplat: true });
    plane(z, { w: 8.1, h: 0.42, x: 1.5, y: 4.47, z: -8.73, material: new THREE.MeshBasicMaterial({ map: textTexture('ALL CAST MEMBERS ARE ADULTS  ·  ALL TANTRUMS ARE LEVERAGED', { fg: '#54243f', bg: '#ffd8e8', size: 30, w: 1600, h: 150, font: '900' }) }), noSplat: true });

    const makePerson = ({ skin, suit, x, zz, scale = 1, bib = false, cap = false }) => {
      const group = new THREE.Group(); group.position.set(x, 0, zz); group.scale.setScalar(scale);
      const skinMat = mat(skin, { roughness: 0.76 }); const suitMat = mat(suit, { roughness: 0.48 });
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.58, 6, 10), suitMat); torso.position.y = 1.08;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10), skinMat); head.position.y = 1.78;
      const legs = [];
      for (const side of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.48, 5, 8), black); leg.position.set(side * 0.15, 0.42, 0); legs.push(leg); group.add(leg); }
      const arms = [];
      for (const side of [-1, 1]) { const pivot = new THREE.Group(); pivot.position.set(side * 0.37, 1.35, 0); const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.38, 5, 8), skinMat); arm.position.y = -0.25; pivot.add(arm); arms.push(pivot); group.add(pivot); }
      group.add(torso, head);
      if (bib) {
        const bibMesh = new THREE.Mesh(new THREE.CircleGeometry(0.26, 18), pink); bibMesh.scale.set(1, 1.15, 1); bibMesh.position.set(0, 1.28, 0.31); bibMesh.userData.noSplat = true; group.add(bibMesh);
        const chain = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 8, 24, Math.PI), gold); chain.position.set(0, 1.48, 0.28); chain.rotation.x = Math.PI / 2; group.add(chain);
        const sippy = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.34, 12), gold); sippy.position.set(0.44, 1.13, 0.12); sippy.rotation.z = -0.25; group.add(sippy);
        const pacifier = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 8, 18), pink); pacifier.position.set(0, 1.68, 0.225); pacifier.rotation.x = Math.PI / 2; group.add(pacifier);
      }
      if (cap) { const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.27, 0.12, 14), black); hat.position.y = 1.98; group.add(hat); }
      group.traverse((o) => { o.userData.noSplat = true; if (o.isMesh) o.castShadow = true; }); z.group.add(group);
      return { group, torso, head, arms, legs, baseX: x, baseZ: zz };
    };

    const heirs = [
      makePerson({ skin: 0x8b5538, suit: 0x722d62, x: 1.15, zz: -4.55, scale: 1.08, bib: true }),
      makePerson({ skin: 0xd2a07d, suit: 0x2f5577, x: 3.55, zz: -4.6, bib: true }),
      makePerson({ skin: 0x6e412d, suit: 0xa43e48, x: 5.9, zz: -4.5, scale: 1.04, bib: true }),
      makePerson({ skin: 0xe0b395, suit: 0x594079, x: 8.0, zz: -4.45, bib: true }),
    ];
    const heirLines = [
      'My first word was offshore.',
      'This bib is archival. The stains are provenance.',
      'I do not throw tantrums. I trigger liquidity events.',
      'The sippy cup is solid gold. It is terrible at being a cup.',
      'We bought the view so nobody else could look at it.',
      'My trust fund has a trust fund. They are not speaking.',
      'The formula fridge is invite-only. Even I am on the list.',
      'Everything here is custom, including the childhood.',
    ];
    heirs.forEach((heir, i) => z.interactables.push({ id: `cribs-heir-${i}`, type: 'flavor', label: `Meet grown-up heir ${i + 1}`, title: `BABY MONEY · ADULT HEIR ${i + 1}`, pos: new THREE.Vector3(heir.baseX, 1.1, heir.baseZ), radius: 2.0, lines: [heirLines[i], heirLines[i + 4]] }));

    // Full moving crew: camera operator, boom operator, host and director.
    const cameraOp = makePerson({ skin: 0x9b6849, suit: 0x20242b, x: -5.3, zz: 3.4, cap: true });
    const cameraRig = new THREE.Group(); cameraRig.position.set(0.42, 1.45, 0.24);
    const cameraBody = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.38, 0.72), black);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.32, 16), black); lens.rotation.x = Math.PI / 2; lens.position.z = 0.48;
    const tally = new THREE.PointLight(0xff2738, 1.8, 2.2); tally.position.set(0.22, 0.25, 0.1); cameraRig.add(cameraBody, lens, tally); cameraOp.group.add(cameraRig);
    const boomOp = makePerson({ skin: 0xc59172, suit: 0x30323a, x: -2.2, zz: 4.1 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 3.7, 8), black); pole.position.set(0.2, 2.3, 0); pole.rotation.z = 1.08; boomOp.group.add(pole);
    const mic = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.38, 5, 8), black); mic.position.set(1.75, 3.15, 0); mic.rotation.z = Math.PI / 2; boomOp.group.add(mic);
    const host = makePerson({ skin: 0x7a4932, suit: 0xffd7e6, x: -6.2, zz: -1.2 });
    const hostMic = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.18, 5, 8), black); hostMic.position.set(0.42, 1.45, 0.18); hostMic.rotation.z = -0.7; host.group.add(hostMic);
    const director = makePerson({ skin: 0xe0b295, suit: 0x1e1c22, x: -4.9, zz: 5.7, cap: true });
    const clipboard = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.48, 0.035), cream); clipboard.position.set(-0.42, 1.26, 0.18); clipboard.rotation.z = 0.25; director.group.add(clipboard);
    z.animated.mtvCribs = {
      heirs, heirLines, lineTimer: 1.8, lineIndex: 0, tally,
      crew: [
        { ...cameraOp, radiusX: 5.2, radiusZ: 3.3, centerX: 1.2, centerZ: 1.0, speed: 0.22, phase: 0, role: 'CAMERA' },
        { ...boomOp, radiusX: 5.9, radiusZ: 3.9, centerX: 1.0, centerZ: 0.7, speed: 0.19, phase: 1.5, role: 'BOOM' },
        { ...host, radiusX: 4.4, radiusZ: 2.7, centerX: 1.8, centerZ: 0.3, speed: 0.16, phase: 3.1, role: 'HOST' },
        { ...director, radiusX: 6.7, radiusZ: 4.8, centerX: 0.8, centerZ: 0.6, speed: 0.12, phase: 4.7, role: 'DIRECTOR' },
      ],
    };
    z.interactables.push({ id: 'cribs-crew', type: 'flavor', label: 'Step into the shot', title: 'MTV CREW · ROLLING', pos: new THREE.Vector3(-3.6, 1.1, 1.8), radius: 3.0, lines: ['The camera operator tracks wealth in its natural habitat. The boom operator catches every compound interest.', 'The director shouts “organic!” and the four adult heirs immediately repeat the entrance.'] });

    z.group.add(new THREE.HemisphereLight(0xffdbea, 0x2b1730, 2.0));
    for (const [x, color] of [[-7, 0xff5b9a], [0, 0xffd36a], [8, 0x66c7ff]]) {
      const spot = new THREE.SpotLight(color, 28, 15, 0.7, 0.55); spot.position.set(x, 5.8, 4.5); spot.target.position.set(x * 0.35, 0, -2); z.group.add(spot, spot.target);
    }
    door(z, { x: -13.3, z: 0, ry: Math.PI / 2, label: '← THE LISTENING ROOM', to: 'listeningRoom' });
    z.waypoints = [new THREE.Vector3(-8, 0, 6), new THREE.Vector3(-2, 0, 6), new THREE.Vector3(5, 0, 5), new THREE.Vector3(10, 0, 2), new THREE.Vector3(8, 0, -5)];
  }

  primeForestChurch(index) {
    const church = this.zones.get('blackForest')?.animated.forestChurches?.[index];
    if (!church) return { status: 'missing' };
    if (church.burning) return { status: 'burning', church };
    if (church.primed) return { status: 'primed', church };
    church.primed = true;
    church.item.label = `Primed — click the lighter on stave church ${index + 1}`;

    // A dull petrol sheen gives the dousing readable feedback in the fog.
    if (church.sheen) {
      church.sheen.visible = true;
    } else {
      const sheen = new THREE.Mesh(
        new THREE.CircleGeometry(1.55, 24),
        new THREE.MeshPhysicalMaterial({
          color: 0x15191b, roughness: 0.08, metalness: 0.08,
          clearcoat: 0.9, transparent: true, opacity: 0.72,
        })
      );
      sheen.rotation.x = -Math.PI / 2;
      sheen.position.y = 0.025;
      sheen.userData.noSplat = true;
      church.group.add(sheen);
      church.sheen = sheen;
    }
    return { status: 'primed', church, fresh: true };
  }

  igniteForestChurch(playerPos, forward, range = 4.1) {
    const churches = this.zones.get('blackForest')?.animated.forestChurches ?? [];
    let best = null;
    let bestScore = Infinity;
    for (const church of churches) {
      const to = church.pos.clone().sub(playerPos);
      to.y = 0;
      const d = to.length();
      if (d > range || d < 0.01) continue;
      const facing = to.normalize().dot(forward);
      const score = d - facing * 0.8;
      if (facing > 0.12 && score < bestScore) {
        best = church;
        bestScore = score;
      }
    }
    if (!best) return { status: 'none' };
    if (best.burning) return { status: 'burning', church: best };
    if (!best.primed) return { status: 'needsGas', church: best };

    if (!best.fx) this.#buildChurchFire(best);
    best.burning = true;
    best.fireT = 0;
    best.fx.group.visible = true;
    best.fx.light.intensity = 5.5;
    best.item.label = `Stave church ${best.index + 1} is burning`;
    if (best.sheen) best.sheen.visible = false;

    best.group.traverse((o) => {
      if (!o.isMesh || o.userData.churchFx || o === best.sheen) return;
      if (!o.userData.burnMaterial) {
        o.material = o.material.clone();
        o.userData.burnMaterial = true;
        o.userData.originalColor = o.material.color?.clone() ?? null;
        best.burnMeshes.push(o);
      }
    });
    return { status: 'ignited', church: best };
  }

  #buildChurchFire(church) {
    const fx = new THREE.Group();
    fx.visible = false;
    fx.userData.churchFx = true;
    const flames = [];
    const smoke = [];
    const rng = mulberry32(0xF1AE + church.index * 491);
    const flameColors = [0xffd85c, 0xff8b2c, 0xe83b19];

    for (let i = 0; i < 28; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: flameColors[i % flameColors.length], transparent: true,
        opacity: 0.86, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.13 + rng() * 0.18, 0.75 + rng() * 1.05, 8), material);
      const high = i >= 17;
      flame.position.set(
        (rng() - 0.5) * (high ? 1.6 : 2.7),
        high ? 2.25 + rng() * 4.5 : 0.35 + rng() * 2.35,
        (rng() - 0.5) * (high ? 1.45 : 3.45),
      );
      flame.userData.churchFx = true;
      flame.userData.phase = rng() * Math.PI * 2;
      flame.userData.baseY = flame.position.y;
      fx.add(flame);
      flames.push(flame);
    }

    const smokeTex = this.zones.get('blackForest').churchSmokeTex ?? canvasTexture(128, 128, (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w / 2, h / 2, 3, w / 2, h / 2, w / 2);
      grad.addColorStop(0, 'rgba(22,24,23,0.72)');
      grad.addColorStop(0.55, 'rgba(39,43,41,0.42)');
      grad.addColorStop(1, 'rgba(50,56,53,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    });
    this.zones.get('blackForest').churchSmokeTex = smokeTex;
    for (let i = 0; i < 12; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, opacity: 0, depthWrite: false }));
      sprite.position.set((rng() - 0.5) * 1.4, 2.4 + rng() * 2, (rng() - 0.5) * 1.2);
      sprite.scale.setScalar(1.2 + rng() * 1.5);
      sprite.userData.churchFx = true;
      fx.add(sprite);
      smoke.push({ sprite, phase: rng(), speed: 0.1 + rng() * 0.09, drift: (rng() - 0.5) * 0.7 });
    }
    const light = new THREE.PointLight(0xff5c25, 0, 13, 1.6);
    light.position.set(0, 3.1, 0);
    light.userData.churchFx = true;
    fx.add(light);
    church.group.add(fx);
    church.fx = { group: fx, flames, smoke, light };
  }

  resetForestChurches() {
    const z = this.zones.get('blackForest');
    for (const church of z?.animated.forestChurches ?? []) {
      church.primed = false;
      church.burning = false;
      church.fireT = 0;
      church.item.label = `Douse stave church ${church.index + 1} of 10 with gasoline`;
      if (church.sheen) church.sheen.visible = false;
      if (church.fx) {
        church.fx.group.visible = false;
        church.fx.light.intensity = 0;
      }
      for (const mesh of church.burnMeshes) {
        if (mesh.userData.originalColor && mesh.material.color) mesh.material.color.copy(mesh.userData.originalColor);
      }
    }
    if (z) z.animated.churchCrackleT = 0.4;
  }

  /** Feed the newest painting into DOCUMENTA's intake without owning it. */
  setDocumentaSubject(texture = null, title = 'NO WORK SUBMITTED', lotNumber = 'PENDING') {
    const d = this.zones.get('documenta')?.animated.documenta;
    if (!d) return;
    d.subject.material.map = texture ?? null;
    d.subject.material.color.set(texture ? 0xffffff : 0x17191d);
    d.subject.material.needsUpdate = true;
    d.subjectLabel.material.map = textTexture(
      texture
        ? `3 · ARCHIVE INTAKE · Q APPRAISE · ${lotNumber} · “${title}”`
        : '3 · ARCHIVE INTAKE · NO WORK SUBMITTED',
      { fg: '#17191c', bg: '#f4f2eb', size: 25, w: 1100 }
    );
    d.subjectLabel.material.needsUpdate = true;
  }

  isDocumentaCameraHit(object) {
    return this.current === 'documenta' && Boolean(object?.userData?.documentaCameraLens || object?.name === 'documentaCameraLens');
  }

  isDocumentaArchiveHit(object) {
    return this.current === 'documenta' && Boolean(object?.userData?.documentaArchiveScanner || object?.name === 'documentaArchiveScanner');
  }

  /** Rebuild every visible side-quest stage from run-state flags. */
  applyDocumentaState({ accredited = false, cameraCorrupted = false, archiveCorrupted = false, complete = false, outcome = null } = {}) {
    const z = this.zones.get('documenta');
    const d = z?.animated.documenta;
    if (!d) return;
    d.accredited = accredited;
    d.cameraCorrupted = cameraCorrupted;
    d.archiveCorrupted = archiveCorrupted;
    d.complete = complete;
    d.outcome = outcome;
    for (const paper of d.badgePapers) paper.visible = accredited;

    d.heroCamera.lens.material.color.set(cameraCorrupted ? 0xc8326a : 0x0a0b0e);
    d.heroCamera.tally.color.set(cameraCorrupted ? 0xff62bd : 0xff283f);
    const gateOpen = archiveCorrupted || complete;
    d.gateOpen = gateOpen;
    d.gate.position.y = gateOpen ? 3.7 : 0;
    d.gateLabel.visible = !gateOpen;
    const colliderIndex = z.colliders.indexOf(d.gateCollider);
    if (gateOpen && colliderIndex >= 0) z.colliders.splice(colliderIndex, 1);
    if (!gateOpen && colliderIndex < 0) z.colliders.push(d.gateCollider);

    for (let i = 0; i < d.cameras.length; i++) {
      const camera = d.cameras[i];
      camera.group.rotation.set(0, camera.baseRy, 0);
      camera.tally.intensity = complete && outcome === 'release' ? 0 : (camera === d.heroCamera ? 2.2 : 0.7);
      camera.group.visible = true;
      if (complete && outcome === 'release') camera.group.rotation.z = (i % 2 ? -1 : 1) * 0.2;
      if (complete && outcome === 'destroy') camera.group.rotation.z = (i % 2 ? -1 : 1) * (0.72 + (i % 3) * 0.11);
    }

    const key = `${cameraCorrupted}:${archiveCorrupted}:${complete}:${outcome ?? ''}`;
    if (d.visualKey !== key) {
      d.visualKey = key;
      const corruptLines = ['PAINT IS THE SUBJECT', 'LENS CONSENT: REVOKED', 'GESTURE UNINDEXED', 'LIVE FEED: MAGENTA', 'CAMERA FILMING STAIN'];
      const finalLines = outcome === 'release'
        ? ['SUBJECT RELEASED', 'CONSENT REQUIRED', 'NAME RETURNED', 'NO AUTHORITATIVE COPY']
        : outcome === 'corrupt'
          ? ['FINAL_final_REAL_7', 'UNTITLED(1)(1)', 'CHECKSUM: LOL', 'ARTIST: SCANNER', 'MEDIUM: METADATA']
          : ['SIGNAL LOST', 'TRIPOD DOWN', 'ARCHIVE OFFLINE', 'NO RECORD FOUND'];
      for (let i = 0; i < d.monitorMats.length; i++) {
        const material = d.monitorMats[i];
        if (complete) {
          material.map = textTexture(finalLines[i % finalLines.length], { fg: outcome === 'destroy' ? '#ff4d5f' : '#d8f1df', bg: '#11161a', size: 34, w: 600, h: 350 });
        } else if (cameraCorrupted) {
          material.map = textTexture(corruptLines[i % corruptLines.length], { fg: '#ff78c8', bg: '#171019', size: 31, w: 600, h: 350 });
        } else {
          material.map = (d.scarred && i === 4) ? d.staticTex : material.userData.normalMap;
        }
        material.needsUpdate = true;
      }
      const authority = complete
        ? outcome === 'release'
          ? 'THE SUBJECT KEEPS THE NAME'
          : outcome === 'corrupt'
            ? 'THE DESCRIPTION DESCRIBES ITSELF'
            : 'AUTHORITY NOT FOUND'
        : archiveCorrupted
          ? 'METADATA OVERFLOW · ENTER'
          : 'THE AUTHORITATIVE DESCRIPTION SUPERSEDES THE EVENT';
      d.authorityMat.map = textTexture(authority, { fg: complete && outcome === 'destroy' ? '#ff4d5f' : '#f0eee5', bg: '#16191d', size: 35, w: 900, h: 300 });
      d.authorityMat.needsUpdate = true;
    }
  }

  resetRageRoom() {
    const z = this.zones.get('rageRoom');
    const rage = z?.animated.rageRoom;
    if (!rage) return;
    for (const target of rage.breakables) {
      target.broken = false;
      target.brokenAt = 0;
      target.group.visible = true;
      for (const fragment of target.fragments) {
        fragment.visible = false;
        delete fragment.userData.velocity;
        delete fragment.userData.spin;
        delete fragment.userData.brokenAt;
      }
    }
    rage.timer = 1.5;
    rage.nextIndex = 0;
    rage.shoutIndex = 0;
    rage.lastBreak = 0;
    if (rage.dude) rage.dude.position.set(0, 0, 0.5);
    if (rage.rageLight) rage.rageLight.intensity = rage.rageLight.userData.baseIntensity ?? 1.65;
  }

  #breakRageTarget(target, t) {
    if (!target || target.broken) return null;
    target.broken = true;
    target.brokenAt = t;
    target.group.visible = false;
    for (let i = 0; i < target.fragments.length; i++) {
      const fragment = target.fragments[i];
      const angle = (i / target.fragments.length) * Math.PI * 2 + target.variant * 0.7;
      fragment.visible = true;
      fragment.position.set(
        target.pos.x + Math.cos(angle) * (0.12 + (i % 3) * 0.07),
        target.pos.y + 0.08 + (i % 2) * 0.1,
        target.pos.z + Math.sin(angle) * (0.12 + (i % 2) * 0.08),
      );
      fragment.rotation.set(Math.sin(angle), angle, Math.cos(angle) * 0.5);
      fragment.userData.velocity = new THREE.Vector3(
        Math.cos(angle) * (0.65 + (i % 3) * 0.18),
        1.35 + (i % 2) * 0.4,
        Math.sin(angle) * (0.65 + (i % 2) * 0.2),
      );
      fragment.userData.spin = new THREE.Vector3(2.1 + i * 0.18, -1.4 + i * 0.2, 1.2 - i * 0.12);
      fragment.userData.brokenAt = t;
    }
    return { label: target.label, variant: target.variant };
  }

  breakRageObject(playerPos, forward) {
    if (this.current !== 'rageRoom') return { broken: false };
    const rage = this.zone('rageRoom')?.animated.rageRoom;
    if (!rage) return { broken: false };
    const fwd = new THREE.Vector2(forward.x, forward.z).normalize();
    let nearest = null;
    let nearestDistance = Infinity;
    for (const target of rage.breakables) {
      if (target.broken) continue;
      const dx = target.pos.x - playerPos.x;
      const dz = target.pos.z - playerPos.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 2.8 || distance >= nearestDistance) continue;
      const direction = new THREE.Vector2(dx, dz).normalize();
      if (fwd.dot(direction) < 0.38) continue;
      nearest = target;
      nearestDistance = distance;
    }
    const result = this.#breakRageTarget(nearest, this.#t);
    return result ? { broken: true, ...result } : { broken: false };
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
    const color = trackKey?.startsWith('ullabjakk') ? 0xf05a35 : (colors[trackKey] ?? 0x6b6872);
    for (const z of this.zones.values()) {
      const r = z.animated.recordPlayer;
      if (!r) continue;
      r.playing = !!trackKey;
      r.label.material.color.set(color);
      r.lamp.color.set(trackKey ? color : 0xe8c15a);
      r.lamp.intensity = trackKey ? r.lamp.userData.base : 0;
    }
  }

  waitingLaneAt(position) {
    if (this.current !== 'biennaleWaiting' || !position) return null;
    const waiting = this.zones.get('biennaleWaiting')?.animated.waiting;
    if (!waiting) return null;
    for (const [id, bounds] of Object.entries(waiting.lanes)) {
      if (position.x >= bounds.minX && position.x <= bounds.maxX
        && position.z >= bounds.minZ && position.z <= bounds.maxZ) return id;
    }
    return null;
  }

  isWaitingPavilionSignHit(object) {
    if (this.current !== 'biennaleWaiting') return null;
    let target = object;
    while (target) {
      if (target.userData?.waitingPavilionSign) return target.userData.waitingPavilionSign;
      target = target.parent;
    }
    return null;
  }

  waitingSupportFromObject(object) {
    if (this.current !== 'biennaleWaiting') return null;
    let target = object;
    while (target) {
      if (target.userData?.waitingSupport) return target.userData.waitingSupport;
      target = target.parent;
    }
    return null;
  }

  /** Rebuild preliminary gates, pavilion scores and the final tableau from run flags. */
  applyWaitingState({ stage = 0, activeQueue = null, finalStarted = false, finalElapsed = 0, pavilions = {}, complete = false, winner = null } = {}) {
    const waiting = this.zones.get('biennaleWaiting')?.animated.waiting;
    if (!waiting) return;
    waiting.stage = Math.max(0, Math.min(4, Number(stage) || 0));
    waiting.activeQueue = typeof activeQueue === 'string' ? activeQueue : null;
    waiting.finalStarted = Boolean(finalStarted);
    waiting.finalElapsed = Math.max(0, Number(finalElapsed) || 0);
    waiting.pavilions = pavilions && typeof pavilions === 'object' ? pavilions : {};
    waiting.complete = Boolean(complete);
    waiting.winner = typeof winner === 'string' ? winner : null;

    const names = { nordic: 'NORDIC', german: 'GERMAN', american: 'AMERICAN', french: 'FRENCH', british: 'BRITISH' };
    const order = ['nordic', 'german', 'american', 'french', 'british'];
    const lines = order.map((key) => {
      const p = waiting.pavilions[key] ?? {};
      const score = Math.max(0, Math.round(Number(p.score) || 50));
      const status = p.eliminated ? 'COLLAPSED' : waiting.complete && key === waiting.winner ? 'WINNER' : `${score} SEC`;
      return `${names[key].padEnd(9, ' ')} ${status}`;
    });
    const heading = waiting.complete
      ? `QUEUE SURVIVAL · ${names[waiting.winner] ?? 'PENDING'} PAVILION WINS`
      : waiting.finalStarted
        ? `QUEUE SURVIVAL · ${Math.min(120, Math.floor(waiting.finalElapsed))}/120 SEC`
        : `QUEUE SURVIVAL · PRELIMINARY ${Math.min(4, waiting.stage)}/4`;
    const boardKey = `${heading}:${lines.join('|')}`;
    if (waiting.scoreboard.userData.boardKey !== boardKey) {
      waiting.scoreboard.material.map?.dispose?.();
      waiting.scoreboard.material.map = textTexture(`${heading}\n\n${lines.join('\n')}`, {
        fg: '#d9f2dc', bg: '#102017', size: 39, w: 1200, h: 650, font: '800',
      });
      waiting.scoreboard.material.needsUpdate = true;
      waiting.scoreboard.userData.boardKey = boardKey;
    }

    for (const key of order) {
      const state = waiting.pavilions[key] ?? {};
      const sign = waiting.pavilionSigns[key];
      const eliminated = Boolean(state.eliminated);
      sign.material.opacity = eliminated ? 0.28 : 1;
      sign.material.color.set(eliminated ? 0x777777 : 0xffffff);
      sign.rotation.z = eliminated ? (order.indexOf(key) % 2 ? -0.08 : 0.08) : 0;
      sign.scale.setScalar(waiting.complete && key === waiting.winner ? 1.12 : state.supported ? 1.045 : 1);
      for (const visitor of waiting.visitors.filter((v) => v.lane === key)) visitor.group.visible = !eliminated || (waiting.complete && key === waiting.winner);
    }
    waiting.germanDoors.forEach((doorMesh, i) => {
      const german = waiting.pavilions.german ?? {};
      doorMesh.rotation.z = german.eliminated ? (i % 2 ? -0.9 : 0.9) : german.supported ? -0.24 - i * 0.08 : 0;
      doorMesh.visible = !german.eliminated || waiting.winner === 'german';
    });
    waiting.placards.forEach((placard, i) => {
      placard.rotation.z = (waiting.pavilions.french?.eliminated ? 0.42 : 0.08) * (i % 2 ? -1 : 1);
    });
    waiting.puddles.forEach((puddle, i) => {
      const growth = waiting.pavilions.british?.eliminated ? 1.9 : 0.55 + Math.min(1, waiting.finalElapsed / 120) * (0.65 + i * 0.05);
      puddle.scale.setScalar(growth);
      puddle.material.opacity = waiting.pavilions.british?.eliminated ? 0.62 : 0.38;
    });
    waiting.juryDesk.material.color.set(waiting.complete ? 0x725d22 : order.filter((key) => !waiting.pavilions[key]?.eliminated).length === 1 ? 0x455c35 : 0x17181d);
    const visualKey = `${waiting.stage}:${waiting.activeQueue}:${waiting.finalStarted}:${waiting.complete}:${waiting.winner}`;
    waiting.visualKey = visualKey;
  }

  /* ---- the gallery display slot ---- */

  hangOnDisplay(texture, title, lotNumber = lotNumberFor(1)) {
    const z = this.zones.get('galleria');
    z.displayArt.material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85 });
    z.displaySign.material.map = textTexture(`“${title}” — THE ARTIST`, { fg: '#e8c15a', size: 30 });
    z.displaySign.material.needsUpdate = true;
    z.archiveDot.material.opacity = 1;
    z.archiveLabel.material.map = textTexture(`${lotNumber} · FOR THE ARCHIVE`, { fg: '#c3263e', bg: '#f0ede6', size: 23, w: 820, h: 130, font: '800' });
    z.archiveLabel.material.opacity = 1;
    z.archiveLabel.material.needsUpdate = true;
    z.displayOccupied = true;
  }

  clearDisplay() {
    const z = this.zones.get('galleria');
    z.displayArt.material = new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 0.9 });
    z.displaySign.material.map = textTexture('RESERVED — “THE ARTIST”', { fg: '#8f8a7a', size: 34 });
    z.displaySign.material.needsUpdate = true;
    z.archiveDot.material.opacity = 0;
    z.archiveLabel.material.opacity = 0;
    z.archiveLabel.material.map = null;
    z.archiveLabel.material.needsUpdate = true;
    z.displayOccupied = false;
  }

  setVaultArchive(title = 'THE ARTIST', lotNumber = lotNumberFor(1)) {
    const z = this.zones.get('vault');
    if (!z?.archivePlate) return;
    z.archivePlate.material.map = textTexture(`ARCHIVE · ${lotNumber} · “${title}”`, {
      fg: '#e8c15a', bg: '#17151b', size: 28, w: 1050, h: 140, font: '800',
    });
    z.archivePlate.material.needsUpdate = true;
  }

  syncInvisibleCollection({ value = 15000, clean = true, complete = false, contacted = [] } = {}) {
    const c = this.zones.get('invisibleCollection')?.animated.invisibleCollection;
    if (!c) return;
    c.value = Math.max(0, Number(value) || 0);
    c.clean = Boolean(clean);
    c.complete = Boolean(complete);
    c.contactZones.forEach((contact) => { contact.triggered = contacted.includes(contact.index); });
    const status = complete ? 'ACQUISITION CLOSED' : clean ? 'NO OBJECTS ADMITTED' : 'CONTAMINATION IS VALUE';
    if (c.board.userData.value !== c.value || c.board.userData.status !== status) {
      c.board.material.map?.dispose?.();
      c.board.material.map = textTexture(`LIVE VALUATION  €${c.value.toLocaleString('en-GB')}\n${status}`, {
        fg: clean ? '#c8f7d1' : '#ff8d7b', bg: '#102319', size: 52, w: 1200, h: 380, font: '800',
      });
      c.board.material.needsUpdate = true;
      c.board.userData.value = c.value;
      c.board.userData.status = status;
    }
  }

  triggerInvisibleAlarm(index = 0) {
    const c = this.zones.get('invisibleCollection')?.animated.invisibleCollection;
    if (!c) return;
    c.alarmIndex = Math.max(0, Math.min(c.alarmLights.length - 1, index));
    c.alarmUntil = this.#t + 2.7;
  }

  contaminateInvisibleWork(index = 0) {
    const c = this.zones.get('invisibleCollection')?.animated.invisibleCollection;
    if (!c) return;
    c.clean = false;
    this.triggerInvisibleAlarm(index);
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
   * @param beatPhase 0..1 within the current beat, or -1 when the room is silent.
   * @param soundtrackBpm current record/room tempo for performance intensity.
   */
  update(dt, t, beatPhase = -1, soundtrackBpm = 0, playerPosition = null) {
    const z = this.zone();
    if (!z) return;
    this.#t = t;
    let event = null;
    const beat = beatPhase >= 0;
    // a sharp percussive envelope: full on the kick, decays through the beat
    const kick = beat ? Math.pow(1 - beatPhase, 2.6) : 0;

    if (z.animated.invisibleCollection) {
      const collection = z.animated.invisibleCollection;
      const alarmLive = t < collection.alarmUntil;
      for (let i = 0; i < collection.alarmLights.length; i++) {
        const light = collection.alarmLights[i];
        light.intensity = alarmLive && (collection.alarmIndex === i || collection.alarmIndex < 0)
          ? 7.5 + Math.pow(Math.max(0, Math.sin(t * 18)), 4) * 12
          : 0;
      }
      for (const official of collection.staff) {
        official.group.position.y = Math.sin(t * 1.1 + official.phase) * 0.008;
        official.headPivot.rotation.y = Math.sin(t * 0.35 + official.phase) * 0.08;
        official.headPivot.rotation.z = alarmLive ? Math.sin(t * 13 + official.phase) * 0.04 : 0;
      }
      if (playerPosition) {
        for (const contact of collection.contactZones) {
          if (contact.triggered) continue;
          if (playerPosition.x >= contact.minX && playerPosition.x <= contact.maxX
            && playerPosition.z >= contact.minZ && playerPosition.z <= contact.maxZ) {
            contact.triggered = true;
            collection.alarmIndex = contact.index;
            collection.alarmUntil = t + 2.7;
            event = { type: 'invisibleContact', index: contact.index, title: contact.title };
            break;
          }
        }
      }
    }

    if (z.animated.listeningDrivers) {
      const breathe = beat ? kick : Math.max(0, Math.sin(t * 2.15)) * 0.018;
      for (const d of z.animated.listeningDrivers) {
        const pulse = breathe * (0.022 + (d.phase % 1) * 0.008);
        d.mesh.scale.set(d.base.x * (1 + pulse), d.base.y * (1 + pulse), d.base.z);
      }
    }

    if (z.animated.listeningBand) {
      const band = z.animated.listeningBand;
      const bpm = soundtrackBpm || 66.6;
      const intensity = clamp((bpm - 64) / 112, 0, 1);
      const beatRate = bpm / 60;
      const fallbackPhase = (t * beatRate) % 1;
      const phase = beat ? beatPhase : fallbackPhase;
      const downbeat = Math.pow(1 - phase, 2.35);
      const eighth = Math.pow(1 - ((phase * 2) % 1), 3.1);
      const travel = 0.45 + intensity * 1.45;

      for (let i = 0; i < band.performers.length; i++) {
        const p = band.performers[i];
        const looseness = Math.sin(t * beatRate * Math.PI * 2 + p.phase);
        const headbang = Math.sin(t * beatRate * Math.PI * (2 + intensity * 2.2) + p.phase);
        p.group.position.y = 0.3 + downbeat * (0.018 + intensity * 0.085) + Math.abs(looseness) * intensity * 0.018;
        p.torso.rotation.z = looseness * (0.025 + intensity * 0.075);
        p.torso.rotation.x = -downbeat * (0.025 + intensity * 0.12);
        p.headPivot.rotation.x = -0.07 - downbeat * (0.09 + intensity * 0.42) + headbang * intensity * 0.08;
        p.headPivot.rotation.z = looseness * (0.025 + intensity * 0.08);
        p.legs[0].rotation.x = looseness * intensity * 0.08;
        p.legs[1].rotation.x = -looseness * intensity * 0.08;
      }

      // Guitar and bass respond differently: one attacks fast eighths, the
      // other leans into quarter notes with heavier body movement.
      band.guitarist.arms[0].rotation.x = -0.62 - eighth * (0.18 + intensity * 0.72);
      band.guitarist.arms[0].rotation.z = -0.36 - Math.sin(t * beatRate * Math.PI * 4) * intensity * 0.14;
      band.guitarist.arms[1].rotation.x = -0.84 + Math.sin(t * beatRate * Math.PI) * 0.08;
      band.guitarist.instrument.rotation.y = Math.sin(t * beatRate * Math.PI) * intensity * 0.08;
      band.bassist.arms[0].rotation.x = -0.62 - downbeat * (0.12 + intensity * 0.36);
      band.bassist.arms[1].rotation.x = -0.84 - eighth * (0.08 + intensity * 0.28);
      band.bassist.instrument.rotation.y = -Math.sin(t * beatRate * Math.PI) * intensity * 0.055;

      // The vocalist opens up and begins leaving the floor as the tempo rises.
      band.singer.mouth.scale.y = 1 + downbeat * (1.2 + intensity * 4.2);
      band.singer.arms[0].rotation.z = -0.22 - intensity * 0.65 - Math.abs(Math.sin(t * beatRate * Math.PI)) * intensity * 0.42;
      band.singer.arms[1].rotation.z = 0.18 + downbeat * (0.16 + intensity * 0.72);
      band.singer.arms[1].rotation.x = -0.55 - downbeat * intensity * 0.5;
      band.singer.group.rotation.y = Math.sin(t * beatRate * Math.PI) * (0.03 + intensity * 0.13);

      // A recorded ad-lib the singer keeps coming back to, one call every 10s.
      if (t >= band.nextVocal) {
        band.nextVocal = t + 10;
        event = { type: 'singerVocal' };
      }

      // Alternating stick travel lands snare/hat gestures between the kicks.
      band.drummer.arms[0].rotation.x = -0.48 - downbeat * travel;
      band.drummer.arms[1].rotation.x = -0.48 - eighth * travel * 0.86;
      band.drummer.arms[0].rotation.z = -0.58 - Math.sin(t * beatRate * Math.PI * 2) * intensity * 0.16;
      band.drummer.arms[1].rotation.z = 0.58 + Math.sin(t * beatRate * Math.PI * 2) * intensity * 0.16;
      band.kickDrum.scale.set(1 + downbeat * 0.035, 1 + downbeat * 0.035, 1 + downbeat * 0.075);
      for (let i = 0; i < band.cymbals.length; i++) {
        const cymbal = band.cymbals[i];
        cymbal.rotation.x = Math.sin(t * (8 + i * 1.7)) * downbeat * (0.025 + intensity * 0.11);
        cymbal.rotation.z = (i - 1) * 0.035 + Math.sin(t * (6.5 + i)) * downbeat * intensity * 0.08;
      }
      for (let i = 0; i < band.bandLights.length; i++) {
        const light = band.bandLights[i];
        const accentHit = i % 2 ? eighth : downbeat;
        light.intensity = light.userData.base * (0.62 + intensity * 0.28) + accentHit * (1.8 + intensity * 10.5);
        light.target.position.x = (i - 1.5) * 0.8 + Math.sin(t * (0.32 + intensity * 0.48) + i) * intensity * 1.6;
      }
    }

    if (z.animated.mtvCribs) {
      const cribs = z.animated.mtvCribs;
      if (z.animated.cribsMoney) z.animated.cribsMoney.rotation.y += dt * 0.65;
      for (let i = 0; i < cribs.heirs.length; i++) {
        const heir = cribs.heirs[i];
        const bounce = Math.abs(Math.sin(t * (1.8 + i * 0.12) + i * 0.9));
        heir.group.position.y = bounce * 0.018 + kick * 0.035;
        heir.head.rotation.y = Math.sin(t * 0.75 + i) * 0.2;
        heir.head.rotation.z = Math.sin(t * 0.52 + i * 1.3) * 0.045;
        heir.torso.rotation.z = Math.sin(t * 1.2 + i * 0.8) * 0.025;
        heir.arms[0].rotation.z = -0.28 - Math.abs(Math.sin(t * 2.2 + i)) * 0.38;
        heir.arms[1].rotation.z = 0.28 + Math.abs(Math.sin(t * 2.5 + i * 0.7)) * 0.46;
      }
      for (const member of cribs.crew) {
        const a = t * member.speed + member.phase;
        const x = member.centerX + Math.cos(a) * member.radiusX;
        const zz = member.centerZ + Math.sin(a) * member.radiusZ;
        const dx = -Math.sin(a) * member.radiusX * member.speed;
        const dz = Math.cos(a) * member.radiusZ * member.speed;
        const step = Math.sin(t * 7.4 + member.phase);
        member.group.position.set(x, Math.abs(step) * 0.025, zz);
        member.group.rotation.y = Math.atan2(dx, dz);
        member.torso.rotation.z = step * 0.035;
        member.head.rotation.y = Math.sin(t * 0.9 + member.phase) * 0.13;
        member.legs[0].rotation.x = step * 0.2;
        member.legs[1].rotation.x = -step * 0.2;
        member.arms[0].rotation.z = -0.18 - step * 0.08;
        member.arms[1].rotation.z = 0.18 + step * 0.08;
      }
      cribs.tally.intensity = 1.2 + Math.pow(Math.max(0, Math.sin(t * 5.2)), 7) * 5.4;
      cribs.lineTimer -= dt;
      if (cribs.lineTimer <= 0) {
        const i = cribs.lineIndex % cribs.heirLines.length;
        cribs.lineIndex++;
        cribs.lineTimer = 4.2 + (i % 3) * 0.55;
        event = { type: 'cribsLine', speaker: `BABY MONEY · ADULT HEIR ${(i % cribs.heirs.length) + 1}`, line: cribs.heirLines[i] };
      }
    }

    if (z.animated.waiting) {
      const waiting = z.animated.waiting;
      for (const visitor of waiting.visitors) {
        if (!visitor.group.visible) continue;
        visitor.phase = (visitor.phase + dt * visitor.speed + 1) % 1;
        const eased = visitor.phase * visitor.phase * (3 - 2 * visitor.phase);
        visitor.group.position.x = THREE.MathUtils.lerp(visitor.from.x, visitor.to.x, eased);
        visitor.group.position.z = THREE.MathUtils.lerp(visitor.from.y, visitor.to.y, eased);
        visitor.group.rotation.y = Math.atan2(visitor.to.x - visitor.from.x, visitor.to.y - visitor.from.y) + (visitor.speed < 0 ? Math.PI : 0);
        const step = Math.sin(t * 5.2 + visitor.phase * Math.PI * 2);
        visitor.group.position.y = Math.abs(step) * 0.014;
        visitor.legs[0].rotation.x = step * 0.08;
        visitor.legs[1].rotation.x = -step * 0.08;
        visitor.head.rotation.y = Math.sin(t * 0.42 + visitor.phase * 7) * 0.09;
      }
      waiting.ticketGlow.material.opacity = 0.68 + Math.pow(Math.max(0, Math.sin(t * 3.2)), 8) * 0.32;
      waiting.vipArrows.forEach((arrow, i) => { arrow.position.x += Math.sin(t * 1.35 + i * 0.7) * dt * 0.035; });
      waiting.placards.forEach((placard, i) => {
        placard.position.y = 1.75 + Math.sin(t * 1.8 + i * 1.1) * 0.08;
      });
      waiting.puddles.forEach((puddle, i) => {
        puddle.material.opacity += Math.sin(t * 0.7 + i) * dt * 0.012;
        puddle.material.opacity = clamp(puddle.material.opacity, 0.3, 0.68);
      });
    }

    if (z.animated.documenta) {
      const doc = z.animated.documenta;
      for (let i = 0; i < doc.crews.length; i++) {
        const crew = doc.crews[i];
        const a = t * crew.speed + crew.phase;
        const x = -1.4 + Math.cos(a) * crew.radiusX;
        const zz = Math.sin(a * 1.17) * crew.radiusZ;
        const dx = -Math.sin(a) * crew.radiusX * crew.speed;
        const dz = Math.cos(a * 1.17) * crew.radiusZ * crew.speed * 1.17;
        const step = Math.sin(t * 7.2 + crew.phase);
        crew.group.position.set(x, Math.abs(step) * 0.025, zz);
        crew.group.rotation.y = Math.atan2(dx, dz);
        crew.torso.rotation.z = step * 0.035;
        crew.head.rotation.y = Math.sin(t * 0.82 + crew.phase) * 0.18;
      }
      if (doc.accredited) {
        for (const paper of doc.badgePapers) {
          paper.position.y = paper.userData.baseY + Math.sin(t * 1.8 + paper.userData.phase) * 0.008;
        }
      }
      const shutterPulse = Math.pow(Math.max(0, Math.sin(t * 5.8)), 18);
      for (let i = 0; i < doc.cameras.length; i++) {
        const camera = doc.cameras[i];
        if (doc.complete && doc.outcome === 'release') continue;
        camera.tally.intensity = (camera === doc.heroCamera ? 1.3 : 0.35) + shutterPulse * (doc.cameraCorrupted ? 5.4 : 2.5);
      }
      if (!doc.complete || doc.outcome !== 'release') {
        doc.shutterT -= dt;
        if (doc.shutterT <= 0) {
          doc.shutterT = doc.cameraCorrupted ? 0.58 + Math.random() * 0.55 : 1.35 + Math.random() * 1.2;
          event = { type: 'documentaShutter', corrupted: doc.cameraCorrupted };
        }
      }
    }

    if (z.animated.rageRoom) {
      const rage = z.animated.rageRoom;
      const frenzy = 0.7 + Math.sin(t * 5.8) * 0.3;
      rage.dude.position.y = Math.abs(Math.sin(t * 8.4)) * 0.035;
      rage.dude.rotation.y = Math.sin(t * 5.1) * 0.16;
      rage.torso.rotation.z = Math.sin(t * 11.5) * 0.08;
      rage.torso.rotation.x = -0.08 - frenzy * 0.08;
      rage.head.rotation.y = Math.sin(t * 13.2) * 0.32;
      rage.head.rotation.z = Math.sin(t * 7.7) * 0.12;
      rage.armL.rotation.z = -0.55 - Math.abs(Math.sin(t * 7.1)) * 1.05;
      rage.armR.rotation.z = 0.55 + Math.abs(Math.sin(t * 8.2 + 0.8)) * 1.12;
      rage.armL.rotation.x = Math.sin(t * 4.6) * 0.32;
      rage.armR.rotation.x = Math.sin(t * 5.2 + 1.2) * -0.28;

      for (const orb of rage.signalOrbs ?? []) {
        orb.mesh.position.y = orb.baseY + Math.sin(t * 1.15 + orb.phase) * 0.09;
        orb.mesh.material.emissiveIntensity = 0.82 + kick * 0.75 + Math.sin(t * 0.65 + orb.phase) * 0.12;
      }

      for (const fragment of rage.shards) {
        if (!fragment.visible || !fragment.userData.velocity) continue;
        const velocity = fragment.userData.velocity;
        velocity.y -= dt * 6.2;
        fragment.position.addScaledVector(velocity, dt);
        fragment.rotation.x += fragment.userData.spin.x * dt;
        fragment.rotation.y += fragment.userData.spin.y * dt;
        fragment.rotation.z += fragment.userData.spin.z * dt;
        if (fragment.position.y < 0.04 || t - fragment.userData.brokenAt > 2.8) {
          fragment.visible = false;
        }
      }

      rage.timer -= dt;
      if (rage.timer <= 0) {
        const next = rage.breakables.find((target) => !target.broken);
        if (next) {
          const result = this.#breakRageTarget(next, t);
          rage.nextIndex++;
          rage.shoutIndex++;
          rage.timer = 3.7 + (rage.nextIndex % 3) * 0.42;
          rage.lastBreak = t;
          event = { type: 'rageBreak', variant: result.variant, line: rage.lines[(rage.shoutIndex - 1) % rage.lines.length] };
        } else {
          rage.timer = 4.25;
          rage.shoutIndex++;
          event = { type: 'rageBreak', variant: rage.shoutIndex % 4, line: rage.lines[(rage.shoutIndex - 1) % rage.lines.length] };
        }
      }
      const breakAge = t - (rage.lastBreak ?? 0);
      const daylightBase = rage.rageLight.userData.baseIntensity ?? 1.65;
      rage.rageLight.intensity = daylightBase + (breakAge >= 0 && breakAge < 0.45 ? (1 - breakAge / 0.45) * 3.2 : 0);
    }

    if (z.animated.deathMetal) {
      const concert = z.animated.deathMetal;
      const pulse = beat ? kick : 0.15 + Math.max(0, Math.sin(t * 7.4)) * 0.12;
      concert.barbie.rotation.y += dt * 0.7;
      concert.barbie.position.y = 0.42 + Math.abs(Math.sin(t * 3.2)) * 0.018;
      concert.guitarist.group.position.y = 0.42 + Math.abs(Math.sin(t * 6.8)) * 0.035 + pulse * 0.025;
      concert.bassist.group.position.y = 0.42 + Math.abs(Math.sin(t * 7.4 + 0.7)) * 0.04 + pulse * 0.028;
      for (const musician of [concert.guitarist, concert.bassist]) {
        musician.head.rotation.y = Math.sin(t * 12.5 + musician.group.position.x) * 0.22;
        musician.body.rotation.z = Math.sin(t * 9.5 + musician.group.position.x) * 0.06;
        musician.armL.rotation.z = -0.28 - Math.abs(Math.sin(t * 11.5 + musician.group.position.x)) * 0.7;
        musician.armR.rotation.z = 0.28 + Math.abs(Math.sin(t * 13.1 + musician.group.position.x)) * 0.68;
        musician.guitar.rotation.x = Math.sin(t * 10.5 + musician.group.position.x) * 0.06;
      }
      concert.drumGroup.position.y = 0.42 + Math.abs(Math.sin(t * 7.0)) * 0.026;
      concert.drumKick.scale.z = 1 + pulse * 0.06;
      concert.cymbal.rotation.z = Math.sin(t * 5.4) * 0.16 + pulse * 0.22;
      concert.stickL.rotation.z = -0.62 - Math.abs(Math.sin(t * 14.3)) * 0.9;
      concert.stickR.rotation.z = 0.62 + Math.abs(Math.sin(t * 15.1 + 0.4)) * 0.9;
      for (let i = 0; i < concert.concertLights.length; i++) {
        const light = concert.concertLights[i];
        light.intensity = 7 + pulse * (i % 2 ? 22 : 28);
        light.target.position.x = Math.sin(t * 0.9 + i * 1.7) * 4.6;
        concert.beamMeshes[i].material.opacity = 0.045 + pulse * 0.12;
        concert.beamMeshes[i].rotation.z = Math.sin(t * 0.8 + i) * 0.12;
      }
      concert.pitRing.material.opacity = 0.5 + pulse * 0.34;
      for (const mosher of concert.moshers) {
        let x;
        let zz;
        let yaw;
        if (mosher.style === 'slam') {
          // The inner bodies cut across the pit instead of orbiting it: short,
          // violent lanes make the space read as a moshpit rather than a dance ring.
          const lane = Math.sin(t * (1.05 + mosher.speed * 0.1) + mosher.phase);
          x = lane * 2.85 + Math.sin(t * 4.7 + mosher.phase) * 0.22;
          zz = 2.25 + Math.cos(t * 1.55 + mosher.phase) * 2.05;
          yaw = Math.atan2(Math.cos(t * 1.55 + mosher.phase) * 2.05, Math.cos(t * 1.05 + mosher.phase) * 2.85);
        } else if (mosher.style === 'surge') {
          const surge = Math.sin(t * 0.82 + mosher.phase);
          x = surge * 3.55;
          zz = 2.25 + Math.sin(t * 1.7 + mosher.phase) * 1.12 + (mosher.angle > Math.PI ? 0.7 : -0.7);
          yaw = Math.atan2(Math.cos(t * 0.82 + mosher.phase), Math.cos(t * 1.7 + mosher.phase));
        } else {
          const angle = mosher.angle + t * mosher.speed + Math.sin(t * 2.7 + mosher.phase) * 0.23;
          const radius = mosher.radius + Math.sin(t * 3.1 + mosher.phase) * 0.18;
          x = Math.cos(angle) * radius;
          zz = 2.25 + Math.sin(angle) * radius;
          yaw = angle + Math.PI / 2;
        }
        const jump = Math.abs(Math.sin(t * (mosher.style === 'slam' ? 11.5 : 8.3) + mosher.phase)) * 0.09;
        mosher.group.position.set(x, jump, zz);
        mosher.group.rotation.y = yaw;
        mosher.torso.rotation.z = Math.sin(t * 10.2 + mosher.phase) * (mosher.style === 'slam' ? 0.28 : 0.18);
        mosher.head.rotation.y = Math.sin(t * 8.8 + mosher.phase) * 0.42;
        mosher.arm.rotation.z = -0.42 - Math.abs(Math.sin(t * 9.1 + mosher.phase)) * (mosher.style === 'slam' ? 1.2 : 0.92);
        mosher.arm2.rotation.z = 0.42 + Math.abs(Math.sin(t * 10.4 + mosher.phase)) * (mosher.style === 'slam' ? 1.1 : 0.85);
        mosher.fist.position.y = 0.51 + Math.abs(Math.sin(t * 9.1 + mosher.phase)) * 0.08;
        mosher.fist2.position.y = 0.51 + Math.abs(Math.sin(t * 10.4 + mosher.phase)) * 0.08;
        mosher.leg.rotation.z = Math.sin(t * 8.4 + mosher.phase) * 0.12;
        mosher.leg2.rotation.z = -Math.sin(t * 8.4 + mosher.phase) * 0.12;
        mosher.prop.position.y = 0.99 + Math.abs(Math.sin(t * 7.2 + mosher.phase)) * 0.13;
        mosher.prop.rotation.z = Math.sin(t * 5.6 + mosher.phase) * 0.55;
      }
      if (beat) {
        const step = Math.floor(t * 176 / 60 * 4);
        if (step !== concert.lastStep) {
          concert.lastStep = step;
          if (step % 4 === 0) event = { type: 'deathMetalHit', variant: (step / 4) % 4 };
        }
      }
    }

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
    if (z.animated.steroidCloud) {
      const c = z.animated.steroidCloud;
      c.group.position.y = c.baseY + Math.sin(t * 0.68) * 0.08;
      c.group.rotation.y = Math.sin(t * 0.22) * 0.06;
      c.light.intensity = c.light.userData.base * (0.82 + Math.sin(t * 2.1) * 0.18 + kick * 0.3);
    }
    if (z.animated.steroidRain) {
      for (const r of z.animated.steroidRain) {
        r.group.position.y -= dt * r.speed;
        if (r.group.position.y < r.bottom) r.group.position.y = r.top;
        r.group.position.x = r.baseX + Math.sin(t * 0.72 + r.phase) * r.drift;
        r.group.position.z = r.baseZ + Math.cos(t * 0.57 + r.phase) * r.drift * 0.7;
        r.group.rotation.x += dt * r.spin;
        r.group.rotation.z += dt * r.spin * 0.63;
      }
    }
    if (z.animated.editions) {
      for (const e of z.animated.editions) {
        e.group.rotation.y += dt * 0.075 * e.direction;
        e.group.position.y = e.baseY + Math.sin(t * 0.72 + e.phase) * 0.012;
      }
    }
    if (z.animated.toiletGuard) {
      const guard = z.animated.toiletGuard;
      const lineIndex = Math.floor(t / 3.4) % guard.bubbleMaps.length;
      if (lineIndex !== guard.lineIndex) {
        guard.lineIndex = lineIndex;
        guard.bubble.material.map = guard.bubbleMaps[lineIndex];
        guard.bubble.material.needsUpdate = true;
        guard.bubbleChangedAt = t;
      }
      const bubbleAge = t - guard.bubbleChangedAt;
      const bubblePop = bubbleAge >= 0 && bubbleAge < 0.34
        ? Math.sin((bubbleAge / 0.34) * Math.PI) * 0.055 : 0;
      guard.bubble.scale.set(1 + bubblePop, 1 + bubblePop, 1);
      // He keeps pointing; the poop answers only with a tiny, insoluble wobble.
      guard.head.rotation.y = Math.sin(t * 1.1) * 0.13 - 0.18;
      guard.head.rotation.z = Math.sin(t * 0.72) * 0.035;
      guard.arm.rotation.z = 0.28 + Math.sin(t * 2.15) * 0.08;
      guard.group.position.y = Math.abs(Math.sin(t * 1.25)) * 0.012;
      if (guard.poop) {
        guard.poop.rotation.y = Math.sin(t * 0.83) * 0.055;
        guard.poop.scale.y = 1 + Math.sin(t * 1.67) * 0.018 + kick * 0.026;
      }
      if (guard.flush) guard.flush.rotation.x = Math.sin(t * 9.2) * 0.18;
      if (guard.beacon) {
        const flash = Math.pow(Math.max(0, Math.sin(t * 4.8)), 5);
        guard.beacon.light.intensity = 0.7 + flash * 8.5 + kick * 2.2;
        guard.beacon.dome.material.emissiveIntensity = 1.5 + flash * 4.8;
        guard.beacon.dome.rotation.y += dt * 4.2;
      }
    }
    if (z.animated.restroomPatrons) {
      const patrons = z.animated.restroomPatrons;
      for (let i = 0; i < patrons.peeing.length; i++) {
        const p = patrons.peeing[i];
        const sway = Math.sin(t * 1.35 + p.phase);
        p.group.position.y = Math.abs(sway) * 0.009;
        p.torso.rotation.z = sway * 0.018;
        p.head.rotation.y = Math.sin(t * 0.57 + p.phase) * 0.08;
        p.stream.material.opacity = 0.56 + Math.sin(t * 8.4 + p.phase) * 0.14;
        p.stream.scale.y = 0.92 + Math.sin(t * 6.7 + p.phase) * 0.08;
        for (let d = 0; d < p.drops.length; d++) {
          const progress = (t * 1.9 + p.phase + d * 0.23) % 1;
          const drop = p.drops[d];
          drop.position.x = -6.72 - progress * 0.57;
          drop.position.y = 0.72 - Math.sin(progress * Math.PI) * 0.055;
          drop.position.z = p.z + Math.sin(t * 5.1 + d) * 0.012;
          drop.scale.setScalar(0.72 + (1 - progress) * 0.42);
        }
      }
      const wash = patrons.washing;
      const scrub = Math.sin(t * 7.6);
      wash.arms[0].rotation.x = -0.92 + scrub * 0.14;
      wash.arms[1].rotation.x = -0.92 - scrub * 0.14;
      wash.head.rotation.z = Math.sin(t * 1.2) * 0.045;
      wash.group.position.y = Math.abs(Math.sin(t * 2.3)) * 0.008;
      const wait = patrons.waiting;
      wait.head.rotation.y = Math.sin(t * 0.74) * 0.46;
      wait.head.rotation.z = Math.sin(t * 0.42) * 0.055;
      wait.legs[0].rotation.x = Math.max(0, Math.sin(t * 4.8)) * 0.12;
      wait.group.position.y = Math.max(0, Math.sin(t * 4.8)) * 0.016;
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
        b.head.position.z = !attacking ? -impact * 0.055 : 0;
        b.shortsBody.rotation.y = Math.sin(pulse * 0.5) * 0.04;
        b.mouth.scale.y = 1 + (!attacking ? impact * 4.8 : 0);
        b.mouthguard.position.y = -0.096 - (!attacking ? impact * 0.022 : 0);
        b.mouthguard.rotation.z = !attacking ? b.direction * impact * 0.12 : 0;

        for (let armIndex = 0; armIndex < b.arms.length; armIndex++) {
          const arm = b.arms[armIndex];
          const throwing = attacking && armIndex === attackArm;
          arm.position.z = 0.04 + (throwing ? extend * 0.62 : 0);
          arm.position.y = 1.34 + (throwing ? extend * 0.04 : (!attacking ? impact * 0.08 : 0));
          arm.rotation.x = throwing ? -extend * 0.22 : -0.08;
          arm.rotation.y = throwing ? (armIndex ? -1 : 1) * extend * 0.16 : 0;
          const glovePulse = throwing ? extend * 0.1 : (!attacking ? impact * 0.06 : 0);
          b.gloves[armIndex].scale.setScalar(1 + glovePulse);
        }
        for (let legIndex = 0; legIndex < b.legs.length; legIndex++) {
          b.legs[legIndex].rotation.z = (legIndex ? 1 : -1) * (0.05 + Math.sin(pulse) * 0.035);
          b.legs[legIndex].rotation.x = Math.sin(pulse + legIndex * Math.PI) * 0.08;
        }
      }

      if (attackTime >= 0.94 && attackTime < 1.12 && z.animated.boxing?.lastImpactSlot !== slot) {
        z.animated.boxing.lastImpactSlot = slot;
        event = { type: 'boxingImpact', variant: slot % 3, victim: 1 - attackerIndex };
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
    if (z.animated.forestBoars) {
      for (const b of z.animated.forestBoars) {
        const a = t * b.speed + b.phase;
        const x = b.centerX + Math.cos(a) * b.radiusX;
        const zz = b.centerZ + Math.sin(a * 0.83) * b.radiusZ;
        const dx = -Math.sin(a) * b.radiusX * b.speed;
        const dz = Math.cos(a * 0.83) * b.radiusZ * b.speed * 0.83;
        b.group.position.set(x, Math.abs(Math.sin(t * 4.2 + b.bob)) * 0.025, zz);
        b.group.rotation.y = Math.atan2(dx, dz);
        b.group.rotation.z = Math.sin(t * 3.1 + b.bob) * 0.018;
      }
      z.animated.boarSqueakT -= dt;
      if (z.animated.boarSqueakT <= 0) {
        const variant = Math.floor((t * 7.3) % 4);
        z.animated.boarSqueakT = 0.48 + ((variant * 0.31) % 1.2);
        event = { type: 'boarSqueak', variant };
      }
    }
    if (z.animated.forestChurches) {
      let burningCount = 0;
      for (const church of z.animated.forestChurches) {
        if (!church.burning || !church.fx) continue;
        burningCount++;
        church.fireT += dt;
        const grow = clamp(church.fireT / 1.15, 0.05, 1);
        church.fx.light.intensity = grow * (7.4 + Math.sin(t * 19 + church.index) * 1.25);
        for (const flame of church.fx.flames) {
          const flicker = 0.72 + Math.sin(t * 14.5 + flame.userData.phase) * 0.2
            + Math.sin(t * 31 + flame.userData.phase * 1.7) * 0.08;
          flame.scale.set(grow * flicker, grow * (0.76 + flicker * 0.48), grow * flicker);
          flame.position.y = flame.userData.baseY + Math.sin(t * 11 + flame.userData.phase) * 0.1;
          flame.material.opacity = 0.68 + flicker * 0.2;
          flame.rotation.y += dt * 1.4;
        }
        for (const puff of church.fx.smoke) {
          const p = (church.fireT * puff.speed + puff.phase) % 1;
          puff.sprite.position.y = 2.6 + p * 7.5;
          puff.sprite.position.x = puff.drift * p + Math.sin(t * 0.52 + puff.phase * 8) * 0.28;
          puff.sprite.material.opacity = grow * Math.sin(p * Math.PI) * 0.38;
          const size = 1.25 + p * 3.8;
          puff.sprite.scale.set(size, size, 1);
        }
        for (const mesh of church.burnMeshes) {
          if (mesh.material.color) mesh.material.color.lerp(CHAR_COLOR, dt * 0.008);
        }
      }
      if (burningCount) {
        z.animated.churchCrackleT -= dt;
        if (z.animated.churchCrackleT <= 0) {
          z.animated.churchCrackleT = rand(0.18, 0.52) / Math.min(2.2, 0.8 + burningCount * 0.18);
          event = { type: 'churchCrackle', variant: Math.floor((t * 13 + burningCount) % 4), burningCount };
        }
      }
    }
    if (z.animated.forestFog) {
      for (const bank of z.animated.forestFog) {
        bank.sprite.position.x += dt * bank.speed;
        bank.sprite.position.y += Math.sin(t * 0.31 + bank.phase) * dt * 0.035;
        if (bank.sprite.position.x > 23) bank.sprite.position.x = -23;
      }
    }
    return event;
  }
}
