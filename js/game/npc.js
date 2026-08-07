/**
 * npc.js — the people of the artworld.
 *
 * Procedural low-poly bodies with personality palettes, name sprites,
 * billboard ego bars, waypoint wandering, head-tracking, and the full
 * emotional lifecycle: idle → talk → staggered → MELTDOWN → storm off.
 */

import * as THREE from 'three';
import { Emitter, clamp, damp, rand, pick } from '../core/utils.js';

/* ---------------- shared textures ---------------- */

let splatTex = null;
function getSplatTex() {
  if (splatTex) return splatTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.translate(32, 32);
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 18;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 4 + Math.random() * 9, 0, Math.PI * 2);
    ctx.fill();
  }
  splatTex = new THREE.CanvasTexture(c);
  return splatTex;
}

function labelTexture(name, role) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.textAlign = 'center';
  ctx.font = '700 44px Georgia, serif';
  ctx.fillStyle = '#f2f0ea';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 10;
  ctx.fillText(name, 256, 56);
  if (role) {
    ctx.font = '600 26px Georgia, serif';
    ctx.fillStyle = 'rgba(232,193,90,0.9)';
    ctx.fillText(role.toUpperCase(), 256, 96);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---------------- body factory ---------------- */

const ACCESSORY = {
  wine(g, mats) {
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.12, 8), mats.glass);
    glass.position.set(0.26, 1.08, 0.14);
    g.add(glass);
  },
  phone(g, mats) {
    const phone = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.01), mats.glass);
    phone.position.set(0.26, 1.35, 0.12);
    phone.rotation.x = -0.5;
    g.add(phone);
  },
  clipboard(g, mats) {
    const cb = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.015), mats.wood);
    cb.position.set(-0.26, 1.0, 0.16);
    g.add(cb);
  },
  cane(g, mats) {
    const cane = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.9, 8), mats.wood);
    cane.position.set(0.28, 0.45, 0.1);
    g.add(cane);
  },
  sunglasses(g) {
    const sg = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.05, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.2, metalness: 0.6 })
    );
    sg.position.set(0, 1.64, 0.1);
    g.add(sg);
  },
};

function buildBody(def) {
  const p = def.palette;
  const g = new THREE.Group();
  const mats = {
    skin: new THREE.MeshStandardMaterial({ color: p.skin, roughness: 0.75 }),
    top: new THREE.MeshStandardMaterial({ color: p.top, roughness: 0.85 }),
    bottom: new THREE.MeshStandardMaterial({ color: p.bottom, roughness: 0.9 }),
    hair: new THREE.MeshStandardMaterial({ color: p.hair, roughness: 0.95 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x8a2f3a, roughness: 0.25 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x6b4a30, roughness: 0.7 }),
  };

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.52, 0.13), mats.bottom);
  legL.position.set(-0.09, 0.26, 0);
  const legR = legL.clone(); legR.position.x = 0.09;

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.58, 0.22), mats.top);
  torso.position.y = 0.82;
  torso.name = 'torso';

  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.48, 0.11), mats.top);
  armL.position.set(-0.26, 0.82, 0);
  const armR = armL.clone(); armR.position.x = 0.26;

  const head = new THREE.Group();
  head.position.y = 1.38;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.14, 18, 14), mats.skin);
  skull.position.y = 0.24;
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.145, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
    mats.hair
  );
  hair.position.y = 0.27;
  head.add(skull, hair);

  // blob shadow
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.3, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;

  // name label
  const label = new THREE.Sprite(new THREE.SpriteMaterial({
    map: labelTexture(def.name, def.shortRole ?? def.role), transparent: true, depthWrite: false,
  }));
  label.scale.set(1.5, 0.375, 1);
  label.position.y = 2.12;

  // ego bar (billboarded pair)
  const egoBg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x1c1c22, transparent: true, opacity: 0.85, depthWrite: false }));
  egoBg.scale.set(0.72, 0.055, 1);
  egoBg.position.y = 1.9;
  const egoFill = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x8a5cf6, depthWrite: false }));
  egoFill.center.set(0, 0.5);
  egoFill.scale.set(0.7, 0.035, 1);
  egoFill.position.set(-0.35, 1.9, 0);
  egoFill.visible = egoBg.visible = false;

  g.add(legL, legR, torso, armL, armR, head, shadow, label, egoBg, egoFill);
  if (def.accessory && ACCESSORY[def.accessory]) ACCESSORY[def.accessory](g, mats);

  return { group: g, head, armL, armR, egoBg, egoFill, torso, mats };
}

/* ---------------- the NPC ---------------- */

let nextId = 1;

export class NPC {
  constructor(def, zoneKey) {
    this.uid = nextId++;
    this.def = def;
    this.zoneKey = zoneKey;
    this.ego = def.ego;
    this.maxEgo = def.ego;
    this.state = 'idle';
    this.dead = false;          // stormed off for good (tonight)

    const parts = buildBody(def);
    this.group = parts.group;
    // brush raycasts should never treat a body as a wall
    this.group.traverse((o) => { o.userData.noSplat = true; });

    this.head = parts.head;
    this.armL = parts.armL;
    this.armR = parts.armR;
    this.egoBg = parts.egoBg;
    this.egoFill = parts.egoFill;
    this.torso = parts.torso;

    this.#target = null;
    this.#idleFor = rand(1, 4);
    this.#walkPhase = rand(0, 6);
    this.#staggerT = 0;
    this.#meltdownT = 0;
    this.#exit = null;
    this.#splats = 0;
  }

  #target; #idleFor; #walkPhase; #staggerT; #meltdownT; #exit; #splats;
  #staggerDir = new THREE.Vector3();

  place(pos, faceYaw = rand(0, Math.PI * 2)) {
    this.group.position.copy(pos);
    this.group.rotation.y = faceYaw;
  }

  setEgoVisible(v) {
    this.egoBg.visible = this.egoFill.visible = v;
  }

  updateEgoBar() {
    const f = clamp(this.ego / this.maxEgo, 0, 1);
    this.egoFill.scale.x = 0.7 * f;
    this.egoFill.material.color.set(f > 0.4 ? 0x8a5cf6 : 0xe05d4e);
  }

  beginTalk() { this.state = 'talk'; }
  endTalk() { if (this.state === 'talk') this.state = 'idle'; this.#idleFor = rand(1, 2); }

  stagger(fromDir) {
    if (this.state === 'meltdown' || this.state === 'leaving' || this.dead) return;
    this.state = 'staggered';
    this.#staggerT = 0.75;
    this.#staggerDir.copy(fromDir).setY(0).normalize();
  }

  attachSplat(colorHex) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.24, 0.24),
      new THREE.MeshBasicMaterial({ map: getSplatTex(), color: colorHex, transparent: true, depthWrite: false })
    );
    const face = this.#splats % 3 === 2;
    m.position.set(rand(-0.1, 0.1), face ? 1.62 : rand(0.7, 1.1), 0.13);
    m.rotation.z = rand(0, 6.28);
    m.scale.setScalar(rand(0.7, 1.3));
    this.group.add(m);
    this.#splats++;
  }

  /** The full public collapse. Falls over, lies there, then storms out. */
  meltdown(exitPos) {
    if (this.state === 'meltdown') return;
    this.state = 'meltdown';
    this.#meltdownT = 0;
    this.#exit = exitPos.clone();
    this.setEgoVisible(false);
  }

  update(dt, t, ctx) {
    if (this.dead) return;
    const pos = this.group.position;

    switch (this.state) {
      case 'staggered': {
        this.#staggerT -= dt;
        pos.addScaledVector(this.#staggerDir, dt * 2.4);
        this.group.rotation.z = Math.sin(this.#staggerT * 30) * 0.08;
        if (this.#staggerT <= 0) {
          this.group.rotation.z = 0;
          this.state = 'idle';
          this.#idleFor = rand(0.5, 1.5);
        }
        break;
      }

      case 'meltdown': {
        this.#meltdownT += dt;
        const mt = this.#meltdownT;
        if (mt < 0.7) {
          // vibrate with existential intensity
          this.group.rotation.z = Math.sin(mt * 55) * 0.1;
        } else if (mt < 1.2) {
          const f = (mt - 0.7) / 0.5;
          this.group.rotation.x = -f * Math.PI / 2 * 0.92;
          this.group.rotation.z = 0;
          pos.y = -f * 0.12;
        } else if (mt < 2.2) {
          // lies there. thinking about the market.
        } else {
          this.state = 'leaving';
          this.group.rotation.x = 0;
          pos.y = 0;
        }
        break;
      }

      case 'leaving': {
        const d = this.#exit.clone().sub(pos); d.y = 0;
        const dist = d.length();
        if (dist < 0.5) {
          this.dead = true;
          this.group.visible = false;
          return;
        }
        d.normalize();
        pos.addScaledVector(d, dt * 3.1);
        this.group.rotation.y = Math.atan2(d.x, d.z);
        this.#walkPhase += dt * 14;
        this.#animateWalk(1.4);
        break;
      }

      case 'talk': {
        // face the player, twitch expressively
        const to = ctx.playerPos.clone().sub(pos);
        const yaw = Math.atan2(to.x, to.z);
        this.group.rotation.y = damp(this.group.rotation.y, yaw, 8, dt);
        this.armR.rotation.x = Math.sin(t * 2.2 + this.uid) * 0.28 - 0.2;
        this.armL.rotation.x = Math.sin(t * 1.9 + this.uid * 2) * 0.22;
        this.#trackHead(ctx.playerPos, dt);
        break;
      }

      default: { // idle / wander
        this.#idleFor -= dt;
        if (this.#target) {
          const d = this.#target.clone().sub(pos); d.y = 0;
          const dist = d.length();
          if (dist < 0.35) {
            this.#target = null;
            this.#idleFor = rand(2, 6);
            this.armL.rotation.x = 0;
            this.armR.rotation.x = 0;
          } else {

            d.normalize();
            pos.addScaledVector(d, dt * this.def.pace);
            this.group.rotation.y = damp(this.group.rotation.y, Math.atan2(d.x, d.z), 6, dt);
            this.#walkPhase += dt * 9;
            this.#animateWalk(1);
          }
        } else if (this.#idleFor <= 0) {
          this.#target = pick(ctx.waypoints).clone();
          this.#idleFor = rand(2, 6);
        }

        // head tracks the player when near — the artworld is watching
        if (pos.distanceTo(ctx.playerPos) < 4.5) this.#trackHead(ctx.playerPos, dt);
        else this.head.rotation.y = damp(this.head.rotation.y, 0, 4, dt);
      }
    }
  }

  #animateWalk(intensity) {
    const s = Math.sin(this.#walkPhase) * 0.4 * intensity;
    this.armL.rotation.x = s;
    this.armR.rotation.x = -s;
  }

  #trackHead(playerPos, dt) {
    const to = playerPos.clone().sub(this.group.position);
    const worldYaw = Math.atan2(to.x, to.z);
    let local = worldYaw - this.group.rotation.y;
    while (local > Math.PI) local -= Math.PI * 2;
    while (local < -Math.PI) local += Math.PI * 2;
    this.head.rotation.y = damp(this.head.rotation.y, clamp(local, -1.1, 1.1), 8, dt);
    const pitch = clamp((1.5 - to.y + 0.4) * 0.2, -0.3, 0.35);
    this.head.rotation.x = damp(this.head.rotation.x, -pitch, 8, dt);
  }
}

/* ---------------- manager ---------------- */

export class NPCManager extends Emitter {
  #all = [];
  #barkT = 6;

  constructor(world, audio) {
    super();
    this.world = world;
    this.audio = audio;
  }

  clear() {
    for (const n of this.#all) n.group.removeFromParent();
    this.#all = [];
  }

  spawn(cast, zoneKey) {
    const zone = this.world.zone(zoneKey);
    const anchors = zone.anchors;
    for (const def of cast) {
      const npc = new NPC(def, zoneKey);
      const anchor = def.anchor && anchors[def.anchor]
        ? anchors[def.anchor]
        : pick(zone.waypoints);
      npc.place(anchor.clone());
      zone.group.add(npc.group);
      this.#all.push(npc);
    }
  }

  get inCurrentZone() {
    return this.#all.filter((n) => !n.dead && n.zoneKey === this.world.current);
  }

  byId(id) { return this.#all.find((n) => n.def.id === id) ?? null; }

  /** Nearest duelable/talkable npc within range & rough facing. */
  nearest(playerPos, forward, range) {
    let best = null, bestScore = Infinity;
    for (const n of this.inCurrentZone) {
      if (n.state === 'meltdown' || n.state === 'leaving') continue;
      const to = n.group.position.clone().sub(playerPos); to.y = 0;
      const d = to.length();
      if (d > range) continue;
      const facing = to.normalize().dot(forward);
      const score = d - facing;   // prefer close + centered
      if (facing > 0.25 && score < bestScore) { bestScore = score; best = n; }
    }
    return best;
  }

  /** Anyone standing inside the brush arc? */
  inArc(playerPos, forward, range, arcDot) {
    let best = null, bestD = Infinity;
    for (const n of this.inCurrentZone) {
      if (n.state === 'meltdown' || n.state === 'leaving') continue;
      const to = n.group.position.clone().sub(playerPos); to.y = 0;
      const d = to.length();
      if (d > range || d < 0.01) continue;
      if (to.normalize().dot(forward) >= arcDot && d < bestD) { bestD = d; best = n; }
    }
    return best;
  }

  update(dt, t, playerPos) {
    const waypoints = this.world.waypoints();
    const ctx = { playerPos, waypoints };
    for (const n of this.#all) {
      if (n.zoneKey !== this.world.current) continue;
      n.update(dt, t, ctx);

      // soft personal space — walking through collectors is bad manners
      if (!n.dead) {
        const to = playerPos.clone().sub(n.group.position); to.y = 0;
        const d = to.length();
        if (d < 0.55 && d > 0.001) {
          playerPos.addScaledVector(to.normalize(), (0.55 - d) * 0.6);
        }
      }
    }

    // ambient barks — subtitles from whoever is near enough to overhear
    this.#barkT -= dt;
    if (this.#barkT <= 0) {
      this.#barkT = rand(7, 15);
      const near = this.inCurrentZone.filter(
        (n) => n.state !== 'meltdown' && n.state !== 'leaving' &&
               n.group.position.distanceTo(playerPos) < 8
      );
      if (near.length) {
        const n = pick(near);
        const line = pick(n.def.barks);
        this.emit('bark', { name: n.def.name, text: line, pitch: n.def.pitch });
      }
    }
  }
}
