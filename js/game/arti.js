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
  baron: '@baronvoncarpark', lucia: '@luciafennadvises',
};

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
