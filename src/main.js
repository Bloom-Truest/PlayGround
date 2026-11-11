import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { World } from './world.js';
import { Player } from './player.js';
import { EnemyManager } from './enemy.js';
import { Combat } from './combat.js';
import { UI } from './ui.js';
import { Input } from './input.js';
import { Effects } from './effects.js';
import { AudioSys } from './audio.js';

const canvas = document.createElement('canvas');
document.getElementById('game').appendChild(canvas);

const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x050a18, 0.022);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 300);
camera.position.set(0, 8, 12);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.7, 0.4, 0.85);
composer.addPass(bloom);
composer.addPass(new OutputPass());

let selectedRace = 'soulreaper';
const world = new World(scene);
const effects = new Effects(scene);
const audio = new AudioSys();
const input = new Input();
const player = new Player(scene, camera, input, audio, effects);
player.race = selectedRace;
player.applyRace();
effects.player = player;
const enemies = new EnemyManager(scene, player, audio, effects);
const combat = new Combat(player, enemies, effects, audio);
const ui = new UI(player, enemies);

let state = 'menu'; // menu | playing | paused | dead
let lastTime = performance.now();
let wave = 1;
let xp = 0, level = 1, xpNeed = 100, talentPoints = 0;

player.onLevelUp = () => { level++; talentPoints++; xpNeed = Math.floor(xpNeed*1.35); ui.toast('Level Up!'); audio.play('level'); };

function applyLevelStats() {
  player.maxHp = 100 + (level-1)*15;
  player.maxStamina = 100 + (level-1)*5;
  player.maxMana = 60 + (level-1)*10;
  if (player.hp > player.maxHp) player.hp = player.maxHp;
}

player.applyLevelStats = applyLevelStats;

function startGame() {
  state = 'playing';
  document.getElementById('mainMenu').classList.add('hidden');
  document.getElementById('deathMenu').classList.add('hidden');
  document.getElementById('pauseMenu').classList.add('hidden');
  resetRun();
  input.requestPointerLock();
}

function resetRun() {
  level = 1; xp = 0; xpNeed = 100; talentPoints = 0; wave = 1;
  player.reset();
  player.race = selectedRace;
  player.applyRace();
  applyLevelStats();
  player.hp = player.maxHp; player.stamina = player.maxStamina; player.mana = player.maxMana;
  enemies.clear();
  enemies.spawnWave(wave);
  ui.update();
}

function gameOver() {
  state = 'dead';
  document.exitPointerLock?.();
  document.getElementById('deathMenu').classList.remove('hidden');
  audio.play('death');
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloom.resolution.set(window.innerWidth, window.innerHeight);
});

// Race selection
document.querySelectorAll('.raceBtn').forEach(b => {
  b.addEventListener('click', () => {
    selectedRace = b.dataset.race;
    document.querySelectorAll('.raceBtn').forEach(x => x.style.borderColor = 'rgba(255,255,255,.25)');
    b.style.borderColor = '#f1c40f';
  });
});
const defaultRaceBtn = document.querySelector('.raceBtn[data-race="soulreaper"]');
if (defaultRaceBtn) defaultRaceBtn.style.borderColor = '#f1c40f';

// Menu buttons
document.getElementById('playBtn').addEventListener('click', startGame);
document.getElementById('respawnBtn').addEventListener('click', () => { startGame(); });
document.getElementById('quitBtn').addEventListener('click', () => {
  state = 'menu';
  document.getElementById('pauseMenu').classList.add('hidden');
  document.getElementById('mainMenu').classList.remove('hidden');
  document.exitPointerLock?.();
  enemies.clear();
});
document.getElementById('resumeBtn').addEventListener('click', () => {
  state = 'playing';
  document.getElementById('pauseMenu').classList.add('hidden');
  input.requestPointerLock();
});

// Talent buttons
document.querySelectorAll('[data-talent]').forEach(b => {
  b.addEventListener('click', () => {
    if (talentPoints <= 0) { ui.toast('No talent points'); return; }
    const t = b.dataset.talent;
    if (t === 'vitality') { player.talents.vitality++; player.maxHp += 20; player.hp = Math.min(player.hp+20, player.maxHp); }
    if (t === 'strength') { player.talents.strength++; player.damage += 5; }
    if (t === 'arcane') { player.talents.arcane++; player.maxMana += 20; player.mana = Math.min(player.mana+20, player.maxMana); }
    talentPoints--;
    ui.update();
    ui.toast('Talent learned');
  });
});

// Hotbar
document.querySelectorAll('.slot').forEach(s => {
  s.addEventListener('click', () => {
    const i = +s.dataset.slot;
    player.selectSlot(i);
    document.querySelectorAll('.slot').forEach(x=>x.classList.remove('active'));
    s.classList.add('active');
  });
});

input.on('pause', () => {
  if (state === 'playing') { state = 'paused'; document.exitPointerLock?.(); document.getElementById('pauseMenu').classList.remove('hidden'); }
  else if (state === 'paused') { state = 'playing'; document.getElementById('pauseMenu').classList.add('hidden'); input.requestPointerLock(); }
});

function loop(now) {
  const dt = Math.min(0.05, (now - lastTime)/1000);
  lastTime = now;
  if (state === 'playing') {
    player.update(dt);
    enemies.update(dt);
    combat.update(dt);
    // XP / level
    if (player.pendingXp > 0) {
      xp += player.pendingXp; player.pendingXp = 0;
      while (xp >= xpNeed) { xp -= xpNeed; player.onLevelUp(); applyLevelStats(); }
    }
    // wave progression
    if (enemies.count() === 0) {
      wave++;
      enemies.spawnWave(wave);
      ui.toast('Wave ' + wave);
    }
    if (player.hp <= 0 && state === 'playing') gameOver();
  }
  world.update(dt);
  effects.update(dt);
  player._level = level;
  player._xp = xp;
  player._xpNeed = xpNeed;
  window._wave = wave;
  window._talentPoints = talentPoints;
  ui.update();
  // camera follow
  player.updateCamera(camera);
  composer.render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Expose for debugging
window.game = { state: () => state, player, enemies };

export { state };
