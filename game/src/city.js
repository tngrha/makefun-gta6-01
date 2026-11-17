// SOLMAR HEAT — city.js
// One clear job: build the 3D city of Solmar — ground, roads, buildings,
// beach, park, props and signs — and expose the collision boxes for it.

import { ROAD_COORDS, ROAD_HALF, BLOCK, CITY_HALF, BEACH_Z, PALETTE, mulberry32 } from './config.js';
import { buildingTexture, roadTexture, sidewalkTexture, sandTexture, signTexture } from './textures.js';

export function buildCity(scene, rngSeed) {
  const rng = mulberry32(rngSeed);
  const colliders = []; // {minX,maxX,minZ,maxZ} axis-aligned boxes
  const group = new THREE.Group();
  group.name = 'SolmarCity';

  // --- Sky, sun and fog -------------------------------------------------
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 220, 620);
  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a7a5a, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(PALETTE.sun, 1.9);
  sun.position.set(120, 180, 60);
  scene.add(sun);

  // --- Ground: grass base, then roads, sidewalks, beach and sea ---------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 260, CITY_HALF * 2 + 260),
    new THREE.MeshLambertMaterial({ color: PALETTE.grass }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 40);
  group.add(ground);

  const roadTex = roadTexture();
  roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  const walkTex = sidewalkTexture();
  walkTex.wrapS = walkTex.wrapT = THREE.RepeatWrapping;
  const walkMat = new THREE.MeshLambertMaterial({ map: walkTex });

  function roadStrip(x, z, w, d, alongX) {
    const tex = roadTex.clone();
    tex.needsUpdate = true;
    tex.repeat.set(alongX ? w / 24 : 1, alongX ? 1 : d / 24);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ map: tex }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.01, z);
    group.add(mesh);
  }
  for (const c of ROAD_COORDS) {
    roadStrip(c, 0, ROAD_HALF * 2, CITY_HALF * 2, false);
    roadStrip(0, c, CITY_HALF * 2, ROAD_HALF * 2, true);
  }
  // Sidewalk skirts around every block (block interior only, so the roads
  // stay visible between them).
  const walkGeo = new THREE.PlaneGeometry(BLOCK - ROAD_HALF * 2, BLOCK - ROAD_HALF * 2);
  for (let ix = 0; ix < ROAD_COORDS.length - 1; ix++) {
    for (let iz = 0; iz < ROAD_COORDS.length - 1; iz++) {
      const cx = (ROAD_COORDS[ix] + ROAD_COORDS[ix + 1]) / 2;
      const cz = (ROAD_COORDS[iz] + ROAD_COORDS[iz + 1]) / 2;
      const walk = new THREE.Mesh(walkGeo, walkMat);
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(cx, 0.02, cz);
      group.add(walk);
    }
  }

  // Beach and sea on the south edge.
  const sandTex = sandTexture();
  sandTex.wrapS = sandTex.wrapT = THREE.RepeatWrapping;
  sandTex.repeat.set(8, 2);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(CITY_HALF * 2 + 260, 70), new THREE.MeshLambertMaterial({ map: sandTex }));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, BEACH_Z + 30);
  group.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 260, 220),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.4, BEACH_Z + 140);
  group.add(sea);
  // Wooden pier jutting into the sea.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6a44 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 60), pierMat);
  pier.position.set(-130, 0.6, BEACH_Z + 55);
  group.add(pier);
  colliders.push({ minX: -136, maxX: -124, minZ: BEACH_Z + 24, maxZ: BEACH_Z + 86, pier: true });

  // --- Buildings ---------------------------------------------------------
  const facadeCache = new Map();
  function facade(baseHex, seed) {
    const key = baseHex + ':' + seed;
    if (!facadeCache.has(key)) facadeCache.set(key, buildingTexture(baseHex, seed));
    return facadeCache.get(key);
  }
  const roofMat = new THREE.MeshLambertMaterial({ color: PALETTE.roof });
  const glassMat = new THREE.MeshLambertMaterial({ color: PALETTE.glass });
  const buildings = [];
  let seedCounter = 1;

  function addBuilding(x, z, w, d, h, baseHex, isTower) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshLambertMaterial({ map: facade(baseHex, seedCounter++) });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, h / 2, z);
    group.add(mesh);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.8, d + 0.6), roofMat);
    roof.position.set(x, h + 0.4, z);
    group.add(roof);
    if (isTower) {
      const crown = new THREE.Mesh(new THREE.BoxGeometry(w * 0.4, 3, d * 0.4), glassMat);
      crown.position.set(x, h + 2, z);
      group.add(crown);
    }
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    buildings.push({ x, z, w, d, h });
  }

  // Central park block (between roads 0 and 52, both axes): no buildings.
  const PARK = { ix: 3, iz: 3 };
  for (let ix = 0; ix < ROAD_COORDS.length - 1; ix++) {
    for (let iz = 0; iz < ROAD_COORDS.length - 1; iz++) {
      if (ix === PARK.ix && iz === PARK.iz) continue;
      const cx = (ROAD_COORDS[ix] + ROAD_COORDS[ix + 1]) / 2;
      const cz = (ROAD_COORDS[iz] + ROAD_COORDS[iz + 1]) / 2;
      const distCentre = Math.abs(cx) + Math.abs(cz);
      const downtown = distCentre < 130;
      const n = downtown ? (rng() < 0.5 ? 1 : 2) : (rng() < 0.4 ? 2 : 4);
      for (let k = 0; k < n; k++) {
        const bw = 10 + rng() * 12;
        const bd = 10 + rng() * 12;
        const bx = cx + (rng() - 0.5) * (BLOCK - ROAD_HALF * 2 - bw);
        const bz = cz + (rng() - 0.5) * (BLOCK - ROAD_HALF * 2 - bd);
        const h = downtown ? 18 + rng() * 46 : 7 + rng() * 16;
        const base = PALETTE.building[Math.floor(rng() * PALETTE.building.length)];
        addBuilding(bx, bz, bw, bd, h, base, downtown && h > 48);
      }
    }
  }

  // --- Park: trees, pond, paths ------------------------------------------
  const parkCx = (ROAD_COORDS[PARK.ix] + ROAD_COORDS[PARK.ix + 1]) / 2;
  const parkCz = (ROAD_COORDS[PARK.iz] + ROAD_COORDS[PARK.iz + 1]) / 2;
  const pond = new THREE.Mesh(
    new THREE.CircleGeometry(9, 24),
    new THREE.MeshLambertMaterial({ color: 0x3a8ab0 }),
  );
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(parkCx, 0.05, parkCz);
  group.add(pond);

  // --- Street props: lamps, palms, trees ---------------------------------
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8a3a });
  const palmMat = new THREE.MeshLambertMaterial({ color: 0x2f7a2a });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x2a2a30 });
  const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });

  function tree(x, z, palm) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, palm ? 6 : 3.4, 6), trunkMat);
    trunk.position.set(x, (palm ? 6 : 3.4) / 2, z);
    group.add(trunk);
    if (palm) {
      for (let i = 0; i < 6; i++) {
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.15, 0.9), palmMat);
        const a = (i / 6) * Math.PI * 2;
        leaf.position.set(x + Math.cos(a) * 1.4, 6.1, z + Math.sin(a) * 1.4);
        leaf.rotation.y = -a;
        leaf.rotation.z = 0.35;
        group.add(leaf);
      }
    } else {
      const crown = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 6), leafMat);
      crown.position.set(x, 4.6, z);
      group.add(crown);
    }
  }
  for (let i = 0; i < 14; i++) {
    tree(parkCx + (rng() - 0.5) * 34, parkCz + (rng() - 0.5) * 34, false);
  }
  for (let x = -180; x <= 180; x += 24) {
    tree(x + 9, BEACH_Z + 8, true);
  }
  // Street lamps along the main roads.
  for (const c of ROAD_COORDS) {
    for (let t = -180; t <= 180; t += 52) {
      for (const [lx, lz] of [[c + 9, t], [t, c + 9]]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 6, 6), lampMat);
        pole.position.set(lx, 3, lz);
        group.add(pole);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), lampHeadMat);
        head.position.set(lx, 6.2, lz);
        group.add(head);
      }
    }
  }

  // --- Named places: signs for the café, safehouse and docks -------------
  function placeSign(text, bg, fg, x, y, z, ry) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 3.5),
      new THREE.MeshLambertMaterial({ map: signTexture(text, bg, fg) }),
    );
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    group.add(mesh);
  }
  placeSign("NADIA'S CAFÉ", '#7a2a3a', '#ffe9c8', 52, 7, 44, Math.PI);
  placeSign('SAFEHOUSE', '#2a4a6a', '#cfe8ff', 104, 7, -112, 0);
  placeSign('SOLMAR DOCKS', '#3a3a3a', '#ffd98a', -104, 7, 148, Math.PI);
  placeSign('SOLMAR  •  PALM CITY', '#2a6a4a', '#e8ffe8', 0, 8, -164, 0);

  // Crates and containers at the docks.
  const crateMat = new THREE.MeshLambertMaterial({ color: 0xa8763a });
  const contMat = new THREE.MeshLambertMaterial({ color: 0x3a6a8a });
  for (let i = 0; i < 10; i++) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), crateMat);
    crate.position.set(-150 + (i % 5) * 6, 1.5, 168 + Math.floor(i / 5) * 6);
    group.add(crate);
    colliders.push({ minX: crate.position.x - 1.5, maxX: crate.position.x + 1.5, minZ: crate.position.z - 1.5, maxZ: crate.position.z + 1.5 });
  }
  for (let i = 0; i < 4; i++) {
    const cont = new THREE.Mesh(new THREE.BoxGeometry(10, 3, 3), contMat);
    cont.position.set(-120 + i * 12, 1.5, 186);
    group.add(cont);
    colliders.push({ minX: cont.position.x - 5, maxX: cont.position.x + 5, minZ: cont.position.z - 1.5, maxZ: cont.position.z + 1.5 });
  }

  scene.add(group);
  return { group, colliders, buildings, park: { x: parkCx, z: parkCz } };
}

// Push a circle (x, z, radius) out of every building collider it overlaps.
export function resolveCollisions(x, z, radius, colliders) {
  let px = x, pz = z;
  for (const c of colliders) {
    if (c.pier) continue;
    const nx = Math.max(c.minX, Math.min(px, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pz, c.maxZ));
    const dx = px - nx, dz = pz - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        px = nx + (dx / d) * radius;
        pz = nz + (dz / d) * radius;
      } else {
        // Centre inside the box: push out along the smallest penetration.
        const pl = px - c.minX, pr = c.maxX - px, pt = pz - c.minZ, pb = c.maxZ - pz;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) px = c.minX - radius;
        else if (m === pr) px = c.maxX + radius;
        else if (m === pt) pz = c.minZ - radius;
        else pz = c.maxZ + radius;
      }
    }
  }
  return { x: px, z: pz };
}

// True when (x, z) is on a road (within the road strip of any road line).
export function onRoad(x, z) {
  for (const c of ROAD_COORDS) {
    if (Math.abs(x - c) < ROAD_HALF + 1 || Math.abs(z - c) < ROAD_HALF + 1) return true;
  }
  return false;
}

// Nearest road coordinate on one axis.
export function nearestRoad(v) {
  let best = ROAD_COORDS[0], bd = Infinity;
  for (const c of ROAD_COORDS) {
    const d = Math.abs(v - c);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
