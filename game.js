const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// ---------- Input ----------
const keys = {};
const prevKeys = {};
window.addEventListener('keydown', e => { keys[e.code] = true; });
window.addEventListener('keyup', e => { keys[e.code] = false; });

// Touch controls
const touchDiv = document.getElementById('touch');
function makeTouch() {
  touchDiv.innerHTML = '';
  const pad = document.createElement('div'); pad.className='pad';
  const dirs = [['','up',''],['left','','right'],['','down','']];
  // map
  const map = {up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'};
  for (let r=0;r<3;r++){
    for (let c=0;c<3;c++){
      const d = dirs[r][c];
      const b = document.createElement('button');
      if (d){ b.textContent = d[0].toUpperCase(); b.addEventListener('touchstart',e=>{e.preventDefault();keys[map[d]]=true;}); b.addEventListener('touchend',e=>{e.preventDefault();keys[map[d]]=false;}); b.addEventListener('mousedown',()=>keys[map[d]]=true); b.addEventListener('mouseup',()=>keys[map[d]]=false);}
      else { b.style.visibility='hidden'; }
      pad.appendChild(b);
    }
  }
  const acts = document.createElement('div'); acts.className='acts';
  const actMap = [{label:'PASS',code:'Space'},{label:'SHOT',code:'KeyX'},{label:'TACK',code:'KeyZ'},{label:'SPRT',code:'KeyC'}];
  actMap.forEach(a=>{
    const b=document.createElement('button'); b.textContent=a.label;
    b.addEventListener('touchstart',e=>{e.preventDefault();keys[a.code]=true;});
    b.addEventListener('touchend',e=>{e.preventDefault();keys[a.code]=false;});
    b.addEventListener('mousedown',()=>keys[a.code]=true);
    b.addEventListener('mouseup',()=>keys[a.code]=false);
    acts.appendChild(b);
  });
  touchDiv.appendChild(pad);
  touchDiv.appendChild(acts);
}
makeTouch();

// ---------- Helpers ----------
function teamById(id){ return TEAMS.find(t=>t.id===id); }
function clonePlayers(team){ return team.players.map((p,i)=>({...p})); }

function formationPositions(formation, side){
  const parts = formation.split('-').map(Number);
  // parts: defenders, midfielders, forwards (GK implicit)
  const lines = [];
  // GK
  lines.push([{x: side==='left'?0.06:0.94, y:0.5}]);
  let xBase = side==='left' ? 0.22 : 0.78;
  const dir = side==='left'?1:-1;
  const groups = parts.length; // e.g. 3
  // x positions from back to front
  const xs = [];
  for (let i=0;i<parts.length;i++){
    const frac = (i+1)/(parts.length+1);
    xs.push(side==='left' ? 0.18 + frac*0.62 : 0.82 - frac*0.62);
  }
  parts.forEach((count,li)=>{
    const pts=[];
    for (let i=0;i<count;i++){
      const y = (i+1)/(count+1);
      pts.push({x: xs[li], y: y});
    }
    lines.push(pts);
  });
  // flatten: GK then defenders... but order should match players array? We'll just assign in order of lines; players array order roughly GK,DF...,MF...,FW...
  const flat=[];
  for (const g of lines) for (const p of g) flat.push(p);
  return flat;
}

// ---------- Game State ----------
let state = 'menu'; // menu, teamSelect, match, result, story, controls
let buttons = [];
let hover = null;
let mouseX=0, mouseY=0;
canvas.addEventListener('mousemove', e=>{ const r=canvas.getBoundingClientRect(); mouseX=(e.clientX-r.left)*(W/r.width); mouseY=(e.clientY-r.top)*(H/r.height); });
canvas.addEventListener('click', e=>{ const r=canvas.getBoundingClientRect(); const x=(e.clientX-r.left)*(W/r.width); const y=(e.clientY-r.top)*(H/r.height); handleClick(x,y); });
canvas.addEventListener('touchstart', e=>{ if(e.touches.length){ const t=e.touches[0]; const r=canvas.getBoundingClientRect(); handleClick((t.clientX-r.left)*(W/r.width),(t.clientY-r.top)*(H/r.height)); } });

function handleClick(x,y){
  for (const b of buttons){
    if (x>=b.x && x<=b.x+b.w && y>=b.y && y<=b.y+b.h){
      b.action(); return;
    }
  }
}

// ---------- Match Data ----------
let match = null;
let specialFx = null; // {text, timer}
let messageFx = null; // {text, timer}
let controlledPlayer = null;

function startMatch(teamAId, teamBId){
  const tA = teamById(teamAId), tB = teamById(teamBId);
  const posA = formationPositions(tA.formation,'left');
  const posB = formationPositions(tB.formation,'right');
  const playersA = clonePlayers(tA).map((p,i)=>({
    team:tA, data:p, idx:i, side:'A',
    x: posA[i].x*W, y: posA[i].y*H,
    homeX: posA[i].x*W, homeY: posA[i].y*H,
    vx:0,vy:0, spirit:p.spirit, maxSpirit:p.spirit, controlled:false, cooldown:0
  }));
  const playersB = clonePlayers(tB).map((p,i)=>({
    team:tB, data:p, idx:i, side:'B',
    x: posB[i].x*W, y: posB[i].y*H,
    homeX: posB[i].x*W, homeY: posB[i].y*H,
    vx:0,vy:0, spirit:p.spirit, maxSpirit:p.spirit, controlled:false, cooldown:0
  }));
  match = {
    teamA:tA, teamB:tB,
    playersA, playersB,
    ball:{x:W/2,y:H/2,vx:0,vy:0,owner:null,ownerSide:null,ownerPlayer:null, cooldown:0},
    scoreA:0, scoreB:0,
    time:180, running:true,
    controlledSide:'A',
    stadium: STADIUMS[Math.floor(Math.random()*STADIUMS.length)],
    goalPause:0
  };
  // kickoff: team A gets ball at center MF
  giveKickoff(match,'A');
  state='match';
  buttons=[];
}

function giveKickoff(m, side){
  const players = side==='A'? m.playersA : m.playersB;
  // find MF with highest pass or idx 9
  let p = players.find(pl=>pl.data.pos==='MF') || players[5];
  // move to center
  p.x = W/2 + (side==='A'? -20 : 20); p.y = H/2;
  m.ball.ownerPlayer = p; m.ball.ownerSide = side; m.ball.owner = 'player';
  p.hasBall = true;
}

function resetPositionsAfterGoal(scoringSide){
  const m = match;
  const posA = formationPositions(m.teamA.formation,'left');
  const posB = formationPositions(m.teamB.formation,'right');
  m.playersA.forEach((p,i)=>{ p.x=posA[i].x*W; p.y=posA[i].y*H; p.homeX=p.x; p.homeY=p.y; p.vx=0;p.vy=0; p.hasBall=false; });
  m.playersB.forEach((p,i)=>{ p.x=posB[i].x*W; p.y=posB[i].y*H; p.homeX=p.x; p.homeY=p.y; p.vx=0;p.vy=0; p.hasBall=false; });
  // conceding team (opposite of scoring) kicks off
  const kickoffSide = scoringSide==='A'?'B':'A';
  giveKickoff(m, kickoffSide);
}

// ---------- Update ----------
let lastTime = performance.now();
function loop(now){
  const dt = Math.min(0.05, (now-lastTime)/1000);
  lastTime = now;
  update(dt);
  draw();
  if (state==='match') Object.assign(prevKeys, keys); else { for (const k in prevKeys) delete prevKeys[k]; }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function update(dt){
  if (state==='match' && match){
    updateMatch(dt);
  }
  // decay fx
  if (specialFx){ specialFx.timer -= dt; if (specialFx.timer<=0) specialFx=null; }
  if (messageFx){ messageFx.timer -= dt; if (messageFx.timer<=0) messageFx=null; }
}

function updateMatch(dt){
  const m = match;
  window.__match = m; window.__state = state; window.__controlled = controlledPlayer;
  if (m.goalPause && m.goalPause > 0){
    m.goalPause -= dt;
    if (m.goalPause <= 0){ m.goalPause = 0; m.running = true; }
    return;
  }
  if (!m.running) return;
  // timer
  m.time -= dt;
  if (m.time <= 0){ m.time=0; m.running=false; state='result'; return; }

  // controlled player selection
  const humanPlayers = m.controlledSide==='A'? m.playersA : m.playersB;
  const aiPlayers = m.controlledSide==='A'? m.playersB : m.playersA;
  // determine controlled
  let carrier = humanPlayers.find(p=>p.hasBall);
  if (carrier) controlledPlayer = carrier;
  else {
    // nearest to ball
    let best=null,bestD=1e9;
    for (const p of humanPlayers){ const d=Math.hypot(p.x-m.ball.x,p.y-m.ball.y); if(d<bestD){bestD=d;best=p;} }
    controlledPlayer = best;
  }
  // mark controlled flags
  for (const p of humanPlayers) p.controlled = (p===controlledPlayer);
  for (const p of aiPlayers) p.controlled = false;

  // human movement
  const p = controlledPlayer;
  const speed = (p.data.speed/10)* (keys['KeyC']? 4.2 : 3.0);
  let mx=0,my=0;
  if (keys['ArrowUp']||keys['KeyW']) my -=1;
  if (keys['ArrowDown']||keys['KeyS']) my +=1;
  if (keys['ArrowLeft']||keys['KeyA']) mx -=1;
  if (keys['ArrowRight']||keys['KeyD']) mx +=1;
  const len = Math.hypot(mx,my)||1;
  if (mx||my){
    p.vx = (mx/len)*speed; p.vy=(my/len)*speed;
    p.facing = Math.atan2(my,mx);
  } else {
    p.vx *= 0.7; p.vy *=0.7;
  }
  // sprint consumes spirit
  if ((keys['KeyC']) && (mx||my) && p.spirit>0){ p.spirit = Math.max(0, p.spirit - 0.3); }

  // edge actions
  const passPress = edge('Space');
  const shootPress = edge('KeyX');
  const tacklePress = edge('KeyZ');
  if (p.hasBall){
    if (passPress) doPass(p, m);
    if (shootPress) doShoot(p, m);
  } else {
    if (tacklePress) doTackle(p, m);
  }

  // AI movement for non-controlled players
  updateAI(m, humanPlayers, controlledPlayer, 'human');
  updateAI(m, aiPlayers, null, 'ai');

  // integrate player positions
  const all = [...m.playersA, ...m.playersB];
  for (const pl of all){
    if (pl===controlledPlayer){
      pl.x += pl.vx; pl.y += pl.vy;
    } else {
      pl.x += pl.vx; pl.y += pl.vy;
    }
    // clamp to field
    pl.x = Math.max(15, Math.min(W-15, pl.x));
    pl.y = Math.max(15, Math.min(H-15, pl.y));
    // cooldown
    if (pl.cooldown>0) pl.cooldown -= dt;
    // spirit regen
    pl.spirit = Math.min(pl.maxSpirit, pl.spirit + 0.15);
    // hasBall sync
  }

  // ball update
  updateBall(m, dt);

  // possession assignment if loose
  if (!m.ball.ownerPlayer && m.ball.cooldown<=0){
    // find nearest player
    let best=null,bestD=24;
    for (const pl of all){
      const d=Math.hypot(pl.x-m.ball.x, pl.y-m.ball.y);
      if (d<bestD && pl.cooldown<=0){ bestD=d; best=pl; }
    }
    if (best){
      m.ball.ownerPlayer = best;
      m.ball.ownerSide = best.side;
      best.hasBall = true;
      best.cooldown = 0.3;
    }
  }

  // sync hasBall flags
  for (const pl of all){ pl.hasBall = (m.ball.ownerPlayer===pl); }

  // AI tackling: AI players near human ball carrier attempt tackles
  const humanCarrier = humanPlayers.find(p=>p.hasBall);
  if (humanCarrier){
    for (const ap of aiPlayers){
      const d = Math.hypot(ap.x-humanCarrier.x, ap.y-humanCarrier.y);
      if (d < 32 && ap.cooldown<=0){
        doTackle(ap, m);
      }
    }
  }

  // AI actions for ball carriers on AI team
  const aiCarrier = aiPlayers.find(p=>p.hasBall);
  if (aiCarrier){
    // decide
    if (!aiCarrier.aiDecided){
      aiCarrier.aiDecided = true;
      aiCarrier.aiTimer = 0.3 + Math.random()*0.8;
    }
    aiCarrier.aiTimer -= dt;
    if (aiCarrier.aiTimer <= 0){
      const oppGoalX = aiCarrier.side==='A'? W : 0;
      const d = Math.hypot(oppGoalX-aiCarrier.x, H/2-aiCarrier.y);
      if (d < 220){
        const special = aiCarrier.data.special && aiCarrier.spirit>=50 && Math.random()<0.4;
        doShoot(aiCarrier, m, special);
      } else if (Math.random()<0.35){
        doPass(aiCarrier, m);
      } else {
        aiCarrier.aiTimer = 0.3;
      }
      aiCarrier.aiDecided = false;
    }
  }
  // reset aiDecided when not carrier
  for (const pl of aiPlayers){ if(!pl.hasBall) pl.aiDecided=false; }

  // goalkeeper handling
  handleGoalkeepers(m, dt);
}

function edge(code){ const cur=!!keys[code]; const prev=!!prevKeys[code]; prevKeys[code]=cur; return cur && !prev; }
// update prev keys each frame at end? We'll store in loop: snapshot before update? We set prevKeys inside edge lazily; but need reset. Let's instead maintain prevKeys by copying keys at end of update.
// We'll call syncPrev at end of updateMatch.

// We'll patch: after updateMatch, copy keys to prevKeys
const _origUpdate = updateMatch;
// wrap by monkey? Instead add at end of updateMatch. We'll just append in function? We'll edit later. For now add global in loop:
// Actually easier: track prev in keydown? no. We'll modify updateMatch to end with Object.assign(prevKeys, keys) at bottom. We'll include.

function updateAI(m, players, controlled, mode){
  // find nearest to ball for this team
  let nearest=null, nearD=1e9;
  for (const pl of players){
    if (pl===controlled) continue;
    const d=Math.hypot(pl.x-m.ball.x, pl.y-m.ball.y);
    if (d<nearD){nearD=d;nearest=pl;}
  }
  const hasBall = m.ball.ownerSide === (players===m.playersA?'A':'B');
  const oppHasBall = m.ball.ownerSide && m.ball.ownerSide !== (players===m.playersA?'A':'B');
  const side = players===m.playersA?'A':'B';
  const oppGoalX = side==='A'? W : 0;
  for (const pl of players){
    if (pl===controlled) continue;
    let tx=pl.homeX, ty=pl.homeY;
    if (pl.hasBall){
      tx = oppGoalX*0.92; ty = H/2;
    } else if (m.ball.ownerPlayer===null){
      if (pl===nearest){ tx=m.ball.x; ty=m.ball.y; }
    } else if (hasBall){
      if (pl.data.pos==='FW') { tx = oppGoalX*0.75 + (side==='A'?0:0); ty = pl.homeY; }
      else if (pl.data.pos==='MF') { tx = W*0.5; ty = pl.homeY; }
      else { tx = pl.homeX; ty = pl.homeY; }
    } else {
      // opponent has ball
      if (pl===nearest){ tx=m.ball.x; ty=m.ball.y; }
      else { tx=pl.homeX; ty=pl.homeY; }
    }
    const dx=tx-pl.x, dy=ty-pl.y;
    const d=Math.hypot(dx,dy);
    const sp = (pl.data.speed/10)*2.6;
    if (d>8){ pl.vx = dx/d*sp; pl.vy=dy/d*sp; }
    else { pl.vx*=0.6; pl.vy*=0.6; }
  }
}

function doPass(p, m){
  const side = p.side;
  const teammates = side==='A'? m.playersA : m.playersB;
  let best=null, bestScore=-Infinity;
  for (const t of teammates){
    if (t===p) continue;
    const dx=t.x-p.x, dy=t.y-p.y;
    const dist=Math.hypot(dx,dy);
    if (dist<40) continue;
    const goalX = side==='A'? W : 0;
    const forward = side==='A'? (t.x-p.x) : (p.x-t.x);
    const score = forward*1.5 - dist*0.2;
    if (score>bestScore){ bestScore=score; best=t; }
  }
  if (!best) return;
  const dx=best.x-p.x, dy=best.y-p.y, len=Math.hypot(dx,dy)||1;
  m.ball.ownerPlayer = null; m.ball.ownerSide = null;
  p.hasBall = false;
  m.ball.x = p.x; m.ball.y = p.y;
  m.ball.vx = (dx/len)*9; m.ball.vy = (dy/len)*9;
  m.ball.cooldown = 0.25;
  p.cooldown = 0.3;
  messageFx = {text:'PASS', timer:0.6};
}

function doShoot(p, m, specialOverride){
  const side = p.side;
  const oppGoalX = side==='A'? W : 0;
  const goalY = H/2;
  const dx = oppGoalX - p.x;
  const dy = goalY - p.y;
  const len = Math.hypot(dx,dy)||1;
  let special = (specialOverride!==undefined)? specialOverride : (p.data.special && p.spirit>=50 && keys['KeyX']);
  // for human, special if KeyX and shift? We'll trigger special if spirit>=50 and special exists and random? Let's make: if player has special and spirit>=50, always special on shoot (costs spirit). Simpler.
  if (p.data.special && p.spirit>=50) special = true;
  else special = false;
  if (special){ p.spirit = Math.max(0, p.spirit-50); }
  m.ball.ownerPlayer = null; m.ball.ownerSide = null;
  p.hasBall = false;
  m.ball.x = p.x; m.ball.y = p.y;
  const power = special ? 16 : 10;
  m.ball.vx = (dx/len)*power;
  m.ball.vy = (dy/len)*power;
  m.ball.cooldown = 0.2;
  p.cooldown = 0.4;
  if (special){
    specialFx = {text: p.data.special.toUpperCase() + '!', timer:1.2, color: p.team.color};
    messageFx = {text: p.data.special, timer:1.0};
  } else {
    messageFx = {text:'SHOT', timer:0.6};
  }
}

function doTackle(p, m){
  const side = p.side;
  const oppPlayers = side==='A'? m.playersB : m.playersA;
  // find nearest opponent with ball or near
  let target=null, td=1e9;
  for (const o of oppPlayers){ const d=Math.hypot(o.x-p.x,o.y-p.y); if (d<td){td=d;target=o;} }
  if (target && td < 45){
    // attempt steal
    if (target.hasBall){
      if (Math.random() < 0.35 + (p.data.def/20)){
        // steal
        m.ball.ownerPlayer = p; m.ball.ownerSide = side;
        target.hasBall = false; p.hasBall=true;
        m.ball.x=p.x; m.ball.y=p.y;
        messageFx = {text:'TACKLE!', timer:0.8};
      } else {
        // fail, ball loose
        m.ball.ownerPlayer = null; m.ball.ownerSide = null;
        target.hasBall=false;
        m.ball.x=target.x; m.ball.y=target.y;
        m.ball.vx = (Math.random()-0.5)*4;
        m.ball.vy = (Math.random()-0.5)*4;
        messageFx = {text:'MISS', timer:0.6};
      }
    }
  }
  p.cooldown = 0.5;
}

function updateBall(m, dt){
  const b = m.ball;
  if (b.ownerPlayer){
    const pl = b.ownerPlayer;
    b.x = pl.x; b.y = pl.y;
    b.vx=0; b.vy=0;
    return;
  }
  if (b.cooldown>0) b.cooldown -= dt;
  // integrate
  b.x += b.vx; b.y += b.vy;
  b.vx *= 0.985; b.vy *= 0.985;
  if (Math.abs(b.vx)<0.05) b.vx=0;
  if (Math.abs(b.vy)<0.05) b.vy=0;
  // walls
  if (b.y < 8){ b.y=8; b.vy*=-0.6; }
  if (b.y > H-8){ b.y=H-8; b.vy*=-0.6; }
  // goals
  const goalHalf = 60;
  const goalY = H/2;
  if (b.x < 0){
    if (Math.abs(b.y-goalY) < goalHalf){
      // goal for B? ball entered left goal => team B scores
      scoreGoal('B');
    } else {
      b.x=0; b.vx*=-0.6;
    }
  }
  if (b.x > W){
    if (Math.abs(b.y-goalY) < goalHalf){
      scoreGoal('A');
    } else {
      b.x=W; b.vx*=-0.6;
    }
  }
  if (b.cooldown>0) b.cooldown -= dt;
}

function scoreGoal(side){
  const m = match;
  if (side==='A') m.scoreA++; else m.scoreB++;
  messageFx = {text:'GOAL!!!', timer:2.0};
  m.running = false;
  m.goalPause = 1.8;
  // reset positions after pause? reset now but keep paused
  resetPositionsAfterGoal(side);
}

function handleGoalkeepers(m, dt){
  const all = [m.playersA[0], m.playersB[0]]; // assume GK first
  for (const gk of all){
    const side = gk.side;
    const ownGoalX = side==='A'? 0 : W;
    // position along goal line
    const targetY = Math.max(60, Math.min(H-60, m.ball.y));
    const dx = (side==='A'? 15 : W-15) - gk.x;
    const dy = targetY - gk.y;
    gk.vx = dx*2; gk.vy = dy*2;
    // catch if ball loose and close (probability based on def and ball speed)
    const gkd = Math.hypot(gk.x-m.ball.x, gk.y-m.ball.y);
    if (!m.ball.ownerPlayer && gkd < 26 && m.ball.cooldown<=0){
      const ballSpeed = Math.hypot(m.ball.vx, m.ball.vy);
      const chance = (gk.data.def/12) * (1 - Math.min(0.7, ballSpeed/25));
      if (Math.random() < chance){
        m.ball.ownerPlayer = gk; m.ball.ownerSide = side;
        gk.hasBall = true;
        gk.cooldown = 0.2;
      }
    }
    if (gk.hasBall){
      // throw after 0.8s
      if (!gk.throwTimer){ gk.throwTimer = 0.8; }
      gk.throwTimer -= dt;
      if (gk.throwTimer <= 0){
        // pass to nearest teammate forward
        const teammates = side==='A'? m.playersA : m.playersB;
        let best=null, bs=-Infinity;
        for (const t of teammates){
          if (t===gk) continue;
          const forward = side==='A'? t.x : -t.x;
          const score = forward - Math.hypot(t.x-gk.x,t.y-gk.y)*0.3;
          if (score>bs){ bs=score; best=t; }
        }
        if (best){
          const dx=best.x-gk.x, dy=best.y-gk.y, len=Math.hypot(dx,dy)||1;
          m.ball.ownerPlayer=null; m.ball.ownerSide=null; gk.hasBall=false;
          m.ball.x=gk.x; m.ball.y=gk.y;
          m.ball.vx=(dx/len)*7; m.ball.vy=(dy/len)*7;
          m.ball.cooldown=0.2;
        }
        gk.throwTimer=null;
      }
    } else {
      gk.throwTimer=null;
    }
  }
}

// sync prev keys
const origLoopUpdate = update;
// We'll add prev sync by overriding updateMatch? Instead sync in update() after updateMatch call.
// Modify update function via redefinition not possible; we'll just call sync at end of updateMatch by appending.
// We'll monkeypatch after function defined:
const _um = updateMatch;
// can't easily. Instead edit updateMatch source? We'll add global sync in loop instead:
// In loop, after update, if state match, copy keys->prevKeys
// We'll handle in loop:
// (already calling update). Add:
// We'll modify loop to sync:
// We'll just add line in loop after update(dt): 
// if (state==='match') Object.assign(prevKeys, keys); 
// But loop defined above already; can't edit easily. We'll instead redefine loop now:
// Actually loop is already running. We need prev sync. Let's redefine loop by reassigning? requestAnimationFrame uses loop reference; we can't replace easily but can wrap. 
// Simpler: add sync inside updateMatch by redefining? Let's just append to updateMatch via prototype? It's a function declaration; we can wrap:
const _updateMatchOrig = updateMatch;
window.updateMatch = function(dt){ _updateMatchOrig(dt); Object.assign(prevKeys, keys); };
// But update() calls updateMatch (local function) not window. Hmm.
// Instead, modify update() similarly? update is function declaration. We can wrap global update:
const _updateOrig = update;
window.update = function(dt){ _updateOrig(dt); };
// Not enough.

// Let's just edit the update function definition by redefining it fully? We'll instead add prev sync inside updateMatch by monkeypatching the function object? JS functions can't be patched mid. 
// Easiest: modify the source: we already wrote updateMatch without sync. Let's use edit tool later? Or just add sync in draw? No, edge detection happens in updateMatch before sync needed next frame. We can sync prevKeys at start of next updateMatch? Need previous frame's keys. We can store at end. 
// We'll redefine updateMatch entirely via eval? Let's just append sync by wrapping the call site: update() calls updateMatch(dt). We can redefine update() to call updateMatch then sync. update is function declaration; but we can reassign the variable? `update` is function declaration => const-ish binding in global. In non-strict? We can do `update = function(dt){...}`? Function declarations are mutable in global scope. Let's try:
// We'll override update after all definitions:
// (placed at end of file)

// ---------- Drawing ----------
function draw(){
  ctx.clearRect(0,0,W,H);
  if (state==='menu') drawMenu();
  else if (state==='teamSelect') drawTeamSelect();
  else if (state==='match') drawMatch();
  else if (state==='result') drawResult();
  else if (state==='story') drawStory();
  else if (state==='controls') drawControls();
}

function drawMenu(){
  // background gradient
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#0a2a4a'); g.addColorStop(1,'#0a1a2a');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  // title
  ctx.fillStyle='#ffd700'; ctx.font='bold 46px Arial'; ctx.textAlign='center';
  ctx.fillText('CAPTAIN TSUBASA', W/2, 120);
  ctx.fillStyle='#fff'; ctx.font='bold 26px Arial';
  ctx.fillText('Rise of New Champions', W/2, 160);
  ctx.font='16px Arial'; ctx.fillStyle='#aaa';
  ctx.fillText('Fan-made arcade soccer', W/2, 190);
  buttons=[];
  const opts = [
    {label:'Exhibition Match', action:()=>{ state='teamSelect'; teamSelectStep=0; buttons=[]; }},
    {label:'Story Mode', action:()=>{ startStory(); }},
    {label:'Controls', action:()=>{ state='controls'; buttons=[]; }},
  ];
  let y=260;
  for (const o of opts){
    const b = {x:W/2-160, y, w:320, h:50, label:o.label, action:o.action};
    buttons.push(b);
    // draw
    ctx.fillStyle = (mouseX>=b.x&&mouseX<=b.x+b.w&&mouseY>=b.y&&mouseY<=b.y+b.h)?'#ffd700':'#1e6bd6';
    roundRect(b.x,b.y,b.w,b.h,10); ctx.fill();
    ctx.fillStyle='#fff'; ctx.font='bold 20px Arial'; ctx.textAlign='center';
    ctx.fillText(o.label, b.x+b.w/2, b.y+32);
    y+=70;
  }
}

function roundRect(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}

let teamSelectStep = 0; // 0 human, 1 opponent
let humanTeamId = null;
function drawTeamSelect(){
  ctx.fillStyle='#0a2a4a'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#ffd700'; ctx.font='bold 28px Arial'; ctx.textAlign='center';
  ctx.fillText(teamSelectStep===0?'Select Your Team':'Select Opponent', W/2, 50);
  buttons=[];
  const cols=3, rows=2;
  const bw=280, bh=90, gap=20;
  const startX=(W - (cols*bw + (cols-1)*gap))/2;
  const startY=90;
  TEAMS.forEach((t,i)=>{
    const c=i%cols, r=Math.floor(i/cols);
    const x=startX+c*(bw+gap), y=startY+r*(bh+gap);
    const b={x,y,w:bw,h:bh, action:()=>{
      if (teamSelectStep===0){ humanTeamId=t.id; teamSelectStep=1; }
      else { startMatch(humanTeamId, t.id); }
    }};
    buttons.push(b);
    const hoverBtn = mouseX>=b.x&&mouseX<=b.x+b.w&&mouseY>=b.y&&mouseY<=b.y+b.h;
    ctx.fillStyle = hoverBtn? t.accent : t.color;
    roundRect(b.x,b.y,b.w,b.h,12); ctx.fill();
    ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.stroke();
    ctx.fillStyle = (t.color==='#ffffff')?'#000':'#fff';
    ctx.font='bold 20px Arial'; ctx.textAlign='left';
    ctx.fillText(t.name, b.x+15, b.y+35);
    ctx.font='14px Arial';
    ctx.fillText('Special: '+t.special, b.x+15, b.y+60);
  });
  // back
  const back={x:20,y:H-50,w:100,h:40, action:()=>{ state='menu'; buttons=[];}};
  buttons.push(back);
  ctx.fillStyle='#555'; roundRect(back.x,back.y,back.w,back.h,8); ctx.fill();
  ctx.fillStyle='#fff'; ctx.font='16px Arial'; ctx.textAlign='center';
  ctx.fillText('Back', back.x+back.w/2, back.y+26);
}

function startStory(){
  storyIndex=0;
  state='story';
  buttons=[];
  showStoryIntro();
}

let storyIndex=0;
let storyMatchQueue = [
  {human:'nankatsu', opp:'otomo', intro:'Episode Tsubasa: Nankatsu vs Otomo - Shizuoka Prefecture Finals.'},
  {human:'nankatsu', opp:'musashi', intro:'National Tournament: Nankatsu vs Musashi.'},
  {human:'nankatsu', opp:'toho', intro:'Final: Nankatsu vs Toho Academy.'}
];
function showStoryIntro(){
  // store current intro text in messageFx? We'll draw in drawStory
}

function drawStory(){
  ctx.fillStyle='#0a1a2a'; ctx.fillRect(0,0,W,H);
  const q = storyMatchQueue[storyIndex];
  if (!q){
    // done
    ctx.fillStyle='#ffd700'; ctx.font='bold 32px Arial'; ctx.textAlign='center';
    ctx.fillText('Story Complete!', W/2, H/2-20);
    buttons=[];
    const back={x:W/2-80,y:H/2+20,w:160,h:45,action:()=>{state='menu';buttons=[];}};
    buttons.push(back);
    ctx.fillStyle='#1e6bd6'; roundRect(back.x,back.y,back.w,back.h,8); ctx.fill();
    ctx.fillStyle='#fff'; ctx.font='18px Arial'; ctx.fillText('Back to Menu', back.x+back.w/2, back.y+30);
    return;
  }
  ctx.fillStyle='#ffd700'; ctx.font='bold 28px Arial'; ctx.textAlign='center';
  ctx.fillText('Episode Tsubasa', W/2, 80);
  ctx.fillStyle='#fff'; ctx.font='18px Arial';
  wrapText(q.intro, W/2, 160, 700, 26);
  buttons=[];
  const play={x:W/2-100,y:H-120,w:200,h:50,action:()=>{
    // start match; after result, advance
    storyPending=true;
    startMatch(q.human, q.opp);
  }};
  buttons.push(play);
  ctx.fillStyle='#1e6bd6'; roundRect(play.x,play.y,play.w,play.h,10); ctx.fill();
  ctx.fillStyle='#fff'; ctx.font='bold 20px Arial'; ctx.fillText('Play Match', play.x+play.w/2, play.y+32);
  const back={x:20,y:H-50,w:100,h:40,action:()=>{state='menu';buttons=[];}};
  buttons.push(back);
  ctx.fillStyle='#555'; roundRect(back.x,back.y,back.w,back.h,8); ctx.fill();
  ctx.fillStyle='#fff'; ctx.font='16px Arial'; ctx.fillText('Back', back.x+back.w/2, back.y+26);
}

let storyPending=false;

function drawControls(){
  ctx.fillStyle='#0a2a4a'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#ffd700'; ctx.font='bold 28px Arial'; ctx.textAlign='center';
  ctx.fillText('Controls', W/2, 60);
  const lines = [
    'Arrow Keys / WASD - Move controlled player',
    'Space - Pass',
    'X - Shoot (special shot if spirit >= 50)',
    'Z - Tackle (when not in possession)',
    'C - Sprint (hold, consumes spirit)',
    'Touch buttons on mobile',
  ];
  ctx.fillStyle='#fff'; ctx.font='18px Arial'; ctx.textAlign='left';
  let y=120;
  for (const l of lines){ ctx.fillText(l, 120, y); y+=36; }
  buttons=[];
  const back={x:W/2-80,y:H-80,w:160,h:45,action:()=>{state='menu';buttons=[];}};
  buttons.push(back);
  ctx.fillStyle='#1e6bd6'; roundRect(back.x,back.y,back.w,back.h,8); ctx.fill();
  ctx.fillStyle='#fff'; ctx.font='18px Arial'; ctx.textAlign='center';
  ctx.fillText('Back', back.x+back.w/2, back.y+30);
}

function drawMatch(){
  const m = match;
  // field
  drawField();
  // players
  const all = [...m.playersA, ...m.playersB];
  // draw non-controlled first
  for (const pl of all){
    if (pl===controlledPlayer) continue;
    drawPlayer(pl);
  }
  if (controlledPlayer) drawPlayer(controlledPlayer);
  // ball
  drawBall(m.ball);
  // HUD
  drawHUD(m);
  // special fx
  if (specialFx){
    ctx.save();
    ctx.globalAlpha = Math.min(1, specialFx.timer);
    ctx.fillStyle = specialFx.color || '#ffd700';
    ctx.font='bold 40px Arial'; ctx.textAlign='center';
    ctx.fillText(specialFx.text, W/2, 80);
    ctx.restore();
  }
  if (messageFx && messageFx.text!=='GOAL!!!'){
    ctx.save();
    ctx.globalAlpha = Math.min(1, messageFx.timer);
    ctx.fillStyle='#fff'; ctx.font='bold 22px Arial'; ctx.textAlign='center';
    ctx.fillText(messageFx.text, W/2, 110);
    ctx.restore();
  }
  // goal message
  if (messageFx && messageFx.text==='GOAL!!!'){
    ctx.save();
    ctx.globalAlpha = Math.min(1, messageFx.timer);
    ctx.fillStyle='#ffd700'; ctx.font='bold 60px Arial'; ctx.textAlign='center';
    ctx.fillText('GOAL!!!', W/2, H/2);
    ctx.restore();
  }
  // pause hint
  ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.font='12px Arial'; ctx.textAlign='left';
  ctx.fillText('P: Pause', 10, H-10);
  if (!match.running && !(match.goalPause>0)){
    ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#ffd700'; ctx.font='bold 48px Arial'; ctx.textAlign='center';
    ctx.fillText('PAUSED', W/2, H/2);
  }
  if (keys['KeyP'] && !prevKeys['KeyP'] && !(match.goalPause>0)){
    match.running = !match.running;
  }
}

function drawField(){
  // grass
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#2d8a4e'); g.addColorStop(1,'#1e6b3a');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  // stripes
  ctx.fillStyle='rgba(255,255,255,0.05)';
  for (let i=0;i<W;i+=60){ ctx.fillRect(i,0,30,H); }
  // lines
  ctx.strokeStyle='rgba(255,255,255,0.8)'; ctx.lineWidth=2;
  ctx.strokeRect(10,10,W-20,H-20);
  ctx.beginPath(); ctx.moveTo(W/2,10); ctx.lineTo(W/2,H-10); ctx.stroke();
  ctx.beginPath(); ctx.arc(W/2,H/2,60,0,Math.PI*2); ctx.stroke();
  // goals
  ctx.strokeStyle='#fff'; ctx.lineWidth=3;
  ctx.strokeRect(-5, H/2-60, 25, 120);
  ctx.strokeRect(W-20, H/2-60, 25, 120);
  // penalty areas
  ctx.strokeStyle='rgba(255,255,255,0.6)'; ctx.lineWidth=2;
  ctx.strokeRect(10, H/2-120, 100, 240);
  ctx.strokeRect(W-110, H/2-120, 100, 240);
}

function drawPlayer(pl){
  const color = pl.team.color;
  const r = 14;
  // shadow
  ctx.fillStyle='rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(pl.x, pl.y+r, r*1.2, r*0.4,0,0,Math.PI*2); ctx.fill();
  // body circle
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(pl.x, pl.y, r, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = pl.controlled ? '#ffd700' : '#fff';
  ctx.lineWidth = pl.controlled ? 3 : 1.5;
  ctx.stroke();
  // number
  ctx.fillStyle='#fff'; ctx.font='bold 12px Arial'; ctx.textAlign='center';
  ctx.fillText(pl.data.num, pl.x, pl.y+4);
  // name label
  ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.font='10px Arial';
  ctx.fillText(pl.data.name, pl.x, pl.y+r+12);
  // spirit bar for controlled
  if (pl.controlled){
    const bw=40, bh=4;
    const ratio = pl.spirit/pl.maxSpirit;
    ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(pl.x-bw/2, pl.y-r-10, bw, bh);
    ctx.fillStyle='#00e5ff'; ctx.fillRect(pl.x-bw/2, pl.y-r-10, bw*ratio, bh);
  }
}

function drawBall(b){
  ctx.fillStyle='#fff';
  ctx.beginPath(); ctx.arc(b.x, b.y, 6, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle='#333'; ctx.lineWidth=1; ctx.stroke();
  // pentagon-ish
  ctx.fillStyle='#111';
  ctx.beginPath(); ctx.arc(b.x, b.y, 2, 0, Math.PI*2); ctx.fill();
}

function drawHUD(m){
  // top bar
  ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(0,0,W,40);
  // team names & scores
  ctx.font='bold 18px Arial'; ctx.textAlign='left';
  ctx.fillStyle=m.teamA.color==='#ffffff'?'#ffd700':m.teamA.color;
  // use white for readability
  ctx.fillStyle='#fff';
  ctx.textAlign='left';
  ctx.fillText(m.teamA.name, 20, 26);
  ctx.textAlign='center';
  ctx.font='bold 26px Arial';
  ctx.fillStyle='#ffd700';
  ctx.fillText(m.scoreA + ' - ' + m.scoreB, W/2, 28);
  ctx.font='bold 18px Arial';
  ctx.textAlign='right';
  ctx.fillStyle='#fff';
  ctx.fillText(m.teamB.name, W-20, 26);
  // timer
  const mins = Math.floor(m.time/60);
  const secs = Math.floor(m.time%60).toString().padStart(2,'0');
  ctx.textAlign='center'; ctx.font='14px Arial'; ctx.fillStyle='#aaa';
  ctx.fillText(mins+':'+secs, W/2, 44);
  if (m.stadium){ ctx.font='11px Arial'; ctx.fillStyle='#ddd'; ctx.fillText(m.stadium.name, W/2, 58); }
  // controlled player info
  if (controlledPlayer){
    ctx.textAlign='left'; ctx.font='14px Arial'; ctx.fillStyle='#fff';
    ctx.fillText('Control: '+controlledPlayer.data.name+'  Spirit: '+Math.floor(controlledPlayer.spirit), 20, H-15);
  }
}

function drawResult(){
  ctx.fillStyle='rgba(0,0,0,0.85)'; ctx.fillRect(0,0,W,H);
  const m = match;
  ctx.fillStyle='#ffd700'; ctx.font='bold 40px Arial'; ctx.textAlign='center';
  let winner = m.scoreA>m.scoreB? m.teamA.name : (m.scoreB>m.scoreA? m.teamB.name : 'Draw');
  ctx.fillText(winner==='Draw'?'Draw!': (winner+' Wins!'), W/2, 150);
  ctx.fillStyle='#fff'; ctx.font='bold 60px Arial';
  ctx.fillText(m.scoreA+' - '+m.scoreB, W/2, 230);
  ctx.font='20px Arial';
  ctx.fillText(m.teamA.name+'  vs  '+m.teamB.name, W/2, 280);
  buttons=[];
  const b1={x:W/2-180,y:340,w:160,h:50,action:()=>{
    if (storyPending){
      storyPending=false;
      storyIndex++;
      state='story'; buttons=[];
    } else {
      state='menu'; buttons=[];
    }
  }};
  buttons.push(b1);
  ctx.fillStyle='#1e6bd6'; roundRect(b1.x,b1.y,b1.w,b1.h,10); ctx.fill();
  ctx.fillStyle='#fff'; ctx.font='bold 18px Arial'; ctx.fillText('Continue', b1.x+b1.w/2, b1.y+32);
  const b2={x:W/2+20,y:340,w:160,h:50,action:()=>{ state='menu'; buttons=[]; storyPending=false; }};
  buttons.push(b2);
  ctx.fillStyle='#555'; roundRect(b2.x,b2.y,b2.w,b2.h,10); ctx.fill();
  ctx.fillStyle='#fff'; ctx.fillText('Menu', b2.x+b2.w/2, b2.y+32);
}

function wrapText(text,x,y,maxWidth,lineHeight){
  const words=text.split(' ');
  let line='';
  let cy=y;
  ctx.textAlign='center';
  for (let n=0;n<words.length;n++){
    const test=line+words[n]+' ';
    const metrics=ctx.measureText(test);
    if (metrics.width>maxWidth && n>0){ ctx.fillText(line,x,cy); line=words[n]+' '; cy+=lineHeight; }
    else line=test;
  }
  ctx.fillText(line,x,cy);
}

// KeyP pause toggle handling done via edge in drawMatch (call edge('KeyP') there)
// Start
state='menu';