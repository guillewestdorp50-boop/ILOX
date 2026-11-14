import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

const game = document.querySelector("#game");
const loading = document.querySelector("#loading");
const welcome = document.querySelector("#welcome");
const startButton = document.querySelector("#start");
const hint = document.querySelector("#hint");
const toast = document.querySelector("#toast");
const joystick = document.querySelector("#joystick");
const stick = document.querySelector("#stick");

let scene, camera, renderer, player, clock;
let started = false;
let yaw = 0, pitch = 0.18;
let moveX = 0, moveZ = 0;
let joyPointer = null;
let lookPointer = null;
let lastLookX = 0, lastLookY = 0;
const keys = new Set();
const worldSize = 220;

function terrainHeight(x, z) {
  const rolling = Math.sin(x * 0.035) * 2.3 + Math.cos(z * 0.029) * 2.1
    + Math.sin((x + z) * 0.021) * 1.7 + Math.cos((x - z) * 0.047) * 0.65;
  const hillA = 7 * Math.exp(-((x - 48) ** 2 + (z + 45) ** 2) / 1100);
  const hillB = 5.5 * Math.exp(-((x + 62) ** 2 + (z - 35) ** 2) / 1500);
  const hillC = 4 * Math.exp(-((x - 8) ** 2 + (z - 82) ** 2) / 900);
  return rolling + hillA + hillB + hillC;
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function makeTerrain() {
  const segments = 130;
  const positions = [];
  const colors = [];
  const indices = [];
  const color = new THREE.Color();
  for (let iz = 0; iz <= segments; iz++) {
    for (let ix = 0; ix <= segments; ix++) {
      const x = (ix / segments - 0.5) * worldSize;
      const z = (iz / segments - 0.5) * worldSize;
      const y = terrainHeight(x, z);
      positions.push(x, y, z);
      const shade = THREE.MathUtils.clamp((y + 5) / 15, 0, 1);
      color.setRGB(0.20 + shade * 0.08, 0.34 + shade * 0.09, 0.20 + shade * 0.035);
      colors.push(color.r, color.g, color.b);
      if (ix < segments && iz < segments) {
        const a = iz * (segments + 1) + ix;
        const b = a + segments + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function makeTree(x, z, scale, random) {
  const y = terrainHeight(x, z);
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.scale.setScalar(scale);
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.28, 2.4, 6),
    new THREE.MeshStandardMaterial({ color: 0x72513a, roughness: 1 })
  );
  trunk.position.y = 1.15;
  group.add(trunk);
  const greens = [0x315b3d, 0x3e7046, 0x527b4b, 0x294f3a];
  for (let i = 0; i < 3; i++) {
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(1.15 - i * 0.13, 2.5 - i * 0.22, 7),
      new THREE.MeshStandardMaterial({ color: greens[Math.floor(random() * greens.length)], roughness: 1 })
    );
    crown.position.y = 2.25 + i * 0.82;
    crown.position.x = (random() - 0.5) * 0.16;
    group.add(crown);
  }
  scene.add(group);
}

function makeRock(x, z, scale, random) {
  const y = terrainHeight(x, z);
  const mesh = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.8 + random() * 0.5, 0),
    new THREE.MeshStandardMaterial({ color: random() > 0.5 ? 0x777d76 : 0x8a887d, roughness: 1 })
  );
  mesh.position.set(x, y + 0.25 * scale, z);
  mesh.scale.set(scale * 1.3, scale * 0.75, scale);
  mesh.rotation.set(random(), random() * Math.PI, random());
  mesh.castShadow = true;
  scene.add(mesh);
}

function makeRiver() {
  const positions = [];
  const indices = [];
  const steps = 90;
  for (let i = 0; i <= steps; i++) {
    const z = -worldSize / 2 + (i / steps) * worldSize;
    const x = Math.sin(z * 0.025) * 17 + Math.sin(z * 0.061) * 5 - 15;
    const width = 2.6 + Math.sin(i * 0.16) * 0.55;
    const y = terrainHeight(x, z) + 0.18;
    positions.push(x - width, y, z, x + width, y, z);
    if (i < steps) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const river = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color: 0x5d9f9c, roughness: 0.28, metalness: 0.05, transparent: true, opacity: 0.9,
    side: THREE.DoubleSide
  }));
  scene.add(river);
}

function makePlayer() {
  const group = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x171a1d, roughness: 0.92 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x303b3b, roughness: 1 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd99b72, roughness: 1 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x38271f, roughness: 1 });
  const shoes = new THREE.MeshStandardMaterial({ color: 0x202326, roughness: 1 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.95, 0.48), dark);
  torso.position.y = 1.42;
  group.add(torso);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), dark);
  hood.position.set(0, 1.9, -0.03);
  hood.scale.set(1, 1.05, 0.85);
  group.add(hood);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 16, 12), skin);
  head.position.set(0, 2.05, 0.09);
  group.add(head);
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.56), hair);
  hairCap.position.set(0, 2.17, 0.06);
  group.add(hairCap);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.72, 0.34), pants);
    leg.position.set(side * 0.2, 0.62, 0);
    group.add(leg);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.16, 0.48), shoes);
    shoe.position.set(side * 0.2, 0.17, 0.07);
    group.add(shoe);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.25), dark);
    arm.position.set(side * 0.53, 1.42, 0.02);
    arm.rotation.z = side * -0.08;
    group.add(arm);
  }
  const logo = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.13, 0.018), new THREE.MeshStandardMaterial({ color: 0xe7d29a, emissive: 0x4a3514, emissiveIntensity: 0.15 }));
  logo.position.set(0, 1.5, -0.251);
  group.add(logo);
  group.position.set(0, terrainHeight(0, 0), 0);
  scene.add(group);
  return group;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9bb8ae);
  scene.fog = new THREE.Fog(0x9bb8ae, 65, 190);
  camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 280);
  renderer = new THREE.WebGLRenderer({ antialias: innerWidth > 700, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  game.insertBefore(renderer.domElement, game.firstChild);
  scene.add(new THREE.HemisphereLight(0xe7f1e9, 0x52604a, 2.0));
  const sun = new THREE.DirectionalLight(0xffedce, 2.1);
  sun.position.set(-35, 65, 28);
  scene.add(sun);
  makeTerrain();
  makeRiver();
  const random = seededRandom(20261114);
  for (let i = 0; i < 230; i++) {
    const x = (random() - 0.5) * 190;
    const z = (random() - 0.5) * 190;
    if (Math.hypot(x, z) < 9) continue;
    if (Math.abs(x - (Math.sin(z * 0.025) * 17 - 15)) < 5) continue;
    makeTree(x, z, 0.72 + random() * 0.65, random);
  }
  for (let i = 0; i < 95; i++) {
    const x = (random() - 0.5) * 195;
    const z = (random() - 0.5) * 195;
    if (Math.hypot(x, z) < 6) continue;
    makeRock(x, z, 0.35 + random() * 1.1, random);
  }
  player = makePlayer();
  clock = new THREE.Clock();
  camera.position.set(0, player.position.y + 4.1, 8.5);
  camera.lookAt(player.position.x, player.position.y + 1.2, player.position.z);
  addEvents();
  animate();
  requestAnimationFrame(() => loading.classList.add("done"));
}

function addEvents() {
  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  });
  addEventListener("keydown", e => {
    keys.add(e.key.toLowerCase());
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(e.key.toLowerCase())) e.preventDefault();
  });
  addEventListener("keyup", e => keys.delete(e.key.toLowerCase()));
  game.addEventListener("pointerdown", e => {
    if (e.target.closest("button") || e.target.closest("#joystick")) return;
    lookPointer = e.pointerId;
    lastLookX = e.clientX;
    lastLookY = e.clientY;
    if (game.setPointerCapture) game.setPointerCapture(e.pointerId);
  });
  game.addEventListener("pointermove", e => {
    if (lookPointer !== e.pointerId || !started) return;
    const dx = e.clientX - lastLookX;
    const dy = e.clientY - lastLookY;
    lastLookX = e.clientX;
    lastLookY = e.clientY;
    yaw -= dx * 0.004;
    pitch = THREE.MathUtils.clamp(pitch + dy * 0.002, -0.05, 0.62);
  });
  game.addEventListener("pointerup", e => { if (lookPointer === e.pointerId) lookPointer = null; });
  game.addEventListener("pointercancel", e => { if (lookPointer === e.pointerId) lookPointer = null; });
  joystick.addEventListener("pointerdown", e => {
    joyPointer = e.pointerId;
    joystick.setPointerCapture(e.pointerId);
    updateJoystick(e);
  });
  joystick.addEventListener("pointermove", e => { if (joyPointer === e.pointerId) updateJoystick(e); });
  const releaseJoy = e => {
    if (joyPointer !== e.pointerId) return;
    joyPointer = null; moveX = 0; moveZ = 0;
    stick.style.transform = "translate(0,0)";
  };
  joystick.addEventListener("pointerup", releaseJoy);
  joystick.addEventListener("pointercancel", releaseJoy);
  startButton.addEventListener("click", () => {
    started = true;
    welcome.classList.add("hidden");
    hint.textContent = "Encontrá tu propio camino";
    showToast("¡Bienvenido a ILOX!");
  });
  document.querySelector("#fullscreen").addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) await game.requestFullscreen();
      else await document.exitFullscreen();
    } catch { showToast("La pantalla completa no está disponible en este navegador."); }
  });
}

function updateJoystick(e) {
  const rect = joystick.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let dx = e.clientX - cx;
  let dy = e.clientY - cy;
  const max = 35;
  const length = Math.hypot(dx, dy);
  if (length > max) { dx = dx / length * max; dy = dy / length * max; }
  stick.style.transform = `translate(${dx}px,${dy}px)`;
  moveX = dx / max;
  moveZ = dy / max;
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  if (started) {
    let forward = moveZ;
    let strafe = moveX;
    if (keys.has("w") || keys.has("arrowup")) forward -= 1;
    if (keys.has("s") || keys.has("arrowdown")) forward += 1;
    if (keys.has("a") || keys.has("arrowleft")) strafe -= 1;
    if (keys.has("d") || keys.has("arrowright")) strafe += 1;
    const length = Math.hypot(forward, strafe);
    if (length > 1) { forward /= length; strafe /= length; }
    const speed = 7.2;
    const dx = (Math.sin(yaw) * forward + Math.cos(yaw) * strafe) * speed * delta;
    const dz = (-Math.cos(yaw) * forward + Math.sin(yaw) * strafe) * speed * delta;
    player.position.x = THREE.MathUtils.clamp(player.position.x + dx, -worldSize / 2 + 4, worldSize / 2 - 4);
    player.position.z = THREE.MathUtils.clamp(player.position.z + dz, -worldSize / 2 + 4, worldSize / 2 - 4);
    player.position.y = terrainHeight(player.position.x, player.position.z);
    if (length > 0.08) player.rotation.y = Math.atan2(dx, dz);
  }
  const distance = 8.5;
  const targetX = player.position.x + Math.sin(yaw) * distance;
  const targetZ = player.position.z + Math.cos(yaw) * distance;
  const targetY = player.position.y + 3.2 + pitch * 5;
  camera.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), 1 - Math.pow(0.001, delta));
  camera.lookAt(player.position.x, player.position.y + 1.35, player.position.z);
  renderer.render(scene, camera);
}

try {
  init();
} catch (error) {
  console.error(error);
  loading.innerHTML = '<div class="loading-mark">ILOX</div><p>No se pudo iniciar el mundo 3D. Revisá la conexión y volvé a intentar.</p>';
}
