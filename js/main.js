import * as THREE from 'three';
import { CLASSES, getClass } from './classes.js';
import { BOSSES, DIFFICULTIES, getBoss, getDiff } from './bosses.js';

const canvas = document.getElementById('gameCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x03061a);
scene.fog = new THREE.FogExp2(0x03061a, 0.018);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 20, 18);
camera.lookAt(0, 0, 0);

const amb = new THREE.AmbientLight(0x3355aa, 0.55);
scene.add(amb);
const dir = new THREE.DirectionalLight(0xaaccff, 0.9);
dir.position.set(8, 24, 6);
dir.castShadow = true;
dir.shadow.mapSize.set(1024, 1024);
dir.shadow.camera.left = -25; dir.shadow.camera.right = 25;
dir.shadow.camera.top = 25; dir.shadow.camera.bottom = -25;
scene.add(dir);
const rim = new THREE.PointLight(0x00e5ff, 1.6, 70);
rim.position.set(0, 10, 0);
scene.add(rim);
const bossLight = new THREE.PointLight(0x2a8aff, 2.0, 40);
bossLight.position.set(0, 6, -12);
scene.add(bossLight);

const floorGeo = new THREE.PlaneGeometry(44, 44, 32, 32);
const floorMat = new THREE.MeshStandardMaterial({ color: 0x06102a, metalness: 0.4, roughness: 0.6, emissive: 0x040a18 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
const grid = new THREE.GridHelper(44, 44, 0x1a3a7a, 0x0a1a3a);
scene.add(grid);

const starGeo = new THREE.BufferGeometry();
const starPos = [];
for (let i = 0; i < 500; i++) starPos.push((Math.random() - 0.5) * 120, Math.random() * 60 + 10, (Math.random() - 0.5) * 120);
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.3 })));

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const state = {
  running: false, paused: false,
  classId: 'hero', bossId: 'riptide', diffId: 'mediocre',
  player: null, boss: null,
  bullets: [], particles: [], shockwaves: [],
  turrets: [],
  score: 0, time: 0, phase: 1,
  bossAttackTimer: 0, bossAttackCooldown: 1.2,
  comboQueue: [], comboTimer: 0,
  instantDeathActive: false, safeZone: null,
  keys: {}, mouse: { x: 0, y: 0, down: false },
  touch: { moveX: 0, moveY: 0, shoot: false },
  abilityCd: 0, phaseTimer: 0, invuln: 0,
  playerFireCd: 0, shake: 0, critBuff: 0
};

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
  state.classId = classSelect.value;
  state.bossId = bossSelect.value;
  state.diffId = diffSelect.value;
  startGame();
});
document.getElementById('overlayBtn').addEventListener('click', () => {
  document.getElementById('overlay').classList.add('hidden');
  if (state.outcome === 'win' || state.outcome === 'lose') {
    cleanupGame();
    document.getElementById('titleScreen').classList.remove('hidden');
    document.getElementById('hud').classList.add('hidden');
  }
});

function rand(a, b) { return a + Math.random() * (b - a); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function mkBullet(pos, vel, color, owner, damage = 1, size = 0.22, homing = false) {
  if (state.bullets.length > 260) return null;
  const geo = new THREE.SphereGeometry(size, 6, 6);
  const mat = new THREE.MeshBasicMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(pos);
  scene.add(mesh);
  const b = { mesh, vel: vel.clone(), owner, damage, life: 5, homing, size, gravity: 0 };
  state.bullets.push(b);
  return b;
}
function removeBullet(b) {
  scene.remove(b.mesh);
  b.mesh.geometry.dispose();
  b.mesh.material.dispose();
  const i = state.bullets.indexOf(b);
  if (i >= 0) state.bullets.splice(i, 1);
}
function spawnParticles(pos, color, count = 10, speed = 3) {
  const n = Math.min(count, 16);
  for (let i = 0; i < n; i++) {
    const geo = new THREE.SphereGeometry(0.1, 5, 5);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(pos);
    scene.add(m);
    const v = new THREE.Vector3((Math.random() - 0.5) * speed, Math.random() * speed, (Math.random() - 0.5) * speed);
    state.particles.push({ mesh: m, vel: v, life: 0.5, max: 0.5 });
  }
}
function updateParticles(dt) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.life -= dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.vel.y -= 5 * dt;
    p.mesh.material.opacity = Math.max(0, p.life / p.max);
    if (p.life <= 0) { scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); state.particles.splice(i, 1); }
  }
}

function makePlayer(cls) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.6, 8), new THREE.MeshStandardMaterial({ color: cls.color, emissive: cls.color, emissiveIntensity: 0.5, metalness: 0.6, roughness: 0.3 }));
  body.rotation.x = Math.PI / 2;
  body.castShadow = true;
  g.add(body);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.6), new THREE.MeshStandardMaterial({ color: 0x223355, metalness: 0.7, roughness: 0.4 }));
  wing.position.z = -0.2;
  g.add(wing);
  const light = new THREE.PointLight(cls.color, 1.0, 6);
  g.add(light);
  g.position.set(0, 0.6, 12);
  scene.add(g);
  return { mesh: g, cls, hp: cls.hp, maxHp: cls.hp, pos: g.position, speed: cls.speed, damage: cls.damage, fireCd: 0, abilityCd: 0, invuln: 0, turretTimer: 0 };
}

function makeBoss(bossData, diff) {
  const g = new THREE.Group();
  const b = { mesh: g, data: bossData, diff, hp: bossData.baseHp * diff.mult, maxHp: bossData.baseHp * diff.mult, phase: 1, pos: g.position, attackTimer: 2, weakPoint: null, azure: false, dashTimer: 0, walkSpeed: 2.2, flying: false, flyTimer: 0, waterWings: null, helmet: null, hammer: null };
  buildBossVisual(b);
  g.position.set(0, 1.5, -10);
  scene.add(g);
  return b;
}

function buildBossVisual(b) {
  b.weakPoint = null; b.hammer = null; b.helmet = null; b.waterWings = null;
  while (b.mesh.children.length) { const c = b.mesh.children[0]; b.mesh.remove(c); if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }
  const phase = b.phase;
  const azure = phase === 3;
  const bodyColor = azure ? 0x050505 : 0x1a4a8a;
  const emissive = azure ? 0x003366 : 0x1a6aff;

  // body
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.1, 1.6, 12, 24), new THREE.MeshStandardMaterial({ color: bodyColor, emissive, emissiveIntensity: 0.5, metalness: 0.5, roughness: 0.4 }));
  body.castShadow = true;
  b.mesh.add(body);

  // head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.85, 20, 20), new THREE.MeshStandardMaterial({ color: azure ? 0x080808 : 0x2a6acc, emissive: emissive, emissiveIntensity: 0.6, metalness: 0.4, roughness: 0.3 }));
  head.position.set(0, 2.0, 0.2);
  head.castShadow = true;
  b.mesh.add(head);

  // aqua helmet
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.95, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.6), new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00aaff, emissiveIntensity: 0.7, metalness: 0.8, roughness: 0.2, transparent: true, opacity: 0.75 }));
  helm.position.set(0, 2.1, 0.2);
  b.mesh.add(helm);
  b.helmet = helm;

  // eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: phase >= 2 ? 0x00ffff : 0x224466 });
  const le = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), eyeMat.clone()); le.position.set(-0.28, 2.15, 0.95); b.mesh.add(le);
  const re = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), eyeMat.clone()); re.position.set(0.28, 2.15, 0.95); b.mesh.add(re);
  if (phase >= 2) {
    const glowL = new THREE.PointLight(0x00ffff, 1.2, 4); glowL.position.copy(le.position); b.mesh.add(glowL);
    const glowR = new THREE.PointLight(0x00ffff, 1.2, 4); glowR.position.copy(re.position); b.mesh.add(glowR);
  }

  // large blue hammer
  const hammerGroup = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.6, 8), new THREE.MeshStandardMaterial({ color: 0x88ccff, metalness: 0.9, roughness: 0.2 }));
  handle.rotation.z = Math.PI / 2;
  hammerGroup.add(handle);
  const head2 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 1.4), new THREE.MeshStandardMaterial({ color: 0x00aaff, emissive: 0x0066cc, emissiveIntensity: 0.6, metalness: 0.7, roughness: 0.25 }));
  head2.position.set(1.3, 0, 0);
  hammerGroup.add(head2);
  hammerGroup.position.set(1.6, 0.6, 0);
  b.mesh.add(hammerGroup);
  b.hammer = hammerGroup;

  // water wings phase 2+
  if (phase >= 2) {
    const wingMat = new THREE.MeshStandardMaterial({ color: azure ? 0x44aaff : 0x2288ff, emissive: azure ? 0x0088ff : 0x0044aa, emissiveIntensity: 0.6, transparent: true, opacity: 0.7, metalness: 0.3, roughness: 0.4, side: THREE.DoubleSide });
    const wg = new THREE.Group();
    const left = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6), wingMat);
    left.position.set(-1.6, 1.2, -0.3);
    left.rotation.y = 0.6;
    wg.add(left);
    const right = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6), wingMat);
    right.position.set(1.6, 1.2, -0.3);
    right.rotation.y = -0.6;
    wg.add(right);
    b.mesh.add(wg);
    b.waterWings = wg;
  }

  if (azure) {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.6, 12), new THREE.MeshBasicMaterial({ color: 0x0088ff, transparent: true, opacity: 0.7 }));
    flame.position.set(0, 3.0, 0);
    b.mesh.add(flame);
    const outline = new THREE.Mesh(new THREE.SphereGeometry(1.9, 16, 16), new THREE.MeshBasicMaterial({ color: 0x00aaff, wireframe: true, transparent: true, opacity: 0.3 }));
    b.mesh.add(outline);
    b.weakPoint = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 12), new THREE.MeshBasicMaterial({ color: 0xff4400 }));
    b.weakPoint.position.set(0, 1.2, 1.7);
    b.mesh.add(b.weakPoint);
  }
  b.mesh.position.set(0, 1.5, -10);
}

// ---------- Input ----------
window.addEventListener('keydown', e => { state.keys[e.key.toLowerCase()] = true; if (e.key === ' ') { e.preventDefault(); tryAbility(); } });
window.addEventListener('keyup', e => { state.keys[e.key.toLowerCase()] = false; });
canvas.addEventListener('mousemove', e => { state.mouse.x = (e.clientX / window.innerWidth) * 2 - 1; state.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1; });
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
  state.bullets = []; state.particles = []; state.shockwaves = []; state.turrets = [];
  state.score = 0; state.abilityCd = 0; state.playerFireCd = 0; state.invuln = 0;
  state.bossAttackTimer = 2; state.comboQueue = []; state.comboTimer = 0;
  state.instantDeathActive = false; state.safeZone = null; state.outcome = null;
  state.critBuff = 0;
  document.getElementById('bossName').textContent = bossData.name.toUpperCase();
  updateHud();
}
function cleanupGame() {
  if (state.player) { scene.remove(state.player.mesh); state.player = null; }
  if (state.boss) { scene.remove(state.boss.mesh); state.boss = null; }
  state.bullets.forEach(b => scene.remove(b.mesh)); state.bullets = [];
  state.particles.forEach(p => scene.remove(p.mesh)); state.particles = [];
  state.shockwaves.forEach(s => scene.remove(s.mesh)); state.shockwaves = [];
  state.turrets.forEach(t => scene.remove(t.mesh)); state.turrets = [];
  if (state.safeZone) { scene.remove(state.safeZone.mesh); state.safeZone = null; }
  state.running = false;
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
  p.pos.x = clamp(p.pos.x + mx * speed * dt, -20, 20);
  p.pos.z = clamp(p.pos.z + my * speed * dt, -20, 20);
  p.pos.y = 0.6;
  if (mag > 0) p.mesh.rotation.y = Math.atan2(mx, my);

  p.fireCd -= dt;
  const shooting = state.mouse.down || state.touch.shoot;
  if (shooting && p.fireCd <= 0) { p.fireCd = cls.fireRate; firePlayer(p); }

  p.abilityCd = Math.max(0, p.abilityCd - dt);
  state.abilityCd = p.abilityCd;
  state.invuln = Math.max(0, state.invuln - dt);
  state.critBuff = Math.max(0, state.critBuff - dt);
  p.mesh.visible = !(state.invuln > 0 && Math.floor(state.time * 12) % 2 === 0);
}
function firePlayer(p) {
  const cls = p.cls;
  const boss = state.boss;
  const dir = new THREE.Vector3().subVectors(boss.pos, p.pos).normalize();
  const spread = 0.04;
  const d = dir.clone().add(new THREE.Vector3((Math.random() - 0.5) * spread, 0, (Math.random() - 0.5) * spread)).normalize();
  const b = mkBullet(p.pos.clone().add(new THREE.Vector3(0, 0.5, 0)), d.multiplyScalar(24), cls.color, 'player', cls.damage, 0.2, cls.homing);
  if (b && cls.id === 'hero') {
    // occasional second shot
    if (Math.random() < 0.25) {
      const d2 = dir.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.12, 0, (Math.random() - 0.5) * 0.12)).normalize();
      mkBullet(p.pos.clone().add(new THREE.Vector3(0, 0.5, 0)), d2.multiplyScalar(24), cls.color, 'player', cls.damage * 0.6, 0.16, cls.homing);
    }
  }
}
function tryAbility() {
  if (!state.running) return;
  const p = state.player;
  const cls = p.cls;
  if (p.abilityCd > 0) return;
  p.abilityCd = cls.abilityCd;
  if (cls.ability === 'dash') {
    let dx = 0, dz = -1;
    if (state.keys['a']) dx = -1; if (state.keys['d']) dx = 1;
    if (state.keys['w']) dz = -1; if (state.keys['s']) dz = 1;
    const mag = Math.hypot(dx, dz) || 1;
    p.pos.x = clamp(p.pos.x + (dx / mag) * 7, -20, 20);
    p.pos.z = clamp(p.pos.z + (dz / mag) * 7, -20, 20);
    state.invuln = 0.3;
    spawnParticles(p.pos, cls.color, 18, 4);
    spawnShockwave(p.pos, cls.color, 4, 8, 0);
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
    b.phase = newPhase;
    state.phase = newPhase;
    b.azure = (newPhase === 3);
    buildBossVisual(b);
    spawnParticles(b.pos, b.data.accent, 50, 7);
    spawnShockwave(b.pos, b.data.accent, 12, 8, 0);
  }
  state.phase = b.phase;

  // flying
  if (b.flying) {
    b.flyTimer -= dt;
    b.mesh.position.y = 4 + Math.sin(state.time * 2) * 0.6;
    if (b.flyTimer <= 0) { b.flying = false; spawnShockwave(b.pos, 0x00e5ff, 10, 10, 80000); }
  } else {
    b.mesh.position.y += (1.5 - b.mesh.position.y) * 0.1;
  }

  // movement: walk toward player
  if (!b.flying) {
    const dx = p.pos.x - b.pos.x;
    const dz = p.pos.z - b.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 2.5) {
      const sp = b.walkSpeed * (b.phase === 3 ? 1.2 : 1) * diff.speed;
      b.pos.x += (dx / d) * sp * dt;
      b.pos.z += (dz / d) * sp * dt;
    }
    // dash for combo extender
    if (b.dashTimer > 0) {
      b.dashTimer -= dt;
      const sp = 14 * diff.speed;
      b.pos.x += (dx / (d || 1)) * sp * dt;
      b.pos.z += (dz / (d || 1)) * sp * dt;
      if (b.dashTimer <= 0) spawnShockwave(b.pos, 0x00e5ff, 8, 9, 60000);
    }
  }

  // hammer swing
  if (b.hammer) b.hammer.rotation.z = Math.sin(state.time * 2.5) * 0.7;
  if (b.waterWings) b.waterWings.rotation.y = Math.sin(state.time * 1.5) * 0.25;

  // attack timer
  b.attackTimer -= dt;
  if (state.comboQueue.length > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) {
      const next = state.comboQueue.shift();
      executeAttack(next);
      state.comboTimer = 0.45;
      // combo extender dash
      b.dashTimer = 0.35;
    }
  } else {
    if (b.attackTimer <= 0) chooseAttack();
  }

  // safe zone
  if (state.safeZone) {
    state.safeZone.timer -= dt;
    state.safeZone.mesh.scale.setScalar(1 + Math.sin(state.time * 8) * 0.05);
    if (state.safeZone.timer <= 0) executeInstantDeath();
  }

  // turrets life
  for (let i = state.turrets.length - 1; i >= 0; i--) {
    const t = state.turrets[i];
    t.life -= dt;
    if (t.life <= 0) { scene.remove(t.mesh); state.turrets.splice(i, 1); }
  }
  if (b.weakPoint) b.weakPoint.material.opacity = 0.5 + Math.sin(state.time * 6) * 0.5;
}

function chooseAttack() {
  const b = state.boss;
  const diff = b.diff;
  const attacks = getAttackList(b);
  const avail = attacks.filter(a => !a.phase || a.phase.includes(b.phase));
  if (avail.length === 0) return;
  // rare combo
  if (Math.random() < 0.15) {
    const comboLen = 2 + (Math.random() < 0.4 ? 1 : 0);
    const seq = [];
    for (let i = 0; i < comboLen; i++) seq.push(avail[Math.floor(Math.random() * avail.length)].id);
    state.comboQueue = seq.slice(1);
    state.comboTimer = 0;
    executeAttack(seq[0]);
    b.dashTimer = 0.4;
  } else {
    const a = avail[Math.floor(Math.random() * avail.length)];
    executeAttack(a.id);
  }
  const baseCd = 0.85 / diff.speed;
  b.attackTimer = (0.7 + Math.random() * 0.5) * (1 / diff.speed);
  if (b.phase === 3) b.attackTimer *= 0.7;
}

function getAttackList(b) {
  return RIPTIDE_ATTACKS;
}

function A(id, name, phase, fn) { return { id, name, phase, fn }; }
const RIPTIDE_ATTACKS = [];

function pushRiptide() {
  const all = [1, 2, 3];
  // aimed shots
  for (let i = 0; i < 8; i++) {
    RIPTIDE_ATTACKS.push(A('aimed' + i, 'Aqua Shot', all, (b, diff) => {
      const col = b.azure ? 0x44aaff : 0x2288ff;
      const n = 1 + (i % 3);
      for (let k = 0; k < n; k++) {
        const dir = new THREE.Vector3().subVectors(state.player.pos, b.pos).normalize();
        const spread = (k - n / 2) * 0.12;
        const d = dir.clone().add(new THREE.Vector3(spread, 0, spread * 0.5)).normalize();
        mkBullet(b.pos.clone(), d.multiplyScalar((12 + i * 0.5) * diff.speed), col, 'boss', 1, 0.22);
      }
    }));
  }
  // spirals
  for (let arms = 3; arms <= 6; arms++) {
    RIPTIDE_ATTACKS.push(A('spiral' + arms, 'Tidal Spiral', all, (b, diff) => {
      const col = b.azure ? 0x66ccff : 0x3399ff;
      const count = 16 + (b.phase - 1) * 4;
      const speed = 9 + diff.speed * 2;
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2 + state.time * 0.6;
        const v = new THREE.Vector3(Math.cos(ang) * speed, 0, Math.sin(ang) * speed);
        const r = 0.6 + i * 0.04;
        mkBullet(b.pos.clone().add(new THREE.Vector3(Math.cos(ang) * r, 0, Math.sin(ang) * r)), v, col, 'boss', 1, 0.18);
      }
    }));
  }
  // rings
  for (let r = 1; r <= 4; r++) {
    RIPTIDE_ATTACKS.push(A('ring' + r, 'Aqua Ring', all, (b, diff) => {
      const col = b.azure ? 0x00aaff : 0x44bbff;
      const count = 12 + r * 3;
      const speed = 7 + diff.speed * 1.5 + r;
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2;
        mkBullet(b.pos.clone(), new THREE.Vector3(Math.cos(ang) * speed, 0, Math.sin(ang) * speed), col, 'boss', 1, 0.2);
      }
    }));
  }
  // walls
  for (let o = 0; o < 4; o++) {
    RIPTIDE_ATTACKS.push(A('wall' + o, 'Tidal Wall', [1, 2, 3], (b, diff) => {
      const col = b.azure ? 0x55bbff : 0x2299ee;
      const count = 9;
      const speed = 9 * diff.speed;
      const vertical = o % 2 === 0;
      for (let i = 0; i < count; i++) {
        const spread = (i - count / 2) * 1.1;
        if (vertical) {
          mkBullet(b.pos.clone().add(new THREE.Vector3(spread, 0, 0)), new THREE.Vector3(0, 0, speed), col, 'boss', 1, 0.22);
        } else {
          mkBullet(b.pos.clone().add(new THREE.Vector3(0, 0, spread)), new THREE.Vector3(speed, 0, 0), col, 'boss', 1, 0.22);
        }
      }
    }));
  }
  // rain
  for (let i = 0; i < 4; i++) {
    RIPTIDE_ATTACKS.push(A('rain' + i, 'Droplet Rain', all, (b, diff) => {
      const col = b.azure ? 0x88ddff : 0x66ccff;
      const count = 14 + i * 3;
      for (let k = 0; k < count; k++) {
        const x = rand(-16, 16), z = rand(-16, 16);
        mkBullet(new THREE.Vector3(x, 12, z), new THREE.Vector3(0, -12 * diff.speed, 0), col, 'boss', 1, 0.18);
      }
    }));
  }
  // whirlpools
  for (let i = 0; i < 3; i++) {
    RIPTIDE_ATTACKS.push(A('whirl' + i, 'Whirlpool', [2, 3], (b, diff) => {
      const col = b.azure ? 0x0099ff : 0x1177dd;
      const count = 22;
      for (let k = 0; k < count; k++) {
        const ang = (k / count) * Math.PI * 2;
        const radius = 14;
        const x = Math.cos(ang) * radius, z = Math.sin(ang) * radius;
        const v = new THREE.Vector3(-Math.cos(ang), 0, -Math.sin(ang)).multiplyScalar(2)
          .add(new THREE.Vector3(-Math.sin(ang), 0, Math.cos(ang)).multiplyScalar(6 * diff.speed));
        mkBullet(new THREE.Vector3(x, 0.6, z), v, col, 'boss', 1, 0.2);
      }
    }));
  }
  // hammer swings (shockwave)
  for (let i = 0; i < 3; i++) {
    RIPTIDE_ATTACKS.push(A('hammer' + i, 'Aqua Hammer', all, (b, diff) => {
      const col = 0x99ddff;
      const count = 13;
      const speed = 10 * diff.speed;
      for (let k = 0; k < count; k++) {
        const ang = (k / (count - 1)) * Math.PI - Math.PI / 2;
        const v = new THREE.Vector3(Math.sin(ang) * speed, 0, Math.cos(ang) * speed);
        const pos = b.pos.clone().add(new THREE.Vector3(Math.sin(ang) * 1.6, 0, Math.cos(ang) * 1.6));
        mkBullet(pos, v, col, 'boss', 2, 0.28);
      }
      spawnShockwave(b.pos, 0x00e5ff, 9, 7, 50000);
    }));
  }
  // tsunami
  for (let i = 0; i < 2; i++) {
    RIPTIDE_ATTACKS.push(A('tsunami' + i, 'Tsunami', [2, 3], (b, diff) => {
      const col = b.azure ? 0x0088ff : 0x0066cc;
      const fromLeft = Math.random() > 0.5;
      const count = 18;
      for (let k = 0; k < count; k++) {
        const z = -16 + k * 1.8;
        const x = fromLeft ? -18 : 18;
        const pos = new THREE.Vector3(x, 0.6, z);
        const v = new THREE.Vector3(fromLeft ? 1 : -1, 0, (Math.random() - 0.5) * 2).multiplyScalar(9 * diff.speed);
        mkBullet(pos, v, col, 'boss', 1, 0.32);
      }
    }));
  }
  // azure fireballs phase3
  for (let i = 0; i < 6; i++) {
    RIPTIDE_ATTACKS.push(A('azure' + i, 'Azure Fireball', [3], (b, diff) => {
      const col = 0x44aaff;
      const count = 3 + i;
      for (let k = 0; k < count; k++) {
        const ang = Math.random() * Math.PI * 2;
        const speed = 9 + Math.random() * 5;
        const pos = b.pos.clone().add(new THREE.Vector3(Math.cos(ang) * 1.5, 0, Math.sin(ang) * 1.5));
        const v = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang)).multiplyScalar(speed * diff.speed);
        v.y = 2.5 + Math.random() * 2.5;
        const fb = mkBullet(pos, v, col, 'boss', 2, 0.3);
        if (fb) fb.gravity = -7;
      }
    }));
  }
  // flight move phase2+
  RIPTIDE_ATTACKS.push(A('flight', 'Flight', [2, 3], (b, diff) => {
    b.flying = true; b.flyTimer = 2.2;
    // rain from above
    for (let k = 0; k < 20; k++) {
      const x = rand(-16, 16), z = rand(-16, 16);
      mkBullet(new THREE.Vector3(x, 14, z), new THREE.Vector3((Math.random() - 0.5) * 2, -13 * diff.speed, (Math.random() - 0.5) * 2), 0x44aaff, 'boss', 1, 0.2);
    }
  }));
  // homing droplets
  for (let i = 0; i < 3; i++) {
    RIPTIDE_ATTACKS.push(A('homing' + i, 'Homing Droplet', [2, 3], (b, diff) => {
      const col = b.azure ? 0x44aaff : 0x2288ff;
      const count = 3 + i;
      for (let k = 0; k < count; k++) {
        const ang = Math.random() * Math.PI * 2;
        const pos = b.pos.clone().add(new THREE.Vector3(Math.cos(ang) * 2, 0, Math.sin(ang) * 2));
        const v = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang)).multiplyScalar(6);
        const hb = mkBullet(pos, v, col, 'boss', 1, 0.24, true);
        if (hb) hb.homing = true;
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
      const col = 0x66ccff;
      const speed = 11 * diff.speed;
      for (let d of [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }]) {
        for (let k = 0; k < 5; k++) {
          const pos = b.pos.clone().add(new THREE.Vector3(d.x * k * 0.8, 0, d.z * k * 0.8));
          mkBullet(pos, new THREE.Vector3(d.x, 0, d.z).multiplyScalar(speed), col, 'boss', 1, 0.2);
        }
      }
    }));
  }
}
pushRiptide();

function startInstantDeath(b, diff) {
  const sx = rand(-8, 8), sz = rand(-8, 8);
  const geo = new THREE.CircleGeometry(3.5, 32);
  const mat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(sx, 0.05, sz);
  scene.add(mesh);
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.3, 3.6, 32), new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(sx, 0.06, sz);
  mesh.add(ring);
  state.safeZone = { mesh, ring, x: sx, z: sz, timer: 2.2 / diff.speed, diff };
  document.getElementById('infoText').textContent = 'INSTANT DEATH incoming! Get to the GREEN zone!';
}
function executeInstantDeath() {
  const sz = state.safeZone;
  const p = state.player;
  const d = Math.hypot(p.pos.x - sz.x, p.pos.z - sz.z);
  if (d > 3.5) {
    p.hp = 0;
    spawnParticles(p.pos, 0xff0000, 40, 6);
    endGame(false);
  } else {
    spawnParticles(p.pos, 0x00ff88, 20, 4);
    state.critBuff = 3;
  }
  scene.remove(sz.mesh);
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

const _v = new THREE.Vector3();
// ---------- Bullets update ----------
function updateBullets(dt) {
  const p = state.player;
  const boss = state.boss;
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const bu = state.bullets[i];
    if (bu.gravity) bu.vel.y += bu.gravity * dt;
    if (bu.homing && bu.owner === 'boss') {
      const desired = new THREE.Vector3().subVectors(p.pos, bu.mesh.position).normalize().multiplyScalar(9);
      bu.vel.lerp(desired, 0.025);
      const sp = bu.vel.length(); const ts = 9 * (boss.diff ? boss.diff.speed : 1);
      if (sp > 0) bu.vel.multiplyScalar(ts / sp);
    }
    bu.mesh.position.addScaledVector(bu.vel, dt);
    bu.life -= dt;
    const pos = bu.mesh.position;
    if (bu.life <= 0 || Math.abs(pos.x) > 26 || Math.abs(pos.z) > 26 || pos.y < -3 || pos.y > 22) {
      removeBullet(bu); continue;
    }
    if (bu.owner === 'player') {
      const d = pos.distanceTo(boss.pos);
      if (d < 2.2) {
        let dmg = bu.damage * p.damage;
        if (boss.weakPoint) {
          const wd = pos.distanceTo(boss.weakPoint.getWorldPosition(_v));
          if (wd < 1.1) dmg *= 2.8;
        }
        if (Math.random() < p.cls.crit + (state.critBuff > 0 ? 0.2 : 0)) dmg *= p.cls.critMult;
        boss.hp -= dmg;
        spawnParticles(pos, boss.data.accent, 8, 4);
        removeBullet(bu);
        if (boss.hp <= 0) { boss.hp = 0; endGame(true); }
        continue;
      }
    } else {
      if (state.invuln <= 0) {
        const d = pos.distanceTo(p.pos);
        if (d < 0.85) {
          p.hp -= bu.damage;
          spawnParticles(p.pos, 0xff4444, 10, 4);
          removeBullet(bu);
          state.shake = 0.35;
          if (p.hp <= 0) { p.hp = 0; endGame(false); }
          continue;
        }
      } else {
        const d = pos.distanceTo(p.pos);
        if (d < 0.9) removeBullet(bu);
      }
    }
  }
}

// ---------- Shockwaves ----------
function spawnShockwave(pos, color, maxR = 8, speed = 6, dmg = 0) {
  const geo = new THREE.RingGeometry(0.5, 1.0, 48);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(pos.x, 0.1, pos.z);
  scene.add(m);
  state.shockwaves.push({ mesh: m, r: 0.5, maxR, speed, dmg, life: 1.2, max: 1.2 });
}
function updateShockwaves(dt) {
  const p = state.player;
  for (let i = state.shockwaves.length - 1; i >= 0; i--) {
    const s = state.shockwaves[i];
    s.r += s.speed * dt;
    s.life -= dt;
    s.mesh.scale.set(s.r, s.r, 1);
    s.mesh.material.opacity = Math.max(0, s.life / s.max) * 0.8;
    if (s.dmg > 0 && state.invuln <= 0) {
      const d = Math.hypot(p.pos.x - s.mesh.position.x, p.pos.z - s.mesh.position.z);
      if (Math.abs(d - s.r) < 0.9) {
        p.hp -= s.dmg;
        spawnParticles(p.pos, 0xff4444, 8, 3);
        state.shake = 0.3;
        if (p.hp <= 0) { p.hp = 0; endGame(false); }
        s.dmg = 0;
      }
    }
    if (s.life <= 0 || s.r > s.maxR) { scene.remove(s.mesh); s.mesh.geometry.dispose(); s.mesh.material.dispose(); state.shockwaves.splice(i, 1); }
  }
}

function fmtM(n) { return (n / 1e6).toFixed(2) + 'M'; }
function updateHud() {
  const p = state.player; const b = state.boss;
  if (!p || !b) return;
  document.getElementById('playerHpBar').style.width = (p.hp / p.maxHp * 100) + '%';
  document.getElementById('playerHpText').textContent = Math.ceil(p.hp).toLocaleString() + '/' + p.maxHp.toLocaleString();
  document.getElementById('bossHpBar').style.width = (b.hp / b.maxHp * 100) + '%';
  document.getElementById('bossHpText').textContent = fmtM(b.hp) + '/' + fmtM(b.maxHp);
  document.getElementById('phaseText').textContent = 'Phase ' + b.phase + (b.phase === 3 ? ' — AZURE ENRAGED' : (b.phase === 2 ? ' — WATER WINGS' : ''));
}

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
    updateHud();
    if (state.shake > 0) {
      state.shake -= dt;
      camera.position.x = (Math.random() - 0.5) * state.shake * 0.6;
      camera.position.z = 18 + (Math.random() - 0.5) * state.shake * 0.6;
    } else {
      camera.position.x += (0 - camera.position.x) * 0.1;
      camera.position.z += (18 - camera.position.z) * 0.1;
    }
    camera.lookAt(0, 0.5, 0);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

window.__state = state;
window.__execAttack = (id) => { try { executeAttack(id); } catch (e) { console.error(e); } };
window.__tryAbility = () => { try { tryAbility(); } catch (e) { console.error(e); } };
