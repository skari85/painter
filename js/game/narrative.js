/**
 * narrative.js — the quiet thread running through the rooms.
 *
 * The game remains a satire first. These clues give the satire memory: the
 * market has begun cataloguing the Artist before the Artist has agreed to be
 * seen. Clue keys are internal; players only see the prose they unlock.
 */

const CLUE_REVEALS = {
  provenanceSeen: 'A red archive mark appears where the rejection used to be.',
  titleCirculating: 'The title has travelled ahead of you.',
  editionSeen: 'The paperwork calls a person an edition.',
  brandSeen: 'The room has a treatment plan for your identity.',
  theorySeen: 'The language changes. The transaction does not.',
  privateCollectionSeen: 'Someone has made a room for the version of you they can own.',
};

const STORY_LINES = {
  victoria: [
    {
      when: ['provenanceSeen'],
      pools: {
        openers: [
          'I have not seen the work, but I know the title. That is either efficient or ominous.',
          'There is already a red dot waiting for this. Try not to take it personally. It is very personal.',
        ],
      },
    },
  ],
  dolores: [
    {
      when: ['provenanceSeen', 'titleCirculating'],
      pools: {
        openers: [
          'Someone reviewed this before I did. They called it an asset. I dislike being preceded by paperwork.',
        ],
        reactions: [
          'The title is familiar. That is not the same as the work being understood.',
        ],
      },
    },
  ],
  kreyo: [
    {
      when: ['titleCirculating'],
      pools: {
        openers: [
          'Your title is already doing numbers. I would say congratulations, but I am still deciding what to steal.',
        ],
      },
    },
    {
      when: ['editionSeen', 'brandSeen'],
      pools: {
        reactions: [
          'Edition, identity, personal brand — same thing if the caption is confident enough.',
        ],
      },
    },
  ],
  index: [
    {
      when: ['provenanceSeen', 'editionSeen'],
      pools: {
        openers: [
          'You have been very busy becoming an edition. I only formalized the arrangement.',
        ],
        reactions: [
          'I did not buy the painting. I bought the fact that you made it.',
        ],
      },
    },
    {
      when: ['privateCollectionSeen'],
      pools: {
        openers: [
          'The house has already made space for you. A smaller version, naturally. A more useful one.',
        ],
      },
    },
  ],
};

const TRANSITIONS = {
  'garret>galleria': 'Your hands still smell like paint. The gallery has already decided what it means.',
  'galleria>gildedFork': 'The title travels faster than you do.',
  'galleria>vault': 'The white cube ends. The paperwork continues.',
  'vault>garret': 'Home is smaller when you know who has measured it.',
  'galleria>leatherLatex': 'The public room gives way to the room where taste gets comfortable.',
  'galleria>vacantEditions': 'The work leaves the wall and enters a catalogue.',
  'galleria>hairSalon': 'The market has booked an appointment for your face.',
  'galleria>maxPro': 'The label gets longer. The painting stays the same size.',
  'galleria>rageRoom': 'The gallery keeps the label. The glass boxes offer somewhere to put the feeling.',
  'rageRoom>galleria': 'The glass doors close behind you. The red dot is still waiting in the gallery.',
  'galleria>deathMetal': 'The gallery calls it a theme. The basement calls it a riff. Barbie gets the better entrance.',
  'deathMetal>galleria': 'The amps keep arguing behind you. The white cube is waiting to call the argument context.',
};

const DEFAULT_TRANSITION = 'The scene rearranges itself around you. It calls this movement.';

export function clueReveal(key) {
  return CLUE_REVEALS[key] ?? 'Something in the room has started keeping records.';
}

export function lotNumberFor(index = 1) {
  return `A-${String(Math.max(1, index)).padStart(2, '0')}`;
}

export function transitionLine(from, to) {
  return TRANSITIONS[`${from}>${to}`] ?? DEFAULT_TRANSITION;
}

/** Pick the first authored story pool whose requirements are all satisfied. */
export function storyLineFor(def, poolName, state, used = new Set()) {
  const rules = STORY_LINES[def?.id] ?? [];
  for (const rule of rules) {
    if (!rule.when.every((key) => state.hasClue(key))) continue;
    const pool = rule.pools?.[poolName];
    const fresh = pool?.filter((line) => !used.has(line)) ?? [];
    if (fresh.length) {
      const line = fresh[Math.floor(Math.random() * fresh.length)];
      used.add(line);
      return line;
    }
  }
  return null;
}

export function endingCallback(key, state) {
  const latest = state.paintings[state.paintings.length - 1];
  const title = latest?.title ? `“${latest.title}”` : 'the last canvas';
  const clues = state.clueCount;

  if (key === 'sellout') {
    return `${title} enters the archive as EDITION OF ONE. The red dot is the only thing that still looks original.`;
  }
  if (key === 'purist') {
    return clues >= 2
      ? `You cross out the lot number on ${title}. The paper resists. The canvas does not.`
      : `You turn ${title} toward the wall. No estimate survives the gesture.`;
  }
  if (key === 'ascension') {
    return clues >= 3
      ? `The archive has a file on ${title}. It does not have the work. That distinction is enough.`
      : `The archive has a file on ${title}. You leave before it can become a room.`;
  }
  return `The phrase “for the archive” follows ${title} to the door, then loses the address.`;
}
