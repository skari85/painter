/**
 * dialogue.js — verbal combat.
 *
 * Talking is duelling. An NPC fires an opener; you answer in one of
 * three tones. Every NPC has a weakness (bonus ego damage) and a
 * resistance (they counterattack — it costs YOU fame and soul).
 * Ambient weirdos pull from the generator; the main cast is authored.
 *
 * The engine is authoritative about flow but knows nothing about
 * rendering: UI subscribes to 'start' / 'round' / 'shatter' / etc.
 */

import { Emitter, pick, randInt, chance, clamp } from '../core/utils.js';
import { DUEL } from '../core/config.js';

/* ============================================================
   The Weird Line Generator — for the unauthored masses
   ============================================================ */

const GEN = {
  nouns: ['therapist', 'yacht', 'aura reader', 'accountant', 'parrot', 'interior void',
    'pilates instructor', 'lawyer', 'moon priestess', 'portfolio', 'dog', 'evil twin', 'fondue set'],
  similes: ['a hedge fund apologizing', 'wet linen in a tax haven', "my father's silence, but framed",
    'a divorce rendered in ochre', 'expensive fog', 'a bank statement with feelings',
    "grandmother's house if she traded futures", 'a very confident shrug', 'heritage static'],
  topics: ['late capitalism', 'the ocean', 'my divorce', 'seasonal despair', 'the concept of doors',
    'unearned confidence', 'heritage guilt', 'the tragedy of excellent lighting'],
  aspects: ['brushwork', 'palette', 'negative space', 'trauma', 'confidence', 'underdrawing'],
  feelings: ['adore', 'fear', 'am quietly funded by', 'have already forgotten', 'am litigating'],

  openers: [
    () => `My ${G.noun()} says your work resonates like ${G.simile()}.`,
    () => `I ${G.feeling()} this. My ${G.noun()} disagrees. Violently.`,
    () => `Is this about ${G.topic()}? I only collect things about ${G.topic()}.`,
    () => `Your ${G.aspect()} reminds me of ${G.simile()}. I mean that as a threat.`,
    () => `I showed your work to my ${G.noun()}. It wept. So did the ${G.noun()}.`,
    () => `I don't understand it, which in this economy means it's basically currency.`,
    () => `This would look incredible in the panic room. The walls there are so blank. So judgmental.`,
  ],
  reactions: [
    () => `...I felt that in my ${G.noun()}.`,
    () => `Nobody has spoken to me like that since the ${G.topic()} incident.`,
    () => `I need to sit down. I am sitting down. Internally.`,
  ],
  countered: [
    () => `That rolled off me like ${G.simile()}.`,
    () => `Hm. My ${G.noun()} has said worse. In court.`,
    () => `Cute. I've been insulted by biennales.`,
  ],
  dismiss: [
    () => `I need to go describe this to my ${G.noun()}. They charge by the hour.`,
    () => `This conversation has peaked. Like ${G.simile()}, it must end.`,
  ],
  meltdowns: [
    () => `I CAME HERE TO FEEL NOTHING AND NOW LOOK AT ME.`,
    () => `MY ${G.noun().toUpperCase()} WAS RIGHT ABOUT YOU PEOPLE. ABOUT EVERYTHING.`,
    () => `THE ${G.topic().toUpperCase()} — IT'S REAL. IT WAS ALWAYS REAL.`,
  ],
};
const G = {
  noun: () => pick(GEN.nouns),
  simile: () => pick(GEN.similes),
  topic: () => pick(GEN.topics),
  aspect: () => pick(GEN.aspects),
  feeling: () => pick(GEN.feelings),
};


/* ============================================================
   Your voice — global comeback fallbacks
   ============================================================ */

const JABS = {
  kind: [
    'I hear you. Truly. The work hears you too. It says hi.',
    'You\'re not wrong. And you showed up, which is more than most.',
    'Something in you is still paying attention. That\'s rarer than talent.',
    'Whatever this room has done to you — it did it to me first. Solidarity.',
  ],
  witty: [
    'I\'d explain the piece, but I left my TED talk in my other pants.',
    'It\'s about late capitalism. Everything is. That\'s the scam. That\'ll be four euros.',
    'I work in a very traditional medium: spite, mostly, stretched over linen.',
    'The artist statement is just the word "help" in a nice font.',
    'I\'m not emerging. I\'m submerging. It\'s a more honest trajectory.',
  ],
  brutal: [
    'Your taste is a timeshare and everyone here knows it.',
    'You don\'t buy art. You launder the absence of a personality.',
    'Blink twice if the money chose you and you never chose anything.',
    'I\'ve seen deeper conviction in a hotel breakfast buffet.',
    'You\'re not a collector. You\'re a storage unit that learned small talk.',
  ],
};

function lineFor(def, poolName, genFallback) {
  const pool = def[poolName];
  if (pool && pool.length) return pick(pool);
  if (genFallback) return pick(genFallback)();
  return '...';
}

/* ============================================================
   The engine
   ============================================================ */

export class DialogueEngine extends Emitter {
  #state;
  #usedJabs = { kind: [], witty: [], brutal: [] };

  constructor(state) {
    super();
    this.#state = state;
    this.active = null;
  }

  start(npc, opts = {}) {
    if (this.active) return false;
    npc.beginTalk();
    npc.setEgoVisible(true);
    npc.updateEgoBar();
    const options = opts.custom ?? this.#buildOptions(npc);
    this.active = {
      npc,
      rounds: 0,
      custom: opts.custom ?? null,
      options,
      outcome: null,
    };
    const line = opts.opener ?? lineFor(npc.def, 'openers', GEN.openers);
    this.emit('start', { npc, line, options, hint: npc.def.hint ?? '' });
    return true;

  }

  #buildOptions(npc) {
    return ['kind', 'witty', 'brutal'].map((tone, i) => ({
      key: String(i + 1),
      tone,
      tag: tone.toUpperCase(),
      text: this.#playerLine(npc.def, tone),
    }));
  }

  #playerLine(def, tone) {
    const authored = def.playerJabs?.[tone];
    if (authored?.length) return pick(authored);
    // avoid repeating global fallbacks within a run where possible
    const used = this.#usedJabs[tone];
    const fresh = JABS[tone].filter((l) => !used.includes(l));
    const line = fresh.length ? pick(fresh) : pick(JABS[tone]);
    used.push(line);
    return line;
  }

  choose(index) {
    const a = this.active;
    if (!a) return;
    const opt = a.options?.[index];
    if (!opt) return;


    // scripted story options (appraisal, final choice) bypass combat math
    if (opt.action) {
      const outcome = opt.action;
      this.emit('custom', { npc: a.npc, action: outcome, text: opt.text });
      this.end('custom');
      return;
    }

    const { npc } = a;
    const def = npc.def;
    const tone = opt.tone;

    // ---- tone economics ----
    const s = this.#state;
    if (tone === 'brutal') {
      s.addMeter('heat', DUEL.brutalHeat, 'Brutality in public');
      s.addMeter('soul', -DUEL.brutalSoulCost, 'It cost you something');
      s.shiftVirtue('compassion', -1, '');
      s.shiftVirtue('valor', 2, '');
    } else if (tone === 'witty') {
      s.addMeter('fame', DUEL.wittyFame, 'The room laughed');
      s.shiftVirtue('vision', 1, '');
    } else {
      s.addMeter('soul', DUEL.kindSoul, 'A moment of actual grace');
      s.shiftVirtue('compassion', 1, '');
    }

    // ---- damage ----
    let mod;
    if (def.dmgMods) mod = def.dmgMods[tone] ?? 1;
    else mod = tone === def.weak ? DUEL.weakMultiplier : tone === def.resist ? DUEL.resistMultiplier : 1;
    const base = randInt(...DUEL.base[tone]);
    const dmg = Math.round(base * mod);
    const resisted = mod <= 0.3;
    const healed = dmg < 0;

    npc.ego = clamp(npc.ego - dmg, 0, npc.maxEgo);
    npc.updateEgoBar();
    a.rounds++;

    // ---- their counter, when your tone bounces off ----
    let counter = null;
    if (resisted || healed) {
      counter = { fame: DUEL.counterDamage.fame, soul: DUEL.counterDamage.soul };
      s.addMeter('fame', -counter.fame, 'They ate your line whole');
      s.addMeter('soul', -counter.soul, 'It echoed wrong');
    }

    // ---- their reply ----
    let line;
    if (resisted || healed) line = lineFor(def, 'countered', GEN.countered);
    else if (mod >= DUEL.weakMultiplier) line = def.weakHit?.length ? pick(def.weakHit) : lineFor(def, 'reactions', GEN.reactions);
    else line = def.reactions?.[tone]?.length ? pick(def.reactions[tone]) : lineFor(def, 'reactions', GEN.reactions);

    // ---- outcomes ----
    if (npc.ego <= 0) {
      a.outcome = 'shatter';
      s.stats.meltdowns++;
      s.stats.duelsWon++;
      s.addMeter('fame', 6, 'Someone left in pieces');
      s.addMeter('heat', 8, 'Everyone saw it happen');
      s.shiftVirtue('valor', 2, '');
      s.shiftVirtue('humility', -2, '');
      this.emit('shatter', { npc, line: lineFor(def, 'meltdown', GEN.meltdowns), dmg, tone });
      return;
    }

    if (tone === 'kind' && def.weak === 'kind' && chance(0.22)) {
      a.outcome = 'disarm';
      s.addMeter('soul', 4, 'You reached the person inside');
      s.shiftVirtue('compassion', 3, '');
      this.emit('disarm', { npc, line: lineFor(def, 'disarmed', null) || '...Oh. Oh no. You meant that.', dmg, tone });
      return;
    }

    if (a.rounds >= DUEL.roundsBeforeDismiss) {
      a.outcome = 'dismiss';
      this.emit('dismiss', { npc, line: lineFor(def, 'dismiss', GEN.dismiss), dmg, tone });
      return;
    }

    a.options = this.#buildOptions(npc);
    this.emit('round', {
      npc, line, options: a.options, dmg, tone, resisted, healed,
      egoFrac: npc.ego / npc.maxEgo, counter,
      yourLine: opt.text,
    });
  }

  /** Called by the UI after the final line has been read. */
  end(outcomeOverride = null) {
    const a = this.active;
    if (!a) return;
    a.npc.endTalk();
    a.npc.setEgoVisible(false);
    this.active = null;
    this.emit('end', { npc: a.npc, outcome: outcomeOverride ?? a.outcome ?? 'left' });
  }

  get current() { return this.active; }
}
