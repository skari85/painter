/**
 * gags.js — the comedy content mill.
 *
 * Pure generators for the small & evil features:
 * appraisals (Q), tabloid scandals (heat spikes), reviews (post-appraisal),
 * gift-shop economics, blockchain grief, and corporate rebellion.
 */

import { pick } from '../core/utils.js';

/* ============================================================
   1. APPRAISE EVERYTHING — the market has opinions (press Q)
   ============================================================ */

const NPC_APPRAISALS = {
  victoria: 'Victoria Vane. Estimate: the gallery, the list, the look. Reserve: your self-worth.',
  kreyo: 'KREYO. Estimate: $1.2M, mostly future crimes. Condition: mint, unfortunately.',
  dolores: 'Dolores Pang. Priceless to her employer. Worth exactly one star to everyone else.',
  chad: 'Chad Sterling. Marine assets. Estimated $300,000. Feels like less.',
  muffy: 'Muffy Sterling. Feelings Division. Appraised at retail, insured for the story.',
  docent: 'The Docent. Year nine. Fully depreciated. Still the most valuable thing in the room. Do not quote us.',
  index: 'Mister Index. Not for sale. Everything else is.',
  barnaby: 'Barnaby Crisp. Liquidity personified. Melts at 28°C. Handle with gloves.',
  petra: 'Petra Voss. Gatekeeping Emerita. Estimate: one velvet rope, eternally replenishing.',
  baron: 'Baron von Carpark. Hereditary, obviously. The title is load-bearing.',
  lucia: 'Lucia Fenn. Advisor to the Vault. Charges by the withheld opinion.',
};

const OBJECT_APPRAISALS = {
  floor: 'The floor. $8,000 a square foot. It is doing the work of three paintings.',
  wallN: 'The wall. White. Infinite. Asking price: your integrity.',
  wallS: 'The wall. Load-bearing — mostly your reputation.',
  wallW: 'The wall. Excellent bones. The bones are other artists.',
  wallE: 'The wall. An earlier offer was made. It involved a mural. It was declined.',
  easelCanvas: 'Your canvas. Pre-appraised “priceless” by the artist. “Unlisted” by everyone else.',
  desk: 'Rejection letters, early career, a complete set. The market for them is, fittingly, rejective.',
  displayArt: 'The reserved wall. The plaque already believes in you. The plaque is new here.',
  displayFrame: 'A frame with ambition. It has seen things. It framed them.',
  giftshop: 'The Gift Shop. Where art goes to be affordable and vaguely ashamed.',
  radio: 'The GARRET-2000. Not for sale. It has heard everything and judges gently.',
};

const GENERIC_APPRAISALS = [
  'Estimate: $40,000. Provenance: unclear. Smell: present.',
  'A bold acquisition for the right barn.',
  'The market is watching. The market is sitting down.',
  'Pre-war. Post-merit. Priced accordingly.',
  'We would insure it for twice its value, out of spite.',
  'Condition report: honest. Too honest. Discount applied.',
  'Comparable works have sold. To people we no longer call.',
  'It will look extraordinary in a storage facility in Geneva.',
];

export function appraiseNPC(id, name) {
  return NPC_APPRAISALS[id] ?? pick([
    `“${name}.” Estimated $300,000. Feels like less.`,
    `“${name}.” Opening regular. Appraised nightly, never sold.`,
    `“${name}.” Wine-to-wisdom ratio: audited.`,
  ]);
}

const OWN_PHOTO_APPRAISALS = [
  'Early period. Pre-corruption. The market calls it “promising” and means “unsold”.',
  'You know this one. The market does not. That is its only flaw.',
  'Genuine. The word appraisers use right before “unfortunately”.',
  'This one hung here before anyone was looking. It holds up. The frame remembers.',
  'Not for sale. Not asked. Not bitter. (Slightly bitter.)',
];

export function appraiseObject(name) {
  if (name === 'ownPhoto') return pick(OWN_PHOTO_APPRAISALS);
  if (name && OBJECT_APPRAISALS[name]) return OBJECT_APPRAISALS[name];
  return pick(GENERIC_APPRAISALS);
}

/* ============================================================
   2. SCANDAL! — the tabloid of record
   ============================================================ */

const SC_WHO_FALLBACK = ['THE WHITE CUBE', 'A PRICELESS WALL', 'TASTE ITSELF', 'THREE CANAPÉS'];
const SC_VERBS = ['ASSAULTS', 'REBRANDS', 'HUMILIATES', 'DOWNSIZES', 'DISRUPTS', 'DEPLATFORMS'];
const SC_PIGMENTS = ['CADMIUM ORANGE', 'NORWEGIAN BLUE', 'PIGMENT GOLD', 'ULTRAMARINE REGRET', 'RAW UMBER', 'PERMISSIONLESS MAGENTA'];
const SC_QUOTES = ['“HE’S MY MUSE NOW”', '“I FEEL SEEN”', '“MY VALUATION IS SHAKEN”', '“IT’S AN HONOR, PROBABLY”', '“WE WERE ALL THINKING IT”'];
const SC_SOURCES = ['HEIR', 'EYEWITNESS', 'THE WALL', 'SOURCE WITH CHAMPAGNE', 'CONCERNED CANAPÉ'];

export function makeScandal(reason = '') {
  const m = /Painted on (.+)/.exec(reason);
  const who = m ? m[1].toUpperCase() : pick(SC_WHO_FALLBACK);
  return `LOCAL ARTIST ${pick(SC_VERBS)} ${who} WITH ${pick(SC_PIGMENTS)} — ${pick(SC_QUOTES)}, SAYS ${pick(SC_SOURCES)}`;
}

/* ============================================================
   3. THE PALE REVIEW — Dolores files her copy
   ============================================================ */

export function makeReview(title, quality) {
  const t = `“${title}”`;
  if (quality >= 75) return pick([
    `${t} is infuriatingly good. I hated how long I looked. One star, removed for my own safety.`,
    `${t} made me feel something. I have filed a complaint. One star.`,
  ]);
  if (quality >= 50) return pick([
    `${t} has what we critics call “presence”, because “competence” tests poorly. One star.`,
    `I saw ${t}. I remember the room it was in. One star.`,
  ]);
  if (quality >= 25) return pick([
    `${t} hung on the wall. The wall has asked for privacy. One star.`,
    `${t} is exactly what the market deserves. Half a star, rounded down.`,
  ]);
  return pick([
    `A beige hotel. I gave the lobby one star. The lobby is ${t}.`,
    `${t} is less a painting than an apology with pigment. Zero stars, framed.`,
  ]);
}

/* ============================================================
   5. KREYO.ETH — the mint is always open
   ============================================================ */

export const KREYO_MINTS = [
  'Minted. That splat is mine now. Floor’s already up 40%.',
  'Your gesture, my wallet. The blockchain remembers.',
  'I minted the wall. Provenance, baby.',
  'Sold. To a wallet in Dubai. You get exposure — you’re in the background of the screenshot.',
];

export const KREYO_SELF_MINTS = [
  'He minted that too. “Immaculate conception of content,” he whispers.',
  'KREYO photographs the splat on his own jacket. “Provenance,” he breathes. “PROVENANCE.”',
];
