import * as THREE from 'three';
import { CLASSES, getClass } from './classes.js';
import { BOSSES, DIFFICULTIES, getBoss, getDiff } from './bosses.js';

const canvas = document.getElementById('gameCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060f);
scene.fog = new THREE.Fog(0x05060f, 30, 80);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth/window.innerHeight, 0.1, 200);
camera.position.set(0, 18, 16);
camera.lookAt(0,0,0);

// lights
const amb = new THREE.AmbientLight(0x4466aa, 0.6);
scene.add(amb);
const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(5,20,5);
dir.castShadow = true;
scene.add(dir);
const rim = new THREE.PointLight(0x4488ff, 1.2, 60);
rim.position.set(0,8,0);
scene.add(rim);

// arena floor
const floorGeo = new THREE.PlaneGeometry(40,40,20,20);
const floorMat = new THREE.MeshStandardMaterial({ color:0x0a1228, metalness:0.3, roughness:0.7, emissive:0x050a18 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI/2;
floor.receiveShadow = true;
scene.add(floor);
const grid = new THREE.GridHelper(40,40,0x2244aa,0x112244);
scene.add(grid);

// stars
const starGeo = new THREE.BufferGeometry();
const starPos = [];
for(let i=0;i<600;i++){ starPos.push((Math.random()-0.5)*120, Math.random()*60+10, (Math.random()-0.5)*120); }
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos,3));
const starMat = new THREE.PointsMaterial({ color:0xffffff, size:0.3 });
scene.add(new THREE.Points(starGeo, starMat));

window.addEventListener('resize', ()=>{
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- State ----------
const state = {
  running:false,
  paused:false,
  classId:'striker',
  bossId:'riptide',
  diffId:'mediocre',
  player:null,
  boss:null,
  bullets:[], // all bullets {mesh, vel, owner, damage, life, homing?}
  particles:[],
  turrets:[],
  score:0,
  time:0,
  phase:1,
  bossAttackTimer:0,
  bossAttackCooldown:1.2,
  comboQueue:[],
  comboTimer:0,
  instantDeathActive:false,
  safeZone:null,
  keys:{},
  mouse:{x:0,y:0,down:false},
  touch:{moveX:0,moveY:0,shoot:false},
  abilityCd:0,
  phaseTimer:0,
  invuln:0,
  playerFireCd:0,
  shake:0
};

// ---------- UI wiring ----------
const classSelect = document.getElementById('classSelect');
const bossSelect = document.getElementById('bossSelect');
const diffSelect = document.getElementById('diffSelect');
const classDesc = document.getElementById('classDesc');

CLASSES.forEach(c=>{ const o=document.createElement('option'); o.value=c.id; o.textContent=c.name; classSelect.appendChild(o); });
BOSSES.forEach(b=>{ const o=document.createElement('option'); o.value=b.id; o.textContent=b.name; bossSelect.appendChild(o); });
DIFFICULTIES.forEach(d=>{ const o=document.createElement('option'); o.value=d.id; o.textContent=d.name; diffSelect.appendChild(o); });

classSelect.value='striker';
bossSelect.value='riptide';
diffSelect.value='mediocre';

function updateDesc(){ const c=getClass(classSelect.value); classDesc.textContent=c.desc; }
classSelect.addEventListener('change', updateDesc);
updateDesc();

document.getElementById('startBtn').addEventListener('click', ()=>{
  state.classId = classSelect.value;
  state.bossId = bossSelect.value;
  state.diffId = diffSelect.value;
  startGame();
});

document.getElementById('overlayBtn').addEventListener('click', ()=>{
  document.getElementById('overlay').classList.add('hidden');
  if(state.outcome==='win' || state.outcome==='lose'){
    // back to title
    cleanupGame();
    document.getElementById('titleScreen').classList.remove('hidden');
    document.getElementById('hud').classList.add('hidden');
  }
});

// ---------- Helpers ----------
function rand(a,b){ return a + Math.random()*(b-a); }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function dist(a,b){ return Math.hypot(a.x-b.x, a.z-b.z); }

function mkBullet(pos, vel, color, owner, damage=1, size=0.25, homing=false){
  const geo = new THREE.SphereGeometry(size,8,8);
  const mat = new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.95 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(pos);
  // glow
  const glow = new THREE.PointLight(color, 0.6, 4);
  mesh.add(glow);
  scene.add(mesh);
  const b = { mesh, vel:vel.clone(), owner, damage, life:6, homing, target:null, size };
  state.bullets.push(b);
  return b;
}

function removeBullet(b){
  scene.remove(b.mesh);
  b.mesh.geometry.dispose();
  b.mesh.material.dispose();
  const i = state.bullets.indexOf(b);
  if(i>=0) state.bullets.splice(i,1);
}

function spawnParticles(pos, color, count=12, speed=3){
  for(let i=0;i<count;i++){
    const geo = new THREE.SphereGeometry(0.12,6,6);
    const mat = new THREE.MeshBasicMaterial({ color, transparent:true, opacity:1 });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(pos);
    scene.add(m);
    const v = new THREE.Vector3((Math.random()-0.5)*speed, Math.random()*speed, (Math.random()-0.5)*speed);
    state.particles.push({mesh:m, vel:v, life:0.6, max:0.6});
  }
}

function updateParticles(dt){
  for(let i=state.particles.length-1;i>=0;i--){
    const p = state.particles[i];
    p.life -= dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.vel.y -= 4*dt;
    p.mesh.material.opacity = Math.max(0, p.life/p.max);
    if(p.life<=0){ scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); state.particles.splice(i,1); }
  }
}

function makePlayer(cls){
  const g = new THREE.Group();
  // ship body
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.6,1.6,8), new THREE.MeshStandardMaterial({color:cls.color, emissive:cls.color, emissiveIntensity:0.4, metalness:0.6, roughness:0.3}));
  body.rotation.x = Math.PI/2;
  body.castShadow = true;
  g.add(body);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2.2,0.15,0.6), new THREE.MeshStandardMaterial({color:0x223355, metalness:0.7, roughness:0.4}));
  wing.position.z = -0.2;
  g.add(wing);
  const light = new THREE.PointLight(cls.color, 1.2, 6);
  g.add(light);
  g.position.set(0,0.6,12);
  scene.add(g);
  return {
    mesh:g, cls, hp:cls.hp, maxHp:cls.hp, pos:g.position,
    speed:cls.speed, damage:cls.damage, fireCd:0, abilityCd:0, invuln:0, turretTimer:0
  };
}

function makeBoss(bossData, diff){
  const g = new THREE.Group();
  // placeholder built per boss
  const b = { mesh:g, data:bossData, diff, hp:bossData.baseHp*diff.mult, maxHp:bossData.baseHp*diff.mult, phase:1, pos:g.position, attackTimer:1.5, currentAttack:null, chargeProgress:0, weakPoint:null, azure:false };
  buildBossVisual(b);
  g.position.set(0,0,-12);
  scene.add(g);
  return b;
}

function buildBossVisual(b){
  b.weakPoint = null;
  b.hammer = null; b.eyes = null; b.flame = null; b.ring = null;
  // clear
  while(b.mesh.children.length) { const c=b.mesh.children[0]; b.mesh.remove(c); if(c.geometry) c.geometry.dispose(); if(c.material) c.material.dispose(); }
  const d = b.data;
  const color = d.color;
  if(b.data.id==='riptide'){
    // body
    const body = new THREE.Mesh(new THREE.SphereGeometry(1.6,24,24), new THREE.MeshStandardMaterial({color: (b.phase===3?0x050505:color), emissive: (b.phase===3?0x003366:color), emissiveIntensity:0.5, metalness:0.4, roughness:0.5}));
    body.castShadow=true;
    b.mesh.add(body);
    // hammer
    const hammer = new THREE.Mesh(new THREE.BoxGeometry(0.4,0.4,2.6), new THREE.MeshStandardMaterial({color:0x88ccff, metalness:0.8, roughness:0.2}));
    hammer.position.set(1.2,0,-0.5);
    b.mesh.add(hammer);
    b.hammer = hammer;
    // eyes
    const eyeGeo = new THREE.SphereGeometry(0.18,8,8);
    const eyeMat = new THREE.MeshBasicMaterial({color: (b.phase>=2?0x00ffff:0x224466), transparent:true});
    const le = new THREE.Mesh(eyeGeo, eyeMat.clone()); le.position.set(-0.4,0.6,1.2); b.mesh.add(le);
    const re = new THREE.Mesh(eyeGeo, eyeMat.clone()); re.position.set(0.4,0.6,1.2); b.mesh.add(re);
    b.eyes = [le,re];
    if(b.phase===3){
      // azure flames from head
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.8,2.4,12), new THREE.MeshBasicMaterial({color:0x0088ff, transparent:true, opacity:0.7}));
      flame.position.set(0,2.2,0);
      b.mesh.add(flame);
      b.flame = flame;
      // outline (wireframe)
      const outline = new THREE.Mesh(new THREE.SphereGeometry(1.75,16,16), new THREE.MeshBasicMaterial({color:0x00aaff, wireframe:true, transparent:true, opacity:0.35}));
      b.mesh.add(outline);
    }
    // weak point in phase3
    if(b.phase===3){
      const wp = new THREE.Mesh(new THREE.SphereGeometry(0.35,12,12), new THREE.MeshBasicMaterial({color:0xff4400, transparent:true, opacity:0.9}));
      wp.position.set(0,0.5,1.6);
      b.mesh.add(wp);
      b.weakPoint = wp;
    }
  } else {
    // generic boss: sphere + accent
    const body = new THREE.Mesh(new THREE.SphereGeometry(1.8,20,20), new THREE.MeshStandardMaterial({color, emissive:color, emissiveIntensity:0.4, metalness:0.5, roughness:0.4}));
    body.castShadow=true;
    b.mesh.add(body);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4,0.12,8,40), new THREE.MeshBasicMaterial({color:d.accent}));
    ring.rotation.x = Math.PI/2;
    b.mesh.add(ring);
    b.ring = ring;
    if(b.phase===3){
      const wp = new THREE.Mesh(new THREE.SphereGeometry(0.4,12,12), new THREE.MeshBasicMaterial({color:0xff4400}));
      wp.position.set(0,0,2);
      b.mesh.add(wp);
      b.weakPoint = wp;
    }
  }
  b.mesh.position.set(0,1.5,-12);
}

// ---------- Input ----------
window.addEventListener('keydown', e=>{ state.keys[e.key.toLowerCase()]=true; if(e.key===' '){ e.preventDefault(); tryAbility(); } });
window.addEventListener('keyup', e=>{ state.keys[e.key.toLowerCase()]=false; });
canvas.addEventListener('mousemove', e=>{ state.mouse.x = (e.clientX/window.innerWidth)*2-1; state.mouse.y = -(e.clientY/window.innerHeight)*2+1; });
canvas.addEventListener('mousedown', e=>{ state.mouse.down = true; });
canvas.addEventListener('mouseup', e=>{ state.mouse.down = false; });

// touch
const joystick = document.getElementById('joystick');
const stick = document.getElementById('stick');
let joyActive=false, joyId=null, joyStart={x:0,y:0};
joystick.addEventListener('touchstart', e=>{ const t=e.changedTouches[0]; joyActive=true; joyId=t.identifier; joyStart={x:t.clientX,y:t.clientY}; });
window.addEventListener('touchmove', e=>{
  for(const t of e.changedTouches){
    if(t.identifier===joyId){
      const dx=t.clientX-joyStart.x, dy=t.clientY-joyStart.y;
      const mag=Math.hypot(dx,dy); const max=40;
      const cx = mag>max? dx/mag*max : dx;
      const cy = mag>max? dy/mag*max : dy;
      stick.style.left = (33+cx)+'px'; stick.style.top=(33+cy)+'px';
      state.touch.moveX = cx/max; state.touch.moveY = cy/max;
    }
  }
}, {passive:true});
window.addEventListener('touchend', e=>{
  for(const t of e.changedTouches){
    if(t.identifier===joyId){ joyActive=false; joyId=null; stick.style.left='33px'; stick.style.top='33px'; state.touch.moveX=0; state.touch.moveY=0; }
  }
});
document.getElementById('shootBtn').addEventListener('touchstart', e=>{ state.touch.shoot=true; e.preventDefault(); });
document.getElementById('shootBtn').addEventListener('touchend', e=>{ state.touch.shoot=false; });
document.getElementById('abilityBtn').addEventListener('touchstart', e=>{ tryAbility(); e.preventDefault(); });

// ---------- Game flow ----------
function startGame(){
  cleanupGame();
  document.getElementById('titleScreen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  // touch controls show on small screens
  if(window.innerWidth<900) document.getElementById('touchControls').classList.remove('hidden');

  const cls = getClass(state.classId);
  const bossData = getBoss(state.bossId);
  const diff = getDiff(state.diffId);
  state.player = makePlayer(cls);
  state.boss = makeBoss(bossData, diff);
  state.running = true;
  state.time = 0;
  state.phase = 1;
  state.bullets = [];
  state.particles = [];
  state.turrets = [];
  state.score = 0;
  state.abilityCd = 0;
  state.playerFireCd = 0;
  state.invuln = 0;
  state.bossAttackTimer = 2;
  state.comboQueue = [];
  state.comboTimer = 0;
  state.instantDeathActive = false;
  state.safeZone = null;
  state.outcome = null;

  document.getElementById('bossName').textContent = bossData.name.toUpperCase();
  updateHud();
}

function cleanupGame(){
  // remove player, boss, bullets, particles, turrets
  if(state.player){ scene.remove(state.player.mesh); state.player=null; }
  if(state.boss){ scene.remove(state.boss.mesh); state.boss=null; }
  state.bullets.forEach(b=>{ scene.remove(b.mesh); });
  state.bullets=[];
  state.particles.forEach(p=>{ scene.remove(p.mesh); });
  state.particles=[];
  state.turrets.forEach(t=>{ scene.remove(t.mesh); });
  state.turrets=[];
  if(state.safeZone){ scene.remove(state.safeZone.mesh); state.safeZone=null; }
  state.running=false;
}

function endGame(win){
  state.running = false;
  state.outcome = win?'win':'lose';
  const ov = document.getElementById('overlay');
  document.getElementById('overlayTitle').textContent = win ? 'VICTORY' : 'DEFEAT';
  document.getElementById('overlayMsg').textContent = win ? 'Boss defeated.' : 'You were destroyed.';
  document.getElementById('overlayBtn').textContent = 'Back to Menu';
  ov.classList.remove('hidden');
  if(window.innerWidth<900) document.getElementById('touchControls').classList.add('hidden');
}

// ---------- Movement / Player update ----------
function updatePlayer(dt){
  const p = state.player;
  const cls = p.cls;
  let mx=0, my=0; // in xz plane: x, z
  if(state.keys['a']||state.keys['arrowleft']) mx -=1;
  if(state.keys['d']||state.keys['arrowright']) mx +=1;
  if(state.keys['w']||state.keys['arrowup']) my -=1; // z negative forward
  if(state.keys['s']||state.keys['arrowdown']) my +=1;
  // touch
  mx += state.touch.moveX;
  my += state.touch.moveY;
  const mag = Math.hypot(mx,my);
  if(mag>0){ mx/=mag; my/=mag; }
  let speed = p.speed;
  if(state.invuln>0) speed*=1.1;
  p.pos.x = clamp(p.pos.x + mx*speed*dt, -18, 18);
  p.pos.z = clamp(p.pos.z + my*speed*dt, -18, 18);
  p.pos.y = 0.6;

  // face mouse-ish: rotate toward boss? keep simple
  p.mesh.rotation.y = Math.atan2(mx, my) ; 

  // fire
  p.fireCd -= dt;
  const shooting = state.mouse.down || state.touch.shoot;
  if(shooting && p.fireCd<=0){
    p.fireCd = cls.fireRate;
    firePlayer(p);
  }

  // turrets
  if(cls.id==='engineer'){
    // auto fire turrets
    state.turrets.forEach(t=>{
      t.cd -= dt;
      if(t.cd<=0){
        t.cd = 0.4;
        const dir = new THREE.Vector3().subVectors(state.boss.pos, t.mesh.position).normalize();
        const pos = t.mesh.position.clone().add(new THREE.Vector3(0,0.5,0));
        mkBullet(pos, dir.multiplyScalar(14), cls.color, 'player', p.damage*0.6, 0.18);
      }
    });
  }

  // ability cd
  p.abilityCd = Math.max(0, p.abilityCd - dt);
  state.abilityCd = p.abilityCd;
  state.invuln = Math.max(0, state.invuln - dt);
  // blink if invuln
  p.mesh.visible = !(state.invuln>0 && Math.floor(state.time*10)%2===0);
}

function firePlayer(p){
  const cls = p.cls;
  const boss = state.boss;
  const dir = new THREE.Vector3().subVectors(boss.pos, p.pos).normalize();
  // slight spread
  const spread = 0.05;
  const d = dir.clone().add(new THREE.Vector3((Math.random()-0.5)*spread, (Math.random()-0.5)*spread, (Math.random()-0.5)*spread)).normalize();
  const speed = 22;
  mkBullet(p.pos.clone().add(new THREE.Vector3(0,0.5,0)), d.multiplyScalar(speed), cls.color, 'player', p.damage, 0.22, cls.homing);
  if(cls.id==='striker'){
    // double shot
    const d2 = dir.clone().add(new THREE.Vector3((Math.random()-0.5)*spread*2,0,(Math.random()-0.5)*spread*2)).normalize();
    mkBullet(p.pos.clone().add(new THREE.Vector3(0,0.5,0)), d2.multiplyScalar(speed), cls.color, 'player', p.damage*0.7, 0.18);
  }
  if(cls.id==='mystic' && Math.random()<0.3){
    // extra homing
  }
}

function tryAbility(){
  if(!state.running) return;
  const p = state.player;
  const cls = p.cls;
  if(p.abilityCd>0) return;
  p.abilityCd = cls.abilityCd;
  if(cls.ability==='shield'){
    state.invuln = 2.5;
    spawnParticles(p.pos, 0x4a9eff, 20, 2);
  } else if(cls.ability==='dash'){
    // dash toward movement or forward
    let dx=0, dz=-1;
    if(state.keys['a']) dx=-1; if(state.keys['d']) dx=1;
    if(state.keys['w']) dz=-1; if(state.keys['s']) dz=1;
    const mag=Math.hypot(dx,dz)||1;
    p.pos.x = clamp(p.pos.x + (dx/mag)*6, -18,18);
    p.pos.z = clamp(p.pos.z + (dz/mag)*6, -18,18);
    state.invuln = 0.25;
    spawnParticles(p.pos, cls.color, 16, 4);
  } else if(cls.ability==='heal'){
    p.hp = Math.min(p.maxHp, p.hp + 40);
    spawnParticles(p.pos, 0xb04aff, 24, 2);
  } else if(cls.ability==='turret'){
    const tGeo = new THREE.CylinderGeometry(0.4,0.5,0.8,8);
    const tMat = new THREE.MeshStandardMaterial({color:0x4aff9e, emissive:0x22aa66, emissiveIntensity:0.5});
    const tm = new THREE.Mesh(tGeo, tMat);
    tm.position.copy(p.pos);
    tm.position.y = 0.4;
    scene.add(tm);
    state.turrets.push({mesh:tm, cd:0, life:15});
    if(state.turrets.length>3){ const old=state.turrets.shift(); scene.remove(old.mesh); }
  } else if(cls.ability==='phase'){
    state.invuln = 1.8;
    p.mesh.material && (p.mesh.children.forEach(c=>{ if(c.material) c.material.transparent=true; }));
    spawnParticles(p.pos, 0xaaaaaa, 20, 3);
  }
}

// ---------- Boss update ----------
function updateBoss(dt){
  const b = state.boss;
  const diff = b.diff;
  // hover motion
  b.mesh.position.y = 1.5 + Math.sin(state.time*1.2)*0.4;
  if(b.data.id==='riptide'){
    // hammer swing
    if(b.hammer) b.hammer.rotation.z = Math.sin(state.time*2)*0.6;
  }
  if(b.ring) b.ring.rotation.z += dt*0.8;

  // phase check
  const ratio = b.hp / b.maxHp;
  let newPhase = ratio > 0.66 ? 1 : (ratio > 0.33 ? 2 : 3);
  if(newPhase !== b.phase){
    b.phase = newPhase;
    state.phase = newPhase;
    buildBossVisual(b);
    spawnParticles(b.pos, b.data.accent, 40, 6);
    // heal? no
  }
  state.phase = b.phase;

  // azure mode for riptide phase3
  if(b.data.id==='riptide' && b.phase===3) b.azure=true;

  // attack timer
  b.attackTimer -= dt;
  if(state.comboQueue.length>0){
    state.comboTimer -= dt;
    if(state.comboTimer<=0){
      const next = state.comboQueue.shift();
      executeAttack(next);
      state.comboTimer = 0.6;
    }
  } else {
    if(b.attackTimer<=0){
      chooseAttack();
    }
  }

  // instant death counter handling
  if(state.safeZone){
    state.safeZone.timer -= dt;
    // show
    state.safeZone.mesh.scale.setScalar(1 + Math.sin(state.time*8)*0.05);
    if(state.safeZone.timer<=0){
      // execute
      executeInstantDeath();
    }
  }

  // turrets life
  for(let i=state.turrets.length-1;i>=0;i--){
    const t=state.turrets[i];
    t.life -= dt;
    if(t.life<=0){ scene.remove(t.mesh); state.turrets.splice(i,1); }
  }

  // weak point pulse
  if(b.weakPoint){
    b.weakPoint.material.opacity = 0.6 + Math.sin(state.time*6)*0.4;
  }
}

function chooseAttack(){
  const b = state.boss;
  const diff = b.diff;
  // pick attack from list
  const attacks = getAttackList(b);
  // filter by phase
  const avail = attacks.filter(a=>!a.phase || a.phase.includes(b.phase));
  if(avail.length===0) return;
  // rare combo: 12% chance do a combo of 2-3 attacks
  if(Math.random() < 0.12){
    const comboLen = 2 + (Math.random()<0.3?1:0);
    const seq = [];
    for(let i=0;i<comboLen;i++) seq.push(avail[Math.floor(Math.random()*avail.length)].id);
    state.comboQueue = seq.slice(1);
    state.comboTimer = 0;
    executeAttack(seq[0]);
  } else {
    const a = avail[Math.floor(Math.random()*avail.length)];
    executeAttack(a.id);
  }
  // cooldown
  const baseCd = 1.0 / (0.9 + (diff.speed-1)*0.5);
  b.attackTimer = (0.9 + Math.random()*0.6) * (1/diff.speed);
  // phase3 faster
  if(b.phase===3) b.attackTimer *= 0.75;
}

function getAttackList(b){
  if(b.data.id==='riptide') return RIPTIDE_ATTACKS;
  if(b.data.id==='inferno') return INFERNO_ATTACKS;
  if(b.data.id==='frost') return FROST_ATTACKS;
  if(b.data.id==='storm') return STORM_ATTACKS;
  if(b.data.id==='void') return VOID_ATTACKS;
  return RIPTIDE_ATTACKS;
}

// ---------- Attack implementations ----------
// Each attack is a function(b, diff). We'll store as {id, name, phase, fn}
function A(id, name, phase, fn){ return {id, name, phase, fn}; }

const RIPTIDE_ATTACKS = [];
// generate many attacks by pushing variants
function pushRiptide(){
  const phases1=[1,2], phases2=[2,3], phases3=[3], all=[1,2,3];
  // basic aimed
  for(let i=0;i<6;i++){
    RIPTIDE_ATTACKS.push(A('aimed'+i, 'Aqua Shot '+ (i+1), all, (b,diff)=>{
      const n = 1 + Math.floor(i/2);
      const col = b.azure? 0x44aaff : 0x2288ff;
      for(let k=0;k<n;k++){
        setTimeout(()=>{},0);
      }
      for(let k=0;k<n;k++){
        const ang = (k/(n||1))*Math.PI*2;
        const pos = b.pos.clone();
        mkBullet(pos, new THREE.Vector3(Math.cos(ang)*0.3,0,Math.sin(ang)*0.3).add(new THREE.Vector3(0,0,1)).normalize().multiplyScalar(10+diff.speed*2), col, 'boss', 1, 0.22);
      }
      // aimed at player
      const dir = new THREE.Vector3().subVectors(state.player.pos, b.pos).normalize();
      mkBullet(b.pos.clone(), dir.multiplyScalar(12*diff.speed), col, 'boss', 1, 0.28);
    }));
  }
  // spirals
  for(let arms=2; arms<=5; arms++){
    RIPTIDE_ATTACKS.push(A('spiral'+arms, 'Tidal Spiral '+arms, all, (b,diff)=>{
      const col = b.azure? 0x66ccff : 0x3399ff;
      const count = 18 + (b.phase-1)*6;
      const speed = (9 + diff.speed*2);
      for(let i=0;i<count;i++){
        const ang = (i/count)*Math.PI*2 + state.time*0.5;
        const v = new THREE.Vector3(Math.cos(ang)*speed, 0, Math.sin(ang)*speed);
        // rotate outward spiral
        const r = 0.5 + i*0.05;
        const pos = b.pos.clone().add(new THREE.Vector3(Math.cos(ang)*r,0,Math.sin(ang)*r));
        mkBullet(pos, v, col, 'boss', 1, 0.18);
      }
    }));
  }
  // rings
  for(let r=1;r<=4;r++){
    RIPTIDE_ATTACKS.push(A('ring'+r, 'Aqua Ring '+r, all, (b,diff)=>{
      const col = b.azure? 0x00aaff : 0x44bbff;
      const count = 12 + r*4;
      const speed = 7 + diff.speed*1.5 + r;
      for(let i=0;i<count;i++){
        const ang = (i/count)*Math.PI*2;
        const v = new THREE.Vector3(Math.cos(ang)*speed, 0, Math.sin(ang)*speed);
        mkBullet(b.pos.clone(), v, col, 'boss', 1, 0.2);
      }
    }));
  }
  // walls
  for(let o=0;o<4;o++){
    RIPTIDE_ATTACKS.push(A('wall'+o, 'Tidal Wall '+ (o+1), [1,2,3], (b,diff)=>{
      const col = b.azure? 0x55bbff : 0x2299ee;
      const vertical = o%2===0;
      const count = 9;
      const speed = 8*diff.speed;
      const offset = (Math.random()-0.5)*6;
      for(let i=0;i<count;i++){
        const spread = (i - count/2)*1.1;
        const pos = b.pos.clone();
        let v;
        if(vertical){
          pos.x += spread; pos.z += offset;
          v = new THREE.Vector3(0,0,1).multiplyScalar(speed);
        } else {
          pos.z += spread; pos.x += offset;
          v = new THREE.Vector3(1,0,0).multiplyScalar(speed*(Math.random()>0.5?1:-1));
        }
        mkBullet(pos, v, col, 'boss', 1, 0.22);
      }
    }));
  }
  // rain
  for(let i=0;i<4;i++){
    RIPTIDE_ATTACKS.push(A('rain'+i, 'Droplet Rain '+ (i+1), all, (b,diff)=>{
      const col = b.azure? 0x88ddff : 0x66ccff;
      const count = 16 + i*4;
      for(let k=0;k<count;k++){
        const x = rand(-16,16); const z = rand(-16,16);
        const pos = new THREE.Vector3(x, 12, z);
        mkBullet(pos, new THREE.Vector3(0,-12*diff.speed,0), col, 'boss', 1, 0.18);
      }
    }));
  }
  // whirlpool (spiral inward) phase2+
  for(let i=0;i<3;i++){
    RIPTIDE_ATTACKS.push(A('whirl'+i, 'Whirlpool '+ (i+1), [2,3], (b,diff)=>{
      const col = b.azure? 0x0099ff : 0x1177dd;
      const arms = 3+i;
      const count = 24;
      for(let k=0;k<count;k++){
        const ang = (k/count)*Math.PI*2;
        const radius = 14;
        const x = Math.cos(ang)*radius; const z = Math.sin(ang)*radius;
        const pos = new THREE.Vector3(x,0.6,z);
        // velocity toward center + tangential
        const v = new THREE.Vector3(-Math.cos(ang),0,-Math.sin(ang)).multiplyScalar(2)
          .add(new THREE.Vector3(-Math.sin(ang),0,Math.cos(ang)).multiplyScalar(6*diff.speed));
        mkBullet(pos, v, col, 'boss', 1, 0.2);
      }
    }));
  }
  // bubble barrage (clusters)
  for(let i=0;i<4;i++){
    RIPTIDE_ATTACKS.push(A('bubble'+i, 'Bubble Barrage '+ (i+1), all, (b,diff)=>{
      const col = 0x88eeff;
      const clusters = 4 + i;
      for(let c=0;c<clusters;c++){
        const ang = Math.random()*Math.PI*2;
        const r = 3+Math.random()*5;
        const pos = b.pos.clone().add(new THREE.Vector3(Math.cos(ang)*r,0,Math.sin(ang)*r));
        const v = new THREE.Vector3((Math.random()-0.5)*4,0,(Math.random()-0.5)*4).add(new THREE.Vector3(0,0,1).multiplyScalar(6*diff.speed));
        mkBullet(pos, v, col, 'boss', 1, 0.25);
      }
    }));
  }
  // aqua beam (line of bullets)
  for(let i=0;i<3;i++){
    RIPTIDE_ATTACKS.push(A('beam'+i, 'Aqua Beam '+ (i+1), [1,2,3], (b,diff)=>{
      const col = b.azure? 0x00ccff : 0x00aaff;
      const dir = new THREE.Vector3().subVectors(state.player.pos, b.pos).normalize();
      const count = 12;
      for(let k=0;k<count;k++){
        const pos = b.pos.clone().addScaledVector(dir, k*0.6);
        mkBullet(pos, dir.clone().multiplyScalar(16*diff.speed), col, 'boss', 1, 0.15);
      }
    }));
  }
  // homing droplets phase2+
  for(let i=0;i<3;i++){
    RIPTIDE_ATTACKS.push(A('homing'+i, 'Homing Droplet '+ (i+1), [2,3], (b,diff)=>{
      const col = b.azure? 0x44aaff : 0x2288ff;
      const count = 3 + i;
      for(let k=0;k<count;k++){
        const ang = Math.random()*Math.PI*2;
        const pos = b.pos.clone().add(new THREE.Vector3(Math.cos(ang)*2,0,Math.sin(ang)*2));
        const v = new THREE.Vector3(Math.cos(ang),0,Math.sin(ang)).multiplyScalar(6);
        const hb = mkBullet(pos, v, col, 'boss', 1, 0.24, true);
        hb.homing = true;
      }
    }));
  }
  // instant death counter (phase3) - telegraph safe zone
  RIPTIDE_ATTACKS.push(A('exec', 'Riptide Execution', [3], (b,diff)=>{
    startInstantDeath(b,diff);
  }));
  // aqua hammer smash (melee-ish bullet wall)
  for(let i=0;i<3;i++){
    RIPTIDE_ATTACKS.push(A('hammer'+i, 'Aqua Hammer '+ (i+1), all, (b,diff)=>{
      const col = 0x99ddff;
      // semicircle wave
      const count = 14;
      const speed = 10*diff.speed;
      for(let k=0;k<count;k++){
        const ang = (k/(count-1))*Math.PI - Math.PI/2; // front arc
        const v = new THREE.Vector3(Math.sin(ang)*speed, 0, Math.cos(ang)*speed);
        const pos = b.pos.clone().add(new THREE.Vector3(Math.sin(ang)*1.5,0,Math.cos(ang)*1.5));
        mkBullet(pos, v, col, 'boss', 2, 0.3);
      }
    }));
  }
  // tsunami (big wave from side)
  for(let i=0;i<2;i++){
    RIPTIDE_ATTACKS.push(A('tsunami'+i, 'Tsunami '+ (i+1), [2,3], (b,diff)=>{
      const col = b.azure? 0x0088ff : 0x0066cc;
      const fromLeft = Math.random()>0.5;
      const count = 20;
      for(let k=0;k<count;k++){
        const z = -16 + k*1.7;
        const x = fromLeft ? -18 : 18;
        const pos = new THREE.Vector3(x,0.6,z);
        const v = new THREE.Vector3(fromLeft?1:-1,0, (Math.random()-0.5)*2).multiplyScalar(9*diff.speed);
        mkBullet(pos, v, col, 'boss', 1, 0.35);
      }
    }));
  }
  // azure fire attacks phase3 (fireballs)
  for(let i=0;i<6;i++){
    RIPTIDE_ATTACKS.push(A('azure'+i, 'Azure Fireball '+ (i+1), [3], (b,diff)=>{
      const col = 0x44aaff;
      const count = 3 + i;
      for(let k=0;k<count;k++){
        const ang = Math.random()*Math.PI*2;
        const speed = 8 + Math.random()*6;
        const pos = b.pos.clone().add(new THREE.Vector3(Math.cos(ang)*1.5,0,Math.sin(ang)*1.5));
        const v = new THREE.Vector3(Math.cos(ang),0,Math.sin(ang)).multiplyScalar(speed*diff.speed);
        // upward arc
        v.y = 2 + Math.random()*3;
        const fb = mkBullet(pos, v, col, 'boss', 2, 0.32);
        fb.gravity = -6; // will apply
      }
    }));
  }
  // cross pattern
  for(let i=0;i<2;i++){
    RIPTIDE_ATTACKS.push(A('cross'+i, 'Cross Current', all, (b,diff)=>{
      const col = 0x66ccff;
      const speed = 11*diff.speed;
      for(let d of [{x:1,z:0},{x:-1,z:0},{x:0,z:1},{x:0,z:-1}]){
        for(let k=0;k<5;k++){
          const pos = b.pos.clone().add(new THREE.Vector3(d.x*k*0.8,0,d.z*k*0.8));
          mkBullet(pos, new THREE.Vector3(d.x,d.y||0,d.z).multiplyScalar(speed), col, 'boss',1,0.2);
        }
      }
    }));
  }
  // extra aimed variants
  for(let i=0;i<8;i++){
    RIPTIDE_ATTACKS.push(A('aimedX'+i, 'Aimed Aqua '+ (i+1), all, (b,diff)=>{
      const col = b.azure? 0x33bbff : 0x2288ff;
      const n = 2 + (i%3);
      for(let k=0;k<n;k++){
        const dir = new THREE.Vector3().subVectors(state.player.pos, b.pos).normalize();
        const spread = (k - n/2)*0.12;
        const d = dir.clone().add(new THREE.Vector3(spread,0,spread*0.5)).normalize();
        mkBullet(b.pos.clone(), d.multiplyScalar((11+i*0.5)*diff.speed), col, 'boss', 1, 0.22);
      }
    }));
  }
  // extra spirals
  for(let arms=6; arms<=8; arms++){
    RIPTIDE_ATTACKS.push(A('spiralX'+arms, 'Tidal Spiral '+arms, [2,3], (b,diff)=>{
      const col = b.azure? 0x55ccff : 0x2299ff;
      const count = 22;
      const speed = (10 + diff.speed*2);
      for(let i=0;i<count;i++){
        const ang = (i/count)*Math.PI*2 + state.time*0.8;
        const v = new THREE.Vector3(Math.cos(ang)*speed, 0, Math.sin(ang)*speed);
        const r = 1 + i*0.04;
        const pos = b.pos.clone().add(new THREE.Vector3(Math.cos(ang)*r,0,Math.sin(ang)*r));
        mkBullet(pos, v, col, 'boss', 1, 0.17);
      }
    }));
  }
  // extra rings
  for(let r=5;r<=7;r++){
    RIPTIDE_ATTACKS.push(A('ringX'+r, 'Aqua Ring '+r, all, (b,diff)=>{
      const col = b.azure? 0x00bbff : 0x33aaff;
      const count = 16 + r*2;
      const speed = 8 + diff.speed*1.5;
      for(let i=0;i<count;i++){
        const ang = (i/count)*Math.PI*2;
        mkBullet(b.pos.clone(), new THREE.Vector3(Math.cos(ang)*speed,0,Math.sin(ang)*speed), col, 'boss', 1, 0.19);
      }
    }));
  }
  // extra rain
  for(let i=0;i<4;i++){
    RIPTIDE_ATTACKS.push(A('rainX'+i, 'Droplet Rain X'+ (i+1), all, (b,diff)=>{
      const col = b.azure? 0x77ddff : 0x55bbff;
      const count = 20 + i*3;
      for(let k=0;k<count;k++){
        const x = rand(-17,17); const z = rand(-17,17);
        mkBullet(new THREE.Vector3(x, 13, z), new THREE.Vector3((Math.random()-0.5)*2, -13*diff.speed, (Math.random()-0.5)*2), col, 'boss', 1, 0.16);
      }
    }));
  }
  // extra hammer
  for(let i=0;i<3;i++){
    RIPTIDE_ATTACKS.push(A('hammerX'+i, 'Aqua Hammer X'+ (i+1), all, (b,diff)=>{
      const col = 0x88ccff;
      const count = 18;
      const speed = 11*diff.speed;
      for(let k=0;k<count;k++){
        const ang = (k/(count-1))*Math.PI - Math.PI/2;
        const v = new THREE.Vector3(Math.sin(ang)*speed, 0, Math.cos(ang)*speed);
        const pos = b.pos.clone().add(new THREE.Vector3(Math.sin(ang)*1.8,0,Math.cos(ang)*1.8));
        mkBullet(pos, v, col, 'boss', 2, 0.28);
      }
    }));
  }
  // extra azure fireballs
  for(let i=0;i<6;i++){
    RIPTIDE_ATTACKS.push(A('azureX'+i, 'Azure Fire X'+ (i+1), [3], (b,diff)=>{
      const col = 0x3399ff;
      const count = 4 + i;
      for(let k=0;k<count;k++){
        const ang = Math.random()*Math.PI*2;
        const speed = 9 + Math.random()*5;
        const pos = b.pos.clone().add(new THREE.Vector3(Math.cos(ang)*1.5,0,Math.sin(ang)*1.5));
        const v = new THREE.Vector3(Math.cos(ang),0,Math.sin(ang)).multiplyScalar(speed*diff.speed);
        v.y = 3 + Math.random()*2;
        const fb = mkBullet(pos, v, col, 'boss', 2, 0.3);
        fb.gravity = -7;
      }
    }));
  }
  // extra tsunamis
  for(let i=0;i<2;i++){
    RIPTIDE_ATTACKS.push(A('tsunamiX'+i, 'Tsunami X'+ (i+1), [2,3], (b,diff)=>{
      const col = b.azure? 0x0077ff : 0x0055bb;
      const fromLeft = Math.random()>0.5;
      const count = 22;
      for(let k=0;k<count;k++){
        const z = -18 + k*1.7;
        const x = fromLeft ? -19 : 19;
        const pos = new THREE.Vector3(x,0.6,z);
        const v = new THREE.Vector3(fromLeft?1:-1,0, (Math.random()-0.5)*1.5).multiplyScalar(10*diff.speed);
        mkBullet(pos, v, col, 'boss', 1, 0.32);
      }
    }));
  }
  // extra whirlpools
  for(let i=0;i<3;i++){
    RIPTIDE_ATTACKS.push(A('whirlX'+i, 'Whirlpool X'+ (i+1), [2,3], (b,diff)=>{
      const col = b.azure? 0x0099ff : 0x1177dd;
      const count = 28;
      for(let k=0;k<count;k++){
        const ang = (k/count)*Math.PI*2;
        const radius = 15;
        const x = Math.cos(ang)*radius; const z = Math.sin(ang)*radius;
        const pos = new THREE.Vector3(x,0.6,z);
        const v = new THREE.Vector3(-Math.cos(ang),0,-Math.sin(ang)).multiplyScalar(2)
          .add(new THREE.Vector3(-Math.sin(ang),0,Math.cos(ang)).multiplyScalar(7*diff.speed));
        mkBullet(pos, v, col, 'boss', 1, 0.2);
      }
    }));
  }
  // extra bubbles
  for(let i=0;i<4;i++){
    RIPTIDE_ATTACKS.push(A('bubbleX'+i, 'Bubble Barrage X'+ (i+1), all, (b,diff)=>{
      const col = 0x88eeff;
      const clusters = 6 + i;
      for(let c=0;c<clusters;c++){
        const ang = Math.random()*Math.PI*2;
        const r = 3+Math.random()*6;
        const pos = b.pos.clone().add(new THREE.Vector3(Math.cos(ang)*r,0,Math.sin(ang)*r));
        const v = new THREE.Vector3((Math.random()-0.5)*5,0,(Math.random()-0.5)*5).add(new THREE.Vector3(0,0,1).multiplyScalar(7*diff.speed));
        mkBullet(pos, v, col, 'boss', 1, 0.25);
      }
    }));
  }
  // extra beams
  for(let i=0;i<3;i++){
    RIPTIDE_ATTACKS.push(A('beamX'+i, 'Aqua Beam X'+ (i+1), all, (b,diff)=>{
      const col = b.azure? 0x00ccff : 0x00aaff;
      const dir = new THREE.Vector3().subVectors(state.player.pos, b.pos).normalize();
      const count = 14;
      for(let k=0;k<count;k++){
        const pos = b.pos.clone().addScaledVector(dir, k*0.5);
        mkBullet(pos, dir.clone().multiplyScalar(18*diff.speed), col, 'boss', 1, 0.14);
      }
    }));
  }
  // extra homing
  for(let i=0;i<3;i++){
    RIPTIDE_ATTACKS.push(A('homingX'+i, 'Homing Droplet X'+ (i+1), [2,3], (b,diff)=>{
      const col = b.azure? 0x44aaff : 0x2288ff;
      const count = 4 + i;
      for(let k=0;k<count;k++){
        const ang = Math.random()*Math.PI*2;
        const pos = b.pos.clone().add(new THREE.Vector3(Math.cos(ang)*2,0,Math.sin(ang)*2));
        const v = new THREE.Vector3(Math.cos(ang),0,Math.sin(ang)).multiplyScalar(6);
        const hb = mkBullet(pos, v, col, 'boss', 1, 0.24, true);
        hb.homing = true;
      }
    }));
  }
}
pushRiptide();
window.__riptideCount = (typeof RIPTIDE_ATTACKS!=='undefined') ? RIPTIDE_ATTACKS.length : 0;
window.__execAttack = (id) => { try { executeAttack(id); } catch(e){ console.error(e); } };
window.__tryAbility = () => { try { tryAbility(); } catch(e){ console.error(e); } };
window.__getAttacks = () => (typeof getAttackList==='function'? getAttackList(window.__state.boss) : []);

function startInstantDeath(b,diff){
  // telegraph: safe zone appears
  const sx = rand(-8,8); const sz = rand(-8,8);
  const geo = new THREE.CircleGeometry(3.5,32);
  const mat = new THREE.MeshBasicMaterial({color:0x00ff88, transparent:true, opacity:0.35, side:THREE.DoubleSide});
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI/2;
  mesh.position.set(sx,0.05,sz);
  scene.add(mesh);
  // ring
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.3,3.6,32), new THREE.MeshBasicMaterial({color:0x00ff88, transparent:true, opacity:0.9, side:THREE.DoubleSide}));
  ring.rotation.x=-Math.PI/2;
  ring.position.set(sx,0.06,sz);
  scene.add(ring);
  mesh.add(ring);
  state.safeZone = { mesh, ring, x:sx, z:sz, timer: 2.2/diff.speed, diff };
  // warning text
  document.getElementById('infoText').textContent = 'INSTANT DEATH incoming! Get to the GREEN zone!';
}

function executeInstantDeath(){
  const sz = state.safeZone;
  const p = state.player;
  const d = Math.hypot(p.pos.x - sz.x, p.pos.z - sz.z);
  if(d > 3.5){
    // death
    p.hp = 0;
    spawnParticles(p.pos, 0xff0000, 40, 6);
  } else {
    spawnParticles(p.pos, 0x00ff88, 20, 4);
  }
  // cleanup
  scene.remove(sz.mesh);
  state.safeZone = null;
  document.getElementById('infoText').textContent = '';
}

// ---------- Other bosses attacks (simpler) ----------
const INFERNO_ATTACKS = [];
function pushInferno(){
  for(let i=0;i<12;i++){
    INFERNO_ATTACKS.push(A('fire'+i, 'Flame '+ (i+1), [1,2,3], (b,diff)=>{
      const col = 0xff6600;
      const count = 8 + i;
      const speed = 9*diff.speed;
      for(let k=0;k<count;k++){
        const ang = (k/count)*Math.PI*2 + state.time;
        const v = new THREE.Vector3(Math.cos(ang)*speed, (Math.random()-0.5)*2, Math.sin(ang)*speed);
        mkBullet(b.pos.clone(), v, col, 'boss', 1, 0.22);
      }
    }));
  }
  for(let i=0;i<6;i++){
    INFERNO_ATTACKS.push(A('erupt'+i, 'Eruption '+ (i+1), [2,3], (b,diff)=>{
      const col = 0xffaa00;
      const count = 12;
      for(let k=0;k<count;k++){
        const x = rand(-14,14); const z = rand(-14,14);
        mkBullet(new THREE.Vector3(x,10,z), new THREE.Vector3(0,-11*diff.speed,0), col, 'boss', 1, 0.25);
      }
    }));
  }
  for(let i=0;i<4;i++){
    INFERNO_ATTACKS.push(A('wave'+i, 'Fire Wave '+ (i+1), [1,2,3], (b,diff)=>{
      const col = 0xff4400;
      const count = 11;
      const speed = 10*diff.speed;
      const side = Math.random()>0.5?1:-1;
      for(let k=0;k<count;k++){
        const z = -15 + k*3;
        mkBullet(new THREE.Vector3(side*18,0.6,z), new THREE.Vector3(-side*speed,0, (Math.random()-0.5)*2), col, 'boss',1,0.3);
      }
    }));
  }
  // instant death-ish: inferno phase3 enrage burst
  INFERNO_ATTACKS.push(A('enrage', 'Inferno Enrage', [3], (b,diff)=>{
    // dense ring
    const count = 36;
    for(let k=0;k<count;k++){
      const ang=(k/count)*Math.PI*2;
      mkBullet(b.pos.clone(), new THREE.Vector3(Math.cos(ang),0,Math.sin(ang)).multiplyScalar(12*diff.speed), 0xff2200, 'boss', 2, 0.25);
    }
  }));
}
pushInferno();

const FROST_ATTACKS = [];
function pushFrost(){
  for(let i=0;i<10;i++){
    FROST_ATTACKS.push(A('shard'+i, 'Ice Shard '+ (i+1), [1,2,3], (b,diff)=>{
      const col = 0x88ddff;
      const count = 6 + i;
      const speed = 11*diff.speed;
      for(let k=0;k<count;k++){
        const ang = Math.random()*Math.PI*2;
        const v = new THREE.Vector3(Math.cos(ang)*speed, 0, Math.sin(ang)*speed);
        mkBullet(b.pos.clone(), v, col, 'boss', 1, 0.18);
      }
      // aimed
      const dir = new THREE.Vector3().subVectors(state.player.pos, b.pos).normalize();
      for(let k=0;k<3;k++) mkBullet(b.pos.clone(), dir.clone().multiplyScalar(13*diff.speed), col, 'boss',1,0.22);
    }));
  }
  for(let i=0;i<5;i++){
    FROST_ATTACKS.push(A('wall'+i, 'Ice Wall '+ (i+1), [1,2,3], (b,diff)=>{
      const col = 0xaaffff;
      const count = 10;
      const speed = 8*diff.speed;
      const horiz = Math.random()>0.5;
      for(let k=0;k<count;k++){
        const spread = (k-count/2)*1.2;
        if(horiz){
          mkBullet(new THREE.Vector3(spread,0.6,-14), new THREE.Vector3(0,0,speed), col,'boss',1,0.25);
        } else {
          mkBullet(new THREE.Vector3(-14,0.6,spread), new THREE.Vector3(speed,0,0), col,'boss',1,0.25);
        }
      }
    }));
  }
  for(let i=0;i<4;i++){
    FROST_ATTACKS.push(A('spiral'+i, 'Blizzard Spiral '+ (i+1), [2,3], (b,diff)=>{
      const col = 0xccffff;
      const count = 20;
      const speed = 8*diff.speed;
      for(let k=0;k<count;k++){
        const ang=(k/count)*Math.PI*2;
        const v = new THREE.Vector3(Math.cos(ang)*speed, 0, Math.sin(ang)*speed);
        mkBullet(b.pos.clone(), v, col, 'boss', 1, 0.16);
      }
    }));
  }
  FROST_ATTACKS.push(A('freeze', 'Deep Freeze', [3], (b,diff)=>{
    const count = 30;
    for(let k=0;k<count;k++){
      const ang=(k/count)*Math.PI*2;
      const v = new THREE.Vector3(Math.cos(ang),0,Math.sin(ang)).multiplyScalar(13*diff.speed);
      mkBullet(b.pos.clone(), v, 0xffffff, 'boss', 2, 0.28);
    }
  }));
}
pushFrost();

const STORM_ATTACKS = [];
function pushStorm(){
  for(let i=0;i<10;i++){
    STORM_ATTACKS.push(A('bolt'+i, 'Lightning Bolt '+ (i+1), [1,2,3], (b,diff)=>{
      const col = 0xffff44;
      // chain: several aimed shots
      const n = 3 + (i%3);
      for(let k=0;k<n;k++){
        setTimeout(()=>{},0);
      }
      for(let k=0;k<n;k++){
        const dir = new THREE.Vector3().subVectors(state.player.pos, b.pos).normalize();
        const spread = (k - n/2)*0.15;
        const d = dir.clone().add(new THREE.Vector3(spread,0,spread)).normalize();
        mkBullet(b.pos.clone(), d.multiplyScalar(18*diff.speed), col, 'boss', 1, 0.18);
      }
    }));
  }
  for(let i=0;i<5;i++){
    STORM_ATTACKS.push(A('ring'+i, 'Thunder Ring '+ (i+1), [1,2,3], (b,diff)=>{
      const col = 0xaa88ff;
      const count = 14 + i*2;
      const speed = 9*diff.speed;
      for(let k=0;k<count;k++){
        const ang=(k/count)*Math.PI*2;
        mkBullet(b.pos.clone(), new THREE.Vector3(Math.cos(ang)*speed,0,Math.sin(ang)*speed), col,'boss',1,0.2);
      }
    }));
  }
  for(let i=0;i<4;i++){
    STORM_ATTACKS.push(A('rain'+i, 'Storm Rain '+ (i+1), [2,3], (b,diff)=>{
      const col = 0xddccff;
      const count = 18;
      for(let k=0;k<count;k++){
        const x=rand(-16,16); const z=rand(-16,16);
        mkBullet(new THREE.Vector3(x,12,z), new THREE.Vector3((Math.random()-0.5)*3, -13*diff.speed, (Math.random()-0.5)*3), col,'boss',1,0.18);
      }
    }));
  }
  STORM_ATTACKS.push(A('overload', 'Overload', [3], (b,diff)=>{
    const count = 40;
    for(let k=0;k<count;k++){
      const ang=(k/count)*Math.PI*2;
      mkBullet(b.pos.clone(), new THREE.Vector3(Math.cos(ang),0,Math.sin(ang)).multiplyScalar(14*diff.speed), 0xffff00, 'boss', 2, 0.22);
    }
  }));
}
pushStorm();

const VOID_ATTACKS = [];
function pushVoid(){
  for(let i=0;i<10;i++){
    VOID_ATTACKS.push(A('orb'+i, 'Void Orb '+ (i+1), [1,2,3], (b,diff)=>{
      const col = 0xaa00ff;
      const count = 4 + (i%3);
      for(let k=0;k<count;k++){
        const ang = Math.random()*Math.PI*2;
        const v = new THREE.Vector3(Math.cos(ang),0,Math.sin(ang)).multiplyScalar(6*diff.speed);
        const hb = mkBullet(b.pos.clone(), v, col, 'boss', 1, 0.3, true);
        hb.homing = true;
      }
    }));
  }
  for(let i=0;i<5;i++){
    VOID_ATTACKS.push(A('pull'+i, 'Gravity Well '+ (i+1), [2,3], (b,diff)=>{
      const col = 0xff00ff;
      const count = 16;
      const speed = 7*diff.speed;
      for(let k=0;k<count;k++){
        const ang=(k/count)*Math.PI*2;
        mkBullet(b.pos.clone(), new THREE.Vector3(Math.cos(ang)*speed,0,Math.sin(ang)*speed), col, 'boss', 1, 0.2);
      }
      // center slow bullets
      for(let k=0;k<6;k++){
        mkBullet(b.pos.clone(), new THREE.Vector3((Math.random()-0.5)*2,0,(Math.random()-0.5)*2), col, 'boss', 1, 0.4);
      }
    }));
  }
  for(let i=0;i<4;i++){
    VOID_ATTACKS.push(A('rain'+i, 'Void Rain '+ (i+1), [1,2,3], (b,diff)=>{
      const col = 0x6600aa;
      const count = 20;
      for(let k=0;k<count;k++){
        const x=rand(-16,16); const z=rand(-16,16);
        mkBullet(new THREE.Vector3(x,12,z), new THREE.Vector3((Math.random()-0.5)*2, -12*diff.speed, (Math.random()-0.5)*2), col,'boss',1,0.2);
      }
    }));
  }
  VOID_ATTACKS.push(A('collapse', 'Collapse', [3], (b,diff)=>{
    const count = 48;
    for(let k=0;k<count;k++){
      const ang=(k/count)*Math.PI*2;
      const v = new THREE.Vector3(Math.cos(ang),0,Math.sin(ang)).multiplyScalar(15*diff.speed);
      mkBullet(b.pos.clone(), v, 0xff00ff, 'boss', 2, 0.25);
    }
  }));
}
pushVoid();

function executeAttack(id){
  const b = state.boss;
  const diff = b.diff;
  const list = getAttackList(b);
  const atk = list.find(a=>a.id===id);
  if(!atk) return;
  try { atk.fn(b, diff); }
  catch(e){ console.error(e); }
  // set cooldown handled by chooseAttack; for combo steps, add small
}

// ---------- Bullets update ----------
function updateBullets(dt){
  const p = state.player;
  const b = state.boss;
  for(let i=state.bullets.length-1;i>=0;i--){
    const bu = state.bullets[i];
    // gravity
    if(bu.gravity){ bu.vel.y += bu.gravity*dt; }
    // homing
    if(bu.homing && bu.owner==='boss'){
      const target = p.pos;
      const desired = new THREE.Vector3().subVectors(target, bu.mesh.position).normalize().multiplyScalar(8);
      bu.vel.lerp(desired, 0.02);
      // keep speed
      const sp = bu.vel.length();
      const targetSpeed = 9* (b.diff?b.diff.speed:1);
      if(sp>0) bu.vel.multiplyScalar(targetSpeed/sp);
    }
    if(bu.homing && bu.owner==='player' && p.cls.homing){
      // find boss
      const desired = new THREE.Vector3().subVectors(b.pos, bu.mesh.position).normalize().multiplyScalar(10);
      bu.vel.lerp(desired, 0.05);
      const sp = bu.vel.length();
      if(sp>0) bu.vel.multiplyScalar(20/sp);
    }
    bu.mesh.position.addScaledVector(bu.vel, dt);
    bu.life -= dt;
    // off-screen removal
    const pos = bu.mesh.position;
    if(bu.life<=0 || Math.abs(pos.x)>24 || Math.abs(pos.z)>24 || pos.y<-2 || pos.y>18){
      removeBullet(bu); continue;
    }
    // collisions
    if(bu.owner==='player'){
      // vs boss
      const d = pos.distanceTo(b.pos);
      if(d < 1.9){
        // weak point bonus
        let dmg = bu.damage * (state.player.damage);
        if(b.weakPoint){
          const wd = pos.distanceTo(b.weakPoint.getWorldPosition(new THREE.Vector3()));
          if(wd < 0.9) dmg *= 2.5;
        }
        b.hp -= dmg;
        spawnParticles(pos, b.data.accent, 6, 3);
        removeBullet(bu);
        if(b.hp<=0){ b.hp=0; endGame(true); }
        continue;
      }
    } else {
      // vs player
      if(state.invuln<=0){
        const d = pos.distanceTo(p.pos);
        if(d < 0.9 + bu.size*0.5){
          p.hp -= bu.damage * (state.boss.phase===3?1.1:1);
          spawnParticles(p.pos, 0xff4444, 8, 3);
          removeBullet(bu);
          state.shake = 0.4;
          if(p.hp<=0){ p.hp=0; endGame(false); }
          continue;
        }
      } else {
        // invuln: bullets pass? remove on contact maybe
        const d = pos.distanceTo(p.pos);
        if(d < 0.9){ removeBullet(bu); spawnParticles(pos, 0xaaaaaa, 4,2); continue; }
      }
    }
  }
}

// ---------- HUD ----------
function updateHud(){
  const p = state.player; const b = state.boss;
  if(!p||!b) return;
  document.getElementById('playerHpBar').style.width = (p.hp/p.maxHp*100)+'%';
  document.getElementById('playerHpText').textContent = Math.ceil(p.hp)+'/'+p.maxHp;
  document.getElementById('bossHpBar').style.width = (b.hp/b.maxHp*100)+'%';
  document.getElementById('bossHpText').textContent = Math.ceil(b.hp)+'/'+Math.ceil(b.maxHp);
  document.getElementById('phaseText').textContent = 'Phase '+b.phase + (b.phase===3?' — ENRAGED':'');
  const diff = getDiff(state.diffId);
  document.getElementById('infoText').textContent = document.getElementById('infoText').textContent || '';
}

// ---------- Main loop ----------
let last = performance.now();
function loop(now){
  const dt = Math.min(0.05, (now-last)/1000);
  last = now;
  if(state.running){
    state.time += dt;
    updatePlayer(dt);
    updateBoss(dt);
    updateBullets(dt);
    updateParticles(dt);
    updateHud();
    // shake
    if(state.shake>0){
      state.shake -= dt;
      camera.position.x = (Math.random()-0.5)*state.shake;
      camera.position.z = 16 + (Math.random()-0.5)*state.shake;
    } else {
      camera.position.x = 0; camera.position.z = 16;
    }
    camera.lookAt(0,0,0);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---------- Export for debug ----------
window.__state = state;
