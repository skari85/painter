/**
 * utils.js — shared primitives.
 * Zero dependencies. Imported by nearly every module.
 */

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const lerp = (a, b, t) => a + (b - a) * t;

/** Frame-rate independent exponential smoothing. */
export const damp = (current, target, lambda, dt) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

export const rand = (min = 0, max = 1) => min + Math.random() * (max - min);
export const randInt = (min, max) => Math.floor(rand(min, max + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p) => Math.random() < p;

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Deterministic RNG for content that should feel hand-placed. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const formatSigned = (n) => (n > 0 ? `+${n}` : `${n}`);

/** Escape user-supplied strings before they touch innerHTML.
 *  (Entities built by concatenation so source stays entity-literal-free.) */
export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&' + 'amp;',
    '<': '&' + 'lt;',
    '>': '&' + 'gt;',
    '"': '&' + 'quot;',
    "'": '&' + '#39;',
  }[c]));
}


/**
 * Minimal typed event bus.
 * Modules publish intentions; nothing reaches into anything else's guts.
 */
export class Emitter {
  #map = new Map();

  on(event, fn) {
    if (!this.#map.has(event)) this.#map.set(event, new Set());
    this.#map.get(event).add(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    this.#map.get(event)?.delete(fn);
  }

  emit(event, payload) {
    this.#map.get(event)?.forEach((fn) => {
      try { fn(payload); }
      catch (err) { console.error(`[events] handler for "${event}" failed`, err); }
    });
  }

  clear() { this.#map.clear(); }
}
