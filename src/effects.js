import * as THREE from 'three';

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
  }
  spawnHit(pos, color=0xff4444) {
    for (let i=0;i<12;i++){
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.06,6,6), new THREE.MeshBasicMaterial({ color, transparent:true }));
      m.position.copy(pos);
      const vel = new THREE.Vector3((Math.random()-0.5)*6, Math.random()*4+1, (Math.random()-0.5)*6);
      this.particles.push({ mesh:m, vel, life:0.5, max:0.5 });
      this.scene.add(m);
    }
  }
  spawnParry(pos) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8,0.05,8,24), new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true }));
    ring.position.copy(pos);
    ring.rotation.x = Math.PI/2;
    this.particles.push({ mesh:ring, vel:new THREE.Vector3(0,0,0), life:0.4, max:0.4, scale:true });
    this.scene.add(ring);
  }
  spawnCast(pos, spell, yaw) {
    const color = spell==='fireball'?0xff6622 : spell==='frostnova'?0x66ccff : 0x66ff99;
    // muzzle flash
    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.3,8,8), new THREE.MeshBasicMaterial({ color, transparent:true }));
    flash.position.copy(pos).add(new THREE.Vector3(0,1.2,0));
    this.particles.push({ mesh:flash, vel:new THREE.Vector3(0,0,0), life:0.25, max:0.25, scale:true });
    this.scene.add(flash);
  }
  spawnProjectile(start, dir, spell, onHit) {
    const color = spell==='fireball'?0xff6622:0x66ccff;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.25,8,8), new THREE.MeshStandardMaterial({ color, emissive:color, emissiveIntensity:2 }));
    m.position.copy(start);
    const light = new THREE.PointLight(color, 2, 12);
    m.add(light);
    this.scene.add(m);
    this.particles.push({ mesh:m, vel:dir.clone().multiplyScalar(22), life:3, max:3, projectile:true, spell, onHit, hit:false });
  }
  spawnNova(pos) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.3, 32), new THREE.MeshBasicMaterial({ color:0x66ccff, transparent:true, side:THREE.DoubleSide }));
    ring.position.copy(pos); ring.position.y = 0.1; ring.rotation.x = -Math.PI/2;
    this.scene.add(ring);
    this.particles.push({ mesh:ring, vel:new THREE.Vector3(0,0,0), life:0.6, max:0.6, nova:true });
  }
  update(dt) {
    for (let i=this.particles.length-1;i>=0;i--){
      const p = this.particles[i];
      p.life -= dt;
      if (p.projectile) {
        p.mesh.position.addScaledVector(p.vel, dt);
        if (p.mesh.position.y < 0.2) { p.mesh.position.y = 0.2; }
        // collision with player (enemy projectiles)
        if (!p.hit && p.onHit && this.player) {
          const d = p.mesh.position.distanceTo(this.player.group.position.clone().add(new THREE.Vector3(0,1,0)));
          if (d < 1.2) {
            p.hit = true;
            p.onHit(p.mesh.position.clone());
            p.life = 0.01;
          }
        }
        // out of bounds
        if (Math.abs(p.mesh.position.x)>46 || Math.abs(p.mesh.position.z)>46) p.life = 0.01;
      } else if (p.nova) {
        const s = 1 + (1 - p.life/p.max)*18;
        p.mesh.scale.set(s,s,1);
        p.mesh.material.opacity = p.life/p.max;
      } else if (p.scale) {
        const s = 1 + (1 - p.life/p.max)*2;
        p.mesh.scale.set(s,s,s);
        p.mesh.material.opacity = p.life/p.max;
      } else {
        p.mesh.position.addScaledVector(p.vel, dt);
        p.vel.y -= 9.8*dt;
        p.mesh.material.opacity = p.life/p.max;
      }
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i,1);
      }
    }
  }
  clear() { this.particles.forEach(p=>this.scene.remove(p.mesh)); this.particles=[]; }
}
