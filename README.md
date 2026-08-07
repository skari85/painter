# PAINTER: ASCENSION

A first-person artworld satire in three nights, inspired by the structure of
**Ultima IX: Ascension** — a fallen world, eight corrupted virtues, and one
person's soul at stake — transplanted into three studios: your garret, a
white-cube gallery, and a collector's vault.

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

## Architecture

```
index.html            shell + all UI layers (HUD, dialogue, menus)
css/style.css         design system: dark-first, 8pt scale, reduced-motion aware
js/core/
  config.js           every tunable number (feel lives here)
  utils.js            math, Emitter event bus, seeded RNG, escapeHtml
  state.js            run state (meters, virtues, flags) + localStorage meta
  input.js            keyboard/mouse/pointer-lock abstraction
  audio.js            100% procedural WebAudio (no assets): SFX + ambient drones
js/game/
  world.js            the 3 zones: procedural geometry, colliders, doors, splat decals
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
