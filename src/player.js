import * as THREE from 'three';

export class Player {
  constructor(scene, camera, input, audio, effects) {
    this.scene = scene;
    this.camera = camera;
    this.input = input;
    this.audio = audio;
    this.effects = effects;

    this.group = new THREE.Group();
    this.bones = {};
    this.buildRig();
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
    this.race = 'soulreaper';

    // state
    this.velocity = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.onGround = true;
    this.verticalVel = 0;
    this.gravity = -22;
    this.state = 'idle';
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

    this.camDistance = 9;
    this.camHeight = 4.5;
    this.camSmooth = new THREE.Vector3(0,5,10);

    this.onLevelUp = () => {};
    this.onCast = null;

    this.attackHitSet = new Set();
    this.attackActive = false;
    this.attackTimer = 0;
    this.attackDuration = 0.45;

    this.dodgeDir = new THREE.Vector3();
    this.dodgeTime = 0.5;

    // race buffs
    this.shikaiTimer = 0;
    this.blutTimer = 0;
    this.flashCooldown = 0;
    this.signatureCooldown = 0;

    this.toast = (msg) => { /* ui toast handled externally */ };

    input.on('attack', () => this.tryAttack());
    input.on('blockStart', () => this.startBlock());
    input.on('blockEnd', () => this.endBlock());
    input.on('dodge', () => this.dodge());
    input.on('cast', () => this.cast());
    input.on('spellNext', () => this.cycleSpell(1));
    input.on('spellPrev', () => this.cycleSpell(-1));
    input.on('slot', (i) => this.selectSlot(i));
    input.on('flashstep', () => this.flashStep());
    input.on('signature', () => this.signature());
  }

  buildRig() {
    const g = this.group;
    const boneMat = (c) => new THREE.MeshStandardMaterial({ color:c, roughness:0.7, metalness:0.2 });

    // Bones
    const root = new THREE.Bone(); root.name='root'; root.position.y = 0.9;
    const spine = new THREE.Bone(); spine.name='spine'; spine.position.y = 0.4;
    const chest = new THREE.Bone(); chest.name='chest'; chest.position.y = 0.35;
    const neck = new THREE.Bone(); neck.name='neck'; neck.position.y = 0.35;
    const head = new THREE.Bone(); head.name='head'; head.position.y = 0.25;
    const rShoulder = new THREE.Bone(); rShoulder.name='rShoulder'; rShoulder.position.set(0.35,0.25,0);
    const rArm = new THREE.Bone(); rArm.name='rArm'; rArm.position.set(0.3,0,0);
    const lShoulder = new THREE.Bone(); lShoulder.name='lShoulder'; lShoulder.position.set(-0.35,0.25,0);
    const lArm = new THREE.Bone(); lArm.name='lArm'; lArm.position.set(-0.3,0,0);
    const rHip = new THREE.Bone(); rHip.name='rHip'; rHip.position.set(0.18,-0.1,0);
    const rLeg = new THREE.Bone(); rLeg.name='rLeg'; rLeg.position.set(0,-0.45,0);
    const lHip = new THREE.Bone(); lHip.name='lHip'; lHip.position.set(-0.18,-0.1,0);
    const lLeg = new THREE.Bone(); lLeg.name='lLeg'; lLeg.position.set(0,-0.45,0);

    root.add(spine); spine.add(chest); chest.add(neck); neck.add(head);
    chest.add(rShoulder); rShoulder.add(rArm);
    chest.add(lShoulder); lShoulder.add(lArm);
    root.add(rHip); rHip.add(rLeg);
    root.add(lHip); lHip.add(lLeg);

    this.bones = { root, spine, chest, neck, head, rShoulder, rArm, lShoulder, lArm, rHip, rLeg, lHip, lLeg };

    // Skeleton
    const skeleton = new THREE.Skeleton(Object.values(this.bones));
    // We'll attach meshes to bones directly (not skinned) for simplicity, but keep bones for animation.
    g.add(root);

    // Meshes attached to bones
    const bodyMat = new THREE.MeshStandardMaterial({ color:0x1f2a3a, roughness:0.7, metalness:0.3 });
    const skinMat = new THREE.MeshStandardMaterial({ color:0xd9b08c, roughness:0.8 });
    const cloakMat = new THREE.MeshStandardMaterial({ color:0x0b1a33, roughness:0.9 });

    const hipsMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.35,0.5,6,12), bodyMat);
    hipsMesh.position.y = -0.1;
    root.add(hipsMesh);
    const spineMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.3,0.4,6,12), bodyMat);
    spineMesh.position.y = 0.2;
    spine.add(spineMesh);
    const chestMesh = new THREE.Mesh(new THREE.BoxGeometry(0.7,0.45,0.35), bodyMat);
    chestMesh.position.y = 0.15;
    chest.add(chestMesh);
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.28,12,12), skinMat);
    headMesh.position.y = 0.1;
    head.add(headMesh);

    const makeLimb = (bone, radius, length, mat) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius*0.85, length, 8), mat);
      m.position.y = -length/2;
      bone.add(m);
    };
    makeLimb(rArm, 0.1, 0.7, bodyMat);
    makeLimb(lArm, 0.1, 0.7, bodyMat);
    makeLimb(rLeg, 0.13, 0.8, bodyMat);
    makeLimb(lLeg, 0.13, 0.8, bodyMat);

    // Cloak
    const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.6,1.4,8), cloakMat);
    cloak.position.y = -0.2; cloak.rotation.x = Math.PI;
    spine.add(cloak);

    // Sword attached to right arm
    this.sword = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06,1.3,0.02), new THREE.MeshStandardMaterial({ color:0xcfd8e3, metalness:0.9, roughness:0.2, emissive:0x223344, emissiveIntensity:0.3 }));
    blade.position.y = 0.65;
    this.sword.add(blade);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.35,0.06,0.1), new THREE.MeshStandardMaterial({ color:0x7a5a2a, metalness:0.6 }));
    this.sword.add(guard);
    this.sword.position.set(0.15,-0.2,0.1);
    rArm.add(this.sword);

    // Aura for shikai etc
    this.aura = new THREE.Mesh(new THREE.SphereGeometry(1.1,16,16), new THREE.MeshBasicMaterial({ color:0x3498db, transparent:true, opacity:0, side:THREE.DoubleSide }));
    this.aura.position.y = 1;
    this.group.add(this.aura);

    this.meshBody = chestMesh;
    this.skeleton = skeleton;
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
    this.shikaiTimer = 0; this.blutTimer = 0;
    this.flashCooldown = 0; this.signatureCooldown = 0;
    // reset bones
    Object.values(this.bones).forEach(b => { b.rotation.set(0,0,0); });
  }

  applyRace() {
    if (this.race === 'quincy') { this.damage = 16; this.maxMana = 80; }
    else if (this.race === 'hollow') { this.damage = 20; this.maxHp = 120; }
    else { this.damage = 18; }
    if (this.hp > this.maxHp) this.hp = this.maxHp;
    if (this.mana > this.maxMana) this.mana = this.maxMana;
  }

  selectSlot(i) { this.selectedSlot = i; if (i >= 1) this.currentSpell = i-1; }
  cycleSpell(dir) { this.currentSpell = (this.currentSpell + dir + this.spells.length) % this.spells.length; }

  tryAttack() {
    if (this.state === 'dead') return;
    if (this.state === 'dodge' || this.state === 'cast' || this.state === 'stagger') return;
    if (this.attackCooldown > 0) return;
    const cost = 12;
    if (this.stamina < cost) return;
    this.stamina -= cost;
    this.state = 'attack';
    this.stateTimer = this.attackDuration;
    this.attackTimer = 0;
    this.attackActive = false;
    this.attackHitSet.clear();
    let cd = 0.55;
    if (this.shikaiTimer > 0) cd = 0.35;
    this.attackCooldown = cd;
    this.audio.play('swing');
  }

  startBlock() {
    if (this.state === 'dead' || this.state === 'dodge' || this.state === 'stagger') return;
    this.blocking = true;
    this.state = 'block';
    this.blockStartTime = performance.now()/1000;
  }
  endBlock() {
    if (this.state === 'block') this.state = 'idle';
    this.blocking = false;
  }

  dodge() {
    if (this.state === 'dead' || this.state === 'dodge' || this.state === 'stagger' || this.state === 'cast') return;
    if (this.stamina < 20) return;
    this.stamina -= 20;
    this.state = 'dodge';
    this.stateTimer = this.dodgeTime;
    this.iFrames = 0.45;
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
    if (this.mana < cost) return;
    this.mana -= cost;
    this.state = 'cast';
    this.stateTimer = 0.5;
    this.castCooldown = 0.8;
    this.audio.play('cast');
    this.pendingCast = spell;
  }

  flashStep() {
    if (this.state === 'dead' || this.flashCooldown > 0) return;
    if (this.stamina < 15) return;
    this.stamina -= 15;
    this.flashCooldown = 3;
    this.iFrames = 0.25;
    const fwd = this.getForward();
    // teleport
    this.group.position.addScaledVector(fwd, 6);
    // clamp
    const r = Math.hypot(this.group.position.x, this.group.position.z);
    if (r > 44) { const s=44/r; this.group.position.x*=s; this.group.position.z*=s; }
    if (this.group.position.y < 0) this.group.position.y = 0;
    this.effects.spawnHit(this.group.position.clone().add(new THREE.Vector3(0,1,0)), 0xffffff);
    this.audio.play('dodge');
  }

  signature() {
    if (this.state === 'dead' || this.signatureCooldown > 0) return;
    if (this.race === 'soulreaper') {
      if (this.mana < 30) return;
      this.mana -= 30;
      this.shikaiTimer = 8;
      this.signatureCooldown = 15;
      this.aura.material.opacity = 0.35;
      this.aura.material.color.set(0x3498db);
      this.effects.spawnHit(this.group.position.clone().add(new THREE.Vector3(0,1.5,0)), 0x3498db);
      this.audio.play('cast');
    } else if (this.race === 'quincy') {
      if (this.mana < 25) return;
      this.mana -= 25;
      this.blutTimer = 5;
      this.signatureCooldown = 12;
      this.aura.material.opacity = 0.3;
      this.aura.material.color.set(0xff3366);
      this.effects.spawnHit(this.group.position.clone().add(new THREE.Vector3(0,1.5,0)), 0xff3366);
      this.audio.play('cast');
    } else {
      // Hollow: Cero beam
      if (this.mana < 40) return;
      this.mana -= 40;
      this.signatureCooldown = 10;
      const origin = this.group.position.clone().add(new THREE.Vector3(0,1.4,0));
      const fwd = this.getForward();
      this.effects.spawnProjectile(origin, fwd, 'fireball', null);
      // extra damage handled in combat? We'll spawn multiple
      this.effects.spawnProjectile(origin.clone().add(new THREE.Vector3(0,0.2,0)), fwd, 'fireball', null);
      this.audio.play('cast');
    }
  }

  takeDamage(amount, fromPos, isParryable=true) {
    if (this.iFrames > 0) return false;
    let dmg = amount;
    if (this.blutTimer > 0) dmg *= 0.4;
    if (this.state === 'block') {
      const now = performance.now()/1000;
      const t = now - (this.blockStartTime||0);
      if (t < 0.18 && isParryable) {
        this.effects.spawnParry(this.group.position.clone().add(new THREE.Vector3(0,1.2,0)));
        this.audio.play('parry');
        this.posture = Math.max(0, this.posture - 30);
        return 'parried';
      }
      const reduced = dmg * 0.3;
      this.hp -= reduced;
      this.stamina -= 15;
      this.posture += dmg*0.6;
      this.effects.spawnHit(this.group.position.clone().add(new THREE.Vector3(0,1.2,0)), 0x3498db);
      if (this.posture >= this.maxPosture) {
        this.state = 'stagger'; this.stateTimer = 0.8; this.blocking = false;
        this.posture = this.maxPosture;
        this.audio.play('stagger');
      }
      return 'blocked';
    }
    this.hp -= dmg;
    this.effects.spawnHit(this.group.position.clone().add(new THREE.Vector3(0,1.2,0)), 0xff4444);
    this.audio.play('hit');
    if (dmg > 15) { this.state = 'stagger'; this.stateTimer = 0.4; }
    return 'hit';
  }

  heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); }
  addXp(v) { this.pendingXp = (this.pendingXp||0) + v; }

  update(dt) {
    // cooldowns
    if (this.flashCooldown > 0) this.flashCooldown -= dt;
    if (this.signatureCooldown > 0) this.signatureCooldown -= dt;
    if (this.shikaiTimer > 0) {
      this.shikaiTimer -= dt;
      this.aura.material.opacity = 0.25 + Math.sin(Date.now()*0.01)*0.1;
      if (this.shikaiTimer <= 0) { this.aura.material.opacity = 0; }
    }
    if (this.blutTimer > 0) {
      this.blutTimer -= dt;
      this.aura.material.opacity = 0.2 + Math.sin(Date.now()*0.01)*0.08;
      if (this.blutTimer <= 0) { this.aura.material.opacity = 0; }
    }

    // regen
    if (this.state !== 'block') this.stamina = Math.min(this.maxStamina, this.stamina + 18*dt);
    this.mana = Math.min(this.maxMana, this.mana + 8*dt);
    this.posture = Math.max(0, this.posture - this.postureRegen*dt);
    if (this.iFrames > 0) this.iFrames -= dt;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this.castCooldown > 0) this.castCooldown -= dt;
    if (this.invuln > 0) this.invuln -= dt;

    if (this.stateTimer > 0) {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        if (this.state === 'attack' || this.state === 'cast' || this.state === 'stagger' || this.state === 'dodge') this.state = 'idle';
      }
    }

    if (this.state === 'attack') {
      this.attackTimer += dt;
      this.attackActive = (this.attackTimer >= 0.12 && this.attackTimer <= 0.3);
    } else {
      this.attackActive = false;
    }

    // movement
    const move = this.input.getMoveDir(this.yaw);
    const baseSpeed = this.shikaiTimer > 0 ? this.speed*1.2 : this.speed;
    const speed = (this.state === 'dodge') ? 0 : (this.state === 'attack' ? baseSpeed*0.5 : baseSpeed);
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

    if (!this.onGround) this.verticalVel += this.gravity * dt;
    this.group.position.x += vx * dt;
    this.group.position.z += vz * dt;
    this.group.position.y += this.verticalVel * dt;
    if (this.group.position.y <= 0) { this.group.position.y = 0; this.verticalVel = 0; this.onGround = true; }
    else this.onGround = false;

    const r = Math.hypot(this.group.position.x, this.group.position.z);
    if (r > 44) { const s = 44/r; this.group.position.x *= s; this.group.position.z *= s; }

    if (this.input.consumeJump() && this.onGround && this.state !== 'dodge') {
      this.verticalVel = 8; this.onGround = false;
    }

    this.yaw = this.input.yaw;
    this.group.rotation.y = this.yaw;

    const moving = Math.abs(vx)+Math.abs(vz) > 0.5;
    if (moving && this.onGround && this.state === 'idle') this.state = 'walk';
    if (!moving && this.state === 'walk') this.state = 'idle';

    if (this.pendingCast) {
      const sp = this.pendingCast;
      this.pendingCast = null;
      this.effects.spawnCast(this.group.position.clone(), sp, this.yaw);
      if (this.onCast) this.onCast(sp, this);
    }

    // ---- Bone animations ----
    const t = performance.now()*0.001;
    const b = this.bones;
    // reset
    Object.values(b).forEach(bone => { bone.rotation.x = 0; bone.rotation.z = 0; });
    // breathing
    b.spine.rotation.x = Math.sin(t*2)*0.03;
    b.chest.rotation.x = Math.sin(t*2+0.5)*0.02;

    if (this.state === 'walk') {
      const s = t*10;
      b.rLeg.rotation.x = Math.sin(s)*0.6;
      b.lLeg.rotation.x = -Math.sin(s)*0.6;
      b.rArm.rotation.x = -Math.sin(s)*0.5;
      b.lArm.rotation.x = Math.sin(s)*0.5;
      b.spine.rotation.x += Math.sin(s*2)*0.05;
    } else if (this.state === 'idle') {
      b.rArm.rotation.x = -0.2 + Math.sin(t*1.5)*0.05;
      b.lArm.rotation.x = -0.1 + Math.sin(t*1.5+1)*0.05;
    }

    if (this.state === 'attack') {
      const at = this.attackTimer / this.attackDuration;
      const swing = Math.sin(at*Math.PI);
      b.rArm.rotation.x = -Math.PI/2 * swing - 0.2;
      b.rShoulder.rotation.z = -0.3*swing;
      this.sword.rotation.x = -Math.PI/2 + Math.PI*0.9*swing;
    } else {
      this.sword.rotation.x += (-Math.PI/4 - this.sword.rotation.x)*dt*8;
    }

    if (this.state === 'block') {
      b.rArm.rotation.x = -1.2;
      b.lArm.rotation.x = -1.0;
      b.spine.rotation.x = -0.1;
    }
    if (this.state === 'cast') {
      b.rArm.rotation.x = -1.8;
      b.lArm.rotation.x = -1.8;
      b.spine.rotation.x = -0.15;
    }
    if (this.state === 'dodge') {
      b.root.rotation.z = Math.sin((1-this.stateTimer/this.dodgeTime)*Math.PI)*0.8;
      b.root.rotation.x = 0.4;
    } else {
      b.root.rotation.z += (0 - b.root.rotation.z)*dt*8;
      b.root.rotation.x += (0 - b.root.rotation.x)*dt*8;
    }

    // aura pulse
    if (this.aura.material.opacity > 0) {
      const s = 1 + Math.sin(t*4)*0.08;
      this.aura.scale.set(s,s,s);
    }
  }

  updateCamera(camera) {
    const target = this.group.position.clone().add(new THREE.Vector3(0, 1.6, 0));
    const offset = new THREE.Vector3(0, this.camHeight, this.camDistance);
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
