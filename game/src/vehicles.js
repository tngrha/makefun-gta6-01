// SOLMAR HEAT — vehicles.js
// One clear job: cars. Building car meshes, arcade driving for the player,
// traffic that follows the road grid, and police cars that chase the player.

import { CAR, ROAD_COORDS, ROAD_HALF, CITY_HALF, WANTED, PARKED_CARS, TRAFFIC_COUNT, clamp, angleLerp, dist2d, mulberry32 } from './config.js';
import { resolveCollisions, nearestRoad, onRoad } from './city.js';
import { damagePlayer } from './player.js';

let carIdCounter = 1;

export function buildCarMesh(colourHex, isPolice, isTaxi) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: colourHex });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x181818 });
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.65, 4.4), bodyMat);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.2), glassMat);
  cabin.position.set(0, 1.15, -0.2);
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, darkMat);
    wheel.position.set(wx, 0.42, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  for (const hx of [-0.6, 0.6]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), lightMat);
    head.position.set(hx, 0.6, 2.22);
    group.add(head);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.5), darkMat);
    bar.position.set(0, 1.55, -0.2);
    group.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.set(-0.32, 1.62, -0.2);
    red.name = 'lightRed';
    group.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.5), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    blue.position.set(0.32, 1.62, -0.2);
    blue.name = 'lightBlue';
    group.add(blue);
  }
  if (isTaxi) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0xffd21f }));
    sign.position.set(0, 1.55, -0.2);
    group.add(sign);
  }
  group.userData.wheels = wheels;
  return group;
}

export function spawnCar(G, x, z, heading, opts = {}) {
  const colour = opts.colour ?? CAR.colours[Math.floor(Math.random() * CAR.colours.length)];
  const mesh = buildCarMesh(colour, !!opts.police, !!opts.taxi);
  G.scene.add(mesh);
  const car = {
    id: carIdCounter++,
    mesh,
    x, z,
    heading,
    speed: 0,
    colour,
    name: opts.name ?? CAR.names[Math.floor(Math.random() * CAR.names.length)],
    police: !!opts.police,
    taxi: !!opts.taxi,
    traffic: !!opts.traffic,
    parked: !!opts.parked,
    driver: opts.traffic ? true : false, // traffic cars have a driver to steal from
    health: 100,
    sirenPhase: Math.random() * 10,
    // Traffic AI state:
    axis: 'x', dir: 1, lane: 0, targetSpeed: 10 + Math.random() * 6,
    stuckTimer: 0,
  };
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  G.cars.push(car);
  return car;
}

export function removeCar(G, car) {
  G.scene.remove(car.mesh);
  const i = G.cars.indexOf(car);
  if (i >= 0) G.cars.splice(i, 1);
  if (G.player.car === car) G.player.car = null;
}

// --- Player driving (arcade, forgiving, fun) ------------------------------
export function updatePlayerCar(G, dt) {
  const p = G.player;
  const car = p.car;
  if (!car) return;
  const input = G.input;
  const forward = input.keys.has('w') || input.keys.has('arrowup');
  const back = input.keys.has('s') || input.keys.has('arrowdown');
  const left = input.keys.has('a') || input.keys.has('arrowleft');
  const right = input.keys.has('d') || input.keys.has('arrowright');
  const handbrake = input.keys.has(' ');

  if (forward) car.speed += CAR.accel * dt;
  else if (back) {
    if (car.speed > 0.5) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.accel * 0.5 * dt;
  } else {
    car.speed -= Math.sign(car.speed) * 10 * dt;
    if (Math.abs(car.speed) < 0.3) car.speed = 0;
  }
  if (handbrake) car.speed -= Math.sign(car.speed) * 26 * dt;
  car.speed = clamp(car.speed, -CAR.reverseMax, CAR.maxSpeed);
  // Steering: stronger at low speed, reversed when reversing.
  const steerInput = (left ? 1 : 0) - (right ? 1 : 0);
  const steerFactor = clamp(Math.abs(car.speed) / 12, 0.25, 1);
  car.heading += steerInput * CAR.steerMax * steerFactor * Math.sign(car.speed || 1) * dt * 2.2;

  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const fixed = resolveCollisions(nx, nz, CAR.radius, G.city.colliders);
  const hitWall = fixed.x !== nx || fixed.z !== nz;
  car.x = clamp(fixed.x, -CITY_HALF, CITY_HALF);
  car.z = clamp(fixed.z, -CITY_HALF, CITY_HALF + 40);
  if (hitWall && Math.abs(car.speed) > 8) {
    G.audio.crash();
    car.speed *= 0.4;
    car.health -= 6;
    if (car.health <= 0) explodeCar(G, car);
  }
  // Bumping other cars slows both down.
  for (const other of G.cars) {
    if (other === car || other.parked) continue;
    const d = dist2d(car.x, car.z, other.x, other.z);
    if (d < 4.4 && d > 0.01) {
      const push = (4.4 - d) / 2;
      const ux = (car.x - other.x) / d, uz = (car.z - other.z) / d;
      car.x += ux * push; car.z += uz * push;
      other.x -= ux * push; other.z -= uz * push;
      if (Math.abs(car.speed) > 6) {
        G.audio.crash();
        car.speed *= 0.7;
        other.speed *= 0.6;
      }
    }
  }
  // Running over pedestrians is a crime (and the game says so).
  for (const ped of G.peds) {
    if (!ped.alive) continue;
    if (dist2d(car.x, car.z, ped.x, ped.z) < 2.6) {
      ped.alive = false;
      ped.mesh.visible = false;
      G.audio.crash();
      addWanted(G, 2);
      G.hud.toast('A pedestrian was hit — the city saw that.');
    }
  }
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  const wheelSpin = car.speed * dt * 2.4;
  for (const w of car.mesh.userData.wheels) w.rotation.x += wheelSpin;
  p.x = car.x; p.z = car.z;
  G.audio.setEngine(Math.abs(car.speed) / CAR.maxSpeed, true);
}

export function explodeCar(G, car) {
  // A wrecked car becomes a smoking husk the player must abandon.
  car.health = 0;
  car.speed = 0;
  G.audio.crash();
  G.hud.toast('Your car is wrecked — get out and find another.');
  if (G.player.car === car) exitCar(G);
}

// --- Entering / leaving cars ------------------------------------------------
export function nearestCar(G, maxDist) {
  let best = null, bd = maxDist;
  for (const car of G.cars) {
    if (car.police) continue;
    const d = dist2d(G.player.x, G.player.z, car.x, car.z);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

export function enterCar(G, car) {
  const p = G.player;
  p.car = car;
  p.onFoot = false;
  car.parked = false;
  car.traffic = false;
  p.carsStolen += 1;
  G.audio.pickup();
  if (car.driver) {
    // Stealing an occupied car is a crime the police notice.
    car.driver = false;
    addWanted(G, 1);
    G.hud.toast(`You stole the ${car.name} — 1 star!`);
  } else {
    G.hud.toast(`You took the ${car.name}.`);
  }
}

export function exitCar(G) {
  const p = G.player;
  const car = p.car;
  if (!car) return;
  p.car = null;
  p.onFoot = true;
  p.x = car.x + Math.sin(car.heading + Math.PI / 2) * 3;
  p.z = car.z + Math.cos(car.heading + Math.PI / 2) * 3;
  car.speed = 0;
  G.audio.setEngine(0, false);
}

// --- Wanted level ------------------------------------------------------------
export function addWanted(G, stars) {
  const p = G.player;
  p.wanted = clamp(p.wanted + stars, 0, 5);
  p.wantedTimer = 0;
  syncPolice(G);
  G.hud.updateWanted(p.wanted);
}

export function setWanted(G, stars) {
  G.player.wanted = clamp(stars, 0, 5);
  G.player.wantedTimer = 0;
  syncPolice(G);
  G.hud.updateWanted(G.player.wanted);
}

// Spawn / remove police cars to match the wanted level.
export function syncPolice(G) {
  const wanted = G.player.wanted;
  const wantCount = WANTED[wanted].police;
  const police = G.cars.filter((c) => c.police);
  while (police.length < wantCount) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 55 + Math.random() * 25;
    const x = clamp(G.player.x + Math.sin(angle) * dist, -CITY_HALF + 10, CITY_HALF - 10);
    const z = clamp(G.player.z + Math.cos(angle) * dist, -CITY_HALF + 10, CITY_HALF - 10);
    const car = spawnCar(G, x, z, Math.random() * Math.PI * 2, { police: true, colour: 0x111111, name: 'Interceptor' });
    police.push(car);
  }
  while (police.length > wantCount) {
    const car = police.pop();
    removeCar(G, car);
  }
}

// Wanted decays when no police car is close for a while.
export function updateWanted(G, dt) {
  const p = G.player;
  if (p.wanted === 0) return;
  const police = G.cars.filter((c) => c.police);
  let nearest = Infinity;
  for (const c of police) nearest = Math.min(nearest, dist2d(p.x, p.z, c.x, c.z));
  if (nearest > 60) {
    p.wantedTimer += dt;
    if (p.wantedTimer > 9) {
      p.wanted -= 1;
      p.wantedTimer = 0;
      syncPolice(G);
      G.hud.updateWanted(p.wanted);
      if (p.wanted === 0) G.hud.toast('You lost the cops.');
    }
  } else {
    p.wantedTimer = 0;
  }
  G.audio.siren(police.length > 0 && nearest < 90);
}

// --- Traffic AI: drive along the road grid, turn at intersections -----------
export function updateTraffic(G, dt) {
  for (const car of G.cars) {
    if (!car.traffic) continue;
    // Pick a lane offset and keep to the road centreline.
    const speed = car.targetSpeed;
    let nx = car.x, nz = car.z;
    const heading = car.heading;
    nx += Math.sin(heading) * speed * dt;
    nz += Math.cos(heading) * speed * dt;
    // At an intersection (near a road crossing), sometimes turn.
    const nearX = nearestRoad(nx);
    const nearZ = nearestRoad(nz);
    const atCrossing = Math.abs(nx - nearX) < 3 && Math.abs(nz - nearZ) < 3;
    if (atCrossing && Math.random() < dt * 0.35) {
      const turn = [-Math.PI / 2, 0, Math.PI / 2][Math.floor(Math.random() * 3)];
      car.heading += turn;
    }
    // Stay on roads: if drifting off the grid, snap back toward a road.
    if (!onRoad(nx, nz)) {
      car.heading = Math.atan2(nearestRoad(nx) - car.x, nearestRoad(nz) - car.z);
      nx = car.x + Math.sin(car.heading) * speed * dt;
      nz = car.z + Math.cos(car.heading) * speed * dt;
    }
    // Slow down for the car ahead.
    for (const other of G.cars) {
      if (other === car) continue;
      const dx = other.x - car.x, dz = other.z - car.z;
      const ahead = dx * Math.sin(car.heading) + dz * Math.cos(car.heading);
      const side = Math.abs(dx * Math.cos(car.heading) - dz * Math.sin(car.heading));
      if (ahead > 0 && ahead < 12 && side < 3) {
        nx = car.x + Math.sin(car.heading) * speed * 0.25 * dt;
        nz = car.z + Math.cos(car.heading) * speed * 0.25 * dt;
        break;
      }
    }
    const fixed = resolveCollisions(nx, nz, CAR.radius, G.city.colliders);
    car.x = clamp(fixed.x, -CITY_HALF, CITY_HALF);
    car.z = clamp(fixed.z, -CITY_HALF, CITY_HALF);
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
  }
}

// --- Police AI: chase the player, ram, and flash their lights ---------------
export function updatePolice(G, dt) {
  const p = G.player;
  for (const car of G.cars) {
    if (!car.police) continue;
    car.sirenPhase += dt * 6;
    const red = car.mesh.getObjectByName('lightRed');
    const blue = car.mesh.getObjectByName('lightBlue');
    const on = Math.sin(car.sirenPhase) > 0;
    if (red) red.visible = on;
    if (blue) blue.visible = !on;
    const targetHeading = Math.atan2(p.x - car.x, p.z - car.z);
    car.heading = angleLerp(car.heading, targetHeading, 1 - Math.pow(0.05, dt));
    const top = WANTED[p.wanted].policeSpeed || 30;
    car.speed = Math.min(car.speed + 18 * dt, top);
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    const fixed = resolveCollisions(nx, nz, CAR.radius, G.city.colliders);
    if (fixed.x !== nx || fixed.z !== nz) {
      // Stuck on a building: back up and try a new angle.
      car.heading += Math.PI * 0.7;
      car.speed = 6;
    }
    car.x = clamp(fixed.x, -CITY_HALF, CITY_HALF);
    car.z = clamp(fixed.z, -CITY_HALF, CITY_HALF);
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    // Ramming the player hurts them (or their car). After a ram the police
    // car falls back for a moment, so the chase reads as a chase.
    const d = dist2d(car.x, car.z, p.x, p.z);
    car.ramTimer = Math.max(0, (car.ramTimer || 0) - dt);
    if (d < 3.4 && car.ramTimer <= 0) {
      car.ramTimer = 1.6;
      car.speed *= 0.45;
      if (p.car) {
        p.car.health -= 14;
        p.car.speed *= 0.92;
        if (p.car.health <= 0) explodeCar(G, p.car);
      } else {
        damagePlayer(G, 12);
      }
      G.audio.crash();
    }
  }
}

// Seed the city with parked cars and moving traffic.
export function seedVehicles(G, rng) {
  for (const [x, z, heading] of PARKED_CARS) {
    spawnCar(G, x, z, heading, { parked: true, colour: CAR.colours[Math.floor(rng() * CAR.colours.length)] });
  }
  for (let i = 0; i < TRAFFIC_COUNT; i++) {
    const road = ROAD_COORDS[Math.floor(rng() * ROAD_COORDS.length)];
    const along = (rng() * 2 - 1) * (CITY_HALF - 10);
    const alongX = rng() < 0.5;
    const heading = [0, Math.PI / 2, Math.PI, -Math.PI / 2][Math.floor(rng() * 4)];
    const x = alongX ? along : road + (rng() < 0.5 ? -3.5 : 3.5);
    const z = alongX ? road + (rng() < 0.5 ? -3.5 : 3.5) : along;
    spawnCar(G, x, z, heading, { traffic: true, taxi: rng() < 0.12 });
  }
}
