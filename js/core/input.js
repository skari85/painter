/**
 * input.js — keyboard, mouse and pointer-lock abstraction.
 *
 * Two consumption models:
 *  - continuous: isDown('forward') for movement
 *  - discrete:   events 'press:interact', 'press:option1', … fired on keydown
 *
 * Look deltas accumulate per frame and are drained by the player controller,
 * which keeps camera motion tied to render rate instead of event frequency.
 */

import { Emitter } from './utils.js';

const KEY_ACTIONS = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
  KeyE: 'interact',
  KeyQ: 'appraise',
  KeyN: 'arti',
  KeyM: 'map',
  KeyP: 'records',
  Escape: 'pause',

  Tab: 'codex',
  Digit1: 'option1', Digit2: 'option2', Digit3: 'option3',
  BracketLeft: 'brushSmaller', BracketRight: 'brushBigger',
  Enter: 'confirm',
};

export class InputManager extends Emitter {
  #down = new Set();
  #lookDX = 0;
  #lookDY = 0;
  locked = false;
  #canvas;

  constructor(canvas) {
    super();
    this.#canvas = canvas;
    this.#bind();
  }

  #bind() {
    window.addEventListener('keydown', (e) => {
      const action = KEY_ACTIONS[e.code];
      if (!action) return;
      if (e.code === 'Tab') e.preventDefault();
      if (e.repeat) return;
      this.#down.add(action);
      this.emit(`press:${action}`);
    });

    window.addEventListener('keyup', (e) => {
      const action = KEY_ACTIONS[e.code];
      if (action) this.#down.delete(action);
    });

    // Losing focus mid-game must not leave keys "stuck" down.
    window.addEventListener('blur', () => this.#down.clear());

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.#canvas;
      this.emit(this.locked ? 'lock' : 'unlock');
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.#lookDX += e.movementX;
      this.#lookDY += e.movementY;
    });

    this.#canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0 && this.locked) this.emit('press:swing');
    });

    // Pointer lock can fail (esc-pressed-too-fast races). Surface, don't throw.
    document.addEventListener('pointerlockerror', () => this.emit('lockerror'));
  }

  requestLock() {
    if (this.locked) return;
    try {
      const p = this.#canvas.requestPointerLock({ unadjustedMovement: true });
      // Older browsers return undefined; newer ones a Promise that can reject.
      if (p?.catch) p.catch(() => {
        try {
          const fallback = this.#canvas.requestPointerLock();
          fallback?.catch?.(() => {});
        } catch { /* pointer lock is optional outside a focused game document */ }
      });
    } catch { /* pointer lock is optional outside a focused game document */ }
  }

  exitLock() {
    if (this.locked) document.exitPointerLock();
  }

  isDown(action) { return this.#down.has(action); }

  /** Frame-rate independent look input, drained once per frame. */
  takeLookDelta() {
    const d = { x: this.#lookDX, y: this.#lookDY };
    this.#lookDX = 0; this.#lookDY = 0;
    return d;
  }

  /** Raw DOM listener escape hatch for UI overlays (they own their keys). */
  releaseAll() { this.#down.clear(); }
}

/** A keyboard+mouse game: detect touch-only devices honestly, once. */
export function isTouchOnlyDevice() {
  return window.matchMedia?.('(pointer: coarse)').matches &&
    !window.matchMedia?.('(pointer: fine)').matches;
}
