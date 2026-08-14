/**
 * audio.js — fully procedural WebAudio sound. No assets, no files.
 *
 * The context is created lazily on the first user gesture (autoplay policy).
 * Every method is safe to call before that: they simply no-op.
 */

import { clamp, rand, pick } from './utils.js';
import { MUSIC_LEVEL, ROOM_SCORES } from './config.js';


/* Vowel formant pairs (F1, F2) — the mumble alphabet: a, e, i, o, u. */
const VOWELS = [[730, 1090], [530, 1840], [270, 2290], [570, 840], [300, 870]];



const MOODS = {
  garret:      { freqs: [110, 164.8, 220], cutoff: 640,  gain: 0.05 },
  leatherLatex: { freqs: [196, 246.9, 392], cutoff: 1400, gain: 0.028 },
  galleria:    { freqs: [146.8, 220, 293.7], cutoff: 900, gain: 0.035 },
  vault:       { freqs: [55, 82.4, 110], cutoff: 380,   gain: 0.07 },
  gildedFork:  { freqs: [98, 147, 196], cutoff: 720,  gain: 0.045 },
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

/* The Dildo Ball's house band: a weird jazz-tronica seance. Broken beat,
   detuned Rhodes-ish keys, a sub that forgets the changes, and little
   synth ghosts wandering the upper register. 96 BPM, swing optional,
   taste negotiable. */
const JAZZ = {
  bpm: 96,
  level: 0.34,
  swing: 0.62,        // how drunk the ride pattern is
  chords: [           // Fm9 → Bbm7 → Dbmaj7#11 → C7alt — the court's changes, broken
    [174.61, 207.65, 261.63, 311.13, 392.0],
    [116.54, 174.61, 207.65, 261.63, 311.13],
    [138.59, 174.61, 220.0, 261.63, 349.23],
    [130.81, 164.81, 233.08, 277.18, 311.13],
  ],
  bassRoots: [43.65, 58.27, 34.65, 65.41],    // F1 Bb1 Db2 C2 — the sub is confused
  melodyScale: [349.23, 392.0, 466.16, 523.25, 622.25, 698.46, 830.61],
  muffleCutoff: 300,
  muffleLevel: 0.14,
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
  #techno = null;      // { gain, timer } while the leather room is playing
  #technoStep = 0;
  #jazz = null;        // the court's combo, while the Dildo Ball is in session
  #jazzRequested = false;
  #jazzStep = 0;
  #roomScore = null;   // one profile-driven procedural rig for the current room
  #roomScoreKey = null;
  #roomScoreStep = 0;


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
    if (this.#roomScoreKey && !this.#roomScore) this.#startRoomScore(this.#roomScoreKey);
    if (this.#jazzRequested && !this.#jazz) this.#startJazzRig();
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

  /* ---------------- generated room scores ---------------- */

  /** Select a room's coded score, or disable it while a communal record plays. */
  setRoomScore(zoneKey, enabled = true) {
    const nextKey = enabled && ROOM_SCORES[zoneKey] ? zoneKey : null;
    if (this.#roomScoreKey === nextKey && (!!this.#roomScore === !!nextKey)) return;
    this.#roomScoreKey = nextKey;
    this.#stopRoomScoreRig();
    if (nextKey && this.#ctx) this.#startRoomScore(nextKey);
  }

  stopRoomScore() { this.setRoomScore(null, false); }

  get roomScorePlaying() { return !!this.#roomScore; }
  get roomScoreName() { return this.#roomScoreKey; }

  /** 0..1 phase of the current quarter-note beat; -1 while records override it. */
  get roomBeatPhase() {
    const s = this.#roomScore;
    if (!s || !this.#ctx) return -1;
    const beatDur = s.stepDur * 4;
    return ((this.#ctx.currentTime - s.startTime) % beatDur) / beatDur;
  }

  #startRoomScore(key) {
    const profile = ROOM_SCORES[key];
    if (!profile || !this.#ctx || this.#roomScore) return;
    const t = this.#ctx.currentTime;
    const filter = this.#ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = profile.cutoff;
    filter.Q.value = key === 'leatherLatex' ? 5.5 : 1.4;
    filter.connect(this.#master);

    const bus = this.#ctx.createGain();
    bus.gain.value = 0.0001;
    bus.gain.setTargetAtTime(profile.level, t, 0.65);
    bus.connect(filter);

    const lofi = profile.lofi
      ? (typeof profile.lofi === 'object' ? profile.lofi : {})
      : null;
    let lofiNodes = null;
    if (lofi) {
      // A tiny filtered noise floor and slow cutoff drift suggest worn tape
      // without bringing back the persistent harmonic room drones.
      const hiss = this.#ctx.createBufferSource();
      hiss.buffer = this.#noiseBuffer;
      hiss.loop = true;
      const hissHighpass = this.#ctx.createBiquadFilter();
      hissHighpass.type = 'highpass';
      hissHighpass.frequency.value = lofi.hissHighpass ?? 620;
      const hissLowpass = this.#ctx.createBiquadFilter();
      hissLowpass.type = 'lowpass';
      hissLowpass.frequency.value = lofi.hissLowpass ?? 5600;
      const hissGain = this.#ctx.createGain();
      hissGain.gain.value = lofi.hissLevel ?? 0.009;
      hiss.connect(hissHighpass).connect(hissLowpass).connect(hissGain).connect(bus);
      hiss.start(t, rand(0, Math.max(0.01, this.#noiseBuffer.duration - 0.01)));

      const wow = this.#ctx.createOscillator();
      wow.type = 'sine';
      wow.frequency.value = lofi.wowRate ?? 0.21;
      const wowDepth = this.#ctx.createGain();
      wowDepth.gain.value = lofi.wowDepth ?? 44;
      wow.connect(wowDepth).connect(filter.frequency);
      wow.start(t);
      lofiNodes = { hiss, hissHighpass, hissLowpass, hissGain, wow, wowDepth };
    }

    const stepDur = 60 / profile.bpm / 4;
    this.#roomScore = {
      key, profile, lofi, bus, filter, lofiNodes,
      stepDur, startTime: t, nextTime: t + 0.06,
      timer: setInterval(() => this.#roomScoreTick(), 40),
    };
    this.#roomScoreStep = 0;
  }

  #stopRoomScoreRig() {
    const s = this.#roomScore;
    if (!s) return;
    this.#roomScore = null;
    clearInterval(s.timer);
    if (!this.#ctx) return;
    const t = this.#ctx.currentTime;
    s.bus.gain.cancelScheduledValues(t);
    s.bus.gain.setTargetAtTime(0.0001, t, 0.28);
    if (s.lofiNodes) {
      try { s.lofiNodes.hiss.stop(t + 1.5); } catch { /* already composted */ }
      try { s.lofiNodes.wow.stop(t + 1.5); } catch { /* already composted */ }
    }
    setTimeout(() => {
      if (s.lofiNodes) {
        for (const node of Object.values(s.lofiNodes)) {
          try { node.disconnect(); } catch { /* garnish */ }
        }
      }
      try { s.bus.disconnect(); } catch { /* garnish */ }
      try { s.filter.disconnect(); } catch { /* garnish */ }
    }, 1800);
  }

  #roomScoreTick() {
    const s = this.#roomScore;
    if (!s || !this.#ctx) return;
    const horizon = this.#ctx.currentTime + 0.12;
    while (s.nextTime < horizon) {
      this.#roomScoreStep16(this.#roomScoreStep, s.nextTime, s);
      this.#roomScoreStep = (this.#roomScoreStep + 1) % 64;
      s.nextTime += s.stepDur;
    }
  }

  #scoreTone(t, freq, {
    bus, type = 'sine', peak = 0.1, attack = 0.006, decay = 0.2,
    cutoff = 1200, slide = 1, detune = 0,
  }) {
    const osc = this.#ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(freq, 1), t);
    osc.detune.setValueAtTime(detune, t);
    const releaseTime = t + Math.max(decay, attack + 0.01);
    if (slide !== 1) osc.frequency.exponentialRampToValueAtTime(Math.max(freq * slide, 1), releaseTime);
    const filter = this.#ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = cutoff; filter.Q.value = 2.5;
    const gain = this.#ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, releaseTime);
    osc.connect(filter).connect(gain).connect(bus);
    osc.start(t); osc.stop(releaseTime + 0.04);
  }

  #scoreNoise(t, { bus, peak, decay, freq, type = 'highpass' }) {
    const src = this.#ctx.createBufferSource();
    src.buffer = this.#noiseBuffer;
    const filter = this.#ctx.createBiquadFilter();
    filter.type = type; filter.frequency.value = freq;
    const gain = this.#ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    src.connect(filter).connect(gain).connect(bus);
    src.start(t, rand(0, 0.8)); src.stop(t + decay + 0.03);
  }

  /** Soft, close-voiced electric-piano stabs for profiles with a jazz layer. */
  #scoreJazzChord(t, s, jazz, eventIndex) {
    const chord = jazz.chords[eventIndex % jazz.chords.length];
    const base = s.profile.root * (jazz.octave ?? 2);
    const decay = s.stepDur * (jazz.decaySteps ?? 7);
    chord.forEach((semi, voice) => {
      const freq = base * Math.pow(2, semi / 12);
      this.#scoreTone(t + voice * (jazz.spread ?? 0.012), freq, {
        bus: s.bus,
        type: voice % 2 ? 'sine' : 'triangle',
        peak: (jazz.level ?? 0.014) * (voice === 0 ? 1.12 : 1),
        attack: (jazz.attack ?? 0.05) + voice * 0.006,
        decay,
        cutoff: jazz.cutoff ?? 1800,
        detune: (voice - (chord.length - 1) / 2) * 2.2,
      });
    });
  }

  /**
   * A deliberately synthetic, wordless moan. A glottal carrier passes through
   * two moving vowel formants while a slow swell, pitch sag and vibrato make it
   * feel performed rather than sampled.
   */
  #scoreVocalMoan(t, s, vocal, eventIndex) {
    const dur = s.stepDur * vocal.durationSteps[eventIndex % vocal.durationSteps.length];
    const semi = vocal.notes[eventIndex % vocal.notes.length];
    const f0 = s.profile.root * Math.pow(2, semi / 12) * (vocal.octave ?? 2);
    const vowel = vocal.vowels[eventIndex % vocal.vowels.length];
    const [f1Start, f2Start, f1End, f2End] = vowel;

    const carrier = this.#ctx.createOscillator();
    carrier.type = 'sawtooth';
    carrier.frequency.setValueAtTime(f0 * 0.97, t);
    carrier.frequency.exponentialRampToValueAtTime(f0, t + dur * 0.28);
    carrier.frequency.exponentialRampToValueAtTime(f0 * (vocal.glide ?? 0.91), t + dur);

    const body = this.#ctx.createOscillator();
    body.type = 'sine';
    body.frequency.setValueAtTime(f0 * 0.5, t);
    body.frequency.exponentialRampToValueAtTime(f0 * 0.47, t + dur);
    const bodyGain = this.#ctx.createGain();
    bodyGain.gain.value = 0.32;

    const vibrato = this.#ctx.createOscillator();
    vibrato.type = 'sine';
    vibrato.frequency.value = vocal.vibratoRate ?? 5.1;
    const vibratoDepth = this.#ctx.createGain();
    vibratoDepth.gain.setValueAtTime(2, t);
    vibratoDepth.gain.linearRampToValueAtTime(vocal.vibratoDepth ?? 18, t + dur * 0.45);
    vibratoDepth.gain.linearRampToValueAtTime(7, t + dur);
    vibrato.connect(vibratoDepth).connect(carrier.detune);

    const throat = this.#ctx.createBiquadFilter();
    throat.type = 'lowpass';
    throat.frequency.value = 2800;
    throat.Q.value = 0.7;
    carrier.connect(throat);
    body.connect(bodyGain).connect(throat);

    const mouth = this.#ctx.createGain();
    const peak = vocal.level ?? 0.032;
    mouth.gain.setValueAtTime(0.0001, t);
    mouth.gain.exponentialRampToValueAtTime(peak * 0.72, t + dur * 0.16);
    mouth.gain.exponentialRampToValueAtTime(peak, t + dur * 0.46);
    mouth.gain.exponentialRampToValueAtTime(peak * 0.58, t + dur * 0.76);
    mouth.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    [
      [f1Start, f1End, 7.5, 1],
      [f2Start, f2End, 9, 0.72],
    ].forEach(([start, end, q, level]) => {
      const formant = this.#ctx.createBiquadFilter();
      formant.type = 'bandpass';
      formant.frequency.setValueAtTime(start, t);
      formant.frequency.exponentialRampToValueAtTime(end, t + dur * 0.82);
      formant.Q.value = q;
      const formantGain = this.#ctx.createGain();
      formantGain.gain.value = level;
      throat.connect(formant).connect(formantGain).connect(mouth);
    });

    mouth.connect(s.bus);
    carrier.start(t); body.start(t); vibrato.start(t);
    carrier.stop(t + dur + 0.04);
    body.stop(t + dur + 0.04);
    vibrato.stop(t + dur + 0.04);
  }

  #roomScoreStep16(step, t, s) {
    const p = s.profile;
    const lofi = s.lofi;
    const pos = step % 16;
    const swung = pos % 2 ? t + s.stepDur * p.swing : t;

    if (p.kick.includes(pos)) {
      this.#scoreTone(swung, 145, { bus: s.bus, peak: p.kickLevel ?? 0.56, decay: 0.22, cutoff: 500, slide: 0.24 });
    }
    if (p.snare.includes(pos)) this.#scoreNoise(swung, { bus: s.bus, peak: p.snareLevel ?? 0.12, decay: 0.12, freq: 1100, type: 'bandpass' });
    if (p.hats.includes(pos)) this.#scoreNoise(swung, { bus: s.bus, peak: p.hatLevel ?? 0.045, decay: 0.045, freq: 6500 });

    if (pos % 2 === 0) {
      const semi = p.bass[pos / 2];
      if (semi !== null && semi !== undefined) {
        const freq = p.root * Math.pow(2, semi / 12);
        this.#scoreTone(swung, freq, {
          bus: s.bus,
          type: p.bassWave,
          peak: p.bassLevel ?? 0.16,
          decay: s.stepDur * (p.bassDecay ?? 1.7),
          cutoff: Math.min(p.cutoff, 520),
          slide: s.key === 'vault' ? 0.92 : 1,
        });
      }
    }

    const scaleIndex = p.lead[pos];
    if (scaleIndex !== null && scaleIndex !== undefined && (step < 48 || pos % 3 !== 0)) {
      const semi = p.scale[scaleIndex % p.scale.length];
      const octave = s.key === 'maxPro' ? 4 : 3;
      const freq = p.root * Math.pow(2, semi / 12) * octave;
      this.#scoreTone(swung, freq, {
        bus: s.bus,
        type: p.wave,
        peak: p.leadLevel ?? 0.035,
        attack: lofi ? (lofi.leadAttack ?? 0.022) : 0.006,
        decay: s.stepDur * (s.key === 'dildoBall' ? 3 : lofi ? (lofi.leadDecay ?? 1.75) : 1.35),
        cutoff: p.cutoff * (lofi ? (lofi.cutoffScale ?? 1.2) : 1.4),
        slide: s.key === 'maxPro' ? 1.06 : 1,
        detune: lofi ? rand(-(lofi.detune ?? 7), lofi.detune ?? 7) : 0,
      });
    }

    if (p.texture > 0 && pos === 15 && Math.random() < p.texture) {
      this.#scoreNoise(swung, { bus: s.bus, peak: 0.055, decay: s.stepDur * 4, freq: 2600, type: 'bandpass' });
    }

    if (p.jazz?.steps.includes(step)) {
      this.#scoreJazzChord(swung, s, p.jazz, p.jazz.steps.indexOf(step));
    }
    if (p.vocal?.steps.includes(step)) {
      this.#scoreVocalMoan(swung, s, p.vocal, p.vocal.steps.indexOf(step));
    }
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

  /** MAX PRO's ring: glove thud, synthetic bell and an inhuman little grunt. */
  boxingImpact(variant = 0) {
    if (!this.#ctx) return;
    const hard = variant % 3 === 2;
    this.#noise({
      peak: hard ? 0.28 : 0.2,
      attack: 0.002,
      decay: hard ? 0.16 : 0.11,
      filterFreq: hard ? 760 : 1050,
      filterEnd: 180,
      q: 1.8,
      type: 'bandpass',
    });
    this.#tone({ freq: hard ? 132 : 168, freqEnd: 54, type: 'triangle', peak: 0.2, decay: 0.15 });
    this.#tone({ freq: 620 + variant * 137, freqEnd: 310 + variant * 41, type: 'square', peak: 0.035, attack: 0.008, decay: 0.12 });
    setTimeout(() => {
      this.talkBlip(variant % 2 ? 0.58 : 0.76);
      if (hard) this.#tone({ freq: 74, freqEnd: 118, type: 'sawtooth', peak: 0.06, attack: 0.03, decay: 0.24 });
    }, 35);
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

  /**
   * The royal cow speaks. A synthesized moo: low glottal buzz with vibrato
   * that fades in, two formants opening from a nasal "mmm" into a round
   * "ooo", a tired downward pitch sag at the end, and breath underneath.
   * Fail-soft like everything else — no context, no cow.
   */
  moo(pitch = 1) {
    if (!this.#ctx) return;
    const t = this.#ctx.currentTime;
    const dur = rand(0.9, 1.4);
    const f0 = 92 * pitch * rand(0.92, 1.08);          // adult-cow register

    // glottal source: sawtooth buzz, steady then sagging — the moo gives up
    const osc = this.#ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.setValueAtTime(f0, t + dur * 0.55);
    osc.frequency.exponentialRampToValueAtTime(f0 * 0.72, t + dur);
    const vib = this.#ctx.createOscillator();
    vib.frequency.value = rand(4.5, 6);
    const vibAmt = this.#ctx.createGain();
    vibAmt.gain.setValueAtTime(0.0001, t);
    vibAmt.gain.linearRampToValueAtTime(f0 * 0.05, t + dur * 0.4);
    vib.connect(vibAmt).connect(osc.frequency);

    // the mouth: low-passed throat into two formants that open and re-close
    const throat = this.#ctx.createBiquadFilter();
    throat.type = 'lowpass';
    throat.frequency.value = 1600;
    throat.Q.value = 0.6;
    const f1 = this.#ctx.createBiquadFilter();
    f1.type = 'bandpass';
    f1.Q.value = 4;
    f1.frequency.setValueAtTime(240, t);               // mmm — mouth shut
    f1.frequency.exponentialRampToValueAtTime(720, t + dur * 0.35);
    f1.frequency.exponentialRampToValueAtTime(420, t + dur);
    const f2 = this.#ctx.createBiquadFilter();
    f2.type = 'bandpass';
    f2.Q.value = 6;
    f2.frequency.setValueAtTime(650, t);
    f2.frequency.exponentialRampToValueAtTime(1050, t + dur * 0.35);
    f2.frequency.exponentialRampToValueAtTime(800, t + dur);

    // amplitude: slow nasal attack, full open "OO", long dignified sag
    const g = this.#ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + dur * 0.18);
    g.gain.exponentialRampToValueAtTime(0.5, t + dur * 0.38);
    g.gain.setValueAtTime(0.5, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(throat);
    throat.connect(f1).connect(g);
    throat.connect(f2).connect(g);
    g.connect(this.#master);

    // breath: a soft bovine exhale under the whole statement
    const breath = this.#ctx.createBufferSource();
    breath.buffer = this.#noiseBuffer;
    breath.loop = true;
    const breathF = this.#ctx.createBiquadFilter();
    breathF.type = 'lowpass';
    breathF.frequency.value = 500;
    const breathG = this.#ctx.createGain();
    breathG.gain.setValueAtTime(0.0001, t);
    breathG.gain.exponentialRampToValueAtTime(0.05, t + dur * 0.3);
    breathG.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    breath.connect(breathF).connect(breathG).connect(this.#master);

    osc.start(t); osc.stop(t + dur + 0.05);
    vib.start(t); vib.stop(t + dur + 0.05);
    breath.start(t, rand(0, 0.8)); breath.stop(t + dur + 0.05);
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

  /* ---------------- the dildo ball's royal jazz combo ---------------- */

  /**
   * Start the court's band: low electric piano, brushed kit, lazy 84 BPM.
   * Idempotent, fail-soft. Same lookahead-scheduler discipline as the
   * techno rig, but the groove is loose on purpose — swing, not grid.
   */
  startJazz() {
    this.#jazzRequested = true;
    this.#startJazzRig();
  }

  #startJazzRig() {
    if (!this.#ctx || this.#jazz || !this.#jazzRequested) return;
    const t = this.#ctx.currentTime;

    // the ballroom door: open inside the court, a warm murmur from outside
    const doorFilter = this.#ctx.createBiquadFilter();
    doorFilter.type = 'lowpass';
    doorFilter.frequency.value = 19000;
    doorFilter.Q.value = 0.4;
    doorFilter.connect(this.#master);

    const bus = this.#ctx.createGain();
    bus.gain.value = 0.0001;
    bus.gain.setTargetAtTime(JAZZ.level * this.#volume, t, 1.6);
    bus.connect(doorFilter);

    // the room tone of royalty: a soft pink-ish hush, like velvet air
    const hushSrc = this.#ctx.createBufferSource();
    hushSrc.buffer = this.#noiseBuffer;
    hushSrc.loop = true;
    const hushFilter = this.#ctx.createBiquadFilter();
    hushFilter.type = 'lowpass';
    hushFilter.frequency.value = 420;
    const hushGain = this.#ctx.createGain();
    hushGain.gain.value = 0.012;
    hushSrc.connect(hushFilter).connect(hushGain).connect(bus);
    hushSrc.start(t, rand(0, 0.8));

    const stepDur = 60 / JAZZ.bpm / 4;           // 16th note, loosely held
    this.#jazz = {
      bus, doorFilter, hushSrc,
      nextTime: t + 0.08,
      startTime: t,
      timer: setInterval(() => this.#jazzTick(), 50),
      stepDur,
    };
    this.#jazzStep = 0;
  }

  /** The ballroom door. muffled=true turns the combo into a warm rumor. */
  setJazzMuffle(muffled) {
    const s = this.#jazz;
    if (!s || !this.#ctx) return;
    const t = this.#ctx.currentTime;
    s.doorFilter.frequency.cancelScheduledValues(t);
    s.doorFilter.frequency.setTargetAtTime(muffled ? JAZZ.muffleCutoff : 19000, t, 0.4);
    s.bus.gain.cancelScheduledValues(t);
    s.bus.gain.setTargetAtTime((muffled ? JAZZ.muffleLevel : JAZZ.level) * this.#volume, t, 0.4);
  }

  /** 0..1 phase of the current beat — the disco ball answers every kick. */
  get jazzBeatPhase() {
    const s = this.#jazz;
    if (!s || !this.#ctx) return -1;
    const beatDur = s.stepDur * 4;
    return ((this.#ctx.currentTime - s.startTime) % beatDur) / beatDur;
  }

  stopJazz() {
    this.#jazzRequested = false;
    const s = this.#jazz;
    if (!s) return;
    this.#jazz = null;
    clearInterval(s.timer);
    if (!this.#ctx) return;
    const t = this.#ctx.currentTime;
    s.bus.gain.cancelScheduledValues(t);
    s.bus.gain.setTargetAtTime(0.0001, t, 0.6);
    try { s.hushSrc.stop(t + 3); } catch { /* already gone */ }
    setTimeout(() => { try { s.bus.disconnect(); } catch { /* garnish */ } }, 3200);
  }

  get jazzPlaying() { return !!this.#jazz; }

  /** Lookahead scheduler: book every 16th that falls due inside the window. */
  #jazzTick() {
    const s = this.#jazz;
    if (!s || !this.#ctx) return;
    const horizon = this.#ctx.currentTime + 0.15;
    while (s.nextTime < horizon) {
      this.#jazzStep16(this.#jazzStep, s.nextTime, s);
      this.#jazzStep = (this.#jazzStep + 1) % 64;   // four bars, four chords
      s.nextTime += s.stepDur;
    }
  }

  /**
   * One voice of the combo, scheduled into the rig's bus.
   * The "piano" is a broken Rhodes: a detuned saw body with a sine tine
   * on top, low-passed into the carpet, then pitch-drunk. Humanized,
   * always slightly late, occasionally wrong on purpose.
   */
  #jazzVoice(t, freq, { peak = 0.1, attack = 0.012, decay = 1.1, tine = 0.35, bus, drunk = 0.5 }) {
    const body = this.#ctx.createOscillator();
    body.type = 'sawtooth';
    body.frequency.value = freq * rand(0.985, 1.015);
    body.detune.value = rand(-35, 35);
    const tineOsc = this.#ctx.createOscillator();
    tineOsc.type = 'sine';
    tineOsc.frequency.value = freq * 2 * rand(0.99, 1.01);
    // the pitch wobbles like the keyboardist is leaning on the pitch wheel
    if (drunk > 0) {
      const wob = this.#ctx.createOscillator();
      wob.frequency.value = rand(2.2, 5.5);
      const wobAmt = this.#ctx.createGain();
      wobAmt.gain.value = freq * 0.008 * drunk;
      wob.connect(wobAmt).connect(body.frequency);
      wob.start(t); wob.stop(t + attack + decay + 0.05);
    }
    const lp = this.#ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1800;
    lp.Q.value = 1.4;
    const g = this.#ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    const tg = this.#ctx.createGain();
    tg.gain.setValueAtTime(0.0001, t);
    tg.gain.exponentialRampToValueAtTime(Math.max(peak * tine, 0.0002), t + attack * 0.6);
    tg.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay * 0.4);
    body.connect(lp).connect(g).connect(bus);
    tineOsc.connect(tg).connect(bus);
    body.start(t); body.stop(t + attack + decay + 0.05);
    tineOsc.start(t); tineOsc.stop(t + attack + decay * 0.5);
  }

  /** One 16th-note of the court's groove. step 0..63, absolute time `t`. */
  #jazzStep16(step, t, s) {
    const beat = step % 16;
    const bar = Math.floor(step / 16);
    const chord = JAZZ.chords[bar];
    const late = () => rand(0, 0.035);         // the band is good, not sober

    // broken hats: a swung tick on 1, the and-of-2, and the e-of-4
    if (beat === 0 || beat === 7 || beat === 10 || beat === 13) {
      const tt = t + late();
      const src = this.#ctx.createBufferSource();
      src.buffer = this.#noiseBuffer;
      const bp = this.#ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 7200; bp.Q.value = 3.5;
      const g = this.#ctx.createGain();
      const vel = beat === 10 ? 0.03 : 0.05;
      g.gain.setValueAtTime(0.0001, tt);
      g.gain.exponentialRampToValueAtTime(vel, tt + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + (beat === 10 ? 0.06 : 0.11));
      src.connect(bp).connect(g).connect(s.bus);
      src.start(tt, rand(0, 0.5)); src.stop(tt + 0.15);
    }

    // glitch snare: 2 and 4, but one of them is always late or wrong
    if (beat === 4 || beat === 12) {
      const tt = t + late() + (beat === 12 ? rand(0.01, 0.05) : 0);
      const src = this.#ctx.createBufferSource();
      src.buffer = this.#noiseBuffer;
      const bp = this.#ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 1600 + rand(-300, 400); bp.Q.value = 1.2;
      const g = this.#ctx.createGain();
      g.gain.setValueAtTime(0.0001, tt);
      g.gain.exponentialRampToValueAtTime(0.055, tt + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.11);
      src.connect(bp).connect(g).connect(s.bus);
      src.start(tt, rand(0, 0.5)); src.stop(tt + 0.16);
    }

    // the king's stagger: a lopsided kick on 1 and the uh-of-3
    if (beat === 0 || beat === 11) {
      const tt = t + late();
      const osc = this.#ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, tt);
      osc.frequency.exponentialRampToValueAtTime(36, tt + 0.1);
      const g = this.#ctx.createGain();
      g.gain.setValueAtTime(0.0001, tt);
      g.gain.exponentialRampToValueAtTime(beat === 0 ? 0.38 : 0.18, tt + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.22);
      osc.connect(g).connect(s.bus);
      osc.start(tt); osc.stop(tt + 0.28);
    }

    // the confused sub: root on 1, a fifth that arrives late on 3, and
    // sometimes a wrong note that the band pretends was intentional
    if (beat === 0 || beat === 8 || (beat === 14 && Math.random() < 0.35)) {
      const root = JAZZ.bassRoots[bar];
      const f = beat === 0 ? root : beat === 8 ? root * 1.5 : root * 1.19; // the wrong one
      this.#jazzVoice(t + late(), f, { peak: 0.18, attack: 0.015, decay: 1.1, tine: 0.06, bus: s.bus, drunk: 0.3 });
    }

    // the broken Rhodes: the chord arrives on the and-of-1, detuned, held
    if (beat === 2) {
      const tt = t + late();
      chord.forEach((f, i) =>
        this.#jazzVoice(tt + i * 0.02, f, { peak: 0.06, attack: 0.02, decay: 2.6, tine: 0.22, bus: s.bus, drunk: 0.8 }));
    }
    // a second, smaller apology on the and-of-3, some bars only
    if (beat === 10 && bar % 2 === 1) {
      const tt = t + late();
      chord.slice(1, 4).forEach((f, i) =>
        this.#jazzVoice(tt + i * 0.018, f * 2, { peak: 0.032, attack: 0.015, decay: 1.7, tine: 0.3, bus: s.bus, drunk: 0.7 }));
    }

    // the synth ghosts: sparse, warbly, mostly on the off-beats, sometimes
    // sliding in from nowhere like they remembered the tune mid-note
    if ((beat === 6 || beat === 14) && Math.random() < 0.45) {
      const f = pick(JAZZ.melodyScale);
      const tt = t + late() + rand(0, 0.05);
      this.#jazzVoice(tt, f, { peak: 0.055, attack: 0.04, decay: 2.0, tine: 0.5, bus: s.bus, drunk: 1.6 });
      if (Math.random() < 0.3) {
        // a harmony ghost, a third up, slightly more drunk
        this.#jazzVoice(tt + 0.06, f * 1.26, { peak: 0.028, attack: 0.05, decay: 1.6, tine: 0.5, bus: s.bus, drunk: 2.0 });
      }
    }
  }


  /* ---------------- ambient drone ---------------- */

  setMood(name) {
    if (!this.#ctx) return;
    const t = this.#ctx.currentTime;

    if (this.#moodNodes) {
      const { gain, oscs } = this.#moodNodes;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setTargetAtTime(0.0001, t, 0.6);
      oscs.forEach((o) => o.stop(t + 2.5));
      this.#moodNodes = null;
    }
    // Room identity now comes from sequenced beats, bass and lead notes only.
    // Keep the API so travel code remains unchanged, but never start a drone.
    void name;
  }
}
