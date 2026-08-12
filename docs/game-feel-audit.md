# Game Feel Audit — Premium iOS Direction

## Executive assessment

The game already has a stronger foundation than a typical web prototype: cohesive SF-style typography, procedural room scores, contextual sound effects, transform/opacity animation, reduced-motion support, hit markers, floating damage text, and polished glass surfaces.

What prevents it from feeling like a premium iOS game is **feedback orchestration**. Visuals and sounds exist, but they are not consistently paired with tactile feedback, directional screen response, or clearly ranked event intensities. There is currently no haptic system and almost no camera response to gameplay events.

Relevant implementation areas:

- Buttons and global SFX: `js/main.js`, `js/core/audio.js`
- Score and damage feedback: `js/main.js`, `js/ui/ui.js`
- Meter changes: `js/core/state.js`, `js/ui/ui.js`
- Completion flow: `js/main.js`, `js/ui/ui.js`
- Animation language: `css/style.css`
- Camera behavior: `js/game/player.js`

---

## 1. Button tap

### Current feedback

- Standard `.btn` controls shrink to `scale(0.98)` on `:active` and move down from their hover lift.
- Dialogue options use `scale(0.99)` while remaining translated to the right.
- Most top-level menu buttons call the same `uiConfirm()` sound: two clean sine tones around 740 Hz and 1110 Hz.
- Dynamically created controls—dialogue options, map cards, palette swatches, follow buttons, séance choices, and painting controls—do not consistently pass through the global confirmation-sound path.
- Keyboard actions generally have no equivalent tactile or pressed-state response.
- Disabled and rejected actions use `countered()`, but there is no tactile distinction.
- There is no haptic implementation.

The current motion is clean, but it feels like CSS interaction feedback rather than a physical iOS control. Giving every major action the same sound also flattens the interaction hierarchy.

### Suggested haptic pattern

Use a semantic haptic service instead of triggering raw feedback in individual handlers:

- **Ordinary button:** `UIImpactFeedbackGenerator(style: .light)` on successful activation.
- **Primary or committing action:** `.medium` for Begin, Sign It, travel, and title confirmation.
- **Selection change:** `UISelectionFeedbackGenerator.selectionChanged()` for palette colors, settings, map focus, and dialogue focus.
- **Disabled or rejected action:** `UINotificationFeedbackGenerator.notificationOccurred(.warning)` only when the player actively attempts the action.
- Prepare generators on touch-down or when a modal becomes interactive, then fire on activation to reduce perceived latency.

Avoid haptics for every hover or focus movement. Premium haptics are sparse and semantic.

### Sound cue

Build a small material button family instead of one universal beep:

- **Tap:** a very short, dry 2–4 kHz tick with a soft 180–250 Hz body; 30–50 ms total.
- **Primary confirm:** the tap plus a restrained upward tonal interval; 90–140 ms.
- **Selection:** a tiny muted wood or glass tick, quieter than confirmation.
- **Close or back:** a short downward interval or soft cloth-like tuck.
- **Rejected:** a dull, filtered knock with no bright transient.

The existing `uiConfirm()` is musically pleasant but exposed and synthetic. Filtered noise/transient layers and mild pitch variation would make controls feel material rather than oscillator-generated.

### Animation and easing

Use a two-stage physical response:

1. **Touch-down:** scale to `0.965–0.975` over 70–90 ms with `cubic-bezier(.2, 0, 0, 1)`.
2. **Release:** spring back to `1` over 180–240 ms with `cubic-bezier(.2, 1.35, .35, 1)`.

Additional recommendations:

- Remove hover-only lifts on coarse pointers; iOS should respond to press, not simulated hover.
- Let the label or icon compress by 1–2 px independently from the shadow.
- Primary actions may emit a restrained 120–180 ms accent bloom behind the surface.
- Modal-triggering buttons should compress immediately, then the destination card should rise from the same visual axis.
- Keyboard activation should replay the same pressed animation.
- Keep destructive and back actions flatter and quieter than primary confirmation.

---

## 2. Score popup and meter gain

The game has no single conventional score. Its score interactions are EGO damage numbers, meter deltas, follower deltas, painting quality, and end-of-night result rows.

### Current feedback

- Dialogue hits create world-positioned `-N EGO` text that drifts upward for 900 ms.
- Brutal, kind, witty, and resisted results have different colors and sizes.
- Successful hits show a center hit marker and play `hitmarker()` audio.
- Meter bars animate width over 280 ms, but their numbers jump immediately to the new value.
- ARTI follower changes have a dedicated floating-delta animation.
- Painting completion displays quality inside a toast instead of treating the result as a scored reveal.
- Meter changes can occur in groups, but there is no staged tally or shared feedback sequence.
- No haptics accompany gains or losses.

The dialogue popup is readable and responsive, but it behaves like a generic combat number. Gains elsewhere are understated, so important rewards can disappear into the toast stack.

### Suggested haptic pattern

- **Small positive delta:** `.light` impact once per resolved event, not once per meter.
- **Meaningful gain or weakness hit:** `.medium` impact.
- **Large gain, viral result, excellent painting, or milestone:** `.rigid` followed 70–90 ms later by `.light`, or `.success` notification for a true achievement.
- **Multiple gains:** one escalating pattern, such as light → medium with 70 ms spacing; never several simultaneous impacts.
- **Passive meter ticking:** no haptic.

Haptic intensity should correspond to event importance, not the raw number alone. A story-defining `+4` can deserve more weight than a routine `+8`.

### Sound cue

Use a consistent score grammar:

- **Popup birth:** a crisp paint-fleck or ceramic tick synchronized to the haptic.
- **Positive delta:** a short upward pitch gesture whose material follows the meter:
  - Fame: glassy or plucked shimmer.
  - Integrity: warm felt or wooden tone.
  - Cash: compact register or chime accent.
  - Heat: dry metallic snap or camera-flash transient.
- **Weakness or critical verbal hit:** the existing hit marker plus a slightly wider tonal crack.
- **Large reward:** a warm resolving tail rather than merely more volume.

Duck the room score by only 1–2 dB for approximately 150 ms on major score events. This makes space without audible pumping.

### Animation and easing

For dialogue score popups:

- Spawn at `scale(0.72)` with a 60–90 ms pop to `1.12`.
- Settle to `1` over 120–160 ms with a spring curve.
- Hold clearly for 250–350 ms.
- Drift 30–44 px upward while fading over another 350–450 ms.
- Brutal or critical results may add 1–2 degrees of rotation and one brief typographic-weight pulse, not random screen shake.
- During full-screen dialogue, anchor the number closer to the impacted portrait or EGO bar. World projection can feel disconnected once the panel is open.

For HUD meters:

- Animate numeric values with a 220–350 ms count-up or count-down.
- Add a traveling highlight along the changed part of the meter.
- Briefly scale the meter row to `1.025`, then settle.
- Show a compact `+N` or `−N` next to the affected number for 700–900 ms.
- Batch changes caused by one choice so the player reads them as one consequence.

For painting quality:

- Promote quality to a dedicated reveal: let the canvas settle, count the score up over 450–700 ms, display a result label, then enter the naming modal.
- Do not reveal the final quality only inside a general toast.

---

## 3. Damage taken and countered response

The game has no health bar. Damage taken means a resisted comeback causing Fame and Integrity loss, increasing Heat, or another negative meter consequence.

### Current feedback

- A resisted or healing dialogue result triggers a full-screen red inset glow through `credPulse()`.
- `countered()` plays a descending sawtooth tone.
- A gray `RESISTED` or `+N EGO` popup appears over the NPC.
- Fame and Integrity bars subsequently change.
- The red glow turns on and fades through a 280 ms opacity transition.
- There is no directional camera impulse, dialogue-panel displacement, vignette compression, audio ducking, or tactile response.
- The same red visual language can represent social counter-damage and general danger, reducing specificity.

This communicates failure but not impact. The player sees that something went wrong without feeling that the opponent’s reply landed.

### Suggested haptic pattern

- **Normal counter-hit:** `.medium` impact.
- **Heavy social hit or large combined loss:** `.heavy` or `.rigid`, optionally followed by `.soft` after 80–110 ms to simulate impact and emotional aftershock.
- **Heat warning near ban threshold:** `.warning` only when crossing a threshold such as 70% or 90%, not on every Heat increase.
- **Banishment or failure:** `.error` notification.

Do not use continuous vibration. A single precisely synchronized hit feels more native and is less fatiguing.

### Sound cue

The existing descending saw is directionally correct but too game-synth-like on its own. Layer it with:

- A low, short chest impact around 90–140 Hz.
- A dry midrange knock around 500–900 Hz.
- A brief reverse breath or room suck immediately before strong counters.
- A restrained high-frequency sting for embarrassment or credibility loss.

For severe damage, momentarily low-pass or duck room music for 180–260 ms, then restore it. This creates an “air left the room” effect without resorting to an explosion.

### Animation and easing

Use a short, directional social recoil:

- Move the dialogue panel or player view 6–10 px away from the attacking portrait over 45–65 ms.
- Return over 180–240 ms with `cubic-bezier(.18, .8, .25, 1)`.
- Add a 90–130 ms dark-edge compression and narrow red chromatic fringe, then fade over 250–350 ms.
- Pulse only the affected Fame or Integrity meter rows immediately after impact.
- Delay the opponent’s reply text by roughly 60–90 ms after the transient lands.
- For severe counters, apply a tiny FOV kick of about `+1°` or a sub-degree rotational impulse. Never use sustained random shake.

Route camera effects through `PlayerController`, not by directly mutating `camera.position`, because its frame update overwrites camera transforms. Add an additive impulse channel for position, rotation, and FOV offsets.

Reduced-motion mode should keep the flash, meter highlight, sound, and haptic while removing camera translation and rotation.

---

## 4. Level complete and night complete

### Current feedback

- Completing a night exits pointer lock and starts a 580 ms fade to black.
- After a 350 ms hold, the end-of-night summary appears.
- Summary rows rise in with a 70 ms stagger.
- Objective changes use the same three-note `nightChime()` as other announcements.
- The final ending waits 2.4 seconds, fades to black, swaps music, and displays static ending prose and stats.
- Daily completion also reuses `nightChime()` plus a toast and title-card state change.
- There is no unique level-complete haptic, victory flourish, final tally animation, or screen-level celebratory response.

The transition is elegant but emotionally flat. Because `nightChime()` also plays for routine objective changes, completion does not have its own identity.

### Suggested haptic pattern

- **Objective complete:** `.light` or `.success` only for meaningful milestones; avoid haptics for every objective refresh.
- **Night complete:** `UINotificationFeedbackGenerator.notificationOccurred(.success)` synchronized to the first completion visual, not after the summary is visible.
- **Final ending unlocked:** `.success`, followed 120–160 ms later by one `.soft` or `.medium` impact as the title settles.
- **Failure or banishment ending:** `.error` instead of success.

A success notification already has a refined multi-pulse character. Do not stack several heavy impacts on top of it.

### Sound cue

Create a dedicated completion hierarchy:

- **Objective complete:** a short two-note motif derived from the room key.
- **Night complete:** a three- or four-note resolved motif with a soft low-end arrival and 1.2–1.8 second tail.
- **Final ending:** adapt the motif to the ending:
  - Ascension: warm, open, consonant resolution.
  - Sellout: polished major chord with an unnerving detuned tail.
  - Purist: sparse acoustic or felt resolution.
  - Walked: unresolved chord opening into environmental ambience.

Before the completion sting, duck the current score by 4–6 dB over 120 ms. Let the sting lead into the new music rather than simply stopping one track and starting another.

Do not reuse `nightChime()` for routine objectives, daily completion, and level completion. These events need separate semantic cues.

### Animation and easing

Recommended night-complete sequence:

1. **0 ms:** freeze gameplay intent and fire the success haptic.
2. **0–120 ms:** the objective card emits a restrained gold or white completion sweep.
3. **80–300 ms:** the vignette softens and scene exposure lifts slightly.
4. **250–650 ms:** fade to black with an ease-in curve.
5. **650–850 ms:** hold briefly in darkness while the sting resolves.
6. **850–1150 ms:** raise the summary card 18–24 px and fade it in with `cubic-bezier(.16, 1, .3, 1)`.
7. **Rows:** reveal every 70–100 ms; count numeric deltas into place instead of displaying final values immediately.
8. **Final row:** settle the card with one tiny scale pulse and expose Continue only after tallying completes.

For the final ending:

- Reveal the ending title before the body.
- Stagger title → prose → stats → replay action.
- Count stats up over 500–800 ms.
- Give newly unlocked ending dots a one-time ring expansion and restrained sparkle or noise texture.
- Keep the camera still during prose. Premium restraint fits the game better than confetti.

---

## Cross-system recommendations

### Add a semantic feedback coordinator

Create one service with calls such as:

```js
feedback.tap('light');
feedback.selection();
feedback.score({ strength: 'medium', meter: 'fame' });
feedback.damage({ strength: 'heavy', direction: 'right' });
feedback.complete({ kind: 'night' });
```

It should coordinate haptics, SFX, UI animation, and camera impulses from one event. This prevents timing drift and inconsistent feedback across direct DOM handlers.

### Respect platform reality

This is currently a browser game and is explicitly detected as keyboard-and-mouse-oriented in `js/core/input.js`. Safari web content does not expose `UIImpactFeedbackGenerator` directly, and `navigator.vibrate()` is not a reliable iOS substitute.

For iOS-quality haptics, package the game in a native shell such as WKWebView or Capacitor and expose a small native bridge to:

- `UIImpactFeedbackGenerator`
- `UISelectionFeedbackGenerator`
- `UINotificationFeedbackGenerator`
- Optionally Core Haptics for authored patterns

The web layer should fail silently when the bridge is unavailable. Do not advertise vibration support based solely on browser detection.

### Separate SFX from music volume

There is currently one volume setting and master level. A premium mobile game should expose at least:

- Music
- Sound effects
- Haptics toggle

Dialogue or voice may be a fourth channel. Haptics must remain independently disableable.

### Standardize event hierarchy

Use four intensity tiers:

1. **Selection:** tiny visual, selection haptic, and quiet tick.
2. **Action:** pressed response, light impact, and short cue.
3. **Consequence:** score or damage animation, medium/heavy impact, and musical accent.
4. **Milestone:** screen transition, notification haptic, and authored sting.

Many current events collapse into `uiConfirm()`, `countered()`, or `nightChime()`.

### Keep latency extremely low

- Start visual compression on `pointerdown`, not only `click`.
- Fire haptic and the primary audio transient on successful activation in the same event turn.
- Target less than 30 ms perceived response.
- Prewarm native haptic generators and ensure the WebAudio context on the first eligible gesture.

---

## Recommended implementation priority

### P0 — largest improvement

1. Add a semantic haptic/native-bridge abstraction with a web no-op fallback.
2. Centralize button activation so dynamic controls receive consistent sound and tactile feedback.
3. Give damage and counter events an additive camera/UI recoil channel.
4. Split objective, night-complete, and final-ending sounds.

### P1 — premium polish

5. Animate meter numbers and show temporary deltas.
6. Promote painting quality to a dedicated score reveal.
7. Add press/release spring behavior using pointer events and coarse-pointer-safe CSS.
8. Stage night summaries and ending statistics instead of showing static values.

### P2 — tuning and accessibility

9. Add separate music, SFX, and haptics settings.
10. Define reduced-motion alternatives for every camera and screen response.
11. Add mild SFX pitch and texture variation to avoid procedural repetition.
12. Tune all effects on physical iPhone hardware; simulator and desktop browser testing cannot validate tactile timing.

## Success target

The game should feel premium when every important input answers within one frame, each consequence has a distinct tactile and audio signature, camera response reinforces rather than distracts, and milestone feedback is clearly more authored than routine UI feedback.

The goal is not more shake or more noise. It is **precise, semantic synchronization** across touch, sound, motion, and screen response.