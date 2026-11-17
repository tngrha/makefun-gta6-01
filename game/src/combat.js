// SOLMAR HEAT — combat.js
// One clear job: shooting, enemy gang members, and the muzzle-flash / tracer
// effects that make a fight read on screen.

import { PLAYER, dist2d, clamp } from './config.js';
import { scarePedestrians } from './pedestrians.js';
import { addWanted } from './vehicles.js';
import { damagePlayer } from './player.js';
import { glowTexture } from './textures.js';

let tracerId = 0;

export function createCombat(G) {
  G.enemies = [];
  G.tracers = [];
  G.fireCooldown = 0;
  G.muzzleFlash = null;
}

function buildEnemyMesh() {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xb0703f });
  const jacket = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const pants = new THREE.MeshLambertMaterial({ color: 0x222226 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.0, 0.45), jacket);
  torso.position.y = 1.15;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skin);
  head.position.y = 1.95;
  group.add(head);
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.12, 0.54), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  band.position.y = 2.05;
  group.add(band);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.75, 0.36), pants);
  legL.position.set(-0.22, 0.38, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.22;
  group.add(legR);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.55), new THREE.MeshLambertMaterial({ color: 0x181818 }));
  gun.position.set(0.5, 1.0, 0.3);
  group.add(gun);
  // A red health bar floating above the head.
  const barBg = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.14), new THREE.MeshBasicMaterial({ color: 0x330000 }));
  barBg.position.y = 2.55;
  group.add(barBg);
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.1), new THREE.MeshBasicMaterial({ color: 0xff3333 }));
  bar.position.set(0, 2.55, 0.01);
  bar.name = 'healthBar';
  group.add(bar);
  group.userData = { legL, legR, bar };
  return group;
}

export function spawnEnemies(G, x, z, count) {
  for (let i = 0; i < count; i++) {
    const mesh = buildEnemyMesh();
    G.scene.add(mesh);
    const enemy = {
      mesh,
      x: x + (Math.random() * 2 - 1) * 14,
      z: z + (Math.random() * 2 - 1) * 14,
      heading: Math.random() * Math.PI * 2,
      health: 100,
      fireTimer: 1 + Math.random() * 2,
      walkPhase: Math.random() * 10,
      alive: true,
    };
    G.enemies.push(enemy);
  }
}

export function clearEnemies(G) {
  for (const e of G.enemies) G.scene.remove(e.mesh);
  G.enemies = [];
}

function showMuzzleFlash(G, from) {
  if (!G.muzzleFlash) {
    const mat = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffdd66, transparent: true, depthWrite: false });
    G.muzzleFlash = new THREE.Sprite(mat);
    G.muzzleFlash.scale.set(1.6, 1.6, 1);
    G.scene.add(G.muzzleFlash);
  }
  G.muzzleFlash.position.copy(from);
  G.muzzleFlash.visible = true;
  G.muzzleFlash.userData.until = G.time + 0.06;
}

function addTracer(G, from, to) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe98a, transparent: true, opacity: 0.9 }));
  G.scene.add(line);
  G.tracers.push({ line, until: G.time + 0.09, id: tracerId++ });
}

function raycastHit(G, origin, dir) {
  // Find the closest enemy or building the shot line crosses.
  const ray = new THREE.Raycaster(origin, dir, 0, PLAYER.pistolRange);
  const targets = [];
  for (const e of G.enemies) {
    if (e.alive) targets.push(e.mesh);
  }
  for (const car of G.cars) targets.push(car.mesh);
  const hits = ray.intersectObjects(targets, true);
  if (hits.length === 0) return null;
  return hits[0];
}

// The player fires the pistol toward the crosshair.
export function playerShoot(G) {
  const p = G.player;
  if (G.fireCooldown > 0 || p.ammo <= 0 || !p.onFoot || p.dead) return false;
  G.fireCooldown = PLAYER.fireInterval;
  p.ammo -= 1;
  p.shotsFired += 1;
  G.audio.gunshot();
  const cam = G.camera;
  const origin = cam.position.clone();
  const dir = new THREE.Vector3();
  cam.getWorldDirection(dir);
  const from = p.mesh.position.clone();
  from.y = 1.4;
  const hit = raycastHit(G, origin, dir);
  const end = hit ? hit.point.clone() : origin.clone().add(dir.clone().multiplyScalar(PLAYER.pistolRange));
  addTracer(G, from, end);
  showMuzzleFlash(G, from);
  if (hit) {
    let obj = hit.object;
    while (obj) {
      const enemy = G.enemies.find((e) => e.mesh === obj);
      if (enemy) {
        enemy.health -= PLAYER.pistolDamage;
        p.shotsHit += 1;
        const bar = enemy.mesh.userData.bar;
        if (bar) bar.scale.x = Math.max(0.01, enemy.health / 100);
        if (enemy.health <= 0) killEnemy(G, enemy);
        break;
      }
      const car = G.cars.find((c) => c.mesh === obj);
      if (car) {
        car.health -= 20;
        if (car.health <= 0 && car.police) {
          // Shooting a police car is a big crime.
          addWanted(G, 1);
        }
        break;
      }
      obj = obj.parent;
    }
  }
  scarePedestrians(G, p.x, p.z, 40);
  addWanted(G, 0); // no-op keep: firing alone does not raise stars here; kills do.
  return true;
}

function killEnemy(G, enemy) {
  enemy.alive = false;
  enemy.mesh.visible = false;
  G.player.cash += 120;
  G.audio.cash();
  G.hud.toast('Jackal down — +$120.');
  G.missions.onEnemyKilled?.(G);
}

// Enemies advance on the player and shoot back (inaccurately).
export function updateEnemies(G, dt) {
  const p = G.player;
  for (const e of G.enemies) {
    if (!e.alive) continue;
    const d = dist2d(e.x, e.z, p.x, p.z);
    const dx = p.x - e.x, dz = p.z - e.z;
    if (d > 14) {
      e.heading = Math.atan2(dx / d, dz / d);
      e.x += (dx / d) * 3.4 * dt;
      e.z += (dz / d) * 3.4 * dt;
      e.walkPhase += dt * 8;
    } else {
      e.heading = Math.atan2(dx / d, dz / d);
      e.fireTimer -= dt;
      if (e.fireTimer <= 0) {
        e.fireTimer = 1.1 + Math.random() * 1.2;
        G.audio.enemyShot();
        const from = e.mesh.position.clone();
        from.y = 1.4;
        addTracer(G, from, p.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0)));
        // Enemies miss often; closer is deadlier.
        if (Math.random() < clamp(0.5 - d / 60, 0.12, 0.45)) {
          if (p.onFoot) damagePlayer(G, 9);
          else if (p.car) { p.car.health -= 4; }
        }
      }
    }
    const swing = Math.sin(e.walkPhase) * 0.5;
    e.mesh.userData.legL.rotation.x = swing;
    e.mesh.userData.legR.rotation.x = -swing;
    e.mesh.position.set(e.x, 0, e.z);
    e.mesh.rotation.y = e.heading;
    // Health bars always face the camera.
    e.mesh.children.forEach((child) => {
      if (child.name === 'healthBar' || child.geometry?.type === 'PlaneGeometry') {
        child.lookAt(G.camera.position);
      }
    });
  }
  // Age out tracers and the muzzle flash.
  for (let i = G.tracers.length - 1; i >= 0; i--) {
    if (G.time > G.tracers[i].until) {
      G.scene.remove(G.tracers[i].line);
      G.tracers.splice(i, 1);
    }
  }
  if (G.muzzleFlash && G.muzzleFlash.visible && G.time > G.muzzleFlash.userData.until) {
    G.muzzleFlash.visible = false;
  }
  G.fireCooldown = Math.max(0, G.fireCooldown - dt);
}
