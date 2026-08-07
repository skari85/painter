/**
 * audio.js — fully procedural WebAudio sound. No assets, no files.
 *
 * The context is created lazily on the first user gesture (autoplay policy).
 * Every method is safe to call before that: they simply no-op.
 */

import { clamp, rand } from './utils.js';

const MOODS = {
  garret:   { freqs: [110, 164.8, 220], cutoff: 640,  gain: 0.05 },
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
  }

  setVolume(v) {
    this.#volume = clamp(v, 0, 1);
    if (this.#master) this.#master.gain.value = this.#volume;
  }

  get ready() { return !!this.#ctx; }

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

  talkBlip(pitch = 1) {
    this.#tone({ freq: 300 * pitch * rand(0.92, 1.08), type: 'square', peak: 0.035, decay: 0.045 });
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
