import { CLASSES, getClass } from './classes.js';
import { BOSSES, DIFFICULTIES, getBoss, getDiff } from './bosses.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let W = window.innerWidth, H = window.innerHeight;
function resize() { W = window.innerWidth; H = window.innerHeight; canvas.width = W; canvas.height = H; }
resize();
window.addEventListener('resize', resize);

const state = {
  running: false,
  classId: 'hero', bossId: 'riptide', diffId: 'mediocre',
  player: null, boss: null,
  bullets: [], particles: [], shockwaves: [],
  turrets: [], comboQueue: [], comboTimer: 0,
  time: 0, phase: 1,
  keys: {}, mouse: { x: 0, y: 0, down: false },
  touch: { moveX: 0, moveY: 0, shoot: false },
  lastDodgeTime: -99,
  shake: 0
};

// UI wiring
const classSelect = document.getElementById('classSelect');
const bossSelect = document.getElementById('bossSelect');
const diffSelect = document.getElementById('diffSelect');
const classDesc = document.getElementById('classDesc');
CLASSES.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.name; classSelect.appendChild(o); });
BOSSES.forEach(b => { const o = document.createElement('option'); o.value = b.id; o.textContent = b.name; bossSelect.appendChild(o); });
DIFFICULTIES.forEach(d => { const o = document.createElement('option'); o.value = d.id; o.textContent = d.name; diffSelect.appendChild(o); });
classSelect.value = 'hero'; bossSelect.value = 'riptide'; diffSelect.value = 'mediocre';
function updateDesc() { const c = getClass(classSelect.value); classDesc.textContent = c.desc; }
classSelect.addEventListener('change', updateDesc);
updateDesc();
document.getElementById('startBtn').addEventListener('click', () => {
  state.classId = classSelect.value; state.bossId = bossSelect.value; state.diffId = diffSelect.value; startGame();
});
document.getElementById('overlayBtn').addEventListener('click', () => {
  document.getElementById('overlay').classList.add('hidden');
  if (state.outcome === 'win' || state.outcome === 'lose') { cleanupGame(); document.getElementById('titleScreen').classList.remove('hidden'); document.getElementById('hud').classList.add('hidden'); }
});

function rand(a, b) { return a + Math.random() * (b - a); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function spawnParticles(x, y, color, count = 10, speed = 3) {
  const n = Math.min(count, 16);
  for (let i = 0; i < n; i++) {
    state.particles.push({ x, y, vx: (Math.random()-0.5)*speed, vy: (Math.random()-0.5)*speed, life: 0.5, max: 0.5, color, size: 2 });
  }
}
function updateParticles(dt) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.life -= dt; p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 30*dt;
    if (p.life <= 0) state.particles.splice(i, 1);
  }
}
function spawnShockwave(x, y, color, maxR = 80, speed = 60, dmg = 0) {
  state.shockwaves.push({ x, y, r: 5, maxR, speed, dmg, life: 1.2, max: 1.2, color });
}
function updateShockwaves(dt) {
  const p = state.player;
  for (let i = state.shockwaves.length - 1; i >= 0; i--) {
    const s = state.shockwaves[i];
    s.r += s.speed * dt; s.life -= dt;
    if (s.dmg > 0 && state.invuln <= 0) {
      const d = Math.hypot(p.x - s.x, p.y - s.y);
      if (Math.abs(d - s.r) < 8) {
        p.hp -= s.dmg; spawnParticles(p.x, p.y, '#ff4444', 8, 3);
        state.shake = 0.3; s.dmg = 0;
        if (p.hp <= 0) { p.hp = 0; endGame(false); }
      }
    }
    if (s.life <= 0 || s.r > s.maxR) state.shockwaves.splice(i, 1);
  }
}

function makePlayer(cls) {
  return { cls, hp: cls.hp, maxHp: cls.hp, x: W/2, y: H - 80, speed: cls.speed*40, damage: cls.damage, fireCd: 0, abilityCd: 0, invuln: 0, angle: -Math.PI/2 };
}
function makeBoss(bossData, diff) {
  return {
    data: bossData, diff, hp: bossData.baseHp * diff.mult, maxHp: bossData.baseHp * diff.mult,
    phase: 1, x: W/2, y: 120, azure: false, dashTimer: 0, walkSpeed: 60,
    flying: false, flyTimer: 0, posture: 0, maxPosture: 100, stunnedTimer: 0,
    recoveryTimer: 0, telegraph: null, telegraphTimer: 0, perilous: false,
    waterWings: true, weakPoint: null, angle: Math.PI/2,
    attackTimer: 2, helmet: true
  };
}

// ---------- Input ----------
window.addEventListener('keydown', e => {
  state.keys[e.key.toLowerCase()] = true;
  if (e.key === ' ') { e.preventDefault(); tryAbility(); state.lastDodgeTime = state.time; }
  if (e.key.toLowerCase() === 'e') { tryParry(); }
});
window.addEventListener('keyup', e => { state.keys[e.key.toLowerCase()] = false; });
canvas.addEventListener('mousemove', e => { state.mouse.x = e.clientX; state.mouse.y = e.clientY; });
canvas.addEventListener('mousedown', e => { state.mouse.down = true; });
canvas.addEventListener('mouseup', e => { state.mouse.down = false; });

const joystick = document.getElementById('joystick');
const stick = document.getElementById('stick');
let joyId = null, joyStart = { x: 0, y: 0 };
joystick.addEventListener('touchstart', e => { const t = e.changedTouches[0]; joyId = t.identifier; joyStart = { x: t.clientX, y: t.clientY }; });
window.addEventListener('touchmove', e => {
  for (const t of e.changedTouches) {
    if (t.identifier === joyId) {
      const dx = t.clientX - joyStart.x, dy = t.clientY - joyStart.y;
      const mag = Math.hypot(dx, dy), max = 40;
      const cx = mag > max ? dx / mag * max : dx;
      const cy = mag > max ? dy / mag * max : dy;
      stick.style.left = (33 + cx) + 'px'; stick.style.top = (33 + cy) + 'px';
      state.touch.moveX = cx / max; state.touch.moveY = cy / max;
    }
  }
}, { passive: true });
window.addEventListener('touchend', e => {
  for (const t of e.changedTouches) {
    if (t.identifier === joyId) { joyId = null; stick.style.left = '33px'; stick.style.top = '33px'; state.touch.moveX = 0; state.touch.moveY = 0; }
  }
});
document.getElementById('shootBtn').addEventListener('touchstart', e => { state.touch.shoot = true; e.preventDefault(); });
document.getElementById('shootBtn').addEventListener('touchend', e => { state.touch.shoot = false; });
document.getElementById('abilityBtn').addEventListener('touchstart', e => { tryAbility(); e.preventDefault(); });

// ---------- Game flow ----------
function startGame() {
  cleanupGame();
  document.getElementById('titleScreen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  if (window.innerWidth < 900) document.getElementById('touchControls').classList.remove('hidden');
  const cls = getClass(state.classId);
  const bossData = getBoss(state.bossId);
  const diff = getDiff(state.diffId);
  state.player = makePlayer(cls);
  state.boss = makeBoss(bossData, diff);
  state.running = true;
  state.time = 0; state.phase = 1;
  state.bullets = []; state.particles = []; state.shockwaves = [];
  state.comboQueue = []; state.comboTimer = 0;
  state.outcome = null; state.lastDodgeTime = -99;
  document.getElementById('bossName').textContent = bossData.name.toUpperCase();
  updateHud();
}
function cleanupGame() {
  state.running = false;
  state.player = null; state.boss = null;
  state.bullets = []; state.particles = []; state.shockwaves = [];
}
function endGame(win) {
  state.running = false;
  state.outcome = win ? 'win' : 'lose';
  const ov = document.getElementById('overlay');
  document.getElementById('overlayTitle').textContent = win ? 'VICTORY' : 'DEFEAT';
  document.getElementById('overlayMsg').textContent = win ? 'Riptide Weaver defeated.' : 'You were destroyed.';
  document.getElementById('overlayBtn').textContent = 'Back to Menu';
  ov.classList.remove('hidden');
  if (window.innerWidth < 900) document.getElementById('touchControls').classList.add('hidden');
}

// ---------- Player update ----------
function updatePlayer(dt) {
  const p = state.player;
  const cls = p.cls;
  let mx = 0, my = 0;
  if (state.keys['a'] || state.keys['arrowleft']) mx -= 1;
  if (state.keys['d'] || state.keys['arrowright']) mx += 1;
  if (state.keys['w'] || state.keys['arrowup']) my -= 1;
  if (state.keys['s'] || state.keys['arrowdown']) my += 1;
  mx += state.touch.moveX; my += state.touch.moveY;
  const mag = Math.hypot(mx, my);
  if (mag > 0) { mx /= mag; my /= mag; }
  let speed = p.speed;
  if (state.invuln > 0) speed *= 1.15;
  p.x = clamp(p.x + mx * speed * dt, 30, W - 30);
  p.y = clamp(p.y + my * speed * dt, 30, H - 30);
  if (mag > 0) p.angle = Math.atan2(my, mx);

  p.fireCd -= dt;
  const shooting = state.mouse.down || state.touch.shoot;
  if (shooting && p.fireCd <= 0) { p.fireCd = cls.fireRate; firePlayer(p); }

  p.abilityCd = Math.max(0, p.abilityCd - dt);
  state.invuln = Math.max(0, state.invuln - dt);
  state.critBuff = Math.max(0, state.critBuff - dt);
}
function firePlayer(p) {
  const cls = p.cls;
  const boss = state.boss;
  const dx = boss.x - p.x, dy = boss.y - p.y;
  const len = Math.hypot(dx, dy) || 1;
  const dirx = dx / len, diry = dy / len;
  const spread = 0.05;
  const ang = Math.atan2(diry, dirx) + (Math.random() - 0.5) * spread;
  const vx = Math.cos(ang) * 500, vy = Math.sin(ang) * 500;
  state.bullets.push({ x: p.x, y: p.y, vx, vy, owner: 'player', damage: 1, life: 2, size: 4, color: '#4af0ff', homing: cls.homing });
  if (Math.random() < 0.25) {
    const ang2 = Math.atan2(diry, dirx) + (Math.random() - 0.5) * 0.15;
    state.bullets.push({ x: p.x, y: p.y, vx: Math.cos(ang2)*500, vy: Math.sin(ang2)*500, owner: 'player', damage: 0.6, life: 2, size: 3, color: '#4af0ff', homing: cls.homing });
  }
}
function tryAbility() {
  if (!state.running) return;
  const p = state.player;
  const cls = p.cls;
  if (p.abilityCd > 0) return;
  p.abilityCd = cls.abilityCd;
  if (cls.ability === 'dash') {
    let dx = 0, dy = -1;
    if (state.keys['a']) dx = -1; if (state.keys['d']) dx = 1;
    if (state.keys['w']) dy = -1; if (state.keys['s']) dy = 1;
    const mag = Math.hypot(dx, dy) || 1;
    p.x = clamp(p.x + (dx / mag) * 90, 30, W - 30);
    p.y = clamp(p.y + (dy / mag) * 90, 30, H - 30);
    state.invuln = 0.3;
    spawnParticles(p.x, p.y, cls.color, 18, 4);
    spawnShockwave(p.x, p.y, '#4af0ff', 60, 120, 0);
  }
}
function tryParry() {
  if (!state.running) return;
  const b = state.boss;
  if (b.stunnedTimer > 0) {
    b.hp -= 500000;
    spawnParticles(b.x, b.y, '#ffff44', 30, 6);
    spawnShockwave(b.x, b.y, '#ffff44', 120, 200, 0);
    b.stunnedTimer = 0; b.posture = 0;
    if (b.hp <= 0) { b.hp = 0; endGame(true); }
    return;
  }
  if (b.telegraph) return;
  if (b.perilous) { state.invuln = 0; return; }
  if (b.recoveryTimer > 0 || b.attackTimer > 1.5) {
    b.posture = Math.min(b.maxPosture, b.posture + 18);
    state.invuln = 0.35;
    spawnParticles(state.player.x, state.player.y, '#00ffff', 12, 3);
    if (b.posture >= b.maxPosture) {
      b.stunnedTimer = 3.0; b.posture = 0;
      spawnParticles(b.x, b.y, '#ffff44', 40, 6);
    }
  }
}

// ---------- Boss update ----------
function updateBoss(dt) {
  const b = state.boss;
  const diff = b.diff;
  const p = state.player;
  // phase check
  const ratio = b.hp / b.maxHp;
  let newPhase = ratio > 0.66 ? 1 : (ratio > 0.33 ? 2 : 3);
  if (newPhase !== b.phase) {
    b.phase = newPhase; state.phase = newPhase;
    b.azure = (newPhase === 3);
    spawnParticles(b.x, b.y, b.data.accent, 50, 7);
    spawnShockwave(b.x, b.y, b.data.accent, 120, 120, 0);
  }
  state.phase = b.phase;

  // flying
  if (b.flying) {
    b.flyTimer -= dt;
    b.y = 80 + Math.sin(state.time * 2) * 20;
    if (b.flyTimer <= 0) { b.flying = false; spawnShockwave(b.x, b.y, '#00e5ff', 120, 180, 10); }
  } else {
    b.y += (120 - b.y) * 0.1;
  }

  // movement
  if (!b.flying && b.stunnedTimer <= 0) {
    const dx = p.x - b.x, dy = p.y - b.y;
    const d = Math.hypot(dx, dy);
    if (d > 60) {
      const sp = b.walkSpeed * (b.phase === 3 ? 1.2 : 1) * diff.speed;
      b.x += (dx / d) * sp * dt;
      b.y += (dy / d) * sp * dt;
    }
    if (b.dashTimer > 0) {
      b.dashTimer -= dt;
      const sp = 260 * diff.speed;
      b.x += (dx / (d || 1)) * sp * dt;
      b.y += (dy / (d || 1)) * sp * dt;
      if (b.dashTimer <= 0) spawnShockwave(b.x, b.y, '#00e5ff', 100, 150, 8);
    }
  }

  // telegraph handling
  if (b.stunnedTimer > 0) {
    b.stunnedTimer -= dt;
    if (b.telegraph) { b.telegraph = null; }
  } else if (b.telegraph) {
    b.telegraph.timer -= dt;
    if (b.telegraph.timer <= 0) {
      const id = b.telegraph.id;
      b.telegraph = null;
      executeAttack(id);
      b.recoveryTimer = 0.7;
      b.attackTimer = 1.0;
      if (state.comboQueue.length > 0) state.comboTimer = 0.45;
    }
  } else {
    if (b.recoveryTimer > 0) b.recoveryTimer -= dt;
    if (state.comboQueue.length > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) {
        const next = state.comboQueue.shift();
        const w = b.phase === 1 ? 1.0 : (b.phase === 2 ? 0.8 : 0.6);
        startTelegraph(b, next, b.diff, w);
        state.comboTimer = 99;
      }
    } else {
      b.attackTimer -= dt;
      if (b.attackTimer <= 0) chooseAttack();
    }
  }
  b.attackTimer = b.attackTimer;
}

function chooseAttack() {
  const b = state.boss;
  const diff = b.diff;
  const attacks = getAttackList(b);
  const avail = attacks.filter(a => !a.phase || a.phase.includes(b.phase));
  if (avail.length === 0) return;
  let chosen;
  if (Math.random() < 0.15) {
    const comboLen = 2 + (Math.random() < 0.4 ? 1 : 0);
    const seq = [];
    for (let i = 0; i < comboLen; i++) seq.push(avail[Math.floor(Math.random() * avail.length)].id);
    state.comboQueue = seq.slice(1);
    state.comboTimer = 0.45;
    chosen = seq[0];
    b.dashTimer = 0.4;
  } else {
    chosen = avail[Math.floor(Math.random() * avail.length)].id;
  }
  const windup = b.phase === 1 ? 1.0 : (b.phase === 2 ? 0.8 : 0.6);
  startTelegraph(b, chosen, diff, windup);
}

function startTelegraph(b, id, diff, windup) {
  const w = windup || (b.phase === 1 ? 1.0 : (b.phase === 2 ? 0.8 : 0.6));
  const perilous = /exec|enrage|collapse|overload/.test(id);
  b.perilous = perilous;
  b.telegraph = { id, timer: w, perilous };
  b.attackTimer = 99;
  if (state.time - state.lastDodgeTime < 0.5) b.telegraph.timer += 0.3;
}

function getAttackList(b) { return RIPTIDE_ATTACKS; }
function A(id, name, phase, fn) { return { id, name, phase, fn }; }
const RIPTIDE_ATTACKS = [];

function pushRiptide() {
  const all = [1, 2, 3];
  // aimed shots
  for (let i = 0; i < 8; i++) {
    RIPTIDE_ATTACKS.push(A('aimed' + i, 'Aqua Shot', all, (b, diff) => {
      const n = 1 + (i % 3);
      for (let k = 0; k < n; k++) {
        const p = state.player;
        const dx = p.x - b.x, dy = p.y - b.y;
        const len = Math.hypot(dx, dy) || 1;
        const ang = Math.atan2(dy, dx) + (k - n/2) * 0.12;
        const sp = (12 + i * 0.5) * diff.speed * 8;
        state.bullets.push({ x: b.x, y: b.y, vx: Math.cos(ang)*sp, vy: Math.sin(ang)*sp, owner: 'boss', damage: 1, life: 3, size: 5, color: b.azure ? '#44aaff' : '#2288ff', homing: false });
      }
    }));
  }
  // rings
  for (let r = 1; r <= 4; r++) {
    RIPTIDE_ATTACKS.push(A('ring' + r, 'Aqua Ring', all, (b, diff) => {
      const count = 12 + r * 3;
      const speed = (7 + diff.speed * 1.5 + r) * 8;
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2;
        state.bullets.push({ x: b.x, y: b.y, vx: Math.cos(ang)*speed, vy: Math.sin(ang)*speed, owner: 'boss', damage: 1, life: 3, size: 4, color: b.azure ? '#00aaff' : '#44bbff', homing: false });
      }
    }));
  }
  // spirals
  for (let arms = 3; arms <= 6; arms++) {
    RIPTIDE_ATTACKS.push(A('spiral' + arms, 'Tidal Spiral', all, (b, diff) => {
      const count = 16 + (b.phase - 1) * 4;
      const speed = (9 + diff.speed * 2) * 8;
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2 + state.time * 0.6;
        const r = 0.6 + i * 0.04;
        state.bullets.push({ x: b.x + Math.cos(ang)*r*10, y: b.y + Math.sin(ang)*r*10, vx: Math.cos(ang)*speed, vy: Math.sin(ang)*speed, owner: 'boss', damage: 1, life: 3, size: 4, color: b.azure ? '#66ccff' : '#3399ff', homing: false });
      }
    }));
  }
  // rain
  for (let i = 0; i < 4; i++) {
    RIPTIDE_ATTACKS.push(A('rain' + i, 'Droplet Rain', all, (b, diff) => {
      const count = 14 + i * 3;
      for (let k = 0; k < count; k++) {
        const x = rand(40, W - 40);
        state.bullets.push({ x, y: 0, vx: (Math.random()-0.5)*40, vy: 12 * diff.speed * 8, owner: 'boss', damage: 1, life: 3, size: 4, color: b.azure ? '#88ddff' : '#66ccff', homing: false });
      }
    }));
  }
  // hammer (shockwave)
  for (let i = 0; i < 3; i++) {
    RIPTIDE_ATTACKS.push(A('hammer' + i, 'Aqua Hammer', all, (b, diff) => {
      const count = 13;
      const speed = 10 * diff.speed * 8;
      for (let k = 0; k < count; k++) {
        const ang = (k / (count - 1)) * Math.PI - Math.PI / 2;
        state.bullets.push({ x: b.x + Math.sin(ang)*16, y: b.y + Math.cos(ang)*16, vx: Math.sin(ang)*speed, vy: Math.cos(ang)*speed, owner: 'boss', damage: 2, life: 3, size: 6, color: '#99ddff', homing: false });
      }
      spawnShockwave(b.x, b.y, '#00e5ff', 100, 120, 6);
    }));
  }
  // tsunami
  for (let i = 0; i < 2; i++) {
    RIPTIDE_ATTACKS.push(A('tsunami' + i, 'Tsunami', [2, 3], (b, diff) => {
      const fromLeft = Math.random() > 0.5;
      const count = 18;
      for (let k = 0; k < count; k++) {
        const y = 40 + k * (H / count);
        const x = fromLeft ? 0 : W;
        state.bullets.push({ x, y, vx: (fromLeft ? 1 : -1) * 9 * diff.speed * 8, vy: (Math.random()-0.5)*20, owner: 'boss', damage: 1, life: 4, size: 7, color: b.azure ? '#0088ff' : '#0066cc', homing: false });
      }
    }));
  }
  // azure fireballs phase3
  for (let i = 0; i < 6; i++) {
    RIPTIDE_ATTACKS.push(A('azure' + i, 'Azure Fireball', [3], (b, diff) => {
      const count = 3 + i;
      for (let k = 0; k < count; k++) {
        const ang = Math.random() * Math.PI * 2;
        const speed = (9 + Math.random() * 5) * 8;
        state.bullets.push({ x: b.x + Math.cos(ang)*16, y: b.y + Math.sin(ang)*16, vx: Math.cos(ang)*speed, vy: Math.sin(ang)*speed, owner: 'boss', damage: 2, life: 3, size: 6, color: '#44aaff', homing: false, gravity: -40 });
      }
    }));
  }
  // flight move phase2+
  RIPTIDE_ATTACKS.push(A('flight', 'Flight', [2, 3], (b, diff) => {
    b.flying = true; b.flyTimer = 2.2;
    for (let k = 0; k < 20; k++) {
      const x = rand(40, W - 40);
      state.bullets.push({ x, y: 0, vx: (Math.random()-0.5)*40, vy: 13 * diff.speed * 8, owner: 'boss', damage: 1, life: 3, size: 4, color: '#44aaff', homing: false });
    }
  }));
  // homing droplets
  for (let i = 0; i < 3; i++) {
    RIPTIDE_ATTACKS.push(A('homing' + i, 'Homing Droplet', [2, 3], (b, diff) => {
      const count = 3 + i;
      for (let k = 0; k < count; k++) {
        const ang = Math.random() * Math.PI * 2;
        state.bullets.push({ x: b.x + Math.cos(ang)*20, y: b.y + Math.sin(ang)*20, vx: Math.cos(ang)*50, vy: Math.sin(ang)*50, owner: 'boss', damage: 1, life: 4, size: 5, color: b.azure ? '#44aaff' : '#2288ff', homing: true });
      }
    }));
  }
  // instant death counter phase3
  RIPTIDE_ATTACKS.push(A('exec', 'Riptide Execution', [3], (b, diff) => {
    startInstantDeath(b, diff);
  }));
  // cross current
  for (let i = 0; i < 2; i++) {
    RIPTIDE_ATTACKS.push(A('cross' + i, 'Cross Current', all, (b, diff) => {
      const speed = 11 * diff.speed * 8;
      for (let d of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
        for (let k = 0; k < 5; k++) {
          state.bullets.push({ x: b.x + d.x*k*8, y: b.y + d.y*k*8, vx: d.x*speed, vy: d.y*speed, owner: 'boss', damage: 1, life: 3, size: 4, color: '#66ccff', homing: false });
        }
      }
    }));
  }
  // whirlpools
  for (let i = 0; i < 3; i++) {
    RIPTIDE_ATTACKS.push(A('whirl' + i, 'Whirlpool', [2, 3], (b, diff) => {
      const count = 22;
      for (let k = 0; k < count; k++) {
        const ang = (k / count) * Math.PI * 2;
        const radius = 140;
        const x = b.x + Math.cos(ang) * radius, y = b.y + Math.sin(ang) * radius;
        const vx = -Math.cos(ang)*20 + (-Math.sin(ang))*6*diff.speed*8;
        const vy = -Math.sin(ang)*20 + (Math.cos(ang))*6*diff.speed*8;
        state.bullets.push({ x, y, vx, vy, owner: 'boss', damage: 1, life: 4, size: 4, color: b.azure ? '#0099ff' : '#1177dd', homing: false });
      }
    }));
  }
}
pushRiptide();

function startInstantDeath(b, diff) {
  const sx = rand(80, W - 80), sy = rand(80, H - 80);
  state.safeZone = { x: sx, y: sy, r: 50, timer: 2.2 / diff.speed, diff };
  document.getElementById('infoText').textContent = 'INSTANT DEATH incoming! Get to the GREEN zone!';
}
function executeInstantDeath() {
  const sz = state.safeZone;
  const p = state.player;
  const d = Math.hypot(p.x - sz.x, p.y - sz.y);
  if (d > sz.r) { p.hp = 0; spawnParticles(p.x, p.y, '#ff0000', 40, 6); endGame(false); }
  else { spawnParticles(p.x, p.y, '#00ff88', 20, 4); state.critBuff = 3; }
  state.safeZone = null;
  document.getElementById('infoText').textContent = '';
}

function executeAttack(id) {
  const b = state.boss;
  const diff = b.diff;
  const atk = RIPTIDE_ATTACKS.find(a => a.id === id);
  if (!atk) return;
  try { atk.fn(b, diff); } catch (e) { console.error(e); }
}

// ---------- Bullets update ----------
function updateBullets(dt) {
  const p = state.player;
  const boss = state.boss;
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const bu = state.bullets[i];
    if (bu.gravity) bu.vy += bu.gravity * dt;
    if (bu.homing && bu.owner === 'boss') {
      const dx = p.x - bu.x, dy = p.y - bu.y;
      const len = Math.hypot(dx, dy) || 1;
      const desiredVx = (dx / len) * 120, desiredVy = (dy / len) * 120;
      bu.vx += (desiredVx - bu.vx) * 0.03;
      bu.vy += (desiredVy - bu.vy) * 0.03;
    }
    if (bu.homing && bu.owner === 'player') {
      const dx = boss.x - bu.x, dy = boss.y - bu.y;
      const len = Math.hypot(dx, dy) || 1;
      const desiredVx = (dx / len) * 400, desiredVy = (dy / len) * 400;
      bu.vx += (desiredVx - bu.vx) * 0.05;
      bu.vy += (desiredVy - bu.vy) * 0.05;
    }
    bu.x += bu.vx * dt;
    bu.y += bu.vy * dt;
    bu.life -= dt;
    if (bu.life <= 0 || bu.x < -20 || bu.x > W + 20 || bu.y < -20 || bu.y > H + 20) {
      state.bullets.splice(i, 1); continue;
    }
    if (bu.owner === 'player') {
      const d = Math.hypot(bu.x - boss.x, bu.y - boss.y);
      if (d < 30) {
        let dmg = bu.damage * p.damage;
        if (boss.recoveryTimer > 0) dmg *= 1.5;
        if (Math.random() < p.cls.crit + (state.critBuff > 0 ? 0.2 : 0)) dmg *= p.cls.critMult;
        boss.hp -= dmg;
        spawnParticles(bu.x, bu.y, boss.data.accent, 8, 4);
        state.bullets.splice(i, 1);
        if (boss.hp <= 0) { boss.hp = 0; endGame(true); }
        continue;
      }
    } else {
      if (state.invuln <= 0) {
        const d = Math.hypot(bu.x - p.x, bu.y - p.y);
        if (d < 12) {
          p.hp -= bu.damage;
          spawnParticles(p.x, p.y, '#ff4444', 10, 4);
          state.bullets.splice(i, 1);
          state.shake = 0.35;
          if (p.hp <= 0) { p.hp = 0; endGame(false); }
          continue;
        }
      } else {
        const d = Math.hypot(bu.x - p.x, bu.y - p.y);
        if (d < 12) state.bullets.splice(i, 1);
      }
    }
  }
}

// ---------- HUD ----------
function fmtM(n) { return (n / 1e6).toFixed(2) + 'M'; }
function updateHud() {
  const p = state.player; const b = state.boss;
  if (!p || !b) return;
  document.getElementById('playerHpBar').style.width = (p.hp / p.maxHp * 100) + '%';
  document.getElementById('playerHpText').textContent = Math.ceil(p.hp) + '/' + p.maxHp;
  document.getElementById('bossHpBar').style.width = (b.hp / b.maxHp * 100) + '%';
  document.getElementById('bossHpText').textContent = fmtM(b.hp) + '/' + fmtM(b.maxHp);
  document.getElementById('phaseText').textContent = 'Phase ' + b.phase + (b.phase === 3 ? ' — AZURE ENRAGED' : (b.phase === 2 ? ' — WATER WINGS' : ''));
  const pb = document.getElementById('postureBar');
  if (pb) { pb.style.width = (b.posture / b.maxPosture * 100) + '%'; document.getElementById('postureText').textContent = Math.ceil(b.posture) + '/' + b.maxPosture; }
}

// ---------- Render ----------
function drawBoss(b) {
  const azure = b.azure;
  // body
  ctx.fillStyle = azure ? '#050505' : '#1a4a8a';
  ctx.beginPath(); ctx.ellipse(b.x, b.y, 28, 36, 0, 0, Math.PI * 2); ctx.fill();
  // black helmet
  ctx.fillStyle = '#050505';
  ctx.beginPath(); ctx.ellipse(b.x, b.y - 30, 22, 18, 0, 0, Math.PI * 2); ctx.fill();
  // aqua helmet
  ctx.fillStyle = 'rgba(0,229,255,0.75)';
  ctx.beginPath(); ctx.ellipse(b.x, b.y - 32, 24, 20, 0, 0, Math.PI * 2); ctx.fill();
  // eyes
  ctx.fillStyle = b.phase >= 2 ? '#00ffff' : '#224466';
  ctx.beginPath(); ctx.arc(b.x - 8, b.y - 30, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(b.x + 8, b.y - 30, 4, 0, Math.PI * 2); ctx.fill();
  // hammer
  ctx.strokeStyle = '#88ccff'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(b.x + 20, b.y); ctx.lineTo(b.x + 55, b.y); ctx.stroke();
  ctx.fillStyle = '#00aaff';
  ctx.fillRect(b.x + 50, b.y - 10, 18, 20);
  // water wings phase2
  if (b.phase >= 2) {
    ctx.fillStyle = azure ? 'rgba(68,170,255,0.6)' : 'rgba(34,136,255,0.6)';
    ctx.beginPath(); ctx.moveTo(b.x - 28, b.y - 10); ctx.lineTo(b.x - 60, b.y - 30); ctx.lineTo(b.x - 50, b.y + 10); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(b.x + 28, b.y - 10); ctx.lineTo(b.x + 60, b.y - 30); ctx.lineTo(b.x + 50, b.y + 10); ctx.closePath(); ctx.fill();
  }
  // azure flames phase3
  if (azure) {
    ctx.fillStyle = 'rgba(0,136,255,0.7)';
    ctx.beginPath(); ctx.moveTo(b.x - 12, b.y - 50); ctx.lineTo(b.x, b.y - 80); ctx.lineTo(b.x + 12, b.y - 50); ctx.closePath(); ctx.fill();
  }
  // stunned indicator
  if (b.stunnedTimer > 0) {
    ctx.strokeStyle = '#ffff44'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(b.x, b.y, 45, 0, Math.PI * 2); ctx.stroke();
  }
}

function drawPlayer(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.fillStyle = p.cls.color ? '#' + p.cls.color.toString(16).padStart(6, '0') : '#4af0ff';
  ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-8, -8); ctx.lineTo(-8, 8); ctx.closePath(); ctx.fill();
  ctx.restore();
  if (state.invuln > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, Math.PI * 2); ctx.stroke();
  }
}

function render() {
  ctx.fillStyle = '#03061a';
  ctx.fillRect(0, 0, W, H);
  // grid
  ctx.strokeStyle = 'rgba(26,58,122,0.4)'; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  // safe zone
  if (state.safeZone) {
    const sz = state.safeZone;
    ctx.fillStyle = 'rgba(0,255,136,0.25)';
    ctx.beginPath(); ctx.arc(sz.x, sz.y, sz.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(sz.x, sz.y, sz.r, 0, Math.PI * 2); ctx.stroke();
  }
  // telegraph
  if (state.boss && state.boss.telegraph) {
    const b = state.boss;
    const t = b.telegraph;
    ctx.globalAlpha = 0.4 + Math.sin(state.time * 10) * 0.2;
    ctx.strokeStyle = t.perilous ? '#ff2222' : '#ffaa00';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(b.x, b.y, 50, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // shockwaves
  for (const s of state.shockwaves) {
    ctx.globalAlpha = Math.max(0, s.life / s.max) * 0.8;
    ctx.strokeStyle = s.color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // bullets
  for (const b of state.bullets) {
    ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2); ctx.fill();
  }
  // particles
  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // boss
  if (state.boss) drawBoss(state.boss);
  // player
  if (state.player) drawPlayer(state.player);
}

// ---------- Main loop ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state.running) {
    state.time += dt;
    updatePlayer(dt);
    updateBoss(dt);
    updateBullets(dt);
    updateParticles(dt);
    updateShockwaves(dt);
    if (state.safeZone) {
      state.safeZone.timer -= dt;
      if (state.safeZone.timer <= 0) executeInstantDeath();
    }
    updateHud();
    if (state.shake > 0) state.shake -= dt;
  }
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

window.__state = state;
window.__execAttack = (id) => { try { executeAttack(id); } catch (e) { console.error(e); } };
window.__tryAbility = () => { try { tryAbility(); } catch (e) { console.error(e); } };
window.__tryParry = () => { try { tryParry(); } catch (e) { console.error(e); } };
