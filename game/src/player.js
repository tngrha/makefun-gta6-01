// SOLMAR HEAT — player.js
// One clear job: Leo Marín on foot — his low-poly character mesh, walking,
// running, camera-facing, and entering / leaving cars.

import { PLAYER, clamp, angleLerp } from './config.js';
import { resolveCollisions } from './city.js';

function buildCharacterMesh() {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xd8a077 });
  const shirt = new THREE.MeshLambertMaterial({ color: 0x2a9d8f });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a2a3a });
  const hair = new THREE.MeshLambertMaterial({ color: 0x1a1210 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.0, 0.45), shirt);
  torso.position.y = 1.15;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skin);
  head.position.y = 1.95;
  group.add(head);
  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.16, 0.54), hair);
  hairTop.position.y = 2.24;
  group.add(hairTop);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.75, 0.36), pants);
  legL.position.set(-0.22, 0.38, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.22;
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.85, 0.3), shirt);
  armL.position.set(-0.58, 1.2, 0);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.58;
  group.add(armR);
  // Pistol in the right hand, visible when armed.
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.5), new THREE.MeshLambertMaterial({ color: 0x181818 }));
  gun.position.set(0.58, 0.85, 0.25);
  gun.name = 'pistol';
  group.add(gun);
  group.userData = { legL, legR, armL, armR };
  return group;
}

export function createPlayer(scene) {
  const mesh = buildCharacterMesh();
  scene.add(mesh);
  return {
    mesh,
    x: 26, z: 26, // start on the plaza by the café
    heading: 0,
    health: PLAYER.maxHealth,
    cash: PLAYER.startCash,
    ammo: PLAYER.startAmmo,
    wanted: 0,
    wantedTimer: 0,
    onFoot: true,
    car: null,
    speed: 0,
    moving: false,
    walkPhase: 0,
    dead: false,
    carsStolen: 0,
    shotsFired: 0,
    shotsHit: 0,
    stashesFound: 0,
  };
}

// Walk / run the player with WASD relative to the camera yaw.
export function updatePlayerOnFoot(G, dt) {
  const p = G.player;
  const input = G.input;
  let fx = 0, fz = 0;
  if (input.keys.has('w') || input.keys.has('arrowup')) fz -= 1;
  if (input.keys.has('s') || input.keys.has('arrowdown')) fz += 1;
  if (input.keys.has('a') || input.keys.has('arrowleft')) fx -= 1;
  if (input.keys.has('d') || input.keys.has('arrowright')) fx += 1;
  const running = input.keys.has('shift');
  const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
  p.moving = fx !== 0 || fz !== 0;
  if (p.moving) {
    const len = Math.hypot(fx, fz);
    fx /= len; fz /= len;
    // Camera-relative: forward is where the camera looks.
    const sin = Math.sin(G.cameraYaw), cos = Math.cos(G.cameraYaw);
    const wx = fx * cos - fz * sin;
    const wz = fx * sin + fz * cos;
    const nx = p.x + wx * speed * dt;
    const nz = p.z + wz * speed * dt;
    const fixed = resolveCollisions(nx, nz, PLAYER.radius, G.city.colliders);
    p.x = fixed.x; p.z = fixed.z;
    p.heading = angleLerp(p.heading, Math.atan2(wx, wz), 1 - Math.pow(0.0001, dt));
    p.walkPhase += dt * (running ? 13 : 9);
    if (Math.floor(p.walkPhase / Math.PI) !== Math.floor((p.walkPhase - dt * 10) / Math.PI)) {
      G.audio.step();
    }
  }
  // Animate the limbs and face the mesh along the heading.
  const u = p.mesh.userData;
  const swing = p.moving ? Math.sin(p.walkPhase) * 0.55 : 0;
  u.legL.rotation.x = swing;
  u.legR.rotation.x = -swing;
  u.armL.rotation.x = -swing * 0.8;
  u.armR.rotation.x = swing * 0.8;
  p.mesh.position.set(p.x, 0, p.z);
  p.mesh.rotation.y = p.heading;
  p.mesh.visible = p.onFoot;
}

export function damagePlayer(G, amount) {
  const p = G.player;
  if (p.dead || G.mode !== 'play' || G.godMode) return;
  p.health -= amount;
  G.hud.flashDamage();
  if (p.health <= 0) {
    p.health = 0;
    p.dead = true;
    G.mode = 'wasted';
    G.audio.siren(false);
    G.audio.crash();
    G.hud.showWasted();
  }
}

export function healPlayer(G, amount) {
  const p = G.player;
  p.health = Math.min(PLAYER.maxHealth, p.health + amount);
}
