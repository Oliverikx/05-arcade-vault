'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

// index = piece type: I, O, T, S, Z, J, L, Screw
const SKINS = {
  retro: {
    label: 'Retro',
    colors: [null, '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#64b5f6', '#ffb74d', '#b0bec5'],
  },
  neon: {
    label: 'Neon',
    colors: [null, '#00fff2', '#ffee00', '#d400ff', '#39ff14', '#ff073a', '#1f51ff', '#ff9500', '#e0e0ff'],
  },
  pastel: {
    label: 'Pastel',
    colors: [null, '#a8e6ef', '#fff1b8', '#d9b8f0', '#b8e6c1', '#f5b8b8', '#b8d4f5', '#fbd3a8', '#d5dde2'],
  },
  pixel: {
    label: 'Pixel art',
    colors: [null, '#29b6c9', '#e6b422', '#9c3fb0', '#4caf50', '#d84343', '#3f7fd6', '#e8821e', '#8a9ba5'],
  },
};
const DEFAULT_SKIN = 'retro';
let skin = DEFAULT_SKIN;
let COLORS = SKINS[skin].colors;

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // Screw
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const ENERGY_MAX = 100;
const ENERGY_PER_LINE = 25;
const PREVIEW_PIECES = 10; // spawns the 5-piece preview stays active
const PREVIEW_COUNT = 5;
const SLOW_MS = 10000;
const SLOW_FACTOR = 2;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeBtn = document.getElementById('theme-btn');
const skinSelect = document.getElementById('skin-select');
const energyFill = document.getElementById('energy-fill');
const abilityStatus = document.getElementById('ability-status');
const abilityMenu = document.getElementById('ability-menu');
const holdSection = document.getElementById('hold-section');
const holdCanvas = document.getElementById('hold-canvas');
const holdCtx = holdCanvas.getContext('2d');
const queueSection = document.getElementById('queue-section');
const queueCanvas = document.getElementById('queue-canvas');
const queueCtx = queueCanvas.getContext('2d');
const recordsEl = document.getElementById('records');
const scoresList = document.getElementById('scores-list');
const recordsStats = document.getElementById('records-stats');
const saveBtn = document.getElementById('save-btn');
const resetBtn = document.getElementById('reset-btn');

const RECORDS_KEY = 'tetris-records';
const MAX_SCORES = 5;
const MAX_NAME = 12;

const pauseMenu = document.getElementById('pause-menu');
const pauseControls = document.getElementById('pause-controls');
const startLevelSel = document.getElementById('start-level');

let board, current, queue, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let energy, previewLeft, slowMs, held, holdReady, undoSnap, choosing;
let combo, bestCombo, records, pendingRank;
let startLevel = 1, nextStartLevel = 1;
const pressed = new Set(); // keys currently held
let blocked = new Set();   // keys held at resume time; ignored until released

function intervalFor(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function makePiece(type) {
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function randomPiece() {
  return makePiece(Math.floor(Math.random() * (PIECES.length - 1)) + 1);
}

function fillQueue() {
  while (queue.length < PREVIEW_COUNT + 1) queue.push(randomPiece());
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  // combo = consecutive locks that clear at least one line
  combo = cleared ? combo + 1 : 0;
  bestCombo = Math.max(bestCombo, combo);
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.max(startLevel, Math.floor(lines / 10) + 1);
    dropInterval = intervalFor(level);
    energy = Math.min(ENERGY_MAX, energy + cleared * ENERGY_PER_LINE);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  undoSnap = {
    board: board.map(r => [...r]),
    type: current.type,
    score, lines, level, dropInterval,
  };
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = queue.shift();
  fillQueue();
  if (previewLeft > 0) previewLeft--;
  if (collide(current.shape, current.x, current.y)) {
    // keep only the cells that fit in free board spaces
    current.shape = current.shape.map((row, r) =>
      row.map((v, c) => (v && !collide([[v]], current.x + c, current.y + r) ? v : 0)));
    endGame();
  }
  drawNext();
  drawQueue();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  energyFill.style.width = `${(energy / ENERGY_MAX) * 100}%`;
  energyFill.classList.toggle('ready', energy >= ENERGY_MAX);
  if (slowMs > 0) abilityStatus.textContent = `Lento ${Math.ceil(slowMs / 1000)}s`;
  else abilityStatus.textContent = energy >= ENERGY_MAX ? 'Pulsa E' : '';
}

// ---- Abilities ----
const ABILITIES = {
  1: abilityPreview,
  2: abilitySwap,
  3: abilitySlow,
  4: abilityUndo,
  5: abilityHold,
};

function abilityPreview() {
  previewLeft = PREVIEW_PIECES + 1; // +1: current spawn decrement already happened
  drawQueue();
  return true;
}

function abilitySwap() {
  let type;
  do {
    type = Math.floor(Math.random() * (PIECES.length - 1)) + 1;
  } while (type === current.type);
  const shape = PIECES[type].map(row => [...row]);
  for (const kick of [0, -1, 1, -2, 2]) {
    if (!collide(shape, current.x + kick, current.y)) {
      current = { type, shape, x: current.x + kick, y: current.y };
      return true;
    }
  }
  return false;
}

function abilitySlow() {
  slowMs = SLOW_MS;
  return true;
}

function abilityUndo() {
  if (!undoSnap) return false;
  board = undoSnap.board;
  score = undoSnap.score;
  lines = undoSnap.lines;
  level = undoSnap.level;
  dropInterval = undoSnap.dropInterval;
  queue.unshift(makePiece(current.type));
  current = makePiece(undoSnap.type);
  undoSnap = null;
  drawNext();
  drawQueue();
  return true;
}

function abilityHold() {
  if (held) return false;
  held = makePiece(current.type);
  holdReady = true;
  spawn();
  drawHold();
  return true;
}

function useHeld() {
  if (!holdReady || !held) return;
  queue.unshift(makePiece(current.type));
  current = makePiece(held.type);
  held = null;
  holdReady = false;
  if (collide(current.shape, current.x, current.y)) endGame();
  drawHold();
  drawNext();
  drawQueue();
}

function openAbilityMenu() {
  if (energy < ENERGY_MAX || paused || gameOver || choosing) return;
  choosing = true;
  cancelAnimationFrame(animId);
  abilityMenu.querySelector('[data-ability="4"]').disabled = !undoSnap;
  abilityMenu.querySelector('[data-ability="5"]').disabled = !!held;
  abilityMenu.classList.remove('hidden');
}

function closeAbilityMenu() {
  if (!choosing) return;
  choosing = false;
  abilityMenu.classList.add('hidden');
  lastTime = performance.now();
  loop(lastTime);
}

function useAbility(id) {
  const fn = ABILITIES[id];
  if (!choosing || !fn || !fn()) return;
  energy = 0;
  updateHUD();
  closeAbilityMenu();
}

function roundedRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

const BLOCK_DRAWERS = {
  retro(context, px, py, s, color) {
    context.fillStyle = color;
    context.fillRect(px, py, s, s);
    context.fillStyle = 'rgba(255,255,255,0.12)';
    context.fillRect(px, py, s, 4);
  },
  neon(context, px, py, s, color) {
    context.shadowColor = color;
    context.shadowBlur = 12;
    context.fillStyle = color;
    context.fillRect(px + 1, py + 1, s - 2, s - 2);
    context.shadowBlur = 0;
    context.fillStyle = 'rgba(255,255,255,0.35)';
    context.fillRect(px + 3, py + 3, s - 6, 2);
  },
  pastel(context, px, py, s, color) {
    const r = Math.max(2, s * 0.3);
    context.fillStyle = color;
    roundedRectPath(context, px, py, s, s, r);
    context.fill();
    context.fillStyle = 'rgba(255,255,255,0.45)';
    roundedRectPath(context, px + s * 0.18, py + s * 0.14, s * 0.64, s * 0.16, s * 0.08);
    context.fill();
  },
  pixel(context, px, py, s, color) {
    const u = Math.max(2, Math.round(s / 6)); // texture "pixel" size
    context.fillStyle = color;
    context.fillRect(px, py, s, s);
    // checker texture
    context.fillStyle = 'rgba(0,0,0,0.18)';
    for (let i = 0; i * u < s; i++)
      for (let j = 0; j * u < s; j++)
        if ((i + j) % 2) context.fillRect(px + i * u, py + j * u, Math.min(u, s - i * u), Math.min(u, s - j * u));
    // bevel
    context.fillStyle = 'rgba(255,255,255,0.45)';
    context.fillRect(px, py, s, u);
    context.fillRect(px, py, u, s);
    context.fillStyle = 'rgba(0,0,0,0.5)';
    context.fillRect(px, py + s - u, s, u);
    context.fillRect(px + s - u, py, u, s);
  },
};

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  context.globalAlpha = alpha ?? 1;
  BLOCK_DRAWERS[skin](context, x * size + 1, y * size + 1, size - 2, COLORS[colorIndex]);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  if (!gameOver) {
    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);
  }

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

// draws a piece centered in a 4x4-cell slot at (slotX, slotY) cells
function drawPieceInSlot(context, shape, size, slotX, slotY) {
  const offX = slotX + Math.floor((4 - shape[0].length) / 2);
  const offY = slotY + Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(context, offX + c, offY + r, shape[r][c], size);
}

function drawNext() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  drawPieceInSlot(nextCtx, queue[0].shape, 30, 0, 0);
}

function drawQueue() {
  queueSection.classList.toggle('hidden', previewLeft <= 0);
  queueCtx.clearRect(0, 0, queueCanvas.width, queueCanvas.height);
  if (previewLeft <= 0) return;
  for (let i = 0; i < PREVIEW_COUNT; i++)
    drawPieceInSlot(queueCtx, queue[i].shape, 15, 0, i * 4);
}

function drawHold() {
  holdSection.classList.toggle('hidden', !held);
  holdCtx.clearRect(0, 0, holdCanvas.width, holdCanvas.height);
  if (held) drawPieceInSlot(holdCtx, held.shape, 30, 0, 0);
}

// ---- Records ----
function loadRecords() {
  const empty = { scores: [], bestCombo: 0, maxLines: 0 };
  try {
    const r = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (!r || !Array.isArray(r.scores)) return empty;
    return {
      scores: r.scores
        .filter(s => s && Number.isFinite(s.score))
        .slice(0, MAX_SCORES),
      bestCombo: Number(r.bestCombo) || 0,
      maxLines: Number(r.maxLines) || 0,
    };
  } catch (e) {
    return empty;
  }
}

function saveRecords() {
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(records)); } catch (e) {}
}

function qualifies(value) {
  return value > 0 && (records.scores.length < MAX_SCORES || value > records.scores[MAX_SCORES - 1].score);
}

function rankFor(value) {
  const i = records.scores.findIndex(s => value > s.score);
  return i === -1 ? records.scores.length : i;
}

function scoreRow(nameNode, value) {
  const row = document.createElement('span');
  row.className = 'score-row';
  const v = document.createElement('span');
  v.textContent = value.toLocaleString();
  row.append(nameNode, v);
  return row;
}

function renderRecords(savedRank) {
  scoresList.replaceChildren();
  const rows = records.scores.map(s => ({ ...s }));
  if (pendingRank !== null) rows.splice(pendingRank, 0, { pending: true, score });
  rows.slice(0, MAX_SCORES).forEach((s, i) => {
    const li = document.createElement('li');
    if (s.pending) {
      li.className = 'highlight';
      const input = document.createElement('input');
      input.id = 'name-input';
      input.maxLength = MAX_NAME;
      input.placeholder = 'Tu nombre';
      input.autocomplete = 'off';
      input.addEventListener('keydown', e => {
        e.stopPropagation();
        if (e.key === 'Enter') submitName();
      });
      li.append(scoreRow(input, s.score));
    } else {
      if (i === savedRank) li.className = 'highlight';
      const name = document.createElement('span');
      name.textContent = s.name;
      li.append(scoreRow(name, s.score));
    }
    scoresList.append(li);
  });
  if (!scoresList.children.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Sin récords';
    scoresList.append(li);
  }
  recordsStats.textContent =
    `Mejor combo: ${records.bestCombo} · Máx. líneas: ${records.maxLines}`;
  saveBtn.classList.toggle('hidden', pendingRank === null);
}

function submitName() {
  if (pendingRank === null) return;
  const input = document.getElementById('name-input');
  const name = (input && input.value.trim().slice(0, MAX_NAME)) || 'Anónimo';
  const rank = pendingRank;
  records.scores.splice(rank, 0, { name, score });
  records.scores = records.scores.slice(0, MAX_SCORES);
  pendingRank = null;
  saveRecords();
  renderRecords(rank);
}

function showStartScreen() {
  gameOver = true; // blocks input until the player starts
  cancelAnimationFrame(animId);
  pendingRank = null;
  overlayTitle.textContent = 'TETRIS';
  overlayScore.textContent = '';
  restartBtn.textContent = 'Jugar';
  renderRecords();
  recordsEl.classList.remove('hidden');
  overlay.classList.remove('hidden');
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  records.bestCombo = Math.max(records.bestCombo, bestCombo);
  records.maxLines = Math.max(records.maxLines, lines);
  saveRecords();
  pendingRank = qualifies(score) ? rankFor(score) : null;
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}` +
    (pendingRank !== null ? ' · ¡Nuevo récord!' : '');
  restartBtn.textContent = 'Reiniciar';
  renderRecords();
  recordsEl.classList.remove('hidden');
  overlay.classList.remove('hidden');
  if (pendingRank !== null) document.getElementById('name-input').focus();
}

function togglePause() {
  if (gameOver || choosing) return;
  paused = !paused;
  if (!paused) {
    pauseMenu.classList.add('hidden');
    blocked = new Set(pressed);
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    pauseControls.classList.add('hidden');
    startLevelSel.value = nextStartLevel;
    pauseMenu.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (slowMs > 0) {
    slowMs = Math.max(0, slowMs - dt);
    updateHUD();
  }
  if (dropAccum >= dropInterval * (slowMs > 0 ? SLOW_FACTOR : 1)) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  startLevel = nextStartLevel;
  level = startLevel;
  paused = false;
  gameOver = false;
  dropInterval = intervalFor(level);
  dropAccum = 0;
  lastTime = performance.now();
  energy = 0;
  combo = 0;
  bestCombo = 0;
  pendingRank = null;
  previewLeft = 0;
  slowMs = 0;
  held = null;
  holdReady = false;
  undoSnap = null;
  choosing = false;
  queue = [];
  fillQueue();
  spawn();
  drawHold();
  updateHUD();
  overlay.classList.add('hidden');
  recordsEl.classList.add('hidden');
  abilityMenu.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  blocked = new Set(pressed);
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keyup', e => {
  pressed.delete(e.code);
  blocked.delete(e.code);
});
window.addEventListener('blur', () => { pressed.clear(); blocked.clear(); });

document.addEventListener('keydown', e => {
  pressed.add(e.code);
  if (paused && !gameOver) {
    // pause menu: only toggle keys act; game inputs are blocked
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if ((e.code === 'KeyP' || e.code === 'Escape') && !e.repeat) togglePause();
    return;
  }
  if (blocked.has(e.code)) {
    if (e.code === 'Space') e.preventDefault();
    return;
  }
  if (choosing) {
    if (e.code === 'Escape') closeAbilityMenu();
    else if (/^(Digit|Numpad)[1-5]$/.test(e.code)) useAbility(e.code.slice(-1));
    return;
  }
  if ((e.code === 'KeyP' || e.code === 'Escape') && !e.repeat) { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'KeyE':
      openAbilityMenu();
      return;
    case 'KeyC':
      useHeld();
      break;
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);
saveBtn.addEventListener('click', submitName);
resetBtn.addEventListener('click', () => {
  if (!confirm('¿Borrar todos los récords?')) return;
  records = { scores: [], bestCombo: 0, maxLines: 0 };
  saveRecords();
  renderRecords();
  resetBtn.blur();
});

document.getElementById('pause-resume').addEventListener('click', e => { togglePause(); e.currentTarget.blur(); });
document.getElementById('pause-restart').addEventListener('click', e => { e.currentTarget.blur(); init(); });
document.getElementById('pause-controls-btn').addEventListener('click', e => {
  pauseControls.classList.toggle('hidden');
  e.currentTarget.blur();
});
startLevelSel.addEventListener('change', () => {
  nextStartLevel = Number(startLevelSel.value);
  try { localStorage.setItem('startLevel', nextStartLevel); } catch (e) {}
  startLevelSel.blur();
});

abilityMenu.addEventListener('click', e => {
  const btn = e.target.closest('[data-ability]');
  if (btn && !btn.disabled) useAbility(btn.dataset.ability);
  else if (e.target.id === 'ability-cancel') closeAbilityMenu();
  if (btn) btn.blur();
});

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeBtn.textContent = theme === 'light' ? 'Dark mode' : 'Light mode';
  try { localStorage.setItem('theme', theme); } catch (e) {}
  // the loop is cancelled while paused / game over, so redraw explicitly
  draw();
  drawNext();
  drawQueue();
  drawHold();
}

themeBtn.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  themeBtn.blur();
});

records = loadRecords();
try { nextStartLevel = Math.min(10, Math.max(1, Number(localStorage.getItem('startLevel')) || 1)); } catch (e) {}
startLevelSel.value = nextStartLevel;
function applySkin(name) {
  if (!SKINS[name]) name = DEFAULT_SKIN;
  skin = name;
  COLORS = SKINS[name].colors;
  document.documentElement.dataset.skin = name;
  skinSelect.value = name;
  try { localStorage.setItem('skin', name); } catch (e) {}
  // loop is cancelled while paused / game over, so redraw explicitly
  draw();
  drawNext();
  drawQueue();
  drawHold();
}

for (const [id, s] of Object.entries(SKINS))
  skinSelect.add(new Option(s.label, id));

skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value);
  skinSelect.blur();
});

init();
showStartScreen();

let savedTheme = null;
let savedSkin = null;
try {
  savedTheme = localStorage.getItem('theme');
  savedSkin = localStorage.getItem('skin');
} catch (e) {}
applyTheme(savedTheme === 'light' ? 'light' : 'dark');
applySkin(savedSkin);
