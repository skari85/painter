/**
 * arti.js — ARTI: the social app for artists.
 *
 * A follower count that behaves like weather, follow buttons that mostly
 * work (a catastrophe in itself), and notifications that mean you harm.
 * NPCs follow you when you break them kindly and unfollow you mid-meltdown.
 * All of it is announced. All of it matters. None of it matters.
 *
 * Pure state machine + copy pools; the DOM lives in ui.js.
 */

import { Emitter, pick, chance, rand, randInt } from '../core/utils.js';

const BOT_HANDLES = [
  '@canvas_goblin', '@palette.pal', '@oslo_art_mom', '@gesso_jesus',
  '@frame_maxxer', '@vernissage_vampire', '@dipinto_daddy', '@hue.hue.hue',
];

export const NPC_HANDLES = {
  victoria: '@victoriavane', kreyo: '@kreyo.eth', dolores: '@thepaleview',
  chad: '@chadsterlingboats', muffy: '@muffyfeelings', docent: '@docent_year9',
  index: '@misterindex', barnaby: '@barnabyflips', petra: '@petra.gatekeeps',
  baron: '@baronvoncarpark', lucia: '@luciafennadvises', milo: '@milo.collects',
};

/** Milo's phone call: a tiny social feature with the emotional scale of a tax audit. */
export const COLLECTOR_CALL = {
  id: 'milo',
  name: 'Milo “Mister M” Madsen',
  handle: '@milo.collects',
  role: 'Collector — Host of the Private Party',
  face: 'puplic/people/collector.png',
  opening: 'Painter. I am calling because someone told me you have been explaining my hat incorrectly.',
  rounds: [
    {
      line: 'Also, the little painting you made is making the room feel emotionally uninsured.',
      options: [
        { text: 'The painting is fine. The room is the problem.', tone: 'witty', reply: 'That is a very expensive way to say you dislike my furniture.', unhappy: 1 },
        { text: 'I can repaint it in a way that hurts less.', tone: 'kind', reply: 'Do not offer kindness while I am holding a portfolio.', unhappy: 0 },
        { text: 'Your hat has more personality than your collection.', tone: 'brutal', reply: 'I knew this call was a mistake. The hat is vintage.', unhappy: 2 },
      ],
    },
    {
      line: 'I have put you on speaker. The sculpture is listening and it has a stronger market position.',
      options: [
        { text: 'Ask the sculpture what it thinks of your curtains.', tone: 'witty', reply: 'The sculpture says nothing because it has learned boundaries.', unhappy: 1 },
        { text: 'Please take me off speaker. This is private.', tone: 'kind', reply: 'Privacy is a luxury good. I have three units.', unhappy: 0 },
        { text: 'Your entire house is a waiting room for a personality.', tone: 'brutal', reply: 'I am ending this before the furniture starts agreeing with you.', unhappy: 2 },
      ],
    },
    {
      line: 'Final question: did you paint the canvas, or did the canvas simply survive you?',
      options: [
        { text: 'It survived the collector. That is the important part.', tone: 'witty', reply: 'Unprofessional. Accurate. I dislike both qualities.', unhappy: 1 },
        { text: 'I am still figuring out what it wants to be.', tone: 'kind', reply: 'It wants a better room. Everyone wants a better room.', unhappy: 0 },
        { text: 'It painted itself. You just failed to purchase the credit.', tone: 'brutal', reply: 'Goodbye, painter. I am putting your number in a very elegant drawer.', unhappy: 2 },
      ],
    },
  ],
  endings: [
    'Milo has muted you. The mute is upholstered.',
    'Milo has ended the call. The collector is not happy with the painter.',
    'Milo has saved your number as “DO NOT LET NEAR THE LINEN”.',
  ],
};

const TALK_PROFILES = {
  victoria: {
    opening: 'You have thirty seconds. Make them useful, or make them expensive.',
    rounds: [
      { line: 'What are you trying to make people feel?', options: [
        { text: 'A little less alone.', tone: 'kind', reply: 'Annoyingly sincere. That can be marketed.', unhappy: 0 },
        { text: 'Uncomfortable, but with good lighting.', tone: 'witty', reply: 'Now that is a gallery answer.', unhappy: 0 },
        { text: 'The urge to leave before the price talk.', tone: 'brutal', reply: 'Honesty is not a sales strategy. Usually.', unhappy: 1 },
      ] },
      { line: 'And what do you want from this artworld?', options: [
        { text: 'A room and a chance.', tone: 'kind', reply: 'A room is possible. The chance is billable.', unhappy: 0 },
        { text: 'A wall near the toilet, obviously.', tone: 'witty', reply: 'You listened. I respect that.', unhappy: 0 },
        { text: 'Less pricing, more looking.', tone: 'brutal', reply: 'Then you have chosen the wrong century.', unhappy: 1 },
      ] },
    ],
  },
  kreyo: {
    opening: 'You found the chat button. Bold. I usually charge for access to this much vision.',
    rounds: [
      { line: 'Tell me your medium. Quickly. I have a drop in twelve minutes.', options: [
        { text: 'Paint, mostly. Sometimes panic.', tone: 'kind', reply: 'Panic is a strong color. Very underused.', unhappy: 0 },
        { text: 'Whatever survives the caption.', tone: 'witty', reply: 'Okay, that one is annoyingly good.', unhappy: 0 },
        { text: 'Not a brand, if that is what you mean.', tone: 'brutal', reply: 'My brand just blocked your tone.', unhappy: 1 },
      ] },
      { line: 'Would you put your work on-chain?', options: [
        { text: 'Only if the chain can carry it.', tone: 'kind', reply: 'That is almost a manifesto. Do not ruin it.', unhappy: 0 },
        { text: 'I prefer a wall. It has better uptime.', tone: 'witty', reply: 'I hate that I want to repost this.', unhappy: 0 },
        { text: 'I would rather put your sneeze in a museum.', tone: 'brutal', reply: 'The sneeze has representation.', unhappy: 1 },
      ] },
    ],
  },
  dolores: {
    opening: 'I am listening. Do not mistake that for approval.',
    rounds: [
      { line: 'What is the work refusing to say?', options: [
        { text: 'That it needs permission.', tone: 'kind', reply: 'Good. Refusal is often the first honest sentence.', unhappy: 0 },
        { text: 'Its own exhibition statement.', tone: 'witty', reply: 'A mercy to the reader.', unhappy: 0 },
        { text: 'Anything that would fit in a review.', tone: 'brutal', reply: 'You have read too many reviews.', unhappy: 1 },
      ] },
      { line: 'Do you want me to write about it?', options: [
        { text: 'Only if you actually look at it.', tone: 'kind', reply: 'A dangerous request. I accept.', unhappy: 0 },
        { text: 'Write “Tuesday” and let the public panic.', tone: 'witty', reply: 'That title is already taken by three columns.', unhappy: 0 },
        { text: 'No. It has suffered enough.', tone: 'brutal', reply: 'Finally, a responsible artist.', unhappy: 0 },
      ] },
    ],
  },
  chad: {
    opening: 'Hey! Is this the artist chat? Muffy, I found the artist chat.',
    rounds: [
      { line: 'Would your painting work on a yacht?', options: [
        { text: 'Only if the yacht can sit with uncertainty.', tone: 'kind', reply: 'Mine has a therapist for that.', unhappy: 0 },
        { text: 'Does the yacht come with a wall?', tone: 'witty', reply: 'Great question. I will ask the captain.', unhappy: 0 },
        { text: 'Your yacht already has enough bad art.', tone: 'brutal', reply: 'Muffy, the artist is doing a critique.', unhappy: 1 },
      ] },
      { line: 'What does it cost?', options: [
        { text: 'Enough to make you look at it twice.', tone: 'kind', reply: 'That is a very compelling number.', unhappy: 0 },
        { text: 'One boat, no trades.', tone: 'witty', reply: 'I have several boats and strong feelings.', unhappy: 0 },
        { text: 'More than your attention span.', tone: 'brutal', reply: 'Muffy says that was mean. Accurate, though.', unhappy: 1 },
      ] },
    ],
  },
  milo: {
    opening: 'This is not the call. This is the chat. The chat is less upholstered.',
    rounds: [
      { line: 'Have you been telling people about my collection?', options: [
        { text: 'Only the flattering parts.', tone: 'kind', reply: 'There are flattering parts?', unhappy: 0 },
        { text: 'The collection has been telling people about itself.', tone: 'witty', reply: 'That sounds like my furniture speaking again.', unhappy: 1 },
        { text: 'I have been warning them.', tone: 'brutal', reply: 'A bold use of a public platform.', unhappy: 2 },
      ] },
      { line: 'One sentence. Why should I keep following you?', options: [
        { text: 'Because I make the room less lonely.', tone: 'kind', reply: 'I will allow one sincere sentence.', unhappy: 0 },
        { text: 'Because your hat needs better company.', tone: 'witty', reply: 'The hat is vintage. The company is pending.', unhappy: 1 },
        { text: 'You should not. It builds character.', tone: 'brutal', reply: 'Do not make unfollowing sound aspirational.', unhappy: 2 },
      ] },
    ],
  },
};

const GENERIC_TALK = {
  opening: 'ARTI has connected you. The other person is pretending this was intentional.',
  rounds: [
    { line: 'What are you working on right now?', options: [
      { text: 'Something honest, even if it is messy.', tone: 'kind', reply: 'That is a respectable risk.', unhappy: 0 },
      { text: 'A piece with excellent networking potential.', tone: 'witty', reply: 'Finally, a medium everyone understands.', unhappy: 0 },
      { text: 'Trying not to become content.', tone: 'brutal', reply: 'Too late. The chat has archived you.', unhappy: 1 },
    ] },
    { line: 'What do you want people to remember?', options: [
      { text: 'That they were there.', tone: 'kind', reply: 'Memory is a difficult collector. Good answer.', unhappy: 0 },
      { text: 'The lighting, obviously.', tone: 'witty', reply: 'ARTI has clipped that for the story.', unhappy: 0 },
      { text: 'That the artworld survived me.', tone: 'brutal', reply: 'The artworld is filing a response.', unhappy: 1 },
    ] },
  ],
};

/** Short ARTI chats for the roster; the full collector call remains special. */
export const ARTI_TALKS = Object.fromEntries(
  Object.entries(NPC_HANDLES).map(([id, handle]) => [id, {
    id,
    handle,
    ...(TALK_PROFILES[id] ?? GENERIC_TALK),
    endings: ['The chat ended. ARTI saved the transcript and called it networking.', 'They left you on read with professional confidence.'],
  }])
);

const COMMENTS_GOOD = [
  'would look great in the guesthouse',
  'this healed something in me. billing you.',
  'minted.',
  'the algorithm blesses you. briefly.',
  'saving this to my “feelings” board',
  'how is this not in a storage facility in Geneva',
];

const COMMENTS_MEAN = [
  'beige hotel.',
  'interesting choice to post this',
  'my nephew does this. he is four.',
  'brave.',
  'the confidence is the medium, I see',
];

const POST_FLAVOR = [
  'ARTI is surprised too.',
  'Do not let it go to your head. It will try.',
  'Your reach is now measurable.',
  'The explore page has been notified.',
];

const SPLAT_NOTES = [
  'Someone posted a photo of the incident. You are cropped out.',
  'The splat has 200 likes. Your account has none of them.',
];

/* --- the platform itself, mocking you --- */
const SYS_NOTES = [
  'ARTI has labeled your account “art-adjacent”.',
  'Your reach was throttled for crimes against the grid layout.',
  'Verification now costs $8 and one (1) dignity. You qualify for neither.',
  'An account named @art_fraud_police viewed your profile.',
  'Your last post is doing numbers in a region you cannot pronounce.',
  'The explore page considered you, then chose a dog who paints. The dog has a manager.',
  'ARTI renamed your notifications tab “the wound feed”. This cannot be undone.',
  'You are eligible for ARTI Gold. Eligibility is not real and cannot be transferred.',
  '12 bots followed you at once, took one look, and left as a group.',
  'ARTI suggests: post more. ARTI also suggests: stop.',
  'Your engagement rate is now a fraction. The denominator is thriving.',
  'A brand wants to work with you. The brand is a candle called SMOLDER.',
];

/* --- the Follow back button, which has opinions --- */
const FOLLOW_BACK_FAILS = [
  'Sorry. Try again later. (It is later. Still no.)',
  'The button moved. You missed. Everyone saw.',
  'ARTI Premium is required to follow back. ARTI Premium cannot be purchased.',
  'Your tap was registered as “engagement”. Thank you for your service.',
  'Follow back failed: the bot is in a meeting. The meeting is about you.',
];

const FOLLOW_BACK_WINS = [
  'IT WORKED. You followed {h}. They instantly DMed you a photo of a boat. No caption.',
  'You followed {h}. Your Following count is no longer zero. ARTI sent a wellness check.',
  'Followed {h}. They posted “new mutuals 👀” and tagged a marina.',
];

const BOT_UNFOLLOW = [
  '{h} unfollowed you. They lasted eight seconds.',
  '{h} has unfollowed you. Their statement cites “vibes”.',
  '{h} unfollowed you and followed @kreyo.eth instead. The algorithm calls this “balance”.',
];

/* --- you following them --- */
const YOU_FOLLOW = [
  'ARTI called it “a bold strategy”.',
  'They have not posted since the incident. You will wait anyway.',
  'Their grid is 90% boats. You knew what this was.',
];

const YOU_UNFOLLOW = [
  'They will know. They always know.',
  'ARTI notified no one. ARTI is lying.',
  'Somewhere, a wine glass was set down meaningfully.',
];

const THEY_UNFOLLOW_BACK = [
  'The sunset they quote-posted afterwards was about betrayal. About you.',
  'Their statement runs four paragraphs and your name is in two of them.',
];

/* --- them following you back: per-character drama --- */
const NPC_FOLLOW_BACK = {
  victoria: '@victoriavane followed you back. She follows four people and one tax shelter.',
  kreyo: '@kreyo.eth followed you back. The follow is on-chain now. It can never be deleted. Or explained.',
  dolores: '@thepaleview followed you back. She follows no one. The Pale Review has been notified of the anomaly.',
  chad: '@chadsterlingboats followed you back FROM THE BOAT. The boat has wi-fi. The wi-fi is faster than the gallery\'s.',
  muffy: '@muffyfeelings followed you back. Her bio is “🌊”. Her last post is also “🌊”.',
  docent: '@docent_year9 followed you back. Nine years of silence, broken, for you.',
  index: '@misterindex followed you back. You are now a tracked instrument. Congratulations on the liquidity.',
  barnaby: '@barnabyflips followed you back. He follows to sell high. You are the high.',
  petra: '@petra.gatekeeps followed you back. You were not told which list this puts you on.',
  baron: '@baronvoncarpark followed you back. The account is operated by a footman named Willis.',
  lucia: '@luciafennadvises followed you back. It was in the deck all along. Slide 40.',
};

/* --- duels, as reported by the wound feed --- */
const NPC_UNFOLLOW_DRAMA = [
  '{h} unfollowed you mid-meltdown. Last seen: screaming.',
  '{h} posted a four-paragraph statement about you, then unfollowed. The statement is pinned.',
  '{h} went private, came back public purely to unfollow you, then went private again.',
  '{h} unfollowed you. Their followers noticed. Yours noticed. Nobody did anything.',
];

const NPC_DISARM_FOLLOW = [
  '{h} followed you. You know what you did.',
  '{h} followed you and liked a post from March. A peace offering.',
  '{h} followed you with the energy of a small white flag.',
];

const NPC_BORED_UNFOLLOW = [
  '{h} unfollowed you. No statement. The silence IS the statement.',
  '{h} unfollowed you during a panel about supporting emerging artists.',
  '{h} unfollowed you, then posted about the importance of community.',
];

export class ArtiEngine extends Emitter {
  #t = 8;                 // seconds until the next little wound
  #pending = null;        // { handle, left } — the bot follow-back window
  #pendingNPC = null;     // { id, left } — an NPC deciding if you're worth it
  #noteId = 1;

  constructor() {
    super();
    this.followers = 241;
    this.following = 0;
    this.followingNPCs = new Set();   // ids YOU follow
    this.npcFollowsYou = new Set();   // ids that follow YOU
    this.posts = [];      // { title, likes, comments: [{ who, text }] }
    this.notes = [{
      id: 0, kind: 'sys', followBack: false,
      text: 'Welcome to ARTI. Everyone can see you. No one is looking.',
    }];
  }

  reset() {
    this.followers = 241;
    this.following = 0;
    this.followingNPCs.clear();
    this.npcFollowsYou.clear();
    this.posts = [];
    this.#pending = null;
    this.#pendingNPC = null;
    this.notes = [{
      id: this.#noteId++, kind: 'sys', followBack: false,
      text: 'Welcome back to ARTI. Everyone remembers. No one will say what.',
    }];
    this.emit('change');
  }

  #note(text, kind = 'sys', followBack = false, { notify = false } = {}) {
    this.notes.unshift({ id: this.#noteId++, text, kind, followBack });
    if (this.notes.length > 30) this.notes.pop();
    this.emit('buzz');
    this.emit('change');
    if (notify) this.emit('notify', { kicker: 'ARTI', body: text, cls: kind === 'sorry' ? 'bad' : '' });
  }

  update(dt) {
    // the bot's follow-back window closes, dramatically
    if (this.#pending) {
      this.#pending.left -= dt;
      if (this.#pending.left <= 0) {
        const h = this.#pending.handle;
        this.#pending = null;
        this.followers = Math.max(0, this.followers - 1);
        this.#note(pick(BOT_UNFOLLOW).replaceAll('{h}', h), 'sorry', false, { notify: true });
      }
    }
    // an NPC deliberates about you
    if (this.#pendingNPC) {
      this.#pendingNPC.left -= dt;
      if (this.#pendingNPC.left <= 0) {
        const { id } = this.#pendingNPC;
        this.#pendingNPC = null;
        const h = NPC_HANDLES[id];
        if (chance(0.7)) {
          this.npcFollowsYou.add(id);
          this.followers++;
          this.#note(NPC_FOLLOW_BACK[id] ?? `${h} followed you back. Suspicious.`, 'follow', false, { notify: true });
        } else {
          this.#note(`${h} saw your follow and did nothing. Publicly. The nothing is pinned.`, 'sorry', false, { notify: true });
        }
      }
    }

    this.#t -= dt;
    if (this.#t > 0) return;
    this.#t = rand(9, 16);
    const roll = Math.random();
    if (roll < 0.35) {
      if (this.#pending) return;
      const h = pick(BOT_HANDLES);
      this.followers++;
      this.#pending = { handle: h, left: 8 };
      this.#note(`${h} followed you.`, 'follow', true);
    } else if (roll < 0.55) {
      this.#note(pick(SYS_NOTES), 'sys');
    } else if (roll < 0.68 && this.npcFollowsYou.size) {
      // a followed NPC gets bored — rare, cruel, extremely visible
      const id = pick([...this.npcFollowsYou]);
      this.npcFollowsYou.delete(id);
      this.followers = Math.max(0, this.followers - 1);
      this.#note(pick(NPC_BORED_UNFOLLOW).replaceAll('{h}', NPC_HANDLES[id]), 'sorry', false, { notify: true });
    }
  }

  /** The button is decorative. Mostly. Catch the bot in time and it works. */
  followBack() {
    if (this.#pending) {
      const h = this.#pending.handle;
      this.#pending = null;
      this.following++;
      this.#note(pick(FOLLOW_BACK_WINS).replaceAll('{h}', h), 'follow', false, { notify: true });
      return;
    }
    this.#note(pick(FOLLOW_BACK_FAILS), 'sorry', false, { notify: true });
  }

  /** Follow / unfollow a real person of the artworld. Consequences included. */
  toggleFollow(id) {
    const h = NPC_HANDLES[id];
    if (!h) return;
    if (this.followingNPCs.has(id)) {
      this.followingNPCs.delete(id);
      this.following = Math.max(0, this.following - 1);
      this.#note(`You unfollowed ${h}. ${pick(YOU_UNFOLLOW)}`, 'sorry', false, { notify: true });
      // if they followed you, they notice — fast, and with theater
      if (this.npcFollowsYou.has(id) && chance(0.4)) {
        this.npcFollowsYou.delete(id);
        this.followers = Math.max(0, this.followers - 1);
        this.#note(`${h} noticed within seconds and unfollowed you back. ${pick(THEY_UNFOLLOW_BACK)}`, 'sorry', false, { notify: true });
      }
    } else {
      this.followingNPCs.add(id);
      this.following++;
      this.#note(`You followed ${h}. ${pick(YOU_FOLLOW)}`, 'follow', false, { notify: true });
      if (!this.npcFollowsYou.has(id) && !this.#pendingNPC && chance(0.55)) {
        this.#pendingNPC = { id, left: rand(6, 14) };
      }
    }
  }

  /** Duels spill onto the feed. Shattering is unfollowed; disarming is followed. */
  onDuelEnd(id, outcome) {
    const h = NPC_HANDLES[id];
    if (!h) return;
    if (outcome === 'shatter') {
      if (this.npcFollowsYou.has(id)) {
        this.npcFollowsYou.delete(id);
        this.followers = Math.max(0, this.followers - 1);
      }
      this.#note(pick(NPC_UNFOLLOW_DRAMA).replaceAll('{h}', h), 'sorry', false, { notify: true });
    } else if (outcome === 'disarm') {
      if (!this.npcFollowsYou.has(id)) {
        this.npcFollowsYou.add(id);
        this.followers++;
        this.#note(pick(NPC_DISARM_FOLLOW).replaceAll('{h}', h), 'follow', false, { notify: true });
      }
    } else if (outcome === 'dismiss' && chance(0.5)) {
      this.#note(`${h} viewed your profile for 0.4 seconds and left. The view is permanent.`, 'sorry');
    }
  }

  boost() {
    const p = this.posts[0];
    if (!p) {
      this.#note('Nothing to boost. ARTI suggests becoming interesting.', 'sorry', false, { notify: true });
      return;
    }
    const likes = randInt(3, 8);
    p.likes += likes;
    this.#note(`Boosted “${p.title}”. +${likes} likes. The algorithm noticed your money.`, 'sys', false, { notify: true });
  }

  postPainting(title, quality) {
    const likes = Math.round(quality * rand(0.6, 1.6)) + randInt(0, 9);
    const comments = [];
    const handles = [...BOT_HANDLES, ...Object.values(NPC_HANDLES)];
    for (let i = 0, n = randInt(1, 3); i < n; i++) {
      comments.push({
        who: pick(handles),
        text: quality >= 55 ? pick(COMMENTS_GOOD) : pick(COMMENTS_MEAN),
      });
    }
    this.posts.unshift({ title, likes, comments });
    if (this.posts.length > 6) this.posts.pop();
    const gained = randInt(3, 12);
    this.followers += gained;
    this.#note(`“${title}” posted. +${gained} followers. ${pick(POST_FLAVOR)}`, 'sys', false, { notify: true });
    if (likes > 100) this.emit('viral', { title, likes });
  }

  onScandal() {
    const spike = randInt(8, 22);
    this.followers += spike;
    this.#note(`You are trending. +${spike} followers. The reason is sealed.`, 'sys', false, { notify: true });
  }

  onSplatted(id) {
    const h = NPC_HANDLES[id];
    this.#note(h ? `${h} went private.` : pick(SPLAT_NOTES), 'sorry', false, { notify: true });
  }

  onMinted() {
    this.#note('@kreyo.eth posted your splat. 4,000 likes. You get nothing.', 'sorry', false, { notify: true });
  }
}
