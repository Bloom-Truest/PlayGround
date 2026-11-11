import * as THREE from 'three';
import { CHARACTERS, TEAMS, byId, byTeam } from './characters.js';

// ---------- Constants ----------
const COURT_W = 9;
const COURT_L = 18;
const NET_H = 2.43;
const GRAVITY = -22;
const PLAYER_SPEED = 6.5;
const AI_SPEED = 5.2;

// ---------- State ----------
const state = {
  mode: 'menu',
  playerCharId: null,
  playerTeam: 0, // 0 = user team, 1 = cpu
  teams: [[], []], // arrays of player objects
  ball: { pos: new THREE.Vector3(0, 3, 0), vel: new THREE.Vector3(0,0,0), lastHitTeam: -1, lastHitTime: 0, hits: 0, inPlay: false, server: null },
  score: [0,0],
  sets: [0,0],
  servingTeam: 0,
  setNumber: 1,
  firstServe: [true, true], // per team per set
  selectedChar: null,
  keys: {},
  cinematic: null,
  timeScale: 1,
  pointInProgress: false,
  rallyOver: false,
  pointer: new THREE.Vector2(),
};

let scene, camera, renderer, clock;
let courtGroup, ballMesh;
let players = []; // flat list of player objects
let humanPlayer = null;
let audioCtx = null;

// ---------- Audio ----------
function beep(freq=440,dur=0.08,vol=0.05){
  try{
    if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    const o=audioCtx.createOscillator(), g=audioCtx.createGain();
    o.frequency.value=freq; o.type='square';
    g.gain.value=vol; g.gain.exponentialRampToValueAtTime(0.0001,audioCtx.currentTime+dur);
    o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime+dur);
  }catch(e){}
}

// ---------- Init ----------
function init(){
  const canvas = document.getElementById('gameCanvas');
  renderer = new THREE.WebGLRenderer({canvas, antialias:true});
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1b3a);
  const hemi = new THREE.HemisphereLight(0x87ceeb,0x3a2a1a,0.4); scene.add(hemi);
  scene.fog = new THREE.Fog(0x0b1020, 40, 90);

  camera = new THREE.PerspectiveCamera(55, window.innerWidth/window.innerHeight, 0.1, 200);
  camera.position.set(0, 16, 20);

  // Lights
  const amb = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(amb);
  const dir = new THREE.DirectionalLight(0xffffff, 1.1);
  dir.position.set(10,25,10);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048,2048);
  dir.shadow.camera.left=-15;dir.shadow.camera.right=15;dir.shadow.camera.top=15;dir.shadow.camera.bottom=-15;
  scene.add(dir);
  const spot = new THREE.SpotLight(0xfff2cc, 0.6, 60, Math.PI/4, 0.4);
  spot.position.set(0,18,0); scene.add(spot);

  buildCourt();
  buildBall();

  clock = new THREE.Clock();

  window.addEventListener('resize', onResize);
  window.addEventListener('keydown', e=>{ state.keys[e.key.toLowerCase()]=true; if(e.key===' ') e.preventDefault(); });
  window.addEventListener('keyup', e=>{ state.keys[e.key.toLowerCase()]=false; });

  // UI wiring
  document.getElementById('btnPlay').onclick = ()=> showScreen('select');
  document.getElementById('btnRoster').onclick = ()=> { buildRoster(); showScreen('roster'); };
  document.getElementById('btnBackMenu').onclick = ()=> showScreen('menu');
  document.getElementById('btnBackMenu2').onclick = ()=> showScreen('menu');
  document.getElementById('btnStartMatch').onclick = startMatch;
  document.getElementById('btnRematch').onclick = ()=> { resetMatch(); startMatch(); };
  document.getElementById('btnMenu').onclick = ()=> { resetMatch(); showScreen('menu'); showHUD(false); };

  // mobile controls
  bindHold('cLeft', 'a');
  bindHold('cRight', 'd');
  bindHold('cUp', 'w');
  bindHold('cDown', 's');
  document.getElementById('cJump').addEventListener('touchstart', e=>{ e.preventDefault(); state.keys[' ']=true; });
  document.getElementById('cJump').addEventListener('touchend', e=>{ e.preventDefault(); state.keys[' ']=false; });
  document.getElementById('cServe').addEventListener('click', ()=> { state.keys['r']=true; setTimeout(()=>state.keys['r']=false,120); });
  document.getElementById('cFirst').addEventListener('click', ()=> { state.keys['f']=true; setTimeout(()=>state.keys['f']=false,120); });

  buildSelectGrid();
  hideLoading();
  animate();
}

function hideLoading(){ document.getElementById('loading').classList.add('hidden'); }

function onResize(){
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function showScreen(name){
  ['menu','roster','select','matchEnd'].forEach(s=>{
    const el=document.getElementById(s); if(el) el.classList.toggle('hidden', s!==name);
  });
  if(name!=='menu') {} 
}
function showHUD(v){ document.getElementById('hud').classList.toggle('hidden', !v); }

// ---------- Court ----------
function buildCourt(){
  courtGroup = new THREE.Group();
  // floor
  const floorGeo = new THREE.PlaneGeometry(COURT_W, COURT_L);
  const floorMat = new THREE.MeshStandardMaterial({color:0x8b5a2b, roughness:0.7});
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI/2;
  floor.receiveShadow = true;
  courtGroup.add(floor);

  // lines
  const lineMat = new THREE.MeshBasicMaterial({color:0xffffff});
  const addLine = (w,d,x,z)=>{
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w,d), lineMat);
    m.rotation.x=-Math.PI/2; m.position.set(x,0.01,z); courtGroup.add(m);
  };
  // boundary
  addLine(COURT_W,0.08,0,-COURT_L/2); addLine(COURT_W,0.08,0,COURT_L/2);
  addLine(0.08,COURT_L,-COURT_W/2,0); addLine(0.08,COURT_L,COURT_W/2,0);
  // center line
  addLine(COURT_W,0.08,0,0);
  // attack lines at 3m
  addLine(COURT_W,0.08,0,-3); addLine(COURT_W,0.08,0,3);

  // net
  const netMat = new THREE.MeshStandardMaterial({color:0xffffff, transparent:true, opacity:0.55});
  const net = new THREE.Mesh(new THREE.BoxGeometry(COURT_W, NET_H, 0.05), netMat);
  net.position.set(0, NET_H/2, 0);
  net.castShadow = true;
  courtGroup.add(net);
  // net top band
  const band = new THREE.Mesh(new THREE.BoxGeometry(COURT_W,0.08,0.08), new THREE.MeshStandardMaterial({color:0xffd700}));
  band.position.set(0, NET_H, 0); courtGroup.add(band);
  // posts
  const postMat = new THREE.MeshStandardMaterial({color:0x888888, metalness:0.6});
  const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,NET_H+0.5), postMat);
  postL.position.set(-COURT_W/2-0.1, (NET_H+0.5)/2, 0); courtGroup.add(postL);
  const postR = postL.clone(); postR.position.x = COURT_W/2+0.1; courtGroup.add(postR);

  // arena floor surround
  const surr = new THREE.Mesh(new THREE.PlaneGeometry(60,60), new THREE.MeshStandardMaterial({color:0x1a1f33}));
  surr.rotation.x=-Math.PI/2; surr.position.y=-0.02; courtGroup.add(surr);

  // simple stands
  for(let i=0;i<4;i++){
    const s = new THREE.Mesh(new THREE.BoxGeometry(50, 4, 6), new THREE.MeshStandardMaterial({color:0x222844}));
    const z = i<2 ? -COURT_L/2-6 : COURT_L/2+6;
    s.position.set(0,2,z); courtGroup.add(s);
  }

  scene.add(courtGroup);
}

function buildBall(){
  const g = new THREE.SphereGeometry(0.18, 24, 24);
  const m = new THREE.MeshStandardMaterial({color:0xf5f5f5, roughness:0.4});
  ballMesh = new THREE.Mesh(g,m);
  ballMesh.castShadow = true;
  scene.add(ballMesh);
  // trail
  window.__trail = [];
  for(let i=0;i<8;i++){
    const tm = new THREE.Mesh(new THREE.SphereGeometry(0.12,12,12), new THREE.MeshBasicMaterial({color:0xfff2cc, transparent:true, opacity:0.35-i*0.04}));
    scene.add(tm);
    window.__trail.push({mesh:tm, pos:new THREE.Vector3(0,10,0)});
  }
}

// ---------- Humanoid mesh ----------
function createHumanMesh(char){
  const group = new THREE.Group();
  const jerseyMat = new THREE.MeshStandardMaterial({color:char.color});
  const skinMat = new THREE.MeshStandardMaterial({color:char.skin});
  const hairMat = new THREE.MeshStandardMaterial({color:char.hair});
  const shortsMat = new THREE.MeshStandardMaterial({color:0x1a1a1a});
  const shoeMat = new THREE.MeshStandardMaterial({color:0xffffff});

  // torso
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.26,0.7,12), jerseyMat);
  torso.position.y = 1.05; torso.castShadow=true; group.add(torso);
  // head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16,16,16), skinMat);
  head.position.y = 1.55; head.castShadow=true; group.add(head);
  // hair
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.17,16,16), hairMat);
  hair.position.y = 1.6; hair.scale.y = 0.6; group.add(hair);
  // arms
  const armGeo = new THREE.CylinderGeometry(0.06,0.06,0.65,8);
  const armL = new THREE.Mesh(armGeo, skinMat); armL.position.set(-0.32,1.1,0); armL.rotation.z=0.3; group.add(armL);
  const armR = new THREE.Mesh(armGeo, skinMat); armR.position.set(0.32,1.1,0); armR.rotation.z=-0.3; group.add(armR);
  // legs
  const legGeo = new THREE.CylinderGeometry(0.08,0.07,0.7,8);
  const legL = new THREE.Mesh(legGeo, shortsMat); legL.position.set(-0.12,0.35,0); group.add(legL);
  const legR = new THREE.Mesh(legGeo, shortsMat); legR.position.set(0.12,0.35,0); group.add(legR);
  // shoes
  const shoeGeo = new THREE.BoxGeometry(0.12,0.08,0.2);
  const shoeL = new THREE.Mesh(shoeGeo, shoeMat); shoeL.position.set(-0.12,0.02,0.05); group.add(shoeL);
  const shoeR = new THREE.Mesh(shoeGeo, shoeMat); shoeR.position.set(0.12,0.02,0.05); group.add(shoeR);

  // number sprite
  const c = document.createElement('canvas'); c.width=64;c.height=64;
  const ctx=c.getContext('2d'); ctx.fillStyle=char.accent; ctx.font='bold 40px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(String(char.number),32,32);
  const tex=new THREE.CanvasTexture(c);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true}));
  sp.scale.set(0.6,0.6,1); sp.position.set(0,2.0,0); group.add(sp);

  group.userData.armL=armL; group.userData.armR=armR; group.userData.legL=legL; group.userData.legR=legR;
  return group;
}

// ---------- Player objects ----------
function makePlayer(char, teamIndex, index, isHuman){
  const mesh = createHumanMesh(char);
  scene.add(mesh);
  return {
    char, team: teamIndex, index, isHuman,
    mesh,
    pos: new THREE.Vector3(0,0,0),
    vel: new THREE.Vector3(0,0,0),
    onGround: true,
    target: new THREE.Vector3(0,0,0),
    state: 'idle',
    jumpCooldown: 0,
    hitCooldown: 0,
    basePos: new THREE.Vector3(0,0,0),
  };
}

function removePlayers(){
  players.forEach(p=> scene.remove(p.mesh));
  players=[];
  humanPlayer=null;
}

// ---------- Match flow ----------
function buildSelectGrid(){
  const grid = document.getElementById('selectGrid');
  grid.innerHTML='';
  CHARACTERS.forEach(c=>{
    const d=document.createElement('div');
    d.className='selectCard';
    d.innerHTML=`<div style="font-weight:700">${c.name}</div><div style="color:${c.color}">${c.teamName}</div><div>#${c.number} ${c.position}</div><div style="font-size:10px;color:#aaa">${c.specialty}</div>`;
    d.onclick=()=>{ document.querySelectorAll('.selectCard').forEach(x=>x.classList.remove('sel')); d.classList.add('sel'); state.selectedChar=c.id; };
    grid.appendChild(d);
  });
}

function buildRoster(){
  const list=document.getElementById('rosterList');
  list.innerHTML='';
  CHARACTERS.forEach(c=>{
    const d=document.createElement('div');
    d.className='rosterCard';
    d.innerHTML=`<div class="nm">${c.name} <span style="color:#888">#${c.number}</span></div><div class="tm">${c.teamName}</div><div>${c.position} · ${c.specialty}</div><div style="color:#aaa">PWR ${c.power} SPD ${c.speed} JMP ${c.jump}</div>`;
    list.appendChild(d);
  });
}

function startMatch(){
  if(!state.selectedChar){ alert('Select a player first'); return; }
  state.playerCharId = state.selectedChar;
  const pc = byId(state.playerCharId);
  // opponent team = different team
  const oppTeam = TEAMS.find(t=>t.id!==pc.team);
  state.playerTeam = 0;

  resetMatch();
  // build teams: 6 players each. User team: selected char + 5 teammates from same team
  const userPool = byTeam(pc.team).filter(c=>c.id!==pc.id);
  const userChars = [pc, ...userPool.slice(0,5)];
  const oppPool = byTeam(oppTeam.id);
  const oppChars = oppPool.slice(0,6);

  // positions
  const userBase = [
    new THREE.Vector3(0,0,6), new THREE.Vector3(-3,0,7), new THREE.Vector3(3,0,7),
    new THREE.Vector3(-1.5,0,5), new THREE.Vector3(1.5,0,5), new THREE.Vector3(0,0,8)
  ];
  const oppBase = [
    new THREE.Vector3(0,0,-6), new THREE.Vector3(-3,0,-7), new THREE.Vector3(3,0,-7),
    new THREE.Vector3(-1.5,0,-5), new THREE.Vector3(1.5,0,-5), new THREE.Vector3(0,0,-8)
  ];

  removePlayers();
  state.teams=[[],[]];
  userChars.forEach((c,i)=>{
    const p = makePlayer(c,0,i, c.id===pc.id);
    p.basePos.copy(userBase[i]);
    p.pos.copy(userBase[i]);
    p.mesh.position.copy(p.pos);
    state.teams[0].push(p);
    players.push(p);
    if(p.isHuman) humanPlayer=p;
  });
  oppChars.forEach((c,i)=>{
    const p = makePlayer(c,1,i,false);
    p.basePos.copy(oppBase[i]);
    p.pos.copy(oppBase[i]);
    p.mesh.position.copy(p.pos);
    state.teams[1].push(p);
    players.push(p);
  });

  // serving team random
  state.servingTeam = Math.random()<0.5?0:1;
  state.firstServe=[true,true];
  state.score=[0,0]; state.sets=[0,0]; state.setNumber=1;

  document.getElementById('team0Name').textContent = TEAMS.find(t=>t.id===pc.team).name;
  document.getElementById('team1Name').textContent = oppTeam.name;

  showScreen(null);
  showHUD(true);
  state.mode='playing';
  resetBallForServe();
  updateScoreboard();
}

function resetMatch(){
  state.score=[0,0]; state.sets=[0,0]; state.setNumber=1;
  state.firstServe=[true,true];
  removePlayers();
  state.mode='menu';
}

function resetBallForServe(){
  state.ball.inPlay=false;
  state.ball.hits=0;
  state.ball.lastHitTeam=-1;
  // place ball at server
  const server = getServerPlayer();
  state.ball.server = server;
  const side = server.team===0? 1 : -1; // z sign for back
  state.ball.pos.set(server.pos.x, 2.2, server.pos.z - (server.team===0? 0.5 : -0.5));
  // Actually server on their side; ball above
  state.ball.pos.set(server.pos.x, 2.5, server.pos.z);
  state.ball.vel.set(0,0,0);
  state.pointInProgress=false;
  state.rallyOver=false;
  state.info = 'Press R to serve' + (state.firstServe[server.team]?' (F = First Serve)':'');
  updateInfo();
}

function getServerPlayer(){
  // rotation: index based on score sum
  const team = state.servingTeam;
  const idx = (state.score[0]+state.score[1]) % 6;
  return state.teams[team][idx];
}

// ---------- Serve ----------
function performServe(useFirst){
  if(state.ball.inPlay) return;
  const server = state.ball.server;
  const team = server.team;
  const isFirst = useFirst && state.firstServe[team];
  if(isFirst){
    state.firstServe[team]=false;
    startCinematic('firstServe', 1.3);
    beep(660,0.12,0.08);
  }
  const targetZ = team===0 ? -COURT_L/2+2 : COURT_L/2-2;
  const targetX = (Math.random()-0.5)*4;
  const serveSpeed = isFirst ? 15 : 10;
  // recompute first flag usage
  // (useFirst already handled)
  const from = state.ball.pos.clone();
  const to = new THREE.Vector3(targetX, 0.5, targetZ);
  const T = isFirst ? 0.85 : 1.05;
  const v = computeVelocity(from, to, T, 1.0);
  // scale horizontal speed
  v.x *= (serveSpeed/12); v.z *= (serveSpeed/12);
  state.ball.vel.copy(v);
  state.ball.inPlay=true;
  state.ball.lastHitTeam=team;
  state.ball.lastHitTime=performance.now()/1000;
  state.ball.hits=1;
  state.pointInProgress=true;
  if(useFirst) { state.ball.firstServe=true; }
  else state.ball.firstServe=false;
  beep(520,0.06,0.06);
}

function computeVelocity(from, to, T, mult=1){
  const v = new THREE.Vector3();
  v.x = (to.x-from.x)/T;
  v.z = (to.z-from.z)/T;
  v.y = (to.y - from.y)/T - 0.5*GRAVITY*T;
  v.multiplyScalar(mult);
  // adjust T? keep simple
  return v;
}

// ---------- Hit logic ----------
function hitBall(player, type){
  const now = performance.now()/1000;
  if(now - state.ball.lastHitTime < 0.25) return false;
  // must be reachable
  const d = state.ball.pos.distanceTo(player.mesh.position);
  if(d > 2.2) return false;
  // type overrides
  const team = player.team;
  const opp = 1-team;
  let target;
  if(type==='serve') return false; // handled
  if(type==='bump' || type==='dig'){
    // pass to setter
    const setter = state.teams[team].find(p=>p.char.position==='Setter') || state.teams[team][0];
    target = new THREE.Vector3(setter.pos.x, 0, setter.pos.z - (team===0?1:-1)*0.5);
    // arc high
    const from = state.ball.pos.clone();
    const T = 0.8;
    const v = computeVelocity(from, new THREE.Vector3(target.x, 2.4, target.z), T);
    state.ball.vel.copy(v);
  } else if(type==='set'){
    // set to spiker approach
    const hitters = state.teams[team].filter(p=>p.char.position!=='Setter');
    const spiker = hitters[Math.floor(Math.random()*hitters.length)];
    const netZ = team===0 ? -2 : 2;
    target = new THREE.Vector3(spiker.pos.x, 0, netZ);
    const from = state.ball.pos.clone();
    const T = 0.7;
    const v = computeVelocity(from, new THREE.Vector3(target.x, 3.2, target.z), T);
    state.ball.vel.copy(v);
  } else if(type==='spike'){
    const targetZ = team===0 ? -COURT_L/2+1.5 : COURT_L/2-1.5;
    const targetX = (Math.random()-0.5)*3;
    const from = state.ball.pos.clone();
    const T = 0.45;
    const v = computeVelocity(from, new THREE.Vector3(targetX, 0.3, targetZ), T);
    v.y = Math.min(v.y, -4);
    state.ball.vel.copy(v);
    startCinematic('spike', 0.7);
    beep(880,0.1,0.08);
  } else if(type==='block'){
    const from = state.ball.pos.clone();
    // reflect
    state.ball.vel.z *= -0.8;
    state.ball.vel.y = 4;
    startCinematic('block', 0.5);
    beep(330,0.08,0.07);
  }
  state.ball.lastHitTeam=team;
  state.ball.lastHitTime=now;
  state.ball.hits++;
  player.mesh.scale.set(1.15,0.85,1.15);
  setTimeout(()=>{ if(player.mesh) player.mesh.scale.set(1,1,1); },120);
  return true;
}

function startCinematic(type, dur){
  // capture current camera
  state.cinematic = { type, t:0, dur, 
    startPos: camera.position.clone(),
    // target positions per type
  };
  state.timeScale = 0.35;
  // set end target lazily in update
  state.cinematic.endPos = camera.position.clone();
  if(type==='firstServe'){
    state.cinematic.endPos = new THREE.Vector3(0, 8, state.servingTeam===0? 12 : -12);
  } else if(type==='spike'){
    state.cinematic.endPos = new THREE.Vector3(0, 6, 0);
  } else if(type==='block'){
    state.cinematic.endPos = new THREE.Vector3(0, 5, 2);
  }
  state.cinematic.endLook = new THREE.Vector3(0,2,0);
}

// ---------- AI decision ----------
function aiUpdate(player, dt){
  // movement target
  const team = player.team;
  const opp = 1-team;
  const ball = state.ball;
  // desired x track ball, z based on role/formation
  let desiredZ = player.basePos.z;
  if(ball.inPlay){
    if(ball.lastHitTeam === team){
      // attacking: move to support / net
      desiredZ = team===0 ? Math.min(player.basePos.z, -1) : Math.max(player.basePos.z, 1);
    } else {
      // defending/receiving: move toward ball landing
      desiredZ = player.basePos.z;
    }
  }
  let desiredX = player.basePos.x;
  if(ball.inPlay){
    // track ball x within half court
    desiredX = THREE.MathUtils.clamp(ball.pos.x * 0.6 + player.basePos.x*0.4, -COURT_W/2+0.8, COURT_W/2-0.8);
  }
  // if this player is nearest to ball on their side, go to ball
  const ballOnTeamSide = team===0 ? ball.pos.z > 0 : ball.pos.z < 0;
  if(ball.inPlay && ballOnTeamSide){
    // find nearest teammate
    const mates = state.teams[team];
    let nearest = mates[0], nd=1e9;
    mates.forEach(m=>{ const d=m.pos.distanceTo(new THREE.Vector3(ball.pos.x,0,ball.pos.z)); if(d<nd){nd=d;nearest=m;} });
    if(nearest===player){
      desiredX = THREE.MathUtils.clamp(ball.pos.x, -COURT_W/2+0.8, COURT_W/2-0.8);
      desiredZ = THREE.MathUtils.clamp(ball.pos.z, team===0?0.5:-COURT_L/2+0.5, team===0?COURT_L/2-0.5:-0.5);
    }
  }
  const target = new THREE.Vector3(desiredX,0,desiredZ);
  const dir = target.sub(player.pos); dir.y=0;
  const dist = dir.length();
  if(dist > 0.1){
    dir.normalize();
    const sp = AI_SPEED * (player.char.speed/80);
    player.pos.x += dir.x * sp * dt * state.timeScale;
    player.pos.z += dir.z * sp * dt * state.timeScale;
  }
  // clamp to court
  player.pos.x = THREE.MathUtils.clamp(player.pos.x, -COURT_W/2+0.5, COURT_W/2-0.5);
  player.pos.z = THREE.MathUtils.clamp(player.pos.z, -COURT_L/2+0.5, COURT_L/2-0.5);

  // jump/hit decision
  player.jumpCooldown -= dt;
  if(player.onGround && ball.inPlay){
    const ballOnTeamSide = team===0 ? ball.pos.z > 0 : ball.pos.z < 0;
    if(ballOnTeamSide){
      const mates = state.teams[team];
      let nearest = mates[0], nd=1e9;
      mates.forEach(m=>{ const d=m.pos.distanceTo(new THREE.Vector3(ball.pos.x,0,ball.pos.z)); if(d<nd){nd=d;nearest=m;} });
      if(nearest===player && nd < 2.4 && ball.pos.y < 2.8 && ball.pos.y > 0.4 && player.jumpCooldown<=0){
        // jump
        player.vel.y = 7 + player.char.jump/20;
        player.onGround=false;
        player.jumpCooldown=0.6;
        // decide hit type
        let type='bump';
        if(ball.pos.y > 1.9){
          if(Math.abs(player.pos.z) < 3.5) type='spike';
          else type='set';
        } else {
          type='bump';
        }
        // delay hit slightly until apex
        setTimeout(()=>{ if(state.mode==='playing') hitBall(player,type); }, 180);
      }
    }
  }
  // gravity
  // auto-receive when opponent just hit and ball descending near
  if(player.onGround && state.ball.inPlay && state.ball.lastHitTeam !== player.team && state.ball.vel.y < 0){
    const d = state.ball.pos.distanceTo(player.mesh.position);
    if(d < 1.9 && state.ball.pos.y < 2.0 && state.ball.pos.y > 0.4 && player.jumpCooldown<=0){
      player.vel.y = 6 + player.char.jump/22;
      player.onGround = false;
      player.jumpCooldown = 0.7;
      setTimeout(()=>{ if(state.mode==='playing') hitBall(player,'bump'); }, 140);
    }
  }
  if(!player.onGround){
    player.vel.y += GRAVITY*dt*state.timeScale;
    player.pos.y += player.vel.y*dt*state.timeScale;
    if(player.pos.y<=0){ player.pos.y=0; player.vel.y=0; player.onGround=true; }
  }
  player.mesh.position.copy(player.pos);
  // face direction
  if(ball.inPlay){
    const look = new THREE.Vector3(ball.pos.x, player.pos.y, ball.pos.z);
    player.mesh.lookAt(look);
  }
  // animate arms/legs
  animateHuman(player, dt);
}

function animateHuman(player, dt){
  const t = performance.now()/300;
  const m = player.mesh;
  if(!player.onGround){
    m.userData.armL.rotation.x = -1.2;
    m.userData.armR.rotation.x = -1.2;
    m.userData.legL.rotation.x = 0.4;
    m.userData.legR.rotation.x = -0.4;
  } else {
    const speed = player.vel.length();
    const swing = Math.sin(t* (speed>0.5?8:2)) * (speed>0.5?0.6:0.05);
    m.userData.armL.rotation.x = swing;
    m.userData.armR.rotation.x = -swing;
    m.userData.legL.rotation.x = -swing;
    m.userData.legR.rotation.x = swing;
  }
}

// ---------- Human update ----------
function humanUpdate(player, dt){
  const speed = PLAYER_SPEED * (player.char.speed/80);
  let mx=0, mz=0;
  if(state.keys['a']||state.keys['arrowleft']) mx -= 1;
  if(state.keys['d']||state.keys['arrowright']) mx += 1;
  if(state.keys['w']||state.keys['arrowup']) mz -= 1;
  if(state.keys['s']||state.keys['arrowdown']) mz += 1;
  // normalize
  const len = Math.hypot(mx,mz);
  if(len>0){ mx/=len; mz/=len; }
  player.pos.x += mx*speed*dt*state.timeScale;
  player.pos.z += mz*speed*dt*state.timeScale;
  player.pos.x = THREE.MathUtils.clamp(player.pos.x, -COURT_W/2+0.5, COURT_W/2-0.5);
  player.pos.z = THREE.MathUtils.clamp(player.pos.z, 0.5, COURT_L/2-0.5); // stay on own side (z>0)

  // jump
  if(state.keys[' '] && player.onGround){
    player.vel.y = 7 + player.char.jump/22;
    player.onGround=false;
    state.keys[' '] = false; // consume
    // hit type decision after short delay
    setTimeout(()=>{
      if(state.mode!=='playing') return;
      const ball = state.ball;
      const d = ball.pos.distanceTo(player.mesh.position);
      if(d < 2.2 && ball.inPlay){
        let type='bump';
        if(ball.pos.y > 1.9){
          if(Math.abs(player.pos.z) < 3.5) type='spike'; else type='set';
        }
        hitBall(player,type);
      }
    }, 160);
  }

  // serve input
  if((state.keys['r']) && !state.ball.inPlay){
    state.keys['r']=false;
    const useFirst = !!state.keys['f'];
    if(useFirst) state.keys['f']=false;
    performServe(useFirst);
  }
  // first serve arm toggle
  if(state.keys['f'] && !state.ball.inPlay){
    // just mark available; handled in performServe via key check? We'll track a flag
  }

  // auto-receive when opponent just hit and ball descending near
  if(player.onGround && state.ball.inPlay && state.ball.lastHitTeam !== player.team && state.ball.vel.y < 0){
    const d = state.ball.pos.distanceTo(player.mesh.position);
    if(d < 1.9 && state.ball.pos.y < 2.0 && state.ball.pos.y > 0.4 && player.jumpCooldown<=0){
      player.vel.y = 6 + player.char.jump/22;
      player.onGround = false;
      player.jumpCooldown = 0.7;
      setTimeout(()=>{ if(state.mode==='playing') hitBall(player,'bump'); }, 140);
    }
  }
  if(!player.onGround){
    player.vel.y += GRAVITY*dt*state.timeScale;
    player.pos.y += player.vel.y*dt*state.timeScale;
    if(player.pos.y<=0){ player.pos.y=0; player.vel.y=0; player.onGround=true; }
  }
  player.mesh.position.copy(player.pos);
  if(state.ball.inPlay){
    player.mesh.lookAt(new THREE.Vector3(state.ball.pos.x, player.pos.y, state.ball.pos.z));
  }
  animateHuman(player, dt);
}

// ---------- Ball update ----------
function updateBall(dt){
  const b = state.ball;
  if(!b.inPlay) {
    // follow server
    if(b.server){ b.pos.set(b.server.pos.x, 2.5, b.server.pos.z); }
    ballMesh.position.copy(b.pos);
    return;
  }
  b.vel.y += GRAVITY*dt*state.timeScale;
  b.pos.x += b.vel.x*dt*state.timeScale;
  b.pos.y += b.vel.y*dt*state.timeScale;
  b.pos.z += b.vel.z*dt*state.timeScale;

  // net collision
  if(Math.abs(b.pos.z) < 0.15 && b.pos.y < NET_H && Math.abs(b.pos.x) < COURT_W/2){
    b.vel.z *= -0.6;
    b.vel.y *= 0.5;
    b.pos.z += b.vel.z*dt*state.timeScale*2;
    beep(220,0.06,0.05);
  }

  // side walls
  if(Math.abs(b.pos.x) > COURT_W/2){
    b.pos.x = Math.sign(b.pos.x)*COURT_W/2;
    b.vel.x *= -0.6;
  }

  // floor -> point
  if(b.pos.y <= 0.15){
    b.pos.y = 0.15;
    // determine scoring team: if ball on z>0 side, team0 loses? ball landed on team0 side => opponent (team1) scores
    const scoringTeam = b.pos.z > 0 ? 1 : 0;
    endRally(scoringTeam);
    return;
  }

  // out of court (z beyond baselines) -> point to other team
  if(Math.abs(b.pos.z) > COURT_L/2 + 1){
    const scoringTeam = b.pos.z > 0 ? 0 : 1; // if went out on south, north (opp of south? south is team0) -> team0? let's: out beyond team0 baseline (z>COURT_L/2): team1 scores? Actually if ball lands out on team0's side, team1 gets point. If out on team1's side (z<-COURT_L/2), team0 gets point.
    // fix:
    const st = b.pos.z > COURT_L/2 ? 1 : 0;
    endRally(st);
    return;
  }

  ballMesh.position.copy(b.pos);
}

function endRally(scoringTeam){
  if(state.rallyOver) return;
  state.rallyOver=true;
  state.ball.inPlay=false;
  state.score[scoringTeam]++;
  beep(scoringTeam===0?784:220,0.15,0.08);
  // cinematic point
  startCinematic('point', 1.2);
  state.timeScale=0.4;
  // banner
  const banner = document.getElementById('pointBanner');
  banner.textContent = scoringTeam===0 ? 'POINT!' : 'CPU POINT';
  banner.classList.remove('hidden');
  setTimeout(()=> banner.classList.add('hidden'), 1200);

  // check set win
  setTimeout(()=>{
    state.timeScale=1;
    state.cinematic=null;
    checkSetWin(scoringTeam);
  }, 1400);
}

function checkSetWin(lastScorer){
  const TARGET=15;
  const s0=state.score[0], s1=state.score[1];
  let setWon=-1;
  if(s0>=TARGET && s0-s1>=2) setWon=0;
  if(s1>=TARGET && s1-s0>=2) setWon=1;
  if(setWon>=0){
    state.sets[setWon]++;
    if(state.sets[setWon]>=2){
      // match over
      endMatch(setWon);
      return;
    }
    // new set
    state.setNumber++;
    state.score=[0,0];
    state.firstServe=[true,true];
    state.servingTeam = setWon===0?1:0; // loser serves? alternate: winner serves
    // reset positions
    resetPositions();
    resetBallForServe();
    updateScoreboard();
  } else {
    // continue: serving team = scorer (rally scoring: scorer serves)
    state.servingTeam = lastScorer;
    resetPositions();
    resetBallForServe();
    updateScoreboard();
  }
}

function resetPositions(){
  const userBase = [
    new THREE.Vector3(0,0,6), new THREE.Vector3(-3,0,7), new THREE.Vector3(3,0,7),
    new THREE.Vector3(-1.5,0,5), new THREE.Vector3(1.5,0,5), new THREE.Vector3(0,0,8)
  ];
  const oppBase = [
    new THREE.Vector3(0,0,-6), new THREE.Vector3(-3,0,-7), new THREE.Vector3(3,0,-7),
    new THREE.Vector3(-1.5,0,-5), new THREE.Vector3(1.5,0,-5), new THREE.Vector3(0,0,-8)
  ];
  state.teams[0].forEach((p,i)=>{ p.pos.copy(userBase[i]); p.vel.set(0,0,0); p.onGround=true; p.mesh.position.copy(p.pos); });
  state.teams[1].forEach((p,i)=>{ p.pos.copy(oppBase[i]); p.vel.set(0,0,0); p.onGround=true; p.mesh.position.copy(p.pos); });
}

function endMatch(winner){
  state.mode='matchend';
  showHUD(false);
  const el=document.getElementById('matchResult');
  el.textContent = winner===0 ? 'YOU WIN!' : 'CPU WINS';
  document.getElementById('matchEnd').classList.remove('hidden');
}

function updateScoreboard(){
  document.getElementById('score0').textContent=state.score[0];
  document.getElementById('score1').textContent=state.score[1];
  document.getElementById('sets0').textContent=state.sets[0];
  document.getElementById('sets1').textContent=state.sets[1];
}

function updateInfo(){
  const el=document.getElementById('info');
  if(el) el.textContent = state.info||'';
}

// ---------- Camera update ----------
function updateCamera(dt){
  if(state.cinematic && state.cinematic.active){
    const c=state.cinematic;
    c.t += dt;
    const k = Math.min(1, c.t/c.dur);
    const ease = k<0.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
    camera.position.lerpVectors(c.startPos, c.endPos, ease);
    const look = new THREE.Vector3().lerpVectors(new THREE.Vector3(0,2,0), c.endLook, ease);
    camera.lookAt(look);
    if(k>=1){
      state.cinematic.active=false;
      state.cinematic=null;
      state.timeScale=1;
    }
    return;
  }
  // follow ball
  const desired = new THREE.Vector3(state.ball.pos.x*0.4, 15, state.servingTeam===0? 18 : -18);
  // keep camera on player side always south
  desired.z = 18;
  camera.position.lerp(desired, 0.04);
  const lookTarget = new THREE.Vector3(state.ball.pos.x*0.3, 1.5, state.ball.pos.z*0.3);
  camera.lookAt(lookTarget);
}

// ---------- Main loop ----------
function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const tdt = dt * state.timeScale;

  if(state.mode==='playing'){
    // update players
    state.teams[0].forEach(p=>{
      if(p.isHuman) humanUpdate(p, dt); else aiUpdate(p, dt);
    });
    state.teams[1].forEach(p=> aiUpdate(p, dt));

    updateBall(dt);
    updateCamera(dt);
    updateInfoDynamic();
  } else {
    updateCamera(dt);
  }

  // ball mesh sync (for non-inplay already done)
  if(state.ball.inPlay) ballMesh.position.copy(state.ball.pos);
  else if(state.ball.server) { state.ball.pos.set(state.ball.server.pos.x,2.5,state.ball.server.pos.z); ballMesh.position.copy(state.ball.pos); }
  // trail update
  if(window.__trail){
    for(let i=window.__trail.length-1;i>0;i--){
      window.__trail[i].pos.copy(window.__trail[i-1].pos);
    }
    window.__trail[0].pos.copy(state.ball.pos);
    window.__trail.forEach((t,i)=>{ t.mesh.position.copy(t.pos); t.mesh.material.opacity = state.ball.inPlay ? (0.3-i*0.035) : 0; });
  }

  renderer.render(scene, camera);
}

function updateInfoDynamic(){
  if(state.ball.inPlay){
    state.info = '';
  } else {
    state.info = 'Press R to serve' + (state.firstServe[state.servingTeam]?'  (F = First Serve)':'');
  }
  updateInfo();
  updateScoreboard();
}

function bindHold(id, key){
  const el=document.getElementById(id);
  if(!el) return;
  el.addEventListener('touchstart', e=>{ e.preventDefault(); state.keys[key]=true; });
  el.addEventListener('touchend', e=>{ e.preventDefault(); state.keys[key]=false; });
  el.addEventListener('mousedown', ()=> state.keys[key]=true);
  el.addEventListener('mouseup', ()=> state.keys[key]=false);
}

// ---------- Start ----------
init();
