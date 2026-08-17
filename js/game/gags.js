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
  headDocumenter: 'The Head of Documentation. Estimate: twelve terabytes and one unexamined consent form. Condition: recursively described.',
  barnaby: 'Barnaby Crisp. Liquidity personified. Melts at 28°C. Handle with gloves.',
  petra: 'Petra Voss. Gatekeeping Emerita. Estimate: one velvet rope, eternally replenishing.',
  baron: 'Baron von Carpark. Hereditary, obviously. The title is load-bearing.',
  lucia: 'Lucia Fenn. Advisor to the Vault. Charges by the withheld opinion.',
  forkHost: 'Baronessa Brine. Hostess. The table is her weapon. The wine is her alibi.',
  fork1: 'Kasper "The Auctioneer" Voll. Going, going, gone. The gavel is his truth. The truth is tired.',
  fork2: 'Yrsa "The Biennale" Bork. Curator of Everything. She has forgotten more biennales than you will ever attend.',
  fork3: 'Rex "The Algorithm" Vane. Tech visionary. He tokenized his own shadow. It is currently worthless.',
  fork4: 'Gilda "The Ghost" Fenn. Art advisor. She decides who exists. Currently, you are a rumor.',
  fork5: 'Marisol "The Muse" Delacroix. Retired muse. Unretired muse. Retired again. The muse economy is volatile.',
  fork6: 'Otto "The Frame" Gruber. Frame magnate. The frame is the art. The canvas is just the excuse.',
  fork7: 'Liv "The Patron" Hauge. Patron. She owns the concept of owning. The concept is taxable.',
  fork8: 'Sven "The Forger" Lund. Master forger. He painted that one. And that one. The museum doesn\'t know.',
  promax1: 'PRO MAX 1. The Optimizer. Estimate: context, visibility, positioning. Condition: phone-adjacent.',
  promax2: 'PRO MAX 2. The Emerging Artist. Emerging since 2019. The notebook is the real work.',
  promax3: 'PRO MAX 3. The Curatorial Painter. Her arms have been folded since the studio visit. Appraised folded.',
  post1: 'POST 1. The Veteran. Heard every theory before. Appraised at dust, insured for spite.',
  post2: 'POST 2. The Studio Animal. Paint on his hands, floor in his spine. Not for sale. Nobody asked.',
  post3: 'POST 3. The Nihilist. Estimate: nothing. He checked. He was right.',
  attendant: 'The Attendant. Sitting silently since 2021. The only one here with a contract.',
  dildoKing: 'The Dildo King. Estimate: nine by twelve metres of absolute authority. The crown is hollow. The power is not.',
  duck: 'The Rubber Duck Freak. Priceless. The appraisal division refuses to elaborate. Squeak.',
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
  recordPlayer: 'The communal record player. Every room owns the same one. The logistics are conceptual.',
  documentaBadgePrinter: 'The accreditation printer. It has issued you six identities and rejected all of them.',
  documentaCameraLens: 'A camera documenting a camera documenting you. Estimate: one infinite regress, battery not included.',
  documentaArchiveScanner: 'The archive scanner. Appraise it again and the valuation may become self-aware.',
  documentaMonitor: 'Live documentation. The delay is long enough for the present to become provenance.',
  'documenta QR label': 'A QR code leading to a PDF leading to a dead microsite. The journey is the funding outcome.',
  'documenta consent clipboard': 'Consent, pending. Participation, already photographed.',
  'documentation capture zone': 'Stand here and become B-roll for your own administrative disappearance.',
  'empty documented plinth': 'Nothing is displayed. Six cameras have confirmed it from independent angles.',
  'metadata desk': 'The metadata desk. It has drawers for every identity except “person.”',
  'server archive': 'The server archive. Twelve terabytes of evidence that somebody almost looked.',
  'UNTITLED — AIR ON LOAN': 'Untitled. Air, on loan. The lender is unclear. So is the air.',
  'PORTRAIT OF THE COLLECTOR, FACING AWAY': 'A portrait of the collector, facing away. Extremely accurate. Extremely on brand.',
  'THE ABSENCE OF A HORSE': 'The absence of a horse. Larger than a horse. Better insured than a horse.',
  'MONUMENT TO SOMETHING THAT HAS LEFT': 'A monument to something that has left. The plinth remains loyal.',
  'A VERY EXPENSIVE CUBE': 'A very expensive cube. The expense is the cube. There is no other cube.',
  'taped acquisition footprint': 'Yellow tape describing a rectangle of nothing. The nothing has provenance.',
  'invisible work label': 'A wall label for a wall with nothing on it. The label is doing all the work, and it knows it.',
  'institutional desk': 'A desk for processing the paperwork of absence. The paperwork is thriving.',
  'acquisition gate': 'The acquisition gate. Choose a form of custody. Both are final.',
  'live valuation board': 'The valuation board. It only goes up. Nothing has been added. That is the whole trick.',
  maxProPainting: 'UNTITLED, 2026. Oil on canvas, 11 × 8 cm. Price on application. The application is reviewed by the wall.',
  maxProRedDot: 'The red dot. Not a sale. A position. Someone with money blinked.',
  maxProLabel: 'The wall label. It reads exactly like the truth. That is what makes it suspicious.',
  maxProLabelBig: 'The exhibition label. Fourteen times larger than the work. Appraised as “generous”.',
  maxProBench: 'The bench. Positioned at the exact distance of understanding. Understanding remains elsewhere.',
  maxProDesk: 'The attendant’s desk. Enormous. Black. It prices everyone who approaches, quietly, at zero.',
  maxProGlass: 'A champagne glass, abandoned mid-argument. Estimate: one toast, unclaimed.',
  maxProCatalogue: 'The catalogue. Two hundred pages about one tiny painting. Page 80 is the word “whereas”.',
  maxProPlinth: 'A plinth for a book about a painting. The gallery’s whole economy in one object.',
  kunstRing: 'The ring. Football geometry, club lighting, office liability. The ropes are the clearest argument here.',
  kunstCanvas: 'The canvas. Finally, a painting surface with a points system. Current score: nil–nil–infinity.',
  kunstNewsDesk: 'The news desk. Breaking news sits here until it learns to stand.',
  kunstMonitor: 'A monitor announcing nothing at professional brightness.',
  kunstScoreboard: 'MAX PRO KUNST 2000: 0–0 after ninety minutes plus infinity. A classic.',
  skylight: 'The skylight. Soft neutral daylight, free of charge, currently outperforming the exhibition.',
  'the dais': 'The dais. Raised nine inches, which in this kingdom is basically a mountain.',
  'royal bar': 'The royal bar. Every bottle ceremonial, every ceremony open. The ice bucket outranks you.',
  'dance floor': 'The dance floor. Dark gloss, ancient confetti, zero judgment. $8,000 a square foot, memories included.',
  royalTV: 'The royal television. Currently broadcasting the kingdom’s only channel. Estimate: one crown, slightly used. The blur is load-bearing.',
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
