/**
 * audio.js — fully procedural WebAudio sound. No assets, no files.
 *
 * The context is created lazily on the first user gesture (autoplay policy).
 * Every method is safe to call before that: they simply no-op.
 */

import { clamp, rand, pick } from './utils.js';
import { MUSIC_BPMS, MUSIC_LEVEL, ROOM_SCORE_FEEL, ROOM_SCORES } from './config.js';


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
  bpm: 116,
  root: 55,                                   // A1 — the rumble lives here
  pad: [110, 130.8, 164.8, 196],              // Am add7-ish smear
  bassPattern: [0, 0, 12, 0, 7, 0, 3, 0],     // semitone offsets per 8th
  level: 0.44,
  // through-the-wall voicing: the same loop, heard from the hallway
  muffleCutoff: 210,
  muffleLevel: 0.22,
};

export const TECHNO_BPM = TECHNO.bpm;   // the world pulses in time

/* The Dildo Ball's house band: a weird jazz-tronica seance. Broken beat,
   detuned Rhodes-ish keys, a sub that forgets the changes, and little
   synth ghosts wandering the upper register. 96 BPM, swing optional,
   taste negotiable. */
const SINGER_VOCAL_URL = 'puplic/songs/singer-yhea.mp3';
const FART_BOX_SAMPLE_URL = 'puplic/songs/meltzers-gate-9.m4a';

const JAZZ = {
  bpm: 88,
  level: 0.3,
  swing: 0.54,        // still crooked, but less eager to fall down the stairs
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
  #roomScoreDrive = 0;
  #singerBufferPromise = null;   // decoded, cached vocal sample for the listening room
  #singerReverbBuffer = null;    // synthetic impulse response, generated once
  #fartBoxBufferPromise = null;  // one recording, three effect chains
  #fartBoxSources = [null, null, null];
  #jukebox = null;               // active local performance track
  #jukeboxPlaylist = [];
  #jukeboxPlaylistIndex = 0;


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
    if (this.#jukebox) this.#jukebox.volume = clamp(this.#volume * 0.9, 0, 1);
  }

  /* ---------------- music (the record collection) ---------------- */

  /** Crossfade to a track (key into MUSIC map), or null to stop. Fail-soft. */
  setMusic(key, tracks, onError = null) {
    if (this.#musicKey === key) return true;
    this.#stopMusic();
    this.#musicKey = key;
    if (!key) return true;
    if (!tracks?.[key]) {
      this.#musicKey = null;
      onError?.(key);
      return false;
    }
    try {
      const a = new Audio(encodeURI(tracks[key]));
      a.loop = true;
      a.volume = 0;
      a.addEventListener('error', () => {
        if (this.#music !== a) return;
        this.#music = null;
        this.#musicKey = null;
        onError?.(key);
      });
      this.#music = a;
      this.#musicTarget = this.#volume * MUSIC_LEVEL;
      const p = a.play();
      if (p?.catch) p.catch(() => {});   // pre-gesture: ensure() will retry
      this.#fadeMusic();
      return true;
    } catch {
      this.#music = null;
      this.#musicKey = null;
      onError?.(key);
      return false;
    }
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

  #stopMusic(durationMs = 180) {
    clearInterval(this.#fadeTimer);
    if (!this.#music) { this.#musicKey = null; return; }
    const a = this.#music;
    this.#music = null;
    this.#musicKey = null;
    if (durationMs <= 0) {
      a.pause();
      a.volume = 0;
      return;
    }
    const started = performance.now();
    const startVolume = a.volume;
    const t = setInterval(() => {
      const progress = Math.min(1, (performance.now() - started) / durationMs);
      a.volume = Math.max(0, startVolume * (1 - progress));
      if (progress >= 1) { a.pause(); clearInterval(t); }
    }, 16);
  }

  /**
   * Fade every continuous musical source to silence before another one starts.
   * Returns the handoff delay so the game can cancel stale transitions.
   */
  fadeOutSoundtrack(durationMs = 180) {
    const ms = Math.max(0, durationMs);
    this.#stopMusic(ms);
    this.stopJukebox();
    this.#roomScoreKey = null;
    this.#stopRoomScoreRig(ms === 0, ms);
    this.stopJazz(ms === 0, ms);
    this.stopTechno(ms);
    this.setMood('off');
    // Leave one animation frame after the ramp so the outgoing HTML audio
    // element is definitely paused before the replacement becomes audible.
    return ms > 0 ? ms + 20 : 0;
  }

  /** Hard boundary for acoustically sealed rooms. */
  cutMusic() {
    clearInterval(this.#fadeTimer);
    if (this.#music) {
      this.#music.pause();
      this.#music.volume = 0;
    }
    this.#music = null;
    this.#musicKey = null;
    this.#musicTarget = 0;
    this.stopJukebox();
  }

  /** Toggle a complete local performance playlist and loop the full set. */
  toggleJukeboxPlaylist(sources) {
    if (this.jukeboxPlaying) {
      this.stopJukebox();
      return false;
    }
    this.stopJukebox();
    this.#jukeboxPlaylist = (sources ?? []).filter((src) => typeof src === 'string' && src.length);
    this.#jukeboxPlaylistIndex = 0;
    if (!this.#jukeboxPlaylist.length) return false;
    return this.#startJukeboxTrack();
  }

  /** Advance the local performance immediately. If the jukebox is stopped,
      the next control doubles as a highly visible start button. */
  nextJukeboxTrack(sources) {
    const incoming = (sources ?? []).filter((src) => typeof src === 'string' && src.length);
    if (!this.#jukeboxPlaylist.length) {
      this.#jukeboxPlaylist = incoming;
      this.#jukeboxPlaylistIndex = 0;
    } else {
      if (incoming.length) this.#jukeboxPlaylist = incoming;
      this.#jukeboxPlaylistIndex = (this.#jukeboxPlaylistIndex + 1) % this.#jukeboxPlaylist.length;
    }
    if (!this.#jukeboxPlaylist.length) return -1;
    if (this.#jukebox) {
      this.#jukebox.pause();
      this.#jukebox.currentTime = 0;
      this.#jukebox = null;
    }
    return this.#startJukeboxTrack() ? this.#jukeboxPlaylistIndex : -1;
  }

  #startJukeboxTrack() {
    const src = this.#jukeboxPlaylist[this.#jukeboxPlaylistIndex];
    if (!src) return false;
    try {
      const track = new Audio(encodeURI(src));
      track.loop = false;
      track.volume = clamp(this.#volume * 0.9, 0, 1);
      track.addEventListener('ended', () => {
        if (this.#jukebox !== track) return;
        this.#jukebox = null;
        this.#jukeboxPlaylistIndex = (this.#jukeboxPlaylistIndex + 1) % this.#jukeboxPlaylist.length;
        this.#startJukeboxTrack();
      });
      track.addEventListener('error', () => {
        if (this.#jukebox !== track) return;
        this.#jukebox = null;
        this.#jukeboxPlaylist = [];
      });
      this.#jukebox = track;
      track.play().catch(() => {});
      return true;
    } catch {
      this.#jukebox = null;
      return false;
    }
  }

  stopJukebox() {
    if (this.#jukebox) {
      this.#jukebox.pause();
      this.#jukebox.currentTime = 0;
    }
    this.#jukebox = null;
    this.#jukeboxPlaylist = [];
    this.#jukeboxPlaylistIndex = 0;
  }

  get jukeboxPlaying() { return Boolean(this.#jukebox && !this.#jukebox.paused); }
  get jukeboxPlaylistIndex() { return this.#jukeboxPlaylistIndex; }


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
  setRoomScore(zoneKey, enabled = true, immediate = false) {
    const nextKey = enabled && ROOM_SCORES[zoneKey] ? zoneKey : null;
    if (this.#roomScoreKey === nextKey && (!!this.#roomScore === !!nextKey)) return;
    this.#roomScoreKey = nextKey;
    this.#stopRoomScoreRig(immediate);
    if (nextKey && this.#ctx) this.#startRoomScore(nextKey);
  }

  stopRoomScore() { this.setRoomScore(null, false); }

  get roomScorePlaying() { return !!this.#roomScore; }
  get roomScoreName() { return this.#roomScoreKey; }

  /** 0..1 phase of the current quarter-note beat for records or room scores. */
  get roomBeatPhase() {
    if (this.#music && !this.#music.paused) {
      const bpm = MUSIC_BPMS[this.#musicKey] ?? 96;
      const beatDur = 60 / bpm;
      return (this.#music.currentTime % beatDur) / beatDur;
    }
    const s = this.#roomScore;
    if (!s || !this.#ctx) return -1;
    const beatDur = s.stepDur * 4;
    return ((this.#ctx.currentTime - s.startTime) % beatDur) / beatDur;
  }

  /** Current quarter-note tempo, shared with tempo-reactive scene animation. */
  get soundtrackBpm() {
    if (this.#music && !this.#music.paused) return MUSIC_BPMS[this.#musicKey] ?? 96;
    if (this.#roomScore) return 60 / (this.#roomScore.stepDur * 4);
    if (this.#jazz) return JAZZ.bpm;
    if (this.#techno) return TECHNO.bpm;
    return 0;
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
    bus.gain.setTargetAtTime(profile.level * ROOM_SCORE_FEEL.levelScale, t, 0.65);
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
      hissGain.gain.value = (lofi.hissLevel ?? 0.009) * ROOM_SCORE_FEEL.textureScale;
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

    const bpm = profile.office ? 72 + this.#roomScoreDrive * 54 : profile.bpm * ROOM_SCORE_FEEL.tempoScale;
    const stepDur = 60 / bpm / 4;
    this.#roomScore = {
      key, profile, lofi, bus, filter, lofiNodes,
      stepDur, targetStepDur: stepDur, startTime: t, nextTime: t + 0.06,
      timer: setInterval(() => this.#roomScoreTick(), 40),
    };
    this.#roomScoreStep = 0;
  }

  #stopRoomScoreRig(immediate = false, fadeMs = null) {
    const s = this.#roomScore;
    if (!s) return;
    this.#roomScore = null;
    clearInterval(s.timer);
    if (!this.#ctx) return;
    const t = this.#ctx.currentTime;
    s.bus.gain.cancelScheduledValues(t);
    const fadeSeconds = Math.max(0, fadeMs ?? (immediate ? 0 : 900)) / 1000;
    if (immediate || fadeSeconds === 0) s.bus.gain.setValueAtTime(0.0001, t);
    else {
      s.bus.gain.setValueAtTime(Math.max(s.bus.gain.value, 0.0001), t);
      s.bus.gain.linearRampToValueAtTime(0.0001, t + fadeSeconds);
    }
    if (s.lofiNodes) {
      try { s.lofiNodes.hiss.stop(t + fadeSeconds + 0.02); } catch { /* already composted */ }
      try { s.lofiNodes.wow.stop(t + fadeSeconds + 0.02); } catch { /* already composted */ }
    }
    setTimeout(() => {
      if (s.lofiNodes) {
        for (const node of Object.values(s.lofiNodes)) {
          try { node.disconnect(); } catch { /* garnish */ }
        }
      }
      try { s.bus.disconnect(); } catch { /* garnish */ }
      try { s.filter.disconnect(); } catch { /* garnish */ }
    }, Math.max(80, fadeSeconds * 1000 + 100));
  }

  #roomScoreTick() {
    const s = this.#roomScore;
    if (!s || !this.#ctx) return;
    const horizon = this.#ctx.currentTime + 0.12;
    s.stepDur += (s.targetStepDur - s.stepDur) * 0.08;
    while (s.nextTime < horizon) {
      this.#roomScoreStep16(this.#roomScoreStep, s.nextTime, s);
      this.#roomScoreStep = (this.#roomScoreStep + 1) % 64;
      s.nextTime += s.stepDur;
    }
  }

  /** Drive an adaptive room score without disturbing a selected record. */
  setRoomScoreDrive(value = 0) {
    this.#roomScoreDrive = clamp(value, 0, 1);
    const s = this.#roomScore;
    if (!s?.profile.office) return;
    const bpm = 72 + this.#roomScoreDrive * 54;
    s.targetStepDur = 60 / bpm / 4;
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
        peak: (jazz.level ?? 0.014) * ROOM_SCORE_FEEL.leadScale * (voice === 0 ? 1.12 : 1),
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
    const peak = (vocal.level ?? 0.032) * ROOM_SCORE_FEEL.leadScale;
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

  /** Short original pseudo-rap syllables: no words or samples, just a pitched
      glottal carrier snapped through changing mouth formants and one dark echo. */
  #scoreRapChop(t, s, rap, eventIndex) {
    const dur = s.stepDur * rap.durationSteps[eventIndex % rap.durationSteps.length];
    const semi = rap.notes[eventIndex % rap.notes.length];
    const f0 = s.profile.root * Math.pow(2, semi / 12) * (rap.octave ?? 2);
    const vowel = rap.vowels[eventIndex % rap.vowels.length];

    const carrier = this.#ctx.createOscillator();
    carrier.type = eventIndex % 3 === 2 ? 'square' : 'sawtooth';
    carrier.frequency.setValueAtTime(f0 * (rap.scoop ?? 1.18), t);
    carrier.frequency.exponentialRampToValueAtTime(f0, t + dur * 0.22);
    carrier.frequency.exponentialRampToValueAtTime(f0 * (rap.drop ?? 0.88), t + dur);

    const throat = this.#ctx.createBiquadFilter();
    throat.type = 'lowpass';
    throat.frequency.value = rap.cutoff ?? 2100;
    throat.Q.value = 0.85;
    carrier.connect(throat);

    const mouth = this.#ctx.createGain();
    const peak = (rap.level ?? 0.035) * ROOM_SCORE_FEEL.leadScale;
    mouth.gain.setValueAtTime(0.0001, t);
    mouth.gain.exponentialRampToValueAtTime(peak, t + 0.008);
    mouth.gain.exponentialRampToValueAtTime(peak * 0.58, t + dur * 0.34);
    mouth.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    for (let i = 0; i < 2; i++) {
      const formant = this.#ctx.createBiquadFilter();
      formant.type = 'bandpass';
      formant.frequency.setValueAtTime(vowel[i], t);
      formant.frequency.exponentialRampToValueAtTime(vowel[i + 2], t + dur * 0.72);
      formant.Q.value = i ? 8.5 : 6.2;
      const formantGain = this.#ctx.createGain();
      formantGain.gain.value = i ? 0.68 : 1;
      throat.connect(formant).connect(formantGain).connect(mouth);
    }

    mouth.connect(s.bus);
    const echo = this.#ctx.createDelay(0.5);
    echo.delayTime.value = s.stepDur * (rap.echoSteps ?? 3);
    const echoGain = this.#ctx.createGain();
    echoGain.gain.value = rap.echoLevel ?? 0.18;
    mouth.connect(echo).connect(echoGain).connect(s.bus);

    carrier.start(t);
    carrier.stop(t + dur + 0.04);
  }

  /** A tiny tiled-room reflection network. The early reflections are short
      enough to read as hard ceramic walls, not as a musical echo. */
  #restroomReflections(input, bus) {
    for (const [delayTime, level] of [[0.021, 0.19], [0.037, 0.12], [0.061, 0.065]]) {
      const delay = this.#ctx.createDelay(0.09);
      const gain = this.#ctx.createGain();
      delay.delayTime.value = delayTime;
      gain.gain.value = level;
      input.connect(delay).connect(gain).connect(bus);
    }
  }

  /** Layered pressure, cloth and turbulent-air synthesis. The pitched body is
      deliberately unstable and buried under filtered noise so it reads as a
      close fart rather than a bass synthesizer. */
  #scoreRestroomFart(t, bus, variant = 0, accent = false) {
    if (!this.#ctx) return;
    const dur = accent ? 0.105 + (variant % 3) * 0.025 : 0.28 + (variant % 4) * 0.055;
    const peak = accent ? 0.16 : 0.31;
    const output = this.#ctx.createGain();
    output.gain.value = 0.9;
    const panner = this.#ctx.createStereoPanner?.() ?? this.#ctx.createGain();
    if (panner.pan) panner.pan.value = ((variant % 5) - 2) * 0.18;
    output.connect(panner).connect(bus);
    this.#restroomReflections(panner, bus);

    const body = this.#ctx.createOscillator();
    body.type = variant % 2 ? 'triangle' : 'sawtooth';
    const startFreq = (accent ? 118 : 88) + (variant % 4) * 9;
    body.frequency.setValueAtTime(startFreq, t);
    body.frequency.exponentialRampToValueAtTime(accent ? 54 : 38, t + dur);
    const bodyFilter = this.#ctx.createBiquadFilter();
    bodyFilter.type = 'lowpass';
    bodyFilter.frequency.value = accent ? 250 : 190;
    bodyFilter.Q.value = 1.8;
    const bodyGain = this.#ctx.createGain();
    bodyGain.gain.setValueAtTime(0.0001, t);
    bodyGain.gain.exponentialRampToValueAtTime(peak * 0.72, t + 0.009);
    bodyGain.gain.exponentialRampToValueAtTime(peak * 0.31, t + dur * 0.64);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    body.connect(bodyFilter).connect(bodyGain).connect(output);

    const air = this.#ctx.createBufferSource();
    air.buffer = this.#noiseBuffer;
    air.loop = true;
    const airFilter = this.#ctx.createBiquadFilter();
    airFilter.type = 'bandpass';
    airFilter.frequency.setValueAtTime(accent ? 410 : 265, t);
    airFilter.frequency.exponentialRampToValueAtTime(accent ? 185 : 118, t + dur);
    airFilter.Q.value = accent ? 2.8 : 2.1;
    const airGain = this.#ctx.createGain();
    airGain.gain.setValueAtTime(0.0001, t);
    airGain.gain.exponentialRampToValueAtTime(peak, t + 0.006);
    // Irregular pressure packets make the air flap instead of hissing evenly.
    const packets = accent ? 3 : 6;
    for (let i = 1; i < packets; i++) {
      const tt = t + dur * (i / packets);
      airGain.gain.setValueAtTime(peak * (i % 2 ? 0.34 : 0.82) * (1 - i / (packets + 2)), tt);
    }
    airGain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    air.connect(airFilter).connect(airGain).connect(output);

    // A brief damp burble gives selected hits a convincingly unfortunate end.
    if (!accent && variant % 3 === 2) {
      const wet = this.#ctx.createBufferSource();
      wet.buffer = this.#noiseBuffer;
      const wetFilter = this.#ctx.createBiquadFilter();
      wetFilter.type = 'bandpass'; wetFilter.frequency.value = 720; wetFilter.Q.value = 6.5;
      const wetGain = this.#ctx.createGain();
      const wt = t + dur * 0.54;
      wetGain.gain.setValueAtTime(0.0001, wt);
      wetGain.gain.exponentialRampToValueAtTime(peak * 0.24, wt + 0.008);
      wetGain.gain.exponentialRampToValueAtTime(0.0001, Math.min(t + dur, wt + 0.075));
      wet.connect(wetFilter).connect(wetGain).connect(output);
      wet.start(wt, rand(0, 0.8)); wet.stop(t + dur + 0.02);
    }

    body.start(t); air.start(t, rand(0, 0.8));
    body.stop(t + dur + 0.03); air.stop(t + dur + 0.03);
  }

  /** Broadband stream plus individual ceramic-bowl droplets. All harmonic
      content is confined to short water-drop chirps; there is no instrument. */
  #scoreRestroomPiss(t, bus, variant = 0, stream = false, mix = {}) {
    if (!this.#ctx) return;
    const dur = stream ? 1.18 + (variant % 3) * 0.16 : 0.085 + (variant % 4) * 0.025;
    const peak = stream ? (mix.streamLevel ?? 0.115) : (mix.splashLevel ?? 0.092);
    const output = this.#ctx.createGain();
    const panner = this.#ctx.createStereoPanner?.() ?? this.#ctx.createGain();
    if (panner.pan) panner.pan.value = ((variant % 7) - 3) * 0.14;
    output.connect(panner).connect(bus);
    this.#restroomReflections(panner, bus);

    const spray = this.#ctx.createBufferSource();
    spray.buffer = this.#noiseBuffer;
    spray.loop = true;
    const high = this.#ctx.createBiquadFilter();
    high.type = 'highpass'; high.frequency.value = stream ? (mix.streamHighpass ?? 850) : 1250;
    const splash = this.#ctx.createBiquadFilter();
    splash.type = 'bandpass';
    splash.frequency.value = (mix.sprayCenter ?? 2450) + (variant % 5) * 310;
    splash.Q.value = stream ? 0.72 : 1.25;
    const sprayGain = this.#ctx.createGain();
    sprayGain.gain.setValueAtTime(0.0001, t);
    sprayGain.gain.exponentialRampToValueAtTime(peak, t + (stream ? 0.075 : 0.004));
    if (stream) {
      sprayGain.gain.setValueAtTime(peak * 0.76, t + dur * 0.32);
      sprayGain.gain.setValueAtTime(peak * 0.94, t + dur * 0.63);
      sprayGain.gain.setValueAtTime(peak * 0.58, t + dur * 0.86);
    }
    sprayGain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    spray.connect(high).connect(splash).connect(sprayGain).connect(output);

    if (stream) {
      // A second, narrow stream carries the bright granular detail.
      const needle = this.#ctx.createBiquadFilter();
      needle.type = 'bandpass'; needle.frequency.value = mix.needleFrequency ?? 5900; needle.Q.value = 2.4;
      const needleGain = this.#ctx.createGain();
      needleGain.gain.value = mix.needleLevel ?? 0.23;
      high.connect(needle).connect(needleGain).connect(sprayGain);
    }

    const drops = stream ? 3 : 1;
    for (let i = 0; i < drops; i++) {
      const dt = t + (stream ? dur * (0.24 + i * 0.27) : 0.012);
      const drop = this.#ctx.createOscillator();
      drop.type = 'sine';
      const f = 1120 + ((variant + i) % 5) * 170;
      drop.frequency.setValueAtTime(f, dt);
      drop.frequency.exponentialRampToValueAtTime(f * 0.44, dt + 0.055);
      const dropGain = this.#ctx.createGain();
      dropGain.gain.setValueAtTime(0.0001, dt);
      dropGain.gain.exponentialRampToValueAtTime(stream ? 0.032 : 0.048, dt + 0.002);
      dropGain.gain.exponentialRampToValueAtTime(0.0001, dt + 0.065);
      drop.connect(dropGain).connect(output);
      drop.start(dt); drop.stop(dt + 0.075);
    }

    spray.start(t, rand(0, 0.8)); spray.stop(t + dur + 0.025);
  }

  #scoreRestroomStep(step, t, s) {
    const r = s.profile.restroom;
    const pos = step % 16;
    const swung = pos % 2 ? t + s.stepDur * s.profile.swing : t;
    if (r.floor.includes(pos)) this.#scoreRestroomFart(swung, s.bus, Math.floor(step / 4), false);
    if (r.accents.includes(pos)) this.#scoreRestroomFart(swung, s.bus, step + 2, true);
    if (r.splashes.includes(pos)) this.#scoreRestroomPiss(swung, s.bus, step, false, r);
    // A quieter urinal stream every other bar keeps the shuffle without
    // turning the entire room score into a continuous sheet of white noise.
    const bar = Math.floor(step / 16);
    if (pos === 0 && bar % (r.streamEveryBars ?? 1) === 0) {
      this.#scoreRestroomPiss(swung + s.stepDur * 0.42, s.bus, bar, true, r);
    }
  }

  #scoreOfficeStep(step, t, s) {
    const office = s.profile.office;
    const pos = step % 16;
    const swung = pos % 2 ? t + s.stepDur * s.profile.swing : t;
    const drive = this.#roomScoreDrive;

    // Receipt-printer pin strikes: clipped, pitched ticks in anxious clusters.
    if (office.printer.includes(pos)) {
      const repeats = drive > 0.72 && pos % 2 ? 2 : 1;
      for (let i = 0; i < repeats; i++) {
        this.#scoreTone(swung + i * s.stepDur * 0.28, 1620 + ((step + i) % 5) * 155, {
          bus: s.bus, type: 'square', peak: 0.018 + drive * 0.012, attack: 0.002,
          decay: 0.026, cutoff: 5200, slide: 0.96,
        });
      }
    }
    // Auction gavel — a wooden low knock, never a club kick.
    if (office.gavel.includes(pos)) {
      this.#scoreTone(swung, 118, { bus: s.bus, type: 'triangle', peak: 0.12, attack: 0.002, decay: 0.11, cutoff: 460, slide: 0.52 });
      this.#scoreNoise(swung, { bus: s.bus, peak: 0.026, decay: 0.045, freq: 780, type: 'bandpass' });
    }
    // Elevator confirmation chimes remain calm while the valuation does not.
    if (office.chimes.includes(pos)) {
      const f = pos === 4 ? 659.25 : 783.99;
      this.#scoreTone(swung, f, { bus: s.bus, type: 'sine', peak: 0.027, attack: 0.006, decay: s.stepDur * 1.45, cutoff: 2400 });
    }
    // Short filtered shredder breath, kept sparse to preserve the groove.
    if (office.shredder.includes(pos) && (drive > 0.18 || step % 32 === 14)) {
      this.#scoreNoise(swung, { bus: s.bus, peak: 0.015 + drive * 0.014, decay: s.stepDur * (0.7 + drive * 0.7), freq: 980, type: 'bandpass' });
    }
    // Conservation air system: one restrained inhale per bar.
    if (pos === 15) this.#scoreNoise(swung, { bus: s.bus, peak: 0.009, decay: s.stepDur * 2.4, freq: 3800, type: 'lowpass' });
  }

  #scoreWaitingStep(step, t, s) {
    const waiting = s.profile.waiting;
    const pos = step % 16;
    const swung = pos % 2 ? t + s.stepDur * s.profile.swing : t;
    if (waiting.tickets.includes(pos)) {
      const base = pos === 0 ? 659.25 : 739.99;
      this.#scoreTone(swung, base, { bus: s.bus, type: 'sine', peak: 0.022, attack: 0.004, decay: s.stepDur * 0.9, cutoff: 2600 });
      this.#scoreTone(swung + 0.085, base * 1.5, { bus: s.bus, type: 'sine', peak: 0.012, attack: 0.004, decay: s.stepDur * 0.65, cutoff: 3100 });
    }
    if (waiting.belts.includes(pos)) {
      this.#scoreTone(swung, 205 + (pos % 4) * 18, { bus: s.bus, type: 'triangle', peak: 0.025, attack: 0.002, decay: 0.055, cutoff: 780, slide: 0.7 });
      this.#scoreNoise(swung, { bus: s.bus, peak: 0.012, decay: 0.035, freq: 2400, type: 'bandpass' });
    }
    if (waiting.hydraulics.includes(pos)) {
      this.#scoreTone(swung, 92, { bus: s.bus, type: 'sawtooth', peak: 0.034, attack: 0.012, decay: s.stepDur * 1.3, cutoff: 340, slide: 0.56 });
      this.#scoreNoise(swung, { bus: s.bus, peak: 0.014, decay: s.stepDur * 0.8, freq: 620, type: 'lowpass' });
    }
    if (waiting.drips.includes(pos)) {
      const freq = 1280 + (pos % 5) * 145;
      this.#scoreTone(swung + 0.025, freq, { bus: s.bus, type: 'sine', peak: 0.011, attack: 0.002, decay: 0.075, cutoff: 3600, slide: 0.46 });
    }
    if (waiting.strikeClaps.includes(pos)) {
      this.#scoreNoise(swung, { bus: s.bus, peak: 0.022, decay: 0.08, freq: 1250, type: 'bandpass' });
      this.#scoreNoise(swung + 0.035, { bus: s.bus, peak: 0.012, decay: 0.055, freq: 2100, type: 'highpass' });
    }
  }

  #roomScoreStep16(step, t, s) {
    const p = s.profile;
    const lofi = s.lofi;
    const pos = step % 16;
    const swung = pos % 2 ? t + s.stepDur * p.swing : t;

    if (p.restroom) {
      this.#scoreRestroomStep(step, t, s);
      return;
    }
    if (p.office) {
      this.#scoreOfficeStep(step, t, s);
      return;
    }
    if (p.waiting) this.#scoreWaitingStep(step, t, s);

    if (p.kick.includes(pos)) {
      this.#scoreTone(swung, 145, { bus: s.bus, peak: (p.kickLevel ?? 0.56) * ROOM_SCORE_FEEL.percussionScale, decay: 0.22, cutoff: 500, slide: 0.24 });
    }
    if (p.snare.includes(pos)) this.#scoreNoise(swung, { bus: s.bus, peak: (p.snareLevel ?? 0.12) * ROOM_SCORE_FEEL.percussionScale, decay: 0.12, freq: 1100, type: 'bandpass' });
    if (p.hats.includes(pos)) this.#scoreNoise(swung, { bus: s.bus, peak: (p.hatLevel ?? 0.045) * ROOM_SCORE_FEEL.percussionScale, decay: 0.045, freq: 6500 });

    if (pos % 2 === 0) {
      const semi = p.bass[pos / 2];
      if (semi !== null && semi !== undefined) {
        const freq = p.root * Math.pow(2, semi / 12);
        this.#scoreTone(swung, freq, {
          bus: s.bus,
          type: p.bassWave,
          peak: (p.bassLevel ?? 0.16) * ROOM_SCORE_FEEL.bassScale,
          decay: s.stepDur * (p.bassDecay ?? 1.7),
          cutoff: Math.min(p.cutoff, 520),
          slide: p.bassSlide ?? (s.key === 'vault' ? 0.92 : 1),
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
        peak: (p.leadLevel ?? 0.035) * ROOM_SCORE_FEEL.leadScale,
        attack: lofi ? (lofi.leadAttack ?? 0.022) : 0.006,
        decay: s.stepDur * (s.key === 'dildoBall' ? 3 : lofi ? (lofi.leadDecay ?? 1.75) : 1.35),
        cutoff: p.cutoff * (lofi ? (lofi.cutoffScale ?? 1.2) : 1.4),
        slide: s.key === 'maxPro' ? 1.06 : 1,
        detune: lofi ? rand(-(lofi.detune ?? 7), lofi.detune ?? 7) : 0,
      });
    }

    if (p.texture > 0 && pos === 15 && Math.random() < p.texture * ROOM_SCORE_FEEL.textureScale) {
      this.#scoreNoise(swung, { bus: s.bus, peak: 0.04, decay: s.stepDur * 4, freq: 2600, type: 'bandpass' });
    }

    if (p.jazz?.steps.includes(step)) {
      this.#scoreJazzChord(swung, s, p.jazz, p.jazz.steps.indexOf(step));
    }
    if (p.vocal?.steps.includes(step)) {
      this.#scoreVocalMoan(swung, s, p.vocal, p.vocal.steps.indexOf(step));
    }
    if (p.rap?.steps.includes(step)) {
      this.#scoreRapChop(swung, s, p.rap, p.rap.steps.indexOf(step));
    }
  }

  /* ---------------- the listening room's recorded ad-lib ---------------- */

  /** Lazily fetch and decode the singer's sample; cached across calls. */
  #loadSingerBuffer() {
    if (!this.#ctx) return Promise.resolve(null);
    if (!this.#singerBufferPromise) {
      this.#singerBufferPromise = fetch(encodeURI(SINGER_VOCAL_URL))
        .then((res) => res.arrayBuffer())
        .then((data) => this.#ctx.decodeAudioData(data))
        .catch(() => null);
    }
    return this.#singerBufferPromise;
  }

  /** A synthetic impulse response: exponentially-decaying stereo noise,
      cheap to build and plenty convincing for a small live room. */
  #singerReverbImpulse() {
    if (this.#singerReverbBuffer) return this.#singerReverbBuffer;
    const rate = this.#ctx.sampleRate;
    const len = Math.floor(rate * 2.2);
    const buffer = this.#ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
      }
    }
    this.#singerReverbBuffer = buffer;
    return buffer;
  }

  /** The singer's recorded ad-lib: dry call, a tiny slapback, and a wash of
      reverb tail — the same sample the house band keeps returning to. */
  async singerVocal() {
    if (!this.#ctx) return;
    const buffer = await this.#loadSingerBuffer();
    if (!buffer || !this.#ctx) return;

    const t = this.#ctx.currentTime + 0.02;
    const src = this.#ctx.createBufferSource();
    src.buffer = buffer;

    const dry = this.#ctx.createGain();
    dry.gain.value = 0.85;
    src.connect(dry).connect(this.#master);

    // tiny delay: a short slapback, one soft repeat
    const delay = this.#ctx.createDelay(0.5);
    delay.delayTime.value = 0.09;
    const delayGain = this.#ctx.createGain();
    delayGain.gain.value = 0.22;
    const delayFeedback = this.#ctx.createGain();
    delayFeedback.gain.value = 0.16;
    src.connect(delay);
    delay.connect(delayGain).connect(this.#master);
    delay.connect(delayFeedback).connect(delay);

    // reverb: convolved tail, darkened so it sits behind the dry call
    const convolver = this.#ctx.createConvolver();
    convolver.buffer = this.#singerReverbImpulse();
    const reverbFilter = this.#ctx.createBiquadFilter();
    reverbFilter.type = 'lowpass';
    reverbFilter.frequency.value = 3600;
    const reverbGain = this.#ctx.createGain();
    reverbGain.gain.value = 0.4;
    src.connect(convolver).connect(reverbFilter).connect(reverbGain).connect(this.#master);

    src.start(t);
  }

  /** Lazily decode the shared Three Fart Boxes recording. */
  #loadFartBoxBuffer() {
    if (!this.#ctx) return Promise.resolve(null);
    if (!this.#fartBoxBufferPromise) {
      this.#fartBoxBufferPromise = fetch(encodeURI(FART_BOX_SAMPLE_URL))
        .then((res) => res.arrayBuffer())
        .then((data) => this.#ctx.decodeAudioData(data))
        .catch(() => null);
    }
    return this.#fartBoxBufferPromise;
  }

  /** Play the same recording through one effect per box:
      0 = reverb, 1 = delay, 2 = distortion. */
  async fartBoxSample(effectIndex = 0) {
    if (!this.#ctx) return;
    const effect = Math.abs(effectIndex) % 3;
    const buffer = await this.#loadFartBoxBuffer();
    if (!buffer || !this.#ctx) {
      this.punkFart(effect);
      return;
    }

    try { this.#fartBoxSources[effect]?.stop(); } catch {}
    const src = this.#ctx.createBufferSource();
    src.buffer = buffer;
    this.#fartBoxSources[effect] = src;
    src.addEventListener('ended', () => {
      if (this.#fartBoxSources[effect] === src) this.#fartBoxSources[effect] = null;
    });

    if (effect === 0) {
      const dry = this.#ctx.createGain(); dry.gain.value = 0.24;
      const convolver = this.#ctx.createConvolver(); convolver.buffer = this.#singerReverbImpulse();
      const dark = this.#ctx.createBiquadFilter(); dark.type = 'lowpass'; dark.frequency.value = 3100;
      const wet = this.#ctx.createGain(); wet.gain.value = 0.72;
      src.connect(dry).connect(this.#master);
      src.connect(convolver).connect(dark).connect(wet).connect(this.#master);
    } else if (effect === 1) {
      const dry = this.#ctx.createGain(); dry.gain.value = 0.4;
      const delay = this.#ctx.createDelay(1.0); delay.delayTime.value = 0.27;
      const feedback = this.#ctx.createGain(); feedback.gain.value = 0.38;
      const wet = this.#ctx.createGain(); wet.gain.value = 0.52;
      const dark = this.#ctx.createBiquadFilter(); dark.type = 'lowpass'; dark.frequency.value = 2800;
      src.connect(dry).connect(this.#master);
      src.connect(delay).connect(dark).connect(wet).connect(this.#master);
      delay.connect(feedback).connect(delay);
    } else {
      const shaper = this.#ctx.createWaveShaper();
      const curve = new Float32Array(1024);
      for (let i = 0; i < curve.length; i++) {
        const x = (i / (curve.length - 1)) * 2 - 1;
        curve[i] = Math.tanh(x * 7.5);
      }
      shaper.curve = curve; shaper.oversample = '4x';
      const filter = this.#ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 2200;
      const output = this.#ctx.createGain(); output.gain.value = 0.48;
      src.connect(shaper).connect(filter).connect(output).connect(this.#master);
    }

    src.start(this.#ctx.currentTime + 0.012);
  }

  /* ---------------- game verbs ---------------- */

  restroomFart(variant = 0) {
    if (this.#ctx) this.#scoreRestroomFart(this.#ctx.currentTime + 0.012, this.#master, variant, false);
  }

  restroomPiss(variant = 0) {
    if (this.#ctx) this.#scoreRestroomPiss(this.#ctx.currentTime + 0.012, this.#master, variant, true);
  }

  museumAlarm(variant = 0) {
    if (!this.#ctx) return;
    this.#tone({ freq: 740 + (variant % 3) * 70, type: 'square', peak: 0.09, decay: 0.12 });
    setTimeout(() => this.#tone({ freq: 540 + (variant % 2) * 80, type: 'square', peak: 0.075, decay: 0.14 }), 135);
  }

  valuationStamp(variant = 0) {
    this.#noise({ peak: 0.075, decay: 0.055, filterFreq: 760 + variant * 90, q: 4, type: 'bandpass' });
    this.#tone({ freq: 132 + variant * 8, type: 'triangle', peak: 0.065, decay: 0.09 });
  }

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

  documentaShutter(corrupted = false) {
    this.#noise({ peak: corrupted ? 0.13 : 0.09, decay: 0.035, filterFreq: 5200, filterEnd: 1600, q: 1.6, type: 'bandpass' });
    this.#tone({ freq: corrupted ? 1880 : 1420, freqEnd: corrupted ? 740 : 980, type: 'square', peak: 0.035, decay: 0.045 });
  }

  documentaPaper() {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => this.#noise({ peak: 0.075, decay: 0.09, filterFreq: 2600 + i * 450, filterEnd: 620, q: 0.8, type: 'bandpass' }), i * 58);
    }
    this.#tone({ freq: 96, freqEnd: 72, type: 'square', peak: 0.045, decay: 0.24 });
  }

  documentaScanner() {
    [620, 930, 1395, 465].forEach((freq, i) => {
      setTimeout(() => this.#tone({ freq, freqEnd: freq * 1.04, type: 'sine', peak: 0.065, decay: 0.12 }), i * 82);
    });
    this.#noise({ peak: 0.08, decay: 0.48, filterFreq: 1750, filterEnd: 420, q: 1.8, type: 'bandpass' });
  }

  metadataCollapse(outcome = 'corrupt') {
    const freqs = outcome === 'release' ? [440, 660, 880] : outcome === 'destroy' ? [190, 132, 74] : [740, 555, 1110, 370];
    freqs.forEach((freq, i) => {
      setTimeout(() => this.#tone({ freq, freqEnd: outcome === 'destroy' ? freq * 0.45 : freq * 1.03, type: outcome === 'release' ? 'sine' : 'square', peak: 0.09, decay: 0.3 }), i * 85);
    });
    if (outcome === 'destroy') this.#noise({ peak: 0.22, decay: 0.7, filterFreq: 4800, filterEnd: 180, q: 0.7, type: 'highpass' });
  }

  waitingTicket(variant = 0) {
    const base = [740, 830, 622, 554][Math.abs(variant) % 4];
    this.#tone({ freq: base, freqEnd: base * 1.012, type: 'sine', peak: 0.065, decay: 0.16 });
    setTimeout(() => this.#tone({ freq: base * 1.5, type: 'sine', peak: 0.045, decay: 0.13 }), 115);
    this.#noise({ peak: 0.03, decay: 0.08, filterFreq: 2700, filterEnd: 920, q: 1.4, type: 'bandpass' });
  }

  waitingAdvance(variant = 0) {
    const freq = 170 + (Math.abs(variant) % 4) * 28;
    this.#tone({ freq, freqEnd: freq * 0.72, type: 'triangle', peak: 0.07, decay: 0.18 });
    this.#noise({ peak: 0.055, decay: 0.12, filterFreq: 1850, filterEnd: 430, q: 1.1, type: 'bandpass' });
  }

  waitingAbandon() {
    this.#noise({ peak: 0.13, decay: 0.055, filterFreq: 6200, filterEnd: 1800, q: 1.8, type: 'bandpass' });
    setTimeout(() => this.#noise({ peak: 0.085, decay: 0.04, filterFreq: 5100, filterEnd: 1500, q: 1.5, type: 'bandpass' }), 92);
    this.#tone({ freq: 310, freqEnd: 146, type: 'square', peak: 0.052, decay: 0.25 });
  }

  waitingCollapse(variant = 0) {
    const base = 128 - (Math.abs(variant) % 4) * 11;
    [1, 0.82, 0.58].forEach((ratio, i) => setTimeout(() => {
      this.#tone({ freq: base * ratio, freqEnd: base * ratio * 0.55, type: 'sawtooth', peak: 0.075, decay: 0.3 });
      this.#noise({ peak: 0.055, decay: 0.2, filterFreq: 1500 - i * 260, filterEnd: 180, q: 0.8, type: 'bandpass' });
    }, i * 90));
  }

  waitingWinner() {
    [392, 523.25, 659.25, 783.99].forEach((freq, i) => setTimeout(() => {
      this.#tone({ freq, type: 'sine', peak: 0.085, attack: 0.012, decay: 0.42 });
    }, i * 105));
    setTimeout(() => this.#noise({ peak: 0.09, decay: 0.48, filterFreq: 4200, filterEnd: 680, q: 0.7, type: 'bandpass' }), 330);
  }

  nowOrNeverFlap(variant = 0) {
    const base = [310, 370, 440, 523][Math.abs(variant) % 4];
    this.#noise({ peak: 0.045, decay: 0.035, filterFreq: 3400, filterEnd: 920, q: 1.5, type: 'bandpass' });
    this.#tone({ freq: base, freqEnd: base * 0.92, type: 'square', peak: 0.028, decay: 0.055 });
  }

  nowOrNeverAnnouncement(variant = 0) {
    const notes = [659.25, 783.99, 987.77, 523.25];
    const base = notes[Math.abs(variant) % notes.length];
    [base, base * 1.25].forEach((freq, i) => setTimeout(() => {
      this.#tone({ freq, type: 'sine', peak: 0.045, attack: 0.008, decay: 0.18 });
    }, i * 105));
    this.#noise({ peak: 0.022, decay: 0.18, filterFreq: 1800, filterEnd: 520, q: 1.1, type: 'bandpass' });
  }

  /** A short two-formant boxer moan. It is fully synthesized: pitched throat,
      vowel resonances, breath, pitch drop and an uneven vibrato after impact. */
  #boxingMoan(voice = 0, hard = false) {
    if (!this.#ctx) return;
    const t = this.#ctx.currentTime + 0.006;
    const dur = hard ? 0.58 : 0.42;
    const base = voice % 2 ? 126 : 102;
    const throat = this.#ctx.createOscillator();
    throat.type = voice % 2 ? 'triangle' : 'sawtooth';
    throat.frequency.setValueAtTime(base * 1.12, t);
    throat.frequency.exponentialRampToValueAtTime(base * 0.78, t + dur * 0.48);
    throat.frequency.exponentialRampToValueAtTime(base * 0.9, t + dur);

    const vibrato = this.#ctx.createOscillator();
    vibrato.type = 'sine';
    vibrato.frequency.value = 5.1 + voice * 0.7;
    const vibratoDepth = this.#ctx.createGain();
    vibratoDepth.gain.setValueAtTime(3, t);
    vibratoDepth.gain.linearRampToValueAtTime(hard ? 12 : 8, t + dur * 0.7);
    vibrato.connect(vibratoDepth).connect(throat.frequency);

    const mouth = this.#ctx.createGain();
    mouth.gain.setValueAtTime(0.0001, t);
    mouth.gain.exponentialRampToValueAtTime(hard ? 0.072 : 0.056, t + 0.045);
    mouth.gain.setValueAtTime(hard ? 0.064 : 0.048, t + dur * 0.55);
    mouth.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    mouth.connect(this.#master);

    const vowels = voice % 2
      ? [[610, 720], [1080, 920]]
      : [[480, 620], [890, 1040]];
    for (let i = 0; i < vowels.length; i++) {
      const formant = this.#ctx.createBiquadFilter();
      formant.type = 'bandpass';
      formant.frequency.setValueAtTime(vowels[i][0], t);
      formant.frequency.exponentialRampToValueAtTime(vowels[i][1], t + dur * 0.82);
      formant.Q.value = i ? 7.2 : 5.1;
      const formantGain = this.#ctx.createGain();
      formantGain.gain.value = i ? 0.58 : 1;
      throat.connect(formant).connect(formantGain).connect(mouth);
    }

    const breath = this.#ctx.createBufferSource();
    breath.buffer = this.#noiseBuffer;
    const breathFilter = this.#ctx.createBiquadFilter();
    breathFilter.type = 'bandpass';
    breathFilter.frequency.value = voice % 2 ? 1180 : 880;
    breathFilter.Q.value = 1.1;
    const breathGain = this.#ctx.createGain();
    breathGain.gain.setValueAtTime(0.0001, t);
    breathGain.gain.exponentialRampToValueAtTime(hard ? 0.026 : 0.018, t + 0.025);
    breathGain.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.72);
    breath.connect(breathFilter).connect(breathGain).connect(this.#master);

    throat.start(t); vibrato.start(t); breath.start(t, rand(0, 0.8));
    throat.stop(t + dur + 0.02); vibrato.stop(t + dur + 0.02); breath.stop(t + dur + 0.02);
  }

  /** MAX PRO's ring: leather glove thud, broadcast chirp and a hit moan. */
  boxingImpact(variant = 0, victim = 0) {
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
      this.#boxingMoan(victim, hard);
      if (hard) this.#tone({ freq: 74, freqEnd: 118, type: 'sawtooth', peak: 0.06, attack: 0.03, decay: 0.24 });
    }, 32);
  }

  /** The cape-wearing nuisance gets a short, cartoonishly weary groan. */
  annoyingMoan(variant = 0) {
    if (!this.#ctx) return;
    this.#boxingMoan(variant % 2, false);
  }

  /** Short rotating vocal punctuation for the Glass Boxes pole performers. */
  clubMoan(variant = 0) {
    if (!this.#ctx) return;
    this.#boxingMoan((variant + 1) % 2, false);
  }

  /** A cheap, ugly impact for the room where emotional regulation goes to die. */
  rageBreak(variant = 0) {
    if (!this.#ctx) return;
    this.#noise({
      peak: 0.28 + (variant % 3) * 0.03,
      decay: 0.22,
      filterFreq: 4200,
      filterEnd: 180,
      q: 1.2,
      type: 'highpass',
    });
    this.#tone({ freq: 210 + variant * 40, freqEnd: 72, type: 'triangle', peak: 0.16, decay: 0.22 });
  }

  /** Live death-metal punctuation: kick, amp feedback, and a tiny pink alarm. */
  deathMetalHit(variant = 0) {
    if (!this.#ctx) return;
    this.#noise({ peak: 0.12, attack: 0.001, decay: 0.075, filterFreq: 5400, filterEnd: 900, q: 1.3, type: 'highpass' });
    this.#tone({ freq: 52 + (variant % 2) * 9, freqEnd: 36, type: 'sawtooth', peak: 0.15, decay: 0.14 });
    if (variant % 3 === 0) this.#tone({ freq: 1480, freqEnd: 720, type: 'square', peak: 0.022, attack: 0.002, decay: 0.08 });
  }

  /** The roaming punk's deliberate, low-frequency social intervention. */
  punkFart(variant = 0) {
    if (!this.#ctx) return;
    this.#scoreRestroomFart(this.#ctx.currentTime + 0.012, this.#master, variant, false);
    this.#tone({ freq: 118 + (variant % 3) * 11, freqEnd: 54, type: 'triangle', peak: 0.045, decay: 0.24 });
  }

  /** The forest boars sound less like animals than wet kitchen sponges being
      squeezed inside a rubber glove. That is deliberate. */
  boarSqueak(variant = 0) {
    if (!this.#ctx) return;
    const base = 520 + (variant % 4) * 95;
    this.#tone({
      freq: base * 0.72,
      freqEnd: base * 1.42,
      type: 'square',
      peak: 0.045,
      attack: 0.012,
      decay: 0.09 + (variant % 3) * 0.025,
    });
    this.#noise({
      peak: 0.055,
      attack: 0.004,
      decay: 0.13,
      filterFreq: 1180 + variant * 70,
      filterEnd: 430,
      q: 5.2,
      type: 'bandpass',
    });
    setTimeout(() => this.#tone({
      freq: base * 1.1,
      freqEnd: base * 0.63,
      type: 'triangle',
      peak: 0.035,
      attack: 0.006,
      decay: 0.08,
    }), 55);
  }

  forestIgnite() {
    this.#noise({ peak: 0.22, attack: 0.025, decay: 1.15, filterFreq: 2900, filterEnd: 360, q: 0.7, type: 'bandpass' });
    this.#tone({ freq: 94, freqEnd: 42, type: 'sawtooth', peak: 0.12, attack: 0.02, decay: 0.7 });
  }

  gasolinePour() {
    this.#noise({ peak: 0.11, attack: 0.08, decay: 0.72, filterFreq: 1250, filterEnd: 310, q: 1.8, type: 'bandpass' });
    this.#tone({ freq: 118, freqEnd: 72, type: 'sine', peak: 0.035, attack: 0.04, decay: 0.58 });
  }

  lighterClick() {
    this.#noise({ peak: 0.08, attack: 0.001, decay: 0.035, filterFreq: 5200, filterEnd: 1900, q: 3.4, type: 'highpass' });
    this.#tone({ freq: 1840, freqEnd: 960, type: 'square', peak: 0.025, attack: 0.001, decay: 0.04 });
  }

  churchCrackle(variant = 0, burningCount = 1) {
    const level = Math.min(0.12, 0.035 + burningCount * 0.009);
    this.#noise({
      peak: level,
      attack: 0.001,
      decay: 0.045 + (variant % 3) * 0.028,
      filterFreq: 1750 + variant * 610,
      filterEnd: 420,
      q: 1.2,
      type: 'bandpass',
    });
    if (variant % 3 === 0) {
      this.#tone({ freq: 210 + variant * 33, freqEnd: 74, type: 'triangle', peak: level * 0.42, attack: 0.002, decay: 0.09 });
    }
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

  stopTechno(fadeMs = 500) {
    const s = this.#techno;
    if (!s) return;
    this.#techno = null;
    clearInterval(s.timer);
    if (!this.#ctx) return;
    const t = this.#ctx.currentTime;
    s.bus.gain.cancelScheduledValues(t);
    const fadeSeconds = Math.max(0, fadeMs) / 1000;
    s.bus.gain.setValueAtTime(Math.max(s.bus.gain.value, 0.0001), t);
    s.bus.gain.linearRampToValueAtTime(0.0001, t + fadeSeconds);
    const kill = t + fadeSeconds + 0.05;
    s.padOscs.forEach((o) => o.stop(kill));
    try { s.lfo.stop(kill); s.wob.stop(kill); } catch { /* already gone */ }
    setTimeout(() => { try { s.bus.disconnect(); } catch { /* garnish */ } }, Math.max(80, fadeMs + 100));
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

  stopJazz(immediate = false, fadeMs = null) {
    this.#jazzRequested = false;
    const s = this.#jazz;
    if (!s) return;
    this.#jazz = null;
    clearInterval(s.timer);
    if (!this.#ctx) return;
    const t = this.#ctx.currentTime;
    s.bus.gain.cancelScheduledValues(t);
    const fadeSeconds = Math.max(0, fadeMs ?? (immediate ? 0 : 900)) / 1000;
    if (immediate || fadeSeconds === 0) s.bus.gain.setValueAtTime(0.0001, t);
    else {
      s.bus.gain.setValueAtTime(Math.max(s.bus.gain.value, 0.0001), t);
      s.bus.gain.linearRampToValueAtTime(0.0001, t + fadeSeconds);
    }
    try { s.hushSrc.stop(t + fadeSeconds + 0.02); } catch { /* already gone */ }
    setTimeout(() => { try { s.bus.disconnect(); } catch { /* garnish */ } }, Math.max(80, fadeSeconds * 1000 + 100));
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
