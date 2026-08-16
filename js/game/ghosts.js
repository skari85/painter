/**
 * ghosts.js — other real players, replayed asynchronously.
 *
 * A "ghost" is a looping recreation of a past session's recorded path
 * through a zone: a translucent body (built with the same body-builder
 * NPCs use) walking a fixed loop, with an optional note left behind. No
 * live sync, no AI — just position/yaw interpolation over recorded points.
 */

import * as THREE from 'three';
import { buildBody } from './npc.js';
import { fetchGhosts } from '../core/network.js';

const GHOST_OPACITY = 0.5;
const GHOST_EMISSIVE = 0x8ab4ff;

function makeTranslucent(mats) {
  for (const mat of Object.values(mats)) {
    mat.transparent = true;
    mat.opacity = GHOST_OPACITY;
    mat.depthWrite = false;
    if ('emissive' in mat) {
      mat.emissive = new THREE.Color(GHOST_EMISSIVE);
      mat.emissiveIntensity = 0.25;
    }
  }
}

export class GhostPlayer {
  constructor(record) {
    this.id = record.id;
    this.note = record.note ?? null;
    this.noteExpiresAt = Number.isFinite(record.noteExpiresAt) ? record.noteExpiresAt : null;
    this.path = record.path;

    // id must be unique per ghost — npc.js's faceTexture()/labelTexture() cache by def.id,
    // and a shared/undefined id would make every ghost render with the same cached face.
    const def = { id: record.id, name: 'Someone else', palette: record.palette };
    const parts = buildBody(def);
    this.group = parts.group;
    this.group.traverse((o) => { o.userData.noSplat = true; });
    makeTranslucent(parts.mats);

    // player.position.y is eye-height on this flat-floor game, not a ground
    // coordinate — ghost bodies (like NPCs) always stand at y=0.
    const first = this.path[0];
    this.group.position.set(first.x, 0, first.z);
    this.group.rotation.y = first.yaw;

    this.#duration = this.path[this.path.length - 1].t || 1;
    this.#t = 0;
  }

  #t; #duration;

  get noteRemainingMs() {
    return this.noteExpiresAt ? Math.max(0, this.noteExpiresAt - Date.now()) : 0;
  }

  get noteIsBurning() { return this.noteRemainingMs > 0 && this.noteRemainingMs <= 15 * 60 * 1000; }

  update(dt) {
    if (this.noteExpiresAt && this.noteExpiresAt <= Date.now()) {
      this.note = null;
      this.noteExpiresAt = null;
    }
    this.#t = (this.#t + dt) % this.#duration;
    const { x, z, yaw } = this.#sampleAt(this.#t);
    this.group.position.set(x, 0, z);
    this.group.rotation.y = yaw;
  }

  #sampleAt(t) {
    const path = this.path;
    let i = 0;
    while (i < path.length - 1 && path[i + 1].t < t) i++;
    const a = path[i];
    const b = path[Math.min(i + 1, path.length - 1)];
    const span = Math.max(b.t - a.t, 0.0001);
    const f = Math.max(0, Math.min(1, (t - a.t) / span));
    return {
      x: a.x + (b.x - a.x) * f,
      z: a.z + (b.z - a.z) * f,
      yaw: a.yaw + (b.yaw - a.yaw) * f,
    };
  }
}

export class GhostManager {
  #all = [];

  constructor(world) {
    this.world = world;
  }

  clear() {
    for (const g of this.#all) g.group.removeFromParent();
    this.#all = [];
  }

  async loadZone(zoneKey) {
    this.clear();
    const records = await fetchGhosts(zoneKey);
    if (this.world.current !== zoneKey) return; // player already moved on
    const zone = this.world.zone(zoneKey);
    for (const record of records) {
      if (!record.path || record.path.length === 0) continue;
      const ghost = new GhostPlayer(record);
      zone.group.add(ghost.group);
      this.#all.push(ghost);
    }
  }

  update(dt) {
    for (const g of this.#all) g.update(dt);
  }

  /** Nearest ghost within range & rough facing — mirrors NPCManager.nearest. */
  nearest(playerPos, forward, range) {
    let best = null, bestScore = Infinity;
    for (const g of this.#all) {
      const to = g.group.position.clone().sub(playerPos); to.y = 0;
      const d = to.length();
      if (d > range) continue;
      const facing = to.normalize().dot(forward);
      const score = d - facing;
      if (facing > 0.25 && score < bestScore) { bestScore = score; best = g; }
    }
    return best;
  }
}
