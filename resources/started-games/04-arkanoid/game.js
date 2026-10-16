const CONFIG = {
  width: 640, height: 480,
  blockW: 32, blockH: 16, cols: 20,
  rowColors: ['gray', 'red', 'yellow', 'cyan', 'magenta', 'hotpink', 'green'],
  blocksTop: 60,
  paddleW: 81, paddleH: 14, paddleY: 450, paddleSpeed: 7,
  ballSize: 16, ballSpeed: 5,
  maxBounceAngle: 60,
  startLives: 3, pointsPerBlock: 10,
};

const state = {
  phase: 'ready',
  score: 0,
  lives: CONFIG.startLives,
  paddle: {
    x: (CONFIG.width - CONFIG.paddleW) / 2,
    y: CONFIG.paddleY,
    w: CONFIG.paddleW,
    h: CONFIG.paddleH,
  },
  ball: { x: 0, y: 0, vx: 0, vy: 0, size: CONFIG.ballSize },
  blocks: [],
};

const LEVELS = [
  [ // L1 — 20 blocks (5 cols)
    'XXXXX',
    'XXXXX',
    'XXXXX',
    'XXXXX',
  ],
  [ // L2 — 30 blocks, checkerboard (10 cols)
    'X.X.X.X.X.',
    '.X.X.X.X.X',
    'X.X.X.X.X.',
    '.X.X.X.X.X',
    'X.X.X.X.X.',
    '.X.X.X.X.X',
  ],
  [ // L3 — 40 blocks, V shape (16 cols)
    'XXXX........XXXX',
    '.XXXX......XXXX.',
    '..XXXX....XXXX..',
    '...XXXX..XXXX...',
    '....XXXXXXXX....',
  ],
  [ // L4 — 50 blocks, 2x2 empty squares (20 cols)
    'XX..XX..XX..XX..XX..',
    'XX..XX..XX..XX..XX..',
    '..XX..XX..XX..XX..XX',
    '..XX..XX..XX..XX..XX',
    'XX..XX..XX..XX..XX..',
  ],
  [ // L5 — 60 blocks, diagonal stripes (20 cols)
    'XX..XX..XX..XX..XX..',
    '.XX..XX..XX..XX..XX.',
    '..XX..XX..XX..XX..XX',
    'X..XX..XX..XX..XX..X',
    'XX..XX..XX..XX..XX..',
    '.XX..XX..XX..XX..XX.',
  ],
];

function buildBlocks(levelIndex) {
  const blocks = [];
  const layout = LEVELS[levelIndex];
  const bw = Math.min(CONFIG.blockW * 2, CONFIG.width / layout[0].length);
  const bh = bw / 2;
  const offsetX = (CONFIG.width - layout[0].length * bw) / 2;
  layout.forEach((rowStr, row) => {
    const color = CONFIG.rowColors[row % CONFIG.rowColors.length];
    for (let col = 0; col < rowStr.length; col++) {
      if (rowStr[col] !== 'X') continue;
      blocks.push({
        x: offsetX + col * bw,
        y: CONFIG.blocksTop + row * bh,
        w: bw,
        h: bh,
        color,
        alive: true,
        breakElapsed: null,
      });
    }
  });
  return blocks;
}

state.level = 1;
state.showBanner = false;

function loadLevel(n) {
  state.level = n;
  state.blocks = buildBlocks(n - 1);
  state.paddle.x = (CONFIG.width - state.paddle.w) / 2;
  state.phase = 'ready';
  stickBallToPaddle();
  state.showBanner = true;
}

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const keys = { left: false, right: false };

function setKey(e, down) {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = down;
  else if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = down;
  else return;
  e.preventDefault();
}

window.addEventListener('keydown', (e) => setKey(e, true));
window.addEventListener('keyup', (e) => setKey(e, false));

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mouseX = (e.clientX - rect.left) * (CONFIG.width / rect.width);
  state.paddle.x = mouseX - state.paddle.w / 2;
  clampPaddle();
});

function clampPaddle() {
  const p = state.paddle;
  p.x = Math.max(0, Math.min(CONFIG.width - p.w, p.x));
}

const LAUNCH_ANGLE = 15; // degrees from vertical, to the right

function stickBallToPaddle() {
  const p = state.paddle;
  const b = state.ball;
  b.x = p.x + (p.w - b.size) / 2;
  b.y = p.y - b.size;
  b.vx = 0;
  b.vy = 0;
}

function resetGame() {
  state.score = 0;
  state.lives = CONFIG.startLives;
  loadLevel(1);
}

function levelSpeed() {
  return CONFIG.ballSpeed + 0.5 * (state.level - 1);
}

function launchBall() {
  if (state.phase === 'gameover' || state.phase === 'win') {
    resetGame();
    return;
  }
  if (state.phase !== 'ready') return;
  const rad = LAUNCH_ANGLE * Math.PI / 180;
  state.ball.vx = levelSpeed() * Math.sin(rad);
  state.ball.vy = -levelSpeed() * Math.cos(rad);
  state.phase = 'playing';
  state.showBanner = false;
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    launchBall();
  }
});
canvas.addEventListener('mousedown', launchBall);

loadLevel(1);

const STEP_MS = 1000 / 60;
let lastTime = 0;
let accumulator = 0;

const SOUNDS = {
  bounce: new Audio('assets/sounds/ball-bounce.mp3'),
  brk:    new Audio('assets/sounds/break-sound.mp3'),
};
SOUNDS.bounce.preload = 'auto';
SOUNDS.brk.preload = 'auto';

function playSound(audio) {
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

function update() {
  if (keys.left) state.paddle.x -= CONFIG.paddleSpeed;
  if (keys.right) state.paddle.x += CONFIG.paddleSpeed;
  clampPaddle();

  for (const block of state.blocks) {
    if (block.breakElapsed === null) continue;
    block.breakElapsed += STEP_MS;
    if (block.breakElapsed >= EXPLOSION_DURATION) block.breakElapsed = null;
  }

  // last block hit: freeze the ball until its explosion ends, then win
  if (state.phase === 'playing' && !state.blocks.some((blk) => blk.alive)) {
    if (!state.blocks.some((blk) => blk.breakElapsed !== null)) {
      if (state.level < LEVELS.length) loadLevel(state.level + 1);
      else state.phase = 'win';
    }
    return;
  }

  const b = state.ball;
  if (state.phase === 'ready') {
    stickBallToPaddle();
  } else if (state.phase === 'playing') {
    let bounced = false;
    let broke = false;
    b.x += b.vx;
    b.y += b.vy;
    if (b.x < 0) { b.x = 0; b.vx = -b.vx; bounced = true; }
    else if (b.x + b.size > CONFIG.width) { b.x = CONFIG.width - b.size; b.vx = -b.vx; bounced = true; }
    if (b.y < 0) { b.y = 0; b.vy = -b.vy; bounced = true; }

    if (b.y > CONFIG.height) {
      state.lives--;
      if (state.lives <= 0) {
        state.phase = 'gameover';
      } else {
        state.phase = 'ready';
        stickBallToPaddle();
      }
      return;
    }

    const p = state.paddle;
    if (
      b.vy > 0 &&
      b.x + b.size > p.x && b.x < p.x + p.w &&
      b.y + b.size > p.y && b.y < p.y + p.h
    ) {
      const hit = (b.x + b.size / 2 - (p.x + p.w / 2)) / (p.w / 2); // -1..1
      const clamped = Math.max(-1, Math.min(1, hit));
      const rad = clamped * CONFIG.maxBounceAngle * Math.PI / 180;
      b.vx = levelSpeed() * Math.sin(rad);
      b.vy = -levelSpeed() * Math.cos(rad);
      b.y = p.y - b.size;
      bounced = true;
    }

    for (const block of state.blocks) {
      if (!block.alive) continue;
      if (
        b.x + b.size <= block.x || b.x >= block.x + block.w ||
        b.y + b.size <= block.y || b.y >= block.y + block.h
      ) continue;

      block.alive = false;
      block.breakElapsed = 0;
      state.score += CONFIG.pointsPerBlock;
      broke = true;

      // reflect on the axis with the smaller overlap
      const overlapX = Math.min(b.x + b.size - block.x, block.x + block.w - b.x);
      const overlapY = Math.min(b.y + b.size - block.y, block.y + block.h - b.y);
      if (overlapX < overlapY) {
        b.vx = -b.vx;
        b.x += b.x + b.size / 2 < block.x + block.w / 2 ? -overlapX : overlapX;
      } else {
        b.vy = -b.vy;
        b.y += b.y + b.size / 2 < block.y + block.h / 2 ? -overlapY : overlapY;
      }
      break; // one block per step
    }

    if (broke) playSound(SOUNDS.brk);
    else if (bounced) playSound(SOUNDS.bounce);
  }
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);

  for (const block of state.blocks) {
    if (block.alive) {
      drawSprite(ctx, 'block_' + block.color, block.x, block.y, block.w, block.h);
    } else if (block.breakElapsed !== null) {
      const i = Math.min(3, Math.floor(block.breakElapsed / (EXPLOSION_DURATION / 4)));
      drawFrame(ctx, EXPLOSION_FRAMES[block.color][i], block.x, block.y, block.w, block.h);
    }
  }

  ctx.fillStyle = '#fff';
  ctx.font = '16px monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText('Score: ' + state.score, 10, 10);
  ctx.textAlign = 'center';
  ctx.fillText('Level ' + state.level, CONFIG.width / 2, 10);
  ctx.textAlign = 'left';
  const lifeSize = 16, lifeGap = 4;
  for (let i = 0; i < state.lives; i++) {
    const lx = CONFIG.width - 10 - (i + 1) * lifeSize - i * lifeGap;
    drawSprite(ctx, 'ball', lx, 10, lifeSize, lifeSize);
  }

  const p = state.paddle;
  drawSprite(ctx, 'paddle', p.x, p.y, p.w, p.h);

  const b = state.ball;
  drawSprite(ctx, 'ball', b.x, b.y, b.size, b.size);

  if (state.showBanner && state.phase === 'ready') {
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '40px monospace';
    ctx.fillText('LEVEL ' + state.level, CONFIG.width / 2, CONFIG.height / 2 + 40);
  }

  if (state.phase === 'gameover' || state.phase === 'win') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '40px monospace';
    ctx.fillText(state.phase === 'win' ? 'YOU WIN!' : 'GAME OVER', CONFIG.width / 2, CONFIG.height / 2 - 40);
    ctx.font = '20px monospace';
    ctx.fillText('Final score: ' + state.score, CONFIG.width / 2, CONFIG.height / 2 + 5);
    ctx.fillText('Press Space or click to restart', CONFIG.width / 2, CONFIG.height / 2 + 40);
  }
}

function loop(time) {
  accumulator += Math.min(time - lastTime, 100);
  lastTime = time;
  while (accumulator >= STEP_MS) {
    update();
    accumulator -= STEP_MS;
  }
  draw();
  requestAnimationFrame(loop);
}

loadSpritesheet(() => {
  lastTime = performance.now();
  requestAnimationFrame(loop);
});
