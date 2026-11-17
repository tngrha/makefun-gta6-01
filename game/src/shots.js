// SOLMAR HEAT — shots.js
// One clear job: deterministic demo scenes for the screenshots. Each scene
// plays the real game forward from a fresh world for a fixed number of
// steps with a scripted driver, so the frame is what a short game really
// looks like and the same seed always gives the same frame.
//
// URL: ?shot=chase | drive | foot | start  (any other value is the title)

import { clamp } from './config.js';

// A driver that follows a list of road waypoints in a loop, steering the
// player's car toward the current one and advancing when it gets close.
// Keeps the car on the roads, so a chase reads as a chase, not a shortcut
// through the buildings.
export function makeRoadDriver(G, waypoints) {
  let index = 0;
  return function roadDriver(dt) {
    const p = G.player;
    const car = p.car;
    if (!car) return;
    const target = waypoints[index % waypoints.length];
    const dx = target[0] - car.x, dz = target[1] - car.z;
    if (Math.hypot(dx, dz) < 14) {
      index += 1;
      return;
    }
    driveToward(G, target[0], target[1], dt);
  };
}

function driveToward(G, tx, tz, dt, throttle = true) {
  const p = G.player;
  const car = p.car;
  if (!car) return;
  const dx = tx - car.x, dz = tz - car.z;
  const want = Math.atan2(dx, dz);
  let diff = want - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.heading += clamp(diff, -0.9 * dt, 0.9 * dt);
  if (throttle) car.speed = Math.min(car.speed + 20 * dt, 30);
  void dt;
}

function walkToward(G, tx, tz, dt) {
  const p = G.player;
  const dx = tx - p.x, dz = tz - p.z;
  const d = Math.hypot(dx, dz);
  if (d < 1) return;
  // Steer the camera so "forward" points at the target, then hold W.
  G.cameraYaw = Math.atan2(dx, -dz);
  G.input.keys.add('w');
  void dt;
}

// Run the game loop's fixed update N times without rendering.
function runSteps(G, seconds, perStep) {
  const dt = 1 / 60;
  const n = Math.floor(seconds / dt);
  for (let i = 0; i < n; i++) {
    if (perStep) perStep(dt);
    G.tick(dt);
  }
  G.input.keys.clear();
}

export function stageShot(G, name) {
  const p = G.player;
  G.mode = 'play';
  G.hud.hideTitle();
  G.audio.unlock();

  if (name === 'start') {
    // Title screen over the downtown skyline at golden hour.
    G.mode = 'title';
    G.cameraYaw = 2.4;
    p.x = 0; p.z = -60;
    G.camera.position.set(-30, 26, -150);
    G.camera.lookAt(0, 18, 0);
    G.hud.showTitle(G.save.read());
    return { screen: 'title' };
  }

  if (name === 'drive') {
    // Cruising down Palm Boulevard through traffic, mission 1 active.
    G.missions.index = 0;
    G.missions.step = 2;
    G.missions.active = true;
    G.missions.objective = { x: 52, z: 52, text: "Drive to Nadia's café", radius: 9 };
    G.hud.setObjective("Drive to Nadia's café");
    const car = G.cars.find((c) => c.parked) || G.cars[0];
    G.vehicles.enterCar(G, car);
    car.mesh.children[0].material.color.set(0xd23b2e);
    car.x = 0; car.z = -140; car.heading = 0;
    G.shotDriver = makeRoadDriver(G, [[0, 104], [52, 104], [52, -104], [-52, -104], [-52, 104], [0, 104]]);
    runSteps(G, 7, null);
    G.cameraYaw = Math.PI - car.heading;
    return { screen: 'play' };
  }

  if (name === 'foot') {
    // On foot at the docks, mission 4 shootout in progress.
    G.missions.index = 3;
    G.missions.step = 1;
    G.missions.active = true;
    G.missions.objective = { x: -130, z: 178, text: 'Take down the Jackals (6)', radius: 30 };
    G.hud.setObjective('Take down the Jackals (6)');
    G.combat.spawnEnemies(G, -130, 178, 6);
    p.x = -112; p.z = 158;
    p.heading = Math.atan2(-130 - p.x, 178 - p.z);
    G.godMode = true; // the demo player cannot die mid-screenshot
    G.cameraYaw = Math.atan2(-130 - p.x, -(178 - p.z));
    G.hud.showDialogue('Dockside Deal', 'Nadia: "The Jackals are moving in on the docks. Clear them out."');
    runSteps(G, 2.5, (dt) => walkToward(G, -118, 168, dt));
    // Point the camera at the gang before firing, so the tracer reads.
    G.camera.position.set(p.x - Math.sin(G.cameraYaw) * 8.5, 5, p.z + Math.cos(G.cameraYaw) * 8.5);
    G.camera.lookAt(-130, 1.5, 178);
    // Fire once so a tracer and muzzle flash read in the frame.
    G.combat.playerShoot(G);
    runSteps(G, 0.4, null);
    return { screen: 'play' };
  }

  // Default: 'chase' — the cover. Wanted 3, police on the tail, mission live.
  G.missions.index = 4;
  G.missions.step = 0;
  G.missions.active = true;
  G.missions.objective = { x: 0, z: 156, text: 'Checkpoint 1: Palm Boulevard', radius: 10 };
  G.hud.setObjective('Checkpoint 1: Palm Boulevard');
  G.vehicles.setWanted(G, 3);
  const car = G.cars.find((c) => c.parked) || G.cars[0];
  G.vehicles.enterCar(G, car);
  car.mesh.children[0].material.color.set(0xd23b2e);
  car.x = 52; car.z = -100; car.heading = 0;
  car.speed = 24;
  G.shotDriver = makeRoadDriver(G, [[52, 140], [52, -140], [-52, -140], [-52, 140], [52, 140]]);
  runSteps(G, 8, null);
  G.cameraYaw = Math.PI - car.heading;
  return { screen: 'play' };
}
