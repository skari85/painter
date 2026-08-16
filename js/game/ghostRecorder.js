/**
 * ghostRecorder.js — silently records the local player's own path through
 * each zone, and flushes it (with an optional left note) to the ghosts
 * worker so a future player can see where you walked.
 *
 * Fire-and-forget: nothing here can fail loudly. If the network is down,
 * recordings are just dropped on flush.
 */

import { uploadGhost } from '../core/network.js';

const SAMPLE_INTERVAL = 1;      // seconds between recorded points
const MAX_POINTS = 150;         // ~2.5 minutes of path at the sample rate above
const AUTO_FLUSH_INTERVAL = 60; // seconds
const PALETTE_KEY = 'painter.ghostPalette';

function randomByte() { return Math.floor(Math.random() * 256); }
function randomColor() { return (randomByte() << 16) | (randomByte() << 8) | randomByte(); }

/** A stable-per-browser look for this player's own ghosts, cached in localStorage. */
function loadOrCreatePalette() {
  try {
    const raw = localStorage.getItem(PALETTE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && [p.skin, p.hair, p.top, p.bottom].every((v) => typeof v === 'number')) return p;
    }
  } catch { /* fail-soft — fall through to generating a fresh one */ }

  const palette = { skin: randomColor(), hair: randomColor(), top: randomColor(), bottom: randomColor() };
  try { localStorage.setItem(PALETTE_KEY, JSON.stringify(palette)); } catch { /* private browsing etc */ }
  return palette;
}

export class GhostRecorder {
  #palette = loadOrCreatePalette();
  #zoneKey = null;
  #buffer = [];
  #sampleT = 0;
  #flushT = 0;
  #elapsed = 0;
  #note = null;

  get palette() { return this.#palette; }

  /** Called whenever the current player types a note to leave for others. */
  setNote(text) {
    this.#note = text ? text.slice(0, 140) : null;
  }

  /** Call whenever the world's zone changes. Flushes the previous zone's path first. */
  onZoneChange(zoneKey) {
    this.#flush();
    this.#zoneKey = zoneKey;
    this.#buffer = [];
    this.#sampleT = 0;
    this.#flushT = 0;
    this.#elapsed = 0;
  }

  /** Call once per frame with dt and the PlayerController. */
  tick(dt, player) {
    if (!this.#zoneKey) return;
    this.#elapsed += dt;
    this.#sampleT += dt;
    this.#flushT += dt;

    if (this.#sampleT >= SAMPLE_INTERVAL && this.#buffer.length < MAX_POINTS) {
      this.#sampleT = 0;
      const { x, y, z } = player.position;
      this.#buffer.push({ t: this.#elapsed, x, y, z, yaw: player.yaw });
    }

    if (this.#flushT >= AUTO_FLUSH_INTERVAL) {
      this.#flush();
      this.#buffer = [];
      this.#sampleT = 0;
      this.#flushT = 0;
      this.#elapsed = 0;
    }
  }

  #flush() {
    if (!this.#zoneKey || this.#buffer.length === 0) return;
    uploadGhost({
      zoneKey: this.#zoneKey,
      palette: this.#palette,
      path: this.#buffer,
      note: this.#note,
    });
    this.#note = null;
  }
}
