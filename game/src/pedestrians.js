// SOLMAR HEAT — pedestrians.js
// One clear job: the people of Solmar — walking the sidewalks, crossing
// streets, and running away when a gun goes off.

import { PED_COUNT, CITY_HALF, clamp, dist2d, mulberry32 } from './config.js';
import { resolveCollisions } from './city.js';

const SHIRTS = [0xe74c3c, 0x3498db, 0xf1c40f, 0x9b59b6, 0x1abc9c, 0xe67e22, 0xecf0f1, 0xfd79a8];

function buildPedMesh(shirtHex) {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc89066 });
  const shirt = new THREE.MeshLambertMaterial({ color: shirtHex });
  const pants = new THREE.MeshLambertMaterial({ color: 0x333340 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.95, 0.42), shirt);
  torso.position.y = 1.1;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.46), skin);
  head.position.y = 1.85;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, 0.34), pants);
  legL.position.set(-0.2, 0.35, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.2;
  group.add(legR);
  group.userData = { legL, legR };
  return group;
}

export function seedPedestrians(G, rng) {
  G.peds = [];
  for (let i = 0; i < PED_COUNT; i++) {
    const mesh = buildPedMesh(SHIRTS[Math.floor(rng() * SHIRTS.length)]);
    G.scene.add(mesh);
    const ped = {
      mesh,
      x: (rng() * 2 - 1) * (CITY_HALF - 20),
      z: (rng() * 2 - 1) * (CITY_HALF - 20),
      heading: rng() * Math.PI * 2,
      speed: 1.2 + rng() * 1.3,
      targetX: 0, targetZ: 0,
      walkPhase: rng() * 10,
      alive: true,
      fleeing: false,
      fleeTimer: 0,
    };
    pickNewTarget(ped);
    G.peds.push(ped);
  }
}

function pickNewTarget(ped) {
  ped.targetX = clamp(ped.x + (Math.random() * 2 - 1) * 90, -CITY_HALF + 10, CITY_HALF - 10);
  ped.targetZ = clamp(ped.z + (Math.random() * 2 - 1) * 90, -CITY_HALF + 10, CITY_HALF - 10);
}

export function scarePedestrians(G, x, z, radius) {
  for (const ped of G.peds) {
    if (!ped.alive) continue;
    if (dist2d(ped.x, ped.z, x, z) < radius) {
      ped.fleeing = true;
      ped.fleeTimer = 4 + Math.random() * 3;
      const away = Math.atan2(ped.x - x, ped.z - z);
      ped.targetX = clamp(ped.x + Math.sin(away) * 60, -CITY_HALF + 10, CITY_HALF - 10);
      ped.targetZ = clamp(ped.z + Math.cos(away) * 60, -CITY_HALF + 10, CITY_HALF - 10);
    }
  }
}

export function updatePedestrians(G, dt) {
  for (const ped of G.peds) {
    if (!ped.alive) continue;
    if (ped.fleeing) {
      ped.fleeTimer -= dt;
      if (ped.fleeTimer <= 0) ped.fleeing = false;
    }
    const dx = ped.targetX - ped.x;
    const dz = ped.targetZ - ped.z;
    const d = Math.hypot(dx, dz);
    if (d < 2) {
      pickNewTarget(ped);
      continue;
    }
    const speed = ped.fleeing ? ped.speed * 2.6 : ped.speed;
    ped.heading = Math.atan2(dx / d, dz / d);
    const nx = ped.x + (dx / d) * speed * dt;
    const nz = ped.z + (dz / d) * speed * dt;
    const fixed = resolveCollisions(nx, nz, 0.6, G.city.colliders);
    ped.x = fixed.x; ped.z = fixed.z;
    ped.walkPhase += dt * speed * 4;
    const swing = Math.sin(ped.walkPhase) * 0.5;
    ped.mesh.userData.legL.rotation.x = swing;
    ped.mesh.userData.legR.rotation.x = -swing;
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.heading;
  }
}
