/**
 * paint.js — two kinds of painting.
 *
 * 1. WORLD SPLATTER — LMB swing flings pigment. One GPU point pool
 *    (custom shader, per-particle life/size/color) + permanent decals
 *    via world.addSplat. Zero per-frame allocation.
 *
 * 2. THE EASEL — an overlay where the mouse lays real pigment on a
 *    2D canvas. Coverage, colour variety and unbroken-stroke "flow"
 *    score the finished piece. The texture becomes the 3D painting
 *    you carry under your arm.
 */

import * as THREE from 'three';
import { Emitter, clamp, rand } from '../core/utils.js';
import { PAINT } from '../core/config.js';

/* ============================================================
   Particle pool
   ============================================================ */

const MAX_PARTICLES = 640;

class SplashPool {
  #pos = new Float32Array(MAX_PARTICLES * 3);
  #vel = new Float32Array(MAX_PARTICLES * 3);
  #col = new Float32Array(MAX_PARTICLES * 3);
  #life = new Float32Array(MAX_PARTICLES);
  #size = new Float32Array(MAX_PARTICLES);
  #cursor = 0;
  #color = new THREE.Color();

  constructor() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.#pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.#col, 3));
    geo.setAttribute('aLife', new THREE.BufferAttribute(this.#life, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.#size, 1));

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */`
        attribute vec3 aColor;
        attribute float aLife;
        attribute float aSize;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = aColor;
          vAlpha = clamp(aLife * 1.8, 0.0, 1.0);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (140.0 / -mv.z) * clamp(aLife + 0.3, 0.0, 1.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          if (d > 0.5 || vAlpha <= 0.01) discard;
          float soft = smoothstep(0.5, 0.32, d);
          gl_FragColor = vec4(vColor, vAlpha * soft);
        }`,
    });

    this.points = new THREE.Points(geo, material);
    this.points.frustumCulled = false;
  }

  burst(origin, normal, colorHex, count = 22) {
    this.#color.set(colorHex);
    for (let n = 0; n < count; n++) {
      const i = this.#cursor;
      this.#cursor = (this.#cursor + 1) % MAX_PARTICLES;
      const i3 = i * 3;
      this.#pos[i3] = origin.x + rand(-0.05, 0.05);
      this.#pos[i3 + 1] = origin.y + rand(-0.05, 0.05);
      this.#pos[i3 + 2] = origin.z + rand(-0.05, 0.05);
      // cone around the surface normal + a little chaos
      this.#vel[i3]     = normal.x * rand(0.4, 1.4) + rand(-0.9, 0.9);
      this.#vel[i3 + 1] = normal.y * rand(0.4, 1.4) + rand(0.2, 1.2);
      this.#vel[i3 + 2] = normal.z * rand(0.4, 1.4) + rand(-0.9, 0.9);
      this.#col[i3]     = this.#color.r * rand(0.8, 1.1);
      this.#col[i3 + 1] = this.#color.g * rand(0.8, 1.1);
      this.#col[i3 + 2] = this.#color.b * rand(0.8, 1.1);
      this.#life[i] = rand(0.35, 0.8);
      this.#size[i] = rand(2.2, 5.5);
    }
  }

  update(dt) {
    const g = 4.4 * dt;
    let alive = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.#life[i] <= 0) continue;
      alive = true;
      this.#life[i] -= dt;
      const i3 = i * 3;
      this.#vel[i3 + 1] -= g;
      this.#pos[i3] += this.#vel[i3] * dt;
      this.#pos[i3 + 1] += this.#vel[i3 + 1] * dt;
      this.#pos[i3 + 2] += this.#vel[i3 + 2] * dt;
      if (this.#pos[i3 + 1] < 0.01) { this.#pos[i3 + 1] = 0.01; this.#life[i] -= dt * 3; }
    }
    if (alive) {
      this.points.geometry.attributes.position.needsUpdate = true;
      this.points.geometry.attributes.aLife.needsUpdate = true;
      this.points.geometry.attributes.aColor.needsUpdate = true;
      this.points.geometry.attributes.aSize.needsUpdate = true;
    }
    this.points.visible = alive;
  }
}

/* ============================================================
   The easel overlay
   ============================================================ */

export class PaintSystem extends Emitter {
  #ui;               // lazy DOM refs
  #ctx;
  #painting = false;
  #last = null;
  #strokeLength = 0;
  #colorsUsed = new Set();
  #peakFlow = 0;
  #raf = null;

  constructor() {
    super();
    this.pool = new SplashPool();
    this.isOpen = false;
    this.colorIndex = 4;                       // pigment gold
    this.brushIndex = PAINT.defaultBrushIndex;
    this.flow = 0;
    this.#bindOverlay();
  }

  get color() { return PAINT.palette[this.colorIndex]; }
  get brushSize() { return PAINT.brushSizes[this.brushIndex]; }

  attachTo(group) {
    group.add(this.pool.points);
  }

  /* ---------------- world splatter ---------------- */

  splatFromRay(raycaster, world) {
    const hit = world.raycastSplat(raycaster);
    if (!hit) return null;
    const normal = hit.face.normal.clone()
      .transformDirection(hit.object.matrixWorld).normalize();
    world.addSplat(hit.point, normal, this.color);
    this.pool.burst(hit.point, normal, this.color);
    return hit;
  }

  /** Splatter an NPC: burst at chest height in front of them. */
  splatOnNPC(npc) {
    const p = npc.group.position.clone();
    p.y = 1.25;
    const away = new THREE.Vector3(rand(-0.3, 0.3), 0.5, rand(-0.3, 0.3)).normalize();
    this.pool.burst(p, away, this.color, 26);
    npc.attachSplat(this.color);
  }

  update(dt) { this.pool.update(dt); }

  /* ---------------- easel overlay ---------------- */

  #bindOverlay() {
    const $ = (id) => document.getElementById(id);
    this.#ui = {
      root: $('easel'),
      canvas: $('paint-canvas'),
      palette: $('palette'),
      flow: $('flow-fill'),
      brushPreview: $('brush-preview'),
      clear: $('easel-clear'),
      finish: $('easel-finish'),
    };
    this.#ctx = this.#ui.canvas.getContext('2d', { willReadFrequently: true });

    // palette swatches
    PAINT.palette.forEach((hex, i) => {
      const b = document.createElement('button');
      b.className = 'swatch';
      b.style.background = hex;
      b.setAttribute('aria-label', `Colour ${i + 1}`);
      b.addEventListener('click', () => this.setColor(i));
      this.#ui.palette.appendChild(b);
    });
    this.#ui.palette.children[this.colorIndex].classList.add('active');

    this.#ui.clear.addEventListener('click', () => this.#prime());
    this.#ui.finish.addEventListener('click', () => this.#finish());

    // stroke input
    const posOf = (e) => {
      const r = this.#ui.canvas.getBoundingClientRect();
      return {
        x: (e.clientX - r.left) * (this.#ui.canvas.width / r.width),
        y: (e.clientY - r.top) * (this.#ui.canvas.height / r.height),
      };
    };
    this.#ui.canvas.addEventListener('pointerdown', (e) => {
      this.#ui.canvas.setPointerCapture(e.pointerId);
      this.#painting = true;
      this.#last = posOf(e);
      this.#dot(this.#last);
    });
    this.#ui.canvas.addEventListener('pointermove', (e) => {
      if (!this.#painting) return;
      const p = posOf(e);
      this.#stroke(this.#last, p);
      this.#last = p;
    });
    const up = () => { this.#painting = false; };
    this.#ui.canvas.addEventListener('pointerup', up);
    this.#ui.canvas.addEventListener('pointercancel', up);
  }

  setColor(i) {
    this.colorIndex = clamp(i, 0, PAINT.palette.length - 1);
    for (const [j, el] of [...this.#ui.palette.children].entries()) {
      el.classList.toggle('active', j === this.colorIndex);
    }
    this.emit('color', this.color);
  }

  adjustBrush(dir) {
    this.brushIndex = clamp(this.brushIndex + dir, 0, PAINT.brushSizes.length - 1);
    this.#ui.brushPreview.style.setProperty('--dot', `${6 + this.brushIndex * 6}px`);
  }

  open() {
    this.isOpen = true;
    this.#ui.root.classList.remove('hidden');
    this.#prime();
    this.#loopStart();
    this.emit('color', this.color);
  }

  close() {
    this.isOpen = false;
    this.#ui.root.classList.add('hidden');
    if (this.#raf) cancelAnimationFrame(this.#raf);
    this.#raf = null;
  }

  #prime() {
    const { canvas } = this.#ui;
    const g = this.#ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, '#f2ecdf');
    g.addColorStop(1, '#e6ddca');
    this.#ctx.fillStyle = g;
    this.#ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.#colorsUsed.clear();
    this.#strokeLength = 0;
    this.#peakFlow = 0;
    this.flow = 0;
  }

  #dot(p) {
    this.#ctx.fillStyle = this.color;
    this.#ctx.beginPath();
    this.#ctx.arc(p.x, p.y, this.brushSize / 2, 0, Math.PI * 2);
    this.#ctx.fill();
    this.#colorsUsed.add(this.colorIndex);
  }

  #stroke(a, b) {
    const ctx = this.#ctx;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // occasional drip — gravity leaves evidence
    if (Math.random() < 0.05) {
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = Math.max(2, this.brushSize * 0.18);
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x + rand(-2, 2), b.y + rand(10, 42));
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    this.#strokeLength += Math.hypot(b.x - a.x, b.y - a.y);
    this.#colorsUsed.add(this.colorIndex);
  }

  #loopStart() {
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (this.#painting) {
        this.flow = clamp(this.flow + PAINT.flowBuildRate * dt, 0, 1);
        this.#peakFlow = Math.max(this.#peakFlow, this.flow);
      } else {
        this.flow = clamp(this.flow - PAINT.flowDecayRate * dt, 0, 1);
      }
      this.#ui.flow.style.width = `${Math.round(this.flow * 100)}%`;
      this.#raf = requestAnimationFrame(tick);
    };
    this.#raf = requestAnimationFrame(tick);
  }

  #finish() {
    const { canvas } = this.#ui;
    // coverage: sample every 12th pixel against the primer
    const { data } = this.#ctx.getImageData(0, 0, canvas.width, canvas.height);
    let painted = 0, total = 0;
    for (let i = 0; i < data.length; i += 4 * 144) {
      total++;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (Math.abs(r - 0xee) > 14 || Math.abs(g - 0xe9) > 14 || Math.abs(b - 0xdc) > 16) painted++;
    }
    const coverage = clamp(painted / total / 0.55, 0, 1);
    const variety = clamp(this.#colorsUsed.size / 7, 0, 1);
    const flow = this.#peakFlow;
    const w = PAINT.qualityWeights;
    const quality = Math.round(coverage * w.coverage + variety * w.variety + flow * w.flow);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    this.close();
    this.emit('finished', { texture, quality });
  }
}
