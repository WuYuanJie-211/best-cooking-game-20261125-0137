'use strict';
/* Ember & Thyme — Lunch Rush. An original timed cooking game.
 * Take orders from the board, grill patties, fry chips, stack each dish
 * on the plate and ring the bell to serve before patience runs out.
 * Mouse + keyboard. No network, no libraries, all art drawn in code.
 * URL demos for screenshots: ?demo=assembly | ready | rush | win | lose
 * (also ?shot=start|play|end). ?seed=N makes the order shuffle repeatable. */
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const W = 1280, H = 720;
const $status = document.getElementById('status');

/* ---------- utils ---------- */
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '20261125', 10) || 20261125;
let rng = mulberry32(seed);
function pick(arr) { return arr[Math.floor(rng() * arr.length)]; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function text(s, x, y, size, color, align, weight, font) {
  ctx.fillStyle = color; ctx.font = (weight || '700') + ' ' + size + 'px ' + (font || 'Trebuchet MS, Verdana, sans-serif');
  ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(s, x, y);
}
function shadowText(s, x, y, size, color, align, weight) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.font = (weight || '800') + ' ' + size + 'px Trebuchet MS, Verdana, sans-serif';
  ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(s, x + 2, y + 2);
  ctx.fillStyle = color; ctx.fillText(s, x, y);
}

/* ---------- audio: tiny synth, no files ---------- */
let AC = null, muted = false;
function ac() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } } return AC; }
function tone(f, d, type, vol, slide) {
  if (muted) return; const a = ac(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain(); o.type = type || 'sine'; o.frequency.value = f;
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, a.currentTime + d);
  g.gain.setValueAtTime(vol || 0.12, a.currentTime); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + d);
  o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + d);
}
function sfx(name) {
  if (name === 'click') tone(660, 0.07, 'triangle', 0.10);
  else if (name === 'add') { tone(520, 0.08, 'triangle', 0.12); setTimeout(() => tone(780, 0.09, 'triangle', 0.12), 60); }
  else if (name === 'grill') { tone(220, 0.15, 'sawtooth', 0.06, 110); }
  else if (name === 'ding') { tone(880, 0.12, 'sine', 0.16); setTimeout(() => tone(1174, 0.22, 'sine', 0.16), 110); }
  else if (name === 'coin') { tone(988, 0.09, 'square', 0.07); setTimeout(() => tone(1319, 0.16, 'square', 0.07), 80); }
  else if (name === 'buzz') tone(140, 0.28, 'sawtooth', 0.12, 90);
  else if (name === 'pop') tone(340, 0.1, 'sine', 0.12, 620);
  else if (name === 'level') { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.14, 'triangle', 0.13), i * 90)); }
}

/* ---------- data: original recipes, ingredients, customers ---------- */
const ING = {
  bun:    { name: 'Bun',     key: '1', color: '#e8a94e' },
  patty:  { name: 'Patty',   key: '2', color: '#7a4a21' },
  lettuce:{ name: 'Lettuce', key: '3', color: '#5da83c' },
  tomato: { name: 'Tomato',  key: '4', color: '#d9382b' },
  cheese: { name: 'Cheese',  key: '5', color: '#f7c531' },
  onion:  { name: 'Onion',   key: '6', color: '#b678c4' },
  sauce:  { name: 'Sauce',   key: '7', color: '#e2701d' },
  fries:  { name: 'Fries',   key: '8', color: '#f2c14e' },
};
const BIN_ORDER = ['bun', 'patty', 'lettuce', 'tomato', 'cheese', 'onion', 'sauce', 'fries'];
const RECIPES = [
  { name: 'Sunny Burger',  items: ['bun', 'patty', 'lettuce', 'tomato'], base: 100 },
  { name: 'Cheesy Melt',   items: ['bun', 'patty', 'cheese', 'sauce'],   base: 110 },
  { name: 'Garden Stack',  items: ['bun', 'lettuce', 'tomato', 'onion', 'sauce'], base: 120 },
  { name: 'Smoky BBQ',     items: ['bun', 'patty', 'onion', 'sauce'],    base: 110 },
  { name: 'Veggie Delight',items: ['bun', 'lettuce', 'tomato', 'cheese', 'onion'], base: 120 },
  { name: 'Crispy Combo',  items: ['bun', 'patty', 'cheese', 'fries'],   base: 130 },
];
const CUSTOMERS = [
  { name: 'Mara', skin: '#f2c79b', hair: '#5b3a1e' }, { name: 'Theo', skin: '#e8b88a', hair: '#222222' },
  { name: 'June', skin: '#8d5a3b', hair: '#111111' }, { name: 'Pip', skin: '#f7d7b0', hair: '#c96a1e' },
  { name: 'Rosa', skin: '#d99e73', hair: '#7a2e2e' }, { name: 'Ken', skin: '#eec39a', hair: '#3d3d3d' },
  { name: 'Ana', skin: '#f0c08f', hair: '#2e4a2e' }, { name: 'Leo', skin: '#d9a06a', hair: '#8a6d1f' },
];
const SHIFT_LEN = 150, GOAL = 700, MAX_HEARTS = 3;

/* ---------- state ---------- */
let S;
function newOrder() {
  const r = pick(RECIPES);
  return { recipe: r, customer: pick(CUSTOMERS), patience: 26 + rng() * 10, max: 36, born: S ? S.time : 0 };
}
function freshState() {
  return {
    time: 0, timeLeft: SHIFT_LEN, score: 0, coins: 0, combo: 0, bestCombo: 0,
    served: 0, level: 1, hearts: MAX_HEARTS, plate: [], selected: 0,
    orders: [newOrder(), newOrder(), newOrder()],
    grill: [null, null], fryer: null, phase: 'play', // play | win | lose
    toast: 'Welcome to Ember & Thyme! Click ingredients to build the dish.',
    toastT: 0, shake: 0, serveFlash: 0, floaters: [], paused: false,
    winReason: '', spawnT: 0,
  };
}
S = freshState();

/* ---------- demo presets: real game state, staged for screenshots ---------- */
function stageDemo(name) {
  if (name === 'assembly' || name === 'play') {
    S.score = 240; S.coins = 24; S.combo = 2; S.served = 2; S.timeLeft = 118;
    S.orders = [mkOrder('Sunny Burger', 22), mkOrder('Cheesy Melt', 17), mkOrder('Garden Stack', 11)];
    S.selected = 0; S.plate = ['bun', 'patty', 'lettuce'];
    S.grill = [{ kind: 'patty', t: 2.1, need: 3.5 }, null]; S.fryer = { kind: 'fries', t: 1.6, need: 4 };
    S.toast = 'Patty on the grill — add lettuce, tomato, then ring the bell!';
  } else if (name === 'ready') {
    S.score = 410; S.coins = 41; S.combo = 3; S.served = 4; S.timeLeft = 96;
    S.orders = [mkOrder('Sunny Burger', 19), mkOrder('Smoky BBQ', 24), mkOrder('Crispy Combo', 14)];
    S.selected = 0; S.plate = ['bun', 'patty', 'lettuce', 'tomato'];
    S.grill = [null, null]; S.fryer = null; S.serveFlash = 1;
    S.toast = 'Sunny Burger complete — ring the bell to serve!';
  } else if (name === 'rush') {
    S.score = 680; S.coins = 68; S.combo = 5; S.bestCombo = 5; S.served = 7; S.level = 3; S.timeLeft = 54;
    S.orders = [mkOrder('Crispy Combo', 9), mkOrder('Cheesy Melt', 14), mkOrder('Veggie Delight', 20)];
    S.selected = 0; S.plate = ['bun', 'patty', 'cheese'];
    S.grill = [{ kind: 'patty', t: 3.4, need: 3.5 }, { kind: 'patty', t: 1.0, need: 3.5 }];
    S.fryer = { kind: 'fries', t: 3.2, need: 4 };
    S.toast = 'Rush hour! Combo x5 — keep the grill full!';
  } else if (name === 'win') {
    S.score = 840; S.coins = 84; S.combo = 4; S.bestCombo = 4; S.served = 8; S.level = 3; S.timeLeft = 41;
    S.phase = 'win'; S.winReason = 'Day goal smashed — 840 pts with time to spare!';
    S.toast = 'Day goal smashed — the lunch crowd leaves happy!';
    S.orders = [mkOrder('Sunny Burger', 20), mkOrder('Cheesy Melt', 16), mkOrder('Garden Stack', 12)];
    S.plate = ['bun', 'patty', 'lettuce', 'tomato'];
  } else if (name === 'end' || name === 'lose') {
    S.score = 320; S.coins = 32; S.combo = 0; S.served = 3; S.timeLeft = 63; S.hearts = 0;
    S.phase = 'lose'; S.winReason = 'Three customers walked out hungry.';
    S.orders = [mkOrder('Sunny Burger', 8), mkOrder('Smoky BBQ', 12), mkOrder('Garden Stack', 6)];
    S.plate = ['bun', 'lettuce'];
  }
}
function mkOrder(recipeName, patience) {
  const r = RECIPES.find(x => x.name === recipeName);
  return { recipe: r, customer: pick(CUSTOMERS), patience: patience, max: 36, born: 0 };
}

/* ---------- rules ---------- */
function plateKey(plate) { return plate.slice().sort().join('+'); }
function orderMatches(order, plate) { return plateKey(order.recipe.items) === plateKey(plate); }
function matchingOrder() { for (let i = 0; i < S.orders.length; i++) if (S.orders[i] && orderMatches(S.orders[i], S.plate)) return i; return -1; }
function addFloater(x, y, s, color) { S.floaters.push({ x: x, y: y, s: s, color: color, t: 0 }); }
function say(msg) { S.toast = msg; S.toastT = 0; $status.textContent = msg; }

function addIngredient(kind) {
  if (S.phase !== 'play' || S.paused) return;
  if (kind === 'patty') {
    const slot = S.grill[0] === null ? 0 : S.grill[1] === null ? 1 : -1;
    if (slot < 0) { say('Grill is full — wait for a patty to finish!'); sfx('buzz'); return; }
    S.grill[slot] = { kind: 'patty', t: 0, need: 3.5 }; sfx('grill'); say('Patty on the grill… sizzle!');
    return;
  }
  if (kind === 'fries') {
    if (S.fryer) { say('Fryer is busy — one basket at a time!'); sfx('buzz'); return; }
    S.fryer = { kind: 'fries', t: 0, need: 4 }; sfx('grill'); say('Fries in the fryer…');
    return;
  }
  if (S.plate.length >= 6) { say('Plate is full — serve it or bin it!'); sfx('buzz'); return; }
  S.plate.push(kind); sfx('add');
  const m = matchingOrder();
  if (m >= 0) say(S.orders[m].recipe.name + ' complete — ring the bell!');
  else say(ING[kind].name + ' added. ' + (S.plate.length === 1 ? 'Keep building the ticket!' : ''));
}
function takeFromGrill(i) {
  const g = S.grill[i]; if (!g) return;
  if (g.t < g.need) { say('Still cooking — wait for the sizzle to finish!'); sfx('click'); return; }
  if (S.plate.length >= 6) { say('Plate is full!'); sfx('buzz'); return; }
  S.grill[i] = null; S.plate.push('patty'); sfx('add'); say('Hot patty on the plate!');
}
function takeFromFryer() {
  const f = S.fryer; if (!f) return;
  if (f.t < f.need) { say('Fries still frying…'); sfx('click'); return; }
  if (S.plate.length >= 6) { say('Plate is full!'); sfx('buzz'); return; }
  S.fryer = null; S.plate.push('fries'); sfx('add'); say('Golden fries on the plate!');
}
function serve() {
  if (S.phase !== 'play' || S.paused) return;
  const m = matchingOrder();
  if (m < 0) {
    if (S.plate.length === 0) { say('Plate is empty — build a dish first!'); sfx('click'); return; }
    S.combo = 0; S.shake = 0.4; sfx('buzz');
    say('That does not match any ticket — check the order board!');
    return;
  }
  const o = S.orders[m];
  const timeBonus = Math.round(o.patience) * 5;
  const pts = o.recipe.base + timeBonus + S.combo * 15;
  S.score += pts; S.coins += Math.round(pts / 10); S.combo += 1; S.bestCombo = Math.max(S.bestCombo, S.combo);
  S.served += 1; S.serveFlash = 1; sfx('ding'); setTimeout(() => sfx('coin'), 140);
  addFloater(640, 300, '+' + pts + ' pts', '#ffd94d');
  if (S.combo >= 3) addFloater(640, 340, 'COMBO x' + S.combo + '!', '#ff9d5c');
  S.orders[m] = null; S.spawnT = 1.1; S.plate = [];
  say(o.customer.name + ' loved the ' + o.recipe.name + '! +' + pts + ' pts');
  if (S.served % 4 === 0) { S.level += 1; sfx('level'); say('LEVEL ' + S.level + '! Orders get impatient — keep up!'); }
  if (S.score >= GOAL) endGame(true, 'Day goal reached — ' + S.score + ' pts!');
}
function trashPlate() {
  if (S.plate.length === 0) return;
  S.plate = []; S.combo = 0; sfx('pop'); say('Plate binned. Fresh start!');
}
function endGame(win, reason) {
  if (S.phase !== 'play') return;
  S.phase = win ? 'win' : 'lose'; S.winReason = reason;
  if (win) sfx('level'); else sfx('buzz');
  say(win ? 'Shift complete — you win!' : 'Shift over — ' + reason);
}
function update(dt) {
  if (S.paused || S.phase !== 'play') { S.toastT += dt; return; }
  S.time += dt; S.timeLeft -= dt; S.toastT += dt;
  if (S.shake > 0) S.shake -= dt;
  if (S.serveFlash > 0) S.serveFlash -= dt * 1.5;
  for (const f of S.floaters) f.t += dt;
  S.floaters = S.floaters.filter(f => f.t < 1.4);
  for (let i = 0; i < S.grill.length; i++) if (S.grill[i]) S.grill[i].t += dt;
  if (S.fryer) S.fryer.t += dt;
  const drain = 1 + 0.08 * (S.level - 1);
  for (let i = 0; i < S.orders.length; i++) {
    const o = S.orders[i]; if (!o) continue;
    o.patience -= dt * drain;
    if (o.patience <= 0) {
      S.orders[i] = null; S.spawnT = 1.1; S.hearts -= 1; S.combo = 0; sfx('buzz');
      say(o.customer.name + ' walked out! A heart is lost.');
      if (S.hearts <= 0) { endGame(false, 'Three customers walked out hungry.'); return; }
    }
  }
  if (S.spawnT > 0) {
    S.spawnT -= dt;
    if (S.spawnT <= 0) for (let i = 0; i < S.orders.length; i++) if (!S.orders[i]) S.orders[i] = newOrder();
  }
  if (S.timeLeft <= 0) {
    S.timeLeft = 0;
    endGame(S.score >= GOAL, S.score >= GOAL ? 'Day goal reached — ' + S.score + ' pts!' : 'Time! ' + S.score + ' pts — short of the ' + GOAL + ' goal.');
  }
}

/* ---------- input: click zones ---------- */
const Z = {
  bins: [], grillSlots: [], fryer: null, serve: null, trash: null,
  tickets: [], pauseBtn: null, muteBtn: null, restartBtn: null,
};
function inBox(mx, my, b) { return b && mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h; }
function handleClick(mx, my) {
  ac();
  if (S.phase !== 'play') {
    if (inBox(mx, my, Z.restartBtn)) { S = freshState(); say('Fresh shift! First ticket is up.'); }
    return;
  }
  for (let i = 0; i < Z.tickets.length; i++) if (inBox(mx, my, Z.tickets[i])) { S.selected = i; sfx('click'); say('Ticket ' + (i + 1) + ': ' + (S.orders[i] ? S.orders[i].recipe.name : '…')); return; }
  for (let i = 0; i < Z.bins.length; i++) if (inBox(mx, my, Z.bins[i])) { addIngredient(Z.bins[i].kind); return; }
  for (let i = 0; i < Z.grillSlots.length; i++) if (inBox(mx, my, Z.grillSlots[i])) { takeFromGrill(i); return; }
  if (inBox(mx, my, Z.fryer)) { takeFromFryer(); return; }
  if (inBox(mx, my, Z.serve)) { serve(); return; }
  if (inBox(mx, my, Z.trash)) { trashPlate(); return; }
  if (inBox(mx, my, Z.pauseBtn)) { S.paused = !S.paused; sfx('click'); say(S.paused ? 'Paused — press P to resume.' : 'Back to the rush!'); return; }
  if (inBox(mx, my, Z.muteBtn)) { muted = !muted; sfx('click'); say(muted ? 'Sound off.' : 'Sound on.'); return; }
}
cv.addEventListener('click', (e) => {
  const r = cv.getBoundingClientRect();
  handleClick((e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height);
});
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k >= '1' && k <= '8') { ac(); addIngredient(BIN_ORDER[parseInt(k, 10) - 1]); }
  else if (k === ' ') { e.preventDefault(); ac(); serve(); }
  else if (k === 't') trashPlate();
  else if (k === 'p') { S.paused = !S.paused; say(S.paused ? 'Paused.' : 'Back to the rush!'); }
  else if (k === 'm') { muted = !muted; }
  else if (k === 'r' && S.phase !== 'play') { S = freshState(); }
  else if (k === 'g') takeFromGrill(S.grill[0] && S.grill[0].t >= S.grill[0].need ? 0 : 1);
  else if (k === 'f') takeFromFryer();
});

/* ---------- ingredient art (all drawn in code) ---------- */
function drawIngredient(kind, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 40, s / 40);
  if (kind === 'bun') {
    ctx.fillStyle = '#d98f2b'; rr(-26, 2, 52, 12, 6); ctx.fill();
    ctx.fillStyle = '#f0b45c'; ctx.beginPath(); ctx.arc(0, 2, 26, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff2cf'; [[-14, -12], [0, -20], [14, -12]].forEach(p => { ctx.beginPath(); ctx.ellipse(p[0], p[1], 3, 2, 0, 0, 7); ctx.fill(); });
  } else if (kind === 'patty') {
    ctx.fillStyle = '#5d3413'; rr(-28, -10, 56, 20, 10); ctx.fill();
    ctx.fillStyle = '#7a4a21'; rr(-24, -7, 48, 13, 7); ctx.fill();
    ctx.strokeStyle = '#3d220c'; ctx.lineWidth = 2; [-14, 0, 14].forEach(dx => { ctx.beginPath(); ctx.moveTo(dx, -8); ctx.lineTo(dx, 8); ctx.stroke(); });
  } else if (kind === 'lettuce') {
    ctx.fillStyle = '#4c9a2e';
    [[-18, 0], [0, -6], [18, 0], [-9, 6], [9, 6]].forEach(p => { ctx.beginPath(); ctx.arc(p[0], p[1], 13, 0, 7); ctx.fill(); });
    ctx.fillStyle = '#7cc94f'; [[-10, -2], [8, -4], [0, 6]].forEach(p => { ctx.beginPath(); ctx.arc(p[0], p[1], 8, 0, 7); ctx.fill(); });
  } else if (kind === 'tomato') {
    ctx.fillStyle = '#d9382b'; ctx.beginPath(); ctx.arc(0, 0, 22, 0, 7); ctx.fill();
    ctx.fillStyle = '#ef6a55'; ctx.beginPath(); ctx.arc(-6, -6, 12, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-9, -9, 4, 0, 7); ctx.fill();
    ctx.fillStyle = '#3f7a2a'; ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(8, -14); ctx.lineTo(-8, -14); ctx.closePath(); ctx.fill();
  } else if (kind === 'cheese') {
    ctx.fillStyle = '#f7c531'; ctx.beginPath(); ctx.moveTo(-26, -14); ctx.lineTo(26, -14); ctx.lineTo(0, 18); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e8a90c'; [[-12, -4], [10, -6], [0, 6]].forEach(p => { ctx.beginPath(); ctx.arc(p[0], p[1], 3.5, 0, 7); ctx.fill(); });
    ctx.fillStyle = '#f7c531'; ctx.beginPath(); ctx.moveTo(-18, 14); ctx.quadraticCurveTo(-14, 24, -10, 14); ctx.moveTo(6, 14); ctx.quadraticCurveTo(10, 24, 14, 14); ctx.fill();
  } else if (kind === 'onion') {
    ctx.strokeStyle = '#c99ad4'; ctx.lineWidth = 5;
    [20, 13, 6].forEach(r => { ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke(); });
    ctx.strokeStyle = '#efe0f2'; ctx.lineWidth = 2;
    [16, 9].forEach(r => { ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke(); });
  } else if (kind === 'sauce') {
    ctx.fillStyle = '#e2701d'; ctx.beginPath();
    ctx.moveTo(-26, -6); ctx.bezierCurveTo(-14, -18, -4, 6, 6, -6); ctx.bezierCurveTo(14, -14, 22, 2, 26, -4);
    ctx.lineTo(26, 6); ctx.bezierCurveTo(14, 12, 4, -2, -6, 6); ctx.bezierCurveTo(-16, 12, -22, 2, -26, 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f7a54d'; ctx.beginPath(); ctx.arc(-8, -4, 4, 0, 7); ctx.arc(12, 0, 3, 0, 7); ctx.fill();
  } else if (kind === 'fries') {
    ctx.fillStyle = '#f2c14e';
    [[-16, -26], [-6, -30], [4, -28], [14, -24]].forEach(p => { ctx.fillRect(p[0], p[1], 8, 26); });
    ctx.fillStyle = '#d9382b'; ctx.beginPath(); ctx.moveTo(-22, -8); ctx.lineTo(22, -8); ctx.lineTo(16, 22); ctx.lineTo(-16, 22); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 6, 8, 0, 7); ctx.fill();
    ctx.fillStyle = '#d9382b'; text('E&T', 0, 9, 9, '#d9382b', 'center', '800');
  }
  ctx.restore();
}
function drawHeart(x, y, s, filled) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = filled ? '#e63946' : 'rgba(255,255,255,0.25)';
  ctx.beginPath(); ctx.moveTo(0, 6); ctx.bezierCurveTo(-9, -3, -5, -10, 0, -5); ctx.bezierCurveTo(5, -10, 9, -3, 0, 6); ctx.fill();
  ctx.restore();
}
function drawFace(c, x, y, r, mood) {
  ctx.fillStyle = c.skin; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.fillStyle = c.hair; ctx.beginPath(); ctx.arc(x, y - r * 0.35, r * 0.95, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.05, r * 0.09, 0, 7); ctx.arc(x + r * 0.35, y - r * 0.05, r * 0.09, 0, 7); ctx.fill();
  ctx.strokeStyle = '#7a3b1e'; ctx.lineWidth = 2; ctx.beginPath();
  if (mood === 'happy') ctx.arc(x, y + r * 0.15, r * 0.45, 0.15 * Math.PI, 0.85 * Math.PI);
  else if (mood === 'worried') ctx.arc(x, y + r * 0.75, r * 0.4, 1.15 * Math.PI, 1.85 * Math.PI);
  else { ctx.moveTo(x - r * 0.3, y + r * 0.4); ctx.lineTo(x + r * 0.3, y + r * 0.4); }
  ctx.stroke();
  if (mood === 'worried') { ctx.fillStyle = '#7fc4e8'; ctx.beginPath(); ctx.arc(x + r * 0.85, y - r * 0.5, r * 0.14, 0, 7); ctx.fill(); }
}

/* ---------- render ---------- */
function drawBackground() {
  ctx.fillStyle = '#f7d9a8'; ctx.fillRect(0, 56, W, 414);
  ctx.fillStyle = '#f2c98f'; for (let x = 0; x < W; x += 64) for (let y = 56; y < 200; y += 64) { ctx.strokeStyle = 'rgba(180,120,60,0.25)'; ctx.strokeRect(x + 0.5, y + 0.5, 64, 64); }
  // window with sun + hills
  ctx.fillStyle = '#8ecae6'; rr(1080, 66, 170, 96, 10); ctx.fill();
  ctx.fillStyle = '#ffd94d'; ctx.beginPath(); ctx.arc(1130, 96, 16, 0, 7); ctx.fill();
  ctx.fillStyle = '#7cc94f'; ctx.beginPath(); ctx.ellipse(1165, 162, 90, 26, 0, Math.PI, 0); ctx.fill();
  ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 5; ctx.strokeRect(1080, 66, 170, 96);
  ctx.beginPath(); ctx.moveTo(1165, 66); ctx.lineTo(1165, 162); ctx.moveTo(1080, 114); ctx.lineTo(1250, 114); ctx.stroke();
  // shelves with jars
  ctx.fillStyle = '#8a5a2b'; ctx.fillRect(880, 128, 170, 8);
  ['#e2701d', '#5da83c', '#d9382b'].forEach((c, i) => {
    ctx.fillStyle = c; rr(892 + i * 52, 96, 36, 32, 6); ctx.fill();
    ctx.fillStyle = '#fff3d6'; ctx.fillRect(900 + i * 52, 106, 20, 12);
  });
  // floor
  ctx.fillStyle = '#a4713d'; ctx.fillRect(0, 470, W, 250);
  ctx.fillStyle = '#96622f'; for (let x = 0; x < W; x += 120) ctx.fillRect(x, 470, 4, 250);
  // hanging lamp
  ctx.strokeStyle = '#3a2417'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(640, 56); ctx.lineTo(640, 84); ctx.stroke();
  ctx.fillStyle = '#ffb703'; ctx.beginPath(); ctx.moveTo(612, 84); ctx.lineTo(668, 84); ctx.lineTo(654, 106); ctx.lineTo(626, 106); ctx.closePath(); ctx.fill();
}
function drawTopBar() {
  ctx.fillStyle = '#3a2417'; ctx.fillRect(0, 0, W, 56);
  ctx.fillStyle = '#ffb703'; ctx.beginPath(); ctx.moveTo(34, 14); ctx.quadraticCurveTo(46, 30, 34, 44); ctx.quadraticCurveTo(24, 32, 30, 20); ctx.quadraticCurveTo(28, 28, 34, 14); ctx.fill();
  shadowText('EMBER & THYME', 52, 26, 22, '#ffd94d', 'left', '800');
  text('LUNCH RUSH', 52, 46, 12, '#ffb703', 'left', '700');
  text('SCORE  ' + S.score, 300, 34, 20, '#fff', 'left', '800');
  text('COINS  ' + S.coins, 450, 34, 20, '#ffd94d', 'left', '800');
  if (S.combo >= 2) { ctx.fillStyle = '#ff6b35'; rr(560, 12, 110, 32, 16); ctx.fill(); text('COMBO x' + S.combo, 615, 34, 17, '#fff', 'center', '800'); }
  text('LVL ' + S.level, 700, 34, 18, '#fff', 'left', '800');
  // goal progress
  ctx.fillStyle = 'rgba(255,255,255,0.2)'; rr(760, 18, 120, 14, 7); ctx.fill();
  ctx.fillStyle = '#7cc94f'; rr(760, 18, 120 * clamp(S.score / GOAL, 0, 1), 14, 7); ctx.fill();
  text('GOAL ' + GOAL, 820, 46, 11, '#cfe8b0', 'center', '700');
  // shift timer
  const mm = Math.floor(S.timeLeft / 60), ss = Math.floor(S.timeLeft % 60);
  const tcol = S.timeLeft < 30 ? '#ff6b6b' : '#fff';
  ctx.fillStyle = S.timeLeft < 30 && Math.floor(S.time * 2) % 2 ? 'rgba(255,80,80,0.35)' : 'rgba(255,255,255,0.12)';
  rr(920, 8, 150, 40, 10); ctx.fill();
  text('SHIFT ' + mm + ':' + String(ss).padStart(2, '0'), 995, 35, 21, tcol, 'center', '800');
  for (let i = 0; i < MAX_HEARTS; i++) drawHeart(1105 + i * 26, 28, 1.4, i < S.hearts);
  Z.pauseBtn = { x: 1196, y: 10, w: 34, h: 36 };
  Z.muteBtn = { x: 1236, y: 10, w: 34, h: 36 };
  ctx.fillStyle = 'rgba(255,255,255,0.15)'; rr(1196, 10, 34, 36, 8); ctx.fill(); rr(1236, 10, 34, 36, 8); ctx.fill();
  text(S.paused ? '▶' : 'II', 1213, 35, 16, '#fff', 'center', '800');
  text(muted ? '✕' : '♪', 1253, 35, 16, '#fff', 'center', '800');
}
function drawOrderBoard() {
  ctx.fillStyle = '#6b4423'; rr(16, 64, 824, 132, 10); ctx.fill();
  ctx.fillStyle = '#2e4a3a'; rr(24, 72, 808, 116, 6); ctx.fill();
  text('ORDER BOARD', 40, 96, 15, '#cfe8b0', 'left', '800');
  text('click a ticket to pick it', 178, 96, 11, '#9db8a4', 'left', '400');
  Z.tickets = [];
  for (let i = 0; i < 3; i++) {
    const x = 28 + i * 268, y = 102, w = 258, h = 78;
    Z.tickets.push({ x: x, y: y, w: w, h: h });
    const o = S.orders[i];
    ctx.fillStyle = S.selected === i ? '#fff8e1' : '#f3e5c3';
    rr(x, y, w, h, 8); ctx.fill();
    if (S.selected === i) { ctx.strokeStyle = '#ffb703'; ctx.lineWidth = 3; rr(x, y, w, h, 8); ctx.stroke(); }
    if (!o) { text('next customer…', x + w / 2, y + 44, 15, '#8a7a5a', 'center', '600'); continue; }
    const frac = clamp(o.patience / o.max, 0, 1);
    drawFace(o.customer, x + 30, y + 26, 20, frac > 0.5 ? 'happy' : frac > 0.25 ? 'flat' : 'worried');
    text(o.customer.name, x + 30, y + 62, 11, '#5b3a1e', 'center', '700');
    text(o.recipe.name, x + 58, y + 26, 16, '#3a2417', 'left', '800');
    o.recipe.items.forEach((k, j) => drawIngredient(k, x + 74 + j * 34, y + 48, 13));
    ctx.fillStyle = '#e8dcc0'; rr(x + 58, y + 64, 186, 9, 4); ctx.fill();
    ctx.fillStyle = frac > 0.5 ? '#5da83c' : frac > 0.25 ? '#e8a90c' : '#d9382b';
    rr(x + 58, y + 64, 186 * frac, 9, 4); ctx.fill();
    text(Math.ceil(o.patience) + 's', x + 248, y + 26, 13, frac > 0.25 ? '#5b3a1e' : '#d9382b', 'right', '800');
  }
  // menu card
  ctx.fillStyle = '#fff8e1'; rr(856, 64, 408, 132, 10); ctx.fill();
  ctx.strokeStyle = '#d9b380'; ctx.lineWidth = 2; rr(856, 64, 408, 132, 10); ctx.stroke();
  text("TODAY'S MENU", 872, 88, 14, '#8a5a2b', 'left', '800');
  RECIPES.forEach((r, i) => {
    const cx = 872 + (i % 2) * 200, cy = 108 + Math.floor(i / 2) * 28;
    text(r.name, cx, cy, 12, '#3a2417', 'left', '700');
    r.items.forEach((k, j) => drawIngredient(k, cx + 108 + j * 15, cy - 4, 7));
  });
  text('Grill patties · fry chips · stack · ring the bell!', 872, 188, 11, '#8a7a5a', 'left', '400');
}

function drawStations() {
  // --- grill (left) ---
  ctx.fillStyle = '#4a4a52'; rr(16, 204, 300, 200, 10); ctx.fill();
  ctx.fillStyle = '#33333a'; rr(24, 212, 284, 34, 6); ctx.fill();
  text('GRILL', 40, 235, 16, '#ffb703', 'left', '800');
  text('patty: 3.5s', 300, 235, 12, '#bbb', 'right', '400');
  Z.grillSlots = [];
  for (let i = 0; i < 2; i++) {
    const x = 36 + i * 138, y = 256, w = 122, h = 118;
    Z.grillSlots.push({ x: x, y: y, w: w, h: h });
    ctx.fillStyle = '#22222a'; rr(x, y, w, h, 8); ctx.fill();
    ctx.strokeStyle = '#666'; ctx.lineWidth = 2;
    for (let g = 0; g < 4; g++) { ctx.beginPath(); ctx.moveTo(x + 10, y + 22 + g * 26); ctx.lineTo(x + w - 10, y + 22 + g * 26); ctx.stroke(); }
    const slot = S.grill[i];
    if (slot) {
      const done = slot.t >= slot.need;
      if (!done && Math.floor(S.time * 6) % 2 === 0) { ctx.fillStyle = 'rgba(255,140,0,0.5)'; ctx.beginPath(); ctx.arc(x + w / 2, y + 30, 10, 0, 7); ctx.fill(); }
      drawIngredient('patty', x + w / 2, y + 58, 34);
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; rr(x + 12, y + h - 22, w - 24, 10, 5); ctx.fill();
      ctx.fillStyle = done ? '#7cc94f' : '#ffb703'; rr(x + 12, y + h - 22, (w - 24) * clamp(slot.t / slot.need, 0, 1), 10, 5); ctx.fill();
      text(done ? 'READY — click!' : 'cooking…', x + w / 2, y + h - 30, 12, done ? '#7cc94f' : '#ffb703', 'center', '800');
    } else text('empty', x + w / 2, y + 62, 13, '#777', 'center', '600');
  }
  text('click a patty bin, then click the grill when ready', 166, 394, 11, '#ccc', 'center', '400');
  // --- assembly plate (centre) ---
  ctx.fillStyle = '#7a4a21'; rr(332, 204, 616, 200, 10); ctx.fill();
  ctx.fillStyle = '#8a5a2b'; ctx.fillRect(332, 204, 616, 10);
  const sel = S.orders[S.selected];
  text(sel ? 'ASSEMBLING: ' + sel.recipe.name.toUpperCase() : 'ASSEMBLING', 640, 232, 17, '#ffe9b0', 'center', '800');
  const px = 640, py = 330;
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(px, py + 52, 150, 16, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#f5f0e6'; ctx.beginPath(); ctx.ellipse(px, py + 44, 140, 34, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(px, py + 40, 122, 26, 0, 0, 7); ctx.fill();
  // stacked dish, bottom-up
  const hasBun = S.plate.includes('bun');
  let ly = py + 36;
  const stack = S.plate.filter(k => k !== 'bun');
  if (hasBun) { ctx.fillStyle = '#d98f2b'; rr(px - 62, ly - 12, 124, 13, 6); ctx.fill(); ly -= 13; }
  for (const k of stack) { drawLayer(k, px, ly); ly -= 13; }
  if (hasBun) { // top bun dome
    ctx.fillStyle = '#f0b45c'; ctx.beginPath(); ctx.arc(px, ly + 2, 62, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff2cf'; [[-30, -18], [0, -28], [30, -18]].forEach(p => { ctx.beginPath(); ctx.ellipse(px + p[0], ly + 2 + p[1], 5, 3, 0, 0, 7); ctx.fill(); });
  }
  if (S.plate.length === 0) text('empty plate — click ingredients below', px, py + 10, 14, '#b9a98c', 'center', '600');
  // recipe checklist under plate
  if (sel) {
    const items = sel.recipe.items;
    const tw = items.length * 34;
    items.forEach((k, j) => {
      const ix = px - tw / 2 + j * 34 + 17;
      ctx.fillStyle = S.plate.includes(k) ? 'rgba(124,201,79,0.35)' : 'rgba(255,255,255,0.15)';
      ctx.beginPath(); ctx.arc(ix, 388, 15, 0, 7); ctx.fill();
      drawIngredient(k, ix, 388, 12);
      if (S.plate.includes(k)) { ctx.strokeStyle = '#7cc94f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ix, 388, 15, 0, 7); ctx.stroke(); }
    });
  }
  // --- fryer (right) ---
  ctx.fillStyle = '#4a4a52'; rr(964, 204, 300, 200, 10); ctx.fill();
  ctx.fillStyle = '#33333a'; rr(972, 212, 284, 34, 6); ctx.fill();
  text('FRYER', 988, 235, 16, '#ffb703', 'left', '800');
  text('fries: 4s', 1248, 235, 12, '#bbb', 'right', '400');
  Z.fryer = { x: 1000, y: 256, w: 228, h: 118 };
  ctx.fillStyle = '#c9a227'; rr(1000, 256, 228, 118, 8); ctx.fill();
  ctx.fillStyle = '#8a6d1f'; rr(1012, 268, 204, 94, 6); ctx.fill();
  if (S.fryer) {
    const done = S.fryer.t >= S.fryer.need;
    for (let i = 0; i < 5; i++) { ctx.fillStyle = '#f2c14e'; ctx.fillRect(1030 + i * 34, done ? 276 : 292, 12, 44); }
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; rr(1012, 352, 204, 10, 5); ctx.fill();
    ctx.fillStyle = done ? '#7cc94f' : '#ffb703'; rr(1012, 352, 204 * clamp(S.fryer.t / S.fryer.need, 0, 1), 10, 5); ctx.fill();
    text(done ? 'READY — click!' : 'frying…', 1114, 388, 13, done ? '#7cc94f' : '#ffb703', 'center', '800');
  } else { text('oil ready — click the fries bin', 1114, 320, 13, '#e8dcc0', 'center', '600'); text('one basket at a time', 1114, 388, 11, '#ccc', 'center', '400'); }
}
function drawLayer(kind, x, yBottom) {
  // a flat layer of the stack, drawn sitting on yBottom
  ctx.save(); ctx.translate(x, yBottom);
  if (kind === 'patty') { ctx.fillStyle = '#5d3413'; rr(-62, -13, 124, 13, 6); ctx.fill(); }
  else if (kind === 'lettuce') { ctx.fillStyle = '#5da83c'; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(i * 24, -6, 15, 0, 7); ctx.fill(); } }
  else if (kind === 'tomato') { ctx.fillStyle = '#d9382b'; rr(-56, -12, 112, 12, 6); ctx.fill(); ctx.fillStyle = '#ef6a55'; rr(-48, -10, 96, 6, 3); ctx.fill(); }
  else if (kind === 'cheese') { ctx.fillStyle = '#f7c531'; ctx.beginPath(); ctx.moveTo(-60, 0); ctx.lineTo(60, 0); ctx.lineTo(0, -14); ctx.closePath(); ctx.fill(); }
  else if (kind === 'onion') { ctx.strokeStyle = '#c99ad4'; ctx.lineWidth = 4; [-40, 0, 40].forEach(dx => { ctx.beginPath(); ctx.arc(dx, -6, 9, 0, 7); ctx.stroke(); }); }
  else if (kind === 'sauce') { ctx.fillStyle = '#e2701d'; ctx.beginPath(); ctx.moveTo(-58, -4); ctx.bezierCurveTo(-30, -14, 0, 2, 30, -8); ctx.bezierCurveTo(45, -12, 55, -2, 58, -4); ctx.lineTo(58, 0); ctx.lineTo(-58, 0); ctx.closePath(); ctx.fill(); }
  else if (kind === 'fries') { ctx.fillStyle = '#f2c14e'; for (let i = -2; i <= 2; i++) ctx.fillRect(i * 20 - 4, -26, 8, 26); }
  ctx.restore();
}
function drawServeRow() {
  ctx.fillStyle = '#5b3a1e'; ctx.fillRect(0, 412, W, 58);
  const m = matchingOrder();
  const ready = m >= 0;
  text(S.toast, 24, 448, 16, ready ? '#7cc94f' : '#ffe9b0', 'left', '700');
  if (ready) text('✓ ' + S.orders[m].recipe.name + ' matches ticket ' + (m + 1) + '!', 24, 466, 12, '#7cc94f', 'left', '700');
  // serve bell
  Z.serve = { x: 1000, y: 420, w: 248, h: 42 };
  const pulse = ready ? 0.6 + 0.4 * Math.sin(S.time * 6) : 0;
  ctx.fillStyle = ready ? '#ffd94d' : '#8a6d1f'; rr(1000, 420, 248, 42, 21); ctx.fill();
  if (ready) { ctx.strokeStyle = 'rgba(255,217,77,' + pulse + ')'; ctx.lineWidth = 4; rr(996, 416, 256, 50, 25); ctx.stroke(); }
  ctx.fillStyle = '#3a2417'; ctx.beginPath(); ctx.arc(1018, 441, 9, Math.PI, 0); ctx.fill(); ctx.fillRect(1009, 441, 18, 4);
  text(ready ? 'RING THE BELL — SERVE!' : 'SERVE  (Space)', 1142, 447, 17, '#3a2417', 'center', '800');
  // trash
  Z.trash = { x: 880, y: 420, w: 104, h: 42 };
  ctx.fillStyle = '#6b3a2a'; rr(880, 420, 104, 42, 10); ctx.fill();
  text('BIN IT (T)', 932, 447, 14, '#ffd9c9', 'center', '700');
}
function drawBins() {
  ctx.fillStyle = '#7a4a21'; ctx.fillRect(0, 470, W, 178);
  ctx.fillStyle = '#8a5a2b'; ctx.fillRect(0, 470, W, 8);
  text('INGREDIENTS — click a bin or press its key', 24, 496, 14, '#ffe9b0', 'left', '800');
  Z.bins = [];
  BIN_ORDER.forEach((kind, i) => {
    const x = 16 + i * 156, y = 504, w = 148, h = 136;
    Z.bins.push({ x: x, y: y, w: w, h: h, kind: kind });
    ctx.fillStyle = '#a4713d'; rr(x, y, w, h, 10); ctx.fill();
    ctx.fillStyle = '#f3e5c3'; rr(x + 6, y + 6, w - 12, 86, 8); ctx.fill();
    drawIngredient(kind, x + w / 2, y + 52, kind === 'fries' ? 30 : 38);
    if (kind === 'patty') text('needs grill', x + w / 2, y + 84, 10, '#8a5a2b', 'center', '700');
    if (kind === 'fries') text('needs fryer', x + w / 2, y + 84, 10, '#8a5a2b', 'center', '700');
    ctx.fillStyle = '#3a2417'; rr(x + 6, y + 98, w - 12, 32, 6); ctx.fill();
    text(ING[kind].key, x + 20, y + 121, 14, '#ffb703', 'left', '800');
    text(ING[kind].name, x + w / 2 + 8, y + 121, 15, '#fff', 'center', '700');
  });
  text('1-8 ingredients · Space serve · G grill · F fryer · T bin · P pause · M mute · R restart', 640, 668, 13, '#e8c9a0', 'center', '400');
}
function drawFloaters() {
  for (const f of S.floaters) {
    ctx.globalAlpha = 1 - f.t / 1.4;
    shadowText(f.s, f.x, f.y - f.t * 50, 30, f.color, 'center', '800');
    ctx.globalAlpha = 1;
  }
}
function drawOverlay() {
  if (S.paused && S.phase === 'play') {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
    shadowText('PAUSED', 640, 340, 54, '#fff', 'center', '800');
    text('press P or click II to resume', 640, 380, 18, '#ffd94d', 'center', '600');
    return;
  }
  if (S.phase === 'play') return;
  ctx.fillStyle = 'rgba(20,10,5,0.62)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff8e1'; rr(340, 150, 600, 400, 16); ctx.fill();
  ctx.strokeStyle = '#d9b380'; ctx.lineWidth = 3; rr(340, 150, 600, 400, 16); ctx.stroke();
  const win = S.phase === 'win';
  shadowText(win ? 'SHIFT COMPLETE!' : 'SHIFT OVER', 640, 220, 44, win ? '#5da83c' : '#d9382b', 'center', '800');
  text(S.winReason, 640, 258, 18, '#3a2417', 'center', '600');
  text('SCORE  ' + S.score + '    •    SERVED  ' + S.served + ' dishes    •    BEST COMBO x' + S.bestCombo, 640, 310, 18, '#3a2417', 'center', '700');
  text('COINS EARNED  ' + S.coins + '    •    LEVEL ' + S.level + '    •    GOAL ' + GOAL, 640, 344, 16, '#8a5a2b', 'center', '700');
  if (win) text('The lunch crowd leaves happy. Same time tomorrow, chef!', 640, 384, 15, '#5da83c', 'center', '600');
  else text('Tip: grill patties early and serve while patience is green.', 640, 384, 15, '#8a5a2b', 'center', '600');
  Z.restartBtn = { x: 520, y: 420, w: 240, h: 56 };
  ctx.fillStyle = '#ff6b35'; rr(520, 420, 240, 56, 28); ctx.fill();
  text('PLAY AGAIN  (R)', 640, 456, 20, '#fff', 'center', '800');
  text('Ember & Thyme — Lunch Rush', 640, 520, 13, '#b09a7a', 'center', '400');
}
function render() {
  ctx.save();
  if (S.shake > 0) ctx.translate((Math.random() - 0.5) * S.shake * 24, (Math.random() - 0.5) * S.shake * 24);
  drawBackground();
  drawOrderBoard();
  drawStations();
  drawServeRow();
  drawBins();
  drawFloaters();
  drawTopBar();
  drawOverlay();
  ctx.restore();
}

/* ---------- main loop ---------- */
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  update(dt); render();
  requestAnimationFrame(frame);
}
(function init() {
  const demo = params.get('demo') || params.get('shot') || '';
  if (demo) stageDemo(demo);
  say(S.toast);
  requestAnimationFrame(frame);
})();
