/**
 * identity.js — who you are to everyone else in the room.
 *
 * PAINTER's "social network" layer doesn't use accounts. You pick a persona
 * from a curated cast of artworld nonsense-generators; that choice becomes
 * your look (palette, fed straight into npc.js's buildBody) and your name
 * to every other real person live in your zone. It's saved per-browser, the
 * same way ghostRecorder.js remembers a ghost palette, so you stay "you"
 * across sessions until you pick someone else.
 */

const STORAGE_KEY = 'painter.identity';

/** Playable personas. Palette shape matches npc.js buildBody() exactly. */
export const PERSONAS = [
  {
    id: 'nepoBaby', name: 'Fenwick Vole-Whitmore III', tagline: 'Inherited the collection. Inherited nothing else.',
    pitch: 1.05, palette: { skin: 0xe8c4a0, hair: 0xd8c48a, top: 0xf4efe0, bottom: 0x1c2430 },
  },
  {
    id: 'cryptoCollector', name: 'Brix Falcone', tagline: 'Bought the JPEG. Slowly became the JPEG.',
    pitch: 0.92, palette: { skin: 0xc98a5e, hair: 0x0d0d10, top: 0x2de0c2, bottom: 0x14161c },
  },
  {
    id: 'unlicensedShaman', name: 'Moon Practice-Enjoyer', tagline: 'Sage-cleansed the gift shop. It is worse now.',
    pitch: 1.12, palette: { skin: 0xd9b48f, hair: 0x8a6b4a, top: 0xb98cc2, bottom: 0xe8dfc8 },
  },
  {
    id: 'studioVisitVulture', name: 'Perpetua Sniff', tagline: 'Here for the wine. Staying for the gossip.',
    pitch: 0.88, palette: { skin: 0xecd2b8, hair: 0x932b3a, top: 0x14141b, bottom: 0x14141b },
  },
  {
    id: 'failedCurator', name: 'Toblerone Ashby', tagline: "Cancelled his own show. Reviewed it anyway.",
    pitch: 0.8, palette: { skin: 0xb98a68, hair: 0x2a2620, top: 0x5c6670, bottom: 0x2a2620 },
  },
  {
    id: 'vapeCloud', name: 'Just Vapor, Honestly', tagline: 'Nobody has seen its face. Everyone has smelled its opinions.',
    pitch: 1.2, palette: { skin: 0xdccbb0, hair: 0xe4e6ea, top: 0xa0a6b0, bottom: 0x585c66 },
  },
  {
    id: 'residencyGuy', name: 'Kip Endless-Residency', tagline: "Currently 'between studios' in four countries.",
    pitch: 0.95, palette: { skin: 0xc48f66, hair: 0x3c2f22, top: 0xc2622f, bottom: 0xdcd4c0 },
  },
  {
    id: 'plusOne', name: "Someone's Nephew", tagline: "Doesn't know a single artist here. Loves it anyway.",
    pitch: 1.0, palette: { skin: 0xe0b89a, hair: 0x4a3a2c, top: 0x3a5a8c, bottom: 0x22242e },
  },
];

/** One-tap absurd lines for when typing feels like too much effort. */
export const NONSENSE_LINES = [
  'I only collect the negative space.',
  'This wine tastes like a Tuesday in 2019.',
  'I left my body in the coat check.',
  'Is the floor part of the piece or is that just me?',
  'My therapist says I have main-character wall text.',
  'I minted my own reflection this morning.',
  'The chandelier and I have an understanding.',
  'I came for the free cheese and stayed for the crisis.',
  'Everything here is priced in vibes.',
  'I am technically also an installation.',
  'Someone told me feelings are a medium now.',
  'I have three opinions and none of them are mine.',
  'The DJ is playing my ex\'s podcast.',
  'I brought my own red dot, just in case.',
  'This is either genius or a fire hazard.',
  'I whispered "provenance" and a stranger applauded.',
  'My astrologer said tonight I sell something.',
  'The canapés are more conceptual than the show.',
  'I am pretending to understand the wall text.',
  'Somebody is definitely a plant. Possibly me.',
  'I rented this outfit from my own future.',
  'The bass makes the theory easier to believe.',
  'I signed the guestbook as "anonymous collector".',
  'This room smells like ambition and white wine.',
  'I am one compliment away from buying something regrettable.',
];

function readStorage() {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

function writeStorage(id) {
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* private browsing etc */ }
}

export function personaById(id) {
  return PERSONAS.find((p) => p.id === id) ?? null;
}

/** The saved persona, or a stable default (and save it) on a first visit. */
export function loadOrCreateIdentity() {
  const saved = readStorage();
  const persona = (saved && personaById(saved)) || PERSONAS[0];
  if (!saved) writeStorage(persona.id);
  return persona;
}

export function saveIdentity(personaId) {
  if (!personaById(personaId)) return;
  writeStorage(personaId);
}

// A fresh id per open tab — presence is "who's here right now", not an
// account, so it deliberately does not survive a reload.
let sessionId = null;
export function getSessionId() {
  if (!sessionId) {
    sessionId = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  }
  return sessionId;
}
