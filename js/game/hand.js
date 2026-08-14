/**
 * hand.js — the player's visible hands.
 *
 * Procedural low-poly rig parented to the camera:
 *  - right hand grips the brush (the "weapon")
 *  - left hand gestures in dialogue and carries finished work
 *
 * Animation is intent-driven: swing(), gesture(), carrying —
 * update() eases everything toward its target each frame.
 */

import * as THREE from 'three';
import { clamp, damp } from '../core/utils.js';


const SKIN = 0xd9a184;
const SLEEVE = 0x2a2d3a;

function makeHand({ mirror = false }) {
  const hand = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.72 });
  const cloth = new THREE.MeshStandardMaterial({ color: SLEEVE, roughness: 0.9 });

  const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.085, 0.3), cloth);
  forearm.position.z = 0.19;
  hand.add(forearm);

  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.045, 0.11), skin);
  palm.position.z = -0.005;
  hand.add(palm);

  // four curled fingers
  for (let i = 0; i < 4; i++) {
    const finger = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.075), skin);
    finger.position.set(-0.036 + i * 0.024, -0.012, -0.085);
    finger.rotation.x = -0.55;
    hand.add(finger);
  }
  // thumb
  const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.035, 0.06), skin);
  thumb.position.set(mirror ? -0.058 : 0.058, -0.005, -0.03);
  thumb.rotation.set(-0.3, mirror ? -0.5 : 0.5, 0);
  hand.add(thumb);

  return hand;
}

function makeBrush() {
  const brush = new THREE.Group();
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.011, 0.013, 0.3, 8),
    new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.6 })
  );
  handle.rotation.x = Math.PI / 2;
  brush.add(handle);

  const ferrule = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.014, 0.03, 8),
    new THREE.MeshStandardMaterial({ color: 0xb8b2a4, metalness: 0.8, roughness: 0.3 })
  );
  ferrule.rotation.x = Math.PI / 2;
  ferrule.position.z = -0.155;
  brush.add(ferrule);

  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.016, 0.07, 8),
    new THREE.MeshStandardMaterial({ color: 0xe8c15a, roughness: 0.9 })
  );
  tip.rotation.x = -Math.PI / 2;
  tip.position.z = -0.2;
  tip.name = 'brushTip';
  brush.add(tip);

  return brush;
}

function makeZippo() {
  const lighter = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0xb9bcc0, metalness: 0.88, roughness: 0.24 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x34373b, metalness: 0.72, roughness: 0.34 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.115, 0.03), steel);
  body.position.y = 0.025;
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.045, 0.027), darkSteel);
  chimney.position.y = 0.105;
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.018, 12), darkSteel);
  wheel.rotation.z = Math.PI / 2;
  wheel.position.set(0.024, 0.13, 0);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.055, 0.032), steel);
  lid.position.set(-0.06, 0.12, 0);
  lid.rotation.z = 1.18;
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.92, depthWrite: false });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.075, 10), flameMat);
  flame.position.y = 0.18;
  const glow = new THREE.PointLight(0xff8a35, 7.2, 10.5, 1.45);
  glow.position.set(0, 0.18, -0.02);
  lighter.add(body, chimney, wheel, lid, flame, glow);
  lighter.userData.flame = flame;
  lighter.userData.glow = glow;
  return lighter;
}

function makeGasCan() {
  const can = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: 0x8e231c, roughness: 0.58, metalness: 0.22 });
  const edge = new THREE.MeshStandardMaterial({ color: 0x4b1714, roughness: 0.68, metalness: 0.18 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.14), red);
  body.position.y = -0.04;
  const inset = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.31, 0.146), edge);
  inset.position.set(0, -0.04, 0.005);
  const handleTop = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.045, 0.07), edge);
  handleTop.position.set(-0.02, 0.22, 0);
  const handleSide = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.14, 0.07), edge);
  handleSide.position.set(-0.13, 0.17, 0);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.12, 10), red);
  neck.position.set(0.13, 0.23, 0);
  neck.rotation.z = -0.28;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 10), edge);
  cap.position.set(0.145, 0.3, 0);
  cap.rotation.z = -0.28;
  can.add(body, inset, handleTop, handleSide, neck, cap);
  return can;
}

const POSE = {
  idle:    { pos: [0.34, -0.34, -0.62], rot: [-0.25, -0.35, 0.1] },
  swingUp: { pos: [0.42, -0.18, -0.5],  rot: [-1.15, -0.5, 0.35] },
  swingHit:{ pos: [0.1, -0.38, -0.78],  rot: [0.5, 0.35, -0.3] },
};
const LPOSE = {
  idle:   { pos: [-0.36, -0.38, -0.66], rot: [-0.2, 0.4, -0.1] },
  kind:   { pos: [-0.22, -0.3, -0.55],  rot: [-0.9, 0.5, -0.4] },   // open, offering
  witty:  { pos: [-0.2, -0.26, -0.5],   rot: [-0.35, 0.9, -0.55] }, // finger guns adjacent
  brutal: { pos: [-0.12, -0.28, -0.5],  rot: [-0.15, 1.1, 0.0] },   // accusatory point
  carry:  { pos: [-0.3, -0.3, -0.56],   rot: [-0.35, 0.5, -0.15] },

};

export class HandRig {
  /* animation state */
  #swingT = 1;          // 1 = idle; 0..1 during swing
  #gesture = 'idle';
  #bobPhase = 0;
  #reduceMotion = false;
  #forestLoadout = false;
  #hasCarry = false;

  constructor(camera) {

    this.group = new THREE.Group();
    camera.add(this.group);

    this.right = makeHand({ mirror: false });
    this.left = makeHand({ mirror: true });
    this.brush = makeBrush();
    this.brush.position.set(0, 0.01, -0.06);
    this.brush.rotation.set(0.5, 0.15, 0);
    this.right.add(this.brush);
    this.tipMesh = this.brush.getObjectByName('brushTip');

    this.zippo = makeZippo();
    this.zippo.position.set(0, 0.015, -0.075);
    this.zippo.rotation.set(-0.35, 0.08, 0.02);
    this.zippo.visible = false;
    this.right.add(this.zippo);

    // carried canvas — a finished painting under the left arm
    this.carryMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.52, 0.025),
      new THREE.MeshStandardMaterial({ color: 0xefe9dc, roughness: 0.85 })
    );
    this.carryMesh.position.set(-0.02, 0.06, 0.05);
    this.carryMesh.rotation.set(0.1, 0.3, 0.1);

    this.carryMesh.visible = false;
    this.left.add(this.carryMesh);

    this.gasCan = makeGasCan();
    this.gasCan.position.set(-0.03, -0.08, 0.06);
    this.gasCan.rotation.set(0.06, -0.14, -0.05);
    this.gasCan.visible = false;
    this.left.add(this.gasCan);

    this.group.add(this.right, this.left);
  }

  setBrushColor(hex) {

    this.tipMesh.material.color.set(hex);
  }

  setCarry(texture) {
    this.#hasCarry = !!texture;
    if (texture) {
      this.carryMesh.material = new THREE.MeshStandardMaterial({
        map: texture, roughness: 0.85,
      });
      this.carryMesh.visible = !this.#forestLoadout;
      this.#gesture = 'carry';
    } else {
      this.carryMesh.visible = false;
      if (this.#gesture === 'carry') this.#gesture = 'idle';
    }
  }

  /** Swap the painter's normal brush/canvas silhouette for the forest POV. */
  setForestLoadout(active) {
    this.#forestLoadout = active;
    this.brush.visible = !active;
    this.zippo.visible = active;
    this.gasCan.visible = active;
    this.carryMesh.visible = !active && this.#hasCarry;
    if (active && this.#gesture === 'carry') this.#gesture = 'idle';
  }

  /** Trigger a brush swing. Returns active duration so callers can time impact. */
  swing() {
    if (this.#swingT < 1) return 0;   // already swinging — debounce
    this.#swingT = 0;
    return 0.34;
  }

  get impactPoint() { return 0.55; }  // normalized moment the brush "lands"
  get swingProgress() { return this.#swingT; }

  gesture(tone) {
    this.#gesture = tone ?? (this.carryMesh.visible ? 'carry' : 'idle');
  }

  setReduceMotion(v) { this.#reduceMotion = v; }

  setVisible(v) { this.group.visible = v; }

  update(dt, { moving = false, sprinting = false } = {}) {
    // head-bob phase feeds a subtle hand float
    if (moving && !this.#reduceMotion) {
      this.#bobPhase += dt * (sprinting ? 11 : 8);
    }

    // --- right hand: swing animation drives pose ---
    let rTarget = POSE.idle;
    if (this.#swingT < 1) {
      this.#swingT = clamp(this.#swingT + dt / 0.34, 0, 1);
      rTarget = this.#swingT < 0.35
        ? POSE.swingUp
        : this.#swingT < 0.7
          ? POSE.swingHit
          : POSE.idle;
    }
    this.#ease(this.right, rTarget, dt, this.#swingT < 1 ? 22 : 10);

    // --- left hand: gesture pose ---
    const lTarget = LPOSE[this.#gesture] ?? LPOSE.idle;
    this.#ease(this.left, lTarget, dt, 8);

    // --- shared float/bob ---
    const bob = this.#reduceMotion ? 0 : Math.sin(this.#bobPhase) * 0.012;
    const sway = this.#reduceMotion ? 0 : Math.sin(this.#bobPhase * 0.5 + 1.3) * 0.006;
    this.group.position.y = damp(this.group.position.y, bob, 12, dt);
    this.group.position.x = damp(this.group.position.x, sway, 12, dt);

    if (this.#forestLoadout) {
      const flame = this.zippo.userData.flame;
      const glow = this.zippo.userData.glow;
      const flicker = 0.88 + Math.sin(this.#bobPhase * 2.7 + performance.now() * 0.028) * 0.11;
      flame.scale.set(flicker, 0.86 + flicker * 0.18, flicker);
      flame.material.opacity = 0.78 + flicker * 0.16;
      glow.intensity = 5.4 + flicker * 3.1;
    }
  }

  #ease(hand, pose, dt, lambda) {
    hand.position.set(
      damp(hand.position.x, pose.pos[0], lambda, dt),
      damp(hand.position.y, pose.pos[1], lambda, dt),
      damp(hand.position.z, pose.pos[2], lambda, dt),
    );
    hand.rotation.set(
      damp(hand.rotation.x, pose.rot[0], lambda, dt),
      damp(hand.rotation.y, pose.rot[1], lambda, dt),
      damp(hand.rotation.z, pose.rot[2], lambda, dt),
    );
  }
}
