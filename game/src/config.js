// SOLMAR HEAT — config.js
// One clear job: every tunable constant, the city layout and the story data.
// Nothing here touches the DOM or three.js; other modules read these values.

export const GAME_TITLE = 'SOLMAR HEAT';
export const GAME_SUBTITLE = 'An original open-world crime story';
export const CITY_NAME = 'Solmar';
export const HERO_NAME = 'Leo Marín';
export const FIXER_NAME = 'Nadia Voss';
export const RIVAL_GANG = 'The Jackals';
export const SAVE_KEY = 'solmar-heat-save-v1';

// World layout: a road grid. Roads run along both axes at these coordinates.
export const ROAD_COORDS = [-156, -104, -52, 0, 52, 104, 156];
export const ROAD_HALF = 7; // half width of a road
export const BLOCK = 52; // pitch between neighbouring road centrelines
export const CITY_HALF = 190; // playable bounds (x and z)
export const BEACH_Z = 196; // the shoreline, south edge of the map

// Colours of the sun-soaked city. All art is procedural; no borrowed assets.
export const PALETTE = {
  sky: 0x87bfe8,
  fog: 0xa8c8e0,
  sun: 0xfff2d0,
  asphalt: 0x3a3f46,
  asphaltLine: 0xd8d8c8,
  sidewalk: 0x9a938a,
  sand: 0xe8d49a,
  sea: 0x2e7fa8,
  grass: 0x5d9b4a,
  plaza: 0xb8b0a2,
  building: [0xd8c8b0, 0xc8b8a8, 0xb8c0c8, 0xe0d0b8, 0xa8b8c0, 0xd0a898, 0xc0c8b8, 0xe8e0d0],
  glass: 0x2a4a5e,
  roof: 0x6a5a4a,
};

export const PLAYER = {
  walkSpeed: 6.5,
  runSpeed: 11,
  radius: 0.7,
  maxHealth: 100,
  startCash: 250,
  startAmmo: 48,
  pistolDamage: 34,
  pistolRange: 90,
  fireInterval: 0.22,
};

export const CAR = {
  maxSpeed: 42,
  accel: 22,
  brake: 34,
  reverseMax: 12,
  steerMax: 0.55,
  grip: 6.5,
  radius: 2.2,
  colours: [0xc0392b, 0x2471a3, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xe67e22, 0xeeeeee, 0x222222, 0x7fb3d5, 0xd98880],
  names: ['Comet GT', 'Sunrise Coupe', 'Bay Taxi', 'Harbor Van', 'Dune Buggy', 'Metro Sedan', 'Palm Cruiser', 'Night Runner'],
};

// Traffic and pedestrians
export const TRAFFIC_COUNT = 26;
export const PED_COUNT = 34;
export const POLICE_MAX = 6;

// Wanted level: stars 0..5, how many police cars each star spawns, police top speed.
export const WANTED = [
  { stars: 0, police: 0, policeSpeed: 0 },
  { stars: 1, police: 1, policeSpeed: 30 },
  { stars: 2, police: 2, policeSpeed: 33 },
  { stars: 3, police: 3, policeSpeed: 36 },
  { stars: 4, police: 4, policeSpeed: 39 },
  { stars: 5, police: 5, policeSpeed: 42 },
];

// The story: five missions. Steps are data; missions.js runs them.
export const MISSIONS = [
  {
    id: 'm1',
    title: 'First Wheels',
    intro: 'Nadia: "Leo, you need wheels. Grab any car on the lot and bring it to my café."',
    reward: 500,
    steps: [
      { type: 'goto', text: 'Go to the car lot on Marina Row', pos: [-52, 0, -104], radius: 8 },
      { type: 'stealCar', text: 'Steal a car (walk up and press E)', pos: [-52, 0, -104], radius: 12 },
      { type: 'driveTo', text: 'Drive to Nadia\'s café', pos: [52, 0, 52], radius: 9 },
    ],
  },
  {
    id: 'm2',
    title: 'The Pickup',
    intro: 'Nadia: "A package is waiting at the docks. Pick it up on foot — no car past the gate."',
    reward: 800,
    steps: [
      { type: 'driveTo', text: 'Drive to the docks gate', pos: [-104, 0, 156], radius: 9 },
      { type: 'goto', text: 'Walk in and grab the package', pos: [-130, 0, 178], radius: 6 },
      { type: 'driveTo', text: 'Bring the package to the safehouse', pos: [104, 0, -104], radius: 9 },
    ],
  },
  {
    id: 'm3',
    title: 'Hot Pursuit',
    intro: 'Nadia: "The Jackals tipped off the cops. Lose them, then get to the safehouse."',
    reward: 1000,
    steps: [
      { type: 'loseWanted', text: 'Lose the police — break line of sight and stay clear', pos: [0, 0, 0], radius: 0 },
      { type: 'driveTo', text: 'Reach the safehouse', pos: [104, 0, -104], radius: 9 },
    ],
  },
  {
    id: 'm4',
    title: 'Dockside Deal',
    intro: 'Nadia: "The Jackals are moving in on the docks. Clear them out. Watch your back."',
    reward: 1500,
    steps: [
      { type: 'goto', text: 'Get to the docks', pos: [-130, 0, 178], radius: 10 },
      { type: 'killAll', text: 'Take down the Jackals (6)', pos: [-130, 0, 178], radius: 30 },
      { type: 'goto', text: 'Collect the stash', pos: [-146, 0, 182], radius: 5 },
    ],
  },
  {
    id: 'm5',
    title: 'The Getaway',
    intro: 'Nadia: "One last run. Three checkpoints, the whole force on us. Drive, Leo."',
    reward: 3000,
    steps: [
      { type: 'driveTo', text: 'Checkpoint 1: Palm Boulevard', pos: [0, 0, 156], radius: 10 },
      { type: 'driveTo', text: 'Checkpoint 2: The old bridge', pos: [-156, 0, 0], radius: 10 },
      { type: 'driveTo', text: 'Checkpoint 3: Safehouse — finish it', pos: [104, 0, -104], radius: 10 },
    ],
  },
];

// Repeatable side jobs once the story is done.
export const SIDE_JOB_REWARD = 350;

// Twelve cash stashes hidden around the city (free-roam collectibles).
export const STASH_SPOTS = [
  [-78, -130], [78, -130], [-130, -78], [130, -78], [-78, 78], [78, 130],
  [-130, 26], [130, 26], [-26, -78], [26, 130], [-182, 104], [182, -104],
];

// Parked cars the player can steal (position, heading).
export const PARKED_CARS = [
  [-52, -96, 0], [-44, -104, 1.57], [60, 44, 0], [44, 60, -1.57], [-104, -44, 3.14],
  [104, 104, 0], [-156, 52, 1.57], [156, -52, -1.57], [0, -156, 0], [-104, 156, 3.14],
  [52, -156, 1.57], [-52, 104, 0],
];

// Seeded random number generator (mulberry32) so demo scenes are deterministic.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist2d(ax, az, bx, bz) {
  const dx = ax - bx; const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

export function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
