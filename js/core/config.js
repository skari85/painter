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
  garret:   { name: 'THE GARRET',      mood: 'garret' },
  galleria: { name: 'GALLERIA BIANCA', mood: 'galleria' },
  vault:    { name: 'THE VAULT',       mood: 'vault' },
  collectorHome: { name: 'THE COLLECTOR’S HOME', mood: 'collectorHome' },
};

export const STORAGE = {
  settings: 'painter.settings.v1',
  endings:  'painter.endings.v1',
};

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


