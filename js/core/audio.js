/**
 * audio.js — fully procedural WebAudio sound. No assets, no files.
 *
 * The context is created lazily on the first user gesture (autoplay policy).
 * Every method is safe to call before that: they simply no-op.
 */

import { clamp, rand, pick } from './utils.js';
import { MUSIC_LEVEL } from './config.js';


/* Vowel formant pairs (F1, F2) — the mumble alphabet: a, e, i, o, u. */
const VOWELS = [[730, 1090], [530, 1840], [270, 2290], [570, 840], [300, 870]];



const MOODS = {
  garret:   { freqs: [110, 164.8, 220], cutoff: 640,  gain: 0.05 },
  collectorHome: { freqs: [196, 246.9, 392], cutoff: 1400, gain: 0.028 },
  galleria: { freqs: [146.8, 220, 293.7], cutoff: 900, gain: 0.035 },
  vault:    { freqs: [55, 82.4, 110], cutoff: 380,   gain: 0.07 },
  off:      { freqs: [], cutoff: 400, gain: 0 },
};

export class AudioEngine {
  #ctx = null;
  #master = null;
  #noiseBuffer = null;
  #moodNodes = null;
  #volume = 0.8;
  #stepFlip = false;
  #music = null;
  #musicKey = null;
  #musicTarget = 0;
  #fadeTimer = null;


  /** Must be called from a user-gesture handler at least once. */
  ensure() {
    if (this.#ctx) {
      if (this.#ctx.state === 'suspended') this.#ctx.resume();
      return;
    }
    try {
      this.#ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.#master = this.#ctx.createGain();
      this.#master.gain.value = this.#volume;
      this.#master.connect(this.#ctx.destination);

      const len = this.#ctx.sampleRate * 1.2;
      this.#noiseBuffer = this.#ctx.createBuffer(1, len, this.#ctx.sampleRate);
      const data = this.#noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch {
      this.#ctx = null; // audio is a garnish, never a dependency
    }
    // if music was requested before the first gesture, retry now
    if (this.#music?.paused) this.#music.play().catch(() => {});
  }

  setVolume(v) {
    this.#volume = clamp(v, 0, 1);
    if (this.#master) this.#master.gain.value = this.#volume;
    this.#musicTarget = this.#volume * MUSIC_LEVEL;
    if (this.#music) this.#music.volume = Math.min(this.#music.volume, this.#musicTarget);
  }

  /* ---------------- music (the record collection) ---------------- */

  /** Crossfade to a track (key into MUSIC map), or null to stop. Fail-soft. */
  setMusic(key, tracks) {
    if (this.#musicKey === key) return;
    this.#stopMusic();
    this.#musicKey = key;
    if (!key || !tracks?.[key]) return;
    try {
      const a = new Audio(encodeURI(tracks[key]));
      a.loop = true;
      a.volume = 0;
      a.addEventListener('error', () => { if (this.#music === a) this.#music = null; });
      this.#music = a;
      this.#musicTarget = this.#volume * MUSIC_LEVEL;
      const p = a.play();
      if (p?.catch) p.catch(() => {});   // pre-gesture: ensure() will retry
      this.#fadeMusic();
    } catch { /* music is a garnish, never a dependency */ }
  }

  #fadeMusic() {
    clearInterval(this.#fadeTimer);
    this.#fadeTimer = setInterval(() => {
      if (!this.#music) { clearInterval(this.#fadeTimer); return; }
      const cur = this.#music.volume;
      const diff = this.#musicTarget - cur;
      if (Math.abs(diff) <= 0.03) { this.#music.volume = this.#musicTarget; clearInterval(this.#fadeTimer); }
      else this.#music.volume = clamp(cur + Math.sign(diff) * 0.03, 0, 1);
    }, 50);
  }

  #stopMusic() {
    clearInterval(this.#fadeTimer);
    if (!this.#music) { this.#musicKey = null; return; }
    const a = this.#music;
    this.#music = null;
    this.#musicKey = null;
    const t = setInterval(() => {
      a.volume = Math.max(0, a.volume - 0.08);
      if (a.volume <= 0) { a.pause(); clearInterval(t); }
    }, 40);
  }


  get ready() { return !!this.#ctx; }
  get ctx() { return this.#ctx; }
  get master() { return this.#master; }
  get musicKey() { return this.#musicKey; }


  /* ---------------- primitives ---------------- */

  #env(gain, peak, attack, decay) {
    const t = this.#ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  #tone({ freq = 440, freqEnd = null, type = 'sine', peak = 0.2, attack = 0.005, decay = 0.15 }) {
    if (!this.#ctx) return;
    const osc = this.#ctx.createOscillator();
    const g = this.#ctx.createGain();
    osc.type = type;
    const t = this.#ctx.currentTime;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t + decay);
    this.#env(g, peak, attack, decay);
    osc.connect(g).connect(this.#master);
    osc.start(t);
    osc.stop(t + attack + decay + 0.05);
  }

  #noise({ peak = 0.3, attack = 0.004, decay = 0.2, filterFreq = 1200, filterEnd = null, q = 1, type = 'lowpass' }) {
    if (!this.#ctx) return;
    const src = this.#ctx.createBufferSource();
    src.buffer = this.#noiseBuffer;
    src.loop = true;
    const filter = this.#ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    const t = this.#ctx.currentTime;
    filter.frequency.setValueAtTime(filterFreq, t);
    if (filterEnd) filter.frequency.exponentialRampToValueAtTime(Math.max(filterEnd, 20), t + decay);
    const g = this.#ctx.createGain();
    this.#env(g, peak, attack, decay);
    src.connect(filter).connect(g).connect(this.#master);
    src.start(t, rand(0, 0.8));
    src.stop(t + attack + decay + 0.05);
  }

  /* ---------------- game verbs ---------------- */

  uiMove()    { this.#tone({ freq: 1150, type: 'sine', peak: 0.06, decay: 0.05 }); }
  uiConfirm() { this.#tone({ freq: 740, type: 'sine', peak: 0.09, decay: 0.09 });
                this.#tone({ freq: 1110, type: 'sine', peak: 0.07, decay: 0.12 }); }

  swing() {
    this.#noise({ peak: 0.16, decay: 0.16, filterFreq: 3400, filterEnd: 500, q: 2.5, type: 'bandpass' });
  }

  splat() {
    this.#noise({ peak: 0.34, decay: 0.13, filterFreq: 900, filterEnd: 180 });
    this.#tone({ freq: 190, freqEnd: 60, type: 'triangle', peak: 0.2, decay: 0.12 });
  }

  hitmarker(brutal = false) {
    this.#tone({ freq: brutal ? 1560 : 2100, type: 'square', peak: 0.07, decay: 0.045 });
    if (brutal) this.#tone({ freq: 780, type: 'square', peak: 0.05, decay: 0.06 });
  }

  shatter() {
    [1320, 990, 660, 440].forEach((f, i) =>
      setTimeout(() => this.#tone({ freq: f, type: 'triangle', peak: 0.14, decay: 0.3 }), i * 70));
    this.#noise({ peak: 0.24, decay: 0.5, filterFreq: 5200, filterEnd: 300, q: 0.8, type: 'highpass' });
  }

  countered() {
    this.#tone({ freq: 220, freqEnd: 110, type: 'sawtooth', peak: 0.14, decay: 0.28 });
  }

  gasp() {
    this.#tone({ freq: 380, freqEnd: 760, type: 'sine', peak: 0.1, decay: 0.18 });
  }

  /** A mumble-voice syllable: buzzy glottal saw → throat → two vowel formants. */
  talkBlip(pitch = 1) {
    if (!this.#ctx) return;
    const t = this.#ctx.currentTime;
    const dur = rand(0.07, 0.12);
    const f0 = 118 * pitch * rand(0.94, 1.06);

    const osc = this.#ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f0 * rand(0.9, 0.98), t);
    osc.frequency.exponentialRampToValueAtTime(f0, t + dur);

    const throat = this.#ctx.createBiquadFilter();
    throat.type = 'lowpass';
    throat.frequency.value = 2400;
    throat.Q.value = 0.5;

    const voice = this.#ctx.createGain();
    voice.gain.setValueAtTime(0.0001, t);
    voice.gain.exponentialRampToValueAtTime(0.38, t + 0.02);
    voice.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(throat);
    const [f1, f2] = pick(VOWELS);
    for (const f of [f1, f2]) {
      const bp = this.#ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f * rand(0.97, 1.03);
      bp.Q.value = 7;
      throat.connect(bp).connect(voice);
    }
    voice.connect(this.#master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  footstep() {
    this.#stepFlip = !this.#stepFlip;
    this.#noise({ peak: 0.05, decay: 0.07, filterFreq: this.#stepFlip ? 500 : 420 });
  }

  pickup() {
    this.#tone({ freq: 520, type: 'triangle', peak: 0.1, decay: 0.1 });
    this.#tone({ freq: 780, type: 'triangle', peak: 0.08, decay: 0.16 });
  }

  banSting() {
    this.#tone({ freq: 160, freqEnd: 80, type: 'sawtooth', peak: 0.2, decay: 0.7 });
    this.#noise({ peak: 0.14, decay: 0.6, filterFreq: 300 });
  }

  /** Tabloid slam: two dissonant thuds and a paparazzi flash. */
  scandal() {
    this.#tone({ freq: 92, freqEnd: 46, type: 'sawtooth', peak: 0.22, decay: 0.5 });
    this.#tone({ freq: 98, freqEnd: 49, type: 'sawtooth', peak: 0.18, decay: 0.5 });
    this.#noise({ peak: 0.16, decay: 0.08, filterFreq: 6200, type: 'highpass' });
  }

  /** The gift shop till: two bright pings and a drawer. */
  register() {
    this.#tone({ freq: 990, type: 'triangle', peak: 0.12, decay: 0.12 });
    this.#tone({ freq: 1320, type: 'triangle', peak: 0.1, decay: 0.2 });
    setTimeout(() => this.#noise({ peak: 0.1, decay: 0.08, filterFreq: 2600 }), 90);
  }

  /** ARTI wants attention: two impatient phone buzzes. */
  buzz() {
    this.#tone({ freq: 185, type: 'square', peak: 0.07, decay: 0.08 });
    setTimeout(() => this.#tone({ freq: 160, type: 'square', peak: 0.07, decay: 0.12 }), 110);
  }

  /** Ghostly shimmer for the séance. */
  spirit() {
    if (!this.#ctx) return;
    [660, 990, 1320].forEach((f, i) =>
      setTimeout(() => this.#tone({ freq: f * rand(0.98, 1.02), type: 'sine', peak: 0.06, attack: 0.25, decay: 1.4 }), i * 120));
    this.#noise({ peak: 0.04, attack: 0.4, decay: 1.6, filterFreq: 4000, filterEnd: 800, type: 'highpass' });
  }

  nightChime() {

    [523, 659, 784].forEach((f, i) =>
      setTimeout(() => this.#tone({ freq: f, type: 'sine', peak: 0.1, decay: 0.7 }), i * 160));
  }

  /* ---------------- ambient drone ---------------- */

  setMood(name) {
    if (!this.#ctx) return;
    const mood = MOODS[name] ?? MOODS.off;
    const t = this.#ctx.currentTime;

    if (this.#moodNodes) {
      const { gain, oscs } = this.#moodNodes;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setTargetAtTime(0.0001, t, 0.6);
      oscs.forEach((o) => o.stop(t + 2.5));
      this.#moodNodes = null;
    }
    if (!mood.freqs.length) return;

    const gain = this.#ctx.createGain();
    gain.gain.value = 0.0001;
    gain.gain.setTargetAtTime(mood.gain, t, 1.2);
    const filter = this.#ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = mood.cutoff;
    const oscs = mood.freqs.map((f) => {
      const o = this.#ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.detune.value = rand(-6, 6);
      o.connect(filter);
      o.start(t);
      return o;
    });
    filter.connect(gain).connect(this.#master);
    this.#moodNodes = { gain, oscs };
  }
}

