import * as THREE from 'three';

export class Input {
  constructor() {
    this.keys = {};
    this.mouse = { x:0, y:0 };
    this.yaw = 0; this.pitch = 0;
    this.pointerLocked = false;
    this.listeners = {};
    this.touch = { move:{x:0,y:0}, look:{x:0,y:0}, jump:false };
    this.jumpQueued = false;
    this._setup();
  }
  on(event, cb) { (this.listeners[event] ||= []).push(cb); }
  emit(event, ...a) { (this.listeners[event]||[]).forEach(cb=>cb(...a)); }
  _setup() {
    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (e.code === 'Space') { e.preventDefault(); this.jumpQueued = true; }
      if (e.code === 'Escape') this.emit('pause');
      if (e.code === 'KeyF') this.emit('cast');
      if (e.code === 'KeyQ') this.emit('spellPrev');
      if (e.code === 'KeyE') this.emit('spellNext');
      if (e.code === 'KeyR') this.emit('cast');
      if (e.code === 'KeyV') this.emit('flashstep');
      if (e.code === 'KeyC') this.emit('signature');
      if (e.code === 'Digit1') { this.emit('slot',0); }
      if (e.code === 'Digit2') { this.emit('slot',1); }
      if (e.code === 'Digit3') { this.emit('slot',2); }
      if (e.code === 'Digit4') { this.emit('slot',3); }
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    document.addEventListener('pointerlockchange', () => { this.pointerLocked = !!document.pointerLockElement; });
    document.addEventListener('mousemove', e => {
      if (!this.pointerLocked) return;
      this.yaw -= e.movementX * 0.0025;
      this.pitch -= e.movementY * 0.0025;
      this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch));
    });
    document.addEventListener('mousedown', e => {
      if (!this.pointerLocked) return;
      if (e.button === 0) this.emit('attack');
      if (e.button === 2) this.emit('blockStart');
    });
    document.addEventListener('mouseup', e => {
      if (e.button === 2) this.emit('blockEnd');
    });
    document.addEventListener('contextmenu', e => e.preventDefault());
    // keyboard block
    // (Shift to block)
    // handled in getMoveDir? no
    window.addEventListener('keydown', e => { if (e.code === 'ShiftLeft') this.emit('blockStart'); });
    window.addEventListener('keyup', e => { if (e.code === 'ShiftLeft') this.emit('blockEnd'); });
    // dodge on ctrl
    window.addEventListener('keydown', e => { if (e.code === 'ControlLeft') this.emit('dodge'); });

    // touch
    this._setupTouch();
  }
  requestPointerLock() {
    const c = document.querySelector('canvas');
    if (c && c.requestPointerLock) c.requestPointerLock();
  }
  _setupTouch() {
    const joy = document.getElementById('joystick');
    const stick = document.getElementById('stick');
    if (!joy) return;
    let active = false, origin = null;
    const start = (x,y) => { active=true; const r=joy.getBoundingClientRect(); origin={x:r.left+r.width/2,y:r.top+r.height/2}; };
    const move = (x,y) => {
      if(!active||!origin) return;
      let dx=x-origin.x, dy=y-origin.y;
      const max=40; const len=Math.hypot(dx,dy);
      if(len>max){ dx=dx/len*max; dy=dy/len*max; }
      stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      this.touch.move = { x: dx/max, y: dy/max };
    };
    const end = () => { active=false; origin=null; stick.style.transform='translate(-50%,-50%)'; this.touch.move={x:0,y:0}; };
    joy.addEventListener('touchstart', e=>{ e.preventDefault(); const t=e.touches[0]; start(t.clientX,t.clientY); }, {passive:false});
    joy.addEventListener('touchmove', e=>{ e.preventDefault(); const t=e.touches[0]; move(t.clientX,t.clientY); }, {passive:false});
    joy.addEventListener('touchend', e=>{ e.preventDefault(); end(); });
    // look: right half
    let lookActive=false, last=null;
    window.addEventListener('touchstart', e=>{
      for (const t of e.changedTouches) {
        if (t.clientX > window.innerWidth*0.5) { lookActive=true; last={x:t.clientX,y:t.clientY}; }
      }
    });
    window.addEventListener('touchmove', e=>{
      for (const t of e.changedTouches) {
        if (lookActive && last) {
          this.yaw -= (t.clientX-last.x)*0.005;
          last={x:t.clientX,y:t.clientY};
        }
      }
    });
    window.addEventListener('touchend', ()=>{ lookActive=false; last=null; });
    // buttons
    const bind = (id, ev) => { const el=document.getElementById(id); if(!el) return; el.addEventListener('touchstart', e=>{ e.preventDefault(); this.emit(ev); }); };
    bind('mbAtk','attack');
    const blk=document.getElementById('mbBlk');
    if(blk){ blk.addEventListener('touchstart', e=>{e.preventDefault(); this.emit('blockStart');}); blk.addEventListener('touchend', e=>{e.preventDefault(); this.emit('blockEnd');}); }
    bind('mbDge','dodge');
    bind('mbSpl','cast');
  }
  getMoveDir(yaw) {
    let x=0, z=0;
    if (this.keys['KeyW']) z -= 1;
    if (this.keys['KeyS']) z += 1;
    if (this.keys['KeyA']) x -= 1;
    if (this.keys['KeyD']) x += 1;
    // touch
    x += this.touch.move.x;
    z += this.touch.move.y;
    const v = new THREE.Vector3(x,0,z);
    // rotate by yaw
    v.applyAxisAngle(new THREE.Vector3(0,1,0), yaw);
    // normalize
    if (v.length() > 1) v.normalize();
    return v;
  }
  consumeJump() {
    if (this.jumpQueued) { this.jumpQueued = false; return true; }
    if (this.touch.jump) { this.touch.jump = false; return true; }
    return false;
  }
}
