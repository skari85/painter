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
    face: 'puplic/visual assets/character_faces/03-stern-older-woman.png',
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
    face: 'puplic/visual assets/character_faces/09-street-artist.png',
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
    face: 'puplic/visual assets/character_faces/08-exhausted-nurse.png',
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
    face: 'puplic/visual assets/character_faces/12-office-worker.png',
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
    face: 'puplic/visual assets/character_faces/14-kind-grandmother.png',
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
    face: 'puplic/visual assets/character_faces/01-tired-bartender.png',
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
    face: 'puplic/visual assets/character_faces/07-elegant-older-man.png',
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
    face: 'puplic/visual assets/character_faces/04-anxious-young-man.png',
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
    face: 'puplic/visual assets/character_faces/05-punk-woman.png',
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
    face: 'puplic/visual assets/character_faces/16-mysterious-traveler.png',
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
    face: 'puplic/visual assets/character_faces/13-rebellious-redhead.png',
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

  milo: {
    id: 'milo', name: 'Milo “Mister M” Madsen', shortRole: 'collector', role: 'Collector — Host of the Private Party',
    face: 'puplic/people/collector.png', cutout: true,
    ego: 145, weak: 'witty', resist: 'brutal',
    hint: 'He is dressed for a yacht that is not here. Make him laugh before he asks what you cost.',
    pace: 0.55, pitch: 0.72, accessory: 'hat', anchor: 'milo', underwear: true,
    palette: { skin: 0xd9a184, hair: 0xc9a86a, top: 0xf0b6d2, underwear: 0x3b6ea5, bottom: 0x3b6ea5, hat: 0xe8c15a },
    openers: [
      'Welcome to my home. Please ignore the dress code; I am wearing the only thing I could find with pockets.',
      'The hat is vintage. The underwear is current. The party is an investment in both.',
      'I collect artists who make me feel something — preferably something I can expense.',
      'Everyone here has brought a masterpiece. I brought a torso and a very good hat.',
      'Do you see the room? The room is called “liquidity with snacks.”',
    ],
    countered: [
      'Wit is dangerous in a private home. The insurance does not cover it.',
      'I invited color, not consequences. Please put your consequences near the coat rack.',
      'That joke has no provenance. I like it anyway.',
    ],
    reactions: {
      kind: ['How sweet. Do not make me put on trousers about this.', 'You noticed the person and not the purchase. Unsettling.'],
      witty: ['Ha! The hat has been defeated. I can feel it sagging.', 'Excellent. I will tell everyone you said that, inaccurately.'],
      brutal: ['No need to shout. The house already knows I am ridiculous.', 'That is not how one speaks to a host. It is, however, how one speaks to a man in underwear.'],
    },
    weakHit: ['Stop making the party feel observed.', 'The hat is a symbol. Do not interrogate the symbol.'],
    disarmed: ['Fine. Stay for the cake. It is the only honest thing I own.'],
    dismiss: ['I must circulate before someone asks me to wear pants.', 'The party needs me elsewhere — emotionally and near the cheese.'],
    meltdown: 'THE PARTY IS A PORTFOLIO. THE PORTFOLIO IS A PARTY. WHY IS EVERYONE LOOKING AT MY UNDERWEAR?',
    barks: [
      'The hat is not a cry for help. The hat is a cry for attention.',
      'I bought this house for the acoustics and the plausible deniability.',
      'Please compliment someone before the canapés lose faith.',
      'I call this room “the reserve,” because nobody is allowed to relax in it.',
    ],
    playerJabs: {
      kind: ['You made a room full of people feel welcome. The hat can stay.'],
      witty: ['Milo, you are not underdressed — you are a walking limited edition with no return policy.'],
      brutal: ['You bought a house to avoid having a personality in public, then hosted a party in your underwear. Pick a lane.'],
    },
  },

  sol: {
    id: 'sol', name: 'Sol “Chromatic” Vale', shortRole: 'artist', role: 'Artist — Chromatic Maximalist',
    face: 'puplic/visual assets/character_faces/13-rebellious-redhead.png',
    ego: 82, weak: 'kind', resist: 'witty', pace: 1.0, pitch: 1.1, accessory: 'clipboard', anchor: 'sol',
    palette: { skin: 0xe8c4a8, hair: 0xd98cff, top: 0xe8c15a, bottom: 0x8a5cf6 },
    openers: [
      'I brought six colors the collector has never seen and one he will pretend to have invented.',
      'This painting is joy with a grant application attached.',
      'I am not loud. The palette is simply refusing to whisper.',
    ],
    countered: ['That is a gray thought. Please leave it at the door.', 'I can hear your beige approaching.'],
    reactions: { kind: ['You see the heart of it. Oh. Thank you.', 'That is exactly what I wanted someone to say.'], witty: ['Funny, but the yellow still wins.', 'A good line. I will paint it in magenta.'], brutal: ['No. I reject your darkness on chromatic grounds.'] },
    weakHit: ['Do not be kind to me in front of the collector. I will cry in every color.'],
    disarmed: ['Come see the blue one. It is trying very hard.'],
    dismiss: ['I have another wall to impress. It is currently losing.'],
    meltdown: 'NO ONE CAN BUY JOY IN BULK. I TRIED. I BROUGHT TOO MUCH.',
    barks: ['The red is a little too honest, so I put glitter on it.', 'Color is just optimism with better lighting.', 'Milo! Look at this yellow! Milo!'],
    playerJabs: { kind: ['Your work is trying to keep the room alive. That matters.'], witty: ['You brought enough color to make the collector’s underwear look tasteful.'], brutal: ['Your palette is doing all the emotional labor and you are taking the credit.'] },
  },

  bea: {
    id: 'bea', name: 'Bea “Gloom” Nilsen', shortRole: 'artist', role: 'Artist — Gloom Division',
    face: 'puplic/visual assets/character_faces/08-exhausted-nurse.png',
    ego: 96, weak: 'kind', resist: 'brutal', pace: 0.45, pitch: 0.78, accessory: null, anchor: 'bea',
    palette: { skin: 0x827d7d, hair: 0x24242b, top: 0x29272d, bottom: 0x34313a },
    openers: [
      'I brought a painting of the exact moment this party becomes a memory nobody admits attending.',
      'The other artists brought color. I brought the invoice for losing hope.',
      'Do not worry. The gray is not contagious. Probably.',
      'He asked for something that would look good over the fireplace. I painted the fireplace after it knows.',
    ],
    countered: ['Wit is a bright room I cannot afford.', 'That joke arrived wearing a tiny sun. I dislike it.'],
    reactions: { kind: ['Please do not be kind. I will have to become a person.', 'That was almost warm. I had forgotten warmth had a voice.'], witty: ['A joke. Fine. It can sit in the corner with the dead plants.', 'I smiled. It was involuntary and therefore not mine.'], brutal: ['Yes. Good. Make it accurate.', 'At last, a language the room understands.'] },
    weakHit: ['Stop looking at me like I could still be helped.', 'Kindness is a trapdoor. I know because I installed one.'],
    disarmed: ['Stay near the window. It is the least enthusiastic part of the house.'],
    dismiss: ['I am going to stand beside my painting until someone mistakes me for furniture.'],
    meltdown: 'THE PARTY IS BEAUTIFUL AND I AM NOT. THAT IS THE WHOLE REVIEW.',
    barks: ['The gray is not unfinished. It is exhausted.', 'I made the shadows darker so the room would stop asking questions.', 'Someone laughed. I wrote down the time.'],
    playerJabs: { kind: ['You do not have to impress him tonight. You are allowed to be tired.'], witty: ['Your painting is the only guest here not pretending the house is a home.'], brutal: ['You are not gloomy because you are deep. You are gloomy because this room keeps asking you to perform pain.'] },
  },

  /* ============================================================
     THE GILDED FORK — the big shots, drunk and messed up
     ============================================================ */

  forkHost: {
    id: 'forkHost', name: 'Baronessa Brine', shortRole: 'hostess', role: 'Hostess — The Gilded Fork',
    face: 'puplic/visual assets/character_faces/07-elegant-older-man.png',
    ego: 140, weak: 'witty', resist: 'brutal',
    hint: 'She has hosted everyone. Brutality is just another guest she has already seated. Wit is the only thing that can still surprise her.',
    pace: 0.4, pitch: 0.72, accessory: 'wine', anchor: 'forkHost',
    palette: { skin: 0xd9c2a8, hair: 0xe8e0cc, top: 0x4a1a2e, bottom: 0x2a1c14 },
    openers: [
      'Welcome to my table. The chairs are priced like small apartments. The wine is priced like the chairs.',
      'You look like someone who paints. We had one of those. We ate him.',
      'The seating chart is a war crime. I am the tribunal.',
      'Everyone here is a big shot. Some of them are also people. We are working on it.',
      'I don\'t do small talk. I do medium talk. Large talk is for the help.',
    ],
    countered: [
      'Ah. Volume. How rustic. The table has heard louder from the soup.',
      'You raise your voice like a man who has never been seated by a professional.',
      'The last person who shouted at me is now a footnote in someone else\'s memoir.',
    ],
    reactions: {
      kind: ['...Kindness. At my table. Unprecedented. Slightly suspicious.', 'That was almost warm. The candles approved.'],
      witty: ['Ha! The table laughs. The table has excellent taste.', 'You are sharper than the cheese knife. I shall have you preserved.'],
      brutal: ['That was almost a wound. Try again with better tailoring.', 'The table has heard worse. From me.'],
    },
    weakHit: ['Stop being clever. The guests are getting ideas.', 'You are making the silverware nervous.'],
    disarmed: ['Fine. Sit. Have the good wine. It is still a loan.'],
    dismiss: ['The table moves on. The table always moves on. That is the table\'s one tragedy.', 'Go stand near the bust. It has more patience than I do.'],
    meltdown: 'THE SEATING CHART IS A LIE. THE WINE IS A LIE. I AM A LIE. SOMEONE ELSE HOST.',
    barks: [
      'The candelabra is on fire. The candelabra has always been on fire. It is a feature.',
      'I once seated a critic next to a mirror. He apologized to himself.',
      'The cheese wheel is a metaphor. The metaphor is half-eaten.',
      'Every dinner party is a small war. I am undefeated.',
    ],
    playerJabs: {
      kind: ['You built a room where people still talk to each other. That is rarer than the wine.'],
      witty: ['Baronessa, your table is so long the toast arrives cold. I respect it.'],
      brutal: ['You don\'t host dinner parties. You host hostage situations with better flatware.'],
    },
  },

  fork1: {
    id: 'fork1', name: 'Kasper "The Auctioneer" Voll', shortRole: 'auctioneer', role: 'Auctioneer — Going, Going, Gone',
    face: 'puplic/visual assets/character_faces/12-office-worker.png',
    ego: 95, weak: 'brutal', resist: 'kind',
    hint: 'He talks fast, bids faster, and has never been told no in a way he understood. Brutality is the only language he hears.',
    pace: 1.3, pitch: 1.1, accessory: 'phone', anchor: 'fork1',
    palette: { skin: 0xd9a184, hair: 0x2a2018, top: 0x2b3a67, bottom: 0x1c1c22 },
    openers: [
      'Sold! To the man with the sad eyes and the excellent shoes! That\'s you. You\'re sold.',
      'I auctioned a sunset once. The buyer got the mountain. The mountain got the buyer.',
      'Your estimate is low. Your reserve is lower. Your dignity is... let\'s not.',
      'I can sell anything. I once sold a blank wall to a man who already owned it.',
      'The gavel is my truth. The truth is tired.',
    ],
    countered: [
      'Kindness! My favorite tell. I\'ll note it in the position I\'m taking on you.',
      'You\'re sweet. Sweetness is the first thing we budget out.',
      'Careful — I almost felt the price of that sentence.',
    ],
    reactions: {
      kind: ['Gross. Do it less.', 'Warmth. How regional.'],
      witty: ['Ha. Careful, I might put that in the catalogue.', 'Funny. I\'ll expense the laugh.'],
      brutal: ['...Okay. Okay. That is EXACTLY what my father said at the auction.', 'Ouch. Right in the paddle.'],
    },
    weakHit: ['The gavel is trembling. I am trembling. Stop it.', 'I pay people to prevent this sensation.'],
    disarmed: ['...Do you need money? Is that a thing you need? Weird question. Forget it.'],
    dismiss: ['I have a lot of young artists to emotionally damage. Busy busy.', 'This stopped being accretive.'],
    meltdown: 'THE HAMMER IS DOWN. THE HAMMER IS ALWAYS DOWN. I AM THE HAMMER.',
    barks: [
      'Going once. Going twice. Gone. Like my youth.',
      'The reserve is a suggestion. The suggestion is a threat.',
      'I sold the air in this room twice. The second time was a gift.',
      'Every bid is a small death. I am a serial killer of value.',
    ],
    playerJabs: {
      kind: ['One day you\'ll sell everything and feel nothing, and I\'ll still feel bad for you. That\'s my edge.'],
      witty: ['Kasper, you\'re not an auctioneer. You\'re a margin call with a microphone.'],
      brutal: ['You don\'t sell art. You sell the moment artists stop resisting. Same energy, less paperwork.'],
    },
  },

  fork2: {
    id: 'fork2', name: 'Yrsa "The Biennale" Bork', shortRole: 'curator', role: 'Curator — The Biennale of Everything',
    face: 'puplic/visual assets/character_faces/05-punk-woman.png',
    ego: 110, weak: 'kind', resist: 'witty',
    hint: 'She has curated three biennales and remembers none of them. Kindness is the only thing she cannot file under "movements I have survived".',
    pace: 0.5, pitch: 0.9, accessory: 'clipboard', anchor: 'fork2',
    palette: { skin: 0xe0b89a, hair: 0x1c1a20, top: 0x3a3a44, bottom: 0x14161c },
    openers: [
      'I curated a biennale in a war zone once. The art was fine. The catering was a crime.',
      'Your work is very "now". I preferred "then". "Then" had better lighting.',
      'I don\'t select artists. I select the moment artists become visible. You are currently a rumor.',
      'The theme this year is "post-authenticity". I invented it. I am already bored of it.',
      'Every wall is a mouth. Every mouth is hungry. I am the one who feeds them.',
    ],
    countered: [
      'Wit. How 2009. I have a drawer of wit at home; I feed it to my other drawer.',
      'I invented that joke. It was better when it was mine.',
      'Quips are the coupons of the insecure.',
    ],
    reactions: {
      kind: ['...No. Don\'t be nice to me. I don\'t have a filing system for it.', 'That was... I need to sit with that. On a chaise. With my grudges.'],
      witty: ['Competent. I shall describe you as competent, and you will thank me.', 'A retort. Charming. I\'ve filed it under "evidence".'],
      brutal: ['Oh, good. Venom. Venom I can quote.', 'Yes, yes, wound the curator. Very original. Very "page six".'],
    },
    weakHit: ['Stop it. Kindness is not a recognized medium.', 'I am the one who disarms people. That is MY formal device.'],
    disarmed: ['...Your next show. I will attend. Not to review. To... see. Don\'t tell anyone.'],
    dismiss: ['I have a deadline and you are not going to be in it.', 'This exchange has been provisionally titled "Tuesday".'],
    meltdown: 'THE BIENNALE IS CANCELLED. EVERYTHING IS CANCELLED. EXCEPT MY PANEL. MY PANEL IS ETERNAL.',
    barks: [
      'I loved it before it existed. Now it\'s too late for both of us.',
      'Every biennale is a funeral for a painting that might have been.',
      'I don\'t attend after-parties. I attend consequences.',
      'The last artist I praised retired out of sheer gratitude.',
    ],
    playerJabs: {
      kind: ['You see more in a room than anyone here. It must be lonely being the only one awake.'],
      witty: ['Yrsa, your biennale needs a spa. I\'m adding one. Five stars, posthumously.'],
      brutal: ['You don\'t curate. You write obituaries for a medium you were too scared to practice.'],
    },
  },

  fork3: {
    id: 'fork3', name: 'Rex "The Algorithm" Vane', shortRole: 'tech bro', role: 'Tech Visionary — Art as a Service',
    face: 'puplic/visual assets/character_faces/04-anxious-young-man.png',
    ego: 85, weak: 'brutal', resist: 'kind',
    hint: 'He tokenized his own shadow. Brutality is the only API he cannot rate-limit.',
    pace: 1.2, pitch: 1.15, accessory: 'phone', anchor: 'fork3',
    palette: { skin: 0xd9a184, hair: 0x14161c, top: 0x1c1c22, bottom: 0x1c1c22 },
    openers: [
      'I disrupted the gallery model. Now galleries are just warehouses with better lighting.',
      'Your brushstrokes are data. I am the dashboard.',
      'I built an app that tells you if art is good. It says no.',
      'The blockchain remembers everything. Especially the things you want it to forget.',
      'I don\'t collect art. I collect engagement metrics. The art is incidental.',
    ],
    countered: [
      'Kindness! My favorite vulnerability. I\'ll patch it in the next sprint.',
      'You\'re sweet. Sweetness is not scalable.',
      'Careful — I almost felt the valuation of that sentence.',
    ],
    reactions: {
      kind: ['Gross. Do it less.', 'Warmth. How pre-launch.'],
      witty: ['Ha. Careful, I might A/B test that.', 'Funny. I\'ll expense the laugh.'],
      brutal: ['...Okay. Okay. That is EXACTLY what my co-founder said at the pivot.', 'Ouch. Right in the burn rate.'],
    },
    weakHit: ['The algorithm is crying. I am crying. Stop it.', 'I pay people to prevent this sensation.'],
    disarmed: ['...Do you need funding? Is that a thing you need? Weird question. Forget it.'],
    dismiss: ['I have a standup with my conscience. It keeps canceling.', 'This stopped being accretive.'],
    meltdown: 'THE BLOCKCHAIN IS DOWN. THE BLOCKCHAIN IS ALWAYS DOWN. I AM THE BLOCKCHAIN.',
    barks: [
      'I minted my breakfast. It appreciated.',
      'Every NFT is a small death. I am a serial killer of value.',
      'The server farm is my church. The uptime is my god.',
      'I tokenized my feelings. They are currently worthless.',
    ],
    playerJabs: {
      kind: ['One day you\'ll own everything and feel nothing, and I\'ll still feel bad for you. That\'s my edge.'],
      witty: ['Rex, you\'re not a visionary. You\'re a terms-of-service agreement with a pulse.'],
      brutal: ['You don\'t disrupt. You just make everything worse with better branding.'],
    },
  },

  fork4: {
    id: 'fork4', name: 'Gilda "The Ghost" Fenn', shortRole: 'art advisor', role: 'Art Advisor — She Decides Who Exists',
    face: 'puplic/visual assets/character_faces/16-mysterious-traveler.png',
    ego: 120, weak: 'witty', resist: 'kind',
    hint: 'She diversifies people. Unimpressed by heat; allergic to being out-clevered.',
    pace: 0.6, pitch: 1.05, accessory: null, anchor: 'fork4',
    palette: { skin: 0x9a6a48, hair: 0x1c1a20, top: 0xb8b2c4, bottom: 0xb8b2c4 },
    openers: [
      'I diversify people. You are currently... mid-cap emerging. Don\'t take it personally. Take it financially.',
      'Your file says you still believe in "the soul". We keep that page. It makes clients feel rustic.',
      'I advised three biennales this year. I remember none of them. That is expertise.',
      'Mister Index doesn\'t buy art. I buy it, and he inherits the reflection.',
    ],
    countered: ['Volume. How retail.', 'I\'ve been shouted at by heads of state with better tailoring.'],
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
      witty: ['Gilda, the only thing you can\'t value is why anyone\'s here. It\'s the last unpriced thing. It\'s why you keep circling it.'],
      brutal: ['You\'re not an advisor. You\'re a receipt that learned to walk.'],
    },
  },

  fork5: {
    id: 'fork5', name: 'Marisol "The Muse" Delacroix', shortRole: 'muse', role: 'Muse — Retired, Unretired, Retired Again',
    face: 'puplic/visual assets/character_faces/13-rebellious-redhead.png',
    ego: 88, weak: 'kind', resist: 'brutal',
    hint: 'She inspired three movements and two divorces. Brutality is just another Tuesday. Kindness is the only thing that still surprises her.',
    pace: 0.55, pitch: 1.2, accessory: 'wine', anchor: 'fork5',
    palette: { skin: 0xe8c4a8, hair: 0xd98cff, top: 0x8c3b2e, bottom: 0x2a2d3a },
    openers: [
      'I inspired a sculpture once. It was terrible. The sculptor was worse. I kept the scarf.',
      'You look like someone who paints people. I am people. Mostly.',
      'I retired from musing. Then I unretired. Then I retired again. The muse economy is volatile.',
      'Every artist I ever sat for is dead or bankrupt. I am a curse with excellent posture.',
      'The wine is free. The inspiration costs extra.',
    ],
    countered: [
      'Brutality. How 1987. I have a drawer of brutality at home; I feed it to my other drawer.',
      'I invented cruelty. It was better when it was mine.',
      'Insults are the coupons of the insecure.',
    ],
    reactions: {
      kind: ['...No. Don\'t be nice to me. I don\'t have a filing system for it.', 'That was... I need to sit with that. On a chaise. With my scarves.'],
      witty: ['Competent. I shall describe you as competent, and you will thank me.', 'A retort. Charming. I\'ve filed it under "evidence".'],
      brutal: ['Oh, good. Venom. Venom I can quote.', 'Yes, yes, wound the muse. Very original. Very "page six".'],
    },
    weakHit: ['Stop it. Kindness is not a recognized medium.', 'I am the one who disarms people. That is MY formal device.'],
    disarmed: ['...Your next sitting. I will attend. Not to pose. To... see. Don\'t tell anyone.'],
    dismiss: ['I have a deadline and you are not going to be in it.', 'This exchange has been provisionally titled "Tuesday".'],
    meltdown: 'THE MUSE IS CANCELLED. EVERYTHING IS CANCELLED. EXCEPT MY SCARF. MY SCARF IS ETERNAL.',
    barks: [
      'I loved him before he existed. Now it\'s too late for both of us.',
      'Every sitting is a funeral for a portrait that might have been.',
      'I don\'t attend openings. I attend consequences.',
      'The last artist I praised retired out of sheer gratitude.',
    ],
    playerJabs: {
      kind: ['You see more in a room than anyone here. It must be lonely being the only one awake.'],
      witty: ['Marisol, your scarf needs a biennale. I\'m adding one. Five stars, posthumously.'],
      brutal: ['You don\'t inspire. You write obituaries for a medium you were too scared to practice.'],
    },
  },

  fork6: {
    id: 'fork6', name: 'Otto "The Frame" Gruber', shortRole: 'frame magnate', role: 'Frame Magnate — The Frame Is the Art',
    face: 'puplic/visual assets/character_faces/06-middle-aged-mechanic.png',
    ego: 92, weak: 'brutal', resist: 'kind',
    hint: 'He frames everything. He has framed his own reflection. Brutality is the only thing that can crack his varnish.',
    pace: 0.7, pitch: 0.85, accessory: 'cane', anchor: 'fork6',
    palette: { skin: 0xd9c2a8, hair: 0x8a8378, top: 0x4a3626, bottom: 0x1c1c22 },
    openers: [
      'The frame is the art. The canvas is just the frame\'s excuse to exist.',
      'I framed a blank wall once. It sold for double.',
      'Your painting is fine. It would be better with my frame around it.',
      'I don\'t collect art. I collect the space around art. The art is incidental.',
      'The gilding is real. The gold is a lie. The lie is load-bearing.',
    ],
    countered: [
      'Kindness! My favorite patina. I\'ll note it in the finish I\'m applying to you.',
      'You\'re sweet. Sweetness is the first thing we sand off.',
      'Careful — I almost felt the grain of that sentence.',
    ],
    reactions: {
      kind: ['Gross. Do it less.', 'Warmth. How unfinished.'],
      witty: ['Ha. Careful, I might gild that.', 'Funny. I\'ll expense the laugh.'],
      brutal: ['...Okay. Okay. That is EXACTLY what my father said at the lumberyard.', 'Ouch. Right in the dovetail.'],
    },
    weakHit: ['The varnish is cracking. I am cracking. Stop it.', 'I pay people to prevent this sensation.'],
    disarmed: ['...Do you need a frame? Is that a thing you need? Weird question. Forget it.'],
    dismiss: ['I have a lot of blank walls to emotionally damage. Busy busy.', 'This stopped being accretive.'],
    meltdown: 'THE FRAME IS EMPTY. THE FRAME IS ALWAYS EMPTY. I AM THE FRAME.',
    barks: [
      'I framed my own shadow. It appreciated.',
      'Every joint is a small death. I am a serial killer of wood.',
      'The miter saw is my truth. The truth is tired.',
      'I gilded my breakfast. It was a mistake.',
    ],
    playerJabs: {
      kind: ['One day you\'ll frame everything and see nothing, and I\'ll still feel bad for you. That\'s my edge.'],
      witty: ['Otto, you\'re not a framer. You\'re a border with a superiority complex.'],
      brutal: ['You don\'t frame art. You frame the absence of personality. Same energy, less wood.'],
    },
  },

  fork7: {
    id: 'fork7', name: 'Liv "The Patron" Hauge', shortRole: 'patron', role: 'Patron — She Owns the Concept of Owning',
    face: 'puplic/visual assets/character_faces/14-kind-grandmother.png',
    ego: 105, weak: 'witty', resist: 'brutal',
    hint: 'She funds everything and remembers nothing. Brutality is just another grant cycle. Wit is the only thing that can still reach her.',
    pace: 0.45, pitch: 0.95, accessory: 'wine', anchor: 'fork7',
    palette: { skin: 0xe8c4a8, hair: 0xe8e0cc, top: 0x2e5f4a, bottom: 0x2a2d3a },
    openers: [
      'I funded a museum once. It closed. The gift shop survived. The gift shop is now the museum.',
      'You look like someone who needs money. I am someone who has money. We are a tragedy.',
      'I don\'t give grants. I give the illusion of grants. The illusion is taxable.',
      'Every artist I fund becomes a brand. I am a brand factory with a heart.',
      'The wine is free. The strings are attached. The strings are gold.',
    ],
    countered: [
      'Brutality. How 2003. I have a drawer of brutality at home; I feed it to my other drawer.',
      'I invented cruelty. It was better when it was mine.',
      'Insults are the coupons of the insecure.',
    ],
    reactions: {
      kind: ['...No. Don\'t be nice to me. I don\'t have a filing system for it.', 'That was... I need to sit with that. On a chaise. With my endowments.'],
      witty: ['Competent. I shall describe you as competent, and you will thank me.', 'A retort. Charming. I\'ve filed it under "evidence".'],
      brutal: ['Oh, good. Venom. Venom I can quote.', 'Yes, yes, wound the patron. Very original. Very "page six".'],
    },
    weakHit: ['Stop it. Wit is not a recognized currency.', 'I am the one who disarms people. That is MY formal device.'],
    disarmed: ['...Your next project. I will fund it. Not to own. To... see. Don\'t tell anyone.'],
    dismiss: ['I have a board meeting and you are not going to be in it.', 'This exchange has been provisionally titled "Tuesday".'],
    meltdown: 'THE ENDOWMENT IS CANCELLED. EVERYTHING IS CANCELLED. EXCEPT MY LEGACY. MY LEGACY IS ETERNAL.',
    barks: [
      'I loved it before it existed. Now it\'s too late for both of us.',
      'Every grant is a funeral for a project that might have been.',
      'I don\'t attend openings. I attend consequences.',
      'The last artist I funded retired out of sheer gratitude.',
    ],
    playerJabs: {
      kind: ['You see more in a room than anyone here. It must be lonely being the only one awake.'],
      witty: ['Liv, your legacy needs a biennale. I\'m adding one. Five stars, posthumously.'],
      brutal: ['You don\'t fund art. You fund the illusion of taste. Same energy, less paperwork.'],
    },
  },

  fork8: {
    id: 'fork8', name: 'Sven "The Forger" Lund', shortRole: 'forger', role: 'Master Forger — The Real Fake',
    face: 'puplic/visual assets/character_faces/15-guarded-biker.png',
    ego: 78, weak: 'kind', resist: 'brutal',
    hint: 'He has painted every masterpiece twice. Brutality is just another varnish. Kindness is the only thing that can still crack his signature.',
    pace: 0.65, pitch: 0.8, accessory: null, anchor: 'fork8',
    palette: { skin: 0xd9c2a8, hair: 0x3a3430, top: 0x4a4438, bottom: 0x1c1c22 },
    openers: [
      'I painted that one. And that one. And the one in the museum. The museum doesn\'t know.',
      'You look like someone who paints. I am someone who paints better. It is a curse.',
      'I don\'t forge art. I forge the moment art becomes valuable. The art is incidental.',
      'Every signature is a small death. I am a serial killer of authenticity.',
      'The wine is free. The provenance is negotiable.',
    ],
    countered: [
      'Brutality. How 1994. I have a drawer of brutality at home; I feed it to my other drawer.',
      'I invented cruelty. It was better when it was mine.',
      'Insults are the coupons of the insecure.',
    ],
    reactions: {
      kind: ['...No. Don\'t be nice to me. I don\'t have a filing system for it.', 'That was... I need to sit with that. On a chaise. With my forgeries.'],
      witty: ['Competent. I shall describe you as competent, and you will thank me.', 'A retort. Charming. I\'ve filed it under "evidence".'],
      brutal: ['Oh, good. Venom. Venom I can quote.', 'Yes, yes, wound the forger. Very original. Very "page six".'],
    },
    weakHit: ['Stop it. Kindness is not a recognized medium.', 'I am the one who disarms people. That is MY formal device.'],
    disarmed: ['...Your next canvas. I will copy it. Not to sell. To... see. Don\'t tell anyone.'],
    dismiss: ['I have a deadline and you are not going to be in it.', 'This exchange has been provisionally titled "Tuesday".'],
    meltdown: 'THE FORGERY IS CANCELLED. EVERYTHING IS CANCELLED. EXCEPT MY SIGNATURE. MY SIGNATURE IS ETERNAL.',
    barks: [
      'I loved it before it existed. Now it\'s too late for both of us.',
      'Every copy is a funeral for an original that might have been.',
      'I don\'t attend openings. I attend consequences.',
      'The last artist I copied retired out of sheer gratitude.',
    ],
    playerJabs: {
      kind: ['You see more in a room than anyone here. It must be lonely being the only one awake.'],
      witty: ['Sven, your signature needs a biennale. I\'m adding one. Five stars, posthumously.'],
      brutal: ['You don\'t forge art. You forge the illusion of value. Same energy, less talent.'],
    },
  },

  /* ---- the people from the puplic folder. they live at the party now ---- */

  bob: {
    id: 'bob', name: 'Bob', shortRole: 'collector', role: 'Collector of Small Joys',
    face: 'puplic/people/bob.png', cutout: true,
    ego: 55, weak: 'kind', resist: 'brutal',
    hint: 'A happy man with a happy little fortune. He cannot be insulted; he does not have the equipment.',
    pace: 0.75, pitch: 0.95, accessory: 'wine', anchor: null,
    palette: { skin: 0xd9a184, hair: 0xc9a86a, top: 0x7fb285, bottom: 0x4a4438 },
    openers: [
      'You made this? My girlfriend painted a sunset once. It changed our whole hallway.',
      'I don\'t know art, but I know what I like, and I like almost everything. It\'s a blessing.',
      'We bought the blue one because it looked calm. We named him Gustav.',
    ],
    countered: ['Ha! She said the same thing. You two should talk.', 'That\'s exactly the kind of joke I almost understand.'],
    reactions: {
      kind: ['See, THIS is why we come to parties.', 'You\'re nice. The art people are never nice. Keep it up.'],
      witty: ['Ha! I\'m going to say that at work on Monday and not explain.', 'She laughed too. You heard her. That\'s two laughs.'],
      brutal: ['Oh. Oh no. He\'s doing the serious voice. I get this at the bank.', 'I\'m going to stand near the cake until this passes.'],
    },
    weakHit: ['You can\'t hurt me. I had a nap today.', 'Kindness? At a party? In THIS economy? I accept.'],
    disarmed: ['Come over Sunday. We grill. It\'s not art, it\'s just meat, but it\'s honest.'],
    dismiss: ['I need to find my girlfriend. She\'s explaining the fireplace to someone again.'],
    meltdown: 'NOBODY TOLD ME THE ART COULD LOOK BACK. GUSTAV KNOWS THINGS. WE\'RE DONATING GUSTAV.',
    barks: [
      'We don\'t read the little cards. We like to be surprised by the rectangles.',
      'Babe. BABE. The cake has a market crash in the middle. It\'s beautiful.',
      'I told the man in the hat I have forty euros and a dream. He hugged me.',
      'Our hallway has twelve paintings now. The hallway is the gallery. The door is the gift shop.',
      'If you stand here long enough someone hands you a glass. It\'s the best system in Oslo.',
    ],
    playerJabs: {
      kind: ['Bob, you like everything because you actually look at it. That\'s the whole trick.'],
      witty: ['Gustav the blue painting is the best provenance story in this room, and it\'s not close.'],
      brutal: ['You collect small joys because the big ones require a personality, Bob.'],
    },
  },

  bobgirl: {
    id: 'bobgirl', name: 'Bob’s Girlfriend', shortRole: 'muse', role: 'Co-Collector of Small Joys',
    face: 'puplic/people/bobgirl.png', cutout: true,
    ego: 60, weak: 'witty', resist: 'kind',
    hint: 'She has a system. The system is vibes. The system has never failed.',
    pace: 0.85, pitch: 1.2, accessory: 'wine', anchor: null,
    palette: { skin: 0xe8c4a8, hair: 0x8c3b2e, top: 0xc9466f, bottom: 0x2a2d3a },
    openers: [
      'Bob picks with his heart. I pick with a system. The system is vibes.',
      'We\'re not saying we\'re buying anything. We\'re saying the hallway has ROOM.',
      'I chose every painting we own. Bob chose the frames. We are both geniuses at different things.',
    ],
    countered: ['Careful, that\'s nearly a feeling and I\'m off duty.', 'Ha! No. Feelings are for the hallway.'],
    reactions: {
      kind: ['Oh, you\'re sweet. Bob! This one\'s sweet!', 'That\'s lovely. I\'m putting it in the newsletter I don\'t write.'],
      witty: ['Okay, that\'s going on the fridge. We have a fridge for quotes now. It\'s a whole thing.', 'You\'re funny. Stay. Bob needs new material; he\'s been doing the cake joke all night.'],
      brutal: ['Bob. BOB. The art is yelling.', 'I\'m telling the fireplace what you said. The fireplace and I are close.'],
    },
    weakHit: ['Stop being funny, I\'m trying to have a system tonight.', 'One more joke and I\'m adopting you. That\'s a threat.'],
    disarmed: ['Fine. You can see the hallway. Nobody sees the hallway. Gustav will be told.'],
    dismiss: ['I\'m going to go laugh at the big one with the red dot. It knows what it did.'],
    meltdown: 'THE SYSTEM FAILED. THE VIBES WERE WRONG. BOB, START THE CAR, THE GOOD CAR, THE ONE WITH THE PAINTING IN IT.',
    barks: [
      'Yes, WE have a hallway gallery. Yes, the door IS the gift shop. Next question.',
      'The red dot means someone loved it first. I respect the dot. I fear the dot.',
      'Bob thinks the sculpture is "twisty and brave". I love that man. He\'s never been right.',
      'I only trust paintings that look like they\'ve made a mistake and kept it.',
      'If the fireplace is gas I\'m leaving. It\'s gas, isn\'t it. I\'m staying, but I\'m furious.',
    ],
    playerJabs: {
      kind: ['The two of you wandering around liking things is the best review this party will get.'],
      witty: ['The system is vibes and the vibes are undefeated. I checked. There\'s a spreadsheet.'],
      brutal: ['You curate a hallway and call it a collection. The gift shop is a DOOR.'],
    },
  },

  gimp: {
    id: 'gimp', name: 'The Gimp', shortRole: 'mystery', role: 'Mystery Guest — Do Not Ask',
    face: 'puplic/people/gimp.png', cutout: true,
    ego: 40, weak: 'kind', resist: 'brutal',
    hint: 'Nobody knows who invited him. Everybody assumes somebody else did. He is having a wonderful time.',
    pace: 0.4, pitch: 0.6, accessory: null, anchor: 'gimp',
    palette: { skin: 0x8a8a92, hair: 0x14161c, top: 0x17171c, bottom: 0x17171c },
    openers: [
      '...',
      '(A slow, approving nod toward the buffet.)',
      '(He points at the painting, then at you, then gives a thumbs up.)',
    ],
    countered: ['...!', '(A respectful silence. The loudest silence in the room.)'],
    reactions: {
      kind: ['(His eyes soften, visibly, through the whole outfit.)', '(He pats his heart twice. This means something.)'],
      witty: ['(A muffled sound that is definitely laughing.)', '(He writes nothing down. Somehow this feels like a review.)'],
      brutal: ['(He takes one step back and one step toward the cake.)', '(A slow blink. Even the zipper seems disappointed in you.)'],
    },
    weakHit: ['(He is moved. The whole suit is moved.)'],
    disarmed: ['(He hands you a napkin. On it: a drawing of a heart wearing a little hat.)'],
    dismiss: ['(He drifts away, nodding at the furniture as he goes.)'],
    meltdown: '(HE SAYS NOTHING. IT IS THE MOST DEVASTATING SPEECH OF THE EVENING.)',
    barks: [
      '...',
      '...(he is pointing at the chandelier now)',
      '...(somewhere in there, a man is networking)',
      '...(he knows who bought the red-dot painting. he will never tell)',
      '...(he has been to every party. he has never been invited to any party)',
    ],
    playerJabs: {
      kind: ['You\'re the only honest guest here. Nothing to say, nothing to sell. Respect.'],
      witty: ['Strong silent type. You\'ve said less than the sculpture and meant it more.'],
      brutal: ['The outfit is a cry for help and the help is also wearing the outfit.'],
    },
  },

  fashion: {
    id: 'fashion', name: 'Gilda Vauge', shortRole: 'fashion', role: 'Fashion Editor-at-Large',
    face: 'puplic/people/fashion.png', cutout: true,
    ego: 75, weak: 'witty', resist: 'kind',
    hint: 'She has seen every look, including several that have not happened yet. Hers is wrong on purpose.',
    pace: 1.05, pitch: 1.15, accessory: null, anchor: null,
    palette: { skin: 0xd9c2a8, hair: 0x14161c, top: 0xd98cff, bottom: 0x17171c },
    openers: [
      'You are wearing paint. On PURPOSE? Brave. Documenting it either way.',
      'The underwear man is a moment. The hat is a decision. The party is a lookbook.',
      'I don\'t do art. I do the space between the art and the person blocking it.',
    ],
    countered: ['Kindness is very last season. Which means it\'s two seasons from huge.', 'Cute. I\'ll pretend you planned that.'],
    reactions: {
      kind: ['Oh. Warmth. Unexpected fabric. Let me sit with it.', 'That is the nicest thing anyone has said to me since Thursday\'s fitting.'],
      witty: ['Funny AND vertical. You\'re hired. The job pays in exposure to me.', 'I\'m putting that line in the September issue of my personality.'],
      brutal: ['Okay, harsh. Harsh is a silhouette. I\'m not mad, I\'m inspired.', 'The claws are OUT. Finally, an accessory.'],
    },
    weakHit: ['Stop it. I can only be charmed twice per event and the doorman used one.'],
    disarmed: ['Fine. Front row. Metaphorically. There are no chairs. There is no show. You understand.'],
    dismiss: ['I have to go stand near the window and be misunderstood by Oslo.'],
    meltdown: 'THE LOOK IS INCOMPLETE. THE LOOK HAS ALWAYS BEEN INCOMPLETE. I HAVE TO GO LIE DOWN IN A CONCEPT.',
    barks: [
      'The cake is serving recession-core. I respect it.',
      'Bob\'s girlfriend has a system. The system is vibes. I wrote it down. It\'s fashion now.',
      'Someone here is wearing art and someone here IS art and the lighting refuses to tell me which.',
      'I don\'t circulate. I arrive, repeatedly, at shorter intervals.',
      'The silent one in the suit? Best dressed. No notes. Some fear.',
    ],
    playerJabs: {
      kind: ['You make the room feel styled and the people feel seen. That\'s rarer than the dress.'],
      witty: ['Gilda, you don\'t follow trends — you loiter near them until they confess.'],
      brutal: ['Editor-at-large? Darling, you\'re a caption in search of a photo.'],
    },
  },
};

/* ============================================================
   THE LEATHER & LATEX ROOMS — the house's latex-fashion guests
   ============================================================ */

const LEATHER_ROOM_CAST = [
  {
    id: 'latexRook', name: 'Rook', shortRole: 'latex performer', role: 'Latex Performer — the room\'s alibi',
    face: 'puplic/people/leather/01-black-red-runway.png', cutout: true,
    ego: 62, weak: 'witty', resist: 'brutal', hint: 'A runway professional with a wicked grin and a better sense of timing than the collector.',
    pace: 0.65, pitch: 0.92, accessory: null, anchor: 'rook',
    palette: { skin: 0xd8a783, hair: 0x17141b, top: 0x0b0b10, bottom: 0x0b0b10 },
    openers: ['You look lost. Good. Lost people notice the room.', 'The dress code is simple: wear the bit you usually hide.'],
    countered: ['Cute line. Put it on a sticker.', 'Wit looks good on you. Don\'t let it become a brand.'],
    reactions: { kind: ['That was unexpectedly sweet. Don\'t tell the room.'], witty: ['There it is. A little sparkle in the knife.'], brutal: ['That was almost a look. Try again with better tailoring.'] },
    weakHit: ['Careful. You\'re making sincerity look dangerous.'],
    disarmed: ['You can stay. The room likes people who still have a pulse.'],
    dismiss: ['I\'m going back under the red light. It understands me.'],
    meltdown: 'THE ROOM IS A COSTUME AND I AM THE ZIPPER. I NEED A MINUTE.',
    barks: ['The zipper is a punctuation mark.', 'Every buckle is a tiny committee meeting.', 'The sofa knows more than the host.'],
    playerJabs: { kind: ['You make the room feel like a choice, not a trap.'], witty: ['Rook, you are a mood board with legal representation.'], brutal: ['You call it a look because “emergency architecture” was taken.'] },
  },
  {
    id: 'latexViolet', name: 'Violet', shortRole: 'latex performer', role: 'Latex Performer — violet division',
    face: 'puplic/people/leather/02-violet-corset-performer.png', cutout: true,
    ego: 58, weak: 'kind', resist: 'witty', hint: 'The pose is theatrical; the person underneath it is paying very close attention.',
    pace: 0.55, pitch: 1.08, accessory: null, anchor: 'violet',
    palette: { skin: 0xb97855, hair: 0x2e1e35, top: 0x5b2c91, bottom: 0x5b2c91 },
    openers: ['A room this dark needs a color with opinions.', 'The collector calls it a theme. I call it a boundary.'],
    countered: ['You\'re funny. That\'s a dangerous accessory.', 'Fine. I\'ll allow the joke to remain unpriced.'],
    reactions: { kind: ['Oh. You looked past the costume. That is rude and lovely.'], witty: ['Good. The room needed a laugh with teeth.'], brutal: ['You confuse cruelty with edge. The room can tell.'] },
    weakHit: ['Don\'t be gentle like you\'re apologizing for seeing me.'],
    disarmed: ['Stay near the light. It is less honest there, but more flattering.'],
    dismiss: ['I have a date with the mirror and the mirror has notes.'],
    meltdown: 'I AM NOT A METAPHOR. I AM A PERSON IN A VERY SHINY OUTFIT.',
    barks: ['Purple is just red after a complicated divorce.', 'I refuse to be the room\'s most tasteful mistake.', 'Someone has priced the air again.'],
    playerJabs: { kind: ['You make a spectacle feel like a place people can still choose to be.'], witty: ['Violet, your corset has a stronger thesis than the curator.'], brutal: ['You are not subversive; you are a limited edition with excellent posture.'] },
  },
  {
    id: 'latexChrome', name: 'Chrome', shortRole: 'latex rider', role: 'Latex Rider — redline guest',
    face: 'puplic/people/leather/03-red-helmet-rider.png', cutout: true,
    ego: 64, weak: 'brutal', resist: 'kind', hint: 'A confident motorhead who respects a clean hit and distrusts a soft landing.',
    pace: 0.7, pitch: 0.82, accessory: null, anchor: 'chrome',
    palette: { skin: 0x9b6346, hair: 0x16151a, top: 0x9f243c, bottom: 0x9f243c },
    openers: ['The helmet comes off when the conversation earns it.', 'I parked outside. The bike has better taste than most of the guests.'],
    countered: ['That line has horsepower. Annoying, but real.'],
    reactions: { kind: ['Don\'t make kindness sound like a dare.'], witty: ['Good joke. I\'ll pretend it did not improve you.'], brutal: ['There. A clean hit. Now we can talk.'] },
    weakHit: ['Do not polish the insult. Let it scuff.'],
    disarmed: ['You can ride with us. No one asks where you came from.'],
    dismiss: ['I\'m taking the long way around the room.'],
    meltdown: 'THE BIKE IS FINE. THE BIKE HAS ALWAYS BEEN FINE. I AM THE PROBLEM.',
    barks: ['The red light makes everyone look like a warning label.', 'I trust a buckle more than a mission statement.', 'The collector bought the room. Nobody bought the mood.'],
    playerJabs: { kind: ['You are allowed to be more than the armor you brought in.'], witty: ['Chrome, your helmet has more emotional range than the sculpture.'], brutal: ['You are not dangerous; you are expensive cosplay with a parking problem.'] },
  },
  {
    id: 'latexBlue', name: 'Blue', shortRole: 'latex performer', role: 'Latex Performer — midnight house',
    face: 'puplic/people/leather/04-blue-opera-figure.png', cutout: true,
    ego: 66, weak: 'witty', resist: 'kind', hint: 'Elegant, mischievous, and completely unimpressed by the room\'s attempts at mystery.',
    pace: 0.5, pitch: 1.2, accessory: null, anchor: 'blue',
    palette: { skin: 0xd39b84, hair: 0x8f8a82, top: 0x182b6e, bottom: 0x182b6e },
    openers: ['The room is trying very hard to be scandalous. I admire the effort.', 'If you want to shock the art world, be specific.'],
    countered: ['That was almost elegant. Keep going.'],
    reactions: { kind: ['You remembered there was a person in here. Thank you.'], witty: ['Finally, an interruption with tailoring.'], brutal: ['You brought a knife to a runway. Adorable.'] },
    weakHit: ['Do not confuse composure with permission.'],
    disarmed: ['Take the chair by the wall. It has survived worse artists than you.'],
    dismiss: ['I\'m leaving before the room calls this intimacy.'],
    meltdown: 'THE CAPE IS NOT A PERSONALITY. IT IS A CAPE. PLEASE WRITE THAT DOWN.',
    barks: ['Blue is what black says when it wants to be remembered.', 'The room is all surface. I am taking notes underneath.', 'Someone brought a portfolio. I brought a boundary.'],
    playerJabs: { kind: ['You are the only person here making the costume feel like agency.'], witty: ['Blue, your cape is the only thing in here with a coherent argument.'], brutal: ['You are a curtain with cheekbones and the room is still not ready for the reveal.'] },
  },
];

/* ============================================================
   MAX PRO — the two crews debating the tiny painting.
   Walking photographs from the artfreaks folder; they hold
   their positions (static) and their facings (anchorYaws),
   because the argument is precisely choreographed and they
   would prefer you knew that.
   ============================================================ */

const ARTFREAKS = 'puplic/fashion art freaks/assets/artfreaks';

export const MAX_PRO_CAST = [
  {
    id: 'promax1', name: 'PRO MAX 1', shortRole: 'the optimizer', role: 'Painter — Context, Visibility, Positioning',
    face: `${ARTFREAKS}/pro-max-cobalt-cage-cyborg.png`, cutout: true,
    static: true, debate: true, anchor: 'promax1',
    ego: 70, weak: 'witty', resist: 'brutal',
    hint: 'He speaks in metrics. The phone never leaves his hand. The hand never leaves the discourse.',
    pace: 0, pitch: 1.12, accessory: null,
    palette: { skin: 0xd9c2a8, hair: 0x14161c, top: 0x101014, bottom: 0x101014 },
    barks: [],
  },
  {
    id: 'promax2', name: 'PRO MAX 2', shortRole: 'the emerging artist', role: 'Emerging Artist — Worried About Looking Commercial',
    face: `${ARTFREAKS}/pro-max-four-arm-cage.png`, cutout: true,
    static: true, debate: true, anchor: 'promax2',
    ego: 55, weak: 'kind', resist: 'witty',
    hint: 'He carries a tiny notebook and a large fear of sincerity. Every opinion arrives pre-doubted.',
    pace: 0, pitch: 1.3, accessory: null,
    palette: { skin: 0xe0b89a, hair: 0xd98cff, top: 0x8a5cf6, bottom: 0x1c1c22 },
    barks: [],
  },
  {
    id: 'promax3', name: 'PRO MAX 3', shortRole: 'the curatorial painter', role: 'Curatorial Painter — Arms Folded, Stakes Enormous',
    face: `${ARTFREAKS}/pro-max-gold-cage-couture.png`, cutout: true,
    static: true, debate: true, anchor: 'promax3',
    ego: 85, weak: 'witty', resist: 'kind',
    hint: 'Every basic decision has enormous theoretical consequences. She has folded her arms about it.',
    pace: 0, pitch: 0.88, accessory: null,
    palette: { skin: 0xd9a184, hair: 0x8a8378, top: 0xc9a86a, bottom: 0xc9a86a },
    barks: [],
  },
  {
    id: 'post1', name: 'POST 1', shortRole: 'the veteran', role: 'Veteran Painter — Exhausted, Heard Everything',
    face: `${ARTFREAKS}/dildo-king-royal.png`, cutout: true,
    static: true, debate: true, anchor: 'post1', tilt: -0.07,   // leaning on the east wall
    ego: 60, weak: 'brutal', resist: 'kind',
    hint: 'He has heard every art theory before. All of them. Twice. He answers in single lines.',
    pace: 0, pitch: 0.72, accessory: null,
    palette: { skin: 0xc9a684, hair: 0x8a8378, top: 0x4a4438, bottom: 0x2a2d3a },
    barks: [],
  },
  {
    id: 'post2', name: 'POST 2', shortRole: 'the studio animal', role: 'Studio Animal — Judges By Looking, Judges Harshly',
    face: `${ARTFREAKS}/spaghetti-freak.png`, cutout: true,
    static: true, debate: true, seated: true, anchor: 'post2',   // sitting on the floor
    ego: 50, weak: 'kind', resist: 'brutal',
    hint: 'Paint on his hands, cigarette behind his ear, sitting on the floor like he pays rent there.',
    pace: 0, pitch: 0.95, accessory: null,
    palette: { skin: 0xd9a184, hair: 0x3a3430, top: 0x8c3b2e, bottom: 0x2a2d3a },
    barks: [],
  },
  {
    id: 'post3', name: 'POST 3', shortRole: 'the nihilist', role: 'Nihilist — Permanently Unimpressed, Probably Right',
    face: `${ARTFREAKS}/dildo-king-gothic.png`, cutout: true,
    static: true, debate: true, anchor: 'post3',                 // absurdly far, seeing the scale
    ego: 65, weak: 'witty', resist: 'brutal',
    hint: 'Painting died, came back, died again. He attended everything. He was not moved.',
    pace: 0, pitch: 0.62, accessory: null,
    palette: { skin: 0xd9c2a8, hair: 0x14161c, top: 0x17171c, bottom: 0x17171c },
    barks: [],
  },
  {
    id: 'attendant', name: 'The Attendant', shortRole: 'gallery attendant', role: 'Gallery Attendant — Sitting Silently Since 2021',
    face: `${ARTFREAKS}/toaster-freak.png`, cutout: true,
    static: true, debate: true, anchor: 'attendant',
    ego: 40, weak: 'kind', resist: 'brutal',
    hint: 'Paid by the hour. Unpaid in attention. She has seen the whole debate. She says nothing.',
    pace: 0, pitch: 0.5, accessory: null,
    palette: { skin: 0xd9c2a8, hair: 0x8a8378, top: 0x8a8a92, bottom: 0x4a4a52 },
    barks: ['...', '(The attendant does not look up.)', '(Somewhere, a stapler. Unmoved.)'],
  },
];

/* ============================================================
   THE DILDO BALL — the King, the Duck, and the court of heads.
   The King and the Duck are walking photographs; the courtiers
   are procedural bodies wearing the dress code: one smooth,
   proud, featureless dome each. The heads do not judge.
   ============================================================ */

const COURT_BARKS = [
  'The King knighted me with the sceptre. I have not washed. Kidding. Silicone washes.',
  'Dress code said “courtly”. I overdressed. I always overdress.',
  'The disco ball is the only crown that matters tonight.',
  'I danced so hard my credentials fell off.',
  'The dungeon has excellent acoustics and zero judgment.',
  'Heads up. Literally everyone here is one.',
  'I networked for two hours. Nobody here has a job. It was wonderful.',
  'The punch has a small crown floating in it. Do not ask the punch questions.',
  'His Majesty waved at me. Or through me. Wobbling makes it hard to tell.',
  'The conga line is forming. The conga line is sacred.',
  'I came as a joke and stayed as a person. Happens every time.',
  'The heads do not judge. The heads cannot. That is why they party so hard.',
];

const COURT_TITLES = [
  ['Sir Wobbles', 'knight of the wobble'],
  ['Duchess Flex', 'court contortionist'],
  ['Lord Buzzy', 'keeper of the batteries'],
  ['The Consort', 'third in line to the crown'],
  ['Dame Ribbons', 'mistress of the gift bags'],
  ['The Herald', 'announces arrivals, judges them'],
];

const COURT_HEADS = [0xe8c4a8, 0xd9a184, 0x9a6a48, 0xd98cff, 0x7fb285, 0xe8c15a];   // silicone pastels

export const DILDO_BALL_CAST = [
  {
    id: 'dildoKing', name: 'The Dildo King', shortRole: 'the monarch', role: 'His Majesty — The Back Room',
    face: `${ARTFREAKS}/dildo-king-pro-max.png`, cutout: true,
    static: true, anchor: 'dildoKing',
    ego: 120, weak: 'witty', resist: 'brutal',
    hint: 'His armor is majesty. Rage is just another subject here. Make the court laugh and the crown wobbles.',
    pace: 0, pitch: 0.78, accessory: null,
    palette: { skin: 0xd9a184, hair: 0x14161c, top: 0x6e1f3a, bottom: 0x17171c },
    openers: [
      'You approach the throne without an appointment. Bold. The crown respects bold. The crown respects little else.',
      'Every room needs a monarch. The front room has a committee. I pity it weekly.',
      'The kingdom is nine metres by twelve. The loyalty, however, is waterproof.',
      'Kneel. No — the floor is champagne. Stand. Stand like a subject with somewhere to be.',
      'I knighted the ice bucket this morning. It has already out-performed two biennales.',
    ],
    countered: [
      'Volume. How democratic. The court notes it and remains seated.',
      'Rage is a republic. This is a monarchy. Try again with posture.',
      'The crown has been booed by professionals. You are foam on a wave, sweetie.',
    ],
    reactions: {
      kind: ['...Kindness. In the throne room. Unprecedented since the Coronation Brunch.', 'You honor the crown. The crown honors you back. This is rare and non-transferable.'],
      witty: ['HA. The court heard that. The court NEVER hears anything.', 'A jester with aim. The last one only had timing. You have both. Disturbing.'],
      brutal: ['Noted. Filed under “executions I considered”.', 'Such teeth. The dungeon appreciates teeth. It has none itself. Costly.'],
    },
    weakHit: ['Stop. The sceptre is trembling. The sceptre never trembles.', 'Laughter in the throne room is treason. Delicious, repeatable treason.'],
    disarmed: ['...Fine. Honorary knighthood. No land, obviously. The land is a dance floor.'],
    dismiss: ['The audience is over. The party, tragically, continues.', 'Go. Mingle with the heads. They wobble but they mean well.'],
    meltdown: 'THE CROWN IS HOLLOW. THE CROWN WAS ALWAYS HOLLOW. IT IS PRACTICAL. IT IS LIGHTWEIGHT. IT IS FINE.',
    barks: [
      'I rule the back room. The front room is a democracy. I pity it on Thursdays.',
      'The sceptre is ceremonial. The ceremony is not.',
      'Every coronation needs a disco ball. History forgot this. I did not.',
      'The consort is sulking. The consort sulks in waterproof fabrics. Regal.',
      'Heads will wobble. That is not a threat. That is the whole point.',
    ],
    playerJabs: {
      kind: ['You built a kingdom where everyone belongs and wobbles together. That is rarer than a throne.'],
      witty: [
        'Your Majesty rules nine by twelve metres with the confidence of an empire. The scale IS the statement.',
        'The crown is silicone and the power is real. That is the most honest government in Oslo.',
      ],
      brutal: [
        'You are not a king. You are a mascot with a venue.',
        'The throne is a bar stool with a crown on it and everyone here knows it.',
      ],
    },
  },

  {
    id: 'duck', name: 'The Rubber Duck Freak', shortRole: 'party fowl', role: 'Party Fowl — Squeak Division',
    face: `${ARTFREAKS}/rubber-duck-freak.png`, cutout: true,
    static: true, anchor: 'duck',
    ego: 45, weak: 'kind', resist: 'brutal',
    hint: 'Nobody invited the duck. The duck predates the guest list. The duck predates lists.',
    pace: 0, pitch: 0.55, accessory: null,
    palette: { skin: 0xe8c15a, hair: 0xe8c15a, top: 0xe8c15a, bottom: 0xe8c15a },
    openers: [
      '(A slow, knowing squeak.)',
      '(The duck regards you with the calm of a thousand baths.)',
      '(It points at the disco ball, then at you, then gives a small nod.)',
    ],
    countered: ['(A respectful silence. The squeak is withheld.)', '...(it judges you, gently, in yellow)'],
    reactions: {
      kind: ['(The duck softens. Visibly. Audibly, even — a tiny squeak of grace.)'],
      witty: ['(A squeak that is definitely laughter. The King pretends not to hear.)'],
      brutal: ['(One step back. One step toward the ice bucket. Dignity intact.)'],
    },
    weakHit: ['(The duck is moved. The whole duck is moved.)'],
    disarmed: ['(The duck slides a cold bottle toward you. On the house. The house being His Majesty.)'],
    dismiss: ['(The duck drifts toward the music, nodding at the heads as it goes.)'],
    meltdown: '(THE SQUEAK. THE SQUEAK WAS HEARD AROUND THE WORLD. THE CROWN LOOKED UP. NOTHING WAS THE SAME.)',
    barks: [
      '...squeak.',
      '(The duck knows who put the crown in the punch. The duck will never tell.)',
      '(Somewhere, a bath is incomplete. The duck is not thinking about it.)',
      '(The duck has seen every party. The duck attends none of them officially.)',
    ],
    playerJabs: {
      kind: ['You are the only honest guest here. Nothing to prove, nothing to sell. Respect.'],
      witty: ['Strong silent type. You have squeaked less than the throne and meant it more.'],
      brutal: ['The outfit is a cry for help and the help is also rubber.'],
    },
  },

  // the court of heads — smooth, proud, unreadable, wandering
  ...COURT_TITLES.map(([name, role], i) => ({
    id: `court-${i}`,
    name,
    shortRole: role,
    role,
    ego: 40 + i * 3,
    weak: pick(['kind', 'witty', 'brutal']),
    resist: pick(['kind', 'witty', 'brutal']),
    hint: 'A member of the court. The head is smooth. The loyalty is total. The conversation is a gamble.',
    pace: rand(0.5, 0.9),
    pitch: 0.85 + i * 0.09,
    accessory: i === 2 ? 'hat' : null,      // Lord Buzzy wears the tiny party hat. Obviously.
    face: null,
    dildoHead: true,
    palette: {
      skin: COURT_HEADS[i % COURT_HEADS.length],
      hair: 0x14161c,
      top: pick([0x1c1c22, 0x2b1a3a, 0x101014, 0x3a1030]),
      bottom: 0x101014,
    },
    ambient: true,
    barks: COURT_BARKS,
    openers: null, countered: null, reactions: null, weakHit: null,
    disarmed: null, dismiss: null, meltdown: null, playerJabs: null,
  })),

  // the wild one — the leather room's mystery guest, promoted to the court
  {
    id: 'gimp', name: 'The Gimp', shortRole: 'mystery', role: 'Mystery Guest — Do Not Ask',
    face: 'puplic/people/gimp.png', cutout: true,
    static: true, anchor: 'gimp',
    ego: 40, weak: 'kind', resist: 'brutal',
    hint: 'Nobody knows who invited him. Everybody assumes somebody else did. He is having a wonderful time.',
    pace: 0, pitch: 0.6, accessory: null,
    palette: { skin: 0x8a8a92, hair: 0x14161c, top: 0x17171c, bottom: 0x17171c },
    openers: [
      '...',
      '(A slow, approving nod toward the disco ball.)',
      '(He points at the cow, then at you, then gives a thumbs up.)',
    ],
    countered: ['...!', '(A respectful silence. The loudest silence in the room.)'],
    reactions: {
      kind: ['(His eyes soften, visibly, through the whole outfit.)', '(He pats his heart twice. This means something.)'],
      witty: ['(A muffled sound that is definitely laughing.)', '(He writes nothing down. Somehow this feels like a review.)'],
      brutal: ['(He takes one step back and one step toward the ice bucket.)', '(A slow blink. Even the zipper seems disappointed in you.)'],
    },
    weakHit: ['(He is moved. The whole suit is moved.)'],
    disarmed: ['(He hands you a napkin. On it: a drawing of a heart wearing a little crown.)'],
    dismiss: ['(He drifts toward the music, nodding at the heads as he goes.)'],
    meltdown: '(HE SAYS NOTHING. IT IS THE MOST DEVASTATING SPEECH OF THE EVENING.)',
    barks: [
      '...',
      '...(he is pointing at the neon sign now)',
      '...(somewhere in there, a man is networking)',
      '...(he knows who put the crown in the punch. he will never tell)',
      '...(he has been to every party. he has never been invited to any party)',
    ],
    playerJabs: {
      kind: ['You\'re the only honest guest here. Nothing to say, nothing to sell. Respect.'],
      witty: ['Strong silent type. You\'ve said less than the throne and meant it more.'],
      brutal: ['The outfit is a cry for help and the help is also wearing the outfit.'],
    },
  },
];


/* ============================================================
   THE DAYLIGHT FLESH GARDEN — a chromatic thinking public.

   They are ambient rather than story-gated: the room should feel populated
   on every night, and every body gets its own color, doubt, and theory about
   whether post-contemporary artists still think (or merely render thinking).
   ============================================================ */

const DAYLIGHT_PEOPLE = [
  {
    id: 'garden-aura', name: 'Aura Compost', role: 'post-contemporary gardener',
    face: 'puplic/visual assets/character_faces_alt/03-goth-gardener.png', pitch: 0.86,
    palette: { skin: 0x6f402e, hair: 0x7dff62, top: 0xff4fa3, bottom: 0x42206f },
    barks: [
      'I think the artist is thinking through mulch. The mulch has declined comment.',
      'Post-contemporary means the present already composted us.',
      'The unicorn is not symbolic. Symbolism is its side hustle.',
      'I planted one critical position. It grew into three invoices.',
    ],
  },
  {
    id: 'garden-pixel', name: 'Pixel Moss', role: 'soft-rave theorist',
    face: 'puplic/visual assets/character_faces_alt/06-eccentric-dj.png', pitch: 1.18,
    palette: { skin: 0xb96f4f, hair: 0x45e8ff, top: 0xffed54, bottom: 0x006f91 },
    barks: [
      'The kick drum is thinking. I am providing administrative support.',
      'Their practice interrogates the body, but gently, after lunch.',
      'If the work has no object, why did I carry this tote bag?',
      'Lo-fi is just memory wearing compression socks.',
    ],
  },
  {
    id: 'garden-maybe', name: 'Dr. Maybe', role: 'professor of provisional thought',
    face: 'puplic/visual assets/character_faces_alt/05-punk-librarian.png', pitch: 0.76,
    palette: { skin: 0xe4b18d, hair: 0x7c35ff, top: 0x20d6a5, bottom: 0xff6757 },
    barks: [
      'Are artists thinking? Certainly. About dinner, mostly. This protects the work.',
      'The post-contemporary begins where the wall text runs out of battery.',
      'I reject certainty except when describing my own rejection of certainty.',
      'This rainbow has seven colors and at least nine institutional partners.',
    ],
  },
  {
    id: 'garden-loop', name: 'Loop Tender', role: 'artist between refreshes',
    face: 'puplic/visual assets/character_faces_alt/10-neon-cyclist.png', pitch: 1.28,
    palette: { skin: 0x9b5f42, hair: 0xff8a22, top: 0x2764ff, bottom: 0xb8ff35 },
    barks: [
      'I had a thought, refreshed it, and now it belongs to the platform.',
      'Post-contemporary painting is loading. Please admire the spinner.',
      'The artist thinks in public so the private can invoice them later.',
      'I came for discourse and stayed because the moss has good bass response.',
    ],
  },
  {
    id: 'garden-oracle', name: 'Concrete Oracle', role: 'unlicensed art prophet',
    face: 'puplic/visual assets/character_faces_alt/13-nature-mystic.png', pitch: 0.68,
    palette: { skin: 0x4d2d24, hair: 0xffd84a, top: 0xef3f65, bottom: 0x2dcfc1 },
    barks: [
      'The artist is thinking about not thinking. Very labor intensive.',
      'Tomorrow’s masterpiece is today’s awkward group chat.',
      'I asked the deer for a reading. It appraised my shoes.',
      'The rainbow predicts funding with scattered periods of sincerity.',
    ],
  },
  {
    id: 'garden-sincere', name: 'Sincere Error', role: 'recovering conceptualist',
    face: 'puplic/visual assets/character_faces_alt/01-indie-musician.png', pitch: 0.94,
    palette: { skin: 0xd9926f, hair: 0x2a173d, top: 0xff6fcf, bottom: 0x13a86b },
    barks: [
      'I accidentally liked the work before understanding it. Please keep this confidential.',
      'Thinking is not the same as an artist statement. I checked twice.',
      'Maybe the body is not a site. Maybe it is tired and wants fruit.',
      'The unicorn looked back. That was the strongest critique all day.',
    ],
  },
  {
    id: 'garden-caption', name: 'Caption Pending', role: 'curator without a deadline',
    face: 'puplic/visual assets/character_faces_alt/14-sarcastic-office-worker.png', pitch: 1.04,
    palette: { skin: 0x81513f, hair: 0xf3f0dc, top: 0x922dff, bottom: 0xff4c35 },
    barks: [
      'The post-contemporary artist thinks after publication, during corrections.',
      'I curated the gap between intention and catering.',
      'The work refuses closure. The venue closes at six.',
      'I can explain the rainbow, but it would become beige immediately.',
    ],
  },
  {
    id: 'garden-sleeper', name: 'Sleepy Thesis', role: 'poet in low-power mode',
    face: 'puplic/visual assets/character_faces_alt/16-sleepy-poet.png', pitch: 0.62,
    palette: { skin: 0xc98668, hair: 0x265cff, top: 0xffbd2e, bottom: 0xe43f93 },
    barks: [
      'I am thinking at twenty percent opacity.',
      'The artist’s silence is radical. Mine is just low blood sugar.',
      'A soft beat under a hard theory. Finally, furniture for the mind.',
      'Do unicorns dream of institutional critique, or is that our burden?',
    ],
  },
  {
    id: 'garden-chaos', name: 'Chaos Intern', role: 'assistant to the discourse',
    face: 'puplic/visual assets/character_faces_alt/12-chaotic-cook.png', pitch: 1.34,
    palette: { skin: 0xf0c3a2, hair: 0xff3a45, top: 0x3ee05f, bottom: 0x5443ff },
    barks: [
      'I alphabetized the feelings. The feelings unionized.',
      'Nobody knows what post-contemporary means, so I ordered more flowers.',
      'The artist is thinking. I saw the calendar invite.',
      'Please do not feed the theory after midnight. It becomes a panel.',
    ],
  },
  {
    id: 'garden-witness', name: 'The Color Witness', role: 'public, technically',
    face: 'puplic/visual assets/character_faces_alt/04-roller-skater.png', pitch: 1.12,
    palette: { skin: 0x5b3329, hair: 0xff62d0, top: 0x17cbe5, bottom: 0xffe14a },
    barks: [
      'I witnessed a genuine thought near the pink flowers. Nobody sponsored it.',
      'Color is what theory does when it stops checking its email.',
      'Maybe artists think. Maybe thinking is simply how the body dances alone.',
      'This whole garden is too much. At last, an accurate amount.',
    ],
  },
];

export const DAYLIGHT_GARDEN_CAST = DAYLIGHT_PEOPLE.map((p, i) => ({
  ...p,
  anchor: p.id,
  labelScale: 0.78,
  shortRole: p.role,
  ego: 42 + i * 3,
  weak: ['kind', 'witty', 'brutal'][i % 3],
  resist: ['brutal', 'kind', 'witty'][i % 3],
  hint: 'A colorful public thinker. Their theory may be a feeling wearing a lanyard.',
  pace: 0.58 + (i % 4) * 0.11,
  accessory: i % 3 === 0 ? 'phone' : (i % 3 === 1 ? 'wine' : 'clipboard'),
  ambient: true,
  openers: null, countered: null, reactions: null, weakHit: null,
  disarmed: null, dismiss: null, meltdown: null, playerJabs: null,
}));


/* ============================================================
   AMBIENT CROWD — procedurally-assembled artworld fauna
   ============================================================ */


const CROWD_TYPES = [

  {
    type: 'wineMom', names: ['A Wine Mom', 'Another Wine Mom', 'The Third Wine Mom'],
    role: 'opening regular',
    palette: () => ({ skin: pick([0xe8c4a8, 0xd9a184]), hair: pick([0xc9a86a, 0x8a5a33]), top: pick([0x8c3b2e, 0x8a5cf6, 0x2e5f4a]), bottom: 0x2a2d3a }),
    accessory: 'wine', pitch: 1.25,
    face: 'puplic/visual assets/character_faces/14-kind-grandmother.png',
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
    face: 'puplic/visual assets/character_faces/12-office-worker.png',
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
    face: 'puplic/visual assets/character_faces/10-quiet-teen.png',
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
    face: 'puplic/visual assets/character_faces/02-cheerful-student.png',
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
    face: 'puplic/visual assets/character_faces/06-middle-aged-mechanic.png',
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
    face: 'puplic/visual assets/character_faces/04-anxious-young-man.png',
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
    face: 'puplic/visual assets/character_faces/15-guarded-biker.png',
    barks: [
      'In Vienna we would call this "Tuesday".',
      'I knew the real scandal. This is the commemorative plate of the scandal.',
      'You call this transgressive? I once yawned at an emperor.',
      'The wine is adequate. The despair is imported. I approve of neither.',
    ],
  },
];

export const UP_AND_CUMMING_CAST = [
  {
    id: 'muscleMania300', name: 'Muscle Mania 300', shortRole: 'artist · not for sale', role: 'Artist — Absolute Refusal Division',
    face: 'puplic/up-and-cumming-artist/muscle-mania-300.png', cutout: true, cutoutNoBack: true, cutoutHeight: 2.42,
    static: true, anchor: 'muscleMania300', ego: 300, weak: 'witty', resist: 'brutal',
    hint: 'He can bench-press the desk. He cannot bench-press a joke about edition sizes.',
    pace: 0.55, pitch: 0.68, accessory: null,
    palette: { skin: 0xd49a78, hair: 0x17120e, top: 0xd49a78, bottom: 0x201a18 },
    openers: [
      'NOT FOR SALE. The work gets separation anxiety. So do I. We are a practice.',
      'Zebra sold the blue one while I was blinking. I no longer blink near collectors.',
      'My price is no. My discount is NO. My studio inventory is a hostage rescue.',
      'Every red dot is a tiny wound wearing good typography.',
    ],
    countered: [
      'You cannot out-muscle my refusal. I train refusal six days a week.',
      'Brutality is just sales pressure without the loafers. I know its form.',
    ],
    reactions: {
      kind: ['You understand. The paintings need a stable home. Mine.', 'Thank you. Please stand between Zebra and the wall.'],
      witty: ['Do not call it a limited edition of zero. That is funny and dangerously marketable.', 'I laughed. Zebra heard. Now the laugh has a price.'],
      brutal: ['My pecs absorbed that. The paintings remain unavailable.', 'I have wrestled larger opinions in smaller boots.'],
    },
    weakHit: ['Stop making refusal sound collectible.', 'No jokes. Zebra can monetize jokes from across the room.'],
    disarmed: ['Fine. I might sell one—to myself. At cost. With visitation rights.'],
    dismiss: ['This studio visit is over. The work and I need protein.', 'No more questions. Questions become invoices here.'],
    meltdown: 'THE RED DOT TOUCHED THE WALL. EVACUATE THE PAINTINGS. I WILL CARRY ALL FIVE.',
    barks: [
      'NOT FOR SALE!',
      'Take that dot off Blue Dealer!',
      'The work stays with its father!',
      'I made them huge so nobody could carry them out!',
    ],
    playerJabs: {
      kind: ['Protecting the work is love. Smothering it is still smothering it.'],
      witty: ['You made five enormous hostage notes and called them paintings. Respectfully: iconic.'],
      brutal: ['You are not protecting the work. You are arm-wrestling its future and calling the bruise integrity.'],
    },
  },
  {
    id: 'zebraZebrason', name: 'Zebra Zebrason', shortRole: 'gallerist · always closing', role: 'Gallerist — Pressure Sales in Stripes',
    face: 'puplic/up-and-cumming-artist/zebra-zebrason.png', cutout: true, cutoutNoBack: true, cutoutHeight: 2.05,
    static: true, anchor: 'zebraZebrason', ego: 170, weak: 'brutal', resist: 'kind',
    hint: 'Charm has been fully depreciated. A direct hit is the only language left off the invoice.',
    pace: 0.9, pitch: 1.08, accessory: null,
    palette: { skin: 0xc88a68, hair: 0x19130f, top: 0xf0eee7, bottom: 0x17171b },
    openers: [
      'Muscle, darling, attachment is not a strategy. Sign here. Harder. I brought three pens.',
      'I have six collectors in the taxi and one in the ventilation system. We are SELLING.',
      'Blue Dealer is sold. Angel is pending. Devil has two offers and a complicated tax status.',
      'Artists make work. Gallerists make the work leave the building. Nature is healing.',
    ],
    countered: [
      'Kindness does not close. Pressure closes. Champagne closes. I close.',
      'Sweetness is lovely. Put it in writing and assign me seventy percent.',
    ],
    reactions: {
      kind: ['Lovely sentiment. No signature. Next.', 'Empathy is not a recognized payment method.'],
      witty: ['Ha! Put that on the press release. I own the press release.', 'Funny sells. Again, slower, while I record.'],
      brutal: ['That was almost stronger than Muscle. Almost.', 'Fine. A boundary. I have heard of these in podcasts.'],
    },
    weakHit: ['Do not use the word parasite in front of the client list.', 'Lower your voice. The commission split can hear you.'],
    disarmed: ['No sale today. A soft launch of not selling. Very exclusive.'],
    dismiss: ['I have to push him again. The quarter ends in nine minutes.', 'This conversation lacks urgency and therefore value.'],
    meltdown: 'THE INVENTORY IS STAYING? THEN WHAT AM I WEARING ZEBRA FOR? THIS WAS A CLOSING OUTFIT.',
    barks: [
      'SIGN THE AGREEMENT!',
      'The collector is emotionally liquid!',
      'Nothing leaves the studio until something leaves the studio!',
      'I put the red dot there for momentum!',
    ],
    playerJabs: {
      kind: ['You can represent the artist without turning the studio into an extraction site.'],
      witty: ['Your suit already has bars. The ethics are trying to escape.'],
      brutal: ['You do not sell feelings. You mug them, invoice the bruise, and call it placement.'],
    },
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
      face: t.face ?? null,
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
        leatherLatex: [m.milo, m.sol, m.bea, m.bob, m.bobgirl, m.gimp, m.fashion, LEATHER_ROOM_CAST[0], LEATHER_ROOM_CAST[1]],
        gildedFork: [m.forkHost, m.fork1, m.fork2, m.fork3, m.fork4, m.fork5, m.fork6, m.fork7, m.fork8],
        maxPro: MAX_PRO_CAST,
        dildoBall: DILDO_BALL_CAST,
        daylightClub: DAYLIGHT_GARDEN_CAST,
        upAndCumming: UP_AND_CUMMING_CAST,
      };
    case 2:


      return {
        garret: [],
        galleria: [
          m.victoria, m.kreyo, m.docent, m.chad, m.dolores, m.petra, m.baron,
          ...buildCrowd('galleria', 2, 5),
        ],
        vault: [],
        leatherLatex: [m.milo, m.sol, m.bea, m.bob, m.bobgirl, m.gimp, m.fashion, LEATHER_ROOM_CAST[0], LEATHER_ROOM_CAST[1], LEATHER_ROOM_CAST[2]],
        gildedFork: [m.forkHost, m.fork1, m.fork2, m.fork3, m.fork4, m.fork5, m.fork6, m.fork7, m.fork8],
        maxPro: MAX_PRO_CAST,
        dildoBall: DILDO_BALL_CAST,
        daylightClub: DAYLIGHT_GARDEN_CAST,
        upAndCumming: UP_AND_CUMMING_CAST,
      };
    default:


      return {
        garret: [],
        galleria: [m.docent, ...buildCrowd('galleria', 3, 2)],
        vault: [m.index, m.lucia, m.chad, m.barnaby, m.petra, ...buildCrowd('vault', 3, 2)],
        leatherLatex: [m.milo, m.sol, m.bea, m.bob, m.bobgirl, m.gimp, m.fashion, ...LEATHER_ROOM_CAST],
        gildedFork: [m.forkHost, m.fork1, m.fork2, m.fork3, m.fork4, m.fork5, m.fork6, m.fork7, m.fork8],
        maxPro: MAX_PRO_CAST,
        dildoBall: DILDO_BALL_CAST,
        daylightClub: DAYLIGHT_GARDEN_CAST,
        upAndCumming: UP_AND_CUMMING_CAST,
      };

  }
}
