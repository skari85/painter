/**
 * ui.js — every DOM touchpoint in one place.
 *
 * The 3D game never formats a string; the UI never casts a ray.
 * Talks to the rest of the game through events and small method calls.
 */

import { VIRTUES, ENDINGS } from '../core/config.js';
import { escapeHtml, clamp, formatSigned } from '../core/utils.js';
import { NPC_HANDLES } from '../game/arti.js';

const $ = (id) => document.getElementById(id);

export class UIManager {
  #typing = null;         // interval id
  #subtitleTimer = null;
  #typingFull = '';
  #nowPlaying = null;
  #scandalTimer = null;
  #sponsorTimer = null;
  #artiUnread = 0;
  #artiDeltaTimer = null;
  #artiBuzzTimer = null;
  #callTimer = null;
  #callStartedAt = 0;
  #onboardingKey = null;

  constructor() {
    this.el = {
      hud: $('hud'),
      nightLabel: $('night-label'),
      objective: $('objective-text'),
      objectiveCard: $('objective-card'),
      meters: {
        fame: [$('meter-fame'), $('meter-fame-num')],
        soul: [$('meter-integrity'), $('meter-integrity-num')],
        cash: [$('meter-cash'), $('meter-cash-num')],
        heat: [$('meter-heat'), $('meter-heat-num')],
      },
      carrying: $('carrying-chip'),
      carryingTitle: $('carrying-title'),
      collectionHud: $('collection-value'),
      collectionValue: $('collection-value-number'),
      collectionStatus: $('collection-value-status'),
      hitmarker: $('hitmarker'),
      interact: $('interact-prompt'),
      interactText: $('interact-text'),
      subtitle: $('subtitle'),
      toasts: $('toasts'),
      damageLayer: $('damage-layer'),
      hint: $('hint-bar'),
      hotkeys: $('hotkeys'),
      hotkeysTitle: $('hotkeys-title'),
      hotkeysList: $('hotkeys-list'),
      dialogue: $('dialogue'),
      dlgPortrait: $('dlg-portrait'),
      dlgName: $('dlg-name'),
      dlgRole: $('dlg-role'),
      dlgLine: $('dlg-line'),
      dlgOptions: $('dlg-options'),
      dlgEgo: $('dlg-ego-fill'),
      dlgHint: $('dlg-weakness-hint'),
      curtain: $('curtain'),
      credPulse: $('cred-pulse'),
      moodGrade: $('mood-grade'),
      title: $('title-screen'),
      resumeRun: $('btn-resume'),
      onboarding: $('onboarding'),
      onboardingFrame: $('onboarding-frame'),
      onboardingKicker: $('onboarding-kicker'),
      onboardingTitle: $('onboarding-title'),
      onboardingBody: $('onboarding-body'),
      onboardingCast: $('onboarding-cast'),
      onboardingCaption: $('onboarding-image-caption'),
      onboardingImageCount: $('onboarding-image-count'),
      onboardingChapter: $('onboarding-chapter'),
      onboardingControlNote: $('onboarding-control-note'),
      onboardingStamp: $('onboarding-stamp'),
      onboardingPlaybook: $('onboarding-playbook'),
      onboardingProgress: $('onboarding-progress'),
      onboardingNext: $('onboarding-next'),
      onboardingSkip: $('onboarding-skip'),
      endingsStrip: $('endings-strip'),
      howto: $('howto'),
      settings: $('settings'),
      pause: $('pause'),
      codex: $('codex'),
      codexGrid: $('codex-grid'),
      naming: $('naming'),
      namingInput: $('naming-input'),
      ghostNote: $('ghost-note'),
      ghostNoteText: $('ghost-note-text'),
      ghostNoteStatus: $('ghost-note-status'),
      ghostNoteInput: $('ghost-note-input'),
      nightEnd: $('night-end'),
      nightEndTitle: $('night-end-title'),
      nightEndSummary: $('night-end-summary'),
      ending: $('ending'),
      endingKicker: $('ending-kicker'),
      endingTitle: $('ending-title'),
      endingBody: $('ending-body'),
      endingStats: $('ending-stats'),
      fatal: $('fatal'),
      fatalText: $('fatal-text'),
      dailyTitle: $('daily-title'),
      dailyDescription: $('daily-description'),
      dailyProgress: $('daily-progress'),
      call: $('arti-call'),
      callPortrait: $('call-portrait'),
      callName: $('call-name'),
      callHandle: $('call-handle'),
      callRole: $('call-role'),
      callCaption: $('call-caption'),
      callDuration: $('call-duration'),
      callTranscript: $('call-transcript'),
      callOptions: $('call-options'),
    };
  }

  /* ============================================================
     Screens & transitions
     ============================================================ */

  show(name) { $(name)?.classList.remove('hidden'); }
  hide(name) { $(name)?.classList.add('hidden'); }

  setResumeRun(saved) {
    const button = this.el.resumeRun;
    if (!button) return;
    const night = Number(saved?.state?.night);
    const names = ['', 'One', 'Two', 'Three'];
    button.classList.toggle('hidden', !Number.isInteger(night) || night < 1 || night > 3);
    if (night >= 1 && night <= 3) button.textContent = `Resume Night ${names[night]}`;
  }

  /** A compact opening film. Gameplay is not initialized until it completes. */
  openOnboarding(onComplete) {
    const scenes = [
      {
        scene: 'garret', kicker: 'NIGHT ONE · OSLO 02:13', title: 'MAKE SOMETHING BEFORE THEY NAME IT.',
        body: 'You are an artist with a cold room, late rent, and one blank canvas. The first painting is yours for exactly as long as it takes the city to notice.',
        caption: 'THE GARRET · BEFORE THE MARKET', stamp: 'MAKE THE WORK', chapter: '01 · EXPOSURE', note: 'A short brief before the first mark.', accent: '#e8c15a',
        cast: [{ name: 'THE ARTIST', role: 'your unfinished self', face: 'puplic/art gimps/Alex.png', pose: 'hero' }],
        beats: [['Paint', 'Finish a canvas and give it a title.'], ['Move', 'Use doors or M to cross the city instantly.']],
      },
      {
        scene: 'market', kicker: 'THE WHITE CUBE · GALLERIA BIANCA', title: 'THE ROOM HAS A PRICE BEFORE IT HAS AN OPINION.',
        body: 'Victoria can hang your work. Collectors can buy the silence around it. A small red mark keeps appearing beside things that have become inventory.',
        caption: 'THE GALLERY · A MARKET IN GOOD LIGHT', stamp: 'GET SEEN', chapter: '02 · CIRCULATION', note: 'Your work is moving before you are.', accent: '#df9eae',
        cast: [
          { name: 'VICTORIA VANE', role: 'gallerist', face: 'puplic/visual assets/character_faces/03-stern-older-woman.png', pose: 'hero' },
          { name: 'CHAD STERLING', role: 'collector', face: 'puplic/visual assets/character_faces/12-office-worker.png', pose: 'side' },
        ],
        beats: [['Appraise', 'Press Q to learn what the room thinks your work is worth.'], ['Notice', 'Look for the red archive mark. It never blocks progress.']],
      },
      {
        scene: 'voices', kicker: 'NIGHT TWO · THE COMMENTARY MACHINE', title: 'EVERYONE HAS A VERSION OF YOUR WORK.',
        body: 'Dolores writes the review. KREYO turns feeling into content. Guests talk before they look. Your title travels faster than you do — decide how you answer back.',
        caption: 'THE CITY · OPINIONS WITH LEGS', stamp: 'SPEAK BACK', chapter: '03 · COMMENTARY', note: 'Choose a tone. Every tone leaves a trace.', accent: '#92c7bc',
        cast: [
          { name: 'DOLORES PANG', role: 'critic', face: 'puplic/visual assets/character_faces/08-exhausted-nurse.png', pose: 'hero' },
          { name: 'KREYO', role: 'rival artist', face: 'puplic/visual assets/character_faces/09-street-artist.png', pose: 'side' },
        ],
        beats: [['Talk', 'Press E, then choose Kind, Witty, or Brutal.'], ['Watch yourself', 'Fame opens doors. Integrity tells you why you entered.']],
      },
      {
        scene: 'ghosts', kicker: 'THE GHOST LAYER · OTHER ARTISTS, AFTERWARD', title: 'SOMEONE ELSE WALKED THIS ROOM FIRST.',
        body: 'A pale figure is not a live player or a bot. It is an asynchronous trace: a past route replaying in the room, with a note that may have been left for whoever arrives next. Notes burn after 24 hours; the route stays.',
        caption: 'THE GHOST LAYER · ROUTES WITHOUT A LOBBY', stamp: 'READ A TRACE', chapter: '04 · GHOST LAYER', note: 'No live chat. Notes burn in 24 hours; routes linger.', accent: '#8ab4ff',
        cast: [
          { name: 'SOMEONE ELSE', role: 'a recorded route', face: 'puplic/visual assets/character_faces/16-mysterious-traveler.png', pose: 'hero', ghost: true },
          { name: 'THE NEXT ARTIST', role: 'maybe you', face: 'puplic/visual assets/character_faces/09-street-artist.png', pose: 'side', ghost: true },
        ],
        beats: [['Read', 'Walk up to a pale figure and press E. Its note shows a live burn timer.'], ['Leave a trace', 'Type a short note—or say nothing. Notes last 24 hours; routes can echo later.']],
      },
      {
        scene: 'vault', kicker: 'NIGHT THREE · THE VAULT', title: 'THEY DO NOT ONLY WANT THE CANVAS.',
        body: 'The market wants the proof that you made it: your title, your history, your provenance. Find Mister Index and choose what, if anything, can be owned.',
        caption: 'THE VAULT · FOR THE ARCHIVE', stamp: 'KEEP YOUR NAME', chapter: '05 · OWNERSHIP', note: 'The archive is not the same as memory.', accent: '#c9b9ea',
        cast: [{ name: 'MISTER INDEX', role: 'archivist of ownership', face: 'puplic/visual assets/character_faces/07-elegant-older-man.png', pose: 'hero' }],
        beats: [['Navigate', 'M opens the map. Optional rooms add evidence, never requirements.'], ['Decide', 'Your choices and meters shape one of four endings.']],
      },
      {
        scene: 'choice', kicker: 'YOUR FIRST MOVE · THE GARRET', title: 'PAINT. GET SEEN. STAY YOURSELF IF YOU CAN.',
        body: 'Three nights, one growing body of work, and a city ready to turn it into an asset. Begin with the canvas. The rest will find you.',
        caption: 'NIGHT ONE · THE CANVAS IS WAITING', stamp: 'BEGIN NIGHT ONE', chapter: '06 · FIRST MOVE', note: 'No checklist. Just make the first mark.', accent: '#e8c15a',
        cast: [
          { name: 'THE ARTIST', role: 'still making the call', face: 'puplic/art gimps/Alex.png', pose: 'hero' },
          { name: 'THE CITY', role: 'already watching', face: 'puplic/visual assets/character_faces_alt/05-punk-librarian.png', pose: 'side' },
        ],
        beats: [['Core controls', 'WASD move · mouse looks · E interacts.'], ['No checklist', 'Follow the objective; explore when curiosity wins.']],
      },
    ];
    let index = 0;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      document.removeEventListener('keydown', this.#onboardingKey);
      this.#onboardingKey = null;
      this.hide('onboarding');
      onComplete();
    };
    const render = () => {
      const shot = scenes[index];
      const frame = this.el.onboardingFrame;
      frame.classList.remove('shot-enter');
      void frame.offsetWidth;
      frame.dataset.scene = shot.scene;
      frame.style.setProperty('--film-scene', shot.accent);
      this.el.onboardingKicker.textContent = shot.kicker;
      this.el.onboardingTitle.textContent = shot.title;
      this.el.onboardingBody.textContent = shot.body;
      this.el.onboardingCaption.textContent = shot.caption;
      this.el.onboardingImageCount.textContent = `${String(index + 1).padStart(2, '0')} / ${String(scenes.length).padStart(2, '0')}`;
      this.el.onboardingChapter.textContent = shot.chapter;
      this.el.onboardingControlNote.textContent = shot.note;
      this.el.onboardingStamp.textContent = shot.stamp;
      this.el.onboardingCast.innerHTML = shot.cast.map((person) => `
        <figure class="film-portrait ${person.pose}${person.ghost ? ' ghost-trace' : ''}">
          <img src="${person.face}" alt="" />
          <figcaption><strong>${person.name}</strong><span>${person.role}</span></figcaption>
        </figure>`).join('');
      this.el.onboardingPlaybook.innerHTML = shot.beats.map(([label, copy]) => `
        <div><strong>${label}</strong><span>${copy}</span></div>`).join('');
      this.el.onboardingNext.childNodes[0].textContent = index === scenes.length - 1 ? 'Begin Night One ' : 'Continue ';
      this.el.onboardingProgress.innerHTML = scenes.map((_, i) => `<span class="${i <= index ? 'on' : ''}"></span>`).join('');
      this.el.onboardingProgress.setAttribute('aria-label', `Scene ${index + 1} of ${scenes.length}`);
      frame.classList.add('shot-enter');
    };
    const next = () => {
      if (index >= scenes.length - 1) { finish(); return; }
      index += 1;
      render();
    };
    this.el.onboardingNext.onclick = next;
    this.el.onboardingSkip.onclick = finish;
    this.#onboardingKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); finish(); }
      if (event.target instanceof HTMLButtonElement && (event.key === ' ' || event.key === 'Enter')) return;
      if (event.key === ' ' || event.key === 'Enter' || event.key === 'ArrowRight') { event.preventDefault(); next(); }
    };
    document.addEventListener('keydown', this.#onboardingKey);
    this.show('onboarding');
    render();
    this.el.onboardingNext.focus();
  }

  get isDialogueOpen() { return !this.el.dialogue.classList.contains('hidden'); }
  get isCodexOpen() { return !this.el.codex.classList.contains('hidden'); }

  /** Fade to black, run `mid`, fade back. */
  transition(mid, holdMs = 350) {
    this.el.curtain.classList.add('on');
    setTimeout(() => {
      mid?.();
      setTimeout(() => this.el.curtain.classList.remove('on'), holdMs);
    }, 580);
  }

  fatal(message) {
    this.el.fatalText.textContent = message;
    this.show('fatal');
  }

  /* ============================================================
     HUD
     ============================================================ */

  bindState(state) {
    state.on('meter', ({ key, value }) => this.setMeter(key, value));
    state.on('reset', () => {
      for (const k of Object.keys(this.el.meters)) this.setMeter(k, state.meters[k]);
      this.setCarrying(null);
    });
  }

  setMeter(key, value) {
    const pair = this.el.meters[key];
    if (!pair) return;
    pair[0].style.width = `${clamp(value, 0, 100)}%`;
    pair[1].textContent = Math.round(value);
  }

  setObjective(nightLabel, text) {
    this.el.nightLabel.textContent = nightLabel;
    this.el.objective.textContent = text;
    this.el.objectiveCard.style.animation = 'none';
    void this.el.objectiveCard.offsetWidth;   // restart the pulse
    this.el.objectiveCard.style.animation = '';
  }

  interactPrompt(label) {
    if (!label) { this.hide('interact-prompt'); return; }
    this.el.interactText.textContent = label;
    this.show('interact-prompt');
  }

  setCarrying(title) {
    if (!title) { this.hide('carrying-chip'); return; }
    this.el.carryingTitle.textContent = `“${title}”`;
    this.show('carrying-chip');
  }

  hint(text) {
    if (!text) { this.hide('hint-bar'); return; }
    this.el.hint.textContent = text;
    this.show('hint-bar');
  }

  setDailyCard({ title, description, progress, complete = false }) {
    this.el.dailyTitle.textContent = title;
    this.el.dailyDescription.textContent = description;
    this.el.dailyProgress.textContent = complete ? 'COMPLETED — THE OMEN IS IMPRESSED' : progress;
    this.el.dailyProgress.classList.toggle('complete', complete);
  }

  /** Keep the keyboard legend visible, while changing it for each overlay. */
  setHotkeys(mode) {
    const presets = {
      playing: {
        title: 'CONTROLS',
        items: [
          ['WASD / arrows', 'move'], ['Shift', 'sprint'], ['Mouse', 'look'],
          ['LMB', 'paint / swing'], ['E', 'talk / use'], ['Q', 'appraise'],
          ['N', 'ARTI'], ['M', 'map'], ['P', 'records'], ['Tab', 'virtues'], ['Esc', 'pause'],
        ],
      },
      dialogue: { title: 'CONVERSATION', items: [['1', 'kind'], ['2', 'witty'], ['3', 'brutal']] },
      easel: { title: 'EASEL', items: [['Mouse drag', 'paint'], ['[ / ]', 'brush size'], ['Esc', 'step back']] },
      map: { title: 'MAP', items: [['Mouse', 'choose room'], ['M / Esc', 'close']] },
      records: { title: 'RECORD CASE', items: [['Mouse', 'choose record'], ['P / Esc', 'close']] },
      codex: { title: 'VIRTUES', items: [['Tab / Esc', 'close']] },
      arti: { title: 'ARTI', items: [['Mouse', 'use phone'], ['N / Esc', 'close']] },
      'arti-call': { title: 'LIVE CALL', items: [['1', 'answer'], ['2', 'answer'], ['3', 'answer'], ['Esc', 'end call']] },
      seance: { title: 'SÉANCE', items: [['Mouse', 'choose / ask'], ['Esc', 'leave']] },
      naming: { title: 'TITLE THE WORK', items: [['Type', 'name painting'], ['Enter', 'confirm'], ['Esc', 'cancel']] },
      ghostNote: { title: "A STRANGER'S TRACE", items: [['Type', 'leave a note'], ['Enter', 'leave it'], ['Esc', 'say nothing']] },
      paused: { title: 'PAUSED', items: [['Esc', 'resume'], ['Mouse', 'choose menu']] },
    };
    const preset = presets[mode] ?? presets.playing;
    if (!this.el.hotkeys || this.#hotkeyMode === mode) return;
    this.#hotkeyMode = mode;
    this.el.hotkeys.classList.remove('hidden');
    this.el.hotkeysTitle.textContent = preset.title;
    this.el.hotkeysList.innerHTML = preset.items
      .map(([key, label]) => `<span class="hotkey"><kbd>${escapeHtml(key)}</kbd><span>${escapeHtml(label)}</span></span>`)
      .join('');
  }

  hideHotkeys() {
    this.el.hotkeys?.classList.add('hidden');
    this.#hotkeyMode = null;
  }

  #hotkeyMode = null;
  #moodGradeTimer = null;

  hitmarker(brutal = false) {
    const h = this.el.hitmarker;
    h.classList.toggle('brutal', brutal);
    h.classList.remove('pop');
    void h.offsetWidth;
    h.classList.add('pop');
  }

  credPulse() {
    const c = this.el.credPulse;
    c.classList.add('on');
    setTimeout(() => c.classList.remove('on'), 220);
  }

  /** A barely-there color wash for a sustained run of tone. Never announced. */
  setMoodGrade(kind) {
    const el = this.el.moodGrade;
    el.classList.remove('brutal', 'kind');
    void el.offsetWidth;
    el.classList.add(kind);
    clearTimeout(this.#moodGradeTimer);
    this.#moodGradeTimer = setTimeout(() => el.classList.remove(kind), 60000);
  }

  /** World-space → screen-space damage number. */
  damageNumber(sx, sy, text, cls = '') {
    const d = document.createElement('div');
    d.className = `dmg ${cls}`;
    d.textContent = text;
    d.style.left = `${sx + (Math.random() * 40 - 20)}px`;
    d.style.top = `${sy - 10}px`;
    this.el.damageLayer.appendChild(d);
    setTimeout(() => d.remove(), 950);
  }

  toast(kicker, body, cls = '') {
    const t = document.createElement('div');
    t.className = `toast ${cls}`;
    t.innerHTML = `<span class="t-kicker">${escapeHtml(kicker)}</span>${escapeHtml(body)}`;
    this.el.toasts.appendChild(t);
    setTimeout(() => t.classList.add('leaving'), 2600);
    setTimeout(() => t.remove(), 3000);
  }

  /** A comic speech bubble at a screen position — for talking livestock. */
  speechBubble(x, y, text, ms = 3000) {
    const b = document.createElement('div');
    b.className = 'speech-bubble';
    b.textContent = text;
    b.style.left = `${x}px`;
    b.style.top = `${y}px`;
    this.el.damageLayer.appendChild(b);
    setTimeout(() => b.classList.add('leaving'), ms);
    setTimeout(() => b.remove(), ms + 400);
  }

  /** Image speech bubble at a screen position — for the cow's artworld nonsense. */
  speechBubbleImage(x, y, url, ms = 3500) {
    const b = document.createElement('div');
    b.className = 'speech-bubble-image';
    const img = document.createElement('img');
    img.src = encodeURI(url);
    img.style.display = 'block';
    img.style.maxWidth = '220px';
    img.style.maxHeight = '160px';
    img.style.borderRadius = '14px';
    b.appendChild(img);
    b.style.left = `${x}px`;
    b.style.top = `${y}px`;
    this.el.damageLayer.appendChild(b);
    setTimeout(() => b.classList.add('leaving'), ms);
    setTimeout(() => b.remove(), ms + 400);
  }

  subtitle(name, text, pitch, audio) {
    clearTimeout(this.#subtitleTimer);
    this.el.subtitle.innerHTML =
      `<span class="who">${escapeHtml(name)}</span>${escapeHtml(text)}`;
    this.show('subtitle');
    audio?.talkBlip(pitch ?? 1);
    this.#subtitleTimer = setTimeout(() => this.hide('subtitle'), 4200);
  }

  /** Now-playing chip reflects either the travelling record or the local room score. */
  setNowPlaying(state) {
    const signature = state ? `${state.kind}:${state.title}` : null;
    if (signature === this.#nowPlaying) return;
    this.#nowPlaying = signature;
    const chip = $('now-playing');
    if (!state?.title) { chip.classList.add('hidden'); return; }
    const isRecord = state.kind === 'record';
    $('np-title').textContent = state.title;
    $('np-next').classList.toggle('hidden', !isRecord);
    $('np-stop').classList.toggle('hidden', !isRecord);
    chip.classList.toggle('room-score', !isRecord);
    chip.classList.remove('hidden');
  }

  setCollectionValue(value, { visible = true, clean = true, complete = false } = {}) {
    const hud = this.el.collectionHud;
    if (!hud) return;
    hud.classList.toggle('hidden', !visible);
    if (!visible) return;
    this.el.collectionValue.textContent = `€${Math.max(0, Number(value) || 0).toLocaleString('en-GB')}`;
    this.el.collectionStatus.textContent = complete
      ? (clean ? 'ACQUISITION COMPLETE · CLEAN' : 'ACQUISITION COMPLETE · CONTAMINATED')
      : `${clean ? 'CLEAN' : 'CONTAMINATED'} · GOAL €1,000,000`;
    hud.classList.toggle('contaminated', !clean);
    hud.classList.toggle('complete', complete);
  }

  bindNowPlaying(onOpen, onNext, onStop) {
    $('np-open').addEventListener('click', () => onOpen());
    $('np-next').addEventListener('click', () => onNext());
    $('np-stop').addEventListener('click', () => onStop());
  }

  openRecords({ tracks, currentKey, roomName }, onSelect) {
    const colors = ['#b43c32', '#315d78', '#6f4b87'];
    const grid = $('record-grid');
    grid.innerHTML = tracks.map(({ key, title, artist }, index) => {
      const active = key === currentKey;
      const initials = title.split(/\s+/).map((word) => word[0]).join('').slice(0, 3);
      return `<button class="record-choice${active ? ' active' : ''}" data-record-key="${escapeHtml(key)}" aria-pressed="${active}">` +
        `<span class="record-disc" style="--record-color:${colors[index % colors.length]}"><span class="record-label">${escapeHtml(initials)}</span></span>` +
        `<span class="record-copy"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(artist)}</small><span>${active ? 'NOW SPINNING' : 'PLAY RECORD'}</span></span></button>`;
    }).join('');
    grid.querySelectorAll('.record-choice').forEach((button) => {
      button.addEventListener('click', () => onSelect(button.dataset.recordKey));
    });
    this.updateRecords(currentKey, roomName);
    this.show('records');
    (grid.querySelector('.active') ?? grid.querySelector('.record-choice'))?.focus();
  }

  updateRecords(currentKey, roomName) {
    document.querySelectorAll('#record-grid .record-choice').forEach((button) => {
      const active = button.dataset.recordKey === currentKey;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
      const status = button.querySelector('.record-copy span');
      if (status) status.textContent = active ? 'NOW SPINNING' : 'PLAY RECORD';
    });
    $('record-stop').disabled = !currentKey;
    $('record-stop').textContent = currentKey ? `Stop record · return to ${roomName}` : `${roomName} is playing`;
    $('record-room-source').textContent = currentKey ? `${roomName} · ROOM SCORE WAITING` : `${roomName} · ROOM SCORE PLAYING`;
  }

  closeRecords() { this.hide('records'); }

  openShareFallback(url, isLocal) {
    $('share-url').value = url;
    $('share-note').textContent = isLocal
      ? 'This is a local development address. Friends cannot open it until the game is deployed.'
      : 'Copy this link and send it to someone with excellent judgement.';
    this.show('share-fallback');
    $('share-url').focus();
    $('share-url').select();
  }

  closeShareFallback() { this.hide('share-fallback'); }

  /** Tabloid slam: a full-frontal SCANDAL! headline. */
  scandal(headline) {
    const b = $('scandal-banner');
    $('scandal-text').textContent = headline;
    b.classList.remove('hidden', 'slam');
    void b.offsetWidth;               // restart the slam
    b.classList.add('slam');
    clearTimeout(this.#scandalTimer);
    this.#scandalTimer = setTimeout(() => b.classList.add('hidden'), 4650);
  }

  /** The brush's brief corporate era. */
  showSponsor(ms = 25000) {
    const el = $('sponsor-tag');
    el.classList.remove('hidden');
    clearTimeout(this.#sponsorTimer);
    this.#sponsorTimer = setTimeout(() => el.classList.add('hidden'), ms);
  }

  /* ============================================================
     Dialogue view
     ============================================================ */

  openDialogue({ name, role, hint, face, egoLabel = 'EGO' }) {
    this.el.dlgName.textContent = name;
    this.el.dlgRole.textContent = role ?? '';
    this.el.dlgHint.textContent = hint ?? '';
    const img = this.el.dlgPortrait;
    if (face) {
      img.src = encodeURI(face);
      img.alt = name;
      img.classList.remove('hidden');
    } else {
      img.classList.add('hidden');
      img.removeAttribute('src');
      img.alt = '';
    }
    const egoLabelEl = $('dlg-ego-label');
    egoLabelEl.textContent = egoLabel;
    $('dlg-ego').setAttribute('aria-label', egoLabel === 'EGO' ? 'Their ego' : egoLabel);
    this.setEgo(1);
    this.show('dialogue');
  }

  closeDialogue() {
    this.#stopTyping();
    this.hide('dialogue');
  }

  setEgo(frac) {
    this.el.dlgEgo.style.width = `${clamp(frac, 0, 1) * 100}%`;
    this.el.dlgEgo.classList.toggle('hurt', frac < 0.45);
  }

  get isTyping() { return this.#typing !== null; }

  completeLine() {
    if (!this.#typing) return;
    this.#stopTyping();
    this.el.dlgLine.textContent = this.#typingFull;
  }

  #stopTyping() {
    if (this.#typing) clearInterval(this.#typing);
    this.#typing = null;
  }

  /** Typewriter with voice blips. Click / keypress completes instantly. */
  setLine(text, { pitch = 1, audio = null } = {}) {
    this.#stopTyping();
    this.#typingFull = text;
    const el = this.el.dlgLine;
    el.textContent = '';
    let i = 0;
    this.#typing = setInterval(() => {
      i += 1;
      el.textContent = text.slice(0, i);
      if (i % 3 === 0) audio?.talkBlip(pitch);
      if (i >= text.length) this.#stopTyping();
    }, 16);
  }

  showOptions(options, onPick) {
    const wrap = this.el.dlgOptions;
    wrap.innerHTML = '';
    options.forEach((opt, i) => {
      const b = document.createElement('button');
      b.className = `dlg-option tone-${opt.tone}`;
      b.innerHTML =
        `<kbd class="dlg-option-key">${i + 1}</kbd>` +
        `<span class="dlg-option-text">${escapeHtml(opt.text)}</span>` +
        `<span class="dlg-option-tag">${escapeHtml(opt.tag)}</span>`;
      b.addEventListener('click', () => onPick(i));
      wrap.appendChild(b);
    });
  }

  hideOptions() { this.el.dlgOptions.innerHTML = ''; }

  /* ============================================================
     The Séance — the dead artists hotline
     ============================================================ */

  openSeance(artists, { onPick, onAsk }) {
    const wrap = $('seance-portraits');
    wrap.innerHTML = '';
    for (const a of artists) {
      const b = document.createElement('button');
      b.className = 'ghost-chip';
      b.style.setProperty('--ghost-color', a.color);
      b.textContent = a.name[0];
      b.title = a.full;
      b.setAttribute('aria-label', `Consult ${a.full}`);
      b.addEventListener('click', () => {
        for (const x of wrap.children) x.classList.toggle('active', x === b);
        $('seance-ask').disabled = false;
        onPick(a);
      });
      wrap.appendChild(b);
    }
    $('seance-line').textContent = 'The glass is cold. Waiting.';
    $('seance-who').textContent = '';
    $('seance-ask').disabled = true;
    const ask = $('seance-ask');
    ask.onclick = () => onAsk();
    this.show('seance');
  }

  seanceLine(text, artist) {
    const line = $('seance-line');
    line.textContent = text;
    line.style.animation = 'none';
    void line.offsetWidth;
    line.style.animation = '';
    const who = $('seance-who');
    who.textContent = artist ? artist.full.toUpperCase() : '';
    who.style.setProperty('--ghost-color', artist?.color ?? 'var(--ink-faint)');
  }

  closeSeance() { this.hide('seance'); }

  /* ============================================================
     ARTI — the social app for artists
     ============================================================ */

  #artiHandlers = null;
  artiRoster = null;        // [{ id, name, face }] — the followable artworld

  setArtiRoster(roster) { this.artiRoster = roster; }

  /** The HUD phone chip: live follower count with floating deltas. */
  updateArtiChip(count) {
    const el = $('arti-count');
    if (!el) return;
    const prev = el.dataset.v == null ? count : parseInt(el.dataset.v, 10);
    el.dataset.v = String(count);
    el.textContent = count;
    const diff = count - prev;
    if (!diff) return;
    const d = $('arti-delta');
    d.textContent = (diff > 0 ? '+' : '') + diff;
    d.className = (diff > 0 ? 'up' : 'down') + ' pop';
    clearTimeout(this.#artiDeltaTimer);
    this.#artiDeltaTimer = setTimeout(() => { d.textContent = ''; d.className = ''; }, 1300);
  }

  /** The phone demands to be looked at. */
  artiBuzz() {
    const chip = $('arti-chip');
    if (!chip) return;
    chip.classList.remove('buzz');
    void chip.offsetWidth;
    chip.classList.add('buzz');
    clearTimeout(this.#artiBuzzTimer);
    this.#artiBuzzTimer = setTimeout(() => chip.classList.remove('buzz'), 600);
    this.#artiUnread++;
    const b = $('arti-badge');
    b.textContent = this.#artiUnread > 9 ? '9+' : String(this.#artiUnread);
    b.classList.remove('hidden');
  }

  clearArtiUnread() {
    this.#artiUnread = 0;
    $('arti-badge')?.classList.add('hidden');
  }

  openArti(arti, handlers) {
    this.#artiHandlers = handlers;
    $('arti-boost').onclick = () => handlers.onBoost();
    this.clearArtiUnread();
    this.renderArti(arti);
    this.show('arti');
  }

  closeArti() { this.hide('arti'); }

  openCollectorCall(call, onPick) {
    const { callPortrait, callName, callHandle, callRole, callCaption, callTranscript, callOptions } = this.el;
    callPortrait.src = encodeURI(call.face);
    callPortrait.alt = call.name;
    callName.textContent = call.name;
    callHandle.textContent = call.handle;
    callRole.textContent = call.role;
    callCaption.textContent = 'Connecting the portfolio...';
    callTranscript.innerHTML = '';
    callOptions.innerHTML = '';
    this.#callStartedAt = performance.now();
    clearInterval(this.#callTimer);
    this.#callTimer = setInterval(() => {
      const elapsed = Math.floor((performance.now() - this.#callStartedAt) / 1000);
      this.el.callDuration.textContent = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
    }, 250);
    this.show('arti-call');
    this.callLine(call.opening, call.name);
    this.showCallOptions(call.rounds[0]?.options ?? [], onPick);
  }

  callLine(text, speaker = '') {
    const transcript = this.el.callTranscript;
    const row = document.createElement('div');
    row.className = `call-line${speaker ? ' collector-line' : ' painter-line'}`;
    row.innerHTML = `<span class="call-line-who">${escapeHtml(speaker || 'YOU')}</span><span>${escapeHtml(text)}</span>`;
    transcript.appendChild(row);
    transcript.scrollTop = transcript.scrollHeight;
    this.el.callCaption.textContent = text;
    this.el.callPortrait.classList.remove('speaking');
    void this.el.callPortrait.offsetWidth;
    this.el.callPortrait.classList.add('speaking');
  }

  showCallOptions(options, onPick) {
    const wrap = this.el.callOptions;
    wrap.innerHTML = '';
    options.forEach((opt, i) => {
      const b = document.createElement('button');
      b.className = `call-option tone-${opt.tone}`;
      b.innerHTML = `<kbd>${i + 1}</kbd><span>${escapeHtml(opt.text)}</span><small>${escapeHtml(opt.tone)}</small>`;
      b.addEventListener('click', () => onPick(i));
      wrap.appendChild(b);
    });
  }

  closeCollectorCall() {
    clearInterval(this.#callTimer);
    this.#callTimer = null;
    this.el.callPortrait.classList.remove('speaking');
    this.hide('arti-call');
  }

  renderArti(arti) {
    $('arti-followers').textContent = arti.followers;
    $('arti-following').textContent = arti.following;
    $('arti-posts').textContent = arti.posts.length;

    // the people of the artworld — follow them, be followed, regret both
    const people = $('arti-people');
    if (people && this.artiRoster) {
      people.innerHTML = '';
      for (const r of this.artiRoster) {
        const following = arti.followingNPCs.has(r.id);
        const followsYou = arti.npcFollowsYou.has(r.id);
        const row = document.createElement('div');
        row.className = 'arti-person';
        row.innerHTML =
          (r.face
            ? `<img class="arti-ava" src="${encodeURI(r.face)}" alt="" />`
            : `<span class="arti-ava">${escapeHtml(r.name[0])}</span>`) +
          `<div class="arti-p-meta">` +
            `<div class="arti-p-name">${escapeHtml(r.name)}</div>` +
            `<div class="arti-p-handle">${escapeHtml(NPC_HANDLES[r.id] ?? '')}</div>` +
          `</div>` +
          (followsYou ? '<span class="arti-fyou">FOLLOWS YOU</span>' : '') +
          `<button class="arti-follow-btn${following ? ' following' : ''}">${following ? 'Following' : 'Follow'}</button>` +
          (r.id === 'milo' ? '<button class="arti-call-btn">Call</button>' : '');
        row.querySelector('.arti-follow-btn').addEventListener('click', () => {
          this.#artiHandlers?.onToggleFollow(r.id);
        });
        row.querySelector('.arti-call-btn')?.addEventListener('click', () => {
          this.#artiHandlers?.onCall(r.id);
        });
        people.appendChild(row);
      }
    }

    const feed = $('arti-feed');
    feed.innerHTML = '';
    for (const n of arti.notes) {
      const row = document.createElement('div');
      row.className = `arti-note${n.kind === 'sorry' ? ' sorry' : ''}${n.kind === 'follow' ? ' follow' : ''}`;
      const span = document.createElement('span');
      span.textContent = n.text;
      row.appendChild(span);
      if (n.followBack) {
        const b = document.createElement('button');
        b.className = 'arti-fb';
        b.textContent = 'Follow back';
        b.addEventListener('click', () => this.#artiHandlers?.onFollowBack());
        row.appendChild(b);
      }
      feed.appendChild(row);
    }
    for (const p of arti.posts) {
      const el = document.createElement('div');
      el.className = 'arti-post';
      el.innerHTML =
        `<div class="arti-post-title">${escapeHtml(p.title)}</div>` +
        `<div class="arti-post-likes">♥ ${p.likes} likes</div>` +
        p.comments.map((c) => `<div class="arti-comment"><b>${escapeHtml(c.who)}</b> ${escapeHtml(c.text)}</div>`).join('');
      feed.appendChild(el);
    }
  }

  /* ============================================================
     The Map — fast travel between the three studios
     ============================================================ */


  openMap({ current, vaultOpen }, onPick) {
    const grid = $('map-grid');
    grid.innerHTML = '';
    for (const z of MAP_ZONES) {
      const locked = z.key === 'vault' && !vaultOpen;
      const here = z.key === current;
      const card = document.createElement('button');
      card.className = 'map-card' + (here ? ' here' : '') + (locked ? ' locked' : '');
      card.innerHTML =
        `<span class="map-name">${z.name}</span>` +
        `<span class="map-desc">${z.desc}</span>` +
        `<span class="map-status">${here ? 'YOU ARE HERE' : locked ? 'LOCKED — NIGHT THREE' : 'TRAVEL →'}</span>`;
      if (!locked) card.addEventListener('click', () => onPick(z.key));
      else card.disabled = true;
      grid.appendChild(card);
    }
    this.show('map');
  }

  closeMap() { this.hide('map'); }

  /* ============================================================
     Codex (virtues)
     ============================================================ */


  openCodex(state) {
    const grid = this.el.codexGrid;
    grid.innerHTML = '';
    for (const v of VIRTUES) {
      const val = state.virtues[v.key];
      const pct = ((val + 100) / 200) * 100;
      const row = document.createElement('div');
      row.className = 'codex-row';
      row.innerHTML =
        `<div class="codex-head"><span class="codex-name">${v.name}</span>` +
        `<span class="codex-val">${formatSigned(val)}</span></div>` +
        `<div class="codex-corrupted">The Market offers: <em>${v.corrupted}</em></div>` +
        `<div class="codex-track"><div class="codex-pin" style="left:${pct}%"></div></div>`;
      grid.appendChild(row);
    }
    this.show('codex');
  }

  closeCodex() { this.hide('codex'); }

  /* ============================================================
     Naming, night summary, endings, settings
     ============================================================ */

  openNaming(defaultTitle, onConfirm) {
    this.show('naming');
    const input = this.el.namingInput;
    input.value = '';
    input.placeholder = defaultTitle;
    setTimeout(() => input.focus(), 60);
    const confirm = () => {
      const title = input.value.trim() || defaultTitle;
      $('naming-confirm').removeEventListener('click', confirm);
      input.removeEventListener('keydown', onKey);
      input.blur();
      this.hide('naming');
      onConfirm(title.slice(0, 42));
    };
    const onKey = (e) => { if (e.key === 'Enter') confirm(); e.stopPropagation(); };
    $('naming-confirm').addEventListener('click', confirm);
    input.addEventListener('keydown', onKey);
  }

  /** onClose(text) fires with a trimmed note string, or null if the player left nothing. */
  openGhostNote(existingNote, noteExpiresAt, onClose) {
    this.show('ghost-note');
    this.el.ghostNoteText.textContent = existingNote || 'No note left here.';
    const status = this.el.ghostNoteStatus;
    const expiry = Number.isFinite(noteExpiresAt) ? noteExpiresAt : null;
    const updateCountdown = () => {
      const remaining = expiry ? Math.max(0, expiry - Date.now()) : 0;
      if (!existingNote || !expiry || remaining <= 0) {
        if (existingNote && expiry) this.el.ghostNoteText.textContent = 'The note burned away. Only the route remains.';
        status.textContent = existingNote && expiry ? 'The note burned away.' : 'This trace has no message. You can still leave one.';
        status.classList.toggle('burning', Boolean(existingNote && expiry));
        return false;
      }
      const hours = Math.floor(remaining / 3600000);
      const minutes = Math.floor((remaining % 3600000) / 60000);
      status.textContent = `Burns in ${hours}h ${String(minutes).padStart(2, '0')}m · then only the route remains.`;
      status.classList.toggle('burning', remaining <= 15 * 60 * 1000);
      return true;
    };
    updateCountdown();
    const timer = expiry ? setInterval(updateCountdown, 1000) : null;
    const input = this.el.ghostNoteInput;
    input.value = '';
    setTimeout(() => input.focus(), 60);

    const cleanup = () => {
      if (timer) clearInterval(timer);
      $('ghost-note-confirm').removeEventListener('click', confirm);
      $('ghost-note-skip').removeEventListener('click', skip);
      input.removeEventListener('keydown', onKey);
      input.blur();
      status.classList.remove('burning');
      this.hide('ghost-note');
    };
    const confirm = () => { const text = input.value.trim(); cleanup(); onClose(text || null); };
    const skip = () => { cleanup(); onClose(null); };
    const onKey = (e) => {
      if (e.key === 'Enter') confirm();
      else if (e.key === 'Escape') skip();
      e.stopPropagation();
    };
    $('ghost-note-confirm').addEventListener('click', confirm);
    $('ghost-note-skip').addEventListener('click', skip);
    input.addEventListener('keydown', onKey);
  }

  showNightSummary(night, rows, onContinue) {
    this.el.nightEndTitle.textContent = `NIGHT ${['', 'ONE', 'TWO', 'THREE'][night]} — RECOUNTED`;
    const wrap = this.el.nightEndSummary;
    wrap.innerHTML = '';
    const list = rows.length ? rows : [{ label: 'You kept your head down. The artworld barely noticed.', delta: null }];
    list.forEach((r, i) => {
      const div = document.createElement('div');
      div.className = 'night-row';
      div.style.animationDelay = `${i * 70}ms`;
      const delta = r.delta == null
        ? '<span class="nr-delta">—</span>'
        : `<span class="nr-delta ${r.delta >= 0 ? 'pos' : 'neg'}">${formatSigned(Math.round(r.delta))}</span>`;
      div.innerHTML = `<span>${escapeHtml(r.label)}</span>${delta}`;
      wrap.appendChild(div);
    });
    this.show('night-end');
    const btn = $('night-end-continue');
    const go = () => { btn.removeEventListener('click', go); this.hide('night-end'); onContinue(); };
    btn.addEventListener('click', go);
  }

  showEnding(key, state, bodyOverride = null) {
    const e = ENDINGS[key];
    this.el.endingTitle.textContent = e.name;
    this.el.endingBody.textContent = bodyOverride ? `${ENDING_TEXT[key]}\n\n${bodyOverride}` : ENDING_TEXT[key];
    const stats = [
      ['FAME', state.meters.fame], ['INTEGRITY', state.meters.soul], ['CASH', state.meters.cash],
      ['MELTDOWNS', state.stats.meltdowns], ['WORKS MADE', state.stats.paintingsMade],
    ];
    this.el.endingStats.innerHTML = stats.map(([label, v]) =>
      `<div class="ending-stat"><div class="es-num">${Math.round(v)}</div><div class="es-label">${label}</div></div>`
    ).join('');
    this.show('ending');
  }

  renderEndingsStrip(unlocked) {
    this.el.endingsStrip.innerHTML = Object.entries(ENDINGS).map(([key, e]) => {
      const has = unlocked.includes(key);
      return `<div class="endings-dot ${has ? 'unlocked' : ''}" title="${has ? escapeHtml(e.name) : '???'}">${has ? e.name[0] : '?'}</div>`;
    }).join('');
  }

  bindSettings(settings, onChange) {
    const map = [
      ['set-sens', 'sens', (v) => parseFloat(v)],
      ['set-vol', 'vol', (v) => parseFloat(v)],
      ['set-quality', 'quality', (v) => parseFloat(v)],
      ['set-motion', 'reduceMotion', (_, el) => el.checked],
      ['set-inverty', 'invertY', (_, el) => el.checked],
    ];
    for (const [id, key, parse] of map) {
      const el = $(id);
      if (el.type === 'checkbox') el.checked = settings[key];
      else el.value = settings[key];
      el.addEventListener('input', () => {
        settings[key] = parse(el.value, el);
        onChange(key);
      });
    }
  }
}

/* Map destinations — copy lives with the UI that renders it. */

const MAP_ZONES = [
  { key: 'garret', name: 'THE GARRET', desc: 'Home. Turpentine, candles, the mattress of champions.' },
  { key: 'galleria', name: 'GALLERIA BIANCA', desc: 'The white cube. Victoria. The opening. The wine.' },
  { key: 'vault', name: 'THE VAULT', desc: 'Mister Index\'s collection. Invitation only. Bring nerve.' },
  { key: 'documenta', name: 'DOCUMENTA: THE DOCUMENTING', desc: 'Accreditation, cameras, metadata and an exhibition nobody has time to experience.' },
  { key: 'biennaleWaiting', name: 'THE BIENNALE OF WAITING', desc: 'Nine queues, five nations, one prize for remaining publicly stationary.' },
  { key: 'invisibleCollection', name: 'THE INVISIBLE COLLECTION', desc: 'Five empty footprints, three grave officials, and a valuation rising faster than the evidence.' },
  { key: 'leatherLatex', name: 'THE LEATHER & LATEX ROOMS', desc: 'The collector\'s house. Warm hide up front, black gloss in the back — one bassline, two moods.' },
  { key: 'gildedFork', name: 'THE GILDED FORK', desc: 'One long table. Every big shot. All of them drunk and messed up.' },
  { key: 'maxPro', name: 'MAX PRO KUNST 2000', desc: 'Football broadcast. Berlin club. Office boxing. No result.' },
  { key: 'dildoBall', name: 'THE DILDO BALL', desc: 'The collector’s other back room. The court is in session. The heads do not judge.' },
  { key: 'daylightClub', name: 'THE DAYLIGHT FLESH GARDEN', desc: 'An adults-only sculpture club at noon. Chrome poles, generous bodies, moss, and animals with no guest list.' },
  { key: 'upAndCumming', name: 'UP AND CUMMING ARTIST', desc: 'Huge paintings in hard daylight. Muscle Mania 300 refuses every sale. Zebra Zebrason refuses his refusal.' },
  { key: 'vacantEditions', name: 'VACANT EDITIONS', desc: 'Two texture experts. Eight tactile editions. One duct-taped banana cock.' },
  { key: 'hairSalon', name: 'U WISH U HAD HAIR BUT U DONT', desc: 'Six chairs, six immaculate bald heads, and enough mirrors to confirm the situation from every angle.' },
      { key: 'rageRoom', name: 'THE GLASS BOXES', desc: 'Five daylight booths, one weird jazz beat, and MC Freeglass rapping chaos into freedom.' },
  { key: 'fartBoxes', name: 'THREE FART BOXES', desc: 'Three boxes. Three guys. Fart noise. Nothing else.' },
  { key: 'deathMetal', name: 'BARBIE DEATH METAL', desc: 'Punks, death-metal goths, pink amps, and an argument about whether Barbie is a product or a survivor.' },
  { key: 'blackForest', name: 'CHURCH BURNING FIRE SENSATION COCKBURN', desc: 'Ten stave churches. Heavy fog. Thirty-four sponge-squeaking boars. One fictional forest encounter.' },
  { key: 'publicRestroom', name: 'THE PUBLIC RESTROOM', desc: 'Wet ceramic, painted stall fronts, and 132 BPM Techno Zamba made only from piss and fart sounds.' },
  { key: 'listeningRoom', name: 'THE LISTENING ROOM', desc: 'A tempo-reactive live band, two monumental speakers, a switchable player, and twelve coded portraits.' },
  { key: 'mtvCribs', name: 'MTV CRIBS: BABY MONEY', desc: 'Four spoiled adult heirs, a gold formula fridge, and a full camera crew forever chasing the money shot.' },
];



/* Ending prose lives with the UI that renders it. */

const ENDING_TEXT = {
  ascension:
    'Mister Index came apart like a bad investment.\nThe cages opened. Nobody took anything — it was never the point.\n\nYou walk home at dawn with paint on your hands and all eight virtues humming.\nIn the garret, the last canvas waits, blank as forgiveness.\n\nYou begin. Nobody is watching. That is why it matters.',
  sellout:
    'The deal was excellent. The deal is always excellent.\nYour work hangs in The Vault now — climate controlled, rarely seen, eternally appreciating.\n\nOn the last page of the contract, in a cage of your own,\nthere is a small brass plaque: “THE ARTIST — EDITION OF ONE.”\n\nThe wine at your openings is wonderful. You no longer taste it.',
  purist:
    'You refused them all, beautifully, repeatedly, and with escalating style.\nThe garret is cold in the mornings. The candles are cheap. The work is real.\n\nSome nights you hear the city appraising itself in the distance.\nYou turn the canvas to the wall and keep painting.\n\nHistory will find you. History has excellent taste in strays.',
  walked:
    'You looked at the market, and the market looked at you,\nand you were the first to blink — on purpose, like a person.\n\nYou left through the front of the gallery, past the wine, past the whispering,\ninto a morning that had no estimate, no reserve, no buyer.\n\nSomewhere behind you, a door is still open.\nYou are already somewhere else.',
};
