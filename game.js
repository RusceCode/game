const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const ui = {
  hp: document.getElementById("hp"),
  shield: document.getElementById("shield"),
  level: document.getElementById("level"),
  xp: document.getElementById("xp"),
  wave: document.getElementById("wave"),
  score: document.getElementById("score"),
  dashMeter: document.getElementById("dashMeter"),
  novaMeter: document.getElementById("novaMeter"),
  message: document.getElementById("message"),
  restart: document.getElementById("restart"),
  audioToggle: document.getElementById("audioToggle"),
};

const keys = new Set();
const mouse = { x: canvas.width / 2, y: canvas.height / 2, down: false };

const config = {
  arenaPadding: 36,
  maxEnemies: 26,
  projectileSpeed: 11,
  playerFireRate: 130,
  dashCooldown: 1800,
  novaCooldown: 6500,
};

const fx = {
  stars: Array.from({ length: 130 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    z: Math.random() * 1 + 0.25,
  })),
  trails: [],
  flashes: [],
  shake: 0,
};

const audio = {
  context: null,
  master: null,
  musicGain: null,
  sfxGain: null,
  enabled: false,
  initialized: false,
  nextBeatAt: 0,
  bassPhase: 0,
};

let state;

function createInitialState() {
  return {
    time: 0,
    lastFrame: performance.now(),
    running: true,
    victory: false,
    score: 0,
    wave: 1,
    waveTimer: 0,
    enemiesToSpawn: 7,
    spawnCadence: 0,
    bossSpawned: false,
    particles: [],
    projectiles: [],
    enemies: [],
    floatingText: [],
    player: {
      x: canvas.width * 0.5,
      y: canvas.height * 0.6,
      vx: 0,
      vy: 0,
      speed: 235,
      radius: 18,
      hp: 100,
      maxHp: 100,
      shield: 50,
      maxShield: 50,
      shieldRegenPerSec: 6,
      shieldDelay: 1800,
      shieldCooldown: 0,
      xp: 0,
      level: 1,
      damage: 16,
      shotTimer: 0,
      invuln: 0,
      dash: { timer: 0, cooldown: 0 },
      nova: { cooldown: 0 },
    },
  };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function setMessage(text, color = "#9dff8d") {
  ui.message.textContent = text;
  ui.message.style.color = color;
}

function addFloatingText(x, y, text, color) {
  state.floatingText.push({ x, y, text, color, life: 850 });
}

function emitBurst(x, y, count, speed, color) {
  for (let i = 0; i < count; i += 1) {
    const a = rand(0, Math.PI * 2);
    state.particles.push({
      x,
      y,
      vx: Math.cos(a) * rand(speed * 0.3, speed),
      vy: Math.sin(a) * rand(speed * 0.3, speed),
      life: rand(280, 620),
      maxLife: 620,
      color,
      size: rand(1.2, 3.5),
    });
  }
}

function pushFlash(strength = 0.22, color = "255,255,255") {
  fx.flashes.push({ strength, color, life: 120, maxLife: 120 });
}

function addShake(power = 8) {
  fx.shake = Math.max(fx.shake, power);
}

function xpForLevel(level) {
  return Math.floor(75 + level * level * 40);
}

function gainXp(amount) {
  const player = state.player;
  player.xp += amount;

  while (player.xp >= xpForLevel(player.level)) {
    player.xp -= xpForLevel(player.level);
    player.level += 1;
    player.maxHp += 10;
    player.maxShield += 8;
    player.damage += 2.5;
    player.hp = Math.min(player.maxHp, player.hp + 24);
    player.shield = Math.min(player.maxShield, player.shield + 18);

    emitBurst(player.x, player.y, 28, 140, "#74f7ff");
    pushFlash(0.3, "124,239,255");
    addFloatingText(player.x, player.y - 26, "LEVEL UP", "#74f7ff");
    setMessage(`Level ${player.level}! Core systems upgraded.`, "#74f7ff");
    playSfx("levelup");
  }
}

function enemyTemplate(kind, wave) {
  if (kind === "boss") {
    return {
      kind,
      x: canvas.width / 2,
      y: -120,
      radius: 56,
      hp: 900 + wave * 130,
      maxHp: 900 + wave * 130,
      speed: 48,
      damage: 22,
      xp: 280,
      fireTimer: 1200,
    };
  }

  const brute = Math.random() < 0.2 + wave * 0.02;
  if (brute) {
    return {
      kind: "brute",
      radius: 24,
      hp: 90 + wave * 14,
      maxHp: 90 + wave * 14,
      speed: 72 + wave * 1.8,
      damage: 14 + wave,
      xp: 24 + wave * 2,
      fireTimer: Infinity,
    };
  }

  return {
    kind: "drone",
    radius: 15,
    hp: 48 + wave * 9,
    maxHp: 48 + wave * 9,
    speed: 94 + wave * 2.2,
    damage: 10 + Math.floor(wave * 0.7),
    xp: 16 + wave * 2,
    fireTimer: rand(1800, 2800),
  };
}

function spawnEnemy(kind = "regular") {
  const e = enemyTemplate(kind === "boss" ? "boss" : "regular", state.wave);

  let x;
  let y;
  const side = Math.floor(rand(0, 4));
  if (side === 0) {
    x = rand(0, canvas.width);
    y = -40;
  } else if (side === 1) {
    x = canvas.width + 40;
    y = rand(0, canvas.height);
  } else if (side === 2) {
    x = rand(0, canvas.width);
    y = canvas.height + 40;
  } else {
    x = -40;
    y = rand(0, canvas.height);
  }

  if (e.kind === "boss") {
    x = canvas.width / 2;
    y = -80;
    playSfx("boss");
    pushFlash(0.26, "255,144,84");
    addShake(10);
  }

  state.enemies.push({ ...e, x, y, hitFlash: 0, attackCd: 0 });
}

function firePlayerWeapon() {
  const p = state.player;
  if (!state.running || p.shotTimer > 0) {
    return;
  }

  const angle = Math.atan2(mouse.y - p.y, mouse.x - p.x);
  const spread = rand(-0.04, 0.04);

  state.projectiles.push({
    owner: "player",
    x: p.x,
    y: p.y,
    vx: Math.cos(angle + spread) * config.projectileSpeed,
    vy: Math.sin(angle + spread) * config.projectileSpeed,
    radius: 4,
    damage: p.damage,
    life: 1100,
    color: "#7deeff",
  });

  fx.trails.push({ x: p.x, y: p.y, life: 80, maxLife: 80 });
  playSfx("shoot");
  p.shotTimer = config.playerFireRate;
}

function activateDash() {
  const p = state.player;
  if (!state.running || p.dash.cooldown > 0 || p.dash.timer > 0) {
    return;
  }

  const angle = Math.atan2(mouse.y - p.y, mouse.x - p.x);
  p.vx += Math.cos(angle) * 540;
  p.vy += Math.sin(angle) * 540;
  p.dash.timer = 160;
  p.dash.cooldown = config.dashCooldown;
  p.invuln = 180;

  emitBurst(p.x, p.y, 20, 210, "#82e8ff");
  pushFlash(0.12, "130,232,255");
  addShake(4);
  playSfx("dash");
}

function activateNova() {
  const p = state.player;
  if (!state.running || p.nova.cooldown > 0) {
    return;
  }

  p.nova.cooldown = config.novaCooldown;
  const range = 140;

  state.enemies.forEach((enemy) => {
    const dx = enemy.x - p.x;
    const dy = enemy.y - p.y;
    const dist = Math.hypot(dx, dy);

    if (dist <= range + enemy.radius) {
      enemy.hp -= 75 + p.level * 9;
      enemy.hitFlash = 140;
      const push = (range - dist) * 2.5;
      enemy.x += (dx / Math.max(dist, 0.01)) * push;
      enemy.y += (dy / Math.max(dist, 0.01)) * push;
      addFloatingText(enemy.x, enemy.y - 12, "NOVA", "#93f2ff");
    }
  });

  emitBurst(p.x, p.y, 52, 240, "#8df7ff");
  pushFlash(0.4, "141,247,255");
  addShake(11);
  setMessage("Pulse Nova ontketend.", "#93f2ff");
  playSfx("nova");
}

function dealDamageToPlayer(amount) {
  const p = state.player;
  if (p.invuln > 0 || !state.running) {
    return;
  }

  p.shieldCooldown = p.shieldDelay;
  let remaining = amount;

  if (p.shield > 0) {
    const absorbed = Math.min(p.shield, remaining);
    p.shield -= absorbed;
    remaining -= absorbed;
  }

  if (remaining > 0) {
    p.hp -= remaining;
  }

  p.invuln = 250;
  emitBurst(p.x, p.y, 18, 110, "#ff8ea6");
  pushFlash(0.22, "255,132,162");
  addShake(7);
  playSfx("hurt");

  if (p.hp <= 0) {
    p.hp = 0;
    state.running = false;
    state.victory = false;
    setMessage("Run gefaald. Druk op R voor een nieuwe poging.", "#ff7d96");
    playSfx("fail");
  }
}

function updatePlayer(dt) {
  const p = state.player;

  const xInput = Number(keys.has("ArrowRight") || keys.has("d")) - Number(keys.has("ArrowLeft") || keys.has("a"));
  const yInput = Number(keys.has("ArrowDown") || keys.has("s")) - Number(keys.has("ArrowUp") || keys.has("w"));
  const len = Math.hypot(xInput, yInput) || 1;

  const accel = 1800 * dt;
  p.vx += (xInput / len) * accel;
  p.vy += (yInput / len) * accel;

  const maxSpeed = p.speed + (p.dash.timer > 0 ? 180 : 0);
  const vLen = Math.hypot(p.vx, p.vy);
  if (vLen > maxSpeed) {
    p.vx = (p.vx / vLen) * maxSpeed;
    p.vy = (p.vy / vLen) * maxSpeed;
  }

  p.vx *= 0.9;
  p.vy *= 0.9;

  p.x += p.vx * dt;
  p.y += p.vy * dt;

  p.x = clamp(p.x, config.arenaPadding, canvas.width - config.arenaPadding);
  p.y = clamp(p.y, config.arenaPadding, canvas.height - config.arenaPadding);

  p.shotTimer = Math.max(0, p.shotTimer - dt * 1000);
  p.dash.timer = Math.max(0, p.dash.timer - dt * 1000);
  p.dash.cooldown = Math.max(0, p.dash.cooldown - dt * 1000);
  p.nova.cooldown = Math.max(0, p.nova.cooldown - dt * 1000);
  p.invuln = Math.max(0, p.invuln - dt * 1000);
  p.shieldCooldown = Math.max(0, p.shieldCooldown - dt * 1000);

  if (p.shieldCooldown <= 0 && p.shield < p.maxShield) {
    p.shield = Math.min(p.maxShield, p.shield + p.shieldRegenPerSec * dt);
  }

  if (mouse.down) {
    firePlayerWeapon();
  }
}

function updateSpawning(dtMs) {
  if (!state.running) {
    return;
  }

  state.waveTimer += dtMs;
  state.spawnCadence -= dtMs;

  if (state.enemiesToSpawn > 0 && state.spawnCadence <= 0 && state.enemies.length < config.maxEnemies) {
    spawnEnemy();
    state.enemiesToSpawn -= 1;
    state.spawnCadence = rand(240, 540);
  }

  const cleared = state.enemiesToSpawn <= 0 && state.enemies.length === 0;
  if (cleared && !state.bossSpawned && state.wave % 4 === 0) {
    state.bossSpawned = true;
    spawnEnemy("boss");
    setMessage("BOSS ARRIVEERT: TITAN ECHO", "#ffad64");
    return;
  }

  if (cleared && !state.bossSpawned) {
    state.wave += 1;
    state.waveTimer = 0;
    state.enemiesToSpawn = 6 + state.wave * 2;
    state.spawnCadence = 500;
    setMessage(`Wave ${state.wave} gestart.`, "#9dff8d");
  }

  if (cleared && state.bossSpawned) {
    state.running = false;
    state.victory = true;
    setMessage("VICTORY. Vertical slice voltooid.", "#75f8ff");
    pushFlash(0.35, "117,248,255");
    playSfx("victory");
  }
}

function updateEnemies(dt) {
  const p = state.player;

  for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
    const e = state.enemies[i];
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dist = Math.hypot(dx, dy) || 0.001;
    const nx = dx / dist;
    const ny = dy / dist;

    e.x += nx * e.speed * dt;
    e.y += ny * e.speed * dt;

    e.hitFlash = Math.max(0, e.hitFlash - dt * 1000);
    e.attackCd = Math.max(0, e.attackCd - dt * 1000);

    if (e.kind === "drone" || e.kind === "boss") {
      e.fireTimer -= dt * 1000;
      if (e.fireTimer <= 0) {
        const speed = e.kind === "boss" ? 4.4 : 5.7;
        const count = e.kind === "boss" ? 3 : 1;
        for (let b = 0; b < count; b += 1) {
          const offset = (b - (count - 1) / 2) * 0.16;
          const ang = Math.atan2(dy, dx) + offset;
          state.projectiles.push({
            owner: "enemy",
            x: e.x,
            y: e.y,
            vx: Math.cos(ang) * speed,
            vy: Math.sin(ang) * speed,
            radius: e.kind === "boss" ? 6 : 4,
            damage: e.damage,
            life: 1700,
            color: e.kind === "boss" ? "#ff8f54" : "#ff6f8c",
          });
        }

        if (Math.random() < 0.3) {
          playSfx("enemyshoot");
        }

        e.fireTimer = e.kind === "boss" ? rand(580, 900) : rand(1200, 2300);
      }
    }

    if (dist <= e.radius + p.radius + 2 && e.attackCd <= 0) {
      dealDamageToPlayer(e.damage);
      e.attackCd = 650;
      p.vx += nx * -180;
      p.vy += ny * -180;
    }

    if (e.hp <= 0) {
      emitBurst(e.x, e.y, e.kind === "boss" ? 60 : 20, 170, "#ffa178");
      addFloatingText(e.x, e.y - 18, `+${e.xp}XP`, "#a6faff");
      state.score += e.kind === "boss" ? 1500 : e.kind === "brute" ? 240 : 120;
      gainXp(e.xp);
      playSfx("kill");
      state.enemies.splice(i, 1);
    }
  }
}

function updateProjectiles(dt) {
  const p = state.player;

  for (let i = state.projectiles.length - 1; i >= 0; i -= 1) {
    const b = state.projectiles[i];
    b.x += b.vx * dt * 60;
    b.y += b.vy * dt * 60;
    b.life -= dt * 1000;

    if (b.life <= 0 || b.x < -40 || b.y < -40 || b.x > canvas.width + 40 || b.y > canvas.height + 40) {
      state.projectiles.splice(i, 1);
      continue;
    }

    if (b.owner === "player") {
      for (let e = state.enemies.length - 1; e >= 0; e -= 1) {
        const enemy = state.enemies[e];
        const dist = Math.hypot(enemy.x - b.x, enemy.y - b.y);
        if (dist <= enemy.radius + b.radius) {
          enemy.hp -= b.damage;
          enemy.hitFlash = 100;
          emitBurst(b.x, b.y, 5, 80, "#96f4ff");
          state.projectiles.splice(i, 1);
          break;
        }
      }
    } else if (Math.hypot(p.x - b.x, p.y - b.y) <= p.radius + b.radius) {
      dealDamageToPlayer(b.damage);
      state.projectiles.splice(i, 1);
    }
  }
}

function updateFx(dtMs) {
  for (const star of fx.stars) {
    star.y += star.z * 0.06 * dtMs;
    if (star.y > canvas.height) {
      star.y = -2;
      star.x = Math.random() * canvas.width;
    }
  }

  for (let i = fx.trails.length - 1; i >= 0; i -= 1) {
    const t = fx.trails[i];
    t.life -= dtMs;
    if (t.life <= 0) {
      fx.trails.splice(i, 1);
    }
  }

  for (let i = fx.flashes.length - 1; i >= 0; i -= 1) {
    const f = fx.flashes[i];
    f.life -= dtMs;
    if (f.life <= 0) {
      fx.flashes.splice(i, 1);
    }
  }

  fx.shake = Math.max(0, fx.shake - dtMs * 0.025);

  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const pt = state.particles[i];
    pt.x += (pt.vx * dtMs) / 1000;
    pt.y += (pt.vy * dtMs) / 1000;
    pt.vx *= 0.965;
    pt.vy *= 0.965;
    pt.life -= dtMs;
    if (pt.life <= 0) {
      state.particles.splice(i, 1);
    }
  }

  for (let i = state.floatingText.length - 1; i >= 0; i -= 1) {
    const t = state.floatingText[i];
    t.y -= dtMs * 0.04;
    t.life -= dtMs;
    if (t.life <= 0) {
      state.floatingText.splice(i, 1);
    }
  }
}

function drawArena() {
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, "#11193b");
  grad.addColorStop(0.6, "#0b1330");
  grad.addColorStop(1, "#070d20");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const star of fx.stars) {
    ctx.fillStyle = `rgba(167,213,255,${0.2 + star.z * 0.6})`;
    ctx.fillRect(star.x, star.y, star.z * 1.8, star.z * 1.8);
  }

  ctx.strokeStyle = "rgba(118, 168, 255, 0.12)";
  for (let x = 0; x <= canvas.width; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y <= canvas.height; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  const pulse = 0.25 + Math.sin(state.time * 0.002) * 0.08;
  ctx.strokeStyle = `rgba(95, 152, 255, ${pulse})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(
    config.arenaPadding,
    config.arenaPadding,
    canvas.width - config.arenaPadding * 2,
    canvas.height - config.arenaPadding * 2
  );
}

function drawPlayer() {
  const p = state.player;
  const aim = Math.atan2(mouse.y - p.y, mouse.x - p.x);

  for (const t of fx.trails) {
    const alpha = t.life / t.maxLife;
    ctx.fillStyle = `rgba(114,220,255,${alpha * 0.25})`;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 22 * (1 - alpha * 0.35), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(aim);

  const body = ctx.createRadialGradient(-4, -4, 2, 0, 0, p.radius + 3);
  body.addColorStop(0, p.invuln > 0 ? "#d8fbff" : "#87e9ff");
  body.addColorStop(1, p.invuln > 0 ? "#72d6ff" : "#3aa6d7");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#11355d";
  ctx.fillRect(0, -4, p.radius + 10, 8);

  ctx.restore();

  if (p.dash.timer > 0) {
    ctx.strokeStyle = "rgba(124, 239, 255, 0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  const light = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 92);
  light.addColorStop(0, "rgba(133,234,255,0.12)");
  light.addColorStop(1, "rgba(133,234,255,0)");
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 92, 0, Math.PI * 2);
  ctx.fill();
}

function drawEnemies() {
  state.enemies.forEach((e) => {
    if (e.kind === "boss") {
      const bossG = ctx.createRadialGradient(e.x - 12, e.y - 14, 10, e.x, e.y, e.radius + 8);
      bossG.addColorStop(0, e.hitFlash > 0 ? "#ffe7dc" : "#ffc39a");
      bossG.addColorStop(1, "#d65f2a");
      ctx.fillStyle = bossG;
    } else if (e.kind === "brute") {
      const bruteG = ctx.createRadialGradient(e.x - 8, e.y - 8, 6, e.x, e.y, e.radius + 3);
      bruteG.addColorStop(0, e.hitFlash > 0 ? "#ffdce8" : "#ffa4be");
      bruteG.addColorStop(1, "#d44774");
      ctx.fillStyle = bruteG;
    } else {
      const droneG = ctx.createRadialGradient(e.x - 7, e.y - 7, 4, e.x, e.y, e.radius + 2);
      droneG.addColorStop(0, e.hitFlash > 0 ? "#ffd9e2" : "#ff8da8");
      droneG.addColorStop(1, "#c5305b");
      ctx.fillStyle = droneG;
    }

    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.fill();

    const w = e.radius * 2.2;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 14, w, 5);
    ctx.fillStyle = e.kind === "boss" ? "#ffb168" : "#ff87a3";
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 14, w * (e.hp / e.maxHp), 5);
  });
}

function drawProjectiles() {
  state.projectiles.forEach((b) => {
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = b.owner === "player" ? "rgba(125,238,255,0.18)" : "rgba(255,111,140,0.2)";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * 2.4, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawFx() {
  state.particles.forEach((pt) => {
    const alpha = clamp(pt.life / pt.maxLife, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
    ctx.globalAlpha = 1;
  });

  state.floatingText.forEach((t) => {
    ctx.fillStyle = t.color;
    ctx.font = "bold 16px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(t.text, t.x, t.y);
  });

  for (const f of fx.flashes) {
    const a = (f.life / f.maxLife) * f.strength;
    ctx.fillStyle = `rgba(${f.color},${a})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const vignette = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    canvas.height * 0.25,
    canvas.width / 2,
    canvas.height / 2,
    canvas.height * 0.62
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.38)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawOverlay() {
  if (state.running) {
    return;
  }

  ctx.fillStyle = "rgba(3, 7, 16, 0.65)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = state.victory ? "#79f4ff" : "#ff8ca5";
  ctx.font = "bold 48px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(state.victory ? "VICTORY" : "MISSION FAILED", canvas.width / 2, canvas.height / 2 - 16);

  ctx.fillStyle = "#eaf0ff";
  ctx.font = "22px Inter, sans-serif";
  ctx.fillText(`Score: ${state.score}`, canvas.width / 2, canvas.height / 2 + 24);
  ctx.fillText("Druk R om opnieuw te starten", canvas.width / 2, canvas.height / 2 + 58);
}

function updateHud() {
  const p = state.player;
  ui.hp.textContent = Math.ceil(p.hp);
  ui.shield.textContent = Math.ceil(p.shield);
  ui.level.textContent = String(p.level);
  ui.xp.textContent = `${Math.floor(p.xp)} / ${xpForLevel(p.level)}`;
  ui.wave.textContent = String(state.wave);
  ui.score.textContent = String(state.score);

  const dashPct = 100 - (p.dash.cooldown / config.dashCooldown) * 100;
  const novaPct = 100 - (p.nova.cooldown / config.novaCooldown) * 100;

  ui.dashMeter.style.width = `${clamp(dashPct, 0, 100)}%`;
  ui.novaMeter.style.width = `${clamp(novaPct, 0, 100)}%`;
}

function initAudio() {
  if (audio.initialized) {
    return;
  }

  const ctxAudio = new AudioContext();
  const master = ctxAudio.createGain();
  const music = ctxAudio.createGain();
  const sfx = ctxAudio.createGain();

  master.gain.value = 0.45;
  music.gain.value = 0.2;
  sfx.gain.value = 0.48;

  music.connect(master);
  sfx.connect(master);
  master.connect(ctxAudio.destination);

  audio.context = ctxAudio;
  audio.master = master;
  audio.musicGain = music;
  audio.sfxGain = sfx;
  audio.initialized = true;
  audio.enabled = true;
  audio.nextBeatAt = ctxAudio.currentTime;

  ui.audioToggle.textContent = "Audio: AAN";
}

function tone({ freq = 440, duration = 0.15, type = "sine", gain = 0.2, slide = 1, target = audio.sfxGain }) {
  if (!audio.enabled || !audio.context) {
    return;
  }

  const now = audio.context.currentTime;
  const osc = audio.context.createOscillator();
  const env = audio.context.createGain();
  const filter = audio.context.createBiquadFilter();

  filter.type = "lowpass";
  filter.frequency.value = 2200;

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), now + duration);

  env.gain.setValueAtTime(0.0001, now);
  env.gain.exponentialRampToValueAtTime(gain, now + 0.02);
  env.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(filter);
  filter.connect(env);
  env.connect(target);

  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function noiseHit(duration = 0.08, gain = 0.14, highpass = 600) {
  if (!audio.enabled || !audio.context) {
    return;
  }

  const bufferSize = audio.context.sampleRate * duration;
  const buffer = audio.context.createBuffer(1, bufferSize, audio.context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }

  const source = audio.context.createBufferSource();
  source.buffer = buffer;

  const filter = audio.context.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = highpass;

  const env = audio.context.createGain();
  const now = audio.context.currentTime;
  env.gain.setValueAtTime(gain, now);
  env.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  source.connect(filter);
  filter.connect(env);
  env.connect(audio.sfxGain);
  source.start(now);
}

function playSfx(name) {
  if (!audio.enabled) {
    return;
  }

  if (name === "shoot") {
    tone({ freq: 650, duration: 0.07, type: "square", gain: 0.07, slide: 0.76 });
  } else if (name === "dash") {
    tone({ freq: 320, duration: 0.14, type: "sawtooth", gain: 0.08, slide: 1.9 });
    noiseHit(0.06, 0.05, 800);
  } else if (name === "nova") {
    tone({ freq: 220, duration: 0.36, type: "triangle", gain: 0.12, slide: 2.4 });
    tone({ freq: 440, duration: 0.28, type: "sine", gain: 0.06, slide: 1.2 });
  } else if (name === "hurt") {
    tone({ freq: 180, duration: 0.18, type: "sawtooth", gain: 0.11, slide: 0.55 });
  } else if (name === "kill") {
    tone({ freq: 500, duration: 0.11, type: "triangle", gain: 0.06, slide: 0.7 });
  } else if (name === "enemyshoot") {
    tone({ freq: 380, duration: 0.1, type: "square", gain: 0.04, slide: 0.8 });
  } else if (name === "levelup") {
    tone({ freq: 440, duration: 0.2, type: "triangle", gain: 0.08, slide: 1.5 });
    setTimeout(() => tone({ freq: 660, duration: 0.22, type: "triangle", gain: 0.07, slide: 1.35 }), 70);
  } else if (name === "boss") {
    tone({ freq: 120, duration: 0.55, type: "sawtooth", gain: 0.14, slide: 0.9 });
  } else if (name === "victory") {
    tone({ freq: 523, duration: 0.25, type: "triangle", gain: 0.11, slide: 1.2 });
    setTimeout(() => tone({ freq: 659, duration: 0.25, type: "triangle", gain: 0.1, slide: 1.25 }), 120);
    setTimeout(() => tone({ freq: 784, duration: 0.3, type: "triangle", gain: 0.1, slide: 1.3 }), 230);
  } else if (name === "fail") {
    tone({ freq: 260, duration: 0.35, type: "sawtooth", gain: 0.11, slide: 0.6 });
  }
}

function updateMusic() {
  if (!audio.enabled || !audio.context) {
    return;
  }

  const now = audio.context.currentTime;
  const beatDur = 60 / 104;

  while (audio.nextBeatAt < now + 0.12) {
    const root = state && state.bossSpawned ? 55 : 65;
    const seq = [0, 0, 7, 3];
    const note = root * Math.pow(2, seq[audio.bassPhase % seq.length] / 12);

    tone({
      freq: note,
      duration: beatDur * 0.9,
      type: "triangle",
      gain: 0.055,
      slide: 0.98,
      target: audio.musicGain,
    });

    if (audio.bassPhase % 2 === 0) {
      tone({
        freq: note * 2,
        duration: beatDur * 0.28,
        type: "sine",
        gain: 0.02,
        slide: 1.03,
        target: audio.musicGain,
      });
    }

    audio.nextBeatAt += beatDur;
    audio.bassPhase += 1;
  }
}

function toggleAudio() {
  if (!audio.initialized) {
    initAudio();
    return;
  }

  audio.enabled = !audio.enabled;
  ui.audioToggle.textContent = audio.enabled ? "Audio: AAN" : "Audio: UIT";
}

function tick(now) {
  if (!state) {
    return;
  }

  const dtMs = Math.min(40, now - state.lastFrame);
  const dt = dtMs / 1000;
  state.lastFrame = now;
  state.time += dtMs;

  updatePlayer(dt);
  updateSpawning(dtMs);
  updateEnemies(dt);
  updateProjectiles(dt);
  updateFx(dtMs);
  updateMusic();

  const shakeX = rand(-fx.shake, fx.shake);
  const shakeY = rand(-fx.shake, fx.shake);
  ctx.save();
  ctx.translate(shakeX, shakeY);

  drawArena();
  drawProjectiles();
  drawEnemies();
  drawPlayer();
  drawFx();
  drawOverlay();

  ctx.restore();
  updateHud();
  requestAnimationFrame(tick);
}

function startRun() {
  state = createInitialState();
  setMessage("Run gestart. Elimineer de Echo Drones.", "#9dff8d");
}

window.addEventListener("keydown", (event) => {
  const k = event.key.toLowerCase();
  keys.add(k);

  if (k === "shift") {
    activateDash();
  }

  if (k === "q") {
    activateNova();
  }

  if (k === "r") {
    startRun();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = (event.clientX - rect.left) * (canvas.width / rect.width);
  mouse.y = (event.clientY - rect.top) * (canvas.height / rect.height);
});

canvas.addEventListener("mousedown", () => {
  mouse.down = true;
  if (!audio.initialized) {
    initAudio();
  }
});

window.addEventListener("mouseup", () => {
  mouse.down = false;
});

ui.audioToggle.addEventListener("click", () => {
  toggleAudio();
});

ui.restart.addEventListener("click", () => {
  startRun();
});

startRun();
requestAnimationFrame(tick);
