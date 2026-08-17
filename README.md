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

## Soundtrack, vinyl & the radio

Warm songs from `puplic/songs/` play on the title screen, over the endings, and
through the communal record collection; every room also has a coded procedural
score of its own. (The folder is spelled `puplic`; left as found.)
The original three records—*Alt er tungt alt er fint 2*, *Sa sliten*, and *Jeg
liker deg (demo)*—are credited to **Usrname** in the collection.
Procedural room scores use a shared calmer feel: roughly ten percent slower
tempo, softer percussion and bass, quieter lead voices, and substantially less
noise texture. These settings do not alter the Usrname or Ullabjakk recordings.

Press **P** anywhere during exploration to open the communal record case, or
press **E** at one of its turntables. Choosing a vinyl starts it immediately and
keeps the same playback position while travelling between rooms. A record has
exclusive control of the music bus—including inside the Dildo Ball and Public
Restroom—so procedural scores never clash with it. Stopping the vinyl returns
control to the current room after a short serialized fade. The now-playing chip
shows whether the travelling record or the local room score owns the speakers.

The record case also includes eight tracks by **Ullabjakk**: *Bara einu sinni
enn*, *Fyrirgefðu geimverur 2*, *Geðveikur af sjálfum mér 1*, *Hel sjúkur í
þig (demo)*, *Íslenskt skammdegi*, *Kjarnorkusprengja (demo 1)*, *Passa þig á
mér*, and *Þykist ekki þekkja mig 1*. Their local MP3 assets live in
`puplic/songs/ullabjakk/`, and every record carries an explicit artist credit in
the collection UI.

The title and pause menus include **Share This Game**. Supporting browsers open
their native share sheet; other browsers copy a clean page URL with no query,
hash, save, or room state. If clipboard access is unavailable, the game exposes
the link in a selectable fallback dialog. Sharing adds no account or referral
tracking.

### Church Burning Fire Sensation Cockburn

The scene map now reaches a fog-heavy procedural Norwegian forest containing
exactly ten stave churches, 34 roaming wild boars, and a fictionalized Varg
Vikernes ego encounter about childhood fear, isolation, and responsibility.
The apparition is depressive, self-pitying, manipulative, cruel, and explicitly
not redeemed by being understood; the dialogue separates explanation from excuse.
Inside this room the first-person brush/canvas silhouette becomes a lit metal
lighter and red gasoline can. The boars make synthesized wet sponge squeaks;
the room score is an original lo-fi black-metal/dark-ambient sequence generated
at runtime. No copyrighted recording is bundled. Shattering the encounter's ego
triggers a stylized flame dissolve and disappearance. Each church can also be
burned independently: press `E` nearby to douse it, then aim and click the lighter.
Its fire, smoke, charring, orange light, and procedural crackle persist for the run.

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

### The Listening Room and Wall of Fame

Galleria Bianca now leads into a purpose-built walnut-and-felt listening room:
two full-range reference speakers, one communal turntable, and a detailed live
four-piece with singer, guitar, bass, and full drum kit. Press `E` at the player
to open the record case, or `P` to choose one directly. Approximate tempo
metadata keeps the performers related to the selected record: slow music gives
them restrained sway, while faster tracks increase head movement, strumming,
stick travel, jumps, cymbal vibration, and stage-light punch. The recordings
themselves are never time-stretched or altered.

Twelve original canvas-coded portraits line the side walls—Pablo Picasso, Frida
Kahlo, Jean-Michel Basquiat, Georgia O’Keeffe, Louise Bourgeois, David Hockney,
Faith Ringgold, Henri Matisse, Francis Bacon, Jackson Pollock, Lee Krasner, and
Yayoi Kusama. Each face is drawn procedurally at runtime with modeled ears,
cheeks, eyes, irises, brows, noses, lips, age lines, hair, and artist-specific
background language. Every frame can be inspected for a short sourced artist
quotation. Quote references:
[Picasso](https://www.moma.org/artists/4609-pablo-picasso),
[Kahlo](https://www.moma.org/artists/2963-frida-kahlo),
[Basquiat](https://www.moma.org/artists/370-jean-michel-basquiat),
[O’Keeffe](https://www.nga.gov/artworks/70182-line-and-curve),
[Bourgeois](https://www.moma.org/louise_bourgeois/lb_essay_2017.pdf),
[Hockney](https://shop.tate.org.uk/david-hockney-hardback/19303.html),
[Ringgold](https://www.moma.org/collection/artists/7066),
[Matisse](https://www.moma.org/collection/artists/3832),
[Bacon](https://www.francis-bacon.com/chronology),
[Pollock](https://www.moma.org/interactives/exhibitions/1998/pollock/website100/txt_possibilities_drip.html),
[Krasner](https://www.moma.org/audio/playlist/297/3821), and
[Kusama](https://www.moma.org/audio/3110).

### MTV Cribs: Baby Money

The Listening Room opens into a deliberately non-sexual reality-TV satire
about four spoiled adult heirs dressed in oversized bib couture and boasting
about their trust funds. A camera operator, boom operator, host, and director
walk continuous overlapping routes around the set while the adult cast delivers
ambient wealth monologues. The room includes a gold formula fridge, sectional,
money fountain, bottle-service table, moving broadcast light, and a clear
on-set notice that every cast member is an adult.

### MAX PRO KUNST 2000 boxing broadcast

The MAX PRO ring now has a stitched leather apron and canvas, four rope levels,
padded turnbuckles, corner equipment, access steps, a broadcast truss, targeted
fight lighting, ringside cameras, and a weathered concrete broadcast wall. The
two articulated boxers have modeled faces, mouths and mouthguards, chest and ab
definition, stitched trunks, side trim, taped wrists, detailed gloves with
thumbs and seams, and leather boots. Their hit reactions open the mouth, shake
the mouthguard, recoil through the head and torso, and trigger distinct
procedural two-formant moans for each fighter.

The room uses Poly Haven's CC0 [Concrete Floor Painted](https://polyhaven.com/a/concrete_floor_painted)
and [Fabric Leather 02](https://polyhaven.com/a/fabric_leather_02) 1K diffuse,
OpenGL normal, and roughness maps. API-provided MD5 values and source details
live under `puplic/polyhaven/max-pro/`.

### Up and Cumming remix

Up and Cumming Artist has an original procedural woozy-trap room remix: sliding
sub-bass, half-time drums, detuned bell fragments, tape air, and short synthetic
rapper-like vowel chops. It uses no sampled performer, copyrighted melody, or
song lyric; every sound is synthesized at runtime in `js/core/audio.js`.

### The Garret studio

The studio floor uses Poly Haven's [Old Wood Floor](https://polyhaven.com/a/old_wood_floor),
while its walls and ceiling use [Worn Plaster Wall](https://polyhaven.com/a/worn_plaster_wall).
Both are CC0 materials. Their 1K JPG diffuse, OpenGL normal, and roughness maps
are stored under `puplic/polyhaven/studio/`; API-provided MD5 values are recorded
in the adjacent `CHECKSUMS.md5` manifest.

### The Public Restroom

Galleria Bianca now has a public restroom: four usable stall sound points,
three urinals, a communal sink, fogged mirrors, puddles, drains, exposed pipes,
fluorescent club lighting, and painted stall fronts using the existing
`puplic/textures/8.jpg` library image. The damp ceiling reuses the local CC0
Poly Haven Painted Plaster Wall diffuse, normal, and roughness maps.
Stall three is under permanent containment: an impossibly large, animated poop
has defeated the flush, while a uniformed Toilet Guard points at it and cycles
through silent threats to arrest whoever produced it. Two patrons keep using the
urinals, one washes their hands with suspicious commitment, and another waits
outside the stalls while trying not to look implicated.
In the sink-side corner, **Doctor Drug** wears black beneath a geometric signal
helmet. He is a fully interactive, deeply paranoid drug dealer whose political
and climate-change monologues can be challenged through a dedicated **Talk to
Drugdealer** prompt.

The room enforces a literal acoustic policy. Its original 132 BPM **Techno
Zamba** score contains only procedural urine streams, splashes, droplets, and
layered fart synthesis, with short tiled-room reflections. There are no sampled
recordings, conventional drums, voices, melodies, or footsteps in the room.

### U Wish U Had Hair But U Dont

The **Up and Cumming Artist** room now connects to a full-service chrome and
pink hair salon named **U WISH U HAD HAIR BUT U DONT**. It has six mirrored
cutting stations, hydraulic salon chairs, three wash basins, a reception desk,
an out-of-stock hair cabinet, a treatment menu, and its own glossy procedural
electro score. All six authored stylists and customers use genuinely bald
procedural heads—the hair mesh is omitted rather than merely recolored—and the
room never draws from the generic, potentially hairy crowd.

**The radio** sits on the garret desk, wearing `visual assets/radio.png` as its
face. Press `E` on it: three tapes, Play/Stop/Rewind, BASS/TREBLE/SPEED faders
(the speed fader is vinyl-style pitch shift), and ECHO + TIME knobs — drag
knobs vertically. It keeps playing when you step back. It does not travel.

### DOCUMENTA: The Documenting

Galleria Bianca now opens into a 26×18-metre institutional documentation maze
where camera crews film camera crews, accreditation printers issue contradictory
identities, recursive monitors archive their own feeds, and empty plinths receive
more coverage than visitors. The optional side quest corrupts three stations with
three existing verbs: press `E` at Accreditation, splatter the main Live
Documentation lens with `LMB`, then press `Q` to make Archive Intake appraise
itself beside the newest finished painting.

The resulting metadata overflow opens the office of Dr. Meta Dater, Head of
Documentation, whose dialogue bar measures **METADATA** rather than ego. The
last conversational tone produces one of three persistent room outcomes:
released subjects, corrupted metadata, or collapsed authority. The 92 BPM room
score and its shutter, printer, scanner, and server-collapse sounds are generated
at runtime; all room geometry and recursive feeds are procedural, with no new
external media assets.

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

### The Invisible Collection

The annex behind The Vault is an institution-sized satire: five taped empty
footprints, invisible collision surfaces, security alarms, an escalating
paperwork chain, and a valuation-driven score built from receipt-printer ticks,
auction gavels, elevator chimes, shredder noise, and conservation air. Its seed
is the real 2021 Art-Rite auction of Salvatore Garau's immaterial sculpture
*Io sono*, catalogued at roughly 150 × 150 cm and sold with its certificate for
about €15,000. The implementation is an original fictional system, not a
recreation of the artist's work. Sources: [Art-Rite auction catalogue](https://www.art-rite.it/upl/cms/attach/20210510/122806772_6593.pdf) and [reported auction result](https://news.artnet.com/art-world/italian-artist-auctioned-off-invisible-sculpture-18300-literally-made-nothing-1976181).

## Tuning

Want a meaner or gentler artworld? `js/core/config.js` holds swing cooldowns,
duel damage, heat decay, painting quality weights. The cast's lines live in
`js/game/characters.js` — adding a weirdo is five lines and a bark pool.
