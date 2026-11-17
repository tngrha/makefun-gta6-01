// SOLMAR HEAT — main.js
// One clear job: wire the whole game together — renderer, game state, the
// frame loop, the camera, menus, and the deterministic screenshot scenes.

import { GAME_TITLE, SAVE_KEY, STASH_SPOTS, mulberry32 } from './config.js';
import { buildCity } from './city.js';
import { createAudio } from './audio.js';
import { createInput, consumeKey, consumeDrag } from './input.js';
import { createPlayer, updatePlayerOnFoot, damagePlayer } from './player.js';
import * as vehicles from './vehicles.js';
import { seedPedestrians, updatePedestrians } from './pedestrians.js';
import { createCombat, playerShoot, updateEnemies, spawnEnemies } from './combat.js';
import { createMissions, startMissions, updateMissions, onEnemyKilled } from './missions.js';
import { createHud, updateHud, drawMinimap, showTitle, hideTitle, hideWasted } from './hud.js';
import { createSave, applySave } from './save.js';
import { stageShot } from './shots.js';
import { glowTexture } from './textures.js';

const THREE = window.THREE;

window.__solmar = { ready: false, error: null, frames: 0 };
window.addEventListener('error', (e) => {
  window.__solmar.error = String(e.message || e.error || 'unknown error');
  const debug = document.getElementById('debug');
  if (debug) debug.textContent = 'ERROR: ' + window.__solmar.error;
});

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 20261117);
const shotName = params.get('shot');
const rng = mulberry32(seed);

// --- Renderer and scene ------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(0, 30, -80);

// --- Game state --------------------------------------------------------------
const G = {
  scene,
  camera,
  renderer,
  time: 0,
  mode: 'title',
  rng,
  input: createInput(),
  audio: createAudio(),
  save: createSave(),
  city: null,
  player: null,
  cars: [],
  peds: [],
  enemies: [],
  tracers: [],
  fireCooldown: 0,
  stashes: [],
  cameraYaw: 2.4,
  cameraPitch: 0.32,
  lastDragAt: -10,
  combat: null,
  vehicles,
};
G.player = createPlayer(scene);
G.city = buildCity(scene, seed);
G.hud = createHud(G);
G.missions = createMissions(G);
G.missions.onEnemyKilled = (gg) => onEnemyKilled(gg);
G.combat = { spawnEnemies: (gg, x, z, n) => spawnEnemies(gg, x, z, n), playerShoot: (gg) => playerShoot(gg) };
createCombat(G);
vehicles.seedVehicles(G, rng);
seedPedestrians(G, rng);

// Cash stashes: glowing green crates hidden around the city.
for (const [sx, sz] of STASH_SPOTS) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 1.0, 1.4),
    new THREE.MeshLambertMaterial({ color: 0x2ecc71, emissive: 0x1a7a3a }),
  );
  mesh.position.set(sx, 0.7, sz);
  scene.add(mesh);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x55ff88, transparent: true, depthWrite: false }));
  sprite.scale.set(4, 4, 1);
  sprite.position.set(sx, 2, sz);
  scene.add(sprite);
  G.stashes.push({ x: sx, z: sz, mesh, sprite, taken: false });
}

// --- Menus -------------------------------------------------------------------
const saveData = G.save.read();
showTitle(G, saveData);

function startGame(resume) {
  G.audio.unlock();
  hideTitle(G);
  hideWasted(G);
  const p = G.player;
  p.dead = false;
  p.health = 100;
  if (!resume) {
    p.cash = 250;
    p.ammo = 48;
    p.wanted = 0;
    p.x = 26; p.z = 26;
    p.onFoot = true;
    p.car = null;
    G.missions.index = 0;
    G.missions.done = 0;
  } else {
    applySave(G, saveData);
    p.x = 104; p.z = -104; // resume at the safehouse
    p.onFoot = true;
    p.car = null;
  }
  vehicles.setWanted(G, 0);
  G.mode = 'play';
  startMissions(G);
  G.hud.toast(resume ? 'Welcome back to Solmar.' : 'Welcome to Solmar. Steal a car. Make a name.');
}

document.getElementById('btn-start').addEventListener('click', () => startGame(false));
document.getElementById('btn-continue').addEventListener('click', () => startGame(true));
document.getElementById('btn-respawn').addEventListener('click', () => {
  const p = G.player;
  p.dead = false;
  p.health = 100;
  p.cash = Math.max(0, Math.floor(p.cash * 0.9));
  vehicles.setWanted(G, 0);
  p.x = 104; p.z = -104;
  p.onFoot = true;
  p.car = null;
  hideWasted(G);
  G.mode = 'play';
  G.hud.toast('You woke up at the safehouse. The city is still yours.');
});
document.getElementById('btn-quit-title').addEventListener('click', () => {
  G.mode = 'title';
  showTitle(G, G.save.read());
  document.getElementById('pause-screen').style.display = 'none';
});

// --- Camera ------------------------------------------------------------------
function updateCamera(G, dt) {
  const p = G.player;
  const drag = consumeDrag(G.input);
  if (drag.dx !== 0 || drag.dy !== 0) {
    G.cameraYaw -= drag.dx * 0.005;
    G.cameraPitch = Math.max(0.08, Math.min(0.9, G.cameraPitch + drag.dy * 0.003));
    G.lastDragAt = G.time;
  }
  if (G.mode === 'title') {
    // Slow cinematic orbit over downtown for the title screen.
    G.cameraYaw += dt * 0.04;
    const cx = Math.sin(G.cameraYaw) * 120;
    const cz = Math.cos(G.cameraYaw) * 120;
    camera.position.set(cx, 55, cz);
    camera.lookAt(0, 14, 0);
    return;
  }
  // When driving, the camera drifts back behind the car unless the player
  // recently dragged it somewhere else.
  if (p.car && G.time - G.lastDragAt > 2.5) {
    const target = Math.PI - p.car.heading;
    let diff = target - G.cameraYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    G.cameraYaw += diff * Math.min(1, dt * 1.6);
  }
  const dist = p.car ? 15.5 : 8.5;
  const height = 2.2 + Math.tan(G.cameraPitch) * dist;
  const fx = Math.sin(G.cameraYaw);
  const fz = -Math.cos(G.cameraYaw);
  const cx = p.x - fx * dist;
  const cz = p.z - fz * dist;
  camera.position.set(cx, height, cz);
  camera.lookAt(p.x + fx * 5, 1.6, p.z + fz * 5);
}

// --- One fixed simulation step (used by the loop and the shot stager) ---------
function tick(G, dt) {
  G.time += dt;
  const p = G.player;
  if (G.mode !== 'play') return;
  if (p.dead) return;

  // Screenshot scenes keep their scripted driver running after staging.
  if (G.shotDriver) G.shotDriver(dt);

  // Enter / leave a car.
  if (consumeKey(G.input, 'e')) {
    if (p.onFoot) {
      const car = vehicles.nearestCar(G, 5);
      if (car) vehicles.enterCar(G, car);
    } else {
      vehicles.exitCar(G);
    }
  }
  // Pause.
  if (consumeKey(G.input, 'escape') || consumeKey(G.input, 'p')) {
    G.mode = 'paused';
    document.getElementById('pause-screen').style.display = 'flex';
    return;
  }
  // Shoot (click) while on foot.
  if (p.onFoot && G.input.mouseDown) playerShoot(G);

  if (p.onFoot) updatePlayerOnFoot(G, dt);
  else vehicles.updatePlayerCar(G, dt);
  vehicles.updateTraffic(G, dt);
  vehicles.updatePolice(G, dt);
  vehicles.updateWanted(G, dt);
  updatePedestrians(G, dt);
  updateEnemies(G, dt);
  updateMissions(G, dt);

  // Beacon pulse.
  if (G.missions.beacon.visible) {
    G.missions.beacon.rotation.y += dt;
    G.missions.marker.material.opacity = 0.65 + Math.sin(G.time * 4) * 0.3;
  }
  updateHud(G);
  drawMinimap(G);
}
G.tick = (dt) => tick(G, dt);

// --- Frame loop ---------------------------------------------------------------
let last = performance.now();
let fpsFrames = 0;
let fpsTime = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (G.mode === 'paused') {
    // Frozen world, still render so the pause menu sits over the game.
    renderer.render(scene, camera);
    return;
  }
  tick(G, dt);
  updateCamera(G, dt);
  renderer.render(scene, camera);
  window.__solmar.frames += 1;
  fpsFrames += 1;
  fpsTime += dt;
  if (fpsTime >= 1) {
    const debug = document.getElementById('debug');
    if (debug) debug.textContent = `READY mode=${G.mode} fps=${fpsFrames} wanted=${G.player.wanted} cash=${G.player.cash}`;
    fpsFrames = 0;
    fpsTime = 0;
  }
  if (!window.__solmar.ready && window.__solmar.frames > 3) window.__solmar.ready = true;
}

// Resume from pause with Escape / P / click.
window.addEventListener('keydown', (e) => {
  if (G.mode === 'paused' && (e.key === 'Escape' || e.key.toLowerCase() === 'p')) {
    G.mode = 'play';
    G.input.keys.delete('escape');
    G.input.keys.delete('p');
    document.getElementById('pause-screen').style.display = 'none';
  }
  if (G.mode === 'title' && e.key === 'Enter') startGame(!!saveData);
  if (G.mode === 'wasted' && e.key.toLowerCase() === 'r') {
    document.getElementById('btn-respawn').click();
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Screenshot scenes stage themselves before the first frame.
if (shotName) {
  stageShot(G, shotName);
  // Hide the debug line in screenshots (its text stays in the DOM to read).
  document.getElementById('debug').style.display = 'none';
  // In shot mode the world is already simulated; render a few frames so the
  // HUD and minimap are painted before the screenshot is taken.
  for (let i = 0; i < 3; i++) {
    updateCamera(G, 1 / 60);
    renderer.render(scene, camera);
    window.__solmar.frames += 1;
  }
  updateHud(G);
  drawMinimap(G);
  const debug = document.getElementById('debug');
  if (debug) debug.textContent = `READY mode=${G.mode} shot=${shotName} wanted=${G.player.wanted} cash=${G.player.cash}`;
  window.__solmar.ready = true;
}

requestAnimationFrame(frame);
