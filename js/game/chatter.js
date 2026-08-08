/**
 * chatter.js — the party talking to itself.
 *
 * Every so often two nearby guests exchange a two-line conversation
 * written live by the ghostwriter (Groq). Exchanges are prefetched in
 * the background so the room never waits on the network. If the ghost
 * is absent, the authored barks keep the room warm on their own.
 *
 * Emits 'line' — { name, text, pitch } — same shape the bark system uses.
 */

import { Emitter, pick, rand } from '../core/utils.js';

/** A persona card for the prompt — name, role, and two samples of the voice. */
function persona(def) {
  const samples = (def.barks ?? []).slice(0, 2).map((l) => `"${l}"`).join(' ');
  const special = def.id === 'gimp'
    ? ' He never speaks words: his line is ALWAYS a short stage direction in parentheses.'
    : '';
  return `${def.name} (${def.role}). Voice samples: ${samples}.${special}`;
}

const TOPICS = [
  'the collapsed market cake on the buffet',
  'the big painting with the red SOLD dot',
  'the gas fireplace the host swears is oak',
  'the bronze knot sculpture, “Whither, Capital?”, priced at $240,000',
  'the host wearing only underwear and a very confident hat',
  'the chandelier — inherited, heavy, slightly too sincere',
  'whether the silent guest in the suit was even invited',
  'Oslo glittering outside the window, indifferent and expensive',
  'the disco ball turning slowly, like a conscience',
  'the upright piano nobody is allowed to play',
  'the buffet water having its own label',
  'someone wearing paint on their shoes, on purpose',
];

const SYSTEM = `You write ambient party chatter for PAINTER, a satirical artworld game set in Oslo.
Two guests at a collector's private party exchange exactly two lines.
Rules: each line under 18 words; dry, absurd, art-world satire; stay in each persona;
no real people, no hashtags, no emojis, never mention AI.
The Gimp ONLY speaks in short parenthesized stage directions — never words.
Output exactly two lines, formatted "NAME: line".`;

function pickPair(near) {
  const a = pick(near);
  const rest = near.filter((n) => n !== a);
  return [a, rest.length ? pick(rest) : a];
}

/** Model output → two subtitle lines, attributed to A and B in order. Null if unusable. */
function parseExchange(raw, a, b) {
  if (!raw) return null;
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  const read = (line, npc) => {
    let text = line.replace(/[*_]+/g, '').trim();
    // strip any speaker label — "Bob:", "A (Bob):", "BOB —" — whatever the model invented
    const ci = text.indexOf(':');
    if (ci > 0 && ci <= 32 && !/[.!?]/.test(text.slice(0, ci))) text = text.slice(ci + 1);
    else {
      const dash = text.match(/^[\w’' ().-]{1,32}\s[—-]\s+(.+)$/);
      if (dash) text = dash[1];
    }
    text = text.replace(/^["']+|["']+$/g, '').trim();
    // must be a complete, subtitle-sized line (truncated generations get dropped)
    if (!text || text.length > 150 || !/[.!?…)"'\]]$/u.test(text)) return null;
    return { name: npc.def.name, text, pitch: npc.def.pitch };
  };
  const la = read(lines[0], a);
  const lb = read(lines[1], b);
  return la && lb ? { a: la, b: lb } : null;
}

export class ChatterEngine extends Emitter {
  #ai;
  #state;
  #queue = [];
  #timer = rand(12, 20);       // the first exchange lands early enough to be noticed
  #inflight = false;

  constructor(ai, state) {
    super();
    this.#ai = ai;
    this.#state = state;
  }

  /**
   * Called every frame from the main loop.
   * @param {number} dt
   * @param {Array}  near        NPCs in the current zone
   * @param {object} ctx         { zoneName, night, busy() }
   */
  update(dt, near, ctx) {
    if (!this.#ai.enabled) return;          // authored barks carry the night
    if (ctx.busy()) return;                  // never talk over a duel or a menu

    this.#timer -= dt;
    if (this.#timer <= 0 && this.#queue.length) {
      const ex = this.#queue.shift();
      this.#timer = rand(26, 42);
      this.emit('line', ex.a);
      // the reply lands a beat later — a conversation, not a monologue
      setTimeout(() => { if (!ctx.busy()) this.emit('line', ex.b); }, rand(2600, 3800));
    }

    // keep the queue warm — conjure in the background, never block the frame
    if (this.#queue.length < 2 && !this.#inflight && near.length >= 2) {
      this.#inflight = true;
      this.#conjure(near, ctx).finally(() => { this.#inflight = false; });
    }
  }

  async #conjure(near, ctx) {
    const [a, b] = pickPair(near);
    const s = this.#state;
    const lastEvent = s.nightLog.length ? s.nightLog[s.nightLog.length - 1].label : null;
    const user = [
      `Setting: ${ctx.zoneName}, night ${ctx.night}. The wandering artist's fame is ${Math.round(s.meters.fame)}, notoriety ${Math.round(s.meters.heat)}.`,
      lastEvent ? `Something just happened: ${lastEvent}. They may gossip about it.` : '',
      `A is ${persona(a.def)}`,
      `B is ${persona(b.def)}`,
      `They are standing near: ${pick(TOPICS)}.`,
      'Write their two-line exchange.',
    ].filter(Boolean).join('\n');

    const raw = await this.#ai.write(SYSTEM, user, { maxTokens: 200 });
    const ex = parseExchange(raw, a, b);
    if (ex) this.#queue.push(ex);
  }
}
