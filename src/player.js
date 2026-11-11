import * as THREE from 'three';

export class Player {
  constructor(scene, camera, input, audio, effects) {
    this.scene = scene;
    this.camera = camera;
    this.input = input;
    this.audio = audio;
    this.effects = effects;

    this.group = new THREE.Group();
    this.buildMesh();
    scene.add(this.group);

    // stats
    this.maxHp = 100; this.hp = 100;
    this.maxStamina = 100; this.stamina = 100;
    this.maxMana = 60; this.mana = 60;
    this.damage = 18;
    this.speed = 7;
    this.pendingXp = 0;
    this.talents = { vitality:0, strength:0, arcane:0 };
    this.level = 1;

    // state
    this.velocity = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.onGround = true;
    this.verticalVel = 0;
    this.gravity = -22;
    this.state = 'idle'; // idle/walk/attack/block/dodge/cast/stagger
    this.stateTimer = 0;
    this.attackCooldown = 0;
    this.blocking = false;
    this.dodgeTimer = 0;
    this.iFrames = 0;
    this.castCooldown = 0;
    this.selectedSlot = 0;
    this.spells = ['fireball','frostnova','heal'];
    this.spellNames = ['Fireball','Frost Nova','Heal'];
    this.currentSpell = 0;
    this.posture = 0; this.maxPosture = 100;
    this.postureRegen = 18;
    this.invuln = 0;

    // camera follow
    this.camDistance = 9;
    this.camHeight = 4.5;
    this.camSmooth = new THREE.Vector3(0,5,10);

    this.onLevelUp = () => {};

    // attack hit tracking
    this.attackHitSet = new Set();
    this.attackActive = false;
    this.attackTimer = 0;
    this.attackDuration = 0.45;

    // dodge
    this.dodgeDir = new THREE.Vector3();
    this.dodgeTime = 0.5;

    input.on('attack', () => this.tryAttack());
    input.on('slot', (i) => this.selectSlot(i));
    input.on('blockStart', () => this.startBlock());
    input.on('blockEnd', () => this.endBlock());
    input.on('dodge', () => this.dodge());
    input.on('cast', () => this.cast());
    input.on('spellNext', () => this.cycleSpell(1));
    input.on('spellPrev', () => this.cycleSpell(-1));
  }

  buildMesh() {
    const g = this.group;
    // body
    const bodyMat = new THREE.MeshStandardMaterial({ color:0x1f2a3a, roughness:0.7, metalness:0.3 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 1.1, 6, 12), bodyMat);
    body.position.y = 1.1;
    body.castShadow = true;
    g.add(body);
    // head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 12), new THREE.MeshStandardMaterial({ color:0xd9b08c, roughness:0.8 }));
    head.position.y = 2.05;
    head.castShadow = true;
    g.add(head);
    // cloak
    const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.6, 8), new THREE.MeshStandardMaterial({ color:0x0b1a33, roughness:0.9 }));
    cloak.position.y = 1.0; cloak.rotation.x = Math.PI;
    g.add(cloak);
    // arms
    const armMat = new THREE.MeshStandardMaterial({ color:0x1f2a3a, roughness:0.7 });
    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.5, 1.5, 0);
    const armMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,0.7,8), armMat);
    armMesh.rotation.z = -Math.PI/2; armMesh.position.x = 0.35;
    this.rightArm.add(armMesh);
    g.add(this.rightArm);
    // sword
    this.sword = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.3, 0.02), new THREE.MeshStandardMaterial({ color:0xcfd8e3, metalness:0.9, roughness:0.2, emissive:0x223344, emissiveIntensity:0.3 }));
    blade.position.y = 0.65;
    this.sword.add(blade);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.35,0.06,0.1), new THREE.MeshStandardMaterial({ color:0x7a5a2a, metalness:0.6 }));
    this.sword.add(guard);
    this.sword.position.set(0.5,1.2,0.3);
    this.sword.rotation.x = -Math.PI/4;
    g.add(this.sword);
    // left arm
    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,0.7,8), armMat);
    leftArm.rotation.z = Math.PI/2; leftArm.position.set(-0.85,1.5,0);
    g.add(leftArm);

    this.meshBody = body;
  }

  reset() {
    this.group.position.set(0,0,0);
    this.velocity.set(0,0,0);
    this.yaw = 0; this.pitch = 0;
    this.state = 'idle';
    this.attackCooldown = 0; this.castCooldown = 0;
    this.blocking = false;
    this.iFrames = 0;
    this.posture = 0;
    this.hp = this.maxHp; this.stamina = this.maxStamina; this.mana = this.maxMana;
    this.pendingXp = 0;
    this.attackHitSet.clear();
    this.attackActive = false;
  }

  selectSlot(i) {
    this.selectedSlot = i;
    if (i >= 1) this.currentSpell = i-1;
  }

  cycleSpell(dir) {
    this.currentSpell = (this.currentSpell + dir + this.spells.length) % this.spells.length;
  }

  tryAttack() {
    if (this.state === 'dead') return;
    if (this.state === 'dodge' || this.state === 'cast' || this.state === 'stagger') return;
    if (this.attackCooldown > 0) return;
    if (this.stamina < 12) { this.toast?.('Low stamina'); return; }
    this.stamina -= 12;
    this.state = 'attack';
    this.stateTimer = this.attackDuration;
    this.attackTimer = 0;
    this.attackActive = false;
    this.attackHitSet.clear();
    this.attackCooldown = 0.55;
    this.audio.play('swing');
    // arm swing
    this.sword.rotation.x = -Math.PI/2;
  }

  startBlock() {
    if (this.state === 'dead' || this.state === 'dodge' || this.state === 'stagger') return;
    this.blocking = true;
    this.state = 'block';
    this.blockStartTime = performance.now()/1000;
    this.perfectWindow = true;
  }
  endBlock() {
    if (this.state === 'block') { this.state = 'idle'; }
    this.blocking = false;
    this.perfectWindow = false;
  }

  dodge() {
    if (this.state === 'dead' || this.state === 'dodge' || this.state === 'stagger' || this.state === 'cast') return;
    if (this.stamina < 20) return;
    this.stamina -= 20;
    this.state = 'dodge';
    this.stateTimer = this.dodgeTime;
    this.iFrames = 0.45;
    // direction from input or forward
    const dir = this.input.getMoveDir(this.yaw);
    if (dir.lengthSq() < 0.01) dir.set(0,0,-1).applyAxisAngle(new THREE.Vector3(0,1,0), this.yaw);
    dir.y = 0; dir.normalize();
    this.dodgeDir.copy(dir);
    this.audio.play('dodge');
  }

  cast() {
    if (this.state === 'dead' || this.state === 'dodge' || this.state === 'stagger' || this.state === 'attack') return;
    if (this.castCooldown > 0) return;
    const spell = this.spells[this.currentSpell];
    const cost = spell === 'heal' ? 25 : 20;
    if (this.mana < cost) { this.toast?.('Low mana'); return; }
    this.mana -= cost;
    this.state = 'cast';
    this.stateTimer = 0.5;
    this.castCooldown = 0.8;
    this.audio.play('cast');
    // spawn effect via effects manager handled in combat? We'll emit event
    this.pendingCast = spell;
  }

  takeDamage(amount, fromPos, isParryable=true) {
    if (this.iFrames > 0) return false;
    if (this.state === 'block') {
      // parry check
      const now = performance.now()/1000;
      const t = now - (this.blockStartTime||0);
      if (t < 0.18 && isParryable) {
        // perfect parry
        this.effects.spawnParry(this.group.position.clone().add(new THREE.Vector3(0,1.2,0)));
        this.audio.play('parry');
        this.posture = Math.max(0, this.posture - 30);
        return 'parried';
      }
      // block reduces damage
      const reduced = amount * 0.3;
      this.hp -= reduced;
      this.stamina -= 15;
      this.posture += amount*0.6;
      this.effects.spawnHit(this.group.position.clone().add(new THREE.Vector3(0,1.2,0)), 0x3498db);
      if (this.posture >= this.maxPosture) {
        this.state = 'stagger'; this.stateTimer = 0.8; this.blocking = false;
        this.posture = this.maxPosture;
        this.audio.play('stagger');
      }
      return 'blocked';
    }
    this.hp -= amount;
    this.effects.spawnHit(this.group.position.clone().add(new THREE.Vector3(0,1.2,0)), 0xff4444);
    this.audio.play('hit');
    if (amount > 15) { this.state = 'stagger'; this.stateTimer = 0.4; }
    return 'hit';
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  addXp(v) { this.pendingXp = (this.pendingXp||0) + v; }

  update(dt) {
    // regen
    if (this.state !== 'block') this.stamina = Math.min(this.maxStamina, this.stamina + 18*dt);
    this.mana = Math.min(this.maxMana, this.mana + 8*dt);
    this.posture = Math.max(0, this.posture - this.postureRegen*dt);
    if (this.iFrames > 0) this.iFrames -= dt;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this.castCooldown > 0) this.castCooldown -= dt;
    if (this.invuln > 0) this.invuln -= dt;

    // state timer
    if (this.stateTimer > 0) {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        if (this.state === 'attack' || this.state === 'cast' || this.state === 'stagger' || this.state === 'dodge') this.state = 'idle';
      }
    }

    // attack active frames
    if (this.state === 'attack') {
      this.attackTimer += dt;
      // active from 0.12 to 0.3
      this.attackActive = (this.attackTimer >= 0.12 && this.attackTimer <= 0.3);
      // sword anim
      const t = this.attackTimer / this.attackDuration;
      this.sword.rotation.x = -Math.PI/2 + (Math.PI*0.9)*Math.sin(t*Math.PI);
      if (!this.attackActive) {}
    } else {
      this.sword.rotation.x += ( -Math.PI/4 - this.sword.rotation.x)*dt*8;
    }

    // movement
    const move = this.input.getMoveDir(this.yaw);
    const speed = (this.state === 'dodge') ? 0 : (this.state === 'attack' ? this.speed*0.5 : this.speed);
    let vx = 0, vz = 0;
    if (this.state !== 'stagger' && this.state !== 'dodge') {
      vx = move.x * speed;
      vz = move.z * speed;
    }
    if (this.state === 'dodge') {
      const t = 1 - (this.stateTimer/this.dodgeTime);
      const sp = 12*(1-t) + 2*t;
      vx = this.dodgeDir.x * sp;
      vz = this.dodgeDir.z * sp;
    }

    // gravity
    if (!this.onGround) this.verticalVel += this.gravity * dt;
    // ground check (y=0)
    this.group.position.x += vx * dt;
    this.group.position.z += vz * dt;
    this.group.position.y += this.verticalVel * dt;
    if (this.group.position.y <= 0) { this.group.position.y = 0; this.verticalVel = 0; this.onGround = true; }
    else this.onGround = false;

    // clamp arena
    const r = Math.hypot(this.group.position.x, this.group.position.z);
    if (r > 44) {
      const s = 44/r;
      this.group.position.x *= s; this.group.position.z *= s;
    }

    // jump
    if (this.input.consumeJump() && this.onGround && this.state !== 'dodge') {
      this.verticalVel = 8; this.onGround = false;
    }

    // yaw from mouse
    this.yaw = this.input.yaw;
    this.group.rotation.y = this.yaw;

    // walk bob
    const moving = Math.abs(vx)+Math.abs(vz) > 0.5;
    if (moving && this.onGround && this.state === 'idle') this.state = 'walk';
    if (!moving && this.state === 'walk') this.state = 'idle';

    // pending cast execution
    if (this.pendingCast) {
      const sp = this.pendingCast;
      this.pendingCast = null;
      this.effects.spawnCast(this.group.position.clone(), sp, this.yaw);
      // notify combat system via callback
      if (this.onCast) this.onCast(sp, this);
    }
  }

  updateCamera(camera) {
    // third person follow
    const target = this.group.position.clone().add(new THREE.Vector3(0, 1.6, 0));
    const offset = new THREE.Vector3(0, this.camHeight, this.camDistance);
    // rotate offset by yaw
    offset.applyAxisAngle(new THREE.Vector3(0,1,0), this.yaw);
    const desired = target.clone().add(offset);
    this.camSmooth.lerp(desired, 0.12);
    camera.position.copy(this.camSmooth);
    camera.lookAt(target);
  }

  getForward() {
    const v = new THREE.Vector3(0,0,-1).applyAxisAngle(new THREE.Vector3(0,1,0), this.yaw);
    return v;
  }
}
