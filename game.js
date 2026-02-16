const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreText = document.getElementById("score");
const livesText = document.getElementById("lives");
const restartButton = document.getElementById("restart");

const gravity = 0.5;
const groundHeight = 60;

const player = {
  x: 60,
  y: canvas.height - groundHeight - 40,
  width: 36,
  height: 36,
  color: "#76f7ff",
  velocityX: 0,
  velocityY: 0,
  speed: 4,
  jumpPower: 10,
  onGround: true,
};

let score = 0;
let lives = 3;
let gameOver = false;
let stars = [];
let asteroids = [];
let frame = 0;

const keys = {
  left: false,
  right: false,
};

function resetGame() {
  score = 0;
  lives = 3;
  gameOver = false;
  stars = [];
  asteroids = [];
  frame = 0;

  player.x = 60;
  player.y = canvas.height - groundHeight - player.height;
  player.velocityX = 0;
  player.velocityY = 0;
  player.onGround = true;

  updateHud();
}

function updateHud() {
  scoreText.textContent = String(score);
  livesText.textContent = String(lives);
}

function spawnStar() {
  stars.push({
    x: canvas.width + 20,
    y: Math.random() * (canvas.height - groundHeight - 120) + 40,
    size: 10,
    speed: 2 + Math.random() * 1.8,
  });
}

function spawnAsteroid() {
  const size = 22 + Math.random() * 12;
  asteroids.push({
    x: canvas.width + size,
    y: canvas.height - groundHeight - size,
    size,
    speed: 3.6 + Math.random() * 2,
  });
}

function drawBackground() {
  ctx.fillStyle = "#0f183f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
  for (let i = 0; i < 60; i += 1) {
    const x = (i * 113 + frame * 0.35) % canvas.width;
    const y = (i * 67) % (canvas.height - groundHeight);
    ctx.fillRect(x, y, 2, 2);
  }

  ctx.fillStyle = "#1c2f6e";
  ctx.fillRect(0, canvas.height - groundHeight, canvas.width, groundHeight);
}

function drawPlayer() {
  ctx.fillStyle = player.color;
  ctx.fillRect(player.x, player.y, player.width, player.height);

  ctx.fillStyle = "#0d3e6f";
  ctx.fillRect(player.x + 8, player.y + 9, 7, 7);
  ctx.fillRect(player.x + 22, player.y + 9, 7, 7);
}

function drawStar(star) {
  ctx.save();
  ctx.translate(star.x, star.y);
  ctx.fillStyle = "#ffe066";
  ctx.beginPath();
  for (let i = 0; i < 5; i += 1) {
    ctx.lineTo(Math.cos((18 + i * 72) * (Math.PI / 180)) * star.size, Math.sin((18 + i * 72) * (Math.PI / 180)) * star.size);
    ctx.lineTo(
      Math.cos((54 + i * 72) * (Math.PI / 180)) * (star.size * 0.45),
      Math.sin((54 + i * 72) * (Math.PI / 180)) * (star.size * 0.45)
    );
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawAsteroid(asteroid) {
  ctx.fillStyle = "#ff5757";
  ctx.beginPath();
  ctx.arc(asteroid.x, asteroid.y, asteroid.size, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#b43333";
  ctx.beginPath();
  ctx.arc(asteroid.x - asteroid.size * 0.3, asteroid.y - asteroid.size * 0.2, asteroid.size * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

function intersects(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function updatePlayer() {
  if (keys.left) {
    player.velocityX = -player.speed;
  } else if (keys.right) {
    player.velocityX = player.speed;
  } else {
    player.velocityX = 0;
  }

  player.x += player.velocityX;
  player.y += player.velocityY;

  player.velocityY += gravity;

  if (player.x < 0) {
    player.x = 0;
  }

  if (player.x + player.width > canvas.width) {
    player.x = canvas.width - player.width;
  }

  const floorY = canvas.height - groundHeight - player.height;
  if (player.y >= floorY) {
    player.y = floorY;
    player.velocityY = 0;
    player.onGround = true;
  } else {
    player.onGround = false;
  }
}

function updateObjects() {
  stars.forEach((star) => {
    star.x -= star.speed;
  });

  asteroids.forEach((asteroid) => {
    asteroid.x -= asteroid.speed;
  });

  stars = stars.filter((star) => star.x + star.size > -10);
  asteroids = asteroids.filter((asteroid) => asteroid.x + asteroid.size > -30);

  for (let i = stars.length - 1; i >= 0; i -= 1) {
    const star = stars[i];
    const starBox = {
      x: star.x - star.size,
      y: star.y - star.size,
      width: star.size * 2,
      height: star.size * 2,
    };

    if (intersects(player, starBox)) {
      stars.splice(i, 1);
      score += 1;
      updateHud();
    }
  }

  for (let i = asteroids.length - 1; i >= 0; i -= 1) {
    const asteroid = asteroids[i];
    const asteroidBox = {
      x: asteroid.x - asteroid.size,
      y: asteroid.y - asteroid.size,
      width: asteroid.size * 2,
      height: asteroid.size * 2,
    };

    if (intersects(player, asteroidBox)) {
      asteroids.splice(i, 1);
      lives -= 1;
      updateHud();

      if (lives <= 0) {
        gameOver = true;
      }
    }
  }
}

function drawGameOver() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 44px Segoe UI";
  ctx.textAlign = "center";
  ctx.fillText("Game over", canvas.width / 2, canvas.height / 2 - 15);

  ctx.font = "22px Segoe UI";
  ctx.fillText(`Eindscore: ${score}`, canvas.width / 2, canvas.height / 2 + 28);
}

function gameLoop() {
  frame += 1;

  drawBackground();

  if (!gameOver) {
    if (frame % 90 === 0) {
      spawnStar();
    }

    if (frame % 130 === 0) {
      spawnAsteroid();
    }

    updatePlayer();
    updateObjects();
  }

  stars.forEach(drawStar);
  asteroids.forEach(drawAsteroid);
  drawPlayer();

  if (gameOver) {
    drawGameOver();
  }

  requestAnimationFrame(gameLoop);
}

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
    keys.left = true;
  }

  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
    keys.right = true;
  }

  if ((event.key === " " || event.key === "ArrowUp") && player.onGround && !gameOver) {
    player.velocityY = -player.jumpPower;
  }
});

window.addEventListener("keyup", (event) => {
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
    keys.left = false;
  }

  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
    keys.right = false;
  }
});

restartButton.addEventListener("click", () => {
  resetGame();
});

resetGame();
requestAnimationFrame(gameLoop);
