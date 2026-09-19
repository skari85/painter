/**
 * livePlayers.js — other real people, live, in the same room.
 *
 * The multiplayer layer, in full: every ~1.3s each open tab POSTs its own
 * spot (+ an optional chat line) to the /presence route and gets back a
 * snapshot of everyone else currently live in the same zone. No WebSocket,
 * no lobby — just a heartbeat, the same fail-soft contract as ghosts.js
 * (missing/misconfigured endpoint → nobody else ever appears, silently).
 *
 * Bodies reuse npc.js's buildBody() exactly like a GhostPlayer does, so a
 * live player looks and labels itself the same way an NPC does — except it
 * is a stranger's real position, glided toward smoothly between beats, and
 * whatever nonsense they just typed shows up over their head.
 *
 * Emits 'line' — { anchor: THREE.Vector3, name, text, pitch } — once per
 * fresh chat line, for main.js to project to screen space and bubble.
 */

import { buildBody } from './npc.js';
import { personaById, getSessionId } from './identity.js';
import { syncPresence } from '../core/network.js';
import { Emitter, lerp } from '../core/utils.js';

const HEARTBEAT_INTERVAL = 1.3; // seconds between presence polls
const FIRST_BEAT_DELAY = 0.3;   // beat quickly on entering a zone

function wrapAngle(a) {
  a %= Math.PI * 2;
  if (a > Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  return a;
}

class LivePlayer {
  lastLineAt = null;
  #t = 0;
  #duration = 0.001;

  constructor(record) {
    this.sessionId = record.sessionId;
    this.pitch = personaById(record.personaId)?.pitch ?? 1;

    // id must be unique per player — npc.js's faceTexture()/labelTexture()
    // cache by def.id, and a shared/undefined id would render every live
    // player with the same cached face and name label.
    const def = { id: record.sessionId, name: record.name, palette: record.palette };
    this.group = buildBody(def).group;
    this.group.traverse((o) => { o.userData.noSplat = true; });

    // live bodies (like NPCs and ghosts) always stand at y=0 — the y a peer
    // reports is their eye height, not a ground coordinate.
    this.from = { x: record.x, z: record.z, yaw: record.yaw };
    this.to = this.from;
    this.group.position.set(record.x, 0, record.z);
    this.group.rotation.y = record.yaw;
  }

  /** A fresh target arrived; glide there over `duration` from wherever we are now. */
  setTarget(record, duration) {
    const cur = this.#sampleAt(this.#t);
    this.from = cur;
    this.to = { x: record.x, z: record.z, yaw: cur.yaw + wrapAngle(record.yaw - cur.yaw) };
    this.#t = 0;
    this.#duration = Math.max(duration, 0.05);
  }

  update(dt) {
    this.#t += dt;
    const { x, z, yaw } = this.#sampleAt(this.#t);
    this.group.position.set(x, 0, z);
    this.group.rotation.y = yaw;
  }

  #sampleAt(t) {
    const f = Math.min(1, t / this.#duration);
    return {
      x: lerp(this.from.x, this.to.x, f),
      z: lerp(this.from.z, this.to.z, f),
      yaw: lerp(this.from.yaw, this.to.yaw, f),
    };
  }

  dispose() { this.group.removeFromParent(); }
}

export class LivePlayerManager extends Emitter {
  #world;
  #zoneKey = null;
  #players = new Map(); // sessionId -> LivePlayer
  #persona = null;
  #timer = FIRST_BEAT_DELAY;
  #pendingLine = null;
  #inflight = false;
  #pos = null;

  constructor(world) {
    super();
    this.#world = world;
  }

  /** Which persona this tab presents as. Presence is silent until this is set. */
  setIdentity(persona) {
    this.#persona = persona;
  }

  onZoneChange(zoneKey) {
    this.clear();
    this.#zoneKey = zoneKey;
    this.#timer = FIRST_BEAT_DELAY;
  }

  clear() {
    for (const lp of this.#players.values()) lp.dispose();
    this.#players.clear();
  }

  /** Queue a chat line to ride the very next heartbeat. */
  sendLine(text) {
    if (!text) return;
    this.#pendingLine = text;
    this.#timer = 0;
  }

  update(dt) {
    for (const lp of this.#players.values()) lp.update(dt);
    if (!this.#persona || !this.#zoneKey) return;

    this.#timer -= dt;
    if (this.#timer <= 0 && !this.#inflight) {
      this.#timer = HEARTBEAT_INTERVAL;
      this.#inflight = true;
      const line = this.#pendingLine;
      this.#pendingLine = null;
      this.#beat(line).finally(() => { this.#inflight = false; });
    }
  }

  async #beat(line) {
    const zoneKey = this.#zoneKey;
    const pos = this.#pos;
    if (!pos) return;
    const players = await syncPresence({
      zoneKey,
      sessionId: getSessionId(),
      x: pos.x, y: pos.y, z: pos.z, yaw: pos.yaw,
      personaId: this.#persona.id,
      displayName: this.#persona.name,
      palette: this.#persona.palette,
      line,
    });
    // Offline/unconfigured, or the zone moved on while this was in flight.
    if (players === null || this.#zoneKey !== zoneKey) return;
    this.#reconcile(players);
  }

  /** Called once per frame by main.js with the local player's own spot. */
  setLocalPose(x, y, z, yaw) {
    this.#pos = { x, y, z, yaw };
  }

  #reconcile(records) {
    const seen = new Set();
    for (const record of records) {
      seen.add(record.sessionId);
      let lp = this.#players.get(record.sessionId);
      if (!lp) {
        lp = new LivePlayer(record);
        this.#players.set(record.sessionId, lp);
        this.#world.zone(this.#zoneKey).group.add(lp.group);
      } else {
        lp.setTarget(record, HEARTBEAT_INTERVAL);
      }
      if (record.lineAt && record.lineAt !== lp.lastLineAt) {
        lp.lastLineAt = record.lineAt;
        this.emit('line', { anchor: lp.group.position, name: record.name, text: record.line, pitch: lp.pitch });
      }
    }
    for (const [id, lp] of this.#players) {
      if (!seen.has(id)) { lp.dispose(); this.#players.delete(id); }
    }
  }
}
