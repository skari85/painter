/**
 * state.js — the single source of truth for run state.
 *
 * Run state (meters, virtues, flags, paintings) resets every playthrough.
 * Meta state (settings, unlocked endings) persists to localStorage.
 *
 * Everything mutates through methods that emit events — the UI never polls.
 */

import { Emitter, clamp } from './utils.js';
import { METERS, VIRTUES, VIRTUE_START, VIRTUE_MIN, VIRTUE_MAX, STORAGE } from './config.js';

export class GameState extends Emitter {
  constructor() {
    super();
    this.reset();
  }

  reset() {
    this.night = 1;
    this.meters = Object.fromEntries(
      Object.entries(METERS).map(([k, m]) => [k, m.start])
    );
    this.virtues = Object.fromEntries(VIRTUES.map((v) => [v.key, VIRTUE_START]));
    this.flags = new Map();
    this.clues = new Set();
    this.items = new Map();      // run-only side-quest inventory
    this.paintings = [];        // { id, title, texture, quality, sold, lotNumber, storyTags }
    this.carrying = null;       // painting id
    this.nightLog = [];         // rows for the end-of-night summary
    this.stats = { duelsWon: 0, meltdowns: 0, splats: 0, paintingsMade: 0, sold: 0, refused: 0 };
    this.emit('reset');
  }

  /* ---------------- meters ---------------- */

  addMeter(key, delta, reason = '') {
    if (!(key in this.meters)) return;
    const def = METERS[key];
    const next = clamp(this.meters[key] + delta, def.min, def.max);
    const applied = next - this.meters[key];
    this.meters[key] = next;
    if (applied !== 0) {
      this.emit('meter', { key, value: next, delta: applied, reason });
      if (Math.abs(applied) >= 1) {
        this.nightLog.push({ label: reason || key, delta: applied, meter: key });
      }
    }
    return applied;
  }

  get heatMaxed() { return this.meters.heat >= METERS.heat.max; }

  /* ---------------- virtues ---------------- */

  shiftVirtue(key, delta, reason = '') {
    if (!(key in this.virtues)) return;
    const next = clamp(this.virtues[key] + delta, VIRTUE_MIN, VIRTUE_MAX);
    const applied = next - this.virtues[key];
    this.virtues[key] = next;
    if (applied !== 0) this.emit('virtue', { key, value: next, delta: applied, reason });
    return applied;
  }

  get virtueAverage() {
    const vals = Object.values(this.virtues);
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  /* ---------------- flags ---------------- */

  setFlag(key, value = true) {
    if (this.flags.get(key) === value) return;
    this.flags.set(key, value);
    this.emit('flag', { key, value });
  }
  getFlag(key) { return this.flags.get(key) ?? false; }

  /* ---------------- side-quest inventory ---------------- */

  addItem(key, label = key) {
    if (this.items.has(key)) return false;
    this.items.set(key, label);
    this.nightLog.push({ label: `Received ${label}`, delta: null, item: key });
    this.emit('item', { key, label, action: 'added' });
    return true;
  }

  removeItem(key) {
    if (!this.items.has(key)) return false;
    const label = this.items.get(key);
    this.items.delete(key);
    this.emit('item', { key, label, action: 'removed' });
    return true;
  }

  hasItem(key) { return this.items.has(key); }

  /* ---------------- narrative memory ---------------- */

  discoverClue(key, label = '') {
    if (this.clues.has(key)) return false;
    this.clues.add(key);
    const text = label || 'The room has started keeping records.';
    this.nightLog.push({ label: text, delta: null, clue: key });
    this.emit('clueFound', { key, label: text, count: this.clues.size });
    return true;
  }

  hasClue(key) { return this.clues.has(key); }
  get clueCount() { return this.clues.size; }
  storyContext() { return [...this.clues]; }

  /* ---------------- paintings ---------------- */

  addPainting(p) {
    this.paintings.push(p);
    this.stats.paintingsMade++;
    this.emit('paintings');
  }

  getPainting(id) { return this.paintings.find((p) => p.id === id) ?? null; }

  unsoldPaintings() { return this.paintings.filter((p) => !p.sold); }

  /* ---------------- night log ---------------- */

  record(label, delta = null) {
    this.nightLog.push({ label, delta });
  }

  drainNightLog() {
    const log = this.nightLog.slice(-8);
    this.nightLog = [];
    return log;
  }
}

/* ============================================================
   Meta persistence — settings & unlocked endings.
   Fail-soft: private browsing / full storage must never crash.
   ============================================================ */

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? { ...fallback, ...parsed }
      : { ...fallback };
  } catch { return { ...fallback }; }
}

function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* fail-soft */ }
}

const defaultSettings = () => ({
  sens: 1,
  vol: 0.8,
  quality: 1,
  reduceMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  invertY: false,
});

const defaultMeta = () => ({
  lastVisit: '', streak: 0, visits: 0, cowVisits: 0, completedDays: [],
});

export function loadSettings() {
  return read(STORAGE.settings, defaultSettings());
}

export function saveSettings(settings) {
  write(STORAGE.settings, settings);
}

export function loadEndings() {
  try {
    const raw = localStorage.getItem(STORAGE.endings);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function unlockEnding(key) {
  const list = loadEndings();
  if (!list.includes(key)) {
    list.push(key);
    write(STORAGE.endings, list);
  }
  return list;
}

/** Local calendar stamp used for the daily malfunction and return streak. */
export function dayStamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function loadMeta() {
  const meta = read(STORAGE.meta, defaultMeta());
  return {
    ...defaultMeta(),
    ...meta,
    streak: Number.isFinite(meta.streak) ? Math.max(0, meta.streak) : 0,
    visits: Number.isFinite(meta.visits) ? Math.max(0, meta.visits) : 0,
    cowVisits: Number.isFinite(meta.cowVisits) ? Math.max(0, meta.cowVisits) : 0,
    completedDays: Array.isArray(meta.completedDays) ? meta.completedDays.filter((d) => typeof d === 'string') : [],
  };
}

export function registerVisit() {
  const meta = loadMeta();
  const today = dayStamp();
  if (meta.lastVisit !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    meta.streak = meta.lastVisit === dayStamp(yesterday) ? meta.streak + 1 : 1;
    meta.lastVisit = today;
    meta.visits++;
    write(STORAGE.meta, meta);
  }
  return meta;
}

export function recordCowVisit() {
  const meta = loadMeta();
  meta.cowVisits++;
  write(STORAGE.meta, meta);
  return meta.cowVisits;
}

export function dailyComplete(stamp = dayStamp()) {
  return loadMeta().completedDays.includes(stamp);
}

export function completeDaily(stamp = dayStamp()) {
  const meta = loadMeta();
  if (!meta.completedDays.includes(stamp)) {
    meta.completedDays = [...meta.completedDays.slice(-29), stamp];
    write(STORAGE.meta, meta);
  }
  return meta;
}
