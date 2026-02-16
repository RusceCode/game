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
      dash: {
        timer: 0,
        cooldown: 0,
      },
      nova: {
        cooldown: 0,
      },
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
    addFloatingText(player.x, player.y - 26, "LEVEL UP", "#74f7ff");
    setMessage(`Level ${player.level}! Core systems upgraded.`, "#74f7ff");
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

  let x = 0;
  let y = 0;
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
  }

  state.enemies.push({
    ...e,
    x,
    y,
    hitFlash: 0,
    attackCd: 0,
  });
}

function firePlayerWeapon() {
  const p = state.player;
  if (!state.running) {
    return;
  }

  if (p.shotTimer > 0) {
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
  setMessage("Pulse Nova ontketend.", "#93f2ff");
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

  if (p.hp <= 0) {
    p.hp = 0;
    state.running = false;
    state.victory = false;
    setMessage("Run gefaald. Druk op R voor een nieuwe poging.", "#ff7d96");
  }
}

function updatePlayer(dt) {
  const p = state.player;

  const xInput = Number(keys.has("ArrowRight") || keys.has("d")) - Number(keys.has("ArrowLeft") || keys.has("a"));
  const yInput = Number(keys.has("ArrowDown") || keys.has("s")) - Number(keys.has("ArrowUp") || keys.has("w"));

  const len = Math.hypot(xInput, yInput) || 1;
  const moveX = xInput / len;
  const moveY = yInput / len;

  const accel = 1800 * dt;
  p.vx += moveX * accel;
  p.vy += moveY * accel;

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
        e.fireTimer = e.kind === "boss" ? rand(580, 900) : rand(1200, 2300);
      }
    }

    if (dist <= e.radius + p.radius + 2 && e.attackCd <= 0) {
      dealDamageToPlayer(e.damage);
      e.attackCd = 650;
      const knock = 180;
      p.vx += nx * -knock;
      p.vy += ny * -knock;
    }

    if (e.hp <= 0) {
      emitBurst(e.x, e.y, e.kind === "boss" ? 60 : 20, 170, "#ffa178");
      addFloatingText(e.x, e.y - 18, `+${e.xp}XP`, "#a6faff");
      state.score += e.kind === "boss" ? 1500 : e.kind === "brute" ? 240 : 120;
      gainXp(e.xp);
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

    if (
      b.life <= 0 ||
      b.x < -40 ||
      b.y < -40 ||
      b.x > canvas.width + 40 ||
      b.y > canvas.height + 40
    ) {
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
    } else {
      const dist = Math.hypot(p.x - b.x, p.y - b.y);
      if (dist <= p.radius + b.radius) {
        dealDamageToPlayer(b.damage);
        state.projectiles.splice(i, 1);
      }
    }
  }
}

function updateFx(dtMs) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const pt = state.particles[i];
    pt.x += pt.vx * dtMs / 1000;
    pt.y += pt.vy * dtMs / 1000;
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
  grad.addColorStop(0, "#0f1732");
  grad.addColorStop(1, "#090f21");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

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

  ctx.strokeStyle = "rgba(95, 152, 255, 0.35)";
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

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(aim);

  ctx.fillStyle = p.invuln > 0 ? "#9de8ff" : "#6ad7ff";
  ctx.beginPath();
  ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#11355d";
  ctx.fillRect(0, -4, p.radius + 8, 8);

  ctx.restore();

  if (p.dash.timer > 0) {
    ctx.strokeStyle = "rgba(124, 239, 255, 0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 6, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawEnemies() {
  state.enemies.forEach((e) => {
    if (e.kind === "boss") {
      ctx.fillStyle = e.hitFlash > 0 ? "#ffd3bf" : "#ff9e66";
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#6a1b05";
      ctx.fillRect(e.x - 22, e.y - 7, 44, 14);
    } else if (e.kind === "brute") {
      ctx.fillStyle = e.hitFlash > 0 ? "#ffbfd0" : "#ff6f95";
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = e.hitFlash > 0 ? "#ffc1cd" : "#ff4e73";
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    const w = e.radius * 2.2;
    const h = 5;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 14, w, h);
    ctx.fillStyle = e.kind === "boss" ? "#ffb168" : "#ff87a3";
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 14, w * (e.hp / e.maxHp), h);
  });
}

function drawProjectiles() {
  state.projectiles.forEach((b) => {
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
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

  drawArena();
  drawProjectiles();
  drawEnemies();
  drawPlayer();
  drawFx();
  drawOverlay();
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
});

window.addEventListener("mouseup", () => {
  mouse.down = false;
});

ui.restart.addEventListener("click", () => {
  startRun();
});

startRun();
requestAnimationFrame(tick);
