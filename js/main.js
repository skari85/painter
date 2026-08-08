/**
 * main.js — boot, orchestration, and the game loop.

 *
 * Modes: title → playing ⇄ dialogue / easel / naming / codex / paused
 *        → nightSummary → … → ending
 *
 * Everything below the fold is wiring: game events in, intentions out.
 */

import * as THREE from 'three';

import { CAMERA, PLAYER, SWING, ZONES, MUSIC, MUSIC_TITLES } from './core/config.js';


import { GameState, loadSettings, saveSettings, loadEndings, unlockEnding } from './core/state.js';
import { InputManager, isTouchOnlyDevice } from './core/input.js';
import { AudioEngine } from './core/audio.js';

import { pick, chance } from './core/utils.js';


import { World } from './game/world.js';
import { PlayerController } from './game/player.js';
import { HandRig } from './game/hand.js';
import { PaintSystem } from './game/paint.js';
import { NPCManager } from './game/npc.js';
import { castForNight, MAINS } from './game/characters.js';
import { appraiseNPC, appraiseObject, makeScandal, makeReview, KREYO_MINTS, KREYO_SELF_MINTS } from './game/gags.js';
import { ArtiEngine } from './game/arti.js';
import { DialogueEngine } from './game/dialogue.js';
import { QuestDirector } from './game/quests.js';
import { DEAD_ARTISTS, SeanceSession } from './game/seance.js';
import { UIManager } from './ui/ui.js';


class Game {
  constructor() {
    this.mode = 'title';
    this.settings = loadSettings();
    this.state = new GameState();
    this.pendingAppraisal = null;   // painting waiting for Victoria's verdict
    this.#swingCooldown = 0;
    this.#stepAccum = 0;
    this.#shrineCooldown = 0;
    this.#t = 0;
  }

  #swingCooldown; #stepAccum; #shrineCooldown; #t;
  #raycaster = new THREE.Raycaster();
  #fwd = new THREE.Vector3();
  #nightSplats = 0;
  #mintCooldown = 0;
  #scandalTier = 0;

  /* ============================================================
     Boot
     ============================================================ */

  init() {
    const canvas = document.getElementById('gl');
    this.ui = new UIManager();

    if (isTouchOnlyDevice()) {
      this.ui.fatal('PAINTER: ASCENSION is a keyboard & mouse affair. Meet me on a laptop — the artworld demands it.');
      return;
    }

    // ---- renderer ----
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    } catch {
      this.ui.fatal('WebGL could not start. Your browser refused the canvas — fittingly avant-garde, but unplayable.');
      return;
    }
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0b0f);
    this.scene.fog = new THREE.FogExp2(0x0b0b0f, 0.03);

    this.camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far);
    this.scene.add(this.camera);   // hands are camera children — camera must be in-graph

    // ---- modules ----
    this.audio = new AudioEngine();
    this.input = new InputManager(canvas);

    this.world = new World(this.scene);
    this.player = new PlayerController(this.camera, this.input);
    this.hand = new HandRig(this.camera);
    this.paint = new PaintSystem();
    this.npcs = new NPCManager(this.world, this.audio);
    this.dialogue = new DialogueEngine(this.state);
    this.quests = new QuestDirector(this.state);
    this.arti = new ArtiEngine();

    this.#applySettings();
    this.#wireUI();
    this.#wireGameEvents();
    this.#resize();
    window.addEventListener('resize', () => this.#resize());

    this.ui.bindState(this.state);
    this.ui.renderEndingsStrip(loadEndings());
    this.world.setZone('garret');
    this.ui.setHotkeys('playing');
    this.paint.attachTo(this.world.zone().group);
    this.hand.setBrushColor(this.paint.color);
    this.hand.setReduceMotion(this.settings.reduceMotion);

    window.__painterBooted = true;
    this.audio.setMusic('title', MUSIC);   // fades in on the first user gesture
    this.renderer.setAnimationLoop((t) => this.#frame(t));
  }


  #resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const scale = this.settings.quality;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * scale);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  #applySettings() {
    const s = this.settings;
    this.audio.setVolume(s.vol);
    this.player.setFeel({ sens: s.sens, invertY: s.invertY, reduceMotion: s.reduceMotion });
    this.hand?.setReduceMotion(s.reduceMotion);
  }

  /* ============================================================
     UI wiring (menus, settings, buttons)
     ============================================================ */

  #wireUI() {
    const $ = (id) => document.getElementById(id);
    const click = (id, fn) => $(id).addEventListener('click', () => { this.audio.ensure(); this.audio.uiConfirm(); fn(); });

    click('btn-begin', () => this.#startRun());
    click('btn-howto', () => this.ui.show('howto'));
    click('howto-close', () => this.ui.hide('howto'));
    click('btn-settings', () => this.ui.show('settings'));
    click('settings-close', () => { this.ui.hide('settings'); saveSettings(this.settings); });
    click('pause-resume', () => this.#resume());
    click('pause-settings', () => this.ui.show('settings'));
    click('pause-quit', () => this.#quitToTitle());
    click('codex-close', () => {
      this.ui.closeCodex();
      if (this.mode === 'codex') {
        this.mode = this.#modeBeforeCodex;
        this.ui.setHotkeys(this.mode === 'dialogue' ? 'dialogue' : 'playing');
      }
    });
    click('map-close', () => this.#closeMap());
    click('arti-close', () => this.#closeArti());
    click('seance-leave', () => this.#closeSeance());



    click('ending-again', () => this.#startRun());

    // now-playing chip — the kill switch for the room's record
    this.ui.bindNowPlaying(() => {
      this.audio.uiConfirm();
      this.audio.setMusic(null);
    });

    this.ui.bindSettings(this.settings, (key) => {
      if (key === 'quality') this.#resize();
      this.#applySettings();
      saveSettings(this.settings);
    });

    // ---- global keys ----
    this.input.on('press:pause', () => this.#onEscape());
    this.input.on('press:map', () => this.#toggleMap());
    this.input.on('press:arti', () => this.#toggleArti());
    this.input.on('press:codex', () => this.#toggleCodex());

    this.input.on('press:interact', () => this.#onInteract());
    this.input.on('press:appraise', () => this.#onAppraise());
    this.input.on('press:swing', () => this.#onSwing());
    this.input.on('press:option1', () => this.#onOption(0));
    this.input.on('press:option2', () => this.#onOption(1));
    this.input.on('press:option3', () => this.#onOption(2));
    this.input.on('press:brushSmaller', () => { if (this.paint.isOpen) this.paint.adjustBrush(-1); });
    this.input.on('press:brushBigger', () => { if (this.paint.isOpen) this.paint.adjustBrush(1); });

    this.input.on('unlock', () => {
      // Esc during free play drops to the pause menu (Esc exits lock natively)
      if (this.mode === 'playing') this.#pause();
    });

    // clicking the canvas while playing (but unlocked) re-locks
    document.getElementById('gl').addEventListener('click', () => {
      if (this.mode === 'playing' && !this.input.locked) this.input.requestLock();
    });
  }

  /* ============================================================
     Game-event wiring
     ============================================================ */

  #wireGameEvents() {
    const ui = this.ui;

    this.quests.on('objective', ({ night, text }) => {
      ui.setObjective(night, text);
      ui.toast(night, text);
      this.audio.nightChime();
    });

    this.quests.on('nightComplete', () => {
      const night = this.state.night;
      this.mode = 'transition';            // set before exitLock: suppresses auto-pause
      this.input.exitLock();
      ui.transition(() => {
        this.mode = 'nightSummary';
        ui.showNightSummary(night, this.state.drainNightLog(), () => this.#startNight(night + 1));
      });
    });

    this.quests.on('finale', () => {
      setTimeout(() => this.#showEnding(), 2400);
    });


    // ---- dialogue engine → view ----
    this.dialogue.on('start', ({ npc, line, options, hint }) => {
      this.mode = 'dialogue';
      ui.setHotkeys('dialogue');
      this.player.setFrozen(true);
      this.input.exitLock();
      this.#interactTarget = null;
      ui.interactPrompt(null);
      ui.openDialogue({ name: npc.def.name, role: npc.def.role, hint, face: npc.def.face ?? null });
      ui.setEgo(npc.ego / npc.maxEgo);
      ui.setLine(line, { pitch: npc.def.pitch, audio: this.audio });
      ui.showOptions(options, (i) => this.#onOption(i));
    });

    this.dialogue.on('round', (r) => {
      ui.setLine(r.line, { pitch: r.npc.def.pitch, audio: this.audio });
      ui.setEgo(r.egoFrac);
      ui.showOptions(r.options, (i) => this.#onOption(i));
      this.hand.gesture(r.tone);
      if (r.resisted || r.healed) {
        ui.credPulse();
        this.audio.countered();
        this.#dmgAbove(r.npc, r.healed ? `+${-r.dmg} EGO` : 'RESISTED', 'resist');
      } else {
        this.audio.hitmarker(r.tone === 'brutal');
        ui.hitmarker(r.tone === 'brutal');
        this.#dmgAbove(r.npc, `-${r.dmg} EGO`, r.tone);
      }
    });

    const finalLine = (r, outcome) => {
      ui.setLine(r.line, { pitch: r.npc.def.pitch, audio: this.audio });
      ui.setEgo(0);
      ui.hideOptions();
      if (outcome === 'shatter') {
        this.audio.shatter();
        ui.hitmarker(true);
        this.#dmgAbove(r.npc, 'SHATTERED', 'brutal');
      }
      setTimeout(() => this.dialogue.end(), 2900);
    };
    this.dialogue.on('shatter', (r) => finalLine(r, 'shatter'));
    this.dialogue.on('dismiss', (r) => finalLine(r, 'dismiss'));
    this.dialogue.on('disarm', (r) => { this.audio.gasp(); finalLine(r, 'disarm'); });

    this.dialogue.on('custom', ({ action }) => {
      if (this.pendingAppraisal) {
        const { line } = this.quests.resolveAppraisal(action, this.pendingAppraisal.p);
        ui.toast('THE APPRAISAL', line);
        // The Pale Review files its copy before the wine is warm
        const p = this.pendingAppraisal.p;
        setTimeout(() => {
          ui.subtitle('THE PALE REVIEW', makeReview(p.title, p.quality), 0.8, this.audio);
          this.state.record(`The Pale Review on “${p.title}”`, null);
        }, 3400);
        this.pendingAppraisal = null;
        this.#syncCarry();
      }
    });

    this.dialogue.on('end', ({ npc, outcome }) => {
      ui.closeDialogue();
      this.hand.gesture(null);
      this.mode = 'playing';
      ui.setHotkeys('playing');
      this.player.setFrozen(false);
      this.input.requestLock();


      if (outcome === 'shatter') {
        const exit = this.world.zone().spawn;
        npc.meltdown(exit);
        this.audio.gasp();
        this.state.record(`${npc.def.name} left in pieces`, null);
      }
      this.quests.notify('duelEnded', { id: npc.def.id, outcome });
      this.arti.onDuelEnd(npc.def.id, outcome);
    });

    // ---- ambient barks → subtitles ----
    this.npcs.on('bark', ({ name, text, pitch }) => ui.subtitle(name, text, pitch, this.audio));

    // ---- ARTI — the app is watching, and now it buzzes ----
    ui.setArtiRoster(Object.values(MAINS).map((m) => ({ id: m.id, name: m.name, face: m.face ?? null })));
    this.arti.on('viral', ({ title, likes }) => {
      this.state.addMeter('fame', 1, 'Viral, art-world scale');
      ui.toast('ARTI', `“${title}” hit ${likes} likes. Viral, art-world scale.`, 'good');
    });
    this.arti.on('notify', ({ kicker, body, cls }) => ui.toast(kicker, body, cls));
    this.arti.on('buzz', () => { this.audio.buzz(); ui.artiBuzz(); });
    this.arti.on('change', () => {
      ui.updateArtiChip(this.arti.followers);
      if (this.mode === 'arti') this.ui.renderArti(this.arti);
    });

    // ---- paint system ----
    this.paint.on('color', (hex) => this.hand.setBrushColor(hex));
    this.paint.on('closed', () => this.#exitEasel());

    this.paint.on('finished', ({ texture, quality }) => {
      this.mode = 'naming';
      ui.setHotkeys('naming');
      const n = this.state.paintings.length + 1;
      ui.openNaming(`Untitled Nº ${n}`, (title) => {
        const p = { id: `p${Date.now()}`, title, texture, quality, sold: false };
        this.state.addPainting(p);
        this.state.carrying = p.id;
        this.#syncCarry();
        // the easel keeps a ghost of your last work
        const ec = this.world.zone('garret').easelCanvas;
        ec.material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85 });
        this.quests.notify('paintingFinished', { quality });
        this.arti.postPainting(title, quality);
        ui.toast('SIGNED', `“${title}” — quality ${quality}. Under your arm it goes.`, 'good');
        this.audio.pickup();
        this.mode = 'playing';
        ui.setHotkeys('playing');
        this.input.requestLock();
        if (this.quests.currentStep?.id === 'hang') {
          this.ui.hint('Press M — the map knows the way to the Bianca. Or walk: the door glows.');
          setTimeout(() => this.ui.hint(null), 9000);
        }
      });
    });


    // ---- heat → banishment (and the tabloids) ----
    this.state.on('meter', ({ key, value, delta, reason }) => {
      if (key !== 'heat') return;
      if (value >= SWING.banThreshold && this.world.current === 'galleria') {
        this.#banish();
        return;
      }
      if (delta > 0) this.#maybeScandal(value, reason);
    });
  }

  /* ============================================================
     Run / night lifecycle
     ============================================================ */

  #startRun() {
    this.ui.hide('ending');
    this.ui.hide('title-screen');
    this.state.reset();
    this.arti.reset();
    this.ui.updateArtiChip(this.arti.followers);
    this.ui.clearArtiUnread();
    this.npcs.clear();
    this.world.clearSplats();
    this.world.clearDisplay();
    this.pendingAppraisal = null;
    const ec = this.world.zone('garret').easelCanvas;
    ec.material = new THREE.MeshStandardMaterial({ color: 0xefe9dc, roughness: 0.85 });
    this.#startNight(1);
  }

  #startNight(n) {
    this.state.night = n;
    this.state.addMeter('heat', -100, '');   // a new night, a clean slate
    this.#nightSplats = 0;
    this.#mintCooldown = 0;
    this.#scandalTier = 0;
    this.npcs.clear();
    const cast = castForNight(n);
    for (const [zone, defs] of Object.entries(cast)) this.npcs.spawn(defs, zone);

    const z = this.world.setZone('garret');
    this.paint.attachTo(z.group);
    this.#applyZoneAtmosphere('garret');
    this.player.teleport(z.spawn.x, z.spawn.z, z.spawnYaw);

    this.mode = 'playing';
    this.ui.show('hud');
    this.ui.setHotkeys('playing');
    this.ui.hint('WASD · E use · LMB brush · Q appraise · N arti · M map · Tab virtues');

    setTimeout(() => this.ui.hint(null), 9000);
    this.quests.startNight(n);
    this.input.requestLock();
  }

  #quitToTitle() {
    this.ui.hide('pause');
    this.ui.hide('hud');
    this.ui.show('title-screen');
    this.ui.renderEndingsStrip(loadEndings());
    this.mode = 'title';
    this.ui.hideHotkeys();
    this.audio.setMood('off');
    this.audio.setMusic('title', MUSIC);
    this.input.exitLock();
  }


  #showEnding() {
    const key = this.quests.computeEnding();
    unlockEnding(key);
    this.mode = 'transition';              // suppress auto-pause on unlock
    this.input.exitLock();
    this.audio.setMood('off');
    this.audio.setMusic('ending', MUSIC);

    this.ui.transition(() => {

      this.ui.hide('hud');
      this.ui.hideHotkeys();
      this.ui.showEnding(key, this.state);
      this.mode = 'ending';
    });
  }

  #banish() {
    this.audio.banSting();
    this.ui.toast('BANNED', 'Victoria snaps her fingers. Security is a concept, and the concept escorts you out.', 'bad');
    this.state.addMeter('heat', -60, 'You were carried out, artistically');
    this.state.addMeter('fame', -5, 'The scene pretends not to know you');
    this.state.shiftVirtue('humility', 3, 'The sidewalk: a great teacher');
    this.state.record('Banned from the Bianca mid-opening', null);
    this.#travelTo('garret');
  }

  /* ============================================================
     Input verbs
     ============================================================ */

  #onEscape() {
    switch (this.mode) {
      case 'playing': this.#pause(); break;
      case 'paused': this.#resume(); break;
      case 'easel':
        this.#exitEasel();
        break;

      case 'map':
        this.#closeMap();
        break;
      case 'arti':
        this.#closeArti();
        break;
      case 'seance':
        this.#closeSeance();
        break;


      case 'codex':
        this.ui.closeCodex();
        this.mode = this.#modeBeforeCodex;
        this.ui.setHotkeys(this.mode === 'dialogue' ? 'dialogue' : 'playing');
        break;

      case 'dialogue': break;   // you finish what you started
      default: break;
    }
  }

  #pause() {
    if (this.mode !== 'playing') return;
    this.mode = 'paused';
    this.ui.setHotkeys('paused');
    this.input.exitLock();
    this.ui.show('pause');
  }

  #resume() {
    this.ui.hide('pause');
    this.ui.hide('settings');
    saveSettings(this.settings);
    this.mode = 'playing';
    this.ui.setHotkeys('playing');
    this.input.requestLock();
  }

  #modeBeforeCodex = 'playing';
  #toggleCodex() {
    if (!['playing', 'dialogue', 'codex'].includes(this.mode)) return;
    if (this.mode === 'codex') {
      this.ui.closeCodex();
      this.mode = this.#modeBeforeCodex;
      this.ui.setHotkeys(this.mode === 'dialogue' ? 'dialogue' : 'playing');
    } else {
      this.#modeBeforeCodex = this.mode;
      this.mode = 'codex';
      this.ui.setHotkeys('codex');
      this.ui.openCodex(this.state);
    }
  }

  #exitEasel() {
    if (this.mode !== 'easel') return;
    this.paint.close();
    this.player.setFrozen(false);
    this.mode = 'playing';
    this.ui.setHotkeys('playing');
    this.input.requestLock();
  }

  /* ---- the map ---- */

  #toggleMap() {
    if (this.mode === 'playing') this.#openMap();
    else if (this.mode === 'map') this.#closeMap();
  }

  #openMap() {
    this.mode = 'map';                     // set before exitLock: suppresses auto-pause
    this.player.setFrozen(true);
    this.ui.interactPrompt(null);
    this.input.exitLock();
    this.ui.openMap(
      { current: this.world.current, vaultOpen: this.state.getFlag('vaultOpen') },
      (zone) => this.#mapTravel(zone)
    );
    this.audio.uiMove();
  }

  #closeMap() {
    this.ui.closeMap();
    this.player.setFrozen(false);
    this.mode = 'playing';
    this.ui.setHotkeys('playing');
    this.input.requestLock();
  }

  #mapTravel(zone) {
    this.ui.closeMap();
    this.player.setFrozen(false);
    this.mode = 'playing';
    this.ui.setHotkeys('playing');
    if (zone !== this.world.current) this.#travelTo(zone);
    this.input.requestLock();
  }

  /* ---- the séance ---- */

  #seance = null;

  #openSeance() {
    this.mode = 'seance';                  // before exitLock: suppresses auto-pause
    this.ui.setHotkeys('seance');
    this.player.setFrozen(true);
    this.ui.interactPrompt(null);
    this.input.exitLock();
    this.#seance = null;
    this.audio.spirit();
    this.ui.openSeance(DEAD_ARTISTS, {
      onPick: (artist) => {
        this.#seance = new SeanceSession(artist);
        this.audio.spirit();
        this.ui.seanceLine(this.#seance.greet(), artist);
      },
      onAsk: () => {
        if (!this.#seance) return;
        this.audio.spirit();
        this.ui.seanceLine(this.#seance.ask(), this.#seance.artist);
        if (this.#seance.blessingDue) {
          this.state.shiftVirtue('vision', 2, 'The dead approve');
          this.state.addMeter('soul', 2, 'A blessing from the old masters');
          this.ui.toast('THE DEAD APPROVE', 'Something old and kind settles on your shoulders.', 'good');
        }
      },
    });
  }

  #closeSeance() {
    this.ui.closeSeance();
    this.#seance = null;
    this.player.setFrozen(false);
    this.mode = 'playing';
    this.ui.setHotkeys('playing');
    this.input.requestLock();
  }

  /* ---- ARTI ---- */

  #toggleArti() {
    if (this.mode === 'playing') this.#openArti();
    else if (this.mode === 'arti') this.#closeArti();
  }

  #openArti() {
    this.mode = 'arti';                    // before exitLock: suppresses auto-pause
    this.ui.setHotkeys('arti');
    this.player.setFrozen(true);
    this.ui.interactPrompt(null);
    this.input.exitLock();
    this.ui.openArti(this.arti, {
      onFollowBack: () => this.arti.followBack(),
      onBoost: () => this.#boostPost(),
      onToggleFollow: (id) => this.arti.toggleFollow(id),
    });
    this.audio.uiMove();
  }

  #closeArti() {
    this.ui.closeArti();
    this.player.setFrozen(false);
    this.mode = 'playing';
    this.ui.setHotkeys('playing');
    this.input.requestLock();
  }

  #boostPost() {
    if (this.state.meters.cash < 5) {
      this.ui.toast('ARTI', 'Insufficient funds. The algorithm pities you.', 'bad');
      this.audio.countered();
      return;
    }
    this.state.addMeter('cash', -5, 'Boosted a post');
    this.state.addMeter('soul', -1, 'The algorithm noticed your money');
    this.arti.boost();
    this.audio.register();
  }



  #onOption(i) {

    if (this.mode !== 'dialogue') return;
    if (this.ui.isTyping) { this.ui.completeLine(); return; }
    this.audio.uiMove();
    this.dialogue.choose(i);
  }

  #onSwing() {
    if (this.mode !== 'playing' || !this.input.locked) return;
    if (this.#swingCooldown > 0) return;
    this.#swingCooldown = SWING.cooldown;
    this.hand.swing();
    this.audio.swing();

    // impact lands mid-animation
    setTimeout(() => {
      if (this.mode !== 'playing') return;
      const fwd = this.player.forwardDir(this.#fwd);
      const victim = this.npcs.inArc(this.player.position, fwd, SWING.range, SWING.arcDot);
      if (victim) {
        this.paint.splatOnNPC(victim);
        victim.stagger(fwd);
        this.audio.splat();
        this.audio.gasp();
        this.ui.hitmarker(false);
        this.state.stats.splats++;
        this.#nightSplats++;
        this.#maybeSponsor();
        if (this.state.night >= 2 && victim.def.id === 'kreyo') {
          this.ui.toast('KREYO.ETH', pick(KREYO_SELF_MINTS), 'bad');
        }
        this.state.addMeter('heat', SWING.heatOnNPC, `Painted on ${victim.def.name}`);
        this.state.shiftVirtue('compassion', -1, '');
        this.ui.toast('ASSAULT WITH PIGMENT', `${victim.def.name} is furious. The outfit was “irreplaceable”.`, 'bad');
        this.quests.notify('npcSplatted', { id: victim.def.id });
        this.arti.onSplatted(victim.def.id);
        return;
      }

      // walls & floors drink the paint
      this.#raycaster.set(this.camera.position, this.camera.getWorldDirection(this.#fwd));
      this.#raycaster.far = SWING.range + 0.6;
      const hit = this.paint.splatFromRay(this.#raycaster, this.world);
      if (hit) {
        this.audio.splat();
        this.state.stats.splats++;
        this.#nightSplats++;
        this.#maybeSponsor();
        if (this.world.current !== 'garret') {
          this.state.addMeter('heat', 2, 'The walls were white. Were.');
        }
        this.#maybeKreyoMint();
      }
    }, 190);
  }

  /* ---- Q: the market has opinions about everything ---- */

  #onAppraise() {
    if (this.mode !== 'playing' || !this.input.locked) return;
    const fwd = this.player.forwardDir(this.#fwd);
    const npc = this.npcs.nearest(this.player.position, fwd, 4.2);
    if (npc) {
      this.ui.toast('THE APPRAISAL', appraiseNPC(npc.def.id, npc.def.name));
      this.audio.uiMove();
      return;
    }
    this.#raycaster.set(this.camera.position, this.camera.getWorldDirection(this.#fwd));
    this.#raycaster.far = 5.5;
    const hits = this.#raycaster.intersectObjects(this.world.zone().group.children, true);
    const hit = hits.find((h) => h.object.visible);
    this.ui.toast('THE APPRAISAL', appraiseObject(hit?.object?.name ?? ''));
    this.audio.uiMove();
  }

  /* ---- the tabloids, the sponsors, the blockchain ---- */

  #maybeScandal(value, reason) {
    const TIERS = [30, 60, 85];
    while (this.#scandalTier < TIERS.length && value >= TIERS[this.#scandalTier]) {
      this.#scandalTier++;
      this.ui.scandal(makeScandal(reason));
      this.audio.scandal();
      this.arti.onScandal();
    }
  }

  #maybeSponsor() {
    if (this.#nightSplats !== 3) return;   // exactly three: the brand threshold
    this.audio.register();
    this.ui.showSponsor();
    this.ui.toast('SPONSORED CONTENT', 'This act of rebellion is brought to you by VERVE Energy. TASTE THE UPRISING™.', 'good');
    this.state.addMeter('cash', 15, 'VERVE Energy sponsorship');
    this.state.addMeter('soul', -4, 'Official energy of the avant-garde');
  }

  #maybeKreyoMint() {
    if (this.state.night < 2 || this.world.current !== 'galleria') return;
    if (this.#mintCooldown > 0) return;
    const kreyo = this.npcs.byId('kreyo');
    if (!kreyo || kreyo.dead) return;
    if (!chance(0.55)) return;
    this.#mintCooldown = 20;
    this.ui.toast('KREYO.ETH', pick(KREYO_MINTS), 'bad');
    this.state.addMeter('fame', 1, 'Minted without consent');
    this.arti.onMinted();
  }

  #interactTarget = null;

  #onInteract() {
    if (this.mode !== 'playing' || !this.#interactTarget) return;
    const t = this.#interactTarget;

    if (t.kind === 'npc') {
      this.#talkTo(t.npc);
      return;
    }

    const it = t.item;
    switch (it.type) {
      case 'door': {
        if (it.lockedUnlessFlag && !this.state.getFlag(it.lockedUnlessFlag)) {
          this.ui.toast('LOCKED', it.lockedLabel, 'bad');
          this.audio.countered();
          return;
        }
        this.#travelTo(it.to);
        break;
      }
      case 'easel':
        this.mode = 'easel';
        this.ui.setHotkeys('easel');
        this.player.setFrozen(true);       // feet freeze; the world keeps breathing
        this.ui.interactPrompt(null);
        this.input.exitLock();
        this.paint.open();
        break;

      case 'bed':
        if (this.quests.bedArmed) {
          this.quests.notify('bedUsed');
        } else {
          this.ui.toast('WIRED', 'Too much night left in you. Finish what the night demands.');
        }
        break;
      case 'shrine':
        if (this.#shrineCooldown <= 0) {
          this.#shrineCooldown = 25;
          this.state.addMeter('soul', 3, 'You remembered why you paint');
          this.state.shiftVirtue('humility', 2, '');
          this.state.shiftVirtue('vision', 1, '');
          this.ui.toast('THE SHRINE', pick([
            'Your old work. Nobody wanted it. It is the best thing you own.',
            'A candle for every rejection. The room is warm.',
            'You painted these before anyone was looking. They hold up.',
          ]), 'good');
          this.audio.nightChime();
        } else {
          this.ui.toast('THE SHRINE', 'The candles are thinking. Give them a moment.');
        }
        break;
      case 'flavor':
        this.ui.toast('THE DESK', pick(it.lines));
        this.audio.uiMove();
        break;
      case 'map':
        this.#openMap();
        break;
      case 'seance':
        this.#openSeance();
        break;



      case 'giftshop': {
        const latest = this.state.paintings[this.state.paintings.length - 1];
        if (!latest) {
          this.ui.toast('THE GIFT SHOP', 'The rack is all KREYO tote bags. Your turn will come. (It will not.)');
          this.audio.countered();
          break;
        }
        const PRICE = 40;
        if (this.state.meters.cash < PRICE) {
          this.ui.toast('THE GIFT SHOP', `“${latest.title}” posters: $39.99. You have $${Math.floor(this.state.meters.cash)}. The gift shop accepts cards, tears, and exposure.`, 'bad');
          this.audio.countered();
          break;
        }
        this.state.addMeter('cash', -PRICE, 'Bought your own poster');
        this.state.addMeter('cash', 0.02, 'Royalty statement (enclosed)');
        this.state.addMeter('soul', -2, 'You own yourself now, retail');
        this.state.shiftVirtue('humility', -1, '');
        this.world.hangPoster(latest.texture);
        this.audio.register();
        this.ui.toast('THE GIFT SHOP', `One “${latest.title}” poster — $39.99. Royalty: $0.02. It hangs in the garret now, slightly crooked, forever.`, 'good');
        break;
      }
      case 'display': {
        const carried = this.state.getPainting(this.state.carrying);
        if (!carried) {
          this.ui.toast('EMPTY HANDS', 'Your wall waits. Bring something finished from the garret.');
          return;
        }
        this.world.hangOnDisplay(carried.texture, carried.title);
        this.pendingAppraisal = { p: carried };
        this.state.carrying = null;
        this.#syncCarry();
        this.audio.pickup();
        this.ui.toast('ON THE WALL', `“${carried.title}” hangs at Galleria Bianca. Victoria has been notified. She smelled it, probably.`, 'good');
        this.quests.notify('paintingHung', {});
        break;
      }
    }
  }

  #talkTo(npc) {
    // Victoria runs the appraisal script when a fresh piece hangs
    if (npc.def.id === 'victoria' && this.pendingAppraisal) {
      const script = this.quests.appraisalScript(this.pendingAppraisal.p, this.state.meters.fame);
      this.dialogue.start(npc, script);
      return;
    }
    this.dialogue.start(npc);
  }

  #travelTo(zoneKey) {
    this.audio.uiConfirm();
    this.ui.transition(() => {

      const z = this.world.setZone(zoneKey);
      this.paint.attachTo(z.group);
      this.#applyZoneAtmosphere(zoneKey);
      this.player.teleport(z.spawn.x, z.spawn.z, z.spawnYaw);
      this.ui.toast(ZONES[zoneKey].name, pick({
        garret: 'Home. It smells like turpentine and unresolved feelings.',
        galleria: 'The white cube hums. Somewhere, wine is being swirled menacingly.',
        vault: 'Cold air, gold light. The cages are listening.',
        collectorHome: 'The door opens on a private party. Someone is wearing only underwear and a hat.',
      }[zoneKey]));
      this.quests.notify('zoneEntered', { zone: zoneKey });
    });
  }

  #applyZoneAtmosphere(zoneKey) {
    const z = this.world.zone(zoneKey);
    this.scene.fog.color.set(z.fog.color);
    this.scene.fog.density = z.fog.density;
    this.scene.background.set(z.fog.color);
    // the garret gets the record player; market spaces get the drone
    if (zoneKey === 'garret') {
      this.audio.setMood('off');
      this.audio.setMusic('garret', MUSIC);
    } else {
      this.audio.setMusic(null);
      this.audio.setMood(ZONES[zoneKey].mood);
    }
  }



  #syncCarry() {
    const p = this.state.getPainting(this.state.carrying);
    this.hand.setCarry(p ? p.texture : null);
    this.ui.setCarrying(p ? p.title : null);
  }

  #dmgAbove(npc, text, cls) {
    const v = npc.group.position.clone();
    v.y = 2.15;
    v.project(this.camera);
    if (v.z > 1) return;
    const x = (v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
    this.ui.damageNumber(x, y, text, cls);
  }

  /* ============================================================
     The loop
     ============================================================ */

  #frame(tms) {
    const now = tms / 1000;
    const dt = Math.min(now - (this.#t || now), 0.05);
    this.#t = now;

    // the world simulates in every in-run mode; only the player's body freezes
    const playing = ['playing', 'dialogue', 'codex', 'easel', 'naming', 'map', 'seance', 'arti'].includes(this.mode);




    if (playing) {
      this.#swingCooldown = Math.max(0, this.#swingCooldown - dt);
      this.#shrineCooldown = Math.max(0, this.#shrineCooldown - dt);
      this.#mintCooldown = Math.max(0, this.#mintCooldown - dt);

      const moving = this.player.update(dt, this.world.colliders());

      this.npcs.update(dt, now, this.player.position);
      this.world.update(dt, now);
      this.paint.update(dt);
      this.hand.update(dt, { moving, sprinting: this.player.sprinting });
      this.arti.update(dt);

      // footsteps
      if (moving) {
        this.#stepAccum += dt * (this.player.sprinting ? 5.6 : 4.1);
        if (this.#stepAccum > 2.1) { this.#stepAccum = 0; this.audio.footstep(); }
      }

      // heat bleeds off slowly — scandal is perishable
      if (this.state.meters.heat > 0) {
        this.state.addMeter('heat', -SWING.heatDecayPerSec * dt, '');
      }

      this.#updateInteractPrompt();
    }

    // the chip: whatever the room's record is playing
    this.ui.setNowPlaying(MUSIC_TITLES[this.audio.musicKey] ?? null);

    this.renderer.render(this.scene, this.camera);
  }

  #updateInteractPrompt() {
    if (this.mode !== 'playing') { this.ui.interactPrompt(null); return; }
    const fwd = this.player.forwardDir(this.#fwd);

    const npc = this.npcs.nearest(this.player.position, fwd, PLAYER.interactRange);
    if (npc) {
      const label = npc.def.id === 'victoria' && this.pendingAppraisal
        ? `Face the appraisal — ${npc.def.name}`
        : `Talk — ${npc.def.name}`;
      this.#interactTarget = { kind: 'npc', npc };
      this.ui.interactPrompt(label);
      return;
    }

    let best = null, bestD = Infinity;
    for (const it of this.world.interactables()) {
      const d = it.pos.distanceTo(this.player.position);
      if (d < it.radius && d < bestD) { bestD = d; best = it; }
    }
    if (best) {
      this.#interactTarget = { kind: 'item', item: best };
      this.ui.interactPrompt(best.label);
    } else {
      this.#interactTarget = null;
      this.ui.interactPrompt(null);
    }
  }
}

/* ============================================================
   Boot guard — module/CDN/WebGL failures land softly
   ============================================================ */

try {
  const game = new Game();
  game.init();
  window.__painter = game;   // console access for the curious
} catch (err) {
  console.error(err);
  const fatal = document.getElementById('fatal');
  const text = document.getElementById('fatal-text');
  if (fatal && text) {
    text.textContent = `Something broke on the way to the opening: ${err.message}`;
    fatal.classList.remove('hidden');
  }
}
