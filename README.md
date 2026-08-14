# PAINTER: ASCENSION

A first-person artworld satire in three nights, inspired by the structure of
**Ultima IX: Ascension** — a fallen world, eight corrupted virtues, and one
person's soul at stake — transplanted into four rooms: your garret, a
white-cube gallery, a collector's vault, and the collector's private house —
the Leather & Latex Rooms, where warm hide up front gives way to black gloss
and a 126 BPM rig in the back.

You are **The Artist**. The Market has corrupted the Eight Virtues of Art
(Vision → Branding, Craft → Content, Sacrifice → Exposure, …). Paint honest
work to cleanse them, survive the openings, and decide what you are by the
third night.

## Run it

No build step, no install. Any static file server works:

```sh
npx serve .            # or: python3 -m http.server 8000
```

Open the printed URL. Desktop browser with keyboard & mouse required.

## How to play

| Input | Action |
| --- | --- |
| `W A S D` + mouse | Move / look (pointer lock) |
| `LMB` | Swing the brush — paint splatters walls, canvases, and egos |
| `E` | Talk / use / hang work / sleep |
| `M` | The map — click a studio, appear there |

| `1 2 3` | In dialogue: **Kind / Witty / Brutal** comebacks |
| `Tab` | The Eight Virtues codex |
| `Esc` | Pause / step back |

**Verbal combat** is the shooting game: every NPC has an **ego bar**, a hidden
**weakness** and a **resistance**. Hit the weakness for bonus damage; hit the
resistance and they counterattack, costing *you* Fame and Integrity. Reduce an
ego to zero and they melt down, theatrically, in public. Brutality works — and
raises **Heat**. Max out Heat inside Galleria Bianca and you're banned.

**Painting is real**: the easel opens a canvas where you lay pigment with the
mouse. Coverage, colour variety and unbroken-stroke *flow* score the piece.
Sign it, carry it under your arm (watch your left hand), hang it on your
reserved wall, and face Victoria Vane's appraisal. Sell, negotiate, or refuse —
each tilts the virtues.

Four endings. Dots on the title screen track which you've found.

## Soundtrack & the radio

Warm songs from `puplic/songs/` play on the title screen, in the garret, and
over the endings — the market spaces get coded procedural room scores. (The folder
is spelled `puplic`; left as found.)

### The Daylight Flesh Garden

The garden has its own 108 BPM procedural experimental jazz-electronica room
score: dusty restrained drums, soft sine bass, crooked electric-piano voicings,
filtered tape hiss, and irregular wordless "ah/oh" moans made from moving vocal
formants, pitch bends, and vibrato. It is synthesized at runtime in
`js/core/audio.js`; there is no sampled soundtrack file to ship or loop.

The garden surfaces use the 1K JPG diffuse, OpenGL normal, and roughness maps
from Poly Haven's [Forest Ground 04](https://polyhaven.com/a/forest_ground_04)
and [Painted Plaster Wall](https://polyhaven.com/a/painted_plaster_wall).
Both assets are published under Poly Haven's CC0 license. The six source MD5
values from Poly Haven's asset API are recorded in
`puplic/polyhaven/daylight-garden/CHECKSUMS.md5` so local copies can be checked
without relying on filenames or file sizes alone.

### The Garret studio

The studio floor uses Poly Haven's [Old Wood Floor](https://polyhaven.com/a/old_wood_floor),
while its walls and ceiling use [Worn Plaster Wall](https://polyhaven.com/a/worn_plaster_wall).
Both are CC0 materials. Their 1K JPG diffuse, OpenGL normal, and roughness maps
are stored under `puplic/polyhaven/studio/`; API-provided MD5 values are recorded
in the adjacent `CHECKSUMS.md5` manifest.

**The radio** sits on the garret desk, wearing `visual assets/radio.png` as its
face. Press `E` on it: three tapes, Play/Stop/Rewind, BASS/TREBLE/SPEED faders
(the speed fader is vinyl-style pitch shift), and ECHO + TIME knobs — drag
knobs vertically. It keeps playing when you step back. It does not travel.

## Architecture


```
index.html            shell + all UI layers (HUD, dialogue, menus)
css/style.css         design system: dark-first, 8pt scale, reduced-motion aware
js/core/
  config.js           every tunable number (feel lives here)
  utils.js            math, Emitter event bus, seeded RNG, escapeHtml
  state.js            run state (meters, virtues, flags) + localStorage meta
  input.js            keyboard/mouse/pointer-lock abstraction
  audio.js            procedural WebAudio: SFX + profile-driven room scores
js/game/
  world.js            expanding zone set: geometry, colliders, doors, splat decals
  player.js           FPS controller: per-axis AABB collision, head bob
  hand.js             procedural visible hands: swing, gestures, carried painting
  paint.js            GPU particle pool (one draw call, custom shader) + easel overlay
  npc.js              NPC bodies, waypoint AI, head-tracking, meltdown choreography
  characters.js       the authored cast + procedural crowd generator
  dialogue.js         duel engine + weird-line generator
  quests.js           three-night structure, appraisal script, endings
js/ui/ui.js           all DOM: HUD, typewriter dialogue, toasts, codex, transitions
js/main.js            boot, mode state machine, the loop
```

Design decisions worth knowing:

- **One dependency** (three.js, pinned CDN import map). Everything else —
  sound, characters, artwork, UI — is generated at runtime.
- **No per-frame allocation** in the hot loop; particles and splat decals are
  pooled; zones are toggled, not rebuilt.
- **Modules talk via events**, never by reaching into each other.
- Meters (Fame/Integrity/Cash/Heat) and the eight virtues are the *only*
  progression model — every choice routes through them.

## Tuning

Want a meaner or gentler artworld? `js/core/config.js` holds swing cooldowns,
duel damage, heat decay, painting quality weights. The cast's lines live in
`js/game/characters.js` — adding a weirdo is five lines and a bark pool.
