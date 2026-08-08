/**
 * characters.js — the cast of the artworld.
 *
 * Every main character has:
 *   weak / resist   — which tone cracks them, which one they eat
 *   openers         — how they attack
 *   reactions       — how they take damage, per tone
 *   playerJabs      — what YOU can say, per tone
 *   meltdown        — their final line before they storm out
 *   barks           — ambient weirdness overheard in subtitles
 */

import { pick, rand, randInt } from '../core/utils.js';

/* ============================================================
   MAIN CAST
   ============================================================ */

export const MAINS = {
  victoria: {
    id: 'victoria', name: 'Victoria Vane', shortRole: 'gallerist', role: 'Gallerist, Galleria Bianca',
    ego: 130, weak: 'witty', resist: 'brutal',
    hint: 'Her armor is money. Wit gets under it. Rage only raises her prices.',
    pace: 0.9, pitch: 0.85, accessory: null, anchor: 'victoria',
    palette: { skin: 0xe0b89a, hair: 0xf0ede6, top: 0x101014, bottom: 0x101014 },
    openers: [
      'Twelve percent and a wall near the toilet. That is my final emotion on the matter.',
      'Your work has a certain... regional sincerity. People collect that now. Ironically, mostly.',
      'I don\'t sell paintings, darling. I sell the pause before someone says the price.',
      'You have paint on your shoes. In here, that counts as a provenance.',
      'The opening is going beautifully. Three people have already pretended to cry.',
    ],
    countered: [
      'Anger? Wonderful. I can sell tickets to that too.',
      'Oh good, temperament. Temperament is twelve percent extra.',
      'Scream into the white cube. The acoustics are curated.',
    ],
    reactions: {
      kind: ['...That was disarming. I need a spreadsheet.', 'Kindness. Interesting tactic. Expensive, but interesting.'],
      witty: ['Ha. Damn. That one will cost me.', 'Careful — if you make me laugh again I\'ll have to represent you.'],
      brutal: ['Noted. Filed under "passion".', 'You kiss your collectors with that mouth?'],
    },
    weakHit: ['Stop being funny. It destabilizes the pricing.', 'I haven\'t smiled since Basel. Put it back.'],
    disarmed: ['Fine. The wall by the window. Don\'t make it weird.'],
    dismiss: ['This conversation has stopped appreciating in value.', 'Go network at someone your own size.'],
    meltdown: 'I — I have to recalculate EVERYTHING. Excuse me. EXCUSE ME.',
    barks: [
      'Every wall is a mouth and every mouth is hungry.',
      'I once sold a blank canvas to a man who thanked me for the silence.',
      'White is not a color. It is a threat.',
      'The wine is free. The eye contact costs extra.',
    ],
    playerJabs: {
      kind: ['You built a room where people feel something, even if it\'s mostly vertigo. That counts.'],
      witty: [
        'Victoria, you could hang a grocery list and call it "late-stage hunger". I respect it. Slightly.',
        'Twelve percent? For twelve percent I want the toilet wall AND your dignity as a coaster.',
      ],
      brutal: [
        'This gallery is a fridge for rich people\'s feelings and you\'re the light that comes on.',
        'You don\'t have taste, Victoria. You have receipt recognition.',
      ],
    },
  },

  kreyo: {
    id: 'kreyo', name: 'KREYO', shortRole: 'rival artist', role: 'Rival Artist',
    ego: 90, weak: 'brutal', resist: 'kind',
    hint: 'All swagger, no floor underneath. Kindness confuses him. Brutality finds the crack.',
    pace: 1.2, pitch: 1.15, accessory: 'sunglasses', anchor: 'kreyo',
    palette: { skin: 0xb0703f, hair: 0x14161c, top: 0xc9463d, bottom: 0x2b3a67 },
    openers: [
      'Cute. You still mix your own paint like a medieval peasant. I 3D-print my sincerity.',
      'I sold three NFTs of my sneeze this morning. The sneeze has a waitlist.',
      'Your brushwork says "I had a childhood". Mine says "I had a strategy".',
      'Don\'t worry, there\'s room for both of us. Me at the top, you in the gift shop.',
      'I\'m doing a residency on a yacht. The sea is my studio. My studio has a DJ.',
    ],
    countered: [
      'Aw. Being nice. Is that your medium? "Nice"?',
      'Kindness noted. I\'ll have my studio manager embroider it.',
      'You hug like a press release.',
    ],
    reactions: {
      kind: ['...Why are you being decent? What\'s the angle?', 'Nobody is kind at an opening. What do you know that I don\'t?'],
      witty: ['Okay that was almost funny. Almost. Don\'t quote me.', 'Ha — no. No. I refuse to laugh at my own opening-adjacent event.'],
      brutal: ['...The sunglasses stay on because the eyes are wet.', 'You don\'t know my process! My process is MYSTERY!'],
    },
    weakHit: ['Take it BACK. The brand is FINE. I am FINE.', 'Say that to my collector base. They\'re in Dubai and very online.'],
    disarmed: ['...You wanna split a studio visit sometime? No? Forget I said it. FORGET IT.'],
    dismiss: ['I have a panel in ten minutes. "Post-Authenticity". I invented it.', 'This convo is below my price point.'],
    meltdown: 'I AM A VISIONARY. THE SNEEZE WAS VISIONARY. TELL EVERYONE I LEFT ON PURPOSE.',
    barks: [
      'My drop sold out in four minutes. The art? Less relevant.',
      'I don\'t do sketches. I do provocations.',
      'Basel was a spiritual experience. I bought a watch there.',
      'The canvas is dead. I killed it. You\'re welcome.',
    ],
    playerJabs: {
      kind: ['The sneeze thing was actually brave. Deranged, but brave.'],
      witty: ['KREYO, you\'re not post-internet. You\'re post-everyone-caring.'],
      brutal: [
        'You\'re not an artist, you\'re a limited-edition apology with a merch table.',
        'Your sneeze had more vision than your last three shows, and it knew when to stop.',
        'The yacht residency is perfect — finally, your work and your depth at the same address.',
      ],
    },
  },

  dolores: {
    id: 'dolores', name: 'Dolores Pang', shortRole: 'critic', role: 'Critic, The Pale Review',
    ego: 110, weak: 'kind', resist: 'witty',
    hint: 'She has heard every joke — she wrote most. No one has ever simply been kind to her.',
    pace: 0.7, pitch: 0.8, accessory: 'clipboard', anchor: 'dolores',
    palette: { skin: 0xd9c2a8, hair: 0x3a3430, top: 0x22242e, bottom: 0x22242e },
    openers: [
      'I reviewed you in a dream last night. You were a beige hotel. I gave the lobby one star.',
      'Your palette reminds me of a city I left for excellent reasons.',
      'I don\'t hate your work. Hatred would require it to matter. We can fix that.',
      'I once made a sculptor cry in two words. The words were "adequate bronze".',
      'Relax. I\'m not writing anything down. The notebook is for groceries and grudges.',
    ],
    countered: [
      'Wit. How 2009. I have a drawer of wit at home; I feed it to my other drawer.',
      'I invented that joke. It was better when it was mine.',
      'Quips are the coupons of the insecure.',
    ],
    reactions: {
      kind: ['...No. Don\'t be nice to me. I don\'t have a filing system for it.', 'That was... I need to sit with that. On a chaise. With my grudges.'],
      witty: ['Competent. I shall describe you as competent, and you will thank me.', 'A retort. Charming. I\'ve filed it under "evidence".'],
      brutal: ['Oh, good. Venom. Venom I can quote.', 'Yes, yes, wound the critic. Very original. Very "page six".'],
    },
    weakHit: ['Stop it. Kindness is not a recognized medium.', 'I am the one who disarms people. That is MY formal device.'],
    disarmed: ['...Your next show. I will attend. Not to review. To... see. Don\'t tell anyone.'],
    dismiss: ['I have a deadline and you are not going to be in it.', 'This exchange has been provisionally titled "Tuesday".'],
    meltdown: 'THE REVIEW IS CANCELLED. EVERYTHING IS CANCELLED. EXCEPT MY COLUMN. MY COLUMN IS ETERNAL.',
    barks: [
      'I loved it before it existed. Now it\'s too late for both of us.',
      'Every opening is a funeral for a painting that might have been.',
      'I don\'t attend after-parties. I attend consequences.',
      'The last artist I praised retired out of sheer gratitude.',
    ],
    playerJabs: {
      kind: [
        'You see more in a room than anyone here. It must be lonely being the only one awake.',
        'Whatever the review says — thanks for actually looking. Nobody looks anymore.',
      ],
      witty: ['Dolores, your dream-hotel review of me needs a spa. I\'m adding one. Five stars, posthumously.'],
      brutal: [
        'You don\'t write criticism, you write obituaries for a medium you were too scared to practice.',
        'The Pale Review — because "Unfinished Novel Quarterly" was taken.',
      ],
    },
  },

  chad: {
    id: 'chad', name: 'Chad Sterling', shortRole: 'collector', role: 'Collector (Marine Assets)',
    ego: 80, weak: 'brutal', resist: 'kind',
    hint: 'A golden retriever in a quarter-zip. Respects dominance. Kindness reads as weakness — his, somehow.',
    pace: 1.0, pitch: 0.95, accessory: 'wine', anchor: 'chadMuffy',
    palette: { skin: 0xd9a184, hair: 0xc9a86a, top: 0x3b6ea5, bottom: 0xe8e2d4 },
    openers: [
      'Does it come in a bigger size? I\'ve got a wall the exact dimensions of my guilt.',
      'I only buy art my therapist recognizes. She says hello, by the way. She says a lot about you.',
      'The yacht\'s trauma suite needs something "wet but expensive". You do wet?',
      'I don\'t get it and that\'s how I know it\'s working.',
      'Muffy cried at the blue one. We bought two.',
    ],
    countered: [
      'Ha! You\'re nice. Muffy, he\'s nice! I hate it.',
      'Kindness, huh. My trainer says I should sit with discomfort. I bought a bench instead.',
      'You sound like my gratitude journal. I pay a man to write it.',
    ],
    reactions: {
      kind: ['...Wholesome. Weird flex for an opening. I\'ll allow it.', 'You remind me of my dog. Expensive compliment. She has a boat.'],
      witty: ['HA! Good one. I think. Muffy, was that one good?', 'I\'m going to repeat that at dinner and absolutely nail the attribution. "Some painter".'],
      brutal: ['...Yes sir. Sorry sir. Can I buy something sir?', 'Okay. Okay. That landed. That landed in a place money can\'t reach. I need a moment. And that painting.'],
    },
    weakHit: ['Hurt me again but slower — I want to feel the value.', 'FINALLY, someone talks to me like my board does.'],
    disarmed: ['You\'re a good dude. Terrible strategy, but a good dude.'],
    dismiss: ['I gotta go float near the canapés. Big night. Big night for the canapés.', 'Talk to Muffy. She\'s the visionary. I\'m the wallet.'],
    meltdown: 'THE YACHT DOESN\'T EVEN HAVE A NAME. WE JUST CALL IT "THE APOLOGY". I NEED AIR.',
    barks: [
      'I collect like I father: from a distance, with money.',
      'Is this the one that appreciates? Emotionally, I mean.',
      'I told my son about art. He tokenized my watch.',
      'Red ones go fast. That\'s just physics.',
    ],
    playerJabs: {
      kind: ['Chad, you buying feelings you can\'t name is the most honest thing in this room.'],
      witty: ['Chad, the wall sized like your guilt needs a triptych. I do payment plans.'],
      brutal: [
        'You don\'t have a collection, Chad. You have a storage unit with a therapist on retainer.',
        'The yacht\'s trauma suite? The whole marina is a trauma suite and you\'re the loudest room.',
      ],
    },
  },

  muffy: {
    id: 'muffy', name: 'Muffy Sterling', shortRole: 'collector', role: 'Collector (Feelings Division)',
    ego: 80, weak: 'witty', resist: 'brutal',
    hint: 'She speaks in interiors and oceans. Charm her. Brutality just makes it weird for everyone.',
    pace: 0.8, pitch: 1.3, accessory: 'wine', anchor: 'chadMuffy',
    palette: { skin: 0xe8c4a8, hair: 0xe8e0cc, top: 0xefe9dc, bottom: 0xefe9dc },
    openers: [
      'We\'re redoing the guest house in "early despair". Do you do despair before noon?',
      'Is this about the ocean? I feel the ocean owes me an explanation.',
      'I only collect artists I could survive a winter with. You have soup energy.',
      'Chad buys the art. I buy the silence around it.',
      'This room has excellent acoustics for secrets. Who are you, really?',
    ],
    countered: [
      'Oh. Oh no. That was almost mean. I have a person for mean.',
      'I\'m going to pretend that was about the wine.',
      'Do you need a snack? Cruel people usually need a snack.',
    ],
    reactions: {
      kind: ['You see me. Most people just see the necklace.', 'That is the nicest thing anyone has said to me since the twins left for boarding school.'],
      witty: ['Oh! OH. That\'s going in the dinner rotation.', 'You\'re wicked. I collect wicked. It hangs well.'],
      brutal: ['...I\'m going to go stand near the blue one now.', 'That echoed somewhere I keep locked.'],
    },
    weakHit: ['Do it again. Say the funny thing again, slower.', 'I haven\'t laughed since the foundation gala. You\'re dangerous.'],
    disarmed: ['You\'re getting a studio visit. And a casserole. In that order.'],
    dismiss: ['The wine is calling. It says my full name.', 'I\'ll remember this conversation. Parts of it. Decoratively.'],
    meltdown: 'THE GUEST HOUSE WILL NEVER BE FINISHED. NOTHING WILL EVER BE FINISHED. CHAD. CHAD, THE CAR.',
    barks: [
      'Every home needs one room that scares the guests a little.',
      'I had my aura framed. It clashed with the drapes.',
      'The twins painted once. We bought them a law firm instead.',
      'I don\'t do galleries before six. The light has opinions.',
    ],
    playerJabs: {
      kind: ['Muffy, the silence around your collection is the best piece in it. And you bought that fair and square.'],
      witty: ['Early despair before noon costs extra — it\'s called "brunch nihilism" and it\'s very now.'],
      brutal: ['You don\'t collect art, Muffy. You collect witnesses.'],
    },
  },

  docent: {
    id: 'docent', name: 'The Docent', shortRole: 'docent', role: 'Senior Docent (Year Nine)',
    ego: 70, weak: 'kind', resist: 'witty',
    hint: 'Nine years of the same tour. Jokes bounce off the script. Only sincerity reaches the person inside.',
    pace: 0.6, pitch: 1.0, accessory: 'clipboard', anchor: 'docent',
    palette: { skin: 0xc9a684, hair: 0x8a8378, top: 0x8a7a5a, bottom: 0x4a4438 },
    openers: [
      'On your left you will see a painting. I have not looked at it since the incident.',
      'The tour begins where it always begins. It has never ended.',
      'Please do not touch the art. The art may touch you. That is between you and the art.',
      'I have given this tour four thousand times. You are the first to arrive on foot.',
      'This gallery was built in one night, out of spite. I was here. I am, in a sense, still here.',
    ],
    countered: [
      'Humor is not permitted on the tour. It says so on the clipboard. The clipboard is blank, but it says so.',
      'I have heard that joke. I have heard every joke. The tour continues.',
      'Jesting. Interesting. I will file it under "movements I have survived".',
    ],
    reactions: {
      kind: ['...No one has asked about the docent. The docent is... fine. The docent is me.', 'You would have been a wonderful bench. Warm. Attentive.'],
      witty: ['Noted. The clipboard rejects it, but noted.', 'Ha. Hm. No. The tour does not laugh. The tour absorbs.'],
      brutal: ['Aggression. Section nine. We do not linger in section nine.', 'You cannot hurt me. I have been hurt by professionals. With grants.'],
    },
    weakHit: ['...Why are you being good to the furniture of this place?', 'Kindness was not in the script. I am... improvising.'],
    disarmed: ['Come back on a quiet day. I\'ll show you the real painting. The one under the painting.'],
    dismiss: ['The tour moves on. The tour always moves on. That is the tour\'s one tragedy.', 'Please exit through the gift shop. There is no gift shop. Exit anyway.'],
    meltdown: 'THE INCIDENT. I LOOKED AT THE PAINTING. I LOOKED AT IT AND IT WAS WONDERFUL. NINE YEARS. WASTED.',
    barks: [
      'The fire exit is a rumor we tell children.',
      'Every pedestal holds up a small sky of someone\'s making.',
      'I water the bench on Tuesdays. It has never grown.',
      'The audio guide is just me, whispering, from inside a cupboard.',
    ],
    playerJabs: {
      kind: [
        'Nine years and you still show up. That\'s not a job, that\'s a practice. I see you.',
        'When this is all over, I\'m painting the tour. You\'ll be life-sized.',
      ],
      witty: ['Is the incident in the room with us now? Don\'t answer. Donate.'],
      brutal: ['You\'re not a docent, you\'re a haunting with a lanyard.'],
    },
  },

  index: {
    id: 'index', name: 'Mister Index', shortRole: 'the collector', role: 'The Market, Approximated',
    ego: 230,
    dmgMods: { brutal: -0.45, witty: 1.5, kind: 1.0 },   // anger FEEDS him
    hint: 'Brutality HEALS him — your anger is his liquidity. Only wit prices him out.',
    pace: 0.5, pitch: 0.7, accessory: 'cane', anchor: 'index',
    palette: { skin: 0xc4b49a, hair: 0x8a8378, top: 0x2a2c36, bottom: 0x2a2c36 },
    openers: [
      'You are not a person. You are an emerging market. I have brought paperwork.',
      'I have already sold the memory of this conversation. Twice. It appreciated.',
      'Everything you love is a unit. I simply gave the units a home. With climate control.',
      'Be angry. Anger is liquidity. I will wait, and compound.',
      'I don\'t collect art. I collect the moment artists stop resisting.',
    ],
    countered: [
      'Yes. Feed the index. Your rage has excellent fundamentals.',
      'Louder. The vault absorbs sound and converts it to value.',
      'Temper. Splendid. I\'ve tokenized worse.',
    ],
    reactions: {
      kind: ['Kindness. An unregulated market. Proceed cautiously.', 'You offer warmth to the cold room. I do not have a column for this.'],
      witty: ['...That was not in the prospectus.', 'Amusement. A loss, technically. I shall write it off against my humanity.'],
      brutal: ['Delicious. Again.', 'Your hatred outperforms most portfolios. Continue.'],
    },
    weakHit: ['Stop. Wit is... illiquid. I cannot price it. I CANNOT PRICE IT.', 'You are shorting me with charm. Illegal. Elegant. Illegal.'],
    disarmed: ['...No one has offered me anything without an invoice since 1987. What do you want?'],
    dismiss: ['This audience is concluded. The market remains open. The market is always open.', 'Return when your numbers are sadder.'],
    meltdown: 'NO. NO. THE UNITS ARE PEOPLE. THE UNITS WERE ALWAYS PEOPLE. DELIST ME. DELIST ME FROM MYSELF.',
    barks: [
      'The cages are for the paintings\' own security. And mine. Mostly mine.',
      'I once bought a sunset. The seller included the mountain. Fool.',
      'Sleep is a bear market I refuse to enter.',
      'Every masterpiece is just loot that aged well.',
    ],
    playerJabs: {
      kind: ['Somewhere before the vault, there was a kid who liked a picture. I\'m talking to him. He can still walk out.'],
      witty: [
        'Index, you\'re not a collector, you\'re a freezer with a valuation — and buddy, the power bill of your soul is coming due.',
        'You sold the memory of this conversation? Joke\'s on them. I give the memories away. It\'s the originals that cost you.',
        'The market always wins, sure — but the market has never once made anyone laugh at a dinner party on purpose.',
      ],
      brutal: [
        'You\'re a fire sale in a suit. Everything you touch gets cheaper, including eternity.',
        'I\'d burn this vault, but arson would just be another acquisition for you.',
      ],
    },
  },

  barnaby: {
    id: 'barnaby', name: 'Barnaby Crisp', shortRole: 'collector (liquidity)', role: 'Collector — Liquidity Division',
    ego: 100, weak: 'brutal', resist: 'kind',
    hint: 'A bully in loafers. Reads kindness as a bid. Only savagery gets a callback.',
    pace: 1.1, pitch: 1.05, accessory: 'phone',
    palette: { skin: 0xd9a184, hair: 0x2a2018, top: 0x2b3a67, bottom: 0x1c1c22 },
    openers: [
      'I bought three of your classmates\' futures this morning. Yours is trading at a discount, champ.',
      'Nothing personal — I don\'t look at them, I lever them. You\'re lever-able, right?',
      'Your piece back there? Already sold it. Hypothetically. Emotionally, I mean. For double.',
      'I give artists exposure. Exposure to me.',
      'Love the work. Can you do forty more by Q3? My storage unit has a quota.',
    ],
    countered: [
      'Aww. You poor sweet summer canvas.',
      'Kindness! My favorite tell. I\'ll note it in the position I\'m taking on you.',
      'You\'re cute when you\'re gentle. Like a yield curve.',
    ],
    reactions: {
      kind: ['Gross. Do it less.', 'Careful — I almost felt the price of that sentence.'],
      witty: ['Ha. Careful, I might put that in the prospectus.', 'Funny. I\'ll expense the laugh.'],
      brutal: ['...Okay. Okay. That is EXACTLY what my father said at Thanksgiving.', 'Ouch. Right in the carried interest.'],
    },
    weakHit: ['The vault is temperature-controlled, you know. My feelings are NOT.', 'Stop. I pay people to prevent this sensation.'],
    disarmed: ['...Do you need money? Is that a thing you need? Weird question. Forget it.'],
    dismiss: ['I have a paddock of young artists to emotionally damage. Busy busy.', 'This stopped being accretive.'],
    meltdown: 'MY WHOLE PORTFOLIO IS PEOPLE. PEOPLE WHO HATE ME. CALL MY HELICOPTER. CALL IT TWICE.',
    barks: [
      'I don\'t collect art. I collect exits.',
      'Someday all of this will be mine twice.',
      'Who\'s the red one by? Buy it.',
      'Emotionally I\'m diversified. That\'s why the art cries for me.',
    ],
    playerJabs: {
      kind: ['One day you\'ll own everything and feel nothing, and I\'ll still feel bad for you. That\'s my edge.'],
      witty: ['Lever-able? Buddy, you\'re not a collector, you\'re a margin call with cufflinks.'],
      brutal: [
        'You don\'t flip art, Barnaby. You flip headstones. Same energy, less paperwork.',
        'Your taste is a liquidation event wearing a watch.',
        'You bought your first painting to impress a woman who was pretending to be impressed. Everyone knows.',
      ],
    },
  },

  petra: {
    id: 'petra', name: 'Petra Voss', shortRole: 'advisor (exclusions)', role: 'Advisor — Gatekeeping Emerita',
    ego: 120, weak: 'witty', resist: 'kind',
    hint: 'Ice-cold gatekeeper. Kindness is a weakness she bills by the hour. Out-clever her.',
    pace: 0.8, pitch: 0.9, accessory: null,
    palette: { skin: 0xe0b89a, hair: 0x1c1a20, top: 0x3a3a44, bottom: 0x14161c },
    openers: [
      'I decide who exists. Currently, you\'re a rumor.',
      'Your file is thin. Your file is, technically, a napkin.',
      'I don\'t hate emerging artists. I simply don\'t perceive them until they matter.',
      'Everyone in this room is someone I allowed. Even the wine mom. Especially the wine mom.',
      'You have the aura of a grant application I\'d decline warmly.',
    ],
    countered: [
      'Oh, you\'re soft. The machine loves soft. It digests it quickly.',
      'Kindness. I invoice for that.',
      'Sweet. Sweetness is the first thing we budget out.',
    ],
    reactions: {
      kind: ['I\'ll pretend that landed somewhere.', 'Warmth. How regional.'],
      witty: ['...Noted. That\'s going in the memo I don\'t write about people like you.', 'Hm. The napkin has jokes.'],
      brutal: ['Teeth. Interesting. Most of you come pre-defanged.', 'Volume without leverage. Adorable.'],
    },
    weakHit: ['Stop that. Wit is not a currency I recognize. Stop it immediately.', 'You are making this room unpredictable and I HATE this room being unpredictable.'],
    disarmed: null,
    dismiss: ['This meeting was a favor. It has expired.', 'I\'ve already forgotten your medium. It\'s a mercy, trust me.'],
    meltdown: 'I BUILT THIS SCENE. I AM THE WALL AND THE NAIL. YOU CAN\'T HANG ME. NOBODY HANGS ME.',
    barks: [
      'Provenance is power wearing gloves.',
      'I can smell a grant application from three rooms away.',
      'Everything is copy. Everything.',
      'Exclusivity is just hospitality with the door mostly closed.',
    ],
    playerJabs: {
      kind: ['It must be tiring, deciding who exists every day. Rest. We\'ll hold the wall.'],
      witty: [
        'Petra, being imperceptible to you sounds like a superpower. I can finally work in peace.',
        'Your memo about people like me — cc it to my landlord. He also doesn\'t perceive me.',
      ],
      brutal: [
        'You didn\'t build the scene, Petra. You charge rent on other people\'s courage.',
        'Gatekeeping is just fear with better tailoring.',
      ],
    },
  },

  baron: {
    id: 'baron', name: 'Baron von Carpark', shortRole: 'collector (hereditary)', role: 'Collector — Hereditary, Obviously',
    ego: 90, weak: 'kind', resist: 'witty',
    hint: 'Eight centuries of ancestors, one soft heart. Jokes bounce off the title. Warmth breaches the walls.',
    pace: 0.5, pitch: 0.75, accessory: 'cane',
    palette: { skin: 0xd9c2a8, hair: 0xe8e0cc, top: 0x4a2c2a, bottom: 0x2a2c36 },
    openers: [
      'My family has owned art since art had serfs in it.',
      'I collect outsider art. I have never met an outsider. One has staff for that.',
      'In my palazzo, your little painting would make a charming coaster room.',
      'You paint? How rustic. My grandfather commissioned wars.',
      'I once traded a village for a Vermeer. The village sends cards. The Vermeer appreciates.',
    ],
    countered: [
      'Ha! Jokes. My staff laughs at jokes for me. They\'re wonderful at it.',
      'Wit is a tradesman\'s tool. I have people who hold my tools.',
      'Amusing. I\'ll have it written down and read to me at Christmas.',
    ],
    reactions: {
      kind: ['...Oh. OH. Nobody has spoken warmly to me since the funeral of my third-favorite horse.', 'You would have been treasured at the palazzo. As a guest! Possibly as a fixture.'],
      witty: ['I shall have that reviewed by someone I own.', 'Hm. The help will find that hilarious. I\'ll tell them tonight.'],
      brutal: ['I shall have you reviewed by someone I own.', 'Barbaric. I own a dungeon with better manners.'],
    },
    weakHit: ['Stop. Warmth is my one weakness. Along with shellfish and democracy.', 'Kindness, in THIS economy? You reckless, generous peasant. Continue.'],
    disarmed: ['Come to the palazzo. Bring the painting. Bring... a friend? Are you a friend?'],
    dismiss: ['I smell a tradesman. Elsewhere. Go.', 'This conversation lacks a crest. It ends.'],
    meltdown: 'THE SERFS WERE THE ART. THE ART WAS THE SERFS. I SEE IT NOW. FETCH THE SMELLING SALTS AND THE SMALL CAR.',
    barks: [
      'Everything was better when it was worse.',
      'I had a Basquiat framed in a Rembrandt. The frame won.',
      'Poor people make such textured art. Why is that.',
      'The palazzo has a room no one may enter. It contains a beanbag. It is sacred.',
    ],
    playerJabs: {
      kind: [
        'Baron, the horse was lucky to know you. Genuinely.',
        'Behind the palazzo there\'s a kid who liked colors. He\'d be fun at dinner. Invite him.',
      ],
      witty: [],
      brutal: ['Your family didn\'t collect art, it collected the people who made it. That\'s not taste — it\'s a ransom note with a pedigree.'],
    },
  },

  lucia: {

    id: 'lucia', name: 'Lucia Fenn', shortRole: 'advisor', role: 'Art Advisor to the Vault',
    ego: 100, weak: 'witty', resist: 'brutal',
    hint: 'She diversifies people. Unimpressed by heat; allergic to being out-clevered.',
    pace: 0.9, pitch: 1.05, accessory: 'phone', anchor: 'lucia',
    palette: { skin: 0x9a6a48, hair: 0x1c1a20, top: 0xb8b2c4, bottom: 0xb8b2c4 },
    openers: [
      'I diversify people. You are currently... mid-cap emerging. Don\'t take it personally. Take it financially.',
      'Your file says you still believe in "the soul". We keep that page. It makes clients feel rustic.',
      'I advised three biennales this year. I remember none of them. That is expertise.',
      'Mister Index doesn\'t buy art. I buy it, and he inherits the reflection.',
    ],
    countered: [
      'Volume. How retail.', 'I\'ve been shouted at by heads of state with better tailoring.',
    ],
    reactions: {
      kind: ['Sincerity. Ugh. Untraceable. I can\'t advise against it cleanly.', 'You\'d make a terrible asset. That was almost a compliment.'],
      witty: ['...I\'m adding that to the deck. You\'ll get no credit.', 'Hm. The deck has a joke now. It\'s yours. You\'re welcome.'],
      brutal: ['Noted. Filed. Monetized.', 'Your anger has been routed to the appropriate fund.'],
    },
    weakHit: ['Stop being clever. The model doesn\'t price clever. The model is THREATENED by clever.'],
    disarmed: ['...Coffee. Sometime. Off the record. Off ALL records.'],
    dismiss: ['This meeting has been minuted as "weather".', 'I have a call with a war crimes tribunal about a mural. Excuse me.'],
    meltdown: 'THE SPREADSHEET HAS FEELINGS. I TAUGHT IT FEELINGS. THIS WAS NOT THE PLAN.',
    barks: [
      'I can value anything. That is the tragedy.',
      'Provenance is just gossip with letterhead.',
      'I don\'t attend openings. I attend valuations.',
      'My love language is due diligence.',
    ],
    playerJabs: {
      kind: ['You see everything as a cell in a sheet. Must be restful. Must be so quiet in there.'],
      witty: ['Lucia, the only thing you can\'t value is why anyone\'s here. It\'s the last unpriced thing. It\'s why you keep circling it.'],
      brutal: ['You\'re not an advisor, you\'re a receipt that learned to walk.'],
    },
  },
};

/* ============================================================
   AMBIENT CROWD — procedurally-assembled artworld fauna
   ============================================================ */

const CROWD_TYPES = [
  {
    type: 'wineMom', names: ['A Wine Mom', 'Another Wine Mom', 'The Third Wine Mom'],
    role: 'opening regular',
    palette: () => ({ skin: pick([0xe8c4a8, 0xd9a184]), hair: pick([0xc9a86a, 0x8a5a33]), top: pick([0x8c3b2e, 0x8a5cf6, 0x2e5f4a]), bottom: 0x2a2d3a }),
    accessory: 'wine', pitch: 1.25,
    barks: [
      'This is EXACTLY what our powder room is about.',
      'I only buy pieces that match a wine I\'ve cried into.',
      'My book club thinks I\'m at book club.',
      'Is the art gluten free? I\'m asking for the frame.',
      'I love it. What is it? Don\'t tell me. I love it.',
    ],
  },
  {
    type: 'financeBro', names: ['A Finance Bro', 'DeFi Derek', 'The Quant'],
    role: 'cultural investor',
    palette: () => ({ skin: pick([0xd9a184, 0xb0703f]), hair: pick([0x2a2018, 0xc9a86a]), top: pick([0x2b3a67, 0x3b6ea5, 0x1c1c22]), bottom: 0x1c1c22 }),
    accessory: 'phone', pitch: 1.0,
    barks: [
      'What\'s the exit liquidity on a painting? Asking for a fund.',
      'I\'m long on red, short on meaning.',
      'Art is just illiquid crypto with better parties.',
      'I don\'t need to like it. I need it to be scarce.',
      'My portfolio is 40% canvases and 60% unresolved father issues.',
    ],
  },
  {
    type: 'influencer', names: ['An Influencer', 'Content Gremlin', '@art.feelings'],
    role: 'here for the content',
    palette: () => ({ skin: pick([0xe8c4a8, 0x9a6a48, 0xd9a184]), hair: pick([0xd98cff, 0xefe9dc, 0x14161c]), top: pick([0xd98cff, 0xe8c15a, 0xc9463d]), bottom: 0x14161c }),
    accessory: 'phone', pitch: 1.35,
    barks: [
      'Is this content? Can I stand in front of it?',
      'I did a 40-part series on this room and I\'ve never been here.',
      'The lighting is giving main character. The art is giving extra.',
      'Wait — do people know you\'re here? That\'s so niche. I love niche.',
      'My audience NEEDS to see me not understand this.',
    ],
  },
  {
    type: 'artStudent', names: ['An Art Student', 'Third-Year Søren', 'Crit Survivor'],
    role: 'still believes',
    palette: () => ({ skin: pick([0xe8c4a8, 0xd9a184, 0x9a6a48]), hair: pick([0x2e5f4a, 0x8c3b2e, 0x14161c]), top: pick([0x4a4438, 0x2e5f4a, 0x6e3532]), bottom: 0x2a2d3a }),
    accessory: 'clipboard', pitch: 1.1,
    barks: [
      'My professor said color is a scam by Big Pigment.',
      'I came to network but I keep accidentally feeling things.',
      'This is problematic and I mean that as the highest praise.',
      'I have forty euros and a manifesto. The manifesto is overdrawn.',
      'One day my work will hang here and mildly disappoint someone important.',
    ],
  },
  {
    type: 'flipper', names: ['A Flipper', 'Secondary Market Steve', 'The Exit'],
    role: 'holds, never looks',
    palette: () => ({ skin: pick([0xd9a184, 0xc9a684]), hair: pick([0x3a3430, 0x8a8378]), top: pick([0x4a4a52, 0x6b4a30]), bottom: 0x1c1c22 }),
    accessory: null, pitch: 0.9,
    barks: [
      'I don\'t look at them. I hold them. Like crypto, but rectangular.',
      'Bought it, crated it, forgot it. Best review I\'ve ever given.',
      'Emotionally I\'m liquid. That\'s why the art isn\'t.',
      'Storage is the purest gallery. No walls, only value.',
    ],
  },
  {
    type: 'oligarchNephew', names: ['An Oligarch\'s Nephew', 'Young Pavel', 'The Heir Apparent-ish'],
    role: 'nepo-collector',
    palette: () => ({ skin: pick([0xd9a184, 0xe0b89a]), hair: pick([0xc9a86a, 0x2a2018]), top: pick([0x8c3b2e, 0x2b3a67]), bottom: 0x1c1c22 }),
    accessory: 'phone', pitch: 1.2,
    barks: [
      'My uncle owns a museum. And a country. Same paperwork.',
      'I\'m not buying art, I\'m buying the artist\'s gratitude. It vests.',
      'Everything here is a tax strategy if you squint legally.',
      'I offered the artist exposure. He asked "to what". Naive. Beautiful.',
    ],
  },
  {
    type: 'austrian', names: ['A Mysterious Austrian', 'Herr Doktor Nobody', 'The Viennese'],

    role: 'unimpressed, continental',
    palette: () => ({ skin: 0xd9c2a8, hair: 0x8a8378, top: 0x1c1c22, bottom: 0x1c1c22 }),
    accessory: 'cane', pitch: 0.75,
    barks: [
      'In Vienna we would call this "Tuesday".',
      'I knew the real scandal. This is the commemorative plate of the scandal.',
      'You call this transgressive? I once yawned at an emperor.',
      'The wine is adequate. The despair is imported. I approve of neither.',
    ],
  },
];

/** Build a crowd of ambient weirdos for a zone. */
export function buildCrowd(zoneKey, night, count) {
  const defs = [];
  const usedTypes = new Set();
  for (let i = 0; i < count; i++) {
    const fresh = CROWD_TYPES.filter((t) => !usedTypes.has(t.type));
    const t = fresh.length ? pick(fresh) : pick(CROWD_TYPES);
    usedTypes.add(t.type);

    defs.push({
      id: `${t.type}-${night}-${i}`,
      name: pick(t.names),
      shortRole: t.role,
      role: t.role,
      ego: randInt(35, 60),
      weak: pick(['kind', 'witty', 'brutal']),
      resist: pick(['kind', 'witty', 'brutal']),
      hint: 'A stranger. Who knows what cracks them. Try things.',
      pace: rand(0.7, 1.3),
      pitch: t.pitch * rand(0.94, 1.06),
      accessory: t.accessory,
      palette: t.palette(),
      ambient: true,
      barks: t.barks,
      // ambient NPCs use the generator for duel lines
      openers: null, countered: null, reactions: null, weakHit: null,
      disarmed: null, dismiss: null, meltdown: null, playerJabs: null,
    });
  }
  return defs;
}

/** The full roster for a given night, per zone. */
export function castForNight(night) {
  const m = MAINS;
  switch (night) {
    case 1:
      return {
        garret: [],
        galleria: [
          m.victoria, m.kreyo, m.docent, m.chad, m.muffy, m.barnaby,
          ...buildCrowd('galleria', 1, 4),
        ],
        vault: [],
      };
    case 2:
      return {
        garret: [],
        galleria: [
          m.victoria, m.kreyo, m.docent, m.chad, m.dolores, m.petra, m.baron,
          ...buildCrowd('galleria', 2, 5),
        ],
        vault: [],
      };
    default:
      return {
        garret: [],
        galleria: [m.docent, ...buildCrowd('galleria', 3, 2)],
        vault: [m.index, m.lucia, m.chad, m.barnaby, m.petra, ...buildCrowd('vault', 3, 2)],
      };

  }
}
