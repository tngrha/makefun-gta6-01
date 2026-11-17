// SOLMAR HEAT — save.js
// One clear job: saving progress to localStorage and reading it back.
// Nothing leaves the browser; the save is the player's own.

import { SAVE_KEY } from './config.js';

export function createSave() {
  return {
    read() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (typeof data !== 'object' || data === null) return null;
        return data;
      } catch (e) {
        return null;
      }
    },
    write(G) {
      try {
        const data = {
          cash: G.player.cash,
          missionsDone: G.missions.done,
          missionIndex: G.missions.index,
          carsStolen: G.player.carsStolen,
          stashesFound: G.player.stashesFound,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      } catch (e) {
        // Storage may be unavailable (private mode); the game still plays.
      }
    },
    clear() {
      try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    },
  };
}

// Apply a loaded save to a fresh game: cash and mission progress carry over.
export function applySave(G, save) {
  if (!save) return;
  G.player.cash = typeof save.cash === 'number' ? save.cash : G.player.cash;
  if (typeof save.missionsDone === 'number') G.missions.done = save.missionsDone;
  if (typeof save.carsStolen === 'number') G.player.carsStolen = save.carsStolen;
  if (typeof save.stashesFound === 'number') G.player.stashesFound = save.stashesFound;
  // Resume at the next uncompleted mission.
  if (typeof save.missionIndex === 'number' && save.missionIndex > 0) {
    G.missions.index = Math.min(save.missionIndex, 4);
  }
}
