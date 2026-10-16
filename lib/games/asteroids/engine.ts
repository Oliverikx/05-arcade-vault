// Asteroids engine — framework-free port of resources/started-games/02-asteroids/game.js

export type AsteroidsState = "ready" | "playing" | "dead" | "gameover";

export interface AsteroidsCallbacks {
  onScore(score: number): void;
  onLives(lives: number): void;
  onLevel(level: number): void;
  onGameOver(finalScore: number): void;
}

export interface AsteroidsGame {
  setPaused(paused: boolean): void; // freezes update, keeps drawing last frame
  end(): void; // force gameover → onGameOver(score)
  reset(): void; // new run, back to "ready"
  destroy(): void; // cancel rAF, remove listeners
}

const W = 800;
const H = 600;
const RADII = [0, 16, 30, 50];
const SPEEDS = [0, 85, 55, 32];
const POINTS = [0, 100, 50, 20];
const TRIPLE_SHOT_DURATION = 5;
const SHIELD_DURATION = 5;
const MAX_DT = 0.05;
const START_LIVES = 3;

const GAME_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"];

// ── Utils ───────────────────────────────────────────────────────────────────
const wrap = (v: number, max: number) => ((v % max) + max) % max;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));

type Keys = Record<string, boolean | undefined>;

// ── Entities ────────────────────────────────────────────────────────────────
class Bullet {
  vx: number;
  vy: number;
  ttl = 1.1;
  radius = 2;
  dead = false;

  constructor(
    public x: number,
    public y: number,
    angle: number,
  ) {
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
  }

  update(dt: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
    // Leaving the screen removes the bullet (no wrap)
    if (this.x < 0 || this.x > W || this.y < 0 || this.y > H) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

class Asteroid {
  radius: number;
  dead = false;
  vx: number;
  vy: number;
  rotSpeed: number;
  rot: number;
  verts: [number, number][] = [];

  constructor(
    public x: number,
    public y: number,
    public size = 3,
  ) {
    this.radius = RADII[size];
    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Irregular polygon
    const n = randInt(8, 13);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split(): Asteroid[] {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

class Ship {
  x = W / 2;
  y = H / 2;
  angle = -Math.PI / 2;
  vx = 0;
  vy = 0;
  radius = 12;
  thrusting = false;
  invincible = 3;
  shootCooldown = 0;
  dead = false;

  reset() {
    this.x = W / 2;
    this.y = H / 2;
    this.angle = -Math.PI / 2;
    this.vx = 0;
    this.vy = 0;
    this.thrusting = false;
    this.invincible = 3;
    this.shootCooldown = 0;
    this.dead = false;
  }

  update(dt: number, keys: Keys) {
    if (this.dead) return;
    if (this.invincible > 0) this.invincible -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;

    const ROT = 3.5; // rad/s
    const THRUST = 260; // px/s²
    const DRAG = 0.987;

    if (keys["ArrowLeft"]) this.angle -= ROT * dt;
    if (keys["ArrowRight"]) this.angle += ROT * dt;

    this.thrusting = !!keys["ArrowUp"];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot(triple: boolean): Bullet[] {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const SPREAD = 0.2; // rad
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    if (triple) {
      return [-SPREAD, 0, SPREAD].map(
        (d) => new Bullet(ox, oy, this.angle + d),
      );
    }
    return [new Bullet(ox, oy, this.angle)];
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.dead) return;
    // Blink while invincible after respawn
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0)
      return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";

    // Classic silhouette: triangle with rear notch
    ctx.beginPath();
    ctx.moveTo(20, 0); // nose
    ctx.lineTo(-12, -9); // left wing
    ctx.lineTo(-7, 0); // rear notch
    ctx.lineTo(-12, 9); // right wing
    ctx.closePath();
    ctx.stroke();

    // Thruster flame
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8, 4);
      ctx.strokeStyle = "rgba(255, 130, 0, 0.85)";
      ctx.stroke();
    }

    ctx.restore();
  }
}

class Particle {
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  dead = false;

  constructor(
    public x: number,
    public y: number,
  ) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl = this.life;
  }

  update(dt: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D) {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

type PowerUpType = "triple" | "shield";

class PowerUp {
  vx: number;
  vy: number;
  radius = 10;
  ttl = 8;
  dead = false;

  constructor(
    public x: number,
    public y: number,
    public type: PowerUpType,
  ) {
    const angle = rand(0, Math.PI * 2);
    this.vx = Math.cos(angle) * 20;
    this.vy = Math.sin(angle) * 20;
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D) {
    // Blink before disappearing
    if (this.ttl < 2 && Math.floor(this.ttl * 8) % 2 === 0) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    if (this.type === "shield") {
      // Icon: inner circle
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
    } else {
      // Icon: three fanned lines
      for (const a of [-0.6, 0, 0.6]) {
        const r = -Math.PI / 2 + a;
        ctx.moveTo(0, 5);
        ctx.lineTo(Math.cos(r) * 7, 5 + Math.sin(r) * 10);
      }
    }
    ctx.stroke();
    ctx.restore();
  }
}

// ── Engine ──────────────────────────────────────────────────────────────────
export function createAsteroidsGame(
  canvas: HTMLCanvasElement,
  // Wired in step 3 (callbacks fire on change only)
  _callbacks: AsteroidsCallbacks,
): AsteroidsGame {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");

  const keys: Keys = {};
  const justPressed: Keys = {};

  let ship = new Ship();
  let bullets: Bullet[] = [];
  let asteroids: Asteroid[] = [];
  let particles: Particle[] = [];
  let powerUps: PowerUp[] = [];
  let killsThisLevel = 0;
  let powerUpKillTargets = { triple: 0, shield: 0 };
  let tripleShotTimer = 0;
  let shieldTimer = 0;
  let score = 0;
  let lives = START_LIVES;
  let level = 1;
  let state: "playing" | "dead" | "gameover" = "playing";
  let deadTimer = 0;
  let lastTime: number | null = null;
  let rafId = 0;

  const pressed = (code: string) => {
    const val = justPressed[code];
    justPressed[code] = false;
    return !!val;
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    if (!e.repeat) justPressed[e.code] = true;
    keys[e.code] = true;
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys[e.code] = false;
  };

  function spawnAsteroids(count: number) {
    const SAFE_DIST = 130;
    for (let i = 0; i < count; i++) {
      let x: number, y: number;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
      asteroids.push(new Asteroid(x, y, 3));
    }
  }

  // Picks which asteroid kills drop each power-up (once per level).
  // Each large asteroid yields 7 kills (1 + 2 + 4); the last one is excluded.
  function setupPowerUp(count: number) {
    killsThisLevel = 0;
    const pick = () => Math.floor(rand(1, count * 7));
    const triple = pick();
    let shield: number;
    do {
      shield = pick();
    } while (shield === triple);
    powerUpKillTargets = { triple, shield };
  }

  function initGame() {
    ship = new Ship();
    bullets = [];
    asteroids = [];
    particles = [];
    powerUps = [];
    tripleShotTimer = 0;
    shieldTimer = 0;
    score = 0;
    lives = START_LIVES;
    level = 1;
    state = "playing";
    spawnAsteroids(4);
    setupPowerUp(4);
  }

  function nextLevel() {
    level++;
    bullets = [];
    particles = [];
    powerUps = [];
    ship.reset();
    spawnAsteroids(3 + level);
    setupPowerUp(3 + level);
  }

  function explode(x: number, y: number, count = 8) {
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
  }

  function killShip() {
    explode(ship.x, ship.y, 14);
    ship.dead = true;
    tripleShotTimer = 0;
    shieldTimer = 0;
    lives--;
    if (lives <= 0) {
      state = "gameover";
    } else {
      state = "dead";
      deadTimer = 2;
    }
  }

  function update(dt: number) {
    if (state === "gameover") {
      if (pressed("Space")) initGame();
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      return;
    }

    if (state === "dead") {
      deadTimer -= dt;
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      asteroids.forEach((a) => a.update(dt));
      powerUps.forEach((p) => p.update(dt));
      powerUps = powerUps.filter((p) => !p.dead);
      if (deadTimer <= 0) {
        state = "playing";
        ship.reset();
      }
      return;
    }

    if (pressed("Space")) {
      bullets.push(...ship.tryShoot(tripleShotTimer > 0));
    }

    ship.update(dt, keys);
    bullets.forEach((b) => b.update(dt));
    asteroids.forEach((a) => a.update(dt));
    particles.forEach((p) => p.update(dt));
    if (tripleShotTimer > 0) tripleShotTimer -= dt;
    if (shieldTimer > 0) shieldTimer -= dt;

    for (const p of powerUps) {
      p.update(dt);
      if (!p.dead && !ship.dead && dist(ship, p) < ship.radius + p.radius) {
        if (p.type === "shield") shieldTimer = SHIELD_DURATION;
        else tripleShotTimer = TRIPLE_SHOT_DURATION;
        explode(p.x, p.y, 10);
        p.dead = true;
      }
    }
    powerUps = powerUps.filter((p) => !p.dead);

    bullets = bullets.filter((b) => !b.dead);
    particles = particles.filter((p) => !p.dead);

    // Bullet vs asteroid
    const newAsteroids: Asteroid[] = [];
    for (const b of bullets) {
      for (const a of asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          score += POINTS[a.size];
          explode(a.x, a.y, a.size * 5);
          killsThisLevel++;
          for (const type of ["triple", "shield"] as const)
            if (killsThisLevel === powerUpKillTargets[type])
              powerUps.push(new PowerUp(a.x, a.y, type));
          newAsteroids.push(...a.split());
        }
      }
    }
    asteroids = asteroids.filter((a) => !a.dead).concat(newAsteroids);
    bullets = bullets.filter((b) => !b.dead);

    // Ship vs asteroid
    if (ship.invincible <= 0) {
      for (const a of asteroids) {
        if (dist(ship, a) < ship.radius + a.radius * 0.82) {
          if (shieldTimer > 0) {
            // Shield absorbs the hit and is consumed; brief grace period
            shieldTimer = 0;
            ship.invincible = 1;
            explode(ship.x, ship.y, 10);
          } else {
            killShip();
          }
          break;
        }
      }
    }

    // Level cleared
    if (asteroids.length === 0) nextLevel();
  }

  function drawLifeIcon(x: number, y: number) {
    if (!ctx) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 2);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(-6, -5);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-6, 5);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  function drawHUD() {
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.font = "15px monospace";

    ctx.textAlign = "left";
    ctx.fillText(`SCORE  ${score}`, 14, 26);
    let hudY = 46;
    if (tripleShotTimer > 0) {
      ctx.fillText(`TRIPLE  ${Math.ceil(tripleShotTimer)}s`, 14, hudY);
      hudY += 20;
    }
    if (shieldTimer > 0)
      ctx.fillText(`SHIELD  ${Math.ceil(shieldTimer)}s`, 14, hudY);

    ctx.textAlign = "center";
    ctx.fillText(`LEVEL ${level}`, W / 2, 26);

    for (let i = 0; i < lives; i++) drawLifeIcon(W - 16 - i * 22, 18);
  }

  function drawShield() {
    if (!ctx || shieldTimer <= 0 || ship.dead) return;
    // Blink when about to expire
    if (shieldTimer < 1.5 && Math.floor(shieldTimer * 8) % 2 === 0) return;
    ctx.strokeStyle = "rgba(120, 200, 255, 0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ship.x, ship.y, 22, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawOverlay(title: string, sub: string) {
    if (!ctx) return;
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 46px monospace";
    ctx.fillText(title, W / 2, H / 2 - 18);
    ctx.font = "18px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.fillText(sub, W / 2, H / 2 + 22);
  }

  function draw() {
    if (!ctx) return;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    particles.forEach((p) => p.draw(ctx));
    asteroids.forEach((a) => a.draw(ctx));
    powerUps.forEach((p) => p.draw(ctx));
    bullets.forEach((b) => b.draw(ctx));
    ship.draw(ctx);
    drawShield();

    drawHUD();

    if (state === "gameover")
      drawOverlay("GAME OVER", `SCORE: ${score}   —   SPACE TO RESTART`);
  }

  function loop(ts: number) {
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, MAX_DT);
    lastTime = ts;
    update(dt);
    draw();
    rafId = requestAnimationFrame(loop);
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  initGame();
  rafId = requestAnimationFrame(loop);

  return {
    // Implemented in step 3
    setPaused() {},
    end() {},
    reset() {},
    destroy() {
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
  };
}
