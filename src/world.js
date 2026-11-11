import * as THREE from 'three';

export class World {
  constructor(scene) {
    this.scene = scene;
    this.time = 0;
    this.build();
  }
  build() {
    const scene = this.scene;
    // Sky / fog handled in main; add hemisphere
    const hemi = new THREE.HemisphereLight(0x1a2a4a, 0x050508, 0.6);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0x6fa8ff, 1.2);
    this.dirLight = dir;
    dir.position.set(30, 50, 20);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024,1024);
    dir.shadow.camera.near = 1; dir.shadow.camera.far = 120;
    dir.shadow.camera.left = -60; dir.shadow.camera.right = 60;
    dir.shadow.camera.top = 60; dir.shadow.camera.bottom = -60;
    scene.add(dir);

    // Ground arena - circular platform
    const groundGeo = new THREE.CircleGeometry(45, 64);
    const groundMat = new THREE.MeshStandardMaterial({ color:0x1a1f2e, roughness:0.9, metalness:0.1 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI/2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid lines
    const grid = new THREE.GridHelper(90, 45, 0x1f3355, 0x111a2a);
    grid.position.y = 0.01;
    scene.add(grid);

    // Sky dome
    const skyGeo = new THREE.SphereGeometry(200, 32, 16);
    const skyMat = new THREE.MeshBasicMaterial({ color:0x07122a, side:THREE.BackSide, fog:false });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);

    // Ring wall
    const wallGeo = new THREE.CylinderGeometry(48, 48, 6, 64, 1, true);
    const wallMat = new THREE.MeshStandardMaterial({ color:0x0c1020, roughness:1, side:THREE.DoubleSide });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.y = 3;
    scene.add(wall);

    // Pillars
    for (let i=0;i<8;i++){
      const a = i/12*Math.PI*2;
      const r = 30;
      const h = 4 + Math.random()*4;
      const geo = new THREE.CylinderGeometry(0.6,0.8,h,8);
      const mat = new THREE.MeshStandardMaterial({ color:0x22283a, roughness:0.8, metalness:0.2 });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(Math.cos(a)*r, h/2, Math.sin(a)*r);
      m.castShadow = true; m.receiveShadow = true;
      scene.add(m);
      // crystal on top
      const cgeo = new THREE.OctahedronGeometry(0.5);
      const cmat = new THREE.MeshStandardMaterial({ color:0x3498db, emissive:0x3498db, emissiveIntensity:1.5, roughness:0.2 });
      const c = new THREE.Mesh(cgeo, cmat);
      c.position.set(Math.cos(a)*r, h+0.6, Math.sin(a)*r);
      scene.add(c);
      this.crystals = this.crystals || [];
      this.crystals.push(c);
    }

    // Platforms
    for (let i=0;i<5;i++){
      const x = (Math.random()-0.5)*40;
      const z = (Math.random()-0.5)*40;
      const h = 1 + Math.random()*2;
      const geo = new THREE.BoxGeometry(6, h, 6);
      const mat = new THREE.MeshStandardMaterial({ color:0x1e2638, roughness:0.85 });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, h/2, z);
      m.castShadow = true; m.receiveShadow = true;
      scene.add(m);
    }

    // Ambient particles
    const pCount = 200;
    const pos = new Float32Array(pCount*3);
    for (let i=0;i<pCount;i++){ pos[i*3]=(Math.random()-0.5)*90; pos[i*3+1]=Math.random()*20; pos[i*3+2]=(Math.random()-0.5)*90; }
    const pgeo = new THREE.BufferGeometry();
    pgeo.setAttribute('position', new THREE.BufferAttribute(pos,3));
    const pmat = new THREE.PointsMaterial({ color:0x6fa8ff, size:0.15, transparent:true, opacity:0.6, sizeAttenuation:true });
    this.particles = new THREE.Points(pgeo, pmat);
    scene.add(this.particles);

    // Light points
    for (let i=0;i<4;i++){
      const a = i/6*Math.PI*2;
      const pl = new THREE.PointLight(0x3498db, 1.2, 25);
      pl.position.set(Math.cos(a)*20, 3, Math.sin(a)*20);
      scene.add(pl);
    }
  }
  update(dt) {
    this.time += dt;
    if (this.crystals) this.crystals.forEach((c,i) => { c.rotation.y += dt*0.8; c.position.y += Math.sin(this.time*2+i)*0.002; });
    if (this.particles) { this.particles.rotation.y += dt*0.02; }
    if (this.dirLight) this.dirLight.intensity = 1.1 + Math.sin(this.time*0.7)*0.15;
  }
}
