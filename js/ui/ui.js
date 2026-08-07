/**
 * ui.js — every DOM touchpoint in one place.
 *
 * The 3D game never formats a string; the UI never casts a ray.
 * Talks to the rest of the game through events and small method calls.
 */

import { VIRTUES, ENDINGS } from '../core/config.js';
import { escapeHtml, clamp, formatSigned } from '../core/utils.js';

const $ = (id) => document.getElementById(id);

export class UIManager {
  #typing = null;         // interval id
  #subtitleTimer = null;
  #typingFull = '';

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
      hitmarker: $('hitmarker'),
      interact: $('interact-prompt'),
      interactText: $('interact-text'),
      subtitle: $('subtitle'),
      toasts: $('toasts'),
      damageLayer: $('damage-layer'),
      hint: $('hint-bar'),
      dialogue: $('dialogue'),
      dlgName: $('dlg-name'),
      dlgRole: $('dlg-role'),
      dlgLine: $('dlg-line'),
      dlgOptions: $('dlg-options'),
      dlgEgo: $('dlg-ego-fill'),
      dlgHint: $('dlg-weakness-hint'),
      curtain: $('curtain'),
      credPulse: $('cred-pulse'),
      title: $('title-screen'),
      endingsStrip: $('endings-strip'),
      howto: $('howto'),
      settings: $('settings'),
      pause: $('pause'),
      codex: $('codex'),
      codexGrid: $('codex-grid'),
      naming: $('naming'),
      namingInput: $('naming-input'),
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
    };
  }

  /* ============================================================
     Screens & transitions
     ============================================================ */

  show(name) { $(name)?.classList.remove('hidden'); }
  hide(name) { $(name)?.classList.add('hidden'); }

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

  subtitle(name, text, pitch, audio) {
    clearTimeout(this.#subtitleTimer);
    this.el.subtitle.innerHTML =
      `<span class="who">${escapeHtml(name)}</span>${escapeHtml(text)}`;
    this.show('subtitle');
    audio?.talkBlip(pitch ?? 1);
    this.#subtitleTimer = setTimeout(() => this.hide('subtitle'), 4200);
  }

  /* ============================================================
     Dialogue view
     ============================================================ */

  openDialogue({ name, role, hint }) {
    this.el.dlgName.textContent = name;
    this.el.dlgRole.textContent = role ?? '';
    this.el.dlgHint.textContent = hint ?? '';
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
      this.hide('naming');
      onConfirm(title.slice(0, 42));
    };
    const onKey = (e) => { if (e.key === 'Enter') confirm(); e.stopPropagation(); };
    $('naming-confirm').addEventListener('click', confirm);
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

  showEnding(key, state) {
    const e = ENDINGS[key];
    this.el.endingTitle.textContent = e.name;
    this.el.endingBody.textContent = ENDING_TEXT[key];
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
