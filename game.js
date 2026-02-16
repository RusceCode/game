import * as THREE from "https://unpkg.com/three@0.166.1/build/three.module.js";

const canvas = document.getElementById("viewport");

const ui = {
  credits: document.getElementById("credits"),
  energy: document.getElementById("energy"),
  population: document.getElementById("population"),
  coreHp: document.getElementById("coreHp"),
  wave: document.getElementById("wave"),
  log: document.getElementById("log"),
  buildTurret: document.getElementById("buildTurret"),
  buildHab: document.getElementById("buildHab"),
  boostEconomy: document.getElementById("boostEconomy"),
  overlay: document.getElementById("overlay"),
  overlayTitle: document.getElementById("overlayTitle"),
  overlayText: document.getElementById("overlayText"),
  restart: document.getElementById("restart"),
};

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070b1e);
scene.fog = new THREE.FogExp2(0x060a1a, 0.011);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 600);

const camRig = {
  yaw: 0.7,
  pitch: 0.95,
  distance: 72,
  target: new THREE.Vector3(0, 0, 0),
  rotateDrag: false,
  lastX: 0,
  lastY: 0,
};

const ambient = new THREE.HemisphereLight(0x8cb8ff, 0x2d2130, 0.72);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xfff1de, 1.8);
sun.position.set(40, 58, -18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -120;
sun.shadow.camera.right = 120;
sun.shadow.camera.top = 120;
sun.shadow.camera.bottom = -120;
scene.add(sun);

const moonFill = new THREE.DirectionalLight(0x6a93ff, 0.35);
moonFill.position.set(-35, 24, 50);
scene.add(moonFill);

const starField = new THREE.Points(
  new THREE.BufferGeometry(),
  new THREE.PointsMaterial({ color: 0x9fb9ff, size: 0.9, transparent: true, opacity: 0.7 })
);
{
  const count = 2000;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    arr[i * 3] = (Math.random() - 0.5) * 800;
    arr[i * 3 + 1] = Math.random() * 260 + 80;
    arr[i * 3 + 2] = (Math.random() - 0.5) * 800;
  }
  starField.geometry.setAttribute("position", new THREE.BufferAttribute(arr, 3));
}
scene.add(starField);

const terrainSize = 230;
const terrainGeom = new THREE.PlaneGeometry(terrainSize, terrainSize, 160, 160);
terrainGeom.rotateX(-Math.PI / 2);
const pos = terrainGeom.attributes.position;
for (let i = 0; i < pos.count; i += 1) {
  const x = pos.getX(i);
  const z = pos.getZ(i);
  const y = Math.sin(x * 0.12) * 1.9 + Math.cos(z * 0.08) * 2.1 + Math.sin((x + z) * 0.05) * 2.8;
  pos.setY(i, y);
}
terrainGeom.computeVertexNormals();

const terrainMat = new THREE.MeshStandardMaterial({
  color: 0x1d2f2c,
  roughness: 0.9,
  metalness: 0.05,
});
const terrain = new THREE.Mesh(terrainGeom, terrainMat);
terrain.receiveShadow = true;
scene.add(terrain);

const baseRing = new THREE.Mesh(
  new THREE.TorusGeometry(8, 1.1, 20, 80),
  new THREE.MeshStandardMaterial({ color: 0x7ea9ff, emissive: 0x1f2a5f, roughness: 0.4, metalness: 0.55 })
);
baseRing.rotation.x = Math.PI / 2;
baseRing.position.set(0, 2.4, 0);
baseRing.castShadow = true;
scene.add(baseRing);

const core = new THREE.Mesh(
  new THREE.IcosahedronGeometry(3.3, 1),
  new THREE.MeshStandardMaterial({ color: 0xa7eeff, emissive: 0x2455a3, emissiveIntensity: 1.3, roughness: 0.18, metalness: 0.2 })
);
core.castShadow = true;
core.position.y = 4.8;
scene.add(core);

const coreLight = new THREE.PointLight(0x7fd1ff, 11, 45, 2);
coreLight.position.copy(core.position);
scene.add(coreLight);

const objects = {
  crystalNodes: [],
  workers: [],
  turrets: [],
  habitats: [],
  enemies: [],
  enemyShots: [],
  turretShots: [],
  sparks: [],
};

const state = {
  credits: 220,
  energy: 90,
  population: 6,
  coreHp: 1200,
  wave: 1,
  live: true,
  win: false,
  enemyBudget: 5,
  spawnTimer: 1,
  waveTimer: 0,
  ecoBoost: 1,
};

const tempV = new THREE.Vector3();

function terrainHeight(x, z) {
  return Math.sin(x * 0.12) * 1.9 + Math.cos(z * 0.08) * 2.1 + Math.sin((x + z) * 0.05) * 2.8;
}

function addLog(message) {
  const p = document.createElement("p");
  p.textContent = message;
  ui.log.prepend(p);
  while (ui.log.childElementCount > 14) {
    ui.log.lastChild.remove();
  }
}

function spawnEnvironment() {
  const treeGeo = new THREE.ConeGeometry(1.8, 8, 7);
  const treeMat = new THREE.MeshStandardMaterial({ color: 0x2c794f, roughness: 0.9, metalness: 0.04 });

  const rockGeo = new THREE.DodecahedronGeometry(1.8, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x555d77, roughness: 0.95, metalness: 0.07 });

  for (let i = 0; i < 200; i += 1) {
    const x = (Math.random() - 0.5) * 210;
    const z = (Math.random() - 0.5) * 210;
    if (Math.hypot(x, z) < 16) {
      continue;
    }

    if (Math.random() < 0.7) {
      const t = new THREE.Mesh(treeGeo, treeMat);
      t.position.set(x, terrainHeight(x, z) + 4, z);
      t.castShadow = true;
      scene.add(t);
    } else {
      const r = new THREE.Mesh(rockGeo, rockMat);
      r.position.set(x, terrainHeight(x, z) + 1.5, z);
      r.castShadow = true;
      scene.add(r);
    }
  }
}

function spawnCrystalNodes() {
  const geo = new THREE.OctahedronGeometry(2.5, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0x8ef0ff, emissive: 0x1c7496, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.12 });

  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.25;
    const radius = 34 + Math.random() * 60;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = terrainHeight(x, z) + 2.6;

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(0.8 + Math.random() * 1.4);
    mesh.castShadow = true;
    scene.add(mesh);

    objects.crystalNodes.push({ mesh, amount: 380 + Math.random() * 280 });
  }
}

function spawnWorkers() {
  const geo = new THREE.CapsuleGeometry(0.7, 1.5, 4, 8);
  const mat = new THREE.MeshStandardMaterial({ color: 0xc8dbff, emissive: 0x2d3f75, roughness: 0.32, metalness: 0.7 });

  for (let i = 0; i < state.population; i += 1) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;

    const angle = (i / state.population) * Math.PI * 2;
    mesh.position.set(Math.cos(angle) * 9, terrainHeight(Math.cos(angle) * 9, Math.sin(angle) * 9) + 1.8, Math.sin(angle) * 9);
    scene.add(mesh);

    objects.workers.push({
      mesh,
      speed: 8 + Math.random() * 2,
      carrying: 0,
      target: null,
      phase: Math.random() * 10,
    });
  }
}

function spawnSpark(position, color = 0xa6f0ff, count = 12, force = 9) {
  for (let i = 0; i < count; i += 1) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 6, 6),
      new THREE.MeshBasicMaterial({ color })
    );
    m.position.copy(position);
    scene.add(m);

    objects.sparks.push({
      mesh: m,
      vel: new THREE.Vector3((Math.random() - 0.5) * force, Math.random() * force, (Math.random() - 0.5) * force),
      life: 0.7 + Math.random() * 0.5,
    });
  }
}

function buildTurret() {
  if (state.credits < 120 || !state.live) {
    addLog("Insufficient credits for turret.");
    return;
  }

  state.credits -= 120;
  const angle = Math.random() * Math.PI * 2;
  const radius = 12 + Math.random() * 9;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.6, 2.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x7f95ca, roughness: 0.5, metalness: 0.8 })
  );
  base.position.set(x, terrainHeight(x, z) + 1.2, z);
  base.castShadow = true;
  scene.add(base);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.85, 1.2),
    new THREE.MeshStandardMaterial({ color: 0xc9e2ff, emissive: 0x223f83, emissiveIntensity: 0.75, roughness: 0.34, metalness: 0.6 })
  );
  head.position.set(x, base.position.y + 1.3, z);
  head.castShadow = true;
  scene.add(head);

  objects.turrets.push({ base, head, cooldown: Math.random() * 0.5 + 0.1, range: 50, damage: 18 });
  addLog("Turret operational.");
}

function buildHabitat() {
  if (state.credits < 90 || !state.live) {
    addLog("Insufficient credits for habitat.");
    return;
  }

  state.credits -= 90;
  state.population += 2;
  state.energy += 8;

  const angle = Math.random() * Math.PI * 2;
  const radius = 18 + Math.random() * 11;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;

  const hab = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.8, 3.6, 10),
    new THREE.MeshStandardMaterial({ color: 0x7f9bd1, emissive: 0x213462, emissiveIntensity: 0.55, roughness: 0.6, metalness: 0.3 })
  );
  hab.position.set(x, terrainHeight(x, z) + 1.8, z);
  hab.castShadow = true;
  scene.add(hab);

  objects.habitats.push(hab);

  for (let i = 0; i < 2; i += 1) {
    const worker = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.7, 1.5, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0xc8dbff, emissive: 0x2d3f75, roughness: 0.32, metalness: 0.7 })
    );
    worker.castShadow = true;
    worker.position.set(x + (Math.random() - 0.5) * 4, terrainHeight(x, z) + 1.8, z + (Math.random() - 0.5) * 4);
    scene.add(worker);

    objects.workers.push({ mesh: worker, speed: 8 + Math.random() * 2, carrying: 0, target: null, phase: Math.random() * 10 });
  }

  addLog("Habitat finished. Population increased.");
}

function boostEconomy() {
  if (state.credits < 70 || !state.live) {
    addLog("Insufficient credits for overclock.");
    return;
  }

  state.credits -= 70;
  state.ecoBoost = 1.8;
  addLog("Economy overclock enabled (15 sec).");
  setTimeout(() => {
    state.ecoBoost = 1;
    addLog("Economy overclock expired.");
  }, 15000);
}

function spawnEnemy() {
  const geo = new THREE.SphereGeometry(1.6, 14, 14);
  const mat = new THREE.MeshStandardMaterial({ color: 0xff7e8e, emissive: 0x7a2636, emissiveIntensity: 0.7, roughness: 0.25, metalness: 0.4 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;

  const a = Math.random() * Math.PI * 2;
  const r = 95 + Math.random() * 18;
  const x = Math.cos(a) * r;
  const z = Math.sin(a) * r;
  mesh.position.set(x, terrainHeight(x, z) + 1.7, z);
  scene.add(mesh);

  objects.enemies.push({ mesh, hp: 75 + state.wave * 15, speed: 5 + Math.random() * 2 + state.wave * 0.5, shootCd: 1 + Math.random() * 1.2 });
}

function fireShot(from, to, arr, color) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.33, 8, 8),
    new THREE.MeshBasicMaterial({ color })
  );
  mesh.position.copy(from);
  scene.add(mesh);

  const dir = to.clone().sub(from).normalize();
  arr.push({ mesh, vel: dir.multiplyScalar(34), life: 2 });
}

function updateWorkers(dt, elapsed) {
  for (const w of objects.workers) {
    if (!w.target || w.target.amount <= 0 || (w.carrying <= 0 && Math.random() < 0.01)) {
      let best = null;
      let bestD = Infinity;
      for (const n of objects.crystalNodes) {
        if (n.amount <= 0) {
          continue;
        }
        const d = w.mesh.position.distanceTo(n.mesh.position);
        if (d < bestD) {
          bestD = d;
          best = n;
        }
      }
      w.target = best;
    }

    const targetPos = w.carrying > 25 || !w.target ? core.position : w.target.mesh.position;
    tempV.copy(targetPos).sub(w.mesh.position);
    const dist = tempV.length();

    if (dist > 0.4) {
      tempV.normalize();
      w.mesh.position.addScaledVector(tempV, w.speed * dt);
      w.mesh.position.y = terrainHeight(w.mesh.position.x, w.mesh.position.z) + 1.5 + Math.sin(elapsed * 6 + w.phase) * 0.2;
      w.mesh.rotation.y = Math.atan2(tempV.x, tempV.z);
    } else if (w.carrying > 25 || !w.target) {
      state.credits += Math.floor(8 * state.ecoBoost);
      state.energy += Math.floor(2 * state.ecoBoost);
      w.carrying = 0;
      spawnSpark(core.position, 0xa6f0ff, 8, 6);
    } else if (w.target && w.target.amount > 0) {
      const mined = Math.min(30 * dt, w.target.amount);
      w.target.amount -= mined;
      w.carrying += mined;
      w.target.mesh.rotation.y += dt * 2.4;
      if (w.target.amount <= 0) {
        w.target.mesh.visible = false;
      }
    }
  }
}

function updateTurrets(dt) {
  for (const t of objects.turrets) {
    t.cooldown -= dt;
    let target = null;
    let bestD = Infinity;

    for (const enemy of objects.enemies) {
      const d = enemy.mesh.position.distanceTo(t.base.position);
      if (d < bestD && d < t.range) {
        bestD = d;
        target = enemy;
      }
    }

    if (target) {
      t.head.lookAt(target.mesh.position);
      if (t.cooldown <= 0) {
        fireShot(t.head.position, target.mesh.position, objects.turretShots, 0x9deaff);
        t.cooldown = 0.35;
      }
    }
  }
}

function updateEnemies(dt) {
  for (let i = objects.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = objects.enemies[i];
    tempV.copy(core.position).sub(enemy.mesh.position);
    const dist = tempV.length();

    if (dist > 4) {
      tempV.normalize();
      enemy.mesh.position.addScaledVector(tempV, enemy.speed * dt);
      enemy.mesh.position.y = terrainHeight(enemy.mesh.position.x, enemy.mesh.position.z) + 1.7;
    } else {
      state.coreHp -= 22 * dt;
      enemy.mesh.position.y += Math.sin(performance.now() * 0.01) * 0.02;
    }

    enemy.shootCd -= dt;
    if (enemy.shootCd <= 0 && dist < 50) {
      fireShot(enemy.mesh.position, core.position, objects.enemyShots, 0xff8ba2);
      enemy.shootCd = 1.2 + Math.random() * 1.2;
    }

    enemy.mesh.rotation.y += dt;

    if (enemy.hp <= 0) {
      spawnSpark(enemy.mesh.position, 0xffa0b2, 14, 8);
      state.credits += 26;
      scene.remove(enemy.mesh);
      objects.enemies.splice(i, 1);
    }
  }
}

function updateShots(dt, arr, againstEnemy) {
  for (let i = arr.length - 1; i >= 0; i -= 1) {
    const s = arr[i];
    s.mesh.position.addScaledVector(s.vel, dt);
    s.life -= dt;

    let hit = false;
    if (againstEnemy) {
      for (const enemy of objects.enemies) {
        if (enemy.mesh.position.distanceTo(s.mesh.position) < 1.8) {
          enemy.hp -= 18;
          hit = true;
          break;
        }
      }
    } else if (core.position.distanceTo(s.mesh.position) < 3.5) {
      state.coreHp -= 16;
      hit = true;
      spawnSpark(core.position, 0xff9aad, 7, 5);
    }

    if (s.life <= 0 || hit) {
      scene.remove(s.mesh);
      arr.splice(i, 1);
    }
  }
}

function updateSparks(dt) {
  for (let i = objects.sparks.length - 1; i >= 0; i -= 1) {
    const s = objects.sparks[i];
    s.life -= dt;
    s.vel.y -= 18 * dt;
    s.mesh.position.addScaledVector(s.vel, dt);

    if (s.life <= 0) {
      scene.remove(s.mesh);
      objects.sparks.splice(i, 1);
    }
  }
}

function updateWaves(dt) {
  state.waveTimer += dt;
  state.spawnTimer -= dt;

  if (state.spawnTimer <= 0 && state.enemyBudget > 0) {
    spawnEnemy();
    state.enemyBudget -= 1;
    state.spawnTimer = 0.7 - Math.min(0.35, state.wave * 0.02) + Math.random() * 0.3;
  }

  if (state.enemyBudget <= 0 && objects.enemies.length === 0 && state.waveTimer > 7) {
    state.wave += 1;
    state.waveTimer = 0;
    state.enemyBudget = 5 + state.wave * 2;
    state.energy += 16;
    state.credits += 45;
    addLog(`Wave ${state.wave} incoming.`);
    if (state.wave >= 8) {
      state.live = false;
      state.win = true;
      finishGame();
    }
  }
}

function finishGame() {
  ui.overlay.classList.remove("hidden");
  if (state.win) {
    ui.overlayTitle.textContent = "Campaign Victory";
    ui.overlayText.textContent = `Je hebt alle 8 waves overleefd met ${Math.floor(state.coreHp)} core HP over.`;
    addLog("Victory achieved. Command successful.");
  } else {
    ui.overlayTitle.textContent = "Core Destroyed";
    ui.overlayText.textContent = "Je command center is gevallen. Analyseer je economie en defenses.";
    addLog("Defeat. Command core destroyed.");
  }
}

function updateHud() {
  ui.credits.textContent = Math.floor(state.credits);
  ui.energy.textContent = Math.floor(state.energy);
  ui.population.textContent = String(state.population);
  ui.coreHp.textContent = Math.max(0, Math.floor(state.coreHp));
  ui.wave.textContent = String(state.wave);
}

function updateCamera(dt) {
  const speed = 28 * dt;
  const forward = new THREE.Vector3(Math.sin(camRig.yaw), 0, Math.cos(camRig.yaw));
  const right = new THREE.Vector3(forward.z, 0, -forward.x);

  if (keys.has("w") || keys.has("arrowup")) {
    camRig.target.addScaledVector(forward, speed);
  }
  if (keys.has("s") || keys.has("arrowdown")) {
    camRig.target.addScaledVector(forward, -speed);
  }
  if (keys.has("a") || keys.has("arrowleft")) {
    camRig.target.addScaledVector(right, -speed);
  }
  if (keys.has("d") || keys.has("arrowright")) {
    camRig.target.addScaledVector(right, speed);
  }
  if (keys.has("q")) {
    camRig.yaw += dt;
  }
  if (keys.has("e")) {
    camRig.yaw -= dt;
  }

  camRig.target.x = THREE.MathUtils.clamp(camRig.target.x, -90, 90);
  camRig.target.z = THREE.MathUtils.clamp(camRig.target.z, -90, 90);

  const cp = Math.cos(camRig.pitch);
  camera.position.set(
    camRig.target.x + Math.sin(camRig.yaw) * cp * camRig.distance,
    camRig.target.y + Math.sin(camRig.pitch) * camRig.distance + 15,
    camRig.target.z + Math.cos(camRig.yaw) * cp * camRig.distance
  );
  camera.lookAt(camRig.target);
}

const keys = new Set();

window.addEventListener("keydown", (e) => keys.add(e.key.toLowerCase()));
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("mousedown", (e) => {
  if (e.button === 2) {
    camRig.rotateDrag = true;
    camRig.lastX = e.clientX;
    camRig.lastY = e.clientY;
  }
});
window.addEventListener("mouseup", () => {
  camRig.rotateDrag = false;
});
window.addEventListener("mousemove", (e) => {
  if (!camRig.rotateDrag) {
    return;
  }
  const dx = e.clientX - camRig.lastX;
  const dy = e.clientY - camRig.lastY;
  camRig.lastX = e.clientX;
  camRig.lastY = e.clientY;
  camRig.yaw -= dx * 0.004;
  camRig.pitch = THREE.MathUtils.clamp(camRig.pitch + dy * 0.004, 0.45, 1.32);
});
canvas.addEventListener("wheel", (e) => {
  camRig.distance = THREE.MathUtils.clamp(camRig.distance + e.deltaY * 0.04, 28, 120);
});

ui.buildTurret.addEventListener("click", buildTurret);
ui.buildHab.addEventListener("click", buildHabitat);
ui.boostEconomy.addEventListener("click", boostEconomy);
ui.restart.addEventListener("click", () => window.location.reload());

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener("resize", resize);

spawnEnvironment();
spawnCrystalNodes();
spawnWorkers();
addLog("Command online. Build economy and survive enemy waves.");

let previous = performance.now();
function tick(now) {
  const dt = Math.min(0.033, (now - previous) / 1000);
  previous = now;

  if (state.live) {
    core.rotation.x += dt * 0.2;
    core.rotation.y += dt * 0.6;
    baseRing.rotation.z += dt * 0.18;
    starField.rotation.y += dt * 0.01;

    updateWorkers(dt, now * 0.001);
    updateTurrets(dt);
    updateEnemies(dt);
    updateShots(dt, objects.turretShots, true);
    updateShots(dt, objects.enemyShots, false);
    updateSparks(dt);
    updateWaves(dt);

    if (state.coreHp <= 0) {
      state.coreHp = 0;
      state.live = false;
      state.win = false;
      finishGame();
    }
  }

  updateHud();
  updateCamera(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
