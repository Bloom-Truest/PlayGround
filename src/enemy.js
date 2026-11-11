import * as THREE from 'three';

export class EnemyManager {
  constructor(scene, player, audio, effects) {
    this.scene = scene;
    this.player = player;
    this.audio = audio;
    this.effects = effects;
    this.enemies = [];
    this.pickups = [];
  }
  clear() {
    this.enemies.forEach(e => this.scene.remove(e.group));
    this.enemies = [];
    this.pickups.forEach(p => this.scene.remove(p.mesh));
    this.pickups = [];
  }
  count() { return this.enemies.filter(e=>e.alive).length; }
  spawnWave(wave) {
    this.clear();
    this.pickups.forEach(p => this.scene.remove(p.mesh));
    this.pickups = [];
    if (wave % 5 === 0) {
      const e = new Enemy(this.scene, this.player, 'boss', wave, this.audio, this.effects);
      e.group.position.set(0,0,-22);
      this.enemies.push(e);
      return;
    }
    const n = Math.min(3 + wave, 10);
    for (let i=0;i<n;i++){
      const type = (i % 3 === 0 && wave>1) ? 'brute' : (i % 5 === 0 ? 'caster' : 'hollow');
      const e = new Enemy(this.scene, this.player, type, wave, this.audio, this.effects);
      const a = Math.random()*Math.PI*2;
      const r = 18 + Math.random()*15;
      e.group.position.set(Math.cos(a)*r, 0, Math.sin(a)*r);
      this.enemies.push(e);
    }
  }
  update(dt) {
    this.enemies.forEach(e => { if (e.alive) e.update(dt); });
    // spawn pickups for newly dead
    this.enemies.forEach(e => {
      if (!e.alive && !e.dropped) {
        e.dropped = true;
        const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), new THREE.MeshStandardMaterial({ color:0x66ff99, emissive:0x66ff99, emissiveIntensity:1.5 }));
        mesh.position.copy(e.group.position); mesh.position.y = 0.6;
        this.scene.add(mesh);
        this.pickups.push({ mesh, life: 30 });
      }
    });
    // pickups update
    const pPos = this.player.group.position;
    for (let i=this.pickups.length-1;i>=0;i--){
      const pk = this.pickups[i];
      pk.mesh.rotation.y += dt*2;
      pk.mesh.position.y = 0.6 + Math.sin(Date.now()*0.005)*0.1;
      pk.life -= dt;
      if (pk.mesh.position.distanceTo(pPos) < 1.6) {
        this.player.heal(30);
        this.player.mana = Math.min(this.player.maxMana, this.player.mana+15);
        this.effects.spawnHit(pk.mesh.position.clone(), 0x66ff99);
        this.scene.remove(pk.mesh);
        this.pickups.splice(i,1);
        continue;
      }
      if (pk.life <= 0) { this.scene.remove(pk.mesh); this.pickups.splice(i,1); }
    }
    // remove dead after timer
    this.enemies = this.enemies.filter(e => {
      if (!e.alive && e.removeTimer <= 0) { this.scene.remove(e.group); return false; }
      if (!e.alive) e.removeTimer -= dt;
      return true;
    });
  }
  getAlive() { return this.enemies.filter(e=>e.alive); }
}

export class Enemy {
  constructor(scene, player, type, wave, audio, effects) {
    this.scene = scene;
    this.player = player;
    this.audio = audio;
    this.effects = effects;
    this.type = type;
    this.alive = true;
    this.removeTimer = 2;
    this.dropped = false;
    this.wave = wave;

    // stats
    if (type === 'brute') { this.maxHp=80+wave*10; this.damage=14+wave*2; this.speed=3.5; this.xp=40; this.range=2.2; this.attackCd=1.6; }
    else if (type === 'caster') { this.maxHp=40+wave*6; this.damage=10+wave; this.speed=4; this.xp=35; this.range=12; this.attackCd=2.0; }
    else if (type === 'boss') { this.maxHp=300+wave*40; this.damage=22+wave*3; this.speed=4; this.xp=200; this.range=2.8; this.attackCd=1.2; }
    else { this.maxHp=35+wave*8; this.damage=8+wave; this.speed=5; this.xp=20; this.range=1.9; this.attackCd=1.1; }
    this.hp = this.maxHp;
    this.attackTimer = 0;
    this.state = 'idle'; // idle/chase/attack/stagger/dead
    this.stateTimer = 0;
    this.staggerTimer = 0;
    this.hitFlash = 0;

    this.group = new THREE.Group();
    this.buildMesh();
    scene.add(this.group);
  }
  buildMesh() {
    const color = this.type==='brute'?0x5a3a2a : this.type==='caster'?0x3a2a5a : this.type==='boss'?0x7a1a1a : 0x2a4a3a;
    const size = this.type==='brute'?1.3 : this.type==='boss'?1.8 : 1;
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4*size, 1*size, 6, 12), new THREE.MeshStandardMaterial({ color, roughness:0.8 }));
    body.position.y = 1*size;
    body.castShadow = true;
    this.group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28*size, 10,10), new THREE.MeshStandardMaterial({ color:0x8a6a5a, roughness:0.9 }));
    head.position.y = 1.85*size;
    this.group.add(head);
    if (this.type === 'caster') {
      const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,1.8), new THREE.MeshStandardMaterial({ color:0x5a3a7a, emissive:0x5a3a7a, emissiveIntensity:0.5 }));
      staff.position.set(0.5,1,0); staff.rotation.z=0.2;
      this.group.add(staff);
    }
    this.bodyMesh = body;
    // health bar sprite
    const barGeo = new THREE.PlaneGeometry(1.2,0.12);
    const barMat = new THREE.MeshBasicMaterial({ color:0xff4444, side:THREE.DoubleSide });
    this.hpBar = new THREE.Mesh(barGeo, barMat);
    this.hpBar.position.y = 2.4*size;
    this.group.add(this.hpBar);
    this.hpBarBg = new THREE.Mesh(new THREE.PlaneGeometry(1.2,0.12), new THREE.MeshBasicMaterial({ color:0x222222, side:THREE.DoubleSide }));
    this.hpBarBg.position.y = 2.4*size; this.hpBarBg.position.z = -0.01;
    this.group.add(this.hpBarBg);
  }
  takeDamage(amount, fromDir) {
    if (!this.alive) return;
    this.hp -= amount;
    this.hitFlash = 0.15;
    this.effects.spawnHit(this.group.position.clone().add(new THREE.Vector3(0,1.2,0)), 0xffaa44);
    this.audio.play('enemy');
    if (this.hp <= 0) {
      this.die();
      this.player.addXp(this.xp);
      return;
    }
    // stagger
    if (amount > 8) {
      this.state = 'stagger'; this.stateTimer = 0.35;
    }
  }
  die() {
    this.alive = false;
    this.state = 'dead';
    // collapse
    this.group.rotation.x = -Math.PI/2;
    this.group.position.y = 0.3;
    this.audio.play('enemy');
  }
  update(dt) {
    if (!this.alive) { this.removeTimer -= dt; return; }
    if (this.hitFlash > 0) { this.hitFlash -= dt; this.bodyMesh.material.emissive = this.bodyMesh.material.emissive || new THREE.Color(0); this.bodyMesh.material.emissiveIntensity = this.hitFlash>0?2:0; }
    // hp bar scale
    const ratio = Math.max(0, this.hp/this.maxHp);
    this.hpBar.scale.x = ratio;
    this.hpBar.position.x = -(1-ratio)*0.6;

    // face player
    const pPos = this.player.group.position;
    const dx = pPos.x - this.group.position.x;
    const dz = pPos.z - this.group.position.z;
    const dist = Math.hypot(dx,dz);

    if (this.stateTimer > 0) { this.stateTimer -= dt; if (this.stateTimer <= 0) this.state = 'idle'; }

    if (this.state === 'stagger') return;

    // detection
    if (dist > 28) { this.state = 'idle'; return; }

    if (dist <= this.range) {
      this.state = 'attack';
      if (this.attackTimer <= 0) {
        this.attackTimer = this.attackCd;
        // telegraph + damage
        this.performAttack(dist);
      }
    } else {
      this.state = 'chase';
      // move toward player
      const nx = dx/dist, nz = dz/dist;
      this.group.position.x += nx * this.speed * dt;
      this.group.position.z += nz * this.speed * dt;
      this.group.rotation.y = Math.atan2(dx, dz);
    }

    if (this.attackTimer > 0) this.attackTimer -= dt;

    // keep on ground
    if (this.group.position.y < 0) this.group.position.y = 0;
    // clamp arena
    const r = Math.hypot(this.group.position.x, this.group.position.z);
    if (r > 44) { const s=44/r; this.group.position.x*=s; this.group.position.z*=s; }
  }
  performAttack(dist) {
    this.audio.play('enemy');
    const p = this.player;
    // caster ranged projectile
    if (this.type === 'caster') {
      const dir = new THREE.Vector3().subVectors(p.group.position, this.group.position).normalize();
      this.effects.spawnProjectile(this.group.position.clone().add(new THREE.Vector3(0,1.2,0)), dir, 'frost', (hitPos) => {
        const d = p.group.position.distanceTo(hitPos);
        if (d < 1.5) {
          const res = p.takeDamage(this.damage, this.group.position);
          if (res === 'parried') { this.takeDamage(20, p.group.position); }
        }
      });
      return;
    }
    // melee
    setTimeout(() => {
      if (!this.alive) return;
      const d = this.group.position.distanceTo(this.player.group.position);
      if (d <= this.range + 0.6) {
        const res = this.player.takeDamage(this.damage, this.group.position);
        if (res === 'parried') { this.takeDamage(25, this.player.group.position); this.state='stagger'; this.stateTimer=0.6; }
      }
    }, 350);
  }
}
