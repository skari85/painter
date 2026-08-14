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
  leatherLatex: { name: 'THE LEATHER & LATEX ROOMS', mood: 'leatherLatex' },
  gildedFork:  { name: 'THE GILDED FORK',   mood: 'gildedFork' },
  maxPro:      { name: 'MAX PRO KUNST 2000', mood: 'galleria' },
  dildoBall:   { name: 'THE DILDO BALL',    mood: 'off' },
  daylightClub: { name: 'THE DAYLIGHT FLESH GARDEN', mood: 'leatherLatex' },
  upAndCumming: { name: 'UP AND CUMMING ARTIST', mood: 'galleria' },
  vacantEditions: { name: 'VACANT EDITIONS', mood: 'galleria' },
  blackForest: { name: 'CHURCH BURNING FIRE SENSATION COCKBURN', mood: 'blackForest' },
};

/**
 * Seven coded club identities. Patterns are one 16-step bar; bass values are
 * semitone offsets from root and lead values are indexes into scale.
 */
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
    // Bright, restless gallery pop: clean daylight with a sale always pending.
    bpm: 124, level: 0.24, root: 65.41, scale: [0, 2, 4, 7, 9, 12, 14],
    wave: 'triangle', bassWave: 'sine', cutoff: 2600, pad: [0, 4, 7, 9],
    bass: [0, null, 7, null, 4, 9, null, 12], lead: [4, null, 2, 5, null, 1, null, 6, 3, null, 5, null, 2, 0, null, 4],
    kick: [0, 4, 8, 12], snare: [4, 12], hats: [2, 6, 10, 14], swing: 0.04, texture: 0.025,
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
};
export const MUSIC_LEVEL = 0.42;   // fraction of master volume

/** Display titles for the now-playing chip (keys mirror MUSIC). */
export const MUSIC_TITLES = {
  title: 'ALT ER TUNGT ALT ER FINT 2',
  garret: 'SA SLITEN',
  ending: 'JEG LIKER DEG (DEMO)',
};
