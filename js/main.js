const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);

// Graalhold is drawn entirely in canvas; the small HUD icons are inline SVGs.
const svg = (body, color = '#f0c85a') => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges"><path fill="${color}" d="${body}"/></svg>`)}`;
$('crestIcon').src = svg('M16 1 28 6v9c0 8-5 13-12 16C9 28 4 23 4 15V6zm0 5-7 3v6c0 5 3 8 7 11 4-3 7-6 7-11V9z M14 9h4v11h-4z M11 13h10v3H11z', '#f0c85a');
$('coinIcon').src = svg('M16 2 26 7v18l-10 5L6 25V7zm0 5-5 3v12l5 3 5-3V10z M14 11h4v10h-4z', '#f0c85a');
$('skullIcon').src = svg('M16 2c-7 0-11 5-11 11 0 5 3 8 6 9v5h10v-5c3-2 6-5 6-9 0-6-4-11-11-11zm-5 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm10 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4z M12 24h3v3h-3zm5 0h3v3h-3z', '#d2d7e3');
$('bombIcon').src = svg('M12 5h8v4h-2v3c6 1 10 5 10 10 0 6-5 9-12 9S4 28 4 22c0-5 4-9 9-10V8h-2zm8-4 5 2-3 5-4-2z M10 20h3v3h-3z', '#bd9aff');
$('bombBtnIcon').src = $('bombIcon').src;
$('rollBtnIcon').src = svg('M4 13c2-7 8-10 15-7l2-4 7 9-11 3 2-4c-4-2-8 0-10 4l-5-1zm5 7c4 2 8 0 10-4l5 1c-2 7-8 10-15 7l-2 4-7-9 11-3z', '#e4f5ff');
$('attackBtnIcon').src = svg('M4 26 8 4l4 2-3 18 2 2-3 3zm8-13 13-9 3 4-13 9zm5 3 4-2 5 10-4 2z', '#fff0bd');

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const keys = new Set();
const game = {
  mode: 'title', time: 0, last: 0, width: 0, height: 0, dpr: 1,
  player: null, enemies: [], particles: [], drops: [], decorations: [],
  wave: 1, score: 0, kills: 0, coins: 0, bombs: 2, best: Number(localStorage.getItem('graalholdBest') || 0),
  spawned: 0, quota: 0, spawnTimer: 0, combo: 0, comboTimer: 0, bannerTimer: 0,
  heldAttack: false, muted: false, audio: null, shake: 0, flashTimer: 0, touchVector: { x: 0, y: 0 },
  arena: { left: 0, top: 0, right: 0, bottom: 0 },
};
$('bestScore').textContent = game.best;

function resize() {
  const r = canvas.getBoundingClientRect();
  game.width = r.width; game.height = r.height;
  game.dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(r.width * game.dpr); canvas.height = Math.round(r.height * game.dpr);
  ctx.setTransform(game.dpr, 0, 0, game.dpr, 0, 0);
  game.arena = { left: Math.max(28, r.width * .075), top: Math.max(52, r.height * .09), right: r.width - Math.max(28, r.width * .075), bottom: r.height - Math.max(32, r.height * .08) };
  if (game.player) {
    game.player.x = clamp(game.player.x, game.arena.left + 18, game.arena.right - 18);
    game.player.y = clamp(game.player.y, game.arena.top + 18, game.arena.bottom - 18);
  }
  makeDecorations();
}
window.addEventListener('resize', resize);

function makeDecorations() {
  game.decorations = [];
  const { width: w, height: h, arena: a } = game;
  for (let i = 0; i < Math.ceil(w * h / 6200); i++) {
    const outside = Math.random() < .44;
    game.decorations.push({ x: outside ? rand(0, w) : rand(a.left + 22, a.right - 22), y: outside ? rand(0, h) : rand(a.top + 20, a.bottom - 20), type: Math.random() < .64 ? 'grass' : 'stone', s: rand(3, 10), tone: Math.floor(rand(0, 4)) });
  }
}
resize();

function audioBeep(freq = 440, duration = .07, type = 'square', volume = .035) {
  if (game.muted) return;
  try {
    game.audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (game.audio.state === 'suspended') game.audio.resume();
    const osc = game.audio.createOscillator(), gain = game.audio.createGain();
    osc.type = type; osc.frequency.value = freq; gain.gain.setValueAtTime(volume, game.audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, game.audio.currentTime + duration);
    osc.connect(gain); gain.connect(game.audio.destination); osc.start(); osc.stop(game.audio.currentTime + duration);
  } catch (_) { /* Audio is an optional flourish. */ }
}

function showBanner(kicker, title, sub, boss = false, duration = 2.2) {
  $('bannerKicker').textContent = kicker; $('bannerTitle').textContent = title; $('bannerSub').textContent = sub;
  $('banner').classList.toggle('boss', boss); $('banner').classList.remove('out', 'is-hidden'); $('banner').classList.add('show');
  game.bannerTimer = duration;
}
function hideBanner() {
  if (game.bannerTimer <= 0) return;
  game.bannerTimer = 0; $('banner').classList.remove('show'); $('banner').classList.add('out');
  setTimeout(() => $('banner').classList.add('is-hidden'), 400);
}
function updateHUD() {
  const p = game.player;
  if (!p) return;
  $('hearts').innerHTML = Array.from({ length: p.maxHp }, (_, i) => `<img alt="" src="${svg('M16 28 4 16C-1 9 4 2 10 4l6 5 6-5c6-2 11 5 6 12z', i < p.hp ? '#fa6571' : '#59606f')}" style="opacity:${i < p.hp ? 1 : .48}">`).join('');
  $('coinCount').textContent = game.coins; $('killCount').textContent = game.kills; $('bombCount').textContent = game.bombs;
  $('bombBadge').textContent = game.bombs; $('bombBadge').classList.toggle('empty', game.bombs <= 0);
  $('waveNum').textContent = String(game.wave).padStart(2, '0'); $('scoreNum').textContent = game.score.toLocaleString('es');
  const boss = game.enemies.find(e => e.boss);
  $('bossWrap').classList.toggle('is-hidden', !boss);
  if (boss) { $('bossPct').textContent = `${Math.ceil(boss.hp / boss.maxHp * 100)}%`; $('bossFill').style.width = `${Math.max(0, boss.hp / boss.maxHp * 100)}%`; }
  $('combo').classList.toggle('is-hidden', game.combo < 2 || game.comboTimer <= 0);
  if (game.combo >= 2) { $('comboNum').textContent = `×${game.combo}`; $('comboFill').style.width = `${Math.max(0, game.comboTimer / 2.2 * 100)}%`; $('combo').classList.toggle('hot', game.combo >= 5); }
}

const upgrades = [
  { name: 'FILO AFILADO', desc: 'Tus golpes hacen un 25% más de daño.', icon: 'M5 27 9 5l4 2-4 18 2 2-3 3zm9-13 12-9 3 4-13 9z', rarity: 'Común', apply: p => p.damage += 1 },
  { name: 'CORAZÓN ROBUSTO', desc: 'Recupera 1 vida y aumenta tu máximo en 1.', icon: 'M16 28 4 16C-1 9 4 2 10 4l6 5 6-5c6-2 11 5 6 12z', rarity: 'Común', apply: p => { p.maxHp = Math.min(8, p.maxHp + 1); p.hp = Math.min(p.maxHp, p.hp + 1); } },
  { name: 'BOTAS DEL VIENTO', desc: 'Muévete un 15% más rápido.', icon: 'M4 20h14l8 5v3H4zm2-6 12 1 4 4H6zm2-9h9l3 5H8z', rarity: 'Común', apply: p => p.speed += 28 },
  { name: 'GOLPE VELOZ', desc: 'Ataca un 20% más rápido.', icon: 'M18 1 5 18h8l-1 13 15-19h-9z', rarity: 'Raro', apply: p => p.attackRate = Math.max(.19, p.attackRate * .8) },
  { name: 'ESQUIVA ARCANA', desc: 'Rodar se recarga un 25% más rápido.', icon: 'M16 2 29 16 16 30 3 16zm0 7-7 7 7 7 7-7z', rarity: 'Raro', apply: p => p.rollRate = Math.max(1.05, p.rollRate * .75) },
  { name: 'SAQUEADOR', desc: 'Gana 30 monedas al instante.', icon: 'M16 2 26 7v18l-10 5L6 25V7zm0 5-5 3v12l5 3 5-3V10z', rarity: 'Común', apply: () => { game.coins += 30; } },
  { name: 'BOLSILLO BOMBA', desc: 'Recibe 2 bombas adicionales.', icon: 'M12 5h8v4h-2v3c6 1 10 5 10 10 0 6-5 9-12 9S4 28 4 22c0-5 4-9 9-10V8h-2z', rarity: 'Raro', apply: () => { game.bombs += 2; } },
];

function startGame() {
  game.mode = 'playing'; game.wave = 1; game.score = 0; game.kills = 0; game.coins = 0; game.bombs = 2; game.combo = 0; game.comboTimer = 0;
  game.enemies = []; game.particles = []; game.drops = []; game.spawned = 0; game.quota = 0; game.spawnTimer = .7;
  game.player = { x: (game.arena.left + game.arena.right) / 2, y: (game.arena.top + game.arena.bottom) / 2, vx: 0, vy: 0, faceX: 0, faceY: -1, hp: 5, maxHp: 5, speed: 184, damage: 1, attackRate: .36, attackCd: 0, attackAnim: 0, attackId: 0, rollCd: 0, rollRate: 2.5, rollTime: 0, invuln: 0, hurtCd: 0 };
  $('titleScreen').classList.add('is-hidden'); $('upgradeScreen').classList.add('is-hidden'); $('pauseScreen').classList.add('is-hidden'); $('overScreen').classList.add('is-hidden');
  $('hud').classList.remove('is-hidden'); $('touch').classList.remove('is-hidden');
  $('hint').classList.remove('fade');
  game.mode = 'playing'; beginWave(); updateHUD(); audioBeep(520, .12);
}
function beginWave() {
  game.spawned = 0; game.quota = 5 + game.wave * 2; game.spawnTimer = .8;
  if (game.wave % 5 === 0) { spawnEnemy('boss'); game.spawned = 1; game.quota = 1 + Math.ceil(game.wave / 3); showBanner('¡PELIGRO!', 'EL CUSTODIO', 'El guardián del Grial ha despertado', true, 2.8); audioBeep(120, .5, 'sawtooth'); }
  else showBanner('SOBREVIVE', `OLEADA ${game.wave}`, 'La horda se acerca...', false, 2.2);
}
function spawnEnemy(kind) {
  const a = game.arena, side = Math.floor(Math.random() * 4); let x, y;
  if (side === 0) { x = rand(a.left, a.right); y = a.top + 12; }
  else if (side === 1) { x = a.right - 12; y = rand(a.top, a.bottom); }
  else if (side === 2) { x = rand(a.left, a.right); y = a.bottom - 12; }
  else { x = a.left + 12; y = rand(a.top, a.bottom); }
  if (kind === 'boss') {
    game.enemies.push({ x, y, kind, boss: true, hp: 32 + game.wave * 4, maxHp: 32 + game.wave * 4, speed: 46 + game.wave * 1.1, size: 25, damage: 2, attackCd: 1.4, hitFlash: 0, lastHit: -1, phase: rand(0, 6), color: '#773b59' }); return;
  }
  const roll = Math.random(); kind ||= roll < .24 + game.wave * .008 ? 'runner' : roll > .88 ? 'brute' : 'ghoul';
  const config = kind === 'runner' ? { hp: 1, speed: 89 + game.wave * 2, size: 12, damage: 1, color: '#b9974f', score: 100 } : kind === 'brute' ? { hp: 3 + Math.floor(game.wave / 3), speed: 34 + game.wave, size: 17, damage: 1, color: '#758358', score: 180 } : { hp: 2 + Math.floor(game.wave / 4), speed: 55 + game.wave * 1.3, size: 14, damage: 1, color: '#70946c', score: 120 };
  game.enemies.push({ x, y, ...config, kind, boss: false, attackCd: rand(.1, .7), hitFlash: 0, lastHit: -1, phase: rand(0, 6) });
}
function chooseUpgrade() {
  game.mode = 'upgrade'; $('upgradeScreen').classList.remove('is-hidden');
  const chosen = [...upgrades].sort(() => Math.random() - .5).slice(0, 3);
  $('cards').innerHTML = chosen.map((u, i) => `<button class="card r-${u.rarity === 'Raro' ? 'rare' : 'common'}" data-index="${i}"><span class="card-rarity">${u.rarity.toUpperCase()}</span><img class="card-icon" alt="" src="${svg(u.icon, u.rarity === 'Raro' ? '#9edcff' : '#f0c85a')}"><span class="card-name">${u.name}</span><span class="card-desc">${u.desc}</span><span class="card-key">${i + 1}</span></button>`).join('');
  [...$('cards').children].forEach((el, i) => el.addEventListener('click', () => takeUpgrade(chosen[i], el)));
  game.currentUpgrades = chosen;
}
function takeUpgrade(upgrade, card) {
  if (game.mode !== 'upgrade') return;
  card?.classList.add('selected'); upgrade.apply(game.player); $('upgradeScreen').classList.add('is-hidden'); game.wave++; game.mode = 'playing';
  if (game.wave % 5 === 0) { beginWave(); } else { beginWave(); }
  updateHUD(); audioBeep(680, .12, 'triangle');
}
function damagePlayer(amount = 1) {
  const p = game.player;
  if (p.invuln > 0 || p.hurtCd > 0 || game.mode !== 'playing') return;
  p.hp = Math.max(0, p.hp - amount); p.hurtCd = .72; p.invuln = .55; game.shake = 8; game.flashTimer = .18;
  $('flash').className = 'flash hit'; setTimeout(() => $('flash').className = 'flash', 180);
  burst(p.x, p.y, '#ff6672', 9); audioBeep(110, .16, 'sawtooth'); updateHUD();
  if (p.hp <= 0) gameOver();
}
function gameOver() {
  game.mode = 'over'; const record = game.score > game.best;
  if (record) { game.best = game.score; localStorage.setItem('graalholdBest', game.best); }
  $('overScore').textContent = game.score.toLocaleString('es'); $('overWave').textContent = game.wave; $('overKills').textContent = game.kills; $('overCoins').textContent = game.coins;
  $('overBest').textContent = game.best.toLocaleString('es'); $('newRecord').classList.toggle('is-hidden', !record);
  $('overSub').textContent = `Llegaste a la oleada ${game.wave}`;
  $('overScreen').classList.remove('is-hidden'); $('touch').classList.add('is-hidden'); $('bossWrap').classList.add('is-hidden');
  $('bestScore').textContent = game.best.toLocaleString('es'); audioBeep(90, .5, 'triangle');
}
function pauseGame() {
  if (game.mode === 'playing') {
    game.mode = 'paused'; $('pauseWave').textContent = game.wave; $('pauseScore').textContent = game.score.toLocaleString('es'); $('pauseKills').textContent = game.kills;
    $('pauseScreen').classList.remove('is-hidden'); $('touch').classList.add('is-hidden');
  } else if (game.mode === 'paused') { game.mode = 'playing'; $('pauseScreen').classList.add('is-hidden'); $('touch').classList.remove('is-hidden'); }
}
function toMenu() {
  game.mode = 'title'; $('titleScreen').classList.remove('is-hidden'); $('pauseScreen').classList.add('is-hidden'); $('overScreen').classList.add('is-hidden'); $('upgradeScreen').classList.add('is-hidden'); $('hud').classList.add('is-hidden'); $('touch').classList.add('is-hidden'); $('bossWrap').classList.add('is-hidden');
}
function burst(x, y, color, count = 6) {
  for (let i = 0; i < count; i++) game.particles.push({ x, y, vx: rand(-95, 95), vy: rand(-105, 75), life: rand(.22, .58), max: .58, color, size: rand(2, 5) });
}
function killEnemy(e) {
  game.enemies.splice(game.enemies.indexOf(e), 1); game.kills++;
  game.combo = game.comboTimer > 0 ? game.combo + 1 : 1; game.comboTimer = 2.2;
  const mult = 1 + Math.min(game.combo - 1, 10) * .1;
  game.score += Math.round(e.score || (e.boss ? 2500 : 100) * mult);
  burst(e.x, e.y, e.boss ? '#d27cff' : e.color, e.boss ? 25 : 8);
  if (!e.boss && Math.random() < .26) game.drops.push({ x: e.x, y: e.y, type: Math.random() < .76 ? 'coin' : 'heart', life: 12, phase: rand(0, 6) });
  if (e.boss) { game.coins += 50; game.score += 1000; game.shake = 14; showBanner('¡VICTORIA!', 'EL CUSTODIO CAE', 'El Grial aún te necesita', false, 2); }
  audioBeep(e.boss ? 190 : 240, .08, 'square'); updateHUD();
}
function attack() {
  const p = game.player; if (!p || p.attackCd > 0 || game.mode !== 'playing') return;
  p.attackCd = p.attackRate; p.attackAnim = .24; p.attackId++;
  let hits = 0;
  for (const e of [...game.enemies]) {
    const dx = e.x - p.x, dy = e.y - p.y, dist = Math.hypot(dx, dy), dot = (dx * p.faceX + dy * p.faceY) / (dist || 1);
    if (dist < (e.boss ? 58 : 48) + e.size * .35 && (dot > -.15 || dist < 23)) {
      e.hp -= p.damage; e.hitFlash = .12; e.lastHit = p.attackId; e.x += p.faceX * 9; e.y += p.faceY * 9; burst(e.x, e.y, '#ffe49a', 3); hits++;
      if (e.hp <= 0) killEnemy(e);
    }
  }
  if (hits) { audioBeep(320 + Math.random() * 100, .055, 'square', .025); }
}
function roll() {
  const p = game.player; if (!p || p.rollCd > 0 || game.mode !== 'playing') return;
  p.rollCd = p.rollRate; p.rollTime = .25; p.invuln = Math.max(p.invuln, .34);
  const input = inputVector(); if (Math.hypot(input.x, input.y) > 0) { p.faceX = input.x; p.faceY = input.y; }
  p.vx = p.faceX * 470; p.vy = p.faceY * 470; audioBeep(240, .1, 'triangle');
}
function bomb() {
  if (game.mode !== 'playing' || game.bombs <= 0) return;
  game.bombs--; game.shake = 12; $('flash').className = 'flash bomb'; setTimeout(() => $('flash').className = 'flash', 200);
  for (const e of [...game.enemies]) {
    const d = Math.hypot(e.x - game.player.x, e.y - game.player.y);
    if (d < (e.boss ? 250 : 310)) { e.hp -= e.boss ? 12 : 99; burst(e.x, e.y, '#ffc86b', 8); if (e.hp <= 0) killEnemy(e); }
  }
  burst(game.player.x, game.player.y, '#ffc86b', 36); audioBeep(70, .38, 'sawtooth', .06); updateHUD();
}
function inputVector() {
  let x = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0) + game.touchVector.x;
  let y = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0) + game.touchVector.y;
  const len = Math.hypot(x, y); return len > 1 ? { x: x / len, y: y / len } : { x, y };
}

function update(dt) {
  game.time += dt;
  if (game.bannerTimer > 0) { game.bannerTimer -= dt; if (game.bannerTimer <= 0) hideBanner(); }
  if (game.mode === 'playing') {
    const p = game.player, move = inputVector();
    p.attackCd = Math.max(0, p.attackCd - dt); p.attackAnim = Math.max(0, p.attackAnim - dt); p.rollCd = Math.max(0, p.rollCd - dt); p.rollTime = Math.max(0, p.rollTime - dt);
    p.invuln = Math.max(0, p.invuln - dt); p.hurtCd = Math.max(0, p.hurtCd - dt);
    if (Math.hypot(move.x, move.y) > .12 && p.rollTime <= 0) { p.faceX = move.x; p.faceY = move.y; }
    if (p.rollTime <= 0) { p.vx = move.x * p.speed; p.vy = move.y * p.speed; }
    p.x = clamp(p.x + p.vx * dt, game.arena.left + 16, game.arena.right - 16);
    p.y = clamp(p.y + p.vy * dt, game.arena.top + 16, game.arena.bottom - 16);
    p.vx *= Math.pow(.001, dt); p.vy *= Math.pow(.001, dt);
    if (game.heldAttack || keys.has('j') || keys.has(' ')) attack();
    if (game.comboTimer > 0) game.comboTimer = Math.max(0, game.comboTimer - dt);
    game.spawnTimer -= dt;
    if (game.spawned < game.quota && game.spawnTimer <= 0 && game.enemies.filter(e => !e.boss).length < 9) {
      spawnEnemy(); game.spawned++; game.spawnTimer = Math.max(.38, 1.15 - game.wave * .025) * rand(.7, 1.2);
    }
    for (const e of [...game.enemies]) {
      e.phase += dt * (e.boss ? 2 : 5); e.hitFlash = Math.max(0, e.hitFlash - dt); e.attackCd -= dt;
      const dx = p.x - e.x, dy = p.y - e.y, dist = Math.hypot(dx, dy) || 1, nx = dx / dist, ny = dy / dist;
      const stopAt = e.boss ? 50 : e.size + 16;
      if (dist > stopAt) { e.x += nx * e.speed * dt; e.y += ny * e.speed * dt; }
      if (e.boss && dist < 210 && e.attackCd <= 0) {
        e.attackCd = 2.6; e.slam = .5; e.slamX = p.x; e.slamY = p.y;
      }
      if (e.slam > 0) {
        e.slam -= dt;
        if (e.slam <= 0 && Math.hypot(p.x - e.slamX, p.y - e.slamY) < 70) damagePlayer(1);
      }
      if (dist < stopAt + 5 && e.attackCd <= 0 && !e.boss) { e.attackCd = .95; damagePlayer(e.damage); }
      // Gentle separation prevents a single unreadable enemy pile.
      for (const other of game.enemies) if (other !== e && !other.boss) {
        const ox = e.x - other.x, oy = e.y - other.y, od = Math.hypot(ox, oy);
        if (od > .01 && od < 22) { e.x += ox / od * dt * 13; e.y += oy / od * dt * 13; }
      }
      e.x = clamp(e.x, game.arena.left + 8, game.arena.right - 8); e.y = clamp(e.y, game.arena.top + 8, game.arena.bottom - 8);
    }
    for (const d of [...game.drops]) {
      d.life -= dt; d.phase += dt * 4;
      if (Math.hypot(d.x - p.x, d.y - p.y) < 25) {
        if (d.type === 'coin') { game.coins += 5; game.score += 25; burst(d.x, d.y, '#f0c85a', 5); }
        else if (p.hp < p.maxHp) { p.hp++; $('flash').className = 'flash heal'; setTimeout(() => $('flash').className = 'flash', 200); burst(d.x, d.y, '#7effa1', 8); }
        else { game.coins += 10; }
        game.drops.splice(game.drops.indexOf(d), 1); audioBeep(760, .06, 'triangle'); updateHUD();
      } else if (d.life <= 0) game.drops.splice(game.drops.indexOf(d), 1);
    }
    if (game.spawned >= game.quota && game.enemies.length === 0) { game.mode = 'upgrade'; chooseUpgrade(); audioBeep(560, .16, 'triangle'); }
    if (Math.random() < dt * .35) updateHUD();
  }
  for (const particle of [...game.particles]) {
    particle.life -= dt; particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vy += 100 * dt;
    if (particle.life <= 0) game.particles.splice(game.particles.indexOf(particle), 1);
  }
  game.shake = Math.max(0, game.shake - dt * 28);
  if (game.mode === 'title') { /* Ambient scenery keeps the title alive. */ }
}

function drawBackground() {
  const { width: w, height: h, arena: a } = game;
  ctx.fillStyle = '#101a16'; ctx.fillRect(0, 0, w, h);
  // Dark forest around the compact, torch-lit arena.
  for (let y = 0; y < h; y += 26) for (let x = 0; x < w; x += 26) {
    const n = Math.abs(Math.sin(x * 13.1 + y * 7.7));
    ctx.fillStyle = n > .72 ? '#14221b' : '#111d18'; ctx.fillRect(x, y, 24, 24);
    if (n > .86) { ctx.fillStyle = '#203528'; ctx.fillRect(x + 5, y + 7, 12, 3); ctx.fillRect(x + 8, y + 3, 6, 4); }
  }
  ctx.fillStyle = '#34442e'; ctx.fillRect(a.left - 10, a.top - 10, a.right - a.left + 20, a.bottom - a.top + 20);
  ctx.fillStyle = '#546040'; ctx.fillRect(a.left - 4, a.top - 4, a.right - a.left + 8, a.bottom - a.top + 8);
  ctx.fillStyle = '#536047'; ctx.fillRect(a.left, a.top, a.right - a.left, a.bottom - a.top);
  ctx.fillStyle = '#5c674b'; ctx.fillRect(a.left + 4, a.top + 4, a.right - a.left - 8, a.bottom - a.top - 8);
  // Patchwork earth tiles, all aligned to preserve the pixel-art look.
  const tile = 38;
  for (let y = Math.floor(a.top / tile) * tile; y < a.bottom; y += tile) for (let x = Math.floor(a.left / tile) * tile; x < a.right; x += tile) {
    const n = Math.abs(Math.sin(x * .17 + y * .21));
    if (n > .72) { ctx.fillStyle = n > .9 ? 'rgba(125,132,88,.13)' : 'rgba(34,53,39,.14)'; ctx.fillRect(x + 2, y + 2, tile - 4, tile - 4); }
    ctx.fillStyle = 'rgba(21,35,27,.22)'; ctx.fillRect(x + 5, y + tile - 3, 2, 2);
  }
  // Stone perimeter and broken crenellations.
  for (let x = a.left - 6; x < a.right + 5; x += 32) {
    ctx.fillStyle = '#303d35'; ctx.fillRect(x, a.top - 11, 23, 8); ctx.fillRect(x, a.bottom + 3, 23, 8);
    ctx.fillStyle = '#68705a'; ctx.fillRect(x + 2, a.top - 10, 18, 3); ctx.fillRect(x + 2, a.bottom + 4, 18, 3);
  }
  for (const d of game.decorations) {
    if (d.x > a.left && d.x < a.right && d.y > a.top && d.y < a.bottom) {
      if (d.type === 'grass') {
        ctx.fillStyle = ['#344b35','#40593c','#65704a','#405039'][d.tone]; ctx.fillRect(d.x, d.y, d.s, 2); ctx.fillRect(d.x + 2, d.y - 3, 2, 4);
      } else {
        ctx.fillStyle = ['#717360','#8b876c','#5c685b','#979078'][d.tone]; ctx.fillRect(d.x, d.y, d.s, d.s * .55); ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(d.x + 1, d.y + 1, d.s * .4, 1);
      }
    } else {
      // Foreground tree crowns, composed from chunky squares.
      ctx.fillStyle = '#0c1713'; ctx.fillRect(d.x - d.s * .7, d.y - d.s * .5, d.s * 1.5, d.s * 1.4);
      ctx.fillStyle = ['#1b3024','#203a29','#29412b','#1c3527'][d.tone]; ctx.fillRect(d.x - d.s * .5, d.y - d.s * .6, d.s, d.s);
      ctx.fillStyle = 'rgba(123,151,91,.18)'; ctx.fillRect(d.x - d.s * .3, d.y - d.s * .45, d.s * .4, 2);
    }
  }
  // Torches on the arena wall.
  for (const [x, y] of [[a.left + 20, a.top + 7], [a.right - 20, a.top + 7], [a.left + 20, a.bottom - 7], [a.right - 20, a.bottom - 7]]) {
    ctx.fillStyle = '#3a2718'; ctx.fillRect(x - 2, y - 5, 4, 10); ctx.fillStyle = '#ffcb63'; ctx.fillRect(x - 2, y - 7 + Math.sin(game.time * 8 + x) * 1, 4, 4);
    ctx.fillStyle = 'rgba(255,185,75,.12)'; ctx.fillRect(x - 12, y - 15, 24, 24);
  }
}
function drawCharacter(x, y, color, size, faceX, faceY, isPlayer = false, boss = false, hit = false, phase = 0) {
  const bob = Math.sin(game.time * (boss ? 3 : 8) + phase) * (boss ? 1.5 : 1);
  // grounding shadow
  ctx.fillStyle = 'rgba(7,12,10,.42)'; ctx.fillRect(x - size * .82, y + size * .45, size * 1.65, size * .42);
  if (boss) {
    ctx.fillStyle = 'rgba(159,52,96,.18)'; ctx.fillRect(x - 30, y - 32 + bob, 60, 58);
    ctx.fillStyle = '#492c42'; ctx.fillRect(x - 20, y - 16 + bob, 40, 35);
    ctx.fillStyle = hit ? '#ffe0d5' : '#8c4d67'; ctx.fillRect(x - 17, y - 23 + bob, 34, 30);
    ctx.fillStyle = '#c46b69'; ctx.fillRect(x - 13, y - 28 + bob, 8, 12); ctx.fillRect(x + 5, y - 28 + bob, 8, 12);
    ctx.fillStyle = '#ffe27c'; ctx.fillRect(x - 10, y - 13 + bob, 5, 4); ctx.fillRect(x + 5, y - 13 + bob, 5, 4);
    ctx.fillStyle = '#382437'; ctx.fillRect(x - 12, y + 10 + bob, 24, 10);
    ctx.fillStyle = '#b58452'; ctx.fillRect(x - 25, y - 1 + bob, 7, 14); ctx.fillRect(x + 18, y - 1 + bob, 7, 14);
    return;
  }
  // blocky legs, tunic, head and face
  ctx.fillStyle = '#2c332d'; ctx.fillRect(x - size * .5, y + size * .05 + bob, size * .42, size * .48); ctx.fillRect(x + size * .08, y + size * .05 + bob, size * .42, size * .48);
  ctx.fillStyle = hit ? '#fff1db' : isPlayer ? '#4a7c69' : color; ctx.fillRect(x - size * .68, y - size * .45 + bob, size * 1.36, size * .87);
  ctx.fillStyle = isPlayer ? '#d2ad71' : '#52624b'; ctx.fillRect(x - size * .7, y - size * .12 + bob, size * 1.4, size * .18);
  ctx.fillStyle = isPlayer ? '#e5c595' : '#a9a078'; ctx.fillRect(x - size * .46, y - size * 1.05 + bob, size * .92, size * .7);
  ctx.fillStyle = isPlayer ? '#493626' : '#3a3b2e'; ctx.fillRect(x - size * .52, y - size * 1.13 + bob, size * 1.04, size * .25);
  ctx.fillStyle = isPlayer ? '#392a21' : '#33342c'; ctx.fillRect(x - size * .52, y - size * 1.01 + bob, size * 1.04, size * .12);
  const eyeX = faceX > .25 ? size * .12 : faceX < -.25 ? -size * .3 : -size * .25;
  ctx.fillStyle = isPlayer ? '#252d30' : '#e55c54'; ctx.fillRect(x + eyeX, y - size * .78 + bob, size * .12, size * .12);
  if (isPlayer) {
    // belt and scarf, for readability at a glance
    ctx.fillStyle = '#e5bb62'; ctx.fillRect(x - size * .62, y + size * .13 + bob, size * 1.24, size * .13);
    ctx.fillStyle = '#b54b43'; ctx.fillRect(x + size * .35, y - size * .25 + bob, size * .42, size * .15);
  }
}
function drawWorld() {
  const { width: w, height: h } = game; ctx.clearRect(0, 0, w, h);
  ctx.save();
  if (game.shake > 0) ctx.translate(rand(-game.shake, game.shake), rand(-game.shake, game.shake));
  drawBackground();
  for (const d of game.drops) {
    const bob = Math.sin(d.phase) * 3; ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(d.x - 7, d.y + 4, 14, 5);
    if (d.type === 'coin') { ctx.fillStyle = '#80551e'; ctx.fillRect(d.x - 6, d.y - 7 + bob, 12, 14); ctx.fillStyle = '#f6d365'; ctx.fillRect(d.x - 4, d.y - 7 + bob, 8, 11); ctx.fillStyle = '#fff0a5'; ctx.fillRect(d.x - 2, d.y - 5 + bob, 2, 6); }
    else { ctx.fillStyle = '#ff6572'; ctx.fillRect(d.x - 8, d.y - 6 + bob, 16, 11); ctx.fillRect(d.x - 5, d.y - 9 + bob, 4, 4); ctx.fillRect(d.x + 1, d.y - 9 + bob, 4, 4); }
  }
  // Boss warning marker while it winds up a slam.
  for (const e of game.enemies) {
    if (e.slam > 0) { ctx.strokeStyle = `rgba(255,90,90,${.35 + Math.sin(game.time * 24) * .2})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e.slamX, e.slamY, 62 * (1 - e.slam), 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = 'rgba(220,48,62,.13)'; ctx.beginPath(); ctx.arc(e.slamX, e.slamY, 62, 0, Math.PI * 2); ctx.fill(); }
    drawCharacter(e.x, e.y, e.color, e.size, 0, 1, false, e.boss, e.hitFlash > 0, e.phase);
    if (!e.boss && e.hp > 2) { ctx.fillStyle = '#26302a'; ctx.fillRect(e.x - 11, e.y - e.size * 1.3, 22, 3); ctx.fillStyle = '#be5550'; ctx.fillRect(e.x - 10, e.y - e.size * 1.3 + 1, 20 * e.hp / (e.kind === 'brute' ? 3 + Math.floor(game.wave / 3) : 2 + Math.floor(game.wave / 4)), 1); }
  }
  if (game.player) {
    const p = game.player;
    if (p.attackAnim > 0) {
      ctx.strokeStyle = `rgba(255,235,167,${p.attackAnim / .24})`; ctx.lineWidth = 5; ctx.beginPath();
      const angle = Math.atan2(p.faceY, p.faceX); ctx.arc(p.x, p.y - 3, 39, angle - .9, angle + .9); ctx.stroke();
      ctx.strokeStyle = '#fff4ce'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y - 3, 42, angle - .75, angle + .75); ctx.stroke();
    }
    if (p.rollTime > 0) { ctx.fillStyle = 'rgba(115,210,255,.25)'; ctx.fillRect(p.x - 15, p.y - 18, 30, 34); }
    if (p.invuln <= 0 || Math.floor(game.time * 18) % 2 === 0) drawCharacter(p.x, p.y, '#4a7c69', 17, p.faceX, p.faceY, true);
  }
  for (const p of game.particles) { ctx.globalAlpha = clamp(p.life / p.max, 0, 1); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); }
  ctx.globalAlpha = 1; ctx.restore();
  // Soft game-only lighting to anchor the hero in the clearing.
  const p = game.player;
  if (p && game.mode !== 'title') { const glow = ctx.createRadialGradient(p.x, p.y, 20, p.x, p.y, Math.max(w, h) * .7); glow.addColorStop(0, 'rgba(5,9,10,0)'); glow.addColorStop(1, 'rgba(3,7,10,.25)'); ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h); }
}

function frame(now) {
  const dt = Math.min(.04, (now - (game.last || now)) / 1000); game.last = now;
  update(dt); drawWorld(); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Screen actions
$('playBtn').addEventListener('click', startGame);
$('howBtn').addEventListener('click', () => {
  const panel = $('howPanel');
  panel.classList.toggle('is-hidden');
  $('howBtn').textContent = panel.classList.contains('is-hidden') ? 'CÓMO JUGAR' : 'CERRAR';
});
$('pauseBtn').addEventListener('click', pauseGame);
$('resumeBtn').addEventListener('click', pauseGame);
$('restartBtn').addEventListener('click', startGame);
$('retryBtn').addEventListener('click', startGame);
$('menuBtn').addEventListener('click', toMenu);
$('overMenuBtn').addEventListener('click', toMenu);
$('muteBtn').addEventListener('click', () => {
  game.muted = !game.muted;
  $('muteGlyph').textContent = game.muted ? '♪̸' : '♪';
  $('muteBtn').setAttribute('aria-label', game.muted ? 'Activar sonido' : 'Silenciar sonido');
  if (!game.muted) audioBeep(520, .08, 'triangle');
});

// Keyboard input is shared between movement, combat and accessible card selection.
window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'tab'].includes(key)) {
    if (key !== 'tab') event.preventDefault();
  }
  if (key === 'm') {
    if (!event.repeat) $('muteBtn').click();
    return;
  }
  if (game.mode === 'title' && key === 'enter') { startGame(); return; }
  if ((key === 'escape' || key === 'p') && !event.repeat) {
    if (game.mode === 'playing' || game.mode === 'paused') pauseGame();
    return;
  }
  if (game.mode === 'over' && key === 'r') { startGame(); return; }
  if (game.mode === 'upgrade' && ['1', '2', '3'].includes(key)) {
    const index = Number(key) - 1;
    $('cards').children[index]?.click();
    return;
  }
  keys.add(key);
  if (!event.repeat && game.mode === 'playing') {
    if (key === 'k' || key === 'shift') roll();
    if (key === 'e') bomb();
  }
});
window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
window.addEventListener('blur', () => { keys.clear(); game.heldAttack = false; game.touchVector = { x: 0, y: 0 }; });

$('btnAttack').addEventListener('pointerdown', (event) => {
  event.preventDefault(); game.heldAttack = true; $('btnAttack').classList.add('held');
  try { $('btnAttack').setPointerCapture(event.pointerId); } catch (_) { /* Optional on older browsers. */ }
  attack();
});
const releaseAttack = () => { game.heldAttack = false; $('btnAttack').classList.remove('held'); };
$('btnAttack').addEventListener('pointerup', releaseAttack);
$('btnAttack').addEventListener('pointercancel', releaseAttack);
$('btnAttack').addEventListener('lostpointercapture', releaseAttack);
$('btnRoll').addEventListener('pointerdown', (event) => { event.preventDefault(); roll(); });
$('btnBomb').addEventListener('pointerdown', (event) => { event.preventDefault(); bomb(); });

// Virtual joystick: track a single pointer, normalize at the edge, and reset on release.
const stickZone = $('stickZone'), stickBase = $('stickBase'), stickKnob = $('stickKnob');
let stickPointer = null;
function moveStick(event) {
  const rect = stickBase.getBoundingClientRect();
  const radius = Math.max(1, Math.min(rect.width, rect.height) * .34);
  const dx = event.clientX - (rect.left + rect.width / 2);
  const dy = event.clientY - (rect.top + rect.height / 2);
  const distance = Math.hypot(dx, dy), scale = distance > radius ? radius / distance : 1;
  const nx = dx * scale, ny = dy * scale;
  game.touchVector = { x: nx / radius, y: ny / radius };
  stickKnob.style.left = `calc(50% + ${nx}px)`;
  stickKnob.style.top = `calc(50% + ${ny}px)`;
}
function releaseStick(event) {
  if (event && stickPointer !== event.pointerId) return;
  stickPointer = null; game.touchVector = { x: 0, y: 0 };
  stickBase.classList.remove('active'); stickKnob.style.left = '50%'; stickKnob.style.top = '50%';
}
stickZone.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  if (stickPointer !== null) return;
  stickPointer = event.pointerId; stickBase.classList.add('active');
  try { stickZone.setPointerCapture(event.pointerId); } catch (_) { /* Optional on older browsers. */ }
  moveStick(event);
});
stickZone.addEventListener('pointermove', (event) => { if (stickPointer === event.pointerId) moveStick(event); });
stickZone.addEventListener('pointerup', releaseStick);
stickZone.addEventListener('pointercancel', releaseStick);
stickZone.addEventListener('lostpointercapture', releaseStick);

// Do not leave a run suspended behind a hidden browser tab or stale input state.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.mode === 'playing') pauseGame();
  keys.clear(); releaseAttack(); releaseStick();
});
