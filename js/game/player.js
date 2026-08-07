/**
 * player.js — first-person controller.
 *
 * Flat-floor design: no gravity, no jumps — the drama is social.
 * Collision: circle (player) vs XZ AABBs (world), resolved per-axis
 * so wall-sliding feels natural.
 */

import * as THREE from 'three';
import { PLAYER } from '../core/config.js';
import { clamp, damp } from '../core/utils.js';

export class PlayerController {
  #yaw = 0;
  #pitch = 0;
  #vel = new THREE.Vector2();        // XZ velocity
  #bobT = 0;
  #sensitivity = 1;
  #invertY = false;
  #reduceMotion = false;
  #frozen = false;                   // dialogues & overlays freeze the body

  constructor(camera, input) {
    this.camera = camera;
    this.input = input;
    this.position = new THREE.Vector3(0, PLAYER.eyeHeight, 0);
    this.moving = false;
    this.sprinting = false;
  }

  setFeel({ sens, invertY, reduceMotion }) {
    if (sens !== undefined) this.#sensitivity = sens;
    if (invertY !== undefined) this.#invertY = invertY;
    if (reduceMotion !== undefined) this.#reduceMotion = reduceMotion;
  }

  setFrozen(v) { this.#frozen = v; }

  teleport(x, z, yaw) {
    this.position.set(x, PLAYER.eyeHeight, z);
    this.#yaw = yaw;
    this.#pitch = 0;
    this.#vel.set(0, 0);
    this.#apply();
  }

  get yaw() { return this.#yaw; }

  forwardDir(out = new THREE.Vector3()) {
    out.set(-Math.sin(this.#yaw), 0, -Math.cos(this.#yaw));
    return out;
  }

  update(dt, colliders) {
    // ---- look ----
    if (!this.#frozen) {
      const { x, y } = this.input.takeLookDelta();
      const sign = this.#invertY ? -1 : 1;
      this.#yaw -= x * PLAYER.lookBase * this.#sensitivity;
      this.#pitch = clamp(
        this.#pitch - y * PLAYER.lookBase * this.#sensitivity * sign,
        -PLAYER.pitchLimit, PLAYER.pitchLimit
      );
    } else {
      this.input.takeLookDelta(); // drain so we don't lurch on resume
    }

    // ---- move ----
    let tx = 0, tz = 0;
    if (!this.#frozen) {
      if (this.input.isDown('forward')) tz -= 1;
      if (this.input.isDown('back')) tz += 1;
      if (this.input.isDown('left')) tx -= 1;
      if (this.input.isDown('right')) tx += 1;
    }
    const len = Math.hypot(tx, tz) || 1;
    this.sprinting = this.input.isDown('sprint') && tz < 0;
    const speed = PLAYER.walkSpeed * (this.sprinting ? PLAYER.sprintMultiplier : 1);

    // camera-relative wish velocity
    const sin = Math.sin(this.#yaw), cos = Math.cos(this.#yaw);
    const wishX = ((tx * cos) - (tz * sin)) / len * speed;
    const wishZ = ((tz * cos) + (tx * sin)) / len * speed;

    this.#vel.x = damp(this.#vel.x, wishX, PLAYER.accel, dt);
    this.#vel.y = damp(this.#vel.y, wishZ, PLAYER.accel, dt);

    this.moving = Math.hypot(this.#vel.x, this.#vel.y) > 0.6;

    // ---- integrate + collide (per axis for wall sliding) ----
    const r = PLAYER.radius;
    let nx = this.position.x + this.#vel.x * dt;
    for (const c of colliders) {
      if (nx + r > c.minX && nx - r < c.maxX && this.position.z + r > c.minZ && this.position.z - r < c.maxZ) {
        nx = this.#vel.x > 0 ? c.minX - r : c.maxX + r;
        this.#vel.x = 0;
      }
    }
    let nz = this.position.z + this.#vel.y * dt;
    for (const c of colliders) {
      if (nx + r > c.minX && nx - r < c.maxX && nz + r > c.minZ && nz - r < c.maxZ) {
        nz = this.#vel.y > 0 ? c.minZ - r : c.maxZ + r;
        this.#vel.y = 0;
      }
    }
    this.position.x = nx;
    this.position.z = nz;

    // ---- head bob ----
    if (this.moving && !this.#reduceMotion) {
      this.#bobT += dt * PLAYER.headBob.freq * (this.sprinting ? 1.3 : 1);
    }
    const bobY = this.#reduceMotion ? 0 : Math.sin(this.#bobT) * PLAYER.headBob.amp;
    this.position.y = PLAYER.eyeHeight + bobY;

    this.#apply();
    return this.moving;
  }

  #apply() {
    this.camera.position.copy(this.position);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(this.#yaw);
    this.camera.rotateX(this.#pitch);
  }
}
