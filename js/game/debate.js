/**
 * debate.js — MAX PRO: six painters, one tiny painting, no resolution.
 *
 * The room argues with itself in short alternating subtitle lines,
 * on a loop, forever. The player can walk up to any debater and be
 * offered exactly two absurd responses; picking one advances an
 * invisible ARTISTIC POSITION value whose title becomes progressively
 * less meaningful. It has no practical consequence. The game insists
 * otherwise.
 *
 * Emits 'line' — { name, text, pitch } — same shape the bark and
 * chatter systems use, rendered by ui.subtitle.
 */

import { Emitter, pick, rand, shuffle } from '../core/utils.js';

/* Speaker keys → NPC ids (see characters.js MAX_PRO_CAST) */
const SPEAKERS = {
  p1: 'promax1', p2: 'promax2', p3: 'promax3',
  v1: 'post1', v2: 'post2', v3: 'post3',
  at: 'attendant',
};

/* If an NPC is somehow gone, the argument survives without them. */
const FALLBACK = {
  p1: { name: 'PRO MAX 1', pitch: 1.12 },
  p2: { name: 'PRO MAX 2', pitch: 1.3 },
  p3: { name: 'PRO MAX 3', pitch: 0.88 },
  v1: { name: 'POST 1', pitch: 0.72 },
  v2: { name: 'POST 2', pitch: 0.95 },
  v3: { name: 'POST 3', pitch: 0.62 },
  at: { name: 'The Attendant', pitch: 0.5 },
};

/* ============================================================
   THE OPENING — plays once, the first time anyone walks in.
   Canonical. Do not touch. They have been saying it for hours.
   ============================================================ */

const OPENING = [
  ['p1', 'It needs more space.'],
  ['v1', 'There’s forty metres of wall.'],
  ['p2', 'Physical space isn’t the same as conceptual space.'],
  ['v2', 'It’s twelve centimetres wide.'],
  ['p3', 'That’s exactly why the wall feels crowded.'],
  ['v3', 'I think the building needs to be bigger.'],
  ['p1', 'Finally, someone understands.'],
  ['v3', 'I was joking.'],
];

/* ============================================================
   THE ARGUMENT — the ongoing pool. Nobody is joking. Ever.
   ============================================================ */

const EXCHANGES = [
  // — needs more space —
  [
    ['p1', 'The work requires breathing room.'],
    ['v2', 'It’s breathing. I can see it breathing from here.'],
    ['p1', 'Metaphorically.'],
    ['v2', 'So is the room.'],
  ],
  [
    ['p1', 'Contextually, this room is the frame.'],
    ['v1', 'The frame is the frame. I saw it. It’s small too.'],
  ],
  [
    ['p1', 'Visibility is context, context is scale, scale is value.'],
    ['v2', 'And lunch is lunch. When is lunch.'],
  ],
  [
    ['p1', 'It needs more space.'],
    ['v1', 'You said that when we arrived.'],
    ['p1', 'It’s truer now.'],
  ],
  // — the gallery distracts from the work —
  [
    ['p2', 'The gallery is distracting from the work.'],
    ['v1', 'The gallery is the only thing here.'],
    ['p3', 'Then the work is succeeding.'],
  ],
  [
    ['p2', 'What if the wall is too white.'],
    ['v2', 'The wall is fine. The argument is beige.'],
  ],
  // — it is, in fact, monumental —
  [
    ['p3', 'Scale is a decision. This painting chose to be monumental.'],
    ['v2', 'It’s a postcard.'],
    ['p3', 'A monumental postcard.'],
    ['v1', 'I mailed one of those to my ex. It was also about nothing.'],
  ],
  [
    ['p1', 'If it were any bigger it would be decoration.'],
    ['v3', 'If it were any smaller it would be a rumour.'],
    ['p3', 'Next year, perhaps.'],
  ],
  [
    ['p1', 'We could project it. Monumental scale. The ceiling.'],
    ['v3', 'Project it onto the void. Same resolution.'],
  ],
  // — making it larger would destroy the tension —
  [
    ['p1', 'Enlarge it and you destroy the tension.'],
    ['v1', 'What tension.'],
    ['p1', 'Exactly. It’s working.'],
  ],
  [
    ['p3', 'Hanging it higher would change everything.'],
    ['v2', 'Hanging it outside would change everything too.'],
  ],
  [
    ['v2', 'It’s crooked.'],
    ['p3', 'It’s two degrees off. Intentionally.'],
    ['v2', 'It’s crooked.'],
    ['p1', 'The crookedness is load-bearing.'],
  ],
  // — the empty wall is part of the artwork —
  [
    ['p3', 'The wall is the work. The painting is the signature.'],
    ['v3', 'I signed a wall once. It was load-bearing. So was the statement.'],
  ],
  [
    ['p3', 'The emptiness charges the object.'],
    ['v1', 'The object is eleven centimetres. The emptiness is doing all the work.'],
    ['p3', 'Now you understand.'],
  ],
  // — removing the painting would improve the exhibition —
  [
    ['p2', 'Removing the painting would complete the exhibition.'],
    ['v2', 'Removing the painting would complete my afternoon.'],
    ['p1', 'Absence performs better on the floor plan.'],
  ],
  [
    ['v3', 'Eventually the building falls down and the painting hangs on the sky.'],
    ['p1', 'That’s the long-term vision.'],
    ['v3', 'There is no long-term vision.'],
    ['p1', 'Even better.'],
  ],
  // — emerging or post-emerging —
  [
    ['p2', 'Is the artist emerging or post-emerging?'],
    ['v1', 'The artist is forty-six.'],
    ['p2', 'Emerging is not an age. It’s a funding category.'],
    ['v3', 'I’m pre-submerging.'],
  ],
  [
    ['v1', 'I painted one this size in 1987. Nobody called it a practice.'],
    ['p2', 'You were proto-post-scale.'],
    ['v1', 'I was on a train.'],
  ],
  // — too commercial —
  [
    ['p2', 'It reads a little commercial.'],
    ['v2', 'It’s eleven centimetres of brown.'],
    ['p2', 'Commercial brown is very now.'],
    ['v1', 'So is pneumonia.'],
  ],
  [
    ['p2', 'Is it too sincere?'],
    ['p3', 'It’s eleven centimetres of sincere.'],
    ['v1', 'I’ve had bigger sincerity in a sandwich.'],
  ],
  [
    ['p2', 'I want to hate it but it’s so small I feel protective.'],
    ['v1', 'That’s not protection. That’s pity. I know the difference. I get pity.'],
  ],
  // — nobody buying it proves it is important —
  [
    ['p1', 'Nobody has bought it. That’s how we know it matters.'],
    ['v3', 'Nobody has bought my coat either.'],
    ['p1', 'Is the coat for sale?'],
    ['v3', 'No.'],
    ['p1', 'Then your coat is also important.'],
  ],
  [
    ['p1', 'We should acquire it for the foundation.'],
    ['v3', 'The foundation is a hole with money in it.'],
    ['p1', 'Foundations are holes. That’s the point.'],
  ],
  // — the price should increase because it is small —
  [
    ['p1', 'Scarcity is per square centimetre. We should double the price.'],
    ['v1', 'It’s already eight thousand.'],
    ['p1', 'For eleven centimetres? That’s value.'],
    ['v2', 'For eleven centimetres that’s a robbery with a label.'],
  ],
  [
    ['v2', 'The red dot means it sold.'],
    ['p1', 'The red dot means it’s loved.'],
    ['v3', 'The red dot means someone with money blinked.'],
  ],
  // — standing further away makes it better —
  [
    ['p3', 'It improves with distance.'],
    ['v3', 'I’m at maximum distance.'],
    ['p3', 'Then you are seeing it perfectly.'],
    ['v3', 'I’m seeing a wall.'],
    ['p3', 'Yes.'],
  ],
  [
    ['p3', 'The bench placement is a curatorial argument.'],
    ['v2', 'The bench is in another postal code.'],
    ['p3', 'Distance is the argument.'],
    ['v2', 'Then the argument is tired. It walked here.'],
  ],
  // — explaining it ruins it —
  [
    ['v2', 'What is it.'],
    ['p3', 'Explaining it would ruin it.'],
    ['v2', 'It’s already ruined. I checked from here.'],
  ],
  [
    ['v2', 'I like it.'],
    ['p1', 'That’s concerning.'],
    ['v2', 'It’s the only thing in here not asking for anything.'],
  ],
  // — the press release is necessary to see it —
  [
    ['p2', 'You need the press release to see it properly.'],
    ['v1', 'I need glasses.'],
    ['p2', 'The press release includes glasses.'],
    ['v1', 'Of course it does.'],
  ],
  [
    ['p2', 'Should the catalogue mention the wall.'],
    ['p3', 'The catalogue is two hundred pages. It mentions nothing else.'],
    ['v1', 'I read page eighty. It’s the word “whereas” for a whole page.'],
    ['p3', 'The standout page.'],
  ],
  // — painting is dead again —
  [
    ['v3', 'Painting died again.'],
    ['p1', 'When.'],
    ['v3', 'Tuesday. There was a thing.'],
    ['p2', 'Was anyone there.'],
    ['v3', 'Everyone. Nobody noticed. It was very moving.'],
  ],
  [
    ['v1', 'In my day the painting filled the wall.'],
    ['p2', 'And the wall filled the painting.'],
    ['v1', 'No. The wall was a wall.'],
    ['p2', 'Exactly the problem we’re solving.'],
  ],
  [
    ['p1', 'The institution needs this.'],
    ['v3', 'The institution needs a plumber. The west bathroom is a biennale.'],
  ],
  [
    ['v3', 'I proposed this show in 2009. As a joke. They waited.'],
    ['p3', 'Institutions move slowly with jokes.'],
  ],
  // — the room itself, quietly —
  [
    ['p2', 'The skylight is doing a lot of the work.'],
    ['v2', 'The skylight is the best thing here. It’s honest. It’s a hole.'],
    ['p3', 'The skylight is not in the show.'],
    ['v2', 'Neither is the painting, technically.'],
  ],
  [
    ['at', '...'],
    ['p3', 'The attendant agrees.'],
    ['v1', 'The attendant is reading a serial novel on her phone.'],
    ['at', '...'],
  ],
];

/* ============================================================
   ARTISTIC POSITION — the ladder into meaninglessness.
   One rung per debate participated in. No way down.
   ============================================================ */

export const POSITIONS = [
  'Unclear',                          // 0 — never toasted
  'Figurative Leaning',
  'Post-Figurative',
  'Post-Figurative Adjacent',
  'Institutionally Ambivalent Post-Figurative',
  'Spatially Resistant Neo-Painter',
  'Post-Everything Spatially Resistant Neo-Painter',
  'Anti-Monumental Post-Everything Spatially Resistant Neo-Painter',
  'Anti-Monumental Post-Everything Spatially Resistant Neo-Painter (Provisional)',
  'Senior Anti-Monumental Post-Everything Spatially Resistant Neo-Painter (Provisional)',
  'The Wall',                         // terminal. you are the wall now.
];

/* ============================================================
   THE CHOICES — per debater: openers + two absurd responses,
   each with a bone-dry reaction. Everyone takes this seriously.
   ============================================================ */

const CHOICE_SCRIPTS = {
  promax1: {
    openers: [
      'Before you say anything: the painting is correctly positioned. We ran the numbers twice.',
      'Visibility here is a function of scale, and the scale is a decision. A correct one.',
      'The phone in my hand says the room tests well. The phone has never been wrong about a room.',
    ],
    choices: [
      {
        a: 'It needs more space.',
        ra: 'Finally. Someone with institutional eyes.',
        b: 'I think the wall needs less painting.',
        rb: 'The wall is fixed. The painting is negotiable. That is the whole job.',
      },
      {
        a: 'Double the price because it is small.',
        ra: 'Scarcity per square centimetre. You understand the model.',
        b: 'It is twelve centimetres of nothing.',
        rb: 'Twelve centimetres of context. Read the label. All of it. There is a lot of it.',
      },
    ],
  },
  promax2: {
    openers: [
      'Do you think it looks commercial? Be careful. I have a notebook.',
      'I sketched it forty times. From here it is mostly a rumour with good lighting.',
      'Don’t tell the others, but I measured it. Twice. The numbers are fine. I am not.',
    ],
    choices: [
      {
        a: 'It’s monumental.',
        ra: 'Right?! Scale is a mindset. I am writing that down.',
        b: 'It’s a postcard with lawyers.',
        rb: 'I know. I know. That is why it is genius. Or fraud. My notebook is split.',
      },
      {
        a: 'The emptiness is the medium.',
        ra: 'Oh no. That is exactly what my professor would say. I need to sit down.',
        b: 'I came for the painting, stayed for the forty metres.',
        rb: 'That is so commercial. I love it. I hate that I love it.',
      },
    ],
  },
  promax3: {
    openers: [
      'Every decision in this room has consequences you cannot see from where you are standing.',
      'The wall is not empty. The wall is working. There is a difference, and it is billable.',
      'I have folded my arms about this painting. That is not a small thing. Nothing here is.',
    ],
    choices: [
      {
        a: 'The wall counts as the artwork.',
        ra: 'Correct. The painting is the signature. Small, like all important signatures.',
        b: 'Removing the painting would improve the show.',
        rb: 'It would complete it. We cannot afford completion. Completion ends the funding.',
      },
      {
        a: 'It should hang higher.',
        ra: 'Two degrees higher and the argument collapses. You feel that. Everyone feels that.',
        b: 'The bench is perfectly placed.',
        rb: 'The bench is the thesis. The painting is the footnote.',
      },
    ],
  },
  post1: {
    openers: [
      'I have heard every theory about this wall. I outlived most of them.',
      'Forty metres of wall, eleven centimetres of painting, six opinions. The maths was always bad.',
      'I painted walls like this before they were conceptual. We called them corridors.',
    ],
    choices: [
      {
        a: 'It needs more space.',
        ra: 'There is a bench in another time zone. Sit on it.',
        b: 'The painting should be bigger.',
        rb: 'Careful. That is almost an opinion about the work itself.',
      },
      {
        a: 'Nobody buying it proves it matters.',
        ra: 'Nobody bought mine either. I am apparently very important.',
        b: 'Painting is dead. This is the estate.',
        rb: 'Painting died in 1987 too. It gets better. It always gets better. That is the tragedy.',
      },
    ],
  },
  post2: {
    openers: [
      'I like it. That is the whole review. Everyone else is doing cardio with words.',
      'It’s crooked. Two degrees. I respect it.',
      'I sat down because the floor is the only honest surface here. The floor and the little red square.',
    ],
    choices: [
      {
        a: 'Standing further away improves it.',
        ra: 'Standing further away improves most painters. Present company excluded. Maybe.',
        b: 'It’s too commercial.',
        rb: 'It’s brown and eleven centimetres. What is it selling. Damp?',
      },
      {
        a: 'The red dot means it’s loved.',
        ra: 'The red dot means someone panicked with money. Same thing, honestly.',
        b: 'Explaining it ruins it.',
        rb: 'Explaining anything ruins lunch. When is lunch.',
      },
    ],
  },
  post3: {
    openers: [
      'Painting died, came back, died again. This is the reading of the will.',
      'I am standing at maximum distance. It has not helped. Nothing has.',
      'The building is a white cube the size of a grudge. I have been happier in worse rooms.',
    ],
    choices: [
      {
        a: 'I think the building needs to be bigger.',
        ra: 'Careful. They will fund that.',
        b: 'The building is the artwork.',
        rb: 'Then the artwork has a damp problem in the west bathroom.',
      },
      {
        a: 'Painting is dead again.',
        ra: 'It died Tuesday. There was a thing. Everyone came. Nobody noticed.',
        b: 'It will outlive all of us.',
        rb: 'It’s eleven centimetres. Pigeons will outlive it.',
      },
    ],
  },
  attendant: {
    openers: [
      '(She does not look up. The desk is enormous. The silence is itemized.)',
      '(Somewhere under the desk: a serial novel, a stapler, a small personal philosophy.)',
    ],
    choices: [
      {
        a: 'Lovely work.',
        ra: '(She turns a page. The page turns you.)',
        b: 'Is it for sale?',
        rb: '(She gestures vaguely at everything, including you. Everything is for sale.)',
      },
    ],
  },
};

/* Someone gets paint on them. The debate absorbs it without blinking. */
const SPLAT_LINES = {
  promax1: 'That gesture is being documented. It will outlive the gesture.',
  promax2: 'Is the splat… for sale? Asking for the discourse.',
  promax3: 'Interesting. You have expanded the work. The wall noticed.',
  post1: 'Heh. Paint on a painter. Tradition.',
  post2: 'Finally. Something with size.',
  post3: 'Vandalism is just curation with intent.',
  attendant: '(She has seen worse. She is paid for neither.)',
};

/* ============================================================
   The engine
   ============================================================ */

export class DebateEngine extends Emitter {
  #npcs;
  #state;
  #pool = [];
  #current = null;        // exchange in progress: [[speakerKey, line], ...]
  #lineIdx = 0;
  #timer = 2;
  #openingPlayed = false;
  #interjections = [];    // splat reactions, played between exchanges

  constructor(npcs, state) {
    super();
    this.#npcs = npcs;
    this.#state = state;
  }

  /** Called when the player steps into MAX PRO. */
  enter() {
    if (this.#openingPlayed) return;
    this.#openingPlayed = true;
    this.#current = OPENING;
    this.#lineIdx = 0;
    this.#timer = 1.4;    // a beat of silence while the room registers you
  }

  /** The player's position on the ladder of meaning. */
  get positionTitle() {
    const n = this.#state.getFlag('maxProPos') || 0;
    return POSITIONS[Math.min(n, POSITIONS.length - 1)];
  }

  update(dt, { busy }) {
    if (busy()) return;                    // never talk over a duel, a menu, or the player
    this.#timer -= dt;
    if (this.#timer > 0) return;

    if (this.#current) {
      const [who, text] = this.#current[this.#lineIdx];
      this.#say(who, text);
      this.#lineIdx++;
      if (this.#lineIdx >= this.#current.length) {
        this.#current = null;
        this.#timer = rand(11, 18);        // the room breathes. the argument does not rest.
      } else {
        this.#timer = rand(2.6, 4.4);      // conversational rhythm: dry, unhurried
      }
      return;
    }

    if (this.#interjections.length) {
      this.#say(...this.#interjections.shift());
      this.#timer = rand(4, 6);
      return;
    }

    if (!this.#openingPlayed) return;      // the room waits for its first witness
    if (!this.#pool.length) this.#pool = shuffle([...EXCHANGES]);
    this.#current = this.#pool.pop();
    this.#lineIdx = 0;
    this.#timer = 0.6;
  }

  /** Someone got painted on. The debate files it under process. */
  notifySplat(id) {
    const line = SPLAT_LINES[id];
    if (!line) return;
    const key = Object.keys(SPEAKERS).find((k) => SPEAKERS[k] === id);
    if (key) this.#interjections.push([key, line]);
  }

  #say(key, text) {
    const def = this.#npcs.byId(SPEAKERS[key])?.def ?? FALLBACK[key];
    this.emit('line', { name: def.name, text, pitch: def.pitch ?? 1 });
  }

  /**
   * Build the custom two-option dialogue for a debater, in the exact
   * shape DialogueEngine.start(npc, { opener, custom }) expects.
   * Options carry action 'maxpro:a' / 'maxpro:b'; main resolves them.
   */
  dialogueScript(npc) {
    const script = CHOICE_SCRIPTS[npc.def.id] ?? CHOICE_SCRIPTS.attendant;
    const pair = script.choices.length === 1
      ? script.choices[0]
      : pick(script.choices);
    return {
      opener: pick(script.openers),
      custom: [
        { key: '1', tone: 'witty', tag: 'POSITION', text: pair.a, action: 'maxpro:a' },
        { key: '2', tone: 'brutal', tag: 'POSITION', text: pair.b, action: 'maxpro:b' },
      ],
      // the reaction line the NPC delivers after the dialogue closes
      reactions: { a: pair.ra, b: pair.rb },
    };
  }

  /**
   * Register the player's choice: bump the invisible value, return the
   * reaction line and the new, worse title. No practical consequence.
   */
  registerChoice(npc, side, reactions) {
    const n = (this.#state.getFlag('maxProPos') || 0) + 1;
    this.#state.setFlag('maxProPos', Math.min(n, POSITIONS.length - 1));
    const capped = n >= POSITIONS.length - 1;
    return {
      reaction: reactions?.[side] ?? '...',
      title: this.positionTitle,
      capped,
    };
  }
}
