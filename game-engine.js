import * as THREE from 'three';
import { PointerLockControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/PointerLockControls.js';

// --- SCENE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xddeeff);
scene.fog = new THREE.Fog(0xddeeff, 50, 300);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, precision: "highp" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// --- UI ELEMENTS ---
const menus = { 
    main: document.getElementById('menu-container'), 
    wpn: document.getElementById('weapon-container'), 
    set: document.getElementById('settings-container') 
};
const fpsEl = document.getElementById('fps-counter');
const blurToggle = document.getElementById('blur-toggle');

// --- GAME STATE ---
let playerHealth = 100;
let killCount = 0;
const healthBarEl = document.getElementById('health-bar');
const healthTextEl = document.getElementById('health-text');
const damageFlashEl = document.getElementById('damage-flash');
const killCounterEl = document.getElementById('kill-counter');

function damagePlayer(amount) {
    playerHealth = Math.max(0, playerHealth - amount);
    healthBarEl.style.width = playerHealth + '%';
    healthTextEl.innerText = "HEALTH: " + Math.round(playerHealth) + "%";
    damageFlashEl.style.opacity = "0.4";
    setTimeout(() => damageFlashEl.style.opacity = "0", 100);
    if(playerHealth <= 0) { alert("GAME OVER! KILLS: " + killCount); location.reload(); }
}

// --- SETTINGS & NAVIGATION LOGIC ---
document.getElementById('open-settings').onclick = () => {
    menus.main.style.display = 'none';
    menus.set.style.display = 'flex';
};
document.getElementById('back-to-menu').onclick = () => {
    menus.set.style.display = 'none';
    menus.main.style.display = 'flex';
};

// --- FPS TRACKING ---
let frames = 0;
let prevTime = performance.now();
function updateFPS() {
    frames++;
    const time = performance.now();
    if (time >= prevTime + 1000) {
        fpsEl.innerText = "FPS: " + frames;
        frames = 0;
        prevTime = time;
    }
}

// --- LIGHTING & ENVIRONMENT ---
const sun = new THREE.DirectionalLight(0xffffff, 4.0);
sun.position.set(100, 200, 100);
sun.castShadow = true;
scene.add(sun, new THREE.AmbientLight(0xffffff, 0.6));

const floor = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), new THREE.MeshStandardMaterial({ color: 0x1a3311 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const grassCount = 15000;
const grassGeo = new THREE.PlaneGeometry(0.1, 0.6);
const grassMat = new THREE.MeshStandardMaterial({ color: 0x55aa44, side: THREE.DoubleSide, alphaTest: 0.5 });
const instancedGrass = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);
const dummy = new THREE.Object3D();
for (let i = 0; i < grassCount; i++) {
    dummy.position.set(Math.random() * 150 - 75, 0.3, Math.random() * 150 - 75);
    dummy.rotation.y = Math.random() * Math.PI;
    dummy.updateMatrix();
    instancedGrass.setMatrixAt(i, dummy.matrix);
}
scene.add(instancedGrass);

// --- VFX ---
const particles = [];
function spawnBlood(pos) {
    for(let i=0; i<8; i++) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: 0xaa0000 }));
        p.position.copy(pos);
        const vel = new THREE.Vector3((Math.random()-0.5)*5, Math.random()*5, (Math.random()-0.5)*5);
        scene.add(p);
        particles.push({ mesh: p, vel: vel, life: 1.0 });
    }
}

// --- VEHICLE CLASS ---
class GolfCart {
    constructor() {
        this.group = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee });
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 });
        const seatMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
        const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
        const rimMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.5 });
        const glassMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, roughness: 0 });

        const base = new THREE.Mesh(new THREE.BoxGeometry(2, 0.2, 3.8), bodyMat);
        base.position.y = 0.4;
        const fSeat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 0.9), seatMat);
        fSeat.position.set(0, 0.6, -0.1);
        const bSeat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 0.8), seatMat);
        bSeat.position.set(0, 0.6, -1.3);
        const dash = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 0.4), bodyMat);
        dash.position.set(0, 1.0, 1.1);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.1, 3.2), bodyMat);
        roof.position.set(0, 2.7, -0.2); 
        this.group.add(base, fSeat, bSeat, dash, roof);

        [[-0.9, 1.2], [0.9, 1.2], [-0.9, -1.6], [0.9, -1.6]].forEach(p => {
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.3), metalMat);
            pole.position.set(p[0], 1.55, p[1]);
            this.group.add(pole);
        });

        const winFrame = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.8, 0.05), metalMat);
        winFrame.position.set(0, 1.4, 1.2); 
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.6), glassMat);
        glass.position.z = 0.03; winFrame.add(glass);
        this.group.add(winFrame);

        const undercarriage = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.15, 3.2), metalMat);
        undercarriage.position.y = 0.25; this.group.add(undercarriage);

        this.wheels = []; this.frontWheelHubs = [];
        const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 24);
        const rimGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.26, 12);
        const wPos = [{x:-0.95, z:1.3, f:true}, {x:0.95, z:1.3, f:true}, {x:-0.95, z:-1.3, f:false}, {x:0.95, z:-1.3, f:false}];

        wPos.forEach(p => {
            const wg = new THREE.Group();
            const tire = new THREE.Mesh(wheelGeo, tireMat); tire.rotation.z = Math.PI/2;
            const rim = new THREE.Mesh(rimGeo, rimMat); rim.rotation.z = Math.PI/2;
            wg.add(tire, rim);
            if(p.f) {
                const hub = new THREE.Group(); hub.position.set(p.x, 0.35, p.z);
                hub.add(wg); this.group.add(hub); this.frontWheelHubs.push(hub);
            } else { wg.position.set(p.x, 0.35, p.z); this.group.add(wg); }
            this.wheels.push(wg);
        });

        this.steeringColumn = new THREE.Group();
        this.steeringColumn.position.set(-0.5, 1.6, 0.7); 
        this.steeringColumn.rotation.x = Math.PI / 12; 
        const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4), metalMat);
        stand.position.set(0, -0.6, 0.2); stand.rotation.x = -Math.PI / 8;
        this.steeringColumn.add(stand);

        this.wheelShaft = new THREE.Group();
        const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.025, 12, 40), seatMat);
        this.wheelShaft.add(wheel);

        const createHand = (isLeft) => {
            const h = new THREE.Group(); const skin = new THREE.MeshStandardMaterial({ color: 0xdbac98 });
            const palm = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), skin); palm.scale.set(1, 0.4, 1.2); h.add(palm);
            const joints = []; [-0.04, 0, 0.04].forEach(x => {
                const root = new THREE.Group(); root.position.set(isLeft ? x : -x, 0, 0.05);
                const seg = new THREE.Mesh(new THREE.CapsuleGeometry(0.015, 0.05), skin); seg.rotation.x = 1.1;
                const jnt = new THREE.Group(); jnt.add(seg); root.add(jnt); h.add(root); joints.push(jnt);
            }); return { h, joints };
        };
        const L = createHand(true); const R = createHand(false);
        L.h.position.set(-0.2, 0, 0.05); R.h.position.set(0.2, 0, 0.05);
        this.handJoints = [...L.joints, ...R.joints];
        this.wheelShaft.add(L.h, R.h); this.steeringColumn.add(this.wheelShaft); this.group.add(this.steeringColumn);

        this.group.position.set(15, 0, 15); scene.add(this.group);
        this.speed = 0; this.steerAngle = 0;
    }
    update(move, delta) {
        if (move.w) this.speed = THREE.MathUtils.lerp(this.speed, 1.0, 0.04);
        else if (move.s) this.speed = THREE.MathUtils.lerp(this.speed, -0.4, 0.04);
        else this.speed *= 0.96;
        const targetSteer = move.a ? 0.8 : (move.d ? -0.8 : 0);
        this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, targetSteer, 0.1);
        this.group.rotation.y += this.steerAngle * this.speed * 2 * delta;
        this.group.translateZ(this.speed * 20 * delta);
        this.wheels.forEach(w => w.rotation.x += this.speed * 50 * delta);
        this.frontWheelHubs.forEach(hub => hub.rotation.y = this.steerAngle * 0.6);
        this.wheelShaft.rotation.z = this.steerAngle * 2.5;
        this.handJoints.forEach(j => j.rotation.x = THREE.MathUtils.lerp(j.rotation.x, move.w ? 1.4 : 1.1, 0.1));
    }
}
const cart = new GolfCart();

// --- ENEMY CLASS ---
class Enemy {
    constructor(position) {
        this.group = new THREE.Group();
        const rotVal = Math.random();
        const skinCol = new THREE.Color().setHSL(0.25, 0.3, 0.2 + rotVal * 0.2);
        const clothCol = new THREE.Color().setHSL(Math.random(), 0.1, 0.15);
        const skinMat = new THREE.MeshStandardMaterial({ color: skinCol, transparent: true });
        const clothMat = new THREE.MeshStandardMaterial({ color: clothCol, transparent: true });
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffee });
        this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.45), clothMat);
        this.torso.position.y = 1.75;
        this.head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), skinMat);
        this.head.position.y = 2.55;
        const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.2), skinMat); jaw.position.set(0, -0.15, 0.1);
        const lEye = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.1), eyeMat); lEye.position.set(-0.12, 0.05, 0.2);
        const rEye = lEye.clone(); rEye.position.set(0.12, 0.05, 0.2);
        this.head.add(jaw, lEye, rEye);
        this.lArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 0.2), skinMat); 
        this.lArm.position.set(-0.45, 2.1, 0.3); this.lArm.rotation.x = -1.2;
        this.rArm = this.lArm.clone(); this.rArm.position.set(0.45, 2.1, 0.3);
        this.lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.2, 0.25), clothMat);
        this.lLeg.position.set(-0.22, 0.6, 0);
        this.rLeg = this.lLeg.clone(); this.rLeg.position.set(0.22, 0.6, 0);
        this.group.add(this.torso, this.head, this.lArm, this.rArm, this.lLeg, this.rLeg);
        this.group.position.copy(position);
        this.group.scale.setScalar(0.9 + Math.random() * 0.3);
        scene.add(this.group);
        this.isDead = false; this.deathTime = 0; this.speed = 3.5 + Math.random() * 2;
        this.animOff = Math.random() * 6.28; this.physicsVel = new THREE.Vector3(); this.rotVel = new THREE.Vector3();
        this.attackCooldown = 0;
    }
    die(hitDirection, power) {
        if (this.isDead) return;
        this.isDead = true; killCount++; killCounterEl.innerText = "KILLS: " + killCount;
        this.physicsVel.copy(hitDirection).multiplyScalar(power);
        this.rotVel.set(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).multiplyScalar(15);
        this.group.traverse(c => { if (c.material) { c.material.color.setHex(0x440000); } });
    }
    update(delta, playerPos) {
        if (!this.isDead) {
            const dist = this.group.position.distanceTo(playerPos);
            const dir = new THREE.Vector3().subVectors(playerPos, this.group.position);
            dir.y = 0; dir.normalize();
            if (dist > 3.5) { this.group.position.addScaledVector(dir, this.speed * delta); } 
            else { this.attackCooldown -= delta; if(this.attackCooldown <= 0) { damagePlayer(10); this.attackCooldown = 1.0; } }
            this.group.lookAt(playerPos.x, 0, playerPos.z);
            const t = (performance.now() * 0.005) + this.animOff;
            this.lLeg.rotation.x = Math.sin(t) * 0.4; this.rLeg.rotation.x = Math.cos(t) * 0.4;
            this.group.position.y = Math.abs(Math.sin(t * 2)) * 0.1;
        } else {
            this.group.position.addScaledVector(this.physicsVel, delta);
            this.group.rotation.x += this.rotVel.x * delta;
            this.physicsVel.multiplyScalar(0.96);
            if (this.group.position.y > 0.6) this.physicsVel.y -= 15 * delta;
            else { this.group.position.y = 0.6; this.physicsVel.y *= -0.2; }
            this.deathTime += delta;
            if (this.deathTime > 1.5) { this.group.scale.multiplyScalar(0.95); if (this.group.scale.x <= 0.05) { scene.remove(this.group); return true; } }
        }
        return false;
    }
}
const enemies = [];
function spawnEnemies(count) { for(let i=0; i<count; i++) enemies.push(new Enemy(new THREE.Vector3((Math.random()-0.5)*200, 0, (Math.random()-0.5)*200-100))); }
spawnEnemies(15);

// --- WEAPONS ---
const viewmodel = new THREE.Group();
const gunMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.2 });
const rifle = new THREE.Group(); rifle.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.8), gunMat));
const shotgun = new THREE.Group(); shotgun.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.6), gunMat)); shotgun.visible = false;
const sniper = new THREE.Group(); sniper.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 0.7), gunMat)); sniper.visible = false;
const smg = new THREE.Group(); smg.add(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.25, 0.5), gunMat)); smg.visible = false;
const pistol = new THREE.Group(); pistol.add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.3), gunMat)); pistol.visible = false;
viewmodel.add(rifle, shotgun, sniper, smg, pistol); viewmodel.position.set(0.5, -0.45, -0.8);
camera.add(viewmodel); scene.add(camera);

const bullets = [];
function fireWeapon() {
    let count = 1, spread = 0, curRecoil = 0.2;
    if (shotgun.visible) { count = 8; spread = 0.1; }
    if (smg.visible) { spread = 0.05; curRecoil = 0.08; }
    recoil = curRecoil;
    for(let i=0; i<count; i++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.06), new THREE.MeshBasicMaterial({ color: 0xffffaa }));
        viewmodel.getWorldPosition(b.position);
        const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
        dir.x += (Math.random()-0.5)*spread; dir.y += (Math.random()-0.5)*spread; dir.normalize();
        scene.add(b); bullets.push({ mesh: b, dir: dir, time: 0 });
    }
}

// --- CONTROLS HOOKS ---
const controls = new PointerLockControls(camera, document.body);
document.getElementById('start-btn').onclick = () => controls.lock();
document.getElementById('open-weapons').onclick = () => { menus.main.style.display='none'; menus.wpn.style.display='flex'; };
document.getElementById('back-from-weapons').onclick = () => { menus.wpn.style.display='none'; menus.main.style.display='flex'; };

const hideAll = () => [rifle, shotgun, sniper, smg, pistol].forEach(g => g.visible = false);
document.getElementById('select-rifle').onclick = () => { hideAll(); rifle.visible=true; menus.wpn.style.display='none'; controls.lock(); };
document.getElementById('select-shotgun').onclick = () => { hideAll(); shotgun.visible=true; menus.wpn.style.display='none'; controls.lock(); };
document.getElementById('select-sniper').onclick = () => { hideAll(); sniper.visible=true; menus.wpn.style.display='none'; controls.lock(); };
document.getElementById('select-smg').onclick = () => { hideAll(); smg.visible=true; menus.wpn.style.display='none'; controls.lock(); };
document.getElementById('select-pistol').onclick = () => { hideAll(); pistol.visible=true; menus.wpn.style.display='none'; controls.lock(); };

controls.addEventListener('lock', () => Object.values(menus).forEach(m => m.style.display = 'none'));
controls.addEventListener('unlock', () => menus.main.style.display = 'flex');

let move = { w: false, s: false, a: false, d: false };
let velocity = new THREE.Vector3(), recoil = 0, isDriving = false, spawnTimer = 0;

window.onmousedown = () => { if (controls.isLocked && !isDriving) fireWeapon(); };
document.addEventListener('keydown', (e) => { 
    const k = e.key.toLowerCase(); if (move.hasOwnProperty(k)) move[k] = true;
    if (k === 'e' && controls.isLocked && camera.position.distanceTo(cart.group.position) < 6) { isDriving = !isDriving; viewmodel.visible = !isDriving; }
});
document.addEventListener('keyup', (e) => { if (move.hasOwnProperty(e.key.toLowerCase())) move[e.key.toLowerCase()] = false; });

// --- MAIN LOOP ---
let lastTime = performance.now();
function animate() {
    requestAnimationFrame(animate);
    updateFPS();
    
    const time = performance.now();
    const delta = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;

    if (controls.isLocked) {
        spawnTimer += delta; if (spawnTimer >= 20) { spawnEnemies(10); spawnTimer = 0; }
        if (isDriving) {
            cart.update(move, delta);
            const offset = new THREE.Vector3(-0.5, 2.2, 0.2).applyQuaternion(cart.group.quaternion);
            camera.position.copy(cart.group.position).add(offset);
            camera.lookAt(cart.group.position.clone().add(new THREE.Vector3(0, 1.5, 10).applyQuaternion(cart.group.quaternion)));
            enemies.forEach(en => { if (!en.isDead && cart.group.position.distanceTo(en.group.position) < 3.5) en.die(new THREE.Vector3().subVectors(en.group.position, cart.group.position).normalize(), Math.abs(cart.speed) * 45); });
        } else {
            velocity.x -= velocity.x * 10 * delta; velocity.z -= velocity.z * 10 * delta;
            if (move.w) velocity.z -= 400 * delta; if (move.s) velocity.z += 400 * delta;
            if (move.a) velocity.x -= 400 * delta; if (move.d) velocity.x += 400 * delta;
            controls.moveRight(velocity.x * delta); controls.moveForward(-velocity.z * delta);
            camera.position.y = 3.5;
        }
        for(let i=particles.length-1; i>=0; i--) {
            particles[i].mesh.position.addScaledVector(particles[i].vel, delta);
            particles[i].vel.y -= 10 * delta; particles[i].life -= delta;
            if(particles[i].life <= 0) { scene.remove(particles[i].mesh); particles.splice(i,1); }
        }
        for (let i = enemies.length - 1; i >= 0; i--) {
            const gone = enemies[i].update(delta, camera.position);
            if (gone) enemies.splice(i, 1);
            else if (!enemies[i].isDead) {
                bullets.forEach((bu, bi) => {
                    if (bu.mesh.position.distanceTo(enemies[i].group.position.clone().add(new THREE.Vector3(0, 1.8, 0))) < 1.5) { spawnBlood(bu.mesh.position); enemies[i].die(bu.dir, 10); scene.remove(bu.mesh); bullets.splice(bi, 1); }
                });
            }
        }
        bullets.forEach((b, i) => { b.mesh.position.addScaledVector(b.dir, 200 * delta); if ((b.time += delta) > 2) { scene.remove(b.mesh); bullets.splice(i, 1); } });
        
        // --- SETTINGS INTEGRATION ---
        renderer.autoClearColor = (blurToggle.value !== "ON");

        recoil = THREE.MathUtils.lerp(recoil, 0, 0.1);
        viewmodel.position.z = -0.8 + recoil;
    }
    renderer.render(scene, camera);
}
animate();
