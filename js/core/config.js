/**
 * config.js — every tunable number in the game lives here.
 * If a designer wants to change feel, they never leave this file.
 */

export const PLAYER = {
  eyeHeight: 1.62,
  radius: 0.34,
  walkSpeed: 4.1,
  sprintMultiplier: 1.45,
  accel: 14,          // damp lambda for velocity
  lookBase: 0.0021,   // radians per px at sensitivity 1
  pitchLimit: Math.PI / 2 - 0.08,
  interactRange: 2.6,
  headBob: { freq: 8.6, amp: 0.028 },
};

export const SWING = {
  range: 2.35,
  arcDot: 0.62,        // cos of allowed angle vs camera forward
  cooldown: 0.42,      // seconds
  heatOnNPC: 14,
  heatDecayPerSec: 0.55,
  banThreshold: 100,   // heat at which a gallery bans you
};

export const DUEL = {
  // tone damage model: base range, modified by npc weakness/resistance
  base: { kind: [10, 16], witty: [16, 24], brutal: [26, 40] },
  weakMultiplier: 1.6,
  resistMultiplier: 0.25,
  counterDamage: { fame: 6, soul: 4 },  // what a resisted clapback costs you
  brutalHeat: 9,
  brutalSoulCost: 3,
  wittyFame: 4,
  kindSoul: 3,
  roundsBeforeDismiss: 4,   // npcs get bored after this many unanswered jabs
  quickWitBonus: 1,         // extra virtue point for answering before the line finishes typing
};

export const PAINT = {
  palette: [
    '#1f2430', '#4a2c2a', '#8c3b2e', '#c96f2e',
    '#e8c15a', '#efe9dc', '#7fb285', '#2e5f4a',
    '#3b6ea5', '#2b3a67', '#8a5cf6', '#d98cff',
  ],
  brushSizes: [4, 9, 16, 26, 40],
  defaultBrushIndex: 2,
  flowBuildRate: 0.16,   // per second of unbroken stroke
  flowDecayRate: 0.35,
  canvas: { width: 768, height: 960 },
  // quality: coverage + stroke variety + peak flow → 0..100
  qualityWeights: { coverage: 46, variety: 30, flow: 24 },
};

export const VIRTUES = [
  { key: 'vision',     name: 'Vision',     corrupted: 'Branding' },
  { key: 'craft',      name: 'Craft',      corrupted: 'Content' },
  { key: 'integrity',  name: 'Integrity',  corrupted: 'Networking' },
  { key: 'honesty',    name: 'Honesty',    corrupted: 'Hype' },
  { key: 'sacrifice',  name: 'Sacrifice',  corrupted: 'Exposure' },
  { key: 'humility',   name: 'Humility',   corrupted: 'Personal Brand' },
  { key: 'compassion', name: 'Compassion', corrupted: 'PR Strategy' },
  { key: 'valor',      name: 'Valor',      corrupted: 'Edginess' },
];
export const VIRTUE_START = -15;  // the world arrives pre-corrupted
export const VIRTUE_MIN = -100;
export const VIRTUE_MAX = 100;

export const METERS = {
  fame:  { start: 4,  min: 0, max: 100 },
  soul:  { start: 50, min: 0, max: 100 },  // rendered as "INTEGRITY" in HUD
  cash:  { start: 12, min: 0, max: 100 },
  heat:  { start: 0,  min: 0, max: 100 },
};

export const ZONES = {
  garret:      { name: 'THE GARRET',       mood: 'garret' },
  galleria:    { name: 'GALLERIA BIANCA',   mood: 'galleria' },
  vault:       { name: 'THE VAULT',         mood: 'vault' },
  documenta:   { name: 'DOCUMENTA: THE DOCUMENTING', mood: 'documenta' },
  invisibleCollection: { name: 'THE INVISIBLE COLLECTION', mood: 'galleria' },
  leatherLatex: { name: 'THE LEATHER & LATEX ROOMS', mood: 'leatherLatex' },
  gildedFork:  { name: 'THE GILDED FORK',   mood: 'gildedFork' },
  maxPro:      { name: 'MAX PRO KUNST 2000', mood: 'galleria' },
  dildoBall:   { name: 'THE DILDO BALL',    mood: 'off' },
  daylightClub: { name: 'THE DAYLIGHT FLESH GARDEN', mood: 'leatherLatex' },
  upAndCumming: { name: 'UP AND CUMMING ARTIST', mood: 'galleria' },
  vacantEditions: { name: 'VACANT EDITIONS', mood: 'galleria' },
  hairSalon: { name: 'U WISH U HAD HAIR BUT U DONT', mood: 'galleria' },
  rageRoom: { name: 'THE GLASS BOXES', mood: 'rageRoom' },
  deathMetal: { name: 'BARBIE DEATH METAL', mood: 'deathMetal' },
  blackForest: { name: 'CHURCH BURNING FIRE SENSATION COCKBURN', mood: 'blackForest' },
  publicRestroom: { name: 'THE PUBLIC RESTROOM', mood: 'off' },
  listeningRoom: { name: 'THE LISTENING ROOM', mood: 'galleria' },
  mtvCribs: { name: 'MTV CRIBS: BABY MONEY', mood: 'leatherLatex' },
};

/**
 * Coded room identities. Patterns are one 16-step bar; bass values are
 * semitone offsets from root and lead values are indexes into scale.
 */
export const ROOM_SCORE_FEEL = {
  tempoScale: 0.9,
  levelScale: 0.92,
  percussionScale: 0.84,
  bassScale: 0.9,
  leadScale: 0.78,
  textureScale: 0.55,
};

export const ROOM_SCORES = {
  garret: {
    bpm: 82, level: 0.28, root: 55, scale: [0, 3, 5, 7, 10, 12],
    wave: 'triangle', bassWave: 'sine', cutoff: 820, pad: [0, 3, 7, 10],
    bass: [0, null, 0, 7, null, 3, 0, null], lead: [null, null, 4, null, null, 2, null, 5, null, null, 1, null, null, 3, null, null],
    kick: [0, 8], snare: [4, 12], hats: [2, 6, 10, 14], swing: 0.08, texture: 0.08,
  },
  galleria: {
    bpm: 118, level: 0.27, root: 73.42, scale: [0, 2, 4, 7, 9, 11, 14],
    wave: 'sine', bassWave: 'triangle', cutoff: 2400, pad: [0, 4, 7, 11],
    bass: [0, 0, 7, 0, 9, 7, 4, 11], lead: [6, null, 4, null, 2, null, 5, 3, null, 1, null, 4, 2, null, 5, null],
    kick: [0, 4, 8, 12], snare: [4, 12], hats: [2, 6, 10, 14], swing: 0, texture: 0.03,
  },
  vault: {
    bpm: 70, level: 0.36, root: 36.71, scale: [0, 1, 5, 6, 7, 10, 12],
    wave: 'square', bassWave: 'sawtooth', cutoff: 360, pad: [0, 1, 6, 10],
    bass: [0, null, 0, 1, null, 6, 0, -5], lead: [null, null, null, 3, null, null, 1, null, null, 4, null, null, null, 2, null, 5],
    kick: [0, 3, 8, 11], snare: [6, 14], hats: [1, 5, 9, 13], swing: 0.03, texture: 0.22,
  },
  blackForest: {
    // Original lo-fi black-metal / dark-ambient room score: cold semitone
    // harmony, tremolo-like lead repetition, blast texture, and forest hiss.
    bpm: 156, level: 0.23, root: 36.71, scale: [0, 1, 5, 6, 10, 12, 13],
    wave: 'sawtooth', bassWave: 'triangle', cutoff: 1120, pad: [0, 1, 6, 10],
    bass: [0, 0, 6, 6, 1, 1, -5, -5], lead: [4, 1, 4, 1, 5, 2, 5, 2, 6, 3, 6, 3, 4, 1, 5, 2],
    kick: [0, 2, 4, 6, 8, 10, 12, 14], snare: [1, 3, 5, 7, 9, 11, 13, 15], hats: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], swing: 0, texture: 0.68,
    kickLevel: 0.18, snareLevel: 0.038, hatLevel: 0.014,
    bassLevel: 0.078, bassDecay: 0.74, leadLevel: 0.016,
    lofi: {
      hissLevel: 0.016, hissHighpass: 150, hissLowpass: 4200,
      wowRate: 0.17, wowDepth: 72, detune: 14,
      leadAttack: 0.008, leadDecay: 0.42, cutoffScale: 0.94,
    },
  },
  leatherLatex: {
    bpm: 126, level: 0.34, root: 55, scale: [0, 3, 5, 7, 10, 12, 15],
    wave: 'sawtooth', bassWave: 'sawtooth', cutoff: 1050, pad: [0, 3, 7, 10],
    bass: [0, 0, 12, 0, 7, 0, 3, 0], lead: [null, 0, null, 2, null, 1, 4, null, null, 3, null, 2, 5, null, 1, null],
    kick: [0, 4, 8, 12], snare: [4, 12], hats: [2, 6, 10, 14, 15], swing: 0, texture: 0.12,
  },
  gildedFork: {
    bpm: 108, level: 0.29, root: 65.41, scale: [0, 2, 4, 7, 9, 12, 14],
    wave: 'triangle', bassWave: 'square', cutoff: 1750, pad: [0, 4, 7, 9],
    bass: [0, 7, 4, 9, 0, 12, 7, 4], lead: [5, null, 3, 1, null, 4, 2, null, 6, 4, null, 2, 0, null, 3, 1],
    kick: [0, 6, 8, 14], snare: [4, 12], hats: [2, 5, 7, 10, 13, 15], swing: 0.12, texture: 0.05,
  },
  maxPro: {
    bpm: 138, level: 0.25, root: 61.74, scale: [0, 1, 4, 6, 8, 11, 13],
    wave: 'square', bassWave: 'triangle', cutoff: 3200, pad: [0, 1, 6, 8],
    bass: [0, 6, null, 1, 8, null, 13, 4], lead: [6, 0, null, 5, 1, null, 4, 2, null, 6, 3, null, 0, 5, null, 1],
    kick: [0, 5, 8, 10, 14], snare: [3, 7, 12, 15], hats: [1, 2, 6, 9, 11, 13], swing: 0.02, texture: 0.18,
  },
  dildoBall: {
    bpm: 96, level: 0.3, root: 43.65, scale: [0, 3, 5, 7, 10, 12, 14],
    wave: 'sine', bassWave: 'triangle', cutoff: 1450, pad: [0, 3, 7, 10, 14],
    bass: [0, null, 7, 10, 3, null, 12, 5], lead: [null, 5, null, 2, 6, null, 3, null, 1, null, 4, 2, null, 6, null, 3],
    kick: [0, 7, 11], snare: [4, 12, 15], hats: [0, 3, 7, 10, 13], swing: 0.2, texture: 0.1,
  },
  daylightClub: {
    // Sun-warmed experimental jazz-electronica: dusty drums and tape wobble
    // underneath crooked electric chords and a wordless formant voice.
    bpm: 108, level: 0.31, root: 49, scale: [0, 2, 3, 7, 9, 10, 14],
    wave: 'triangle', bassWave: 'sine', cutoff: 980, pad: [0, 3, 7, 10],
    bass: [0, null, 0, 7, 3, null, 10, 2], lead: [null, 5, null, 1, null, 3, null, 2, null, 4, null, 0, null, 2, 6, null],
    kick: [0, 4, 8, 12], snare: [4, 12], hats: [2, 6, 10, 14], swing: 0.11, texture: 0.38,
    kickLevel: 0.4, snareLevel: 0.075, hatLevel: 0.026,
    bassLevel: 0.115, bassDecay: 1.85, leadLevel: 0.028,
    lofi: {
      hissLevel: 0.009, hissHighpass: 620, hissLowpass: 5600,
      wowRate: 0.21, wowDepth: 44, detune: 7,
      leadAttack: 0.022, leadDecay: 1.75, cutoffScale: 1.2,
    },
    jazz: {
      steps: [2, 10, 19, 29, 34, 42, 51, 61],
      chords: [[0, 3, 7, 10], [2, 5, 9, 12], [-2, 2, 5, 9], [0, 4, 7, 11]],
      octave: 2, level: 0.014, attack: 0.055, decaySteps: 7.2,
      cutoff: 1850, spread: 0.014,
    },
    vocal: {
      steps: [7, 27, 43, 59], notes: [10, 7, 14, 9],
      durationSteps: [10, 13, 9, 15], octave: 2, level: 0.032,
      vibratoRate: 5.1, vibratoDepth: 18, glide: 0.91,
      // Each gesture morphs from one two-formant vowel into another.
      vowels: [[760, 1180, 520, 880], [540, 920, 730, 1220],
        [820, 1280, 610, 980], [620, 1040, 470, 820]],
    },
  },
  upAndCumming: {
    // Original woozy trap remix: sliding sub, half-time drums, cold bell
    // fragments, tape air, and synthetic rapper-like chops with no words.
    bpm: 142, level: 0.27, root: 32.7, scale: [0, 3, 5, 7, 10, 12, 15],
    wave: 'sine', bassWave: 'sine', cutoff: 1750, pad: [0, 3, 7, 10],
    bass: [0, null, -2, null, 5, 3, null, -5], lead: [5, null, null, 2, null, null, 4, null, null, 1, null, null, 6, null, 3, null],
    kick: [0, 7, 10, 14], snare: [8], hats: [2, 4, 6, 10, 12, 14, 15], swing: 0.06, texture: 0.32,
    kickLevel: 0.54, snareLevel: 0.1, hatLevel: 0.032,
    bassLevel: 0.19, bassDecay: 3.8, bassSlide: 0.78, leadLevel: 0.026,
    lofi: {
      hissLevel: 0.006, hissHighpass: 520, hissLowpass: 5100,
      wowRate: 0.14, wowDepth: 34, detune: 9,
      leadAttack: 0.008, leadDecay: 2.4, cutoffScale: 1.7,
    },
    rap: {
      steps: [3, 7, 15, 23, 31, 35, 39, 47, 55, 59, 61, 63],
      notes: [0, 3, 0, -2, 5, 3, 0, 7, 5, 3, 0, -2],
      durationSteps: [1.8, 1.2, 2.4, 1.5, 2.8, 1.1, 1.3, 2.6, 1.7, 1.1, 0.9, 2.2],
      octave: 2, level: 0.044, cutoff: 2250,
      scoop: 1.16, drop: 0.86, echoSteps: 3, echoLevel: 0.2,
      vowels: [
        [520, 980, 680, 1260], [710, 1190, 430, 830],
        [460, 820, 590, 1040], [780, 1320, 560, 960],
        [610, 1080, 420, 760], [430, 760, 720, 1210],
        [690, 1160, 510, 890], [520, 920, 760, 1340],
        [420, 740, 610, 1110], [760, 1280, 480, 860],
        [570, 1010, 690, 1190], [470, 810, 540, 940],
      ],
    },
  },
  rageRoom: {
    // Sun-bleached outsider hip-hop: loose drums under electric-piano
    // clusters, tape wobble and little synthetic MC syllables in the glass.
    bpm: 82, level: 0.29, root: 43.65, scale: [0, 2, 3, 5, 7, 9, 10, 12],
    wave: 'triangle', bassWave: 'sine', cutoff: 1760, pad: [0, 3, 7, 10],
    bass: [0, null, 3, null, -2, null, 5, 7],
    lead: [null, null, 4, null, null, 2, null, null, 6, null, null, 3, null, 5, null, 1],
    kick: [0, 7, 10], snare: [4, 12], hats: [2, 5, 8, 11, 14], swing: 0.19, texture: 0.28,
    kickLevel: 0.42, snareLevel: 0.085, hatLevel: 0.026,
    bassLevel: 0.13, bassDecay: 2.7, bassSlide: 0.92, leadLevel: 0.018,
    lofi: {
      hissLevel: 0.007, hissHighpass: 480, hissLowpass: 4700,
      wowRate: 0.12, wowDepth: 38, detune: 11,
      leadAttack: 0.028, leadDecay: 2.1, cutoffScale: 1.12,
    },
    jazz: {
      steps: [0, 14, 32, 46], octave: 2, level: 0.013,
      attack: 0.065, decaySteps: 10, spread: 0.018, cutoff: 1620,
      chords: [[0, 3, 7, 10], [2, 5, 9, 12], [-2, 2, 5, 9], [0, 5, 7, 14]],
    },
    rap: {
      steps: [3, 11, 19, 23, 35, 43, 51, 59, 63],
      notes: [0, 3, -2, 5, 0, 7, 3, -2, 0],
      durationSteps: [1.7, 1.1, 2.1, 1.3, 2.5, 1.2, 1.8, 1.1, 2.2],
      octave: 2, level: 0.031, cutoff: 1880,
      scoop: 1.12, drop: 0.84, echoSteps: 5, echoLevel: 0.16,
      vowels: [
        [500, 920, 680, 1220], [720, 1180, 430, 790], [430, 760, 610, 1050],
        [650, 1080, 510, 860], [470, 830, 730, 1260], [760, 1280, 540, 910],
        [560, 980, 420, 740], [410, 720, 650, 1140], [690, 1160, 500, 850],
      ],
    },
  },
  deathMetal: {
    // A pink-black blast beat: the room's thesis is that a toy can be both
    // mass-produced and emotionally radioactive.
    bpm: 176, level: 0.3, root: 38.89, scale: [0, 1, 3, 5, 6, 8, 10, 12],
    wave: 'square', bassWave: 'sawtooth', cutoff: 1850, pad: [0, 1, 6, 8],
    bass: [0, null, 0, 3, 0, null, 6, 1],
    lead: [0, 3, null, 5, 6, null, 2, 1, 0, null, 4, 6, null, 3, 1, 5],
    kick: [0, 4, 8, 12], snare: [2, 6, 10, 14], hats: [1, 3, 5, 7, 9, 11, 13, 15],
    swing: 0.01, texture: 0.5,
    kickLevel: 0.38, snareLevel: 0.105, hatLevel: 0.035,
    bassLevel: 0.115, bassDecay: 0.42, leadLevel: 0.022,
  },
  vacantEditions: {
    // Dry showroom electro: tactile clicks, a rubbery bassline, and enough
    // empty air for Vincent and Eddie's material seminar to remain audible.
    bpm: 104, level: 0.22, root: 46.25, scale: [0, 2, 5, 7, 9, 12, 14],
    wave: 'sine', bassWave: 'triangle', cutoff: 1350, pad: [0, 5, 7, 9],
    bass: [0, null, 7, null, 5, 9, null, 2], lead: [null, 4, null, null, 2, null, 5, null, null, 1, null, 3, null, null, 6, null],
    kick: [0, 8], snare: [4, 12], hats: [2, 6, 10, 14], swing: 0.09, texture: 0.16,
    kickLevel: 0.34, snareLevel: 0.065, hatLevel: 0.022,
    bassLevel: 0.095, bassDecay: 1.45, leadLevel: 0.02,
    lofi: {
      hissLevel: 0.006, hissHighpass: 900, hissLowpass: 4700,
      wowRate: 0.16, wowDepth: 28, detune: 5,
      leadAttack: 0.035, leadDecay: 1.5, cutoffScale: 0.9,
    },
  },
  hairSalon: {
    // Glossy clipper-house electro: polished chrome percussion, soft salon
    // hum, and a bassline as smooth and uninterrupted as the clientele.
    bpm: 112, level: 0.23, root: 55, scale: [0, 2, 5, 7, 9, 12, 14],
    wave: 'triangle', bassWave: 'sine', cutoff: 2100, pad: [0, 5, 7, 9],
    bass: [0, null, 7, null, 5, null, 9, 2], lead: [null, 4, null, 2, null, 5, null, 1, null, 3, null, 6, 2, null, 4, null],
    kick: [0, 8], snare: [4, 12], hats: [2, 6, 10, 14], swing: 0.06, texture: 0.18,
    kickLevel: 0.32, snareLevel: 0.06, hatLevel: 0.024,
    bassLevel: 0.09, bassDecay: 1.5, leadLevel: 0.022,
    lofi: {
      hissLevel: 0.007, hissHighpass: 1000, hissLowpass: 6500,
      wowRate: 0.25, wowDepth: 12, detune: 3,
      leadAttack: 0.02, leadDecay: 1.4, cutoffScale: 1.2,
    },
  },
  listeningRoom: {
    // Near-silent audiophile soul: soft brushes, a patient sub and just enough
    // electric piano to make the empty chair feel occupied.
    bpm: 74, level: 0.22, root: 49, scale: [0, 2, 4, 7, 9, 11, 14],
    wave: 'sine', bassWave: 'sine', cutoff: 1180, pad: [0, 4, 7, 11],
    bass: [0, null, null, 7, null, 4, null, 9], lead: [null, 4, null, null, 2, null, null, 5, null, null, 1, null, null, 3, null, null],
    kick: [0, 8], snare: [4, 12], hats: [3, 7, 11, 15], swing: 0.13, texture: 0.08,
    kickLevel: 0.24, snareLevel: 0.038, hatLevel: 0.012,
    bassLevel: 0.075, bassDecay: 2.6, leadLevel: 0.015,
  },
  documenta: {
    // Administrative minimal techno: scanner chirps, fluorescent pulse,
    // printer rhythm and a bassline approved by four departments.
    bpm: 92, level: 0.24, root: 43.65, scale: [0, 1, 5, 7, 10, 12, 13],
    wave: 'square', bassWave: 'sine', cutoff: 2850, pad: [0, 1, 7, 10],
    bass: [0, null, 0, 7, null, 1, 5, null],
    lead: [null, 5, null, null, 2, null, 6, null, null, 3, null, 1, null, null, 4, null],
    kick: [0, 8], snare: [4, 12], hats: [2, 6, 10, 14], swing: 0.025, texture: 0.22,
    kickLevel: 0.28, snareLevel: 0.05, hatLevel: 0.018,
    bassLevel: 0.085, bassDecay: 1.7, leadLevel: 0.018,
    lofi: {
      hissLevel: 0.005, hissHighpass: 1200, hissLowpass: 7200,
      wowRate: 0.08, wowDepth: 8, detune: 2,
      leadAttack: 0.004, leadDecay: 0.65, cutoffScale: 1.35,
    },
  },
  invisibleCollection: {
    // Nervous institutional muzak performed by office machinery. Its tempo is
    // driven at runtime by the collection's valuation rather than by movement.
    bpm: 80, level: 0.25, root: 55, scale: [0, 1, 5, 7, 10, 12],
    wave: 'sine', bassWave: 'triangle', cutoff: 3400, pad: [0, 5, 7, 10],
    bass: [null, null, null, null, null, null, null, null],
    lead: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    kick: [], snare: [], hats: [], swing: 0.035, texture: 0,
    office: {
      printer: [0, 2, 5, 7, 10, 13, 15],
      gavel: [0, 8],
      chimes: [4, 12],
      shredder: [6, 14],
    },
  },
  mtvCribs: {
    // Glossy reality-TV electro with a waddling low end and camera-flash hats.
    bpm: 108, level: 0.27, root: 43.65, scale: [0, 3, 5, 7, 10, 12, 15],
    wave: 'square', bassWave: 'sine', cutoff: 2300, pad: [0, 3, 7, 10],
    bass: [0, 0, 7, null, 3, 3, 10, null], lead: [5, null, 2, null, 4, null, 1, 3, null, 6, null, 2, 5, null, 1, null],
    kick: [0, 4, 8, 12], snare: [4, 12], hats: [2, 6, 10, 14, 15], swing: 0.05, texture: 0.16,
    kickLevel: 0.38, snareLevel: 0.074, hatLevel: 0.024,
    bassLevel: 0.13, bassDecay: 1.65, leadLevel: 0.025,
  },
  publicRestroom: {
    // Techno Zamba, built under the room's strict acoustic policy: every
    // transient is either a synthesized urine stream / splash or a layered
    // fart. There are deliberately no conventional drums, voices or synths.
    bpm: 132, level: 0.34, root: 49, scale: [0],
    wave: 'sine', bassWave: 'sine', cutoff: 9200, pad: [],
    bass: [null, null, null, null, null, null, null, null],
    lead: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    kick: [], snare: [], hats: [], swing: 0.075, texture: 0,
    restroom: {
      // Four low farts supply the techno floor; the five syncopated accents
      // answer like a crooked samba/zamba hand pattern. Piss is the shaker,
      // but its broadband spray stays tucked behind the lower percussion.
      floor: [0, 4, 8, 12],
      accents: [3, 6, 10, 13, 15],
      splashes: [1, 2, 5, 7, 9, 11, 14],
      splashLevel: 0.058,
      streamLevel: 0.046,
      streamEveryBars: 2,
      streamHighpass: 520,
      sprayCenter: 1680,
      needleFrequency: 4200,
      needleLevel: 0.055,
    },
  },
};



/** MAX PRO KUNST 2000 — an oversized white cube, newsroom, club, and boxing broadcast. */
export const MAXPRO = {
  room: { w: 42, d: 24, h: 9 },       // forty metres of wall, and then some
  painting: { w: 0.11, h: 0.08, y: 1.62, z: -11.78 },   // 11 × 8 cm, oil on canvas, immense
  benchZ: 9.6,                        // the bench is positioned absurdly far away
};


export const STORAGE = {
  settings: 'painter.settings.v1',
  endings:  'painter.endings.v1',
  meta:     'painter.meta.v1',
  run:      'painter.run.v1',
};

/** Daily mutations keep repeat runs recognizable, but never respectable. */
export const DAILY_PHENOMENA = [
  {
    title: 'COW PARLIAMENT',
    desc: 'The cow has been elected. It will issue three unsolicited statements.',
    bubbleMin: 0.85, bubbleMax: 2.8, event: 'cow', goal: 3,
  },
  {
    title: 'THE PAINTINGS ARE MOLTING',
    desc: 'Finish one work before the old skin falls off the easel.',
    bubbleMin: 1.8, bubbleMax: 5.2, event: 'paint', goal: 1,
  },
  {
    title: 'ARTI IS A SEANCE',
    desc: 'Open the phone. Something on the other side has followed you.',
    bubbleMin: 1.5, bubbleMax: 4.5, event: 'arti', goal: 1,
  },
  {
    title: 'MAX PRO HAS SHRUNK',
    desc: 'Make three marks in the tiny gallery. The walls will deny it.',
    bubbleMin: 1.8, bubbleMax: 5.2, event: 'splat', goal: 3,
  },
  {
    title: 'THE WALLS HAVE PRONOUNS',
    desc: 'Appraise three objects. They are tired of being described as surfaces.',
    bubbleMin: 1.8, bubbleMax: 5.2, event: 'appraise', goal: 3,
  },
  {
    title: 'EVERYONE IS THE SAME PERSON',
    desc: 'Address two artworld figures. Watch the distinction collapse.',
    bubbleMin: 1.4, bubbleMax: 4.2, event: 'talk', goal: 2,
  },
];

export const ENDINGS = {
  ascension: { name: 'ASCENSION',              blurb: 'Eight virtues, cleansed in pigment.' },
  sellout:   { name: 'SELLOUT STAR',           blurb: 'The Vault has a new unit. It is you.' },
  purist:    { name: 'STARVING PURIST',        blurb: 'Unbought. Unbent. Unfed. Glorious.' },
  walked:    { name: 'THE ONE WHO WALKED AWAY', blurb: 'The door. The daylight. The nerve.' },
};

export const CAMERA = { fov: 72, near: 0.05, far: 120 };

/** The soundtrack — warm songs in personal spaces, cold drones in market spaces. */
export const MUSIC = {
  title: 'puplic/songs/Alt er tungt alt er fint 2.mp3',
  garret: 'puplic/songs/sa sliten.mp3',
  ending: 'puplic/songs/jeg liker deg demo.mp3',
  ullabjakkBaraEinuSinniEnn: 'puplic/songs/ullabjakk/bara-einu-sinni-enn.mp3',
  ullabjakkFyrirgefduGeimverur: 'puplic/songs/ullabjakk/fyrirgefdu-geimverur-2.mp3',
  ullabjakkGedveikurAfSjalfumMer: 'puplic/songs/ullabjakk/gedveikur-af-sjalfum-mer-1.mp3',
  ullabjakkHelSjukurIThig: 'puplic/songs/ullabjakk/hel-sjukur-i-thig-demo.mp3',
  ullabjakkIslensktSkammdegi: 'puplic/songs/ullabjakk/islenskt-skammdegi.mp3',
  ullabjakkKjarnorkusprengja: 'puplic/songs/ullabjakk/kjarnorkusprengja-demo1.mp3',
  ullabjakkPassaThigAMer: 'puplic/songs/ullabjakk/passa-thig-a-mer.mp3',
  ullabjakkThykistEkkiThekkjaMig: 'puplic/songs/ullabjakk/thykist-ekki-thekkja-mig-1.mp3',
};
export const MUSIC_LEVEL = 0.42;   // fraction of master volume

/** Display titles for the now-playing chip (keys mirror MUSIC). */
export const MUSIC_TITLES = {
  title: 'ALT ER TUNGT ALT ER FINT 2',
  garret: 'SA SLITEN',
  ending: 'JEG LIKER DEG (DEMO)',
  ullabjakkBaraEinuSinniEnn: 'BARA EINU SINNI ENN',
  ullabjakkFyrirgefduGeimverur: 'FYRIRGEFÐU GEIMVERUR 2',
  ullabjakkGedveikurAfSjalfumMer: 'GEÐVEIKUR AF SJÁLFUM MÉR 1',
  ullabjakkHelSjukurIThig: 'HEL SJÚKUR Í ÞIG (DEMO)',
  ullabjakkIslensktSkammdegi: 'ÍSLENSKT SKAMMDEGI',
  ullabjakkKjarnorkusprengja: 'KJARNORKUSPRENGJA (DEMO 1)',
  ullabjakkPassaThigAMer: 'PASSA ÞIG Á MÉR',
  ullabjakkThykistEkkiThekkjaMig: 'ÞYKIST EKKI ÞEKKJA MIG 1',
};

/** Artist credits shown in the communal record case. */
export const MUSIC_ARTISTS = {
  title: 'Usrname',
  garret: 'Usrname',
  ending: 'Usrname',
  ullabjakkBaraEinuSinniEnn: 'Ullabjakk',
  ullabjakkFyrirgefduGeimverur: 'Ullabjakk',
  ullabjakkGedveikurAfSjalfumMer: 'Ullabjakk',
  ullabjakkHelSjukurIThig: 'Ullabjakk',
  ullabjakkIslensktSkammdegi: 'Ullabjakk',
  ullabjakkKjarnorkusprengja: 'Ullabjakk',
  ullabjakkPassaThigAMer: 'Ullabjakk',
  ullabjakkThykistEkkiThekkjaMig: 'Ullabjakk',
};

/** Approximate performance tempos used by the Listening Room's live band.
 * They affect only stage motion; the recordings themselves are never altered. */
export const MUSIC_BPMS = {
  title: 82,
  garret: 61,
  ending: 114,
  ullabjakkBaraEinuSinniEnn: 88,
  ullabjakkFyrirgefduGeimverur: 126,
  ullabjakkGedveikurAfSjalfumMer: 141,
  ullabjakkHelSjukurIThig: 180,
  ullabjakkIslensktSkammdegi: 77,
  ullabjakkKjarnorkusprengja: 126,
  ullabjakkPassaThigAMer: 77,
  ullabjakkThykistEkkiThekkjaMig: 104,
};
