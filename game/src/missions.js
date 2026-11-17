// SOLMAR HEAT — missions.js
// One clear job: the story. Mission steps, the objective beacon, dialogue,
// rewards, and the repeatable side job once the story is finished.

import { MISSIONS, SIDE_JOB_REWARD, STASH_SPOTS, clamp, dist2d } from './config.js';
import { spawnEnemies, clearEnemies } from './combat.js';
import { setWanted } from './vehicles.js';
import { glowTexture } from './textures.js';

export function createMissions(G) {
  const missions = {
    index: 0,
    step: 0,
    active: false,
    objective: null, // {x, z, text, radius}
    beacon: null,
    enemiesSpawned: false,
    sideJob: null,
    done: 0,
    onEnemyKilled: null,
  };
  // A golden beacon column marks the objective in the world.
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xffc21f, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false,
  });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 60, 16, 1, true), beaconMat);
  beacon.visible = false;
  G.scene.add(beacon);
  missions.beacon = beacon;
  const spriteMat = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffc21f, transparent: true, depthWrite: false });
  const marker = new THREE.Sprite(spriteMat);
  marker.scale.set(5, 5, 1);
  marker.visible = false;
  G.scene.add(marker);
  missions.marker = marker;
  return missions;
}

function currentMission(G) {
  return MISSIONS[G.missions.index] ?? null;
}

function currentStep(G) {
  const m = currentMission(G);
  return m ? m.steps[G.missions.step] : null;
}

function setObjective(G, step) {
  const M = G.missions;
  M.objective = step ? { x: step.pos[0], z: step.pos[2], text: step.text, radius: step.radius } : null;
  M.beacon.visible = !!step && step.type !== 'loseWanted';
  M.marker.visible = !!step && step.type !== 'loseWanted';
  if (step) {
    M.beacon.position.set(step.pos[0], 30, step.pos[2]);
    M.marker.position.set(step.pos[0], 4.5, step.pos[2]);
  }
  G.hud.setObjective(step ? step.text : '');
}

function startStep(G) {
  const step = currentStep(G);
  const M = G.missions;
  M.enemiesSpawned = false;
  setObjective(G, step);
  if (!step) return;
  if (step.type === 'killAll' && !M.enemiesSpawned) {
    spawnEnemies(G, step.pos[0], step.pos[2], 6);
    M.enemiesSpawned = true;
    G.hud.toast('The Jackals are here — take them all down.');
  }
  if (step.type === 'loseWanted') {
    setWanted(G, 3);
    G.hud.toast('3 stars! Lose the cops, then reach the safehouse.');
  }
  if (G.missions.index === 4 && G.missions.step === 0) {
    setWanted(G, 4);
  }
}

export function startMissions(G) {
  const M = G.missions;
  if (M.index >= MISSIONS.length) {
    // Story already finished (loaded save): straight to free roam.
    M.active = false;
    startSideJob(G);
    return;
  }
  M.active = true;
  M.step = 0;
  const mission = currentMission(G);
  G.hud.showDialogue(mission.title, mission.intro);
  G.hud.toast(`Mission: ${mission.title} — $${mission.reward}`);
  startStep(G);
}

function advanceStep(G) {
  const M = G.missions;
  const mission = currentMission(G);
  M.step += 1;
  if (M.step >= mission.steps.length) {
    // Mission complete: pay out and move to the next one.
    G.player.cash += mission.reward;
    M.done += 1;
    G.audio.missionDone();
    G.hud.showDialogue('Mission complete', `${mission.title} — you earned $${mission.reward}.`);
    G.hud.toast(`+$${mission.reward} — ${mission.title} complete!`);
    setWanted(G, 0);
    clearEnemies(G);
    M.index += 1;
    M.step = 0;
    if (M.index >= MISSIONS.length) {
      M.active = false;
      setObjective(G, null);
      G.hud.showDialogue('Story complete', 'Nadia: "Solmar is ours now, Leo. The city is yours — free roam, side jobs, stashes."');
      startSideJob(G);
      G.save.write(G);
      return;
    }
    const next = currentMission(G);
    G.hud.showDialogue(next.title, next.intro);
    startStep(G);
    G.save.write(G);
    return;
  }
  startStep(G);
}

// Called when an enemy dies during a killAll step.
export function onEnemyKilled(G) {
  const step = currentStep(G);
  if (!step || step.type !== 'killAll') return;
  const left = G.enemies.filter((e) => e.alive).length;
  G.hud.setObjective(`${step.text} — ${left} left`);
  if (left <= 0) advanceStep(G);
}

export function updateMissions(G, dt) {
  const M = G.missions;
  const p = G.player;
  // Cash stashes: walk or drive over one to collect it.
  for (const stash of G.stashes) {
    if (stash.taken) continue;
    if (dist2d(p.x, p.z, stash.x, stash.z) < 3.2) {
      stash.taken = true;
      stash.mesh.visible = false;
      p.cash += 200;
      p.stashesFound += 1;
      G.audio.cash();
      G.hud.toast('Cash stash found — +$200.');
    }
  }
  if (!M.active) {
    // Free-roam side job: drive to the marker for cash.
    if (M.sideJob) {
      const job = M.sideJob;
      if (dist2d(p.x, p.z, job.x, job.z) < job.radius) {
        p.cash += SIDE_JOB_REWARD;
        G.audio.missionDone();
        G.hud.toast(`Side job done — +$${SIDE_JOB_REWARD}.`);
        startSideJob(G);
      }
    }
    return;
  }
  const step = currentStep(G);
  if (!step) return;
  const d = dist2d(p.x, p.z, step.pos[0], step.pos[2]);
  if (step.type === 'goto' || step.type === 'driveTo') {
    const inCar = step.type === 'driveTo' ? !p.onFoot : true;
    if (d < step.radius && inCar) {
      G.audio.pickup();
      advanceStep(G);
    }
  } else if (step.type === 'stealCar') {
    if (!p.onFoot) advanceStep(G);
  } else if (step.type === 'loseWanted') {
    if (p.wanted === 0) advanceStep(G);
  } else if (step.type === 'killAll') {
    // Advancement happens in onEnemyKilled.
  }
  void dt;
}

export function startSideJob(G) {
  const M = G.missions;
  const spots = [
    [0, 156], [-156, 0], [156, -52], [-52, -156], [104, 104], [-104, -104],
  ];
  const spot = spots[Math.floor(Math.random() * spots.length)];
  M.sideJob = { x: spot[0], z: spot[1], radius: 9 };
  M.beacon.visible = true;
  M.marker.visible = true;
  M.beacon.position.set(spot[0], 30, spot[1]);
  M.marker.position.set(spot[0], 4.5, spot[1]);
  G.hud.setObjective(`Side job: deliver to the marker — $${SIDE_JOB_REWARD}`);
}

export function missionObjectivePos(G) {
  if (G.missions.objective) return { x: G.missions.objective.x, z: G.missions.objective.z };
  if (G.missions.sideJob) return { x: G.missions.sideJob.x, z: G.missions.sideJob.z };
  return null;
}
