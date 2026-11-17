// SOLMAR HEAT — hud.js
// One clear job: the 2D interface — wanted stars, cash, health, ammo,
// mission objective, dialogue, toasts, the minimap, and the start screen.

import { GAME_TITLE, GAME_SUBTITLE, CITY_HALF, clamp } from './config.js';

export function createHud(G) {
  const el = (id) => document.getElementById(id);
  const hud = {
    root: el('hud'),
    cash: el('cash'),
    stars: el('stars'),
    healthFill: el('health-fill'),
    healthText: el('health-text'),
    ammo: el('ammo'),
    speed: el('speed'),
    objective: el('objective'),
    objectiveDist: el('objective-dist'),
    dialogue: el('dialogue'),
    dialogueTitle: el('dialogue-title'),
    dialogueText: el('dialogue-text'),
    toastEl: el('toast'),
    minimap: el('minimap'),
    crosshair: el('crosshair'),
    hint: el('hint'),
    damageFlash: el('damage-flash'),
    wasted: el('wasted'),
    title: el('title-screen'),
    titleCash: el('title-save'),
    btnContinue: el('btn-continue'),
    pause: el('pause-screen'),
    toastTimer: null,
    dialogueTimer: null,
  };
  hud.minimapCtx = hud.minimap.getContext('2d');
  // Methods the game calls as G.hud.toast(...) and friends.
  hud.toast = (text) => showToast(G, text);
  hud.setObjective = (text) => setObjectiveText(G, text);
  hud.showDialogue = (title, text) => showDialogue(G, title, text);
  hud.flashDamage = () => flashDamage(G);
  hud.showWasted = () => showWasted(G);
  hud.hideWasted = () => hideWasted(G);
  hud.showTitle = (save) => showTitle(G, save);
  hud.hideTitle = () => hideTitle(G);
  hud.updateWanted = () => { /* stars are redrawn every frame in updateHud */ };
  return hud;
}

function starString(wanted) {
  let s = '';
  for (let i = 0; i < 5; i++) s += i < wanted ? '★' : '☆';
  return s;
}

export function updateHud(G) {
  const H = G.hud;
  const p = G.player;
  H.cash.textContent = '$' + p.cash.toLocaleString('en-US');
  H.stars.textContent = starString(p.wanted);
  H.stars.className = p.wanted > 0 ? 'wanted-hot' : '';
  H.healthFill.style.width = clamp(p.health, 0, 100) + '%';
  H.healthFill.style.background = p.health > 50 ? '#37d67a' : p.health > 25 ? '#f5a623' : '#e74c3c';
  H.healthText.textContent = Math.ceil(p.health) + ' HP';
  H.ammo.textContent = p.onFoot ? `Ammo ${p.ammo}` : (p.car ? p.car.name : '');
  H.speed.style.display = p.car ? 'block' : 'none';
  if (p.car) H.speed.textContent = Math.round(Math.abs(p.car.speed) * 2.4) + ' km/h';
  H.crosshair.style.display = p.onFoot && G.mode === 'play' ? 'block' : 'none';
  // Objective distance.
  const obj = G.missions.objective || G.missions.sideJob;
  if (obj) {
    const d = Math.hypot(G.player.x - obj.x, G.player.z - obj.z);
    H.objectiveDist.textContent = Math.round(d) + 'm';
  } else {
    H.objectiveDist.textContent = '';
  }
  // Context hint.
  let hint = '';
  if (G.mode === 'play') {
    if (p.onFoot) {
      const near = G.vehicles.nearestCar(G, 5);
      hint = near ? 'Press E to steal the car' : 'WASD move · Shift run · Click shoot · E enter car';
    } else {
      hint = 'WASD drive · Space handbrake · E leave car';
    }
  }
  H.hint.textContent = hint;
}

export function setObjectiveText(G, text) {
  G.hud.objective.textContent = text;
}

export function showToast(G, text) {
  const H = G.hud;
  H.toastEl.textContent = text;
  H.toastEl.style.opacity = '1';
  clearTimeout(H.toastTimer);
  H.toastTimer = setTimeout(() => { H.toastEl.style.opacity = '0'; }, 3400);
}

export function showDialogue(G, title, text) {
  const H = G.hud;
  H.dialogueTitle.textContent = title;
  H.dialogueText.textContent = text;
  H.dialogue.style.display = 'block';
  clearTimeout(H.dialogueTimer);
  H.dialogueTimer = setTimeout(() => { H.dialogue.style.display = 'none'; }, 6000);
}

export function flashDamage(G) {
  const H = G.hud;
  H.damageFlash.style.opacity = '0.45';
  setTimeout(() => { H.damageFlash.style.opacity = '0'; }, 120);
}

export function showWasted(G) {
  G.hud.wasted.style.display = 'flex';
}

export function hideWasted(G) {
  G.hud.wasted.style.display = 'none';
}

export function showTitle(G, save) {
  const H = G.hud;
  H.title.style.display = 'flex';
  H.root.style.display = 'none'; // the HUD belongs to gameplay, not the menu
  H.btnContinue.style.display = save ? 'inline-block' : 'none';
  if (save && typeof save.cash === 'number') {
    H.titleCash.textContent = `Continue — $${save.cash.toLocaleString('en-US')} · ${save.missionsDone} mission${save.missionsDone === 1 ? '' : 's'} done`;
    H.titleCash.style.display = 'block';
  } else {
    H.titleCash.style.display = 'none';
  }
}

export function hideTitle(G) {
  G.hud.title.style.display = 'none';
  G.hud.root.style.display = 'block';
}

export function showPause(G, on) {
  G.hud.pause.style.display = on ? 'flex' : 'none';
}

// --- The minimap ------------------------------------------------------------
export function drawMinimap(G) {
  const H = G.hud;
  const ctx = H.minimapCtx;
  const S = 200;
  const scale = S / (CITY_HALF * 2 + 80);
  const toMap = (x, z) => [(x + CITY_HALF + 40) * scale, (z + CITY_HALF + 40) * scale];
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = '#1d2b1d';
  ctx.fillRect(0, 0, S, S);
  // Sea at the bottom (south).
  ctx.fillStyle = '#2e7fa8';
  const [, seaY] = toMap(0, 196);
  ctx.fillRect(0, seaY, S, S - seaY);
  // Roads.
  ctx.strokeStyle = '#5a5f66';
  ctx.lineWidth = 4;
  for (const c of [-156, -104, -52, 0, 52, 104, 156]) {
    const [x1] = toMap(c, 0);
    ctx.beginPath(); ctx.moveTo(x1, 0); ctx.lineTo(x1, S); ctx.stroke();
    const [, y1] = toMap(0, c);
    ctx.beginPath(); ctx.moveTo(0, y1); ctx.lineTo(S, y1); ctx.stroke();
  }
  // Objective marker.
  const obj = G.missions.objective || G.missions.sideJob;
  if (obj) {
    const [ox, oy] = toMap(obj.x, obj.z);
    ctx.fillStyle = '#ffc21f';
    ctx.beginPath(); ctx.arc(ox, oy, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(ox, oy, 9, 0, Math.PI * 2); ctx.stroke();
  }
  // Police cars as blue dots.
  for (const car of G.cars) {
    if (!car.police) continue;
    const [cx, cy] = toMap(car.x, car.z);
    ctx.fillStyle = '#3a86ff';
    ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  // Player arrow (rotates with heading).
  const [px, py] = toMap(G.player.x, G.player.z);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(G.player.heading);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath();
  ctx.fill();
  ctx.restore();
  // North indicator.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px Arial';
  ctx.fillText('N', 8, 14);
}
