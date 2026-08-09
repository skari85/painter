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
  garret:      { freqs: [110, 164.8, 220], cutoff: 640,  gain: 0.05 },
  leatherLatex: { freqs: [196, 246.9, 392], cutoff: 1400, gain: 0.028 },
  galleria:    { freqs: [146.8, 220, 293.7], cutoff: 900, gain: 0.035 },
  vault:       { freqs: [55, 82.4, 110], cutoff: 380,   gain: 0.07 },
  off:         { freqs: [], cutoff: 400, gain: 0 },
};

/* The leather room's rig: 4-on-the-floor at 126 BPM, murk in A minor. */
const TECHNO = {
  bpm: 126,
  root: 55,                                   // A1 — the rumble lives here
  pad: [110, 130.8, 164.8, 196],              // Am add7-ish smear
  bassPattern: [0, 0, 12, 0, 7, 0, 3, 0],     // semitone offsets per 8th
  level: 0.5,
  // through-the-wall voicing: the same loop, heard from the hallway
  muffleCutoff: 210,
  muffleLevel: 0.22,
};

export const TECHNO_BPM = TECHNO.bpm;   // the world pulses in time

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
  #techno = null;      // { gain, timer } while the leather room is playing
  #technoStep = 0;


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

  /* ---------------- the leather room ---------------- */

  /**
   * Start the murky 4-on-the-floor loop (126 BPM). Idempotent, fail-soft.
   * A lookahead scheduler books one 16th-note per tick into the WebAudio
   * clock so the groove stays tight even if the tab stutters.
   */
  startTechno() {
    if (!this.#ctx || this.#techno) return;
    const t = this.#ctx.currentTime;

    // door filter: the whole rig sits behind this. Wide open inside the
    // leather room; from the hallway it clamps to a low sub thud.
    const doorFilter = this.#ctx.createBiquadFilter();
    doorFilter.type = 'lowpass';
    doorFilter.frequency.value = 19000;
    doorFilter.Q.value = 0.4;
    doorFilter.connect(this.#master);

    // bus with a slow throb — the room breathes
    const bus = this.#ctx.createGain();
    bus.gain.value = 0.0001;
    bus.gain.setTargetAtTime(TECHNO.level * this.#volume, t, 1.4);
    bus.connect(doorFilter);

    const lfo = this.#ctx.createOscillator();
    lfo.frequency.value = TECHNO.bpm / 60 / 4;       // one swell per bar
    const lfoAmt = this.#ctx.createGain();
    lfoAmt.gain.value = 0.12;
    lfo.connect(lfoAmt).connect(bus.gain);
    lfo.start(t);

    // murk: a detuned, low-passed pad that never resolves
    const padFilter = this.#ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 520;
    padFilter.Q.value = 3.2;
    const padGain = this.#ctx.createGain();
    padGain.gain.value = 0.05;
    const padOscs = TECHNO.pad.map((f) => {
      const o = this.#ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = rand(-14, 14);
      o.connect(padFilter);
      o.start(t);
      return o;
    });
    // slow filter wobble — something is moving under the floor
    const wob = this.#ctx.createOscillator();
    wob.frequency.value = 0.09;
    const wobAmt = this.#ctx.createGain();
    wobAmt.gain.value = 260;
    wob.connect(wobAmt).connect(padFilter.frequency);
    wob.start(t);
    padFilter.connect(padGain).connect(bus);

    const stepDur = 60 / TECHNO.bpm / 4;             // 16th note
    const state = {
      bus, doorFilter, lfo, wob, padOscs,
      nextTime: t + 0.06,
      startTime: t,
      timer: setInterval(() => this.#technoTick(), 40),
      stepDur,
    };
    this.#techno = state;
    this.#technoStep = 0;
  }

  /**
   * The door to the leather room. muffled=true pulls a low-pass over the
   * whole rig and drops the level — the party becomes a sub thud through
   * plaster. Smooth ramp, so walking the hallway feels like a door swinging.
   */
  setTechnoMuffle(muffled) {
    const s = this.#techno;
    if (!s || !this.#ctx) return;
    const t = this.#ctx.currentTime;
    s.doorFilter.frequency.cancelScheduledValues(t);
    s.doorFilter.frequency.setTargetAtTime(muffled ? TECHNO.muffleCutoff : 19000, t, 0.35);
    s.bus.gain.cancelScheduledValues(t);
    s.bus.gain.setTargetAtTime((muffled ? TECHNO.muffleLevel : TECHNO.level) * this.#volume, t, 0.35);
  }

  /**
   * 0..1 phase of the current beat — the world syncs its pulse to this.
   * Returns -1 when the rig is silent, so callers can fall back gracefully.
   */
  get technoBeatPhase() {
    const s = this.#techno;
    if (!s || !this.#ctx) return -1;
    const beatDur = s.stepDur * 4;
    return ((this.#ctx.currentTime - s.startTime) % beatDur) / beatDur;
  }

  stopTechno() {
    const s = this.#techno;
    if (!s) return;
    this.#techno = null;
    clearInterval(s.timer);
    if (!this.#ctx) return;
    const t = this.#ctx.currentTime;
    s.bus.gain.cancelScheduledValues(t);
    s.bus.gain.setTargetAtTime(0.0001, t, 0.5);
    const kill = t + 2.5;
    s.padOscs.forEach((o) => o.stop(kill));
    try { s.lfo.stop(kill); s.wob.stop(kill); } catch { /* already gone */ }
    setTimeout(() => { try { s.bus.disconnect(); } catch { /* garnish */ } }, 3000);
  }

  get technoPlaying() { return !!this.#techno; }

  /** Lookahead scheduler: book every 16th that falls due inside the window. */
  #technoTick() {
    const s = this.#techno;
    if (!s || !this.#ctx) return;
    const horizon = this.#ctx.currentTime + 0.12;
    while (s.nextTime < horizon) {
      this.#technoStep16(this.#technoStep, s.nextTime, s);
      this.#technoStep = (this.#technoStep + 1) % 64;   // 4-bar cycle
      s.nextTime += s.stepDur;
    }
  }

  /** One 16th-note of the groove. step 0..63, absolute WebAudio time `t`. */
  #technoStep16(step, t, s) {
    const beat = step % 16;                  // position inside the bar
    const bar = Math.floor(step / 16);

    // kick: four on the floor, pitched sine thump + click
    if (beat % 4 === 0) {
      const osc = this.#ctx.createOscillator();
      const g = this.#ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(38, t + 0.11);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.85, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      osc.connect(g).connect(s.bus);
      osc.start(t); osc.stop(t + 0.3);
      // the click on top — a boot on concrete
      const src = this.#ctx.createBufferSource();
      src.buffer = this.#noiseBuffer;
      const hp = this.#ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 1800;
      const cg = this.#ctx.createGain();
      cg.gain.setValueAtTime(0.0001, t);
      cg.gain.exponentialRampToValueAtTime(0.1, t + 0.002);
      cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      src.connect(hp).connect(cg).connect(s.bus);
      src.start(t, rand(0, 0.5)); src.stop(t + 0.05);
    }

    // rumble bass: offbeat 8ths following the pattern, an octave of filth
    if (beat % 2 === 0) {
      const semis = TECHNO.bassPattern[(beat / 2) | 0];
      const f = TECHNO.root * Math.pow(2, semis / 12);
      const osc = this.#ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      const lp = this.#ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 240; lp.Q.value = 6;
      const g = this.#ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + s.stepDur * 1.8);
      osc.connect(lp).connect(g).connect(s.bus);
      osc.start(t); osc.stop(t + s.stepDur * 2);
    }

    // hats: off the beat, thin and nervous — keys jingling in the dark
    if (beat % 4 === 2) {
      const src = this.#ctx.createBufferSource();
      src.buffer = this.#noiseBuffer;
      const hp = this.#ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 8200;
      const g = this.#ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.055, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      src.connect(hp).connect(g).connect(s.bus);
      src.start(t, rand(0, 0.5)); src.stop(t + 0.08);
    }

    // murk stab: once a bar, a detuned minor blip far away
    if (beat === 14 && bar % 2 === 1) {
      [220, 261.6, 329.6].forEach((f) => {
        const o = this.#ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = f * rand(0.99, 1.01);
        const lp = this.#ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 900;
        const g = this.#ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.03, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
        o.connect(lp).connect(g).connect(s.bus);
        o.start(t); o.stop(t + 0.45);
      });
    }
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

