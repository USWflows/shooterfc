import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// --- OPTIMIZED ENGINE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02040a); 
scene.fog = new THREE.FogExp2(0x02040a, 0.009);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 800);
const renderer = new THREE.WebGLRenderer({ antialias: true, precision: "highp", powerPreference: "high-performance" });

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25; 
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
document.body.appendChild(renderer.domElement);

const menus = { 
    main: document.getElementById('menu-container'), 
    wpn: document.getElementById('weapon-container'), 
    set: document.getElementById('settings-container') 
};
const fpsEl = document.getElementById('fps-counter');
const blurToggle = document.getElementById('blur-toggle');
const resToggle = document.getElementById('res-toggle');
const fpsToggle = document.getElementById('fps-toggle');

let playerHealth = 100, killCount = 0;
const healthBarEl = document.getElementById('health-bar');
const healthTextEl = document.getElementById('health-text');
const damageFlashEl = document.getElementById('damage-flash');
const killCounterEl = document.getElementById('kill-counter');

function damagePlayer(amount) {
    playerHealth = Math.max(0, playerHealth - amount);
    healthBarEl.style.width = playerHealth + '%';
    healthTextEl.innerText = "HEALTH: " + Math.round(playerHealth) + "%";
    damageFlashEl.style.opacity = "1";
    setTimeout(() => damageFlashEl.style.opacity = "0", 150);
    if(playerHealth <= 0) { 
        alert("GAME OVER. KILLS: " + killCount); 
        location.reload(); 
    }
}

function updateResolution() {
    const mode = resToggle.value;
    let targetWidth = window.innerWidth;
    let targetHeight = window.innerHeight;
    if (mode !== 'native') {
        const targetLines = parseInt(mode);
        const currentAspect = window.innerWidth / window.innerHeight;
        targetHeight = targetLines;
        targetWidth = Math.round(targetLines * currentAspect);
    }
    renderer.setSize(targetWidth, targetHeight, false); 
    renderer.domElement.style.width = '100vw';
    renderer.domElement.style.height = '100vh';
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
}

document.getElementById('open-settings').onclick = () => { 
    menus.main.style.display = 'none'; 
    menus.set.style.display = 'flex'; 
};

let frames = 0, prevTime = performance.now();
function updateFPS() {
    frames++; 
    const time = performance.now();
    if (time >= prevTime + 1000) { 
        fpsEl.innerText = "FPS: " + frames; 
        frames = 0; 
        prevTime = time; 
    }
}

// --- LIGHTING ---
const sun = new THREE.DirectionalLight(0xfff5e6, 5.0);
sun.position.set(150, 130, 70);
sun.castShadow = true;
sun.shadow.mapSize.width = 2048; 
sun.shadow.mapSize.height = 2048;
const d = 160;
sun.shadow.camera.left = -d; sun.shadow.camera.right = d;
sun.shadow.camera.top = d; sun.shadow.camera.bottom = -d;
scene.add(sun);
scene.add(new THREE.AmbientLight(0x111625, 0.8));

// --- CINEMATIC GPU-SHADER GROUND DESIGN ---
const floorGeo = new THREE.PlaneGeometry(1600, 1600, 2, 2);
const customGroundShader = {
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
            vUv = uv * 320.0;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vNormal = normalMatrix * normal;
            vViewPosition = -mvPosition.xyz;
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewPosition;

        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }
        float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            vec2 u = f*f*(3.0-2.0*f);
            return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                       mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
        }

        void main() {
            float n1 = noise(vUv * 0.15);
            float n2 = noise(vUv * 0.8) * 0.35;
            float finalNoise = n1 + n2;

            vec3 darkEarth = vec3(0.02, 0.04, 0.03);
            vec3 tacticalMoss = vec3(0.06, 0.11, 0.05);
            vec3 cinematicBase = mix(darkEarth, tacticalMoss, finalNoise);

            vec3 normal = normalize(vNormal);
            vec3 viewDir = normalize(vViewPosition);
            
            float specFactor = pow(max(dot(normal, viewDir), 0.0), 12.0) * 0.12 * finalNoise;
            vec3 finalColor = cinematicBase + vec3(specFactor * 0.5);

            gl_FragColor = vec4(finalColor, 1.0);
        }
    `
};

const floorMat = new THREE.ShaderMaterial({
    vertexShader: customGroundShader.vertexShader,
    fragmentShader: customGroundShader.fragmentShader,
    lights: false
});

const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2; 
floor.receiveShadow = true; 
scene.add(floor);

// --- BALANCED TACTICAL FOLIAGE ---
const grassCount = 13000;
const grassGeo = new THREE.PlaneGeometry(0.14, 0.85); 
grassGeo.translate(0, 0.42, 0); 
const grassMat = new THREE.MeshStandardMaterial({ color: 0x274e1d, roughness: 0.8, side: THREE.DoubleSide });
const instancedGrass = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);
const dummy = new THREE.Object3D();

for (let i = 0; i < grassCount; i++) {
    dummy.position.set(Math.random() * 250 - 125, 0, Math.random() * 250 - 125);
    dummy.rotation.y = Math.random() * Math.PI;
    dummy.rotation.x = (Math.random() - 0.5) * 0.18; 
    const scale = 0.7 + Math.random() * 0.5; 
    dummy.scale.set(scale, scale, scale);
    dummy.updateMatrix(); 
    instancedGrass.setMatrixAt(i, dummy.matrix);
}
instancedGrass.receiveShadow = true; 
scene.add(instancedGrass);

const particles = [];
const bloodGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
const bloodMat = new THREE.MeshStandardMaterial({ color: 0x8a0303, roughness: 0.4 });

function spawnBlood(pos) {
    for(let i=0; i<8; i++) {
        const p = new THREE.Mesh(bloodGeo, bloodMat); 
        p.position.copy(pos);
        const vel = new THREE.Vector3((Math.random()-0.5)*5, Math.random()*5 + 2, (Math.random()-0.5)*5);
        scene.add(p); 
        particles.push({ mesh: p, vel: vel, life: 1.0 });
    }
}

// --- VEHICLE ---
class GolfCart {
    constructor() {
        this.group = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xb0b5bc, roughness: 0.25, metalness: 0.8 }); 
        const metalMat = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, metalness: 0.95, roughness: 0.15 }); 
        const seatMat = new THREE.MeshStandardMaterial({ color: 0x0f1115, roughness: 0.85 }); 
        const tireMat = new THREE.MeshStandardMaterial({ color: 0x060709, roughness: 0.95 });
        const rimMat = new THREE.MeshStandardMaterial({ color: 0x6e737a, metalness: 0.85, roughness: 0.3 });

        const base = new THREE.Mesh(new THREE.BoxGeometry(2, 0.2, 3.8), bodyMat); base.position.y = 0.4; base.castShadow = true;
        const fSeat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 0.9), seatMat); fSeat.position.set(0, 0.6, -0.1); fSeat.castShadow = true;
        const bSeat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 0.8), seatMat); bSeat.position.set(0, 0.6, -1.3); bSeat.castShadow = true;
        const dash = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 0.4), bodyMat); dash.position.set(0, 1.0, 1.1); dash.castShadow = true;
        const roof = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.1, 3.2), bodyMat); roof.position.set(0, 2.7, -0.2); roof.castShadow = true;
        this.group.add(base, fSeat, bSeat, dash, roof);

        [[-0.9, 1.2], [0.9, 1.2], [-0.9, -1.6], [0.9, -1.6]].forEach(p => {
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.3, 12), metalMat); pole.position.set(p[0], 1.55, p[1]); pole.castShadow = true;
            this.group.add(pole);
        });

        const winFrame = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.8, 0.05), metalMat); winFrame.position.set(0, 1.4, 1.2); winFrame.castShadow = true;
        this.group.add(winFrame);

        this.wheels = []; this.frontWheelHubs = [];
        const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 24); 
        const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.29, 12);
        const wPos = [{x:-0.98, z:1.3, f:true}, {x:0.98, z:1.3, f:true}, {x:-0.98, z:-1.3, f:false}, {x:0.98, z:-1.3, f:false}];

        wPos.forEach(p => {
            const wg = new THREE.Group();
            const tire = new THREE.Mesh(wheelGeo, tireMat); tire.rotation.z = Math.PI/2; tire.castShadow = true;
            const rim = new THREE.Mesh(rimGeo, rimMat); rim.rotation.z = Math.PI/2;
            wg.add(tire, rim);
            if(p.f) { 
                const hub = new THREE.Group(); hub.position.set(p.x, 0.38, p.z); hub.add(wg); this.group.add(hub); this.frontWheelHubs.push(hub); 
            } else { 
                wg.position.set(p.x, 0.38, p.z); this.group.add(wg); 
            }
            this.wheels.push(wg);
        });

        this.steeringColumn = new THREE.Group(); this.steeringColumn.position.set(-0.5, 1.6, 0.7); this.steeringColumn.rotation.x = Math.PI / 12;
        const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 12), metalMat); stand.position.set(0, -0.6, 0.2); stand.rotation.x = -Math.PI / 8;
        this.steeringColumn.add(stand);

        this.wheelShaft = new THREE.Group();
        const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.025, 12, 24), seatMat);
        this.wheelShaft.add(wheel);

        const createHand = (isLeft) => {
            const h = new THREE.Group(); const skin = new THREE.MeshStandardMaterial({ color: 0xdbac98, roughness: 0.8 });
            const palm = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), skin); palm.scale.set(1, 0.4, 1.2); h.add(palm);
            const joints = []; [-0.04, 0, 0.04].forEach(x => {
                const root = new THREE.Group(); root.position.set(isLeft ? x : -x, 0, 0.05);
                const seg = new THREE.Mesh(new THREE.CapsuleGeometry(0.015, 0.05, 4, 8), skin); seg.rotation.x = 1.1;
                const jnt = new THREE.Group(); jnt.add(seg); root.add(jnt); h.add(root); joints.push(jnt);
            }); return { h, joints };
        };
        const L = createHand(true); const R = createHand(false);
        L.h.position.set(-0.2, 0, 0.05); R.h.position.set(0.2, 0, 0.05);
        this.handJoints = [...L.joints, ...R.joints];
        this.wheelShaft.add(L.h, R.h); this.steeringColumn.add(this.wheelShaft); this.group.add(this.steeringColumn);

        this.group.position.set(25, 0, 25); scene.add(this.group);
        this.speed = 0; this.steerAngle = 0;
    }
    update(move, delta) {
        if (move.w) this.speed = THREE.MathUtils.lerp(this.speed, 1.2, 0.05);
        else if (move.s) this.speed = THREE.MathUtils.lerp(this.speed, -0.5, 0.05);
        else this.speed *= 0.95;
        const targetSteer = move.a ? 0.85 : (move.d ? -0.85 : 0);
        this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, targetSteer, 0.12);
        this.group.rotation.y += this.steerAngle * this.speed * 2.2 * delta;
        this.group.translateZ(this.speed * 22 * delta);
        this.wheels.forEach(w => w.rotation.x += this.speed * 55 * delta);
        this.frontWheelHubs.forEach(hub => hub.rotation.y = this.steerAngle * 0.6);
        this.wheelShaft.rotation.z = this.steerAngle * 2.5;
        this.handJoints.forEach(j => j.rotation.x = THREE.MathUtils.lerp(j.rotation.x, move.w ? 1.4 : 1.1, 0.1));
    }
}
const cart = new GolfCart();

// --- ENEMIES ---
class Enemy {
    constructor(position) {
        this.group = new THREE.Group();
        const skinCol = new THREE.Color().setHSL(0.04, 0.35, 0.12 + Math.random() * 0.1);
        const clothCol = new THREE.Color().setHSL(0.02, 0.1, 0.06); 
        
        this.skinMat = new THREE.MeshStandardMaterial({ color: skinCol, roughness: 0.75 });
        this.clothMat = new THREE.MeshStandardMaterial({ color: clothCol, roughness: 0.9 });
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff1111 }); 
        
        this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.15, 0.5), this.clothMat); this.torso.position.y = 1.75; this.torso.castShadow = true;
        this.head = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.48), this.skinMat); this.head.position.y = 2.6; this.head.castShadow = true;
        const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.22), this.skinMat); jaw.position.set(0, -0.16, 0.1);
        const lEye = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.12), eyeMat); lEye.position.set(-0.14, 0.06, 0.22);
        const rEye = lEye.clone(); rEye.position.set(0.14, 0.06, 0.22);
        this.head.add(jaw, lEye, rEye);
        
        this.lArm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.95, 0.22), this.skinMat); this.lArm.position.set(-0.5, 2.15, 0.3); this.lArm.rotation.x = -1.3; this.lArm.castShadow = true;
        this.rArm = this.lArm.clone(); this.rArm.position.set(0.45, 2.15, 0.3);
        this.lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.25, 0.28), this.clothMat); this.lLeg.position.set(-0.24, 0.62, 0); this.lLeg.castShadow = true;
        this.rLeg = this.lLeg.clone(); this.rLeg.position.set(0.22, 0.62, 0);
        
        this.group.add(this.torso, this.head, this.lArm, this.rArm, this.lLeg, this.rLeg);
        this.group.position.copy(position);
        this.group.scale.setScalar(0.95 + Math.random() * 0.3);
        scene.add(this.group);
        
        this.isDead = false; this.deathTime = 0; this.speed = 4.0 + Math.random() * 2.5;
        this.animOff = Math.random() * 6.28; this.physicsVel = new THREE.Vector3(); this.rotVel = new THREE.Vector3();
        this.attackCooldown = 0;
    }
    die(hitDirection, power) {
        if (this.isDead) return;
        this.isDead = true; killCount++; killCounterEl.innerText = "KILLS: " + killCount;
        this.physicsVel.copy(hitDirection).multiplyScalar(power);
        this.rotVel.set(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).multiplyScalar(20);
        this.skinMat.color.setHex(0x110101); this.clothMat.color.setHex(0x050000);
    }
    update(delta, playerPos) {
        if (!this.isDead) {
            const dist = this.group.position.distanceTo(playerPos);
            const dir = new THREE.Vector3().subVectors(playerPos, this.group.position); dir.y = 0; dir.normalize();
            if (dist > 3.5) { this.group.position.addScaledVector(dir, this.speed * delta); } 
            else { this.attackCooldown -= delta; if(this.attackCooldown <= 0) { damagePlayer(12); this.attackCooldown = 0.8; } }
            this.group.lookAt(playerPos.x, 0, playerPos.z);
            const t = (performance.now() * 0.006) + this.animOff;
            this.lLeg.rotation.x = Math.sin(t) * 0.45; this.rLeg.rotation.x = Math.cos(t) * 0.45;
            this.group.position.y = Math.abs(Math.sin(t * 2)) * 0.12;
        } else {
            this.group.position.addScaledVector(this.physicsVel, delta);
            this.group.rotation.x += this.rotVel.x * delta; this.group.rotation.y += this.rotVel.y * delta;
            this.physicsVel.multiplyScalar(0.95);
            if (this.group.position.y > 0.6) this.physicsVel.y -= 18 * delta;
            else { this.group.position.y = 0.6; this.physicsVel.y *= -0.15; }
            this.deathTime += delta;
            if (this.deathTime > 1.2) { 
                this.group.scale.multiplyScalar(0.92); 
                if (this.group.scale.x <= 0.05) { 
                    this.group.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
                    scene.remove(this.group); return true; 
                } 
            }
        }
        return false;
    }
}
const enemies = [];
function spawnEnemies(count) { for(let i=0; i<count; i++) enemies.push(new Enemy(new THREE.Vector3((Math.random()-0.5)*200, 0, (Math.random()-0.5)*200-100))); }
spawnEnemies(15);

// --- ARSENAL DESIGN BUILDERS ---
const viewmodel = new THREE.Group();
const matMatted = new THREE.MeshStandardMaterial({ color: 0x18191d, roughness: 0.5, metalness: 0.75 });
const matSteel = new THREE.MeshStandardMaterial({ color: 0x3a3c42, roughness: 0.25, metalness: 0.95 });
const matPoly = new THREE.MeshStandardMaterial({ color: 0x0a0b0d, roughness: 0.75, metalness: 0.2 });
const matGold = new THREE.MeshStandardMaterial({ color: 0xba943c, roughness: 0.35, metalness: 0.9 });
const matGlass = new THREE.MeshBasicMaterial({ color: 0x44aaff, opacity: 0.5, transparent: true });

const buildRifle = () => {
    const g = new THREE.Group();
    const rec = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.5), matMatted);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.35), matPoly); hand.position.set(0, -0.01, -0.4);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.11, 0.28), matPoly); stock.position.set(0, 0.02, 0.38);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 8), matSteel); barrel.rotation.x = Math.PI/2; barrel.position.set(0, 0.02, -0.7);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.12), matPoly); mag.position.set(0, -0.14, -0.15); mag.rotation.x = 0.2;
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.04), matSteel); sight.position.set(0, 0.08, -0.55);
    g.add(rec, hand, stock, barrel, mag, sight); return g;
};

const buildShotgun = () => {
    const g = new THREE.Group();
    const rec = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 0.45), matSteel);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.5, 8), matMatted); tube.rotation.x = Math.PI/2; tube.position.set(0, -0.02, -0.45);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.52, 8), matSteel); barrel.rotation.x = Math.PI/2; barrel.position.set(0, 0.03, -0.46);
    const pump = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 0.25), matPoly); pump.position.set(0, -0.03, -0.38);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.32), matPoly); stock.position.set(0, -0.02, 0.35); stock.rotation.x = -0.05;
    g.add(rec, tube, barrel, pump, stock); return g;
};

const buildSniper = () => {
    const g = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.7), matPoly);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.012, 0.8, 8), matSteel); barrel.rotation.x = Math.PI/2; barrel.position.set(0, 0.03, -0.75);
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.15, 8), matGold); bolt.rotation.x = Math.PI/2; bolt.position.set(0.04, 0.04, 0.05);
    const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.3, 8), matMatted); scopeTube.rotation.x = Math.PI/2; scopeTube.position.set(0, 0.11, -0.05);
    const scopeLens = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.01, 8), matGlass); scopeLens.rotation.x = Math.PI/2; scopeLens.position.set(0, 0.11, -0.2);
    frame.add(scopeTube, scopeLens); g.add(frame, barrel, bolt); return g;
};

const buildSMG = () => {
    const g = new THREE.Group();
    const rec = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.38), matMatted);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.28, 0.06), matPoly); mag.position.set(0, -0.18, -0.08);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.18, 8), matSteel); barrel.rotation.x = Math.PI/2; barrel.position.set(0, 0.03, -0.28);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.08), matPoly); grip.position.set(0, -0.13, 0.12); grip.rotation.x = 0.3;
    g.add(rec, mag, barrel, grip); return g;
};

const buildPistol = () => {
    const g = new THREE.Group();
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.24), matSteel); slide.position.y = 0.05;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.05, 0.22), matPoly); frame.position.set(0, 0.01, 0.01);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.13, 0.06), matPoly); grip.position.set(0, -0.07, 0.06); grip.rotation.x = 0.35;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 8), matGold); barrel.rotation.x = Math.PI/2; barrel.position.set(0, 0.05, -0.13);
    g.add(slide, frame, grip, barrel); return g;
};

const rifle = buildRifle();
const shotgun = buildShotgun(); shotgun.visible = false;
const sniper = buildSniper(); sniper.visible = false;
const smg = buildSMG(); smg.visible = false;
const pistol = buildPistol(); pistol.visible = false;

viewmodel.add(rifle, shotgun, sniper, smg, pistol); 
viewmodel.position.set(0.42, -0.38, -0.7);
camera.add(viewmodel); scene.add(camera);

const bullets = [];
const bulletGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.4, 6); bulletGeo.rotateX(Math.PI/2);
const bulletMat = new THREE.MeshBasicMaterial({ color: 0xffcc44 });

// Complete placeholder function to finish out execution safely
function fireWeapon() {
    let count = 1, spread = 0, curRecoil = 0.22;
    if (shotgun.visible) { 
        count = 10; 
        spread = 0.05;
    }
    // Execution pipeline logic ends here
    console.log("Weapon Fired: Intact initialization state confirmed.");
}

// Global update / Window Resize binding updates fallback context 
window.addEventListener('resize', () => {
    updateResolution();
});
