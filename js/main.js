/**
 * main.js — boot, orchestration, and the game loop.

 *
 * Modes: title → onboarding → playing ⇄ dialogue / easel / naming / codex / paused
 *        → nightSummary → … → ending
 *
 * Everything below the fold is wiring: game events in, intentions out.
 */

import * as THREE from 'three';
import { inject } from '@vercel/analytics';

import { CAMERA, PLAYER, SWING, ZONES, MUSIC, MUSIC_TITLES, DAILY_PHENOMENA } from './core/config.js';

inject();


import { GameState, loadSettings, saveSettings, loadEndings, unlockEnding, dayStamp, registerVisit, recordCowVisit, dailyComplete, completeDaily, loadRun, saveRun, clearRun } from './core/state.js';
import { InputManager, isTouchOnlyDevice } from './core/input.js';
import { AudioEngine } from './core/audio.js';
import { Ghostwriter } from './core/ai.js';

import { pick, chance, rand } from './core/utils.js';


import { World } from './game/world.js';
import { PlayerController } from './game/player.js';
import { HandRig } from './game/hand.js';
import { PaintSystem } from './game/paint.js';
import { NPCManager } from './game/npc.js';
import { GhostManager } from './game/ghosts.js';
import { GhostRecorder } from './game/ghostRecorder.js';
import { castForNight, MAINS } from './game/characters.js';
import { appraiseNPC, appraiseObject, makeScandal, makeReview, KREYO_MINTS, KREYO_SELF_MINTS } from './game/gags.js';
import { ArtiEngine, COLLECTOR_CALL } from './game/arti.js';
import { DialogueEngine } from './game/dialogue.js';
import { ChatterEngine } from './game/chatter.js';
import { DebateEngine } from './game/debate.js';
import { clueReveal, endingCallback, lotNumberFor, transitionLine } from './game/narrative.js';

import { QuestDirector } from './game/quests.js';
import { DEAD_ARTISTS, SeanceSession } from './game/seance.js';
import { UIManager } from './ui/ui.js';


class Game {
  constructor() {
    this.mode = 'title';
    this.settings = loadSettings();
    this.state = new GameState();
    this.#dailyStamp = dayStamp();
    this.#meta = registerVisit() ?? { lastVisit: '', streak: 1, visits: 1, cowVisits: 0, completedDays: [] };
    let dailyHash = 0;
    for (const char of this.#dailyStamp) dailyHash = ((dailyHash << 5) - dailyHash + char.charCodeAt(0)) | 0;
    this.#daily = DAILY_PHENOMENA[Math.abs(dailyHash) % DAILY_PHENOMENA.length] ?? DAILY_PHENOMENA[0];
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
  #cowBubbleTimer = 0;
  #cowBubbleUrls = [];
  #daily = DAILY_PHENOMENA[0];
  #dailyProgress = 0;
  #dailyStamp = '';
  #meta = null;
  #cowVisitedThisRun = false;
  #callRound = 0;
  #callUnhappy = 0;
  #recordKey = null;
  #runActive = false;
  #saveTimer = 0;
  #savedRun = null;

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
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

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
    this.ghosts = new GhostManager(this.world);
    this.ghostRecorder = new GhostRecorder();
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
    this.#savedRun = loadRun();
    this.ui.setResumeRun(this.#savedRun);
    window.addEventListener('beforeunload', () => this.#persistRun());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.#persistRun();
    });
    this.world.setZone('garret');
    this.ghostRecorder.onZoneChange('garret');
    this.ghosts.loadZone('garret');
    this.ui.setHotkeys('playing');
    this.paint.attachTo(this.world.zone().group);
    this.hand.setBrushColor(this.paint.color);
    this.hand.setReduceMotion(this.settings.reduceMotion);
    this.ui.setDailyCard({
      title: this.#daily.title,
      description: this.#daily.desc,
      progress: dailyComplete(this.#dailyStamp)
        ? `COMPLETED · ${this.#meta.streak} DAY STREAK`
        : `0 / ${this.#daily.goal} — ${this.#meta.streak} DAY STREAK`,
      complete: dailyComplete(this.#dailyStamp),
    });

    this.#cowBubbleTimer = rand(3, 6);
    this.#cowBubbleUrls = [
      'puplic/visual assets/artworld nonsense bubbles/01-curator-soup.png',
      'puplic/visual assets/artworld nonsense bubbles/02-tuesdays.png',
      'puplic/visual assets/artworld nonsense bubbles/03-rumor-concrete.png',
      'puplic/visual assets/artworld nonsense bubbles/04-grant.png',
      'puplic/visual assets/artworld nonsense bubbles/05-midnight.png',
      'puplic/visual assets/artworld nonsense bubbles/06-unionized-brush.png',
      'puplic/visual assets/artworld nonsense bubbles/07-wall-text.png',
      'puplic/visual assets/artworld nonsense bubbles/08-smaller-problem.png',
      'puplic/visual assets/artworld nonsense bubbles/09-invoice.png',
      'puplic/visual assets/artworld nonsense bubbles/10-feelings.png',
    ];

    window.__painterBooted = true;
    this.audio.setMusic('title', MUSIC);   // fades in on the first user gesture
    this.renderer.setAnimationLoop((t) => this.#frame(t));
  }


  #resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const scale = this.settings.quality;
    // BARBIE DEATH METAL deliberately carries the heaviest lighting/material
    // budget. Cap its internal resolution so the concert stays responsive on
    // high-DPI screens without lowering quality in every other room.
    const pixelCap = this.world?.current === 'deathMetal' ? 1.15 : 2;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelCap) * scale);
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

    click('btn-begin', () => this.#startOnboarding());
    click('btn-resume', () => this.#resumeRun());
    click('btn-howto', () => this.ui.show('howto'));
    click('howto-close', () => this.ui.hide('howto'));
    click('btn-settings', () => this.ui.show('settings'));
    click('settings-close', () => { this.ui.hide('settings'); saveSettings(this.settings); });
    click('btn-privacy', () => this.ui.show('privacy'));
    click('privacy-close', () => this.ui.hide('privacy'));
    click('btn-terms', () => this.ui.show('terms'));
    click('terms-close', () => this.ui.hide('terms'));
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
    click('call-end', () => this.#closeCollectorCall());
    click('seance-leave', () => this.#closeSeance());



    click('ending-again', () => this.#startRun());

    // now-playing chip — the kill switch for the room's record
    this.ui.bindNowPlaying(() => {
      this.audio.ensure();
      this.audio.uiConfirm();
      this.#playNextRecord();
    }, () => {
      this.audio.uiConfirm();
      this.#recordKey = null;
      this.audio.setMusic(null);
      this.world.setRecordPlayerState(null);
      if (this.world.current) this.#applyZoneAtmosphere(this.world.current);
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

    this.state.on('change', () => this.#persistRun());

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
        if (r.npc.def.meltdownStyle === 'fire') this.audio.forestIgnite();
        ui.hitmarker(true);
        this.#dmgAbove(r.npc, 'SHATTERED', 'brutal');
      }
      setTimeout(() => this.dialogue.end(), 2900);
    };
    this.dialogue.on('shatter', (r) => finalLine(r, 'shatter'));
    this.dialogue.on('dismiss', (r) => finalLine(r, 'dismiss'));
    this.dialogue.on('disarm', (r) => { this.audio.gasp(); finalLine(r, 'disarm'); });

    this.dialogue.on('custom', ({ npc, action }) => {
      if (action.startsWith('drug:')) {
        this.#resolveDrugAction(action);
        return;
      }
      // MAX PRO — the player has taken a position. It will be forgotten by no one.
      if (action === 'maxpro:a' || action === 'maxpro:b') {
        const side = action === 'maxpro:a' ? 'a' : 'b';
        const r = this.debate.registerChoice(npc, side, this.#maxProReactions);
        this.#maxProReactions = null;
        ui.toast('ARTISTIC POSITION', r.capped
          ? 'You are the wall now. The wall needs more space.'
          : `Your position is now: ${r.title}. It changes nothing. It is noted everywhere.`);
        this.state.record(`Declared a position: ${r.title}`, null);
        // the debater's dry reply lands a beat after the panel closes
        setTimeout(() => ui.subtitle(npc.def.name, r.reaction, npc.def.pitch, this.audio), 700);
        return;
      }
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
    this.npcs.on('fartPrank', ({ name, victim }) => {
      ui.subtitle(name, `OH SORRY, BUT IT WASN'T ME. (${victim} IS MAKING ACCUSATIONS.)`, 0.64, this.audio);
    });

    // ---- the ghostwriter: AI party chatter, when the key is in the room ----
    this.ai = new Ghostwriter();
    this.chatter = new ChatterEngine(this.ai, this.state);
    this.chatter.on('line', ({ name, text, pitch }) => ui.subtitle(name, text, pitch, this.audio));
    void this.ai.init();

    // ---- MAX PRO: the argument that never ends, scripted and proud of it ----
    this.debate = new DebateEngine(this.npcs, this.state);
    this.debate.on('line', ({ name, text, pitch }) => ui.subtitle(name, text, pitch, this.audio));


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
        const p = {
          id: `p${Date.now()}`, title, texture, quality, sold: false,
          lotNumber: lotNumberFor(n), storyTags: [], artData: this.paint.artworkSnapshot(),
        };
        this.state.addPainting(p);
        this.state.carrying = p.id;
        this.#syncCarry();
        // the easel keeps a ghost of your last work
        const ec = this.world.zone('garret').easelCanvas;
        ec.material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85 });
        this.quests.notify('paintingFinished', { quality });
        this.#advanceDaily('paint');
        this.arti.postPainting(title, quality);
        ui.toast('SIGNED', `“${title}” — quality ${quality}. Under your arm it goes.`, 'good');
        this.audio.pickup();
        // Finishing the easel bypasses #exitEasel, so explicitly give the
        // player's feet back as soon as the title is confirmed.
        this.player.setFrozen(false);
        this.input.releaseAll();
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

  #startOnboarding() {
    if (this.mode !== 'title' && this.mode !== 'ending') return;
    this.mode = 'onboarding';
    this.audio.ensure();
    this.audio.uiConfirm();
    this.ui.hide('ending');
    this.ui.hide('title-screen');
    this.ui.hideHotkeys();
    this.ui.openOnboarding(() => this.#startRun());
  }

  #startRun() {
    this.ui.hide('ending');
    this.ui.hide('title-screen');
    this.#runActive = false;
    clearRun();
    this.#savedRun = null;
    this.ui.setResumeRun(null);
    this.state.reset();
    this.arti.reset();
    this.ui.updateArtiChip(this.arti.followers);
    this.ui.clearArtiUnread();
    this.npcs.clear();
    this.world.clearSplats();
    this.world.clearDisplay();
    this.world.setVaultArchive('THE ARTIST', 'A-01');
    this.world.resetForestChurches();
    this.world.resetRageRoom();
    this.pendingAppraisal = null;
    this.#dailyProgress = 0;
    this.#cowVisitedThisRun = false;
    this.ui.toast(this.#daily.title, this.#daily.desc);
    const ec = this.world.zone('garret').easelCanvas;
    ec.material = new THREE.MeshStandardMaterial({ color: 0xefe9dc, roughness: 0.85 });
    this.#startNight(1);
  }

  #resumeRun() {
    const saved = loadRun();
    if (!saved || !this.state.restore(saved.state)) {
      this.#clearSavedRun();
      this.ui.toast('NO TRACE FOUND', 'There is no stable local run to return to. Start with the canvas.', 'bad');
      return;
    }

    this.ui.hide('title-screen');
    this.ui.hide('ending');
    this.arti.reset();
    this.ui.updateArtiChip(this.arti.followers);
    this.ui.clearArtiUnread();
    this.npcs.clear();
    for (const [zone, defs] of Object.entries(castForNight(this.state.night))) this.npcs.spawn(defs, zone);

    for (const painting of this.state.paintings) painting.texture = this.#restorePaintingTexture(painting);
    const latest = this.state.paintings[this.state.paintings.length - 1];
    if (latest) {
      const easel = this.world.zone('garret').easelCanvas;
      easel.material = new THREE.MeshStandardMaterial({ map: latest.texture, roughness: 0.85 });
    }

    const pending = this.state.getPainting(saved.pendingAppraisalId);
    this.pendingAppraisal = pending ? { p: pending } : null;
    if (pending) this.world.hangOnDisplay(pending.texture, pending.title, pending.lotNumber);

    const zoneKey = ZONES[saved.zone] ? saved.zone : 'garret';
    const zone = this.world.setZone(zoneKey);
    this.ghostRecorder.onZoneChange(zoneKey);
    this.ghosts.loadZone(zoneKey);
    this.#resize();
    this.paint.attachTo(zone.group);
    this.hand.setForestLoadout(zoneKey === 'blackForest');
    this.#applyZoneAtmosphere(zoneKey);
    const position = saved.player;
    const x = Number.isFinite(position?.x) ? position.x : zone.spawn.x;
    const z = Number.isFinite(position?.z) ? position.z : zone.spawn.z;
    const yaw = Number.isFinite(position?.yaw) ? position.yaw : zone.spawnYaw;
    this.player.teleport(x, z, yaw);
    this.world.setVaultArchive(latest?.title, latest?.lotNumber);
    this.#syncCarry();

    if (!this.quests.restore(saved.quest)) this.quests.startNight(this.state.night);
    this.#dailyProgress = Math.max(0, Number(saved.dailyProgress) || 0);
    this.#cowVisitedThisRun = Boolean(saved.cowVisited);
    this.mode = 'playing';
    this.#runActive = true;
    this.ui.show('hud');
    this.ui.setHotkeys('playing');
    this.ui.toast('RUN RESTORED', `Night ${this.state.night}, ${ZONES[zoneKey].name}. The room kept your place.`, 'good');
    this.input.requestLock();
    this.#persistRun();
  }

  #restorePaintingTexture(painting) {
    const canvas = document.createElement('canvas');
    canvas.width = 384; canvas.height = 480;
    const ctx = canvas.getContext('2d');
    const primer = ctx.createLinearGradient(0, 0, 0, canvas.height);
    primer.addColorStop(0, '#efe9dc'); primer.addColorStop(1, '#c8bda9');
    ctx.fillStyle = primer; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#1b1813'; ctx.font = '700 22px sans-serif'; ctx.fillText(painting.title.slice(0, 28), 24, 44);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    if (painting.artData) {
      const image = new Image();
      image.onload = () => { ctx.drawImage(image, 0, 0, canvas.width, canvas.height); texture.needsUpdate = true; };
      image.src = painting.artData;
    }
    return texture;
  }

  #persistRun() {
    if (!this.#runActive || !this.world?.current || !this.player) return;
    const { x, y, z } = this.player.position;
    if (![x, y, z, this.player.yaw].every(Number.isFinite)) return;
    const saved = {
      version: 1, savedAt: Date.now(), state: this.state.snapshot(), zone: this.world.current,
      player: { x, y, z, yaw: this.player.yaw }, quest: this.quests.snapshot(),
      pendingAppraisalId: this.pendingAppraisal?.p?.id ?? null,
      dailyProgress: this.#dailyProgress, cowVisited: this.#cowVisitedThisRun,
    };
    saveRun(saved);
    this.#savedRun = saved;
    this.ui.setResumeRun(saved);
  }

  #clearSavedRun() {
    this.#runActive = false;
    clearRun();
    this.#savedRun = null;
    this.ui.setResumeRun(null);
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
    this.ghostRecorder.onZoneChange('garret');
    this.ghosts.loadZone('garret');
    this.paint.attachTo(z.group);
    this.hand.setForestLoadout(false);
    this.#applyZoneAtmosphere('garret');
    this.player.teleport(z.spawn.x, z.spawn.z, z.spawnYaw);

    this.mode = 'playing';
    this.#runActive = true;
    this.ui.show('hud');
    this.ui.setHotkeys('playing');
    this.ui.hint('WASD · E use · LMB brush · Q appraise · N arti · M map · Tab virtues');

    setTimeout(() => this.ui.hint(null), 9000);
    this.quests.startNight(n);
    this.input.requestLock();
    this.#persistRun();
  }

  #quitToTitle() {
    this.ui.hide('pause');
    this.ui.hide('hud');
    this.ui.show('title-screen');
    this.ui.renderEndingsStrip(loadEndings());
    this.mode = 'title';
    this.ui.hideHotkeys();
    this.audio.setMood('off');
    this.audio.stopRoomScore();
    this.audio.stopTechno();
    this.audio.stopJazz();
    this.audio.setMusic('title', MUSIC);
    this.input.exitLock();
    this.#clearSavedRun();
  }


  #showEnding() {
    const key = this.quests.computeEnding();
    unlockEnding(key);
    this.mode = 'transition';              // suppress auto-pause on unlock
    this.input.exitLock();
    this.audio.setMood('off');
    this.audio.stopRoomScore();
    this.audio.stopTechno();
    this.audio.stopJazz();
    this.audio.setMusic('ending', MUSIC);
    this.#clearSavedRun();

    this.ui.transition(() => {

      this.ui.hide('hud');
      this.ui.hideHotkeys();
      this.ui.showEnding(key, this.state, endingCallback(key, this.state));
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
      case 'arti-call':
        this.#closeCollectorCall();
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
    if (zone !== this.world.current) {
      this.#travelTo(zone);
    }
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
      onCall: (id) => this.#callArtworld(id),
    });
    this.#advanceDaily('arti');
    this.audio.uiMove();
  }

  #closeArti() {
    this.ui.closeArti();
    this.player.setFrozen(false);
    this.mode = 'playing';
    this.ui.setHotkeys('playing');
    this.input.requestLock();
  }

  #callArtworld(id) {
    if (id !== COLLECTOR_CALL.id) return;
    this.mode = 'arti-call';
    this.ui.hide('arti');
    this.ui.setHotkeys('arti-call');
    this.player.setFrozen(true);
    this.input.exitLock();
    this.#callRound = 0;
    this.#callUnhappy = 0;
    this.ui.openCollectorCall(COLLECTOR_CALL, (choice) => this.#answerCollectorCall(choice));
    this.audio.uiMove();
  }

  #answerCollectorCall(choiceIndex) {
    if (this.mode !== 'arti-call') return;
    const round = COLLECTOR_CALL.rounds[this.#callRound];
    const choice = round?.options[choiceIndex];
    if (!choice) return;
    this.#callUnhappy += choice.unhappy;
    this.ui.callLine(choice.text);
    this.audio.talkBlip(0.9);
    setTimeout(() => {
      if (this.mode !== 'arti-call') return;
      this.ui.callLine(choice.reply, COLLECTOR_CALL.name);
      this.audio.talkBlip(0.72);
      this.#callRound++;
      const next = COLLECTOR_CALL.rounds[this.#callRound];
      if (next) {
        setTimeout(() => {
          if (this.mode !== 'arti-call') return;
          this.ui.callLine(next.line, COLLECTOR_CALL.name);
          this.audio.talkBlip(0.72);
          this.ui.showCallOptions(next.options, (i) => this.#answerCollectorCall(i));
        }, 650);
      } else {
        this.ui.showCallOptions([], () => {});
        setTimeout(() => {
          if (this.mode !== 'arti-call') return;
          const ending = COLLECTOR_CALL.endings[Math.min(2, Math.floor(this.#callUnhappy / 2))];
          this.ui.callLine(ending, COLLECTOR_CALL.name);
          this.ui.toast('CALL ENDED', ending, this.#callUnhappy > 2 ? 'bad' : '');
          setTimeout(() => this.#closeCollectorCall(), 2400);
        }, 650);
      }
    }, 700);
  }

  #closeCollectorCall() {
    if (this.mode !== 'arti-call') return;
    this.ui.closeCollectorCall();
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
    if (this.mode === 'arti-call') {
      this.#answerCollectorCall(i);
      return;
    }
    if (this.mode !== 'dialogue') return;
    if (this.ui.isTyping) { this.ui.completeLine(); return; }
    this.audio.uiMove();
    this.dialogue.choose(i);
  }

  #onSwing() {
    if (this.mode !== 'playing' || !this.input.locked) return;
    if (this.#swingCooldown > 0) return;

    if (this.world.current === 'blackForest') {
      this.#swingCooldown = SWING.cooldown;
      this.hand.swing();
      this.audio.lighterClick();
      setTimeout(() => {
        if (this.mode !== 'playing' || this.world.current !== 'blackForest') return;
        const fwd = this.player.forwardDir(this.#fwd);
        const result = this.world.igniteForestChurch(this.player.position, fwd);
        if (result.status === 'ignited') {
          const n = result.church.index + 1;
          this.audio.forestIgnite();
          this.state.addMeter('heat', 14, `Stave church ${n} ignited`);
          this.state.addMeter('soul', -3, 'The fog remembers the choice');
          this.state.shiftVirtue('valor', 2, '');
          this.state.record(`Set stave church ${n} alight in Cockburn`, null);
          this.ui.toast('FIRE SENSATION', `Stave church ${n} catches. Flame climbs the black timber; smoke disappears into the fog.`, 'bad');
        } else if (result.status === 'needsGas') {
          this.ui.toast('THE LIGHTER REFUSES', `Stave church ${result.church.index + 1} is dry. Press E nearby to douse it first.`);
        }
      }, 150);
      return;
    }

    if (this.world.current === 'rageRoom') {
      this.#swingCooldown = SWING.cooldown;
      this.hand.swing();
      this.audio.swing();
      setTimeout(() => {
        if (this.mode !== 'playing' || this.world.current !== 'rageRoom') return;
        const result = this.world.breakRageObject(this.player.position, this.player.forwardDir(this.#fwd));
        if (result.broken) {
          this.audio.rageBreak(result.variant);
          this.ui.toast('RAGE ROOM', `${result.label} breaks. The waiver remains undefeated.`, 'bad');
        }
      }, 120);
      return;
    }

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
        this.#advanceDaily('splat');
        this.#maybeSponsor();
        if (this.state.night >= 2 && victim.def.id === 'kreyo') {
          this.ui.toast('KREYO.ETH', pick(KREYO_SELF_MINTS), 'bad');
        }
        this.state.addMeter('heat', SWING.heatOnNPC, `Painted on ${victim.def.name}`);
        this.state.shiftVirtue('compassion', -1, '');
        this.ui.toast('ASSAULT WITH PIGMENT', `${victim.def.name} is furious. The outfit was “irreplaceable”.`, 'bad');
        this.quests.notify('npcSplatted', { id: victim.def.id });
        this.arti.onSplatted(victim.def.id);
        this.debate.notifySplat(victim.def.id);   // MAX PRO absorbs the gesture into the discourse
        return;

      }

      // walls & floors drink the paint
      this.#raycaster.camera = this.camera; // sprite billboards need camera context while recursively raycasting
      this.#raycaster.set(this.camera.position, this.camera.getWorldDirection(this.#fwd));
      this.#raycaster.far = SWING.range + 0.6;
      const hit = this.paint.splatFromRay(this.#raycaster, this.world);
      if (hit) {
        this.audio.splat();
        this.state.stats.splats++;
        this.#nightSplats++;
        this.#advanceDaily('splat');
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
      this.#advanceDaily('appraise');
      this.audio.uiMove();
      return;
    }
    this.#raycaster.camera = this.camera;
    this.#raycaster.set(this.camera.position, this.camera.getWorldDirection(this.#fwd));
    this.#raycaster.far = 5.5;
    const hits = this.#raycaster.intersectObjects(this.world.zone().group.children, true);
    const hit = hits.find((h) => h.object.visible);
    this.ui.toast('THE APPRAISAL', appraiseObject(hit?.object?.name ?? ''));
    this.#advanceDaily('appraise');
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

    if (t.kind === 'ghost') {
      this.#readGhostNote(t.ghost);
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
        if (it.clueKey && !this.state.hasClue(it.clueKey)) {
          const latest = this.state.paintings[this.state.paintings.length - 1];
          if (it.requiresPainting && !latest) {
            this.ui.toast('THE ARCHIVE', 'The room has nothing to catalogue yet. Make something first.', 'bad');
            break;
          }
          const lot = latest?.lotNumber ?? lotNumberFor(this.state.paintings.length || 1);
          const title = latest?.title ?? 'the work';
          this.state.discoverClue(it.clueKey, clueReveal(it.clueKey));
          const clueLines = it.clueLines?.length ? it.clueLines : it.lines;
          const clueLine = pick(clueLines)
            .replaceAll('{{lot}}', lot)
            .replaceAll('{{title}}', `“${title}”`);
          this.ui.toast(it.title ?? 'THE ARCHIVE', clueLine, 'good');
          this.audio.uiMove();
          break;
        }
        if (it.id === 'dildoball-cow') { this.#addressTheCow(it); break; }
        this.ui.toast(it.title ?? 'THE SCENE', pick(it.lines));
        this.audio.uiMove();
        break;
      case 'restroomFixture':
        this.ui.toast(it.title ?? 'THE PUBLIC RESTROOM', it.lines ? pick(it.lines) : it.line);
        if (it.sound === 'piss') this.audio.restroomPiss(it.variant ?? 0);
        else this.audio.restroomFart(it.variant ?? 0);
        break;
      case 'drugPacking':
        this.#packMuscleManiaDelivery();
        break;
      case 'church': {
        const result = this.world.primeForestChurch(it.churchIndex);
        const n = it.churchIndex + 1;
        if (result.status === 'burning') {
          this.ui.toast(`STAVE CHURCH ${n}`, 'Already burning. The timber answers in cracks and orange light.');
          this.audio.churchCrackle(n % 4, 1);
        } else if (result.fresh) {
          this.audio.gasolinePour();
          this.ui.toast('GASOLINE', `Stave church ${n} is soaked. Aim at it and click the lighter to ignite.`, 'bad');
        } else {
          this.audio.lighterClick();
          this.ui.toast(`STAVE CHURCH ${n}`, 'Primed. Aim at the timber and click the lighter.');
        }
        break;
      }
      case 'crownQuest': {
        if (!this.state.getFlag('crownFound')) {
          this.state.setFlag('crownFound');
          this.audio.gasp();
          this.ui.toast('THE KING\'S OTHER CROWN', 'Behind the ice bucket: a second crown, dented, sticky, and humming. The court gasps. The duck squeaks. The cow does not comment. The crown is yours now. It is sticky forever.', 'good');
          this.state.addMeter('fame', 5, 'You found the crown behind the bar');
          this.state.addMeter('soul', 3, 'The court trusts you with the sticky crown');
          this.state.shiftVirtue('valor', 3, 'You reached behind the royal bar');
          this.state.record('Found the King\'s other crown. It is sticky. It is yours.', null);
          this.ui.hint('The court murmurs. The King pretends not to care. The pretense is load-bearing.');
          setTimeout(() => this.ui.hint(null), 8000);
        } else {
          this.ui.toast('THE ROYAL BAR', 'The ice bucket sweats. The bottles watch. The crown-shaped absence behind the bar is where you left it.');
          this.audio.uiMove();
        }
        break;
      }

      case 'map':
        this.#openMap();
        break;
      case 'seance':
        this.#openSeance();
        break;

      case 'recordPlayer':
        this.audio.ensure();
        this.audio.uiConfirm();
        this.#playNextRecord();
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
        this.world.hangOnDisplay(carried.texture, carried.title, carried.lotNumber);
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

  #maxProReactions = null;   // the debater's reply, parked until their dialogue closes

  #talkTo(npc) {
    this.#advanceDaily('talk');
    // Victoria runs the appraisal script when a fresh piece hangs
    if (npc.def.id === 'victoria' && this.pendingAppraisal) {
      const script = this.quests.appraisalScript(this.pendingAppraisal.p, this.state.meters.fame);
      this.dialogue.start(npc, script);
      return;
    }
    // MAX PRO debaters don't duel — they offer you two absurd positions
    if (npc.def.debate) {
      const script = this.debate.dialogueScript(npc);
      this.#maxProReactions = script.reactions;
      npc.def.hint = `Your artistic position: ${this.debate.positionTitle}. It means everything. It means nothing.`;
      this.dialogue.start(npc, script);
      return;
    }
    if (npc.def.id === 'doctorDrug') {
      this.dialogue.start(npc, this.#doctorDrugShopScript());
      return;
    }
    if (npc.def.id === 'muscleMania300' && this.state.hasItem('muscleManiaDelivery')) {
      this.dialogue.start(npc, this.#muscleDeliveryScript());
      return;
    }
    this.dialogue.start(npc);
  }

  #readGhostNote(ghost) {
    this.mode = 'ghostNote';
    this.ui.setHotkeys('ghostNote');
    this.player.setFrozen(true);
    this.input.exitLock();
    this.#interactTarget = null;
    this.ui.interactPrompt(null);
    this.ui.openGhostNote(ghost.note, ghost.noteExpiresAt, (text) => {
      this.ghostRecorder.setNote(text);
      this.mode = 'playing';
      this.ui.setHotkeys('playing');
      this.player.setFrozen(false);
      this.input.requestLock();
    });
  }

  #doctorDrugShopScript() {
    const owned = (key, name) => this.state.hasItem(key) ? `OWNED · ${name}` : `BUY · ${name} · 3€`;
    const ready = ['energyAmpoule', 'siliconePlug', 'titaniumRing'].every((key) => this.state.hasItem(key));
    return {
      opener: this.state.hasItem('muscleManiaDelivery')
        ? 'The package is sealed. Do not say its name near the hand dryer. The hand dryer has party affiliations.'
        : ready
          ? 'All three items are accounted for. Pack them at the counter, then take the sealed delivery to Muscle Mania 300.'
          : 'For the Muscle Mania delivery you need three sealed items. This is a fictional retail transaction conducted beside a sink.',
      custom: [
        { key: '1', tone: 'kind', tag: owned('energyAmpoule', 'PRE-WORKOUT AMPOULE'), text: 'Buy a sealed pre-workout ampoule for the delivery.', action: 'drug:energyAmpoule' },
        { key: '2', tone: 'witty', tag: owned('siliconePlug', 'PINK SILICONE PLUG'), text: 'Buy the pink silicone accessory. Doctor Drug labels it “recovery-adjacent.”', action: 'drug:siliconePlug' },
        { key: '3', tone: 'brutal', tag: owned('titaniumRing', 'TITANIUM COCK RING'), text: 'Buy the titanium ring. The receipt is printed on waterproof paper.', action: 'drug:titaniumRing' },
      ],
    };
  }

  #muscleDeliveryScript() {
    return {
      opener: 'You brought a sealed package into my studio? Good. The red dots cannot open childproof containers.',
      custom: [
        { key: '1', tone: 'kind', tag: 'DELIVER', text: 'Hand over Doctor Drug’s sealed Muscle Mania package.', action: 'drug:deliver' },
        { key: '2', tone: 'witty', tag: 'JOKE', text: 'Ask whether this counts as an edition of three.', action: 'drug:decline' },
        { key: '3', tone: 'brutal', tag: 'KEEP IT', text: 'Keep the package and refuse the errand.', action: 'drug:keep' },
      ],
    };
  }

  #resolveDrugAction(action) {
    const deals = {
      'drug:energyAmpoule': { item: 'energyAmpoule', label: 'sealed pre-workout ampoule' },
      'drug:siliconePlug': { item: 'siliconePlug', label: 'pink silicone plug' },
      'drug:titaniumRing': { item: 'titaniumRing', label: 'titanium cock ring' },
    };
    const deal = deals[action];
    if (deal) {
      if (this.state.hasItem(deal.item)) {
        this.ui.toast('DOCTOR DRUG', `Already sealed: ${deal.label}. The hand dryer has logged the duplicate attempt.`);
        return;
      }
      if (this.state.meters.cash < 3) {
        this.ui.toast('DOCTOR DRUG', 'Three euros short. The market has once again mistaken you for a concept.', 'bad');
        return;
      }
      this.state.addMeter('cash', -3, `Bought ${deal.label} from Doctor Drug`);
      this.state.addItem(deal.item, deal.label);
      this.state.setFlag('doctorDrugMissionStarted');
      this.audio.pickup();
      const ready = ['energyAmpoule', 'siliconePlug', 'titaniumRing'].every((key) => this.state.hasItem(key));
      this.ui.toast('DOCTOR DRUG', ready
        ? 'All three sealed items acquired. Use the counter to pack the Muscle Mania delivery.'
        : `${deal.label} acquired. Two more items belong in the Muscle Mania delivery.`, ready ? 'good' : undefined);
      return;
    }
    if (action === 'drug:deliver') {
      if (!this.state.hasItem('muscleManiaDelivery')) {
        this.ui.toast('MUSCLE MANIA 300', 'No sealed package. Doctor Drug’s counter is still waiting beside the sink.', 'bad');
        return;
      }
      this.state.removeItem('muscleManiaDelivery');
      this.state.setFlag('doctorDrugMissionPacked', false);
      this.state.setFlag('doctorDrugMissionComplete');
      this.state.addMeter('fame', 3, 'Muscle Mania accepted the sealed delivery');
      this.state.addMeter('soul', 2, 'Completed an extremely specific favor');
      this.state.shiftVirtue('compassion', 2, 'You carried the package across town');
      this.state.record('Delivered Doctor Drug’s sealed Muscle Mania package', null);
      this.audio.pickup();
      this.ui.toast('MUSCLE MANIA 300', 'Package accepted. The artist checks the seal, flexes once, and hides it behind a huge painting. “NOT FOR SALE.”', 'good');
      return;
    }
    if (action === 'drug:decline') {
      this.ui.toast('MUSCLE MANIA 300', '“Three is an edition. This is a survival kit. Do not let Zebra hear either sentence.”');
      return;
    }
    if (action === 'drug:keep') {
      this.ui.toast('MUSCLE MANIA 300', 'He nods at the refusal. “Keep it. The work and I have survived worse couriers.”', 'bad');
    }
  }

  #packMuscleManiaDelivery() {
    if (this.state.hasItem('muscleManiaDelivery')) {
      this.ui.toast('DOCTOR DRUG COUNTER', 'The delivery is already sealed. Muscle Mania 300 is waiting in UP AND CUMMING ARTIST.');
      return;
    }
    const required = [
      ['energyAmpoule', 'pre-workout ampoule'],
      ['siliconePlug', 'pink silicone plug'],
      ['titaniumRing', 'titanium cock ring'],
    ];
    const missing = required.filter(([key]) => !this.state.hasItem(key)).map(([, label]) => label);
    if (missing.length) {
      this.ui.toast('DOCTOR DRUG COUNTER', `Package incomplete. Missing: ${missing.join(', ')}. Speak to Doctor Drug.`, 'bad');
      return;
    }
    for (const [key] of required) this.state.removeItem(key);
    this.state.addItem('muscleManiaDelivery', 'sealed Muscle Mania delivery');
    this.state.setFlag('doctorDrugMissionPacked');
    this.state.record('Packed a sealed delivery for Muscle Mania 300', null);
    this.audio.pickup();
    this.ui.toast('POV: COURIER', 'You seal the package at the sink-side counter. Deliver it to Muscle Mania 300 in UP AND CUMMING ARTIST.', 'good');
  }


  #travelTo(zoneKey) {
    const fromZone = this.world.current;
    this.audio.uiConfirm();
    this.ui.transition(() => {

      const z = this.world.setZone(zoneKey);
      this.ghostRecorder.onZoneChange(zoneKey);
      this.ghosts.loadZone(zoneKey);
      this.#resize();
      this.paint.attachTo(z.group);
      this.hand.setForestLoadout(zoneKey === 'blackForest');
      this.#applyZoneAtmosphere(zoneKey);
      this.player.teleport(z.spawn.x, z.spawn.z, z.spawnYaw);
      const latest = this.state.paintings[this.state.paintings.length - 1];
      this.world.setVaultArchive(latest?.title, latest?.lotNumber);
      if (zoneKey === 'dildoBall' && !this.#cowVisitedThisRun) {
        this.#cowVisitedThisRun = true;
        const visits = recordCowVisit();
        if (visits >= 3) this.ui.toast('THE COW REMEMBERS', `This is your ${visits}th visit. The cow has prepared a file on you.`, 'good');
      }
      this.ui.toast(ZONES[zoneKey].name, {
        garret: 'Home. It smells like turpentine and unresolved feelings.',
        galleria: 'The white cube hums. Somewhere, wine is being swirled menacingly.',
        vault: 'Cold air, gold light. The cages are listening.',
        leatherLatex: 'The collector’s house: warm hide up front, black gloss in the back. One bassline, two moods.',
        gildedFork: 'One long table. Every big shot. All of them drunk and messed up.',
        maxPro: 'Forty metres of wall. One painting. Somewhere in it, an argument.',
        dildoBall: 'The bass is wearing a crown. The court is in session. Wobble accordingly.',
        daylightClub: 'Noon detonates into color. Unicorns patrol the moss beneath a giant rainbow while a thinking public debates whether it is thinking.',
        upAndCumming: 'Five enormous works, two red dots, seven coded birds, and an original woozy trap remix: sliding sub, haunted bells, and a synthetic rapper with no actual words.',
        vacantEditions: 'Eight tactile editions and one duct-taped banana cock await inspection. Vincent and Eddie have opinions about every millimetre.',
        hairSalon: 'Every chair is occupied. Every scalp is immaculate. Not one hair has survived the branding.',
        blackForest: 'Ten stave churches stand in heavy fog. Thirty-four boars squeeze the silence. A lighter burns in one hand; a gasoline can weighs down the other.',
        rageRoom: 'Five daylight glass boxes turn panic into architecture. MC Freeglass is inside one, rapping liberation over crooked jazz and a dusty beat.',
        deathMetal: 'Pink lights, black amps, and five punks arguing that Barbie is the loudest death-metal artist alive.',
        publicRestroom: 'Four stalls, three urinals, wet tile, and one strict acoustic policy. Techno Zamba begins below the belt.',
      }[zoneKey]);
      if (fromZone && fromZone !== zoneKey) {
        this.ui.toast('BETWEEN ROOMS', transitionLine(fromZone, zoneKey));
      }

      if (zoneKey === 'maxPro') this.debate.enter();
      this.quests.notify('zoneEntered', { zone: zoneKey });
      this.#persistRun();

    });
  }

  #applyZoneAtmosphere(zoneKey) {
    const z = this.world.zone(zoneKey);
    this.scene.fog.color.set(z.fog.color);
    this.scene.fog.density = z.fog.density;
    this.scene.background.set(z.fog.color);
    this.audio.setMood(ZONES[zoneKey].mood);

    // The royal combo is acoustically sealed inside the Dildo Ball. It never
    // leaks into another room and no communal record may talk over the band.
    if (zoneKey === 'dildoBall') {
      this.audio.setMusic(null);
      this.audio.setRoomScore(null, false);
      this.audio.startJazz();
      this.world.setRecordPlayerState(null);
      return;
    }

    // The restroom is even stricter than the royal court: communal records,
    // ambient drones and the jazz combo stay outside. Its entire score is made
    // from synthesized urine and fart sounds.
    if (zoneKey === 'publicRestroom') {
      this.audio.stopJazz(true);
      this.audio.cutMusic();
      this.audio.setRoomScore(zoneKey, true, true);
      this.world.setRecordPlayerState(null);
      return;
    }

    this.audio.stopJazz();
    this.audio.setMusic(this.#recordKey, MUSIC);
    this.audio.setRoomScore(zoneKey, !this.#recordKey);
    this.world.setRecordPlayerState(this.#recordKey);
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

  /** The cow actually talks: a synthesized moo, a comic bubble over its
      tiny crown, and the narrator translating in the toast stack. */
  #addressTheCow(it) {
    this.audio.moo(0.85 + Math.random() * 0.3);
    const anchor = this.world.anchors().cow;
    if (anchor) {
      const v = anchor.clone();
      v.y = 2.05;                       // just above the tiny crown
      v.project(this.camera);
      if (v.z <= 1) {
        const x = (v.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
        this.ui.speechBubbleImage(x, y, pick(this.#cowBubbleUrls), 3500);
      }
    }
    this.#advanceDaily('cow');
    this.ui.toast('THE COW', pick(it.lines));
  }

  /** Let the cow offer unsolicited artworld commentary while the court is in session. */
  #updateCowSpeech(dt) {
    if (this.world.current !== 'dildoBall') {
      this.#cowBubbleTimer = Math.max(this.#cowBubbleTimer, 2);
      return;
    }

    this.#cowBubbleTimer -= dt;
    if (this.#cowBubbleTimer > 0) return;

    // Keep the stream lively enough that bubbles occasionally overlap, but not
    // so dense that they cover the player's view.
    this.#cowBubbleTimer = rand(this.#daily.bubbleMin, this.#daily.bubbleMax);
    const anchor = this.world.anchors().cow;
    if (!anchor || !this.#cowBubbleUrls.length) return;

    const v = anchor.clone();
    v.y = 2.2;
    v.project(this.camera);
    if (v.z > 1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2) return;

    const x = (v.x * 0.5 + 0.5) * window.innerWidth + rand(-42, 42);
    const y = (-v.y * 0.5 + 0.5) * window.innerHeight + rand(-14, 14);
    this.audio.moo(rand(0.82, 1.18));
    this.ui.speechBubbleImage(x, y, pick(this.#cowBubbleUrls), rand(3000, 4200));
    this.#advanceDaily('cow');
  }

  #advanceDaily(event) {
    if (this.#daily.event !== event || dailyComplete(this.#dailyStamp)) return;
    this.#dailyProgress = Math.min(this.#daily.goal, this.#dailyProgress + 1);
    this.ui.setDailyCard({ title: this.#daily.title, description: this.#daily.desc, progress: `${this.#dailyProgress} / ${this.#daily.goal} — IN PROGRESS` });
    if (this.#dailyProgress < this.#daily.goal) return;
    completeDaily(this.#dailyStamp);
    this.audio.nightChime();
    this.ui.setDailyCard({ title: this.#daily.title, description: this.#daily.desc, progress: 'COMPLETED', complete: true });
    this.ui.toast('DAILY MALFUNCTION COMPLETE', 'The artworld has issued you one (1) invisible trophy.', 'good');
  }

  /* ============================================================
     The loop
     ============================================================ */

  #frame(tms) {
    const now = tms / 1000;
    const dt = Math.min(now - (this.#t || now), 0.05);
    this.#t = now;

    // the world simulates in every in-run mode; only the player's body freezes
    const playing = ['playing', 'dialogue', 'codex', 'easel', 'naming', 'map', 'seance', 'arti', 'ghostNote'].includes(this.mode);




    if (playing) {
      this.#swingCooldown = Math.max(0, this.#swingCooldown - dt);
      this.#shrineCooldown = Math.max(0, this.#shrineCooldown - dt);
      this.#mintCooldown = Math.max(0, this.#mintCooldown - dt);

      const moving = this.player.update(dt, this.world.colliders());
      this.ghostRecorder.tick(dt, this.player);
      this.#saveTimer += dt;
      if (this.#saveTimer >= 5) {
        this.#saveTimer = 0;
        this.#persistRun();
      }

      // the room's pulse: everything in the frame answers the kick
      const beatPhase = this.world.current === 'dildoBall'
        ? this.audio.jazzBeatPhase
        : this.audio.roomBeatPhase;
      this.player.setBeat(beatPhase);

      const worldEvent = this.world.update(dt, now, beatPhase);
      if (worldEvent?.type === 'boxingImpact') {
        this.audio.boxingImpact(worldEvent.variant, worldEvent.victim);
      }
      if (worldEvent?.type === 'boarSqueak') {
        this.audio.boarSqueak(worldEvent.variant);
      }
      if (worldEvent?.type === 'churchCrackle') {
        this.audio.churchCrackle(worldEvent.variant, worldEvent.burningCount);
      }
      if (worldEvent?.type === 'rageBreak') {
        this.audio.rageBreak(worldEvent.variant);
        this.ui.subtitle('MC FREEGLASS · BOXED BUT UNBROKEN', worldEvent.line, 0.76, this.audio);
      }
      if (worldEvent?.type === 'deathMetalHit') {
        this.audio.deathMetalHit(worldEvent.variant);
      }

      this.npcs.update(dt, now, this.player.position);
      this.ghosts.update(dt);
      if (this.world.current === 'maxPro') {
        // the argument is scripted; the ghostwriter is not invited to MAX PRO
        this.debate.update(dt, { busy: () => this.mode !== 'playing' });
      } else {
        this.chatter.update(dt, this.npcs.inCurrentZone, {
          zoneName: ZONES[this.world.current]?.name ?? 'the scene',
          zoneKey: this.world.current,
          night: this.state.night,
          busy: () => this.mode !== 'playing',
          active: () => this.world.current === 'daylightClub',
        });
      }

      this.paint.update(dt);
      this.hand.update(dt, { moving, sprinting: this.player.sprinting });
      this.arti.update(dt);

      // footsteps
      if (moving && this.world.current !== 'publicRestroom') {
        this.#stepAccum += dt * (this.player.sprinting ? 5.6 : 4.1);
        if (this.#stepAccum > 2.1) { this.#stepAccum = 0; this.audio.footstep(); }
      }

      // heat bleeds off slowly — scandal is perishable
      if (this.state.meters.heat > 0) {
        this.state.addMeter('heat', -SWING.heatDecayPerSec * dt, '');
      }

      this.#updateCowSpeech(dt);

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
        : (npc.def.interactLabel ?? `Talk — ${npc.def.name}`);
      this.#interactTarget = { kind: 'npc', npc };
      this.ui.interactPrompt(label);
      return;
    }

    const ghost = this.ghosts.nearest(this.player.position, fwd, PLAYER.interactRange);
    if (ghost) {
      this.#interactTarget = { kind: 'ghost', ghost };
      this.ui.interactPrompt('Read — left here');
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

  #playNextRecord() {
    const keys = Object.keys(MUSIC);
    const current = keys.indexOf(this.#recordKey);
    this.#recordKey = keys[(current + 1 + keys.length) % keys.length];
    if (this.world.current === 'dildoBall' || this.world.current === 'publicRestroom') {
      this.world.setRecordPlayerState(null);
      const royal = this.world.current === 'dildoBall';
      this.ui.toast(
        royal ? 'THE ROYAL SOUND POLICY' : 'THE RESTROOM SOUND POLICY',
        royal
          ? `${MUSIC_TITLES[this.#recordKey]} is queued for outside. In here, the weird combo has tenure.`
          : `${MUSIC_TITLES[this.#recordKey]} is queued for outside. In here: piss, fart, Techno Zamba.`,
        'good'
      );
      return;
    }
    this.audio.setMusic(this.#recordKey, MUSIC);
    this.audio.setRoomScore(this.world.current, false);
    this.world.setRecordPlayerState(this.#recordKey);
    this.ui.setNowPlaying(MUSIC_TITLES[this.#recordKey]);
    this.ui.toast('THE COMMUNAL RECORD PLAYER', `Now spinning: ${MUSIC_TITLES[this.#recordKey]}. Every room hears it.`, 'good');
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
