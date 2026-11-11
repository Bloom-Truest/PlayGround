import * as THREE from 'three';

export class Combat {
  constructor(player, enemies, effects, audio) {
    this.player = player;
    this.enemies = enemies;
    this.effects = effects;
    this.audio = audio;
    this.player.onCast = (spell, p) => this.castSpell(spell, p);
  }
  update(dt) {
    const p = this.player;
    // player melee hits
    if (p.state === 'attack' && p.attackActive) {
      const fwd = p.getForward();
      const origin = p.group.position.clone().add(new THREE.Vector3(0,1.2,0));
      for (const e of this.enemies.getAlive()) {
        if (p.attackHitSet.has(e)) continue;
        const toE = new THREE.Vector3().subVectors(e.group.position, p.group.position);
        const dist = toE.length();
        if (dist > 2.6) continue;
        toE.y = 0; toE.normalize();
        const dot = fwd.dot(toE);
        if (dot < 0.35) continue;
        // hit
        p.attackHitSet.add(e);
        const dmg = p.damage + (p.talents.strength*5);
        const res = e.takeDamage(dmg, p.group.position);
        this.effects.spawnHit(e.group.position.clone().add(new THREE.Vector3(0,1.2,0)), 0xffcc66);
        if (res !== undefined) this.audio.play('hit');
        // knockback
        const kb = toE.clone().multiplyScalar(2.5);
        e.group.position.add(kb);
      }
    }
    // projectile collisions handled in effects? We'll check projectiles here
    // iterate effects particles projectiles
    for (const part of this.effects.particles) {
      if (!part.projectile) continue;
      // check enemy hits
      for (const e of this.enemies.getAlive()) {
        if (part.hit) continue;
        const d = part.mesh.position.distanceTo(e.group.position.clone().add(new THREE.Vector3(0,1,0)));
        if (d < 1.4) {
          part.hit = true;
          part.life = 0.01;
          e.takeDamage(part.spell==='fireball'?28:22, this.player.group.position);
          this.effects.spawnHit(e.group.position.clone().add(new THREE.Vector3(0,1.2,0)), 0xff6622);
        }
      }
      // player hit by enemy projectiles? caster spawns frost with onHit callback already
    }
  }
  castSpell(spell, p) {
    const origin = p.group.position.clone().add(new THREE.Vector3(0,1.2,0));
    const fwd = p.getForward();
    if (spell === 'fireball') {
      this.effects.spawnProjectile(origin, fwd, 'fireball', null);
      this.audio.play('cast');
    } else if (spell === 'frostnova') {
      this.effects.spawnNova(p.group.position.clone());
      // damage all enemies in radius
      for (const e of this.enemies.getAlive()) {
        const d = e.group.position.distanceTo(p.group.position);
        if (d < 7) {
          e.takeDamage(20 + p.talents.arcane*4, p.group.position);
          // slow? skip
        }
      }
      this.audio.play('cast');
    } else if (spell === 'heal') {
      p.heal(35 + p.talents.arcane*5);
      this.effects.spawnHit(origin, 0x66ff99);
      this.audio.play('cast');
    }
  }
}
