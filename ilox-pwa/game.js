import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/utils/SkeletonUtils.js";

const game = document.querySelector("#game");
const loading = document.querySelector("#loading");
const welcome = document.querySelector("#welcome");
const avatarSelect = document.querySelector("#avatar-select");
const enterWorldButton = document.querySelector("#enter-world");
let selectedAvatar = "boy";
const startButton = document.querySelector("#start");
const hint = document.querySelector("#hint");
const toast = document.querySelector("#toast");
const movePad = document.querySelector("#move-pad");
const moveKnob = document.querySelector("#move-knob");
const cameraControls = document.querySelector("#camera-controls");
const cameraLockButton = document.querySelector("#camera-lock");
const cameraMenuToggle = document.querySelector("#camera-menu-toggle");
const cameraModePanel = document.querySelector("#camera-mode-panel");
const jumpButton = document.querySelector("#jump-button");
const menuToggle = document.querySelector("#menu-toggle");
const menuPanel = document.querySelector("#menu-panel");
const buildPanel = document.querySelector("#build-panel");
let moveStickPointer = null;
let playerVerticalVelocity = 0, playerGrounded = true;
let moveStick = { x: 0, y: 0 };

let scene, camera, renderer, player, clock, terrainMesh;
let buildMode = false, buildTool = "block", buildRotation = 0, firstPersonBuild = false, viewHands = null;
let selectedBlockColor = 0xff3030;
const buildRecords = [], buildGroups = [];
let started = false;
let yaw = 0, playerHeading = 0, pitch = 0.48;
let cameraMode = "third", cameraLocked = false;
// Nueva movilidad estilo Free Fire: joystick izquierdo y cámara libre independiente.


const polyHavenLoader = new GLTFLoader();
const avatarModelLoader = new GLTFLoader();
const animalModelLoader = new GLTFLoader();
const ANIMAL_MODELS = {sheep:"https://gobkit.com/freebies/animal005/Lamb.glb",cow:"https://gobkit.com/freebies/animal005/HolsteinCow.glb",horse:"https://gobkit.com/freebies/animal012/PalominoHorse.glb",chicken:"https://gobkit.com/freebies/animal009/BrahmaChicken.glb"};
const animalAssetPromises = new Map();
// Modelo humanoide GLB con malla skinned, texturas PBR y clips Idle/Walk/Run.
// Recurso de ejemplo oficial de Three.js (licencia MIT).
const RIGGED_AVATAR_URL = "https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Soldier.glb";
const HUMAN_AVATAR_MODELS = {
  man:["https://gobkit.com/freebies/human001/StoreManager.glb","https://gobkit.com/freebies/human002/ItEngineer.glb","https://gobkit.com/freebies/human015/OfficeWorker.glb"],
  woman:["https://gobkit.com/freebies/human001/OfficeLady.glb","https://gobkit.com/freebies/human002/Receptionist.glb","https://gobkit.com/freebies/human005/ChiefSurgeon.glb"],
  boy:["https://gobkit.com/freebies/human019/Schoolboy.glb","https://gobkit.com/freebies/human001/Schoolkid.glb"],
  girl:["https://gobkit.com/freebies/human019/Schoolgirl.glb"]
};
const HUMAN_MODEL_LOADER = new GLTFLoader();
let avatarLoadToken = 0;
const proceduralTreeGroups = [];
let importedNatureReady = false;
let lookPointer = null;
let lastLookX = 0, lastLookY = 0, lookStartX = 0, lookStartY = 0, cameraDistance = 6.8, pointerDragged = false;
const activePointers = new Map(); let pinchStartDistance = 0, pinchStartZoom = 10;
const keys = new Set();
const worldSize = 320;

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

function makeSky() {
  const geometry = new THREE.SphereGeometry(260, 32, 18);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: `varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }`,
    fragmentShader: `varying vec3 vWorldPosition;
      void main() {
        vec3 direction = normalize(vWorldPosition - cameraPosition);
        float height = max(direction.y, 0.0);
        vec3 horizon = vec3(0.72, 0.79, 0.75);
        vec3 zenith = vec3(0.20, 0.39, 0.49);
        vec3 sky = mix(horizon, zenith, pow(height, 0.62));
        vec3 sunDir = normalize(vec3(-0.48, 0.62, 0.34));
        float sunGlow = pow(max(dot(direction, sunDir), 0.0), 18.0);
        float sunCore = pow(max(dot(direction, sunDir), 0.0), 280.0);
        sky += vec3(0.22, 0.18, 0.10) * sunGlow + vec3(0.95, 0.78, 0.48) * sunCore;
        gl_FragColor = vec4(sky, 1.0);
      }`
  });
  const dome = new THREE.Mesh(geometry, material);
  dome.renderOrder = -10;
  scene.add(dome);
}
function makeTerrain() {
  const segments = 180, positions = [], uvs = [], indices = [];
  for (let iz = 0; iz <= segments; iz++) {
    for (let ix = 0; ix <= segments; ix++) {
      const x = (ix / segments - 0.5) * worldSize;
      const z = (iz / segments - 0.5) * worldSize;
      positions.push(x, terrainHeight(x, z), z);
      uvs.push(ix / segments * 12, iz / segments * 12);
      if (ix < segments && iz < segments) {
        const a = iz * (segments + 1) + ix, b = a + segments + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#526f3f"; ctx.fillRect(0, 0, 512, 512);
  let seed = 78123;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 24000; i++) {
    const v = Math.floor(65 + rand() * 100);
    ctx.fillStyle = rand() > .5 ? `rgba(${v},${v+25},${v-28},.20)` : `rgba(25,45,18,.16)`;
    const x = rand() * 512, y = rand() * 512, r = .4 + rand() * 2.1;
    ctx.fillRect(x, y, r, r);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  const material = new THREE.MeshStandardMaterial({ map: texture, color: 0xc4d2a2, roughness: 1 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true; scene.add(mesh); terrainMesh = mesh;
}

function makeTree(x, z, scale, random) {
  const y = terrainHeight(x, z), group = new THREE.Group();
  group.position.set(x, y, z); group.scale.setScalar(scale);
  const bark = new THREE.MeshStandardMaterial({ color: 0x59402c, roughness: 1 });
  const barkLight = new THREE.MeshStandardMaterial({ color: 0x76563a, roughness: 1 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.13, .34, 4.2, 9, 3), bark);
  trunk.position.y = 2.0; trunk.rotation.z = (random() - .5) * .12; group.add(trunk);
  // Ramas que salen del tronco con ángulos y longitudes diferentes.
  for (let i = 0; i < 5; i++) {
    const angle = random() * Math.PI * 2;
    const length = 1.15 + random() * .8;
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(.035, .105, length, 6), i % 2 ? bark : barkLight);
    branch.position.set(Math.cos(angle) * .48, 1.65 + i * .43, Math.sin(angle) * .48);
    branch.rotation.z = Math.cos(angle) * -.72;
    branch.rotation.x = Math.sin(angle) * .72;
    group.add(branch);
  }
  const palette = [0x294a31,0x355b38,0x426b3d,0x507344,0x3b6239,0x607c49];
  // Copas orgánicas superpuestas: silueta irregular, no conos repetidos.
  for (let i = 0; i < 11; i++) {
    const radius = .72 + random() * .72;
    const crown = new THREE.Mesh(
      new THREE.IcosahedronGeometry(radius, 2),
      new THREE.MeshStandardMaterial({ color: palette[Math.floor(random()*palette.length)], roughness: .96 })
    );
    const ring = i < 7 ? 1 : .52;
    const angle = random() * Math.PI * 2;
    crown.position.set(Math.cos(angle) * ring, 3.15 + random() * 2.0, Math.sin(angle) * ring);
    crown.scale.set(1.0 + random()*.34, .78 + random()*.42, .9 + random()*.32);
    group.add(crown);
  }
  scene.add(group);
}
async function fetchPolyHavenModel(assetId) {
  // El modelo se descarga durante la publicación y queda alojado junto al juego.
  // Así no dependemos de una API externa en cada inicio ni consumimos datos repetidamente.
  const base = `./assets/nature/${assetId}/`;
  const response = await fetch(base + "manifest.json", { cache: "no-store" });
  if (!response.ok) throw new Error("El paquete CC0 todavía no está publicado.");
  const manifest = await response.json();
  if (!manifest.available || !manifest.file) throw new Error("El paquete CC0 no está disponible.");
  return polyHavenLoader.loadAsync(base + manifest.file);
}

function placeImportedModel(source, x, z, scale, targetHeight) {
  const model = source.clone(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  bounds.getSize(size);
  const largest = Math.max(size.x, size.y, size.z) || 1;
  model.scale.setScalar(targetHeight / largest * scale);
  const scaledBounds = new THREE.Box3().setFromObject(model);
  model.position.set(x, terrainHeight(x, z) - scaledBounds.min.y, z);
  model.traverse(object => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    if (object.material) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if ("roughness" in material && material.roughness === undefined) material.roughness = 0.9;
        material.needsUpdate = true;
      }
    }
  });
  scene.add(model);
  return model;
}

async function loadFreeNatureAssets() {
  try {
    // Primer asset de producción: roca escaneada CC0, con límite de descarga para móviles.
    // Los árboles escaneados de alta calidad disponibles superan el presupuesto gráfico del G14;
    // mantenemos los árboles de respaldo hasta incorporar una variante realmente optimizada.
    const result = await fetchPolyHavenModel("boulder_01");
    const source = result.scene;
    const random = seededRandom(92017);
    for (let i = 0; i < 8; i++) {
      const x = (random() - 0.5) * 190;
      const z = (random() - 0.5) * 190;
      if (Math.hypot(x, z) < 12) continue;
      placeImportedModel(source, x, z, 0.45 + random() * 0.75, 1.2 + random() * 1.5);
    }
    importedNatureReady = true;
  } catch (error) {
    console.warn("ILOX: la roca CC0 no pudo cargarse; se conserva el escenario de respaldo.", error);
  }
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


async function loadRiggedAvatar(kind) {
  const [avatarType,variantText="0"]=String(kind).split(":");
  const variant=Number(variantText)||0;
  const avatarUrl=avatarType==="soldier"?RIGGED_AVATAR_URL:(HUMAN_AVATAR_MODELS[avatarType]?.[variant%HUMAN_AVATAR_MODELS[avatarType].length]);
  if (!avatarUrl) return;
  const token = ++avatarLoadToken;
  const previous = player;
  const previousPosition = previous ? previous.position.clone() : new THREE.Vector3(0, terrainHeight(0,0), 0);
  const previousHeading = previous ? previous.rotation.y : yaw;
  try {
    const gltf = avatarType==="soldier" ? await avatarModelLoader.loadAsync(avatarUrl) : await HUMAN_MODEL_LOADER.loadAsync(avatarUrl);
    if (token !== avatarLoadToken || !started) return;
    const model = gltf.scene;
    const bounds = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    bounds.getSize(size);
    const scale = 2.05 / Math.max(size.y, 0.001);
    model.scale.setScalar(scale);
    model.position.y = -bounds.min.y * scale;
    model.traverse(object => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if ("roughness" in material && material.roughness < 0.45) material.roughness = 0.62;
          material.needsUpdate = true;
        }
      }
    });
    const imported = new THREE.Group();
    imported.add(model);
    imported.position.copy(previousPosition);
    imported.rotation.y = previousHeading;
    imported.userData.avatarKind = avatarType;
    imported.userData.isRiggedAvatar = true;
    imported.userData.mixer = new THREE.AnimationMixer(model);
    imported.userData.actions = {};
    for (const clip of gltf.animations) {
      const name = clip.name.toLowerCase();
      if (name.includes("idle")) imported.userData.actions.idle = imported.userData.mixer.clipAction(clip);
      else if (name.includes("walk")) imported.userData.actions.walk = imported.userData.mixer.clipAction(clip);
      else if (name.includes("run")) imported.userData.actions.run = imported.userData.mixer.clipAction(clip);
    }
    const idle = imported.userData.actions.idle || gltf.animations[0] && imported.userData.mixer.clipAction(gltf.animations[0]);
    if (idle) { idle.play(); imported.userData.currentAction = idle; }
    scene.add(imported);
    if (previous) scene.remove(previous);
    player = imported;
    showToast("Personaje 3D con esqueleto y animaciones cargado");
  } catch (error) {
    console.warn("ILOX: no se pudo cargar el GLB humanoide; se mantiene el personaje de respaldo.", error);
    if (token === avatarLoadToken) showToast("No se pudo descargar el modelo 3D; seguimos con el personaje de respaldo");
  }
}

function setRiggedAvatarMotion(character, moving) {
  const actions = character?.userData?.actions;
  if (!actions) return;
  const next = moving ? (actions.run || actions.walk || actions.idle) : (actions.idle || actions.walk || actions.run);
  if (!next || next === character.userData.currentAction) return;
  const previous = character.userData.currentAction;
  next.reset().fadeIn(0.18).play();
  if (previous) previous.fadeOut(0.18);
  character.userData.currentAction = next;
}

function makeFantasyWorld() {
  const mat = (color, roughness=0.88, metalness=0) => new THREE.MeshStandardMaterial({color,roughness,metalness});
  const stone=mat(0x8d9690), stoneDark=mat(0x58645e), roof=mat(0x394b64), wood=mat(0x80563a), plaster=mat(0xe3d2ad), glass=mat(0x78c9d8,.28,.12), warm=mat(0xffd58a,.4,0), grassMat=mat(0x557b45);
  const box=(parent,w,h,d,material,x,y,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
  const cylinder=(parent,rt,rb,h,material,x,y,z,segments=12)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,segments),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
  const ground=(x,z)=>terrainHeight(x,z);
  function cottage(x,z,s=1) {
    const g=new THREE.Group();g.position.set(x,ground(x,z),z);g.scale.setScalar(s);
    box(g,7,4.1,6,plaster,0,2.05,0);
    const r=new THREE.Mesh(new THREE.ConeGeometry(5.25,3.8,4),roof);r.rotation.y=Math.PI/4;r.position.set(0,5.7,0);r.castShadow=true;g.add(r);
    box(g,1.25,2.35,.18,wood,0,1.18,3.08);
    for(const side of [-1,1]) {box(g,.95,1.15,.16,glass,side*2,2.45,3.09);box(g,1.12,.12,.24,wood,side*2,2.45,3.18);box(g,.12,1.25,.24,wood,side*2,2.45,3.18);}
    box(g,7.6,.22,6.5,wood,0,.18,0);
    scene.add(g);
  }
  function castle(x,z) {
    const g=new THREE.Group();g.position.set(x,ground(x,z),z);
    box(g,27,10,18,stone,0,5,0);
    box(g,30,.9,21,stoneDark,0,10.2,0);
    const towerSpots=[[-12,-8],[12,-8],[-12,8],[12,8]];
    for(const [tx,tz] of towerSpots){
      cylinder(g,3.2,3.6,17,stone,tx,8.5,tz,12);
      const cap=new THREE.Mesh(new THREE.ConeGeometry(3.8,5,12),roof);cap.position.set(tx,19.2,tz);cap.castShadow=true;g.add(cap);
      for(let i=0;i<8;i++){const ang=i*Math.PI/4;box(g,.65,1.25,.75,stoneDark,tx+Math.cos(ang)*3.0,16.2,tz+Math.sin(ang)*3.0);}
      box(g,1.0,3.2,.22,glass,tx,8.5,tz+(tz>0?3.12:-3.12));
    }
    box(g,8,8,.8,wood,0,4,9.45);
    box(g,3.2,5,.25,stoneDark,0,2.5,9.9);
    for(let i=-2;i<=2;i++) box(g,.48,1.1,.3,warm,i*1.35,6.5,9.95);
    scene.add(g);
  }
  function modernHome(x,z) {
    const g=new THREE.Group();g.position.set(x,ground(x,z),z);
    box(g,15,5.2,12,mat(0xe9e9df),0,2.6,0);
    box(g,15,.35,12,mat(0x343d43),0,5.3,0);
    box(g,15,.3,12,mat(0x343d43),0,7.7,0);
    box(g,15,.25,12,mat(0x343d43),0,10.1,0);
    box(g,10,4.3,9,mat(0xf3eee1),0,7.8,0);
    for(const zf of [-6.08,6.08]) box(g,12,3.1,.12,glass,0,3.1,zf);
    box(g,3.4,3.8,.2,wood,-3,2,6.1);
    const terrace=box(g,17,.3,14,wood,0,.18,0);terrace.position.y=.18;
    scene.add(g);
  }
  function portal(x,z) {
    const g=new THREE.Group();g.position.set(x,ground(x,z)+.15,z);
    const frame=new THREE.Mesh(new THREE.TorusGeometry(3.2,.42,12,48),mat(0x25c8e9,.22,.3));frame.position.y=3.7;frame.castShadow=true;g.add(frame);
    const inner=new THREE.Mesh(new THREE.CircleGeometry(2.78,40),new THREE.MeshBasicMaterial({color:0x174c9a,transparent:true,opacity:.7,side:THREE.DoubleSide}));inner.position.set(0,3.7,0);inner.rotation.y=0;g.add(inner);
    for(const side of [-1,1]) box(g,.65,5.5,.7,stoneDark,side*3.3,2.75,0);
    box(g,8,.45,2.2,stone,0,.22,0);
    scene.add(g);
  }
  function floatingIsland(x,y,z,s=1) {
    const g=new THREE.Group();g.position.set(x,y,z);g.scale.setScalar(s);
    const top=new THREE.Mesh(new THREE.CylinderGeometry(5.5,2.1,2.1,7),grassMat);top.position.y=0;top.castShadow=true;g.add(top);
    const rock=new THREE.Mesh(new THREE.ConeGeometry(3.9,9,7),stoneDark);rock.position.y=-5.1;rock.rotation.y=.3;rock.castShadow=true;g.add(rock);
    const treeTrunk=cylinder(g,.22,.3,2.5,wood,0,1.9,0,7);
    const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(1.8,1),mat(0x4d854e));crown.position.set(0,3.5,0);g.add(crown);
    scene.add(g);
  }
  // Camino principal de tierra: conecta la plaza, el castillo y las aldeas.
  const points=[new THREE.Vector3(-5,ground(-5,15)+.12,15),new THREE.Vector3(-12,ground(-12,-4)+.12,-4),new THREE.Vector3(-25,ground(-25,-28)+.12,-28),new THREE.Vector3(-4,ground(-4,-50)+.12,-50)];
  const path=new THREE.CatmullRomCurve3(points);
  const road=new THREE.Mesh(new THREE.TubeGeometry(path,70,2.1,7,false),mat(0xb79a70));road.receiveShadow=true;scene.add(road);
  castle(-5,-58);
  cottage(-31,-34,1.05); cottage(-43,-23,.82); cottage(27,-43,.9); cottage(39,-31,.78);
  modernHome(54,34);
  portal(30,18);
  floatingIsland(-48,24,-42,1.0);
  floatingIsland(57,31,-58,.72);
  // Plaza central, bancos y faroles.
  const plaza=new THREE.Mesh(new THREE.CylinderGeometry(10,10,.32,32),mat(0xb8aa8e));plaza.position.set(0,ground(0,8)+.12,8);plaza.receiveShadow=true;scene.add(plaza);
  for(let i=0;i<6;i++){const ang=i*Math.PI/3;const x=Math.cos(ang)*8,z=8+Math.sin(ang)*8;cylinder(scene,.16,.2,3,wood,x,ground(x,z)+1.5,z,8);const lamp=new THREE.Mesh(new THREE.SphereGeometry(.42,10,8),warm);lamp.position.set(x,ground(x,z)+3.2,z);scene.add(lamp);}
}

function makeRiver() {
  const positions = [], uvs = [], indices = [], steps = 180;
  for (let i = 0; i <= steps; i++) {
    const z = -worldSize / 2 + (i / steps) * worldSize;
    const x = Math.sin(z * .025) * 17 + Math.sin(z * .061) * 5 - 15;
    const width = 3.1 + Math.sin(i * .16) * .75;
    const y = terrainHeight(x, z) + .22;
    positions.push(x-width,y,z,x+width,y,z); uvs.push(0,i/steps*18,1,i/steps*18);
    if (i < steps) { const a=i*2; indices.push(a,a+2,a+1,a+1,a+2,a+3); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute("uv",new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const water = new THREE.MeshStandardMaterial({ color:0x6caaa8, roughness:.18, metalness:.12, transparent:true, opacity:.88, side:THREE.DoubleSide });
  const river = new THREE.Mesh(geometry,water); scene.add(river);
}

function makeDistantMountains() {
  const layers = [
    { radius: 38, height: 25, color: 0x718579, z: -112, count: 13 },
    { radius: 31, height: 19, color: 0x536e5e, z: -98, count: 15 },
    { radius: 25, height: 14, color: 0x405d4b, z: -84, count: 17 }
  ];
  for (const layer of layers) {
    for (let i=0;i<layer.count;i++) {
      const angle = (i/layer.count)*Math.PI*2;
      const peak = new THREE.Mesh(new THREE.ConeGeometry(layer.radius*(.72+Math.sin(i*8)*.12),layer.height*(.72+Math.cos(i*5)*.22),7,2),new THREE.MeshStandardMaterial({color:layer.color,roughness:1,flatShading:true}));
      peak.position.set(Math.cos(angle)*72,layer.height*.24,layer.z+Math.sin(angle)*22);
      peak.rotation.y=angle; scene.add(peak);
    }
  }
}
function makeMeadowDetails() {
  const random=seededRandom(44119);
  const bladeGeometry=new THREE.ConeGeometry(.075,.55,3);
  const bladeMaterial=new THREE.MeshStandardMaterial({color:0x718b4d,roughness:1});
  const grass=new THREE.InstancedMesh(bladeGeometry,bladeMaterial,520);
  const dummy=new THREE.Object3D();
  for(let i=0;i<520;i++){
    const x=(random()-.5)*190,z=(random()-.5)*190;
    if(Math.hypot(x,z)<7) { dummy.position.set(0,-100,0); }
    else { dummy.position.set(x,terrainHeight(x,z)+.18,z); }
    const scale=.45+random()*.9;
    dummy.scale.set(scale,scale,scale); dummy.rotation.y=random()*Math.PI*2; dummy.updateMatrix(); grass.setMatrixAt(i,dummy.matrix);
  }
  grass.instanceMatrix.needsUpdate=true; scene.add(grass);
}
function makePlayer(kind = "explorer:0") {
  const group = new THREE.Group();
  const [avatarType, variantText] = String(kind).split(":");
  const variant = Number(variantText || 0);
  kind = avatarType;
  const rig = new THREE.Group();
  group.add(rig);
  const isBuilder = kind === "builder";
  const isFantasy = ["elf","knight","ninja","mage","orc","fairy"].includes(kind);
  const isAstronaut = kind === "astronaut";
  const isRobot = kind === "robot";
  const isFemale = kind === "woman" || kind === "girl";
  const adult = kind === "woman" || isBuilder || kind === "knight";
  const scale = adult ? 1 : 0.94;
  const mat = (color, roughness = 0.86, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const skinTones = [0xd49a76,0xb97855,0x8e5b42,0xe0b18d,0x70452f];
  const skin = mat(kind === "girl" ? 0xc98b65 : kind === "woman" ? 0xb97855 : skinTones[variant % skinTones.length], 0.92);
  const hairColors = [0x30231d,0x5a321f,0x171717,0x9a6734,0x6d344f,0x344b72,0xb5a06c,0x4c6b47,0x773c2b,0xaaa7a0];
  const hair = mat(hairColors[(variant + (kind === "girl" ? 2 : 0)) % hairColors.length], 1);
  const shirtColor = isBuilder ? 0x263c36 : isAstronaut ? 0xe2e7e9 : isRobot ? 0x536a79 : kind === "girl" ? 0x8a547f : kind === "woman" ? 0x315d76 : 0x315a8c;
  const palette = [0x315a8c,0x8a547f,0x386b52,0x9b542f,0x5b5b91,0x9b813c,0x347d86,0x873d4c,0x596b39,0x6b5547];
  const shirt = mat(isBuilder ? shirtColor : isAstronaut ? shirtColor : isRobot ? shirtColor : palette[variant % palette.length]);
  const pants = mat(isBuilder ? 0x303b40 : isAstronaut ? 0x526779 : isRobot ? 0x344653 : kind === "girl" ? 0x4b3d63 : 0x394b5c);
  const bootMat = mat(isBuilder ? 0x292b2b : 0x302820);
  const gloveMat = mat(isBuilder ? 0x34383a : 0x4b4239);
  const beltMat = mat(0x34302a);
  const metal = mat(0xb5b9b5, 0.38, 0.65);
  const gold = mat(0xd3a53b, 0.45, 0.35);
  const white = mat(0xf2eee4, 0.55);
  const dark = mat(0x252321, 0.5);
  const add = (parent, geometry, material, x, y, z, sx=1, sy=1, sz=1) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x,y,z); mesh.scale.set(sx,sy,sz);
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh);
    return mesh;
  };
  const capsule = (parent, radius, length, material, x,y,z, sx=1,sy=1,sz=1) =>
    add(parent, new THREE.CapsuleGeometry(radius,length,5,10), material,x,y,z,sx,sy,sz);

  if (isRobot) {
    const body = add(rig,new THREE.CapsuleGeometry(.34,.48,5,12),shirt,0,1.34,0,1,1,.82);
    add(rig,new THREE.SphereGeometry(.29,20,16),metal,0,2.02,0,1,1.05,.9);
    add(rig,new THREE.BoxGeometry(.38,.13,.08),mat(0x35d8ef,.22,.5),0,2.04,-.255);
    add(rig,new THREE.CylinderGeometry(.035,.045,.22,10),metal,0,2.36,0);
    add(rig,new THREE.SphereGeometry(.07,12,10),gold,0,2.49,0);
    for (const side of [-1,1]) add(rig,new THREE.BoxGeometry(.14,.22,.18),metal,side*.31,2.02,0);
  } else {
    // Cuerpo con volúmenes redondeados y ropa superpuesta, en lugar de piezas cúbicas.
    add(rig,new THREE.CapsuleGeometry(.34,.48,6,14),shirt,0,1.34,0,1.08,1,.78);
    add(rig,new THREE.CylinderGeometry(.105,.12,.18,14),skin,0,1.76,0);
    add(rig,new THREE.SphereGeometry(.285,24,20),skin,0,2.05,-.015,0.94,1.08,.9);
    // Rasgos faciales: ojos, cejas, nariz y boca, orientados hacia el frente (-Z).
    for (const side of [-1,1]) {
      add(rig,new THREE.SphereGeometry(.035,12,10),white,side*.09,2.075,-.255);
      add(rig,new THREE.SphereGeometry(.018,10,8),dark,side*.09,2.075,-.285);
      add(rig,new THREE.SphereGeometry(.035,10,8),hair,side*.09,2.13,-.267,1.15,.35,.45);
    }
    add(rig,new THREE.SphereGeometry(.035,10,8),skin,0,2.015,-.276,.8,1.15,.8);
    add(rig,new THREE.CapsuleGeometry(.012,.055,3,6),mat(0x754b43),0,1.96,-.274,1,.35,.45);
    // Cabello con volumen y mechones diferenciados.
    add(rig,new THREE.SphereGeometry(.27,20,14,0,Math.PI*2,0,Math.PI*.58),hair,0,2.17,.005,1.04,.72,1);
    if (isFemale) {
      add(rig,new THREE.SphereGeometry(.20,16,12),hair,0,1.98,.17,.92,1.22,.85);
      for (const side of [-1,1]) capsule(group,.075,.22,hair,side*.22,1.99,.08,1,1.35,1);
    } else {
      add(rig,new THREE.SphereGeometry(.12,14,10),hair,0,2.23,-.19,1.25,.5,.65);
    }
  }

  // Cuello, hombros y extremidades articuladas con silueta anatómica.
  const arms = [], legs = [];
  for (const side of [-1,1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side*.43,1.48,0);
    rig.add(shoulder);
    capsule(shoulder,.105,.27,shirt,0,-.15,0,1,1,1);
    const elbow = new THREE.Group(); elbow.position.set(0,-.31,0); shoulder.add(elbow);
    capsule(elbow,.078,.25,shirt,0,-.14,0,1,1,1);
    add(elbow,new THREE.SphereGeometry(.073,12,10),skin,0,-.29,-.005,1,.85,.9);
    add(elbow,new THREE.CapsuleGeometry(.068,.055,4,8),isBuilder?gloveMat:skin,0,-.36,-.01);
    arms.push(shoulder);

    const hip = new THREE.Group(); hip.position.set(side*.18,.99,0); rig.add(hip);
    capsule(hip,.145,.42,pants,0,-.26,0,1,1.12,1);
    add(hip,new THREE.SphereGeometry(.145,14,12),pants,0,-.51,0,1,.7,1);
    add(hip,new THREE.CapsuleGeometry(.13,.10,4,8),bootMat,0,-.61,-.045,1,.72,1.35);
    legs.push(hip);
  }

  // Chaqueta/chaleco del constructor con bandas reflectantes reales y bolsillos.
  if (isBuilder) {
    const vest = mat(0xf08a18,0.78);
    const reflective = mat(0xe8e8d5,0.38,0.12);
    add(rig,new THREE.CapsuleGeometry(.355,.43,5,14),vest,0,1.37,-.012,1.08,1,.80);
    for (const y of [1.20,1.48]) {
      const band = add(rig,new THREE.CylinderGeometry(.355,.355,.075,24,1,true),reflective,0,y,0,1.02,1,.80);
    }
    add(rig,new THREE.BoxGeometry(.07,.62,.035),reflective,0,1.39,-.305);
    for (const side of [-1,1]) {
      add(rig,new THREE.BoxGeometry(.17,.18,.035),vest,side*.20,1.18,-.305);
      add(rig,new THREE.BoxGeometry(.13,.10,.045),gold,side*.20,1.12,-.33);
    }
    // Cinturón de herramientas, hebilla, bolsillos y herramientas visibles.
    add(rig,new THREE.CylinderGeometry(.30,.30,.10,20),beltMat,0,1.02,0,1.05,1,.82);
    add(rig,new THREE.BoxGeometry(.13,.12,.045),gold,0,1.02,-.27);
    for (const side of [-1,1]) {
      add(rig,new THREE.BoxGeometry(.18,.22,.12),leatherMaterial(),side*.29,.91,-.02);
      add(rig,new THREE.CylinderGeometry(.025,.025,.28,8),metal,side*.30,.88,-.12);
    }
    // Casco amarillo de obra con visera, ala y nervaduras.
    const helmet = mat(0xf4bd24,.58);
    add(rig,new THREE.SphereGeometry(.30,20,14,0,Math.PI*2,0,Math.PI*.52),helmet,0,2.31,0,1.08,.86,1);
    add(rig,new THREE.CylinderGeometry(.34,.34,.055,24),helmet,0,2.20,0,1,1,.95);
    add(rig,new THREE.BoxGeometry(.075,.22,.045),gold,0,2.37,-.22);
    add(rig,new THREE.BoxGeometry(.34,.045,.045),gold,0,2.30,-.04);
  }

  if (isAstronaut) {
    add(rig,new THREE.CylinderGeometry(.27,.29,.13,20),metal,0,1.79,0);
    add(rig,new THREE.SphereGeometry(.37,24,18),new THREE.MeshPhysicalMaterial({color:0x8ed8ec,transparent:true,opacity:.22,roughness:.08,metalness:.12}),0,2.06,0);
    add(rig,new THREE.BoxGeometry(.42,.42,.16),white,0,1.35,.31);
  }

  // Calzado, costuras y detalles de ropa.
  for (const side of [-1,1]) {
    add(rig,new THREE.BoxGeometry(.12,.08,.035),dark,side*.18,.98,-.19);
  }
  if (!isBuilder && !isRobot) {
    add(rig,new THREE.BoxGeometry(.44,.24,.12),beltMat,0,1.01,.015);
  }

  // Mochila de exploración de lona con correas, tapa y bolsillos (espalda +Z).
  const packMat = mat(isBuilder ? 0x414b43 : 0x756247);
  add(rig,new THREE.BoxGeometry(.48,.62,.25),packMat,0,1.34,.34,1,1,1);
  add(rig,new THREE.BoxGeometry(.50,.15,.27),mat(0x9a815b),0,1.68,.34);
  add(rig,new THREE.BoxGeometry(.27,.22,.08),mat(0x9a815b),0,1.25,.50);
  for (const side of [-1,1]) {
    add(rig,new THREE.BoxGeometry(.065,.65,.055),dark,side*.18,1.34,.19);
    add(rig,new THREE.CylinderGeometry(.075,.075,.18,10),packMat,side*.27,1.34,.34);
  }
  const logoCanvas = document.createElement("canvas"); logoCanvas.width=512; logoCanvas.height=128;
  const ctx=logoCanvas.getContext("2d"); ctx.clearRect(0,0,512,128);
  ctx.fillStyle="#e7d29a"; ctx.font="900 82px Arial"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("ILOX",256,67);
  const logoTexture = new THREE.CanvasTexture(logoCanvas);
  add(rig,new THREE.PlaneGeometry(.42,.105),new THREE.MeshBasicMaterial({map:logoTexture,transparent:true,side:THREE.DoubleSide}),0,1.84,.475);

  // Variantes fantásticas con siluetas reconocibles, no solo cambios de color.
  if (kind === "elf") { for (const side of [-1,1]) { const ear=add(rig,new THREE.ConeGeometry(.09,.34,8),skin,side*.34,2.06,-.01); ear.rotation.z=side*-Math.PI/2; } }
  if (kind === "knight") { const armor=mat(0x87939d,.38,.62); add(rig,new THREE.CapsuleGeometry(.37,.48,5,12),armor,0,1.36,-.02,1.12,1,.82); add(rig,new THREE.SphereGeometry(.31,18,14),armor,0,2.08,0,1.05,1,.95); add(rig,new THREE.BoxGeometry(.43,.12,.08),dark,0,2.05,-.27); }
  if (kind === "ninja") { const mask=mat(0x252735); add(rig,new THREE.BoxGeometry(.43,.20,.12),mask,0,1.99,-.25); add(rig,new THREE.BoxGeometry(.48,.10,.20),hair,0,2.28,0); }
  if (kind === "mage") { const robe=mat(0x493b78); add(rig,new THREE.CylinderGeometry(.22,.43,.85,16),robe,0,1.14,0); add(rig,new THREE.ConeGeometry(.34,.55,16),robe,0,2.40,0); }
  if (kind === "orc") { const tusk=mat(0xf0e6ce); for(const side of [-1,1]) add(rig,new THREE.ConeGeometry(.055,.20,8),tusk,side*.13,1.94,-.26); add(rig,new THREE.SphereGeometry(.32,18,14),mat(0x66834d),0,2.05,-.01,1.05,1.08,.92); }
  if (kind === "fairy") { const wing=mat(0x9edbe0,.3,.15); for(const side of [-1,1]) { const w=add(rig,new THREE.SphereGeometry(.22,16,12),wing,side*.40,1.62,.25,1.25,1.7,.28); w.rotation.z=side*.35; } }
  // Ajuste de tonos y rasgos por variante para que las cien opciones se distingan.
  group.scale.setScalar(scale);
  group.position.set(0,terrainHeight(0,0),0);
  group.userData.avatarKind=kind;
  group.userData.legs=legs;
  group.userData.arms=arms;
  group.userData.rig=rig;
  scene.add(group);
  return group;

  function leatherMaterial() { return mat(0x49382a,1); }
}
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9bb8ae);
  makeSky();
  scene.fog = new THREE.Fog(0xb4c4b6, 145, 285);
  camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 280);
  // Brazos y cubo sostenido en primera persona.
  viewHands = new THREE.Group();
  const sleeveMat = new THREE.MeshStandardMaterial({color:0x315a8c,roughness:0.9});
  const handMat = new THREE.MeshStandardMaterial({color:0xd49a76,roughness:0.8});
  for (const side of [-1,1]) {
    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.105,0.42,4,10),sleeveMat);
    sleeve.position.set(side*0.34,-0.34,-0.62); sleeve.rotation.z = side===-1 ? -0.38 : 0.38; viewHands.add(sleeve);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.105,12,10),handMat);
    hand.position.set(side*0.36,-0.56,-0.9); viewHands.add(hand);
  }
  const heldBlock = new THREE.Mesh(new THREE.BoxGeometry(0.66,0.66,0.66),new THREE.MeshStandardMaterial({color:selectedBlockColor,roughness:0.85}));
  heldBlock.position.set(0.02,-0.53,-0.82); heldBlock.rotation.set(0.18,0.25,0.12); viewHands.add(heldBlock);
  camera.add(viewHands); scene.add(camera);
  renderer = new THREE.WebGLRenderer({ antialias: innerWidth > 700, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.25));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  game.insertBefore(renderer.domElement, game.firstChild);
  scene.add(new THREE.HemisphereLight(0xeaf3ed, 0x46533c, 1.8));
  const sun = new THREE.DirectionalLight(0xffe7c0, 3.1);
  sun.position.set(-55, 85, 42);
  scene.add(sun);
  makeDistantMountains();
  makeTerrain();
  makeMeadowDetails();
  // Las construcciones grandes ya no vienen hechas: el jugador crea su propio mundo.
  const random = seededRandom(20261114);
  for (let i = 0; i < 58; i++) {
    const x = (random() - 0.5) * 190;
    const z = (random() - 0.5) * 190;
    if (Math.hypot(x, z) < 21) continue;
    if (Math.abs(x - (Math.sin(z * 0.025) * 17 - 15)) < 5) continue;
    makeTree(x, z, 0.72 + random() * 0.65, random);
  }
  for (let i = 0; i < 42; i++) {
    const x = (random() - 0.5) * 195;
    const z = (random() - 0.5) * 195;
    if (Math.hypot(x, z) < 13) continue;
    makeRock(x, z, 0.35 + random() * 1.1, random);
  }
  clock = new THREE.Clock();
  camera.position.set(0, terrainHeight(0,0) + 4.1, 8.5);
  camera.lookAt(0, terrainHeight(0,0) + 1.2, 0);
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
    if(e.key===" "||e.key==="Spacebar")triggerJump();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(e.key.toLowerCase())) e.preventDefault();
  });
  addEventListener("keyup", e => keys.delete(e.key.toLowerCase()));
  jumpButton.addEventListener("pointerdown",e=>{e.preventDefault();e.stopPropagation();triggerJump();});
  movePad.addEventListener("pointerdown", e => {
    if (!started || cameraLocked || e.button !== 0 || moveStickPointer !== null) return;
    e.preventDefault();
    e.stopPropagation();
    moveStickPointer = e.pointerId;
    movePad.setPointerCapture(e.pointerId);
    updateMoveStick(e);
  });
  movePad.addEventListener("pointermove", e => {
    if (e.pointerId !== moveStickPointer || cameraLocked) return;
    e.preventDefault();
    updateMoveStick(e);
  });
  movePad.addEventListener("pointerup", e => {
    if (e.pointerId === moveStickPointer) resetMoveStick();
  });
  movePad.addEventListener("pointercancel", e => {
    if (e.pointerId === moveStickPointer) resetMoveStick();
  });
  game.addEventListener("pointerdown", e => {
    if (e.target.closest("button") || e.target.closest("#move-pad") || e.target.closest("#build-panel") || e.target.closest("#menu-panel") || e.target.closest("#menu-toggle")) return;
    activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(activePointers.size===2){const p=[...activePointers.values()];pinchStartDistance=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);pinchStartZoom=cameraDistance;pointerDragged=true;}
    lookPointer = e.pointerId;
    lastLookX = lookStartX = e.clientX;
    lastLookY = lookStartY = e.clientY;
    pointerDragged = false;
    if (game.setPointerCapture) game.setPointerCapture(e.pointerId);
  });
  game.addEventListener("pointermove", e => {
    if(activePointers.has(e.pointerId)) activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(activePointers.size>=2){const p=[...activePointers.values()];const d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);cameraDistance=THREE.MathUtils.clamp(pinchStartZoom*(pinchStartDistance/Math.max(1,d)),3.2,20);return;}
    if (lookPointer !== e.pointerId || !started) return;
    const dx = e.clientX - lastLookX;
    const dy = e.clientY - lastLookY;
    if (Math.hypot(e.clientX-lookStartX,e.clientY-lookStartY)>7) pointerDragged = true;
    lastLookX = e.clientX;
    lastLookY = e.clientY;
    // Cámara orbital libre: arrastrar gira alrededor del personaje incluso al construir.
    yaw -= dx * 0.0048;
    pitch = THREE.MathUtils.clamp(pitch + dy * 0.0032, 0.12, 1.12);
  });
  game.addEventListener("pointerup", e => {
    activePointers.delete(e.pointerId);
    if (lookPointer !== e.pointerId) return;
    if (buildMode && started && !pointerDragged && activePointers.size===0) placeBuildAtPointer(e);
    lookPointer = activePointers.size ? [...activePointers.keys()][0] : null;
    if(lookPointer!==null){const p=activePointers.get(lookPointer);lastLookX=p.x;lastLookY=p.y;pointerDragged=true;}
  });
  game.addEventListener("pointercancel", e => { activePointers.delete(e.pointerId); if (lookPointer === e.pointerId) lookPointer = activePointers.size ? [...activePointers.keys()][0] : null; });
  game.addEventListener("wheel", e => {
    if (!started) return;
    e.preventDefault();
    cameraDistance = THREE.MathUtils.clamp(cameraDistance + Math.sign(e.deltaY)*0.9, cameraMode==="second"?2.2:(buildMode?3.2:4.2), 20);
  }, {passive:false});

  startButton.addEventListener("click", () => {
    welcome.classList.add("hidden");
    avatarSelect.classList.remove("hidden");
  });
  const avatarCatalog = [
    ["soldier","🧍","Humano original",1],["man","👨","Hombre",10],["woman","👩","Mujer",10],
    ["boy","👦","Niño",10],["girl","👧","Niña",10],["builder","👷","Constructor",10],
    ["astronaut","🧑‍🚀","Astronauta",10],["robot","🤖","Robot",10],["elf","🧝","Elfo",10],
    ["knight","🛡️","Caballero",10],["ninja","🥷","Ninja",10],["mage","🧙","Mago",10]
  ];
  const avatarGrid = document.querySelector(".avatar-options");
  avatarGrid.innerHTML = "";
  let firstAvatar = true;
  avatarCatalog.forEach(([type,emoji,label,count]) => {
    for (let variant=0; variant<count; variant++) {
      const option=document.createElement("button");
      option.className="avatar-option"+(firstAvatar?" selected":"");
      option.dataset.avatar=type+":"+variant;
      option.innerHTML='<span class="avatar-emoji">'+emoji+'</span><strong>'+label+(count>1?" "+(variant+1):"")+'</strong><small>'+(HUMAN_AVATAR_MODELS[type]?"Humano animado":"Modelo "+String(variant+1).padStart(2,"0"))+'</small>';
      avatarGrid.appendChild(option);firstAvatar=false;
    }
  });
  selectedAvatar = "soldier:0";
  document.querySelectorAll(".avatar-option").forEach(option => {
    option.addEventListener("click", () => {
      selectedAvatar = option.dataset.avatar;
      document.querySelectorAll(".avatar-option").forEach(item => item.classList.toggle("selected", item === option));
      enterWorldButton.innerHTML = (started ? "APLICAR " : "ENTRAR COMO ") + option.querySelector("strong").textContent.toUpperCase() + " <span>→</span>";
    });
  });
  enterWorldButton.addEventListener("click", () => {
    const oldPosition=player?player.position.clone():new THREE.Vector3(0,terrainHeight(0,0),0);
    const oldHeading=player?player.rotation.y:yaw;
    if (player) scene.remove(player);
    player = makePlayer(selectedAvatar);
    player.position.copy(oldPosition);player.rotation.y=oldHeading;
    started = true;
    cameraControls.classList.remove("hidden");
    loadRiggedAvatar(selectedAvatar);
    avatarSelect.classList.add("hidden");
    menuToggle.classList.remove("hidden");
    hint.textContent = "Explorá y construí tu propio mundo";
    loadBuilds();
    showToast("¡Tu mundo, tus reglas!");
  });
  const applyCameraMode = mode => {
    if (cameraLocked && mode === "first") mode = "second";
    cameraMode = mode;
    firstPersonBuild = mode === "first";
    cameraDistance = mode === "first" ? 0.08 : mode === "second" ? 3.0 : 5.4;
    if (mode === "second") pitch = 0.28;
    else if (mode === "third") pitch = 0.48;
    document.querySelectorAll(".camera-mode").forEach(button => button.classList.toggle("selected", button.dataset.camera === mode));
    const buildView = document.querySelector("#view-toggle");
    if (buildView) buildView.textContent = mode === "first" ? "👁 PRIMERA PERSONA" : "⬆ VISTA AÉREA";
    showToast(mode === "first" ? "Cámara en primera persona" : mode === "second" ? "Cámara cercana: segunda persona" : "Cámara en tercera persona");
  };
  cameraMenuToggle.addEventListener("click",()=>cameraModePanel.classList.toggle("hidden"));
  document.querySelectorAll(".camera-mode").forEach(button => button.addEventListener("click", () => {applyCameraMode(button.dataset.camera);cameraModePanel.classList.add("hidden");}));
  cameraLockButton.addEventListener("click", () => {
    cameraLocked = !cameraLocked;
    game.classList.toggle("camera-locked", cameraLocked);
    if (cameraLocked) {
      if (cameraMode === "first") applyCameraMode("second");
      resetMoveStick();
      keys.clear();
      yaw += Math.PI;
      cameraLockButton.textContent = "🔒";
      cameraLockButton.classList.add("locked");
      cameraLockButton.setAttribute("aria-pressed","true");
      showToast("Movimiento bloqueado: arrastrá para ver la cara del personaje");
    } else {
      cameraLockButton.textContent = "🔓";
      cameraLockButton.classList.remove("locked");
      cameraLockButton.setAttribute("aria-pressed","false");
      showToast("Movimiento desbloqueado");
    }
  });
  const buildToggle = document.querySelector("#build-toggle");
  const viewToggle = document.querySelector("#view-toggle");
  const categorySelect = document.querySelector("#build-category");
  const buildToolsHost = document.querySelector("#build-tools");
  const toolCatalog = {
    block:[["block","🧱","CUBO"],["brick","🧱","LADRILLO"],["erase","⌫","BORRAR"],["rotate","↻","GIRAR"]],
    nature:[["tree","🌳","ÁRBOL"],["rock","🪨","ROCA"],["erase","⌫","BORRAR"]],
    water:[["water","🌊","AGUA"],["erase","⌫","BORRAR"]],
    structure:[["floor","▰","PISO"],["wall","▥","PARED"],["roof","🏠","TECHO"],["stairs","🪜","ESCALERA"],["door","🚪","PUERTA"],["window","▣","VENTANA"],["gate","🚧","PORTÓN"],["fence","🪵","TRANQUERA"],["erase","⌫","BORRAR"],["rotate","↻","GIRAR"]],
    furniture:[["chair","🪑","SILLA"],["table","🪵","MESA"],["bed","🛏️","CAMA"],["sofa","🛋️","SOFÁ"],["lamp","💡","LÁMPARA"],["erase","⌫","BORRAR"]],
    farm:[["pen","🐑","CORRAL"],["sheep","🐑","OVEJA"],["cow","🐄","VACA"],["horse","🐎","CABALLO"],["chicken","🐔","GALLINA"],["erase","⌫","BORRAR"]]
  };
  function renderBuildTools(category="block"){
    buildToolsHost.innerHTML="";
    for(const [kind,emoji,label] of (toolCatalog[category]||toolCatalog.block)){
      const button=document.createElement("button");button.type="button";button.className="build-tool"+(kind===buildTool?" selected":"");button.dataset.tool=kind;button.innerHTML=emoji+"<small>"+label+"</small>";
      button.addEventListener("click",()=>{
        if(kind==="rotate"){buildRotation=(buildRotation+Math.PI/2)%(Math.PI*2);showToast("Pieza girada");return;}
        buildTool=kind;buildToolsHost.querySelectorAll(".build-tool").forEach(item=>item.classList.toggle("selected",item===button));
        document.querySelector("#build-help").textContent=kind==="erase"?"Tocá una construcción para eliminar esa pieza.":kind==="water"?"Agua: solo en los sectores habilitados del valle central.":"Pieza seleccionada. Se coloca alineada a la cuadrícula.";
        buildPanel.classList.add("hidden");
      });buildToolsHost.appendChild(button);
    }
  }
  renderBuildTools();
  categorySelect.addEventListener("change",()=>renderBuildTools(categorySelect.value));
  menuToggle.addEventListener("click",()=>{const open=menuPanel.classList.contains("hidden");menuPanel.classList.toggle("hidden",!open);menuToggle.setAttribute("aria-expanded",String(open));});
  document.querySelector("#change-avatar").addEventListener("click",()=>{
    menuPanel.classList.add("hidden");menuToggle.setAttribute("aria-expanded","false");menuToggle.classList.add("hidden");avatarSelect.classList.remove("hidden");
    enterWorldButton.innerHTML="APLICAR PERSONAJE <span>→</span>";
    document.querySelectorAll(".avatar-option").forEach(option=>option.classList.toggle("selected",option.dataset.avatar===selectedAvatar));
  });
  document.querySelector("#erase-all").addEventListener("click",()=>{
    if(!buildRecords.length){showToast("Todavía no hay construcciones para eliminar.");return;}
    if(!confirm("¿Eliminar definitivamente todo lo construido en este mundo?"))return;
    for(const group of buildGroups)scene.remove(group);buildGroups.length=0;buildRecords.length=0;persistBuilds();
    menuPanel.classList.add("hidden");menuToggle.setAttribute("aria-expanded","false");showToast("Se eliminaron todas las construcciones.");
  });
  document.querySelector("#erase-parts").addEventListener("click",()=>{
    buildMode=true;buildTool="erase";buildPanel.classList.add("hidden");menuPanel.classList.add("hidden");menuToggle.setAttribute("aria-expanded","false");
    buildToggle.textContent="✓ TERMINAR";renderBuildTools(categorySelect.value);showToast("Tocá cada pieza que quieras eliminar.");
  });
  viewToggle.addEventListener("click",()=>{applyCameraMode(cameraMode==="first"?"third":"first");cameraDistance=firstPersonBuild?0.08:9.5;});
  buildToggle.addEventListener("click",()=>{
    buildMode=!buildMode;buildPanel.classList.toggle("hidden",!buildMode);menuPanel.classList.add("hidden");menuToggle.setAttribute("aria-expanded","false");buildToggle.textContent=buildMode?"✓ TERMINAR":"🧱 Construir";
    cameraDistance=cameraMode==="first"?0.08:(cameraMode==="second"?3:(buildMode?9.5:5.4));
    if(buildMode&&!firstPersonBuild)pitch=.48;viewToggle.classList.toggle("hidden",!buildMode);
    viewToggle.textContent=firstPersonBuild?"👁 PRIMERA PERSONA":"⬆ VISTA AÉREA";
    document.querySelector("#build-help").textContent=buildMode?"Elegí una categoría y una pieza. Tocá para colocar; todo encaja en cuadrícula.":"Explorá el mundo y construí.";
    showToast(buildMode?"Modo construcción activado":"¡A explorar!");
  });
  document.querySelectorAll(".block-color").forEach(button => {
    button.addEventListener("click", () => {
      selectedBlockColor = Number(button.dataset.color);
      document.querySelectorAll(".block-color").forEach(item => item.classList.toggle("selected", item === button));
      buildPanel.classList.add("hidden");
      showToast("Color seleccionado");
    });
  });
  document.querySelector("#fullscreen").addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) await game.requestFullscreen();
      else await document.exitFullscreen();
    } catch { showToast("La pantalla completa no está disponible en este navegador."); }
  });
}


function createBuildPiece(record) {
  const group=new THREE.Group(),mat=(c,r=.9,m=0)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});
  const wood=mat(0x93633d),darkWood=mat(0x583a27),wall=mat(0xe7d9bb),glass=mat(0x75cde0,.2),metal=mat(0x737d80,.42,.62);
  const box=(w,h,d,m,x,y,z)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;group.add(o);return o;};
  const ball=(x,y,z,sx,sy,sz,m)=>{const o=new THREE.Mesh(new THREE.SphereGeometry(1,20,16),m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;o.receiveShadow=true;group.add(o);return o;};
  const cyl=(x,y,z,rt,rb,h,m)=>{const o=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,12),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;group.add(o);return o;};
  const {kind,x,z,rotation=0}=record,baseY=Number.isFinite(record.y)?record.y:terrainHeight(x,z);
  if(kind==="block"||kind==="brick"){
    let material=mat(record.color??0xff3030);
    if(kind==="brick"){const canvas=document.createElement("canvas");canvas.width=256;canvas.height=256;const ctx=canvas.getContext("2d");ctx.fillStyle="#9d5946";ctx.fillRect(0,0,256,256);ctx.strokeStyle="#e5b49b";ctx.lineWidth=5;for(let row=0;row<6;row++){const yy=row*43;ctx.beginPath();ctx.moveTo(0,yy);ctx.lineTo(256,yy);ctx.stroke();const off=row%2?0:64;for(let col=-1;col<4;col++){ctx.beginPath();ctx.moveTo(off+col*128,yy);ctx.lineTo(off+col*128,yy+43);ctx.stroke();}}const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;material=new THREE.MeshStandardMaterial({map:texture,roughness:.95});}
    box(1.5,1.5,1.5,material,0,.75,0);
  }
  if(kind==="floor")box(1.5,.16,1.5,wood,0,.08,0);
  if(kind==="roof"){const roofPiece=box(1.5,.16,1.5,mat(0x9a5545),0,1.42,0);roofPiece.rotation.z=-.12;}
  if(kind==="wall")box(1.5,1.5,.16,wall,0,.75,0);
  if(kind==="door"){box(.18,1.5,.16,wall,-.66,.75,0);box(.18,1.5,.16,wall,.66,.75,0);box(1.5,.18,.16,wall,0,1.41,0);box(1.12,1.28,.07,wood,0,.66,-.04);ball(.42,.68,-.09,.045,.045,.045,metal);}
  if(kind==="window"){box(.18,1.5,.16,wall,-.66,.75,0);box(.18,1.5,.16,wall,.66,.75,0);box(1.5,.18,.16,wall,0,1.41,0);box(1.5,.18,.16,wall,0,.09,0);box(1.25,1.15,.045,glass,0,.75,-.04);box(.06,1.2,.08,wood,0,.75,-.08);box(1.3,.06,.08,wood,0,.75,-.08);}
  if(kind==="stairs"){for(let i=0;i<5;i++)box(1.5,.3,.3,wood,0,.15+i*.3,-.6+i*.3);}
  if(kind==="tree"){cyl(0,.68,0,.12,.2,1.35,darkWood);for(let i=0;i<10;i++){const ang=i*2.399;ball(Math.cos(ang)*.28,1.3+(i%3)*.22,Math.sin(ang)*.28,.48,.56,.48,mat([0x3e713d,0x4d8245,0x608b4b][i%3]));}}
  if(kind==="rock"){const o=new THREE.Mesh(new THREE.DodecahedronGeometry(.68,1),mat(0x85877e));o.position.y=.48;o.scale.set(1.1,.7,.9);o.rotation.set(.2,.4,.1);o.castShadow=true;group.add(o);}
  if(kind==="water"){const geo=new THREE.PlaneGeometry(1.5,1.5,12,12),water=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0x3dadd0,roughness:.16,metalness:.12,transparent:true,opacity:.82,side:THREE.DoubleSide}));water.rotation.x=-Math.PI/2;water.position.y=.055;water.userData.water=true;water.userData.basePositions=geo.attributes.position.array.slice();group.add(water);group.userData.water=true;}
  if(kind==="chair"){box(.95,.12,.9,wood,0,.72,0);box(.95,.85,.12,wood,0,1.15,-.39);for(const sx of [-.38,.38])for(const sz of [-.32,.32])box(.12,.68,.12,darkWood,sx,.34,sz);}
  if(kind==="table"){box(1.4,.14,1.2,wood,0,.92,0);for(const sx of [-.55,.55])for(const sz of [-.42,.42])box(.12,.9,.12,darkWood,sx,.45,sz);}
  if(kind==="bed"){box(1.4,.22,1.5,darkWood,0,.38,0);box(1.32,.2,1.32,mat(0xe4dfd0),0,.58,0);box(.55,.18,.35,mat(0xf4eee0),-.36,.76,-.45);box(1.4,.95,.12,wood,0,.55,-.7);}
  if(kind==="sofa"){box(1.5,.42,.72,mat(0x547a74),0,.45,0);box(1.5,.72,.16,mat(0x547a74),0,.83,-.28);for(const sx of [-.68,.68])box(.16,.62,.72,mat(0x42635d),sx,.67,0);}
  if(kind==="lamp"){cyl(0,.4,0,.07,.09,.8,metal);ball(0,.95,0,.28,.22,.28,mat(0xffd98a,.25));}
  if(["gate","fence","pen"].includes(kind)){for(const sx of [-.68,.68])box(.12,1.25,.12,darkWood,sx,.625,0);for(const yy of [.35,.95])box(1.5,.12,.1,wood,0,yy,0);if(kind!=="fence")for(let i=-2;i<=2;i++)box(.07,.75,.09,wood,i*.28,.62,0);}
  if(["sheep","cow","horse","chicken"].includes(kind)) loadAnimalModel(group,kind);

  group.position.set(x,baseY,z);group.rotation.y=rotation;group.userData.buildRecord=record;group.userData.vy=0;group.userData.buildHeight=group.userData.buildHeight||new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3()).y;scene.add(group);buildGroups.push(group);return group;
}
async function loadAnimalModel(group,kind){
  const url=ANIMAL_MODELS[kind];if(!url)return;
  try{
    if(!animalAssetPromises.has(url))animalAssetPromises.set(url,animalModelLoader.loadAsync(url));
    const gltf=await animalAssetPromises.get(url);if(!group.parent)return;
    const model=cloneSkeleton(gltf.scene);
    const bounds=new THREE.Box3().setFromObject(model),size=new THREE.Vector3();bounds.getSize(size);
    const targetHeight={sheep:.78,cow:1.42,horse:1.62,chicken:.58}[kind]||1;
    const scale=targetHeight/Math.max(size.y,.001);model.scale.setScalar(scale);model.position.y=-bounds.min.y*scale;
    model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});group.add(model);
    const mixer=new THREE.AnimationMixer(model),actions={};
    for(const clip of gltf.animations){const name=clip.name.toLowerCase();if(name.includes("idle"))actions.idle=mixer.clipAction(clip);else if(name.includes("walk"))actions.walk=mixer.clipAction(clip);else if(name.includes("run"))actions.run=mixer.clipAction(clip);}
    const idle=actions.idle||(gltf.animations[0]&&mixer.clipAction(gltf.animations[0]));if(idle){idle.play();actions.current=idle;}
    group.userData.animalMixer=mixer;group.userData.animalActions=actions;group.userData.buildHeight=targetHeight;
  }catch(error){console.warn("ILOX animal GLB failed",kind,error);showToast("No se pudo descargar este animal 3D.");}
}
function persistBuilds() {
  try { localStorage.setItem("ilox-builds-v1",JSON.stringify(buildRecords)); }
  catch(error){ showToast("No se pudo guardar el mundo en este dispositivo."); }
}
function loadBuilds() {
  if(buildRecords.length) return;
  try {
    const saved=JSON.parse(localStorage.getItem("ilox-builds-v1")||"[]");
    if(Array.isArray(saved)) saved.slice(0,1200).forEach(record=>{if(record&&["block","brick","floor","wall","door","window","roof","stairs","tree","rock","water","chair","table","bed","sofa","lamp","gate","fence","pen","sheep","cow","horse","chicken"].includes(record.kind)&&Number.isFinite(record.x)&&Number.isFinite(record.z)){const heights={block:1.5,brick:1.5,wall:1.5,door:1.5,window:1.5,roof:1.5,stairs:1.5,floor:.16,tree:2.5,rock:.9,chair:1.5,table:1.05,bed:1.1,sofa:1.2,lamp:1.2,gate:1.25,fence:1.25,pen:1.25,sheep:.78,cow:1.42,horse:1.62,chicken:.58};const supported=buildRecords.some(lower=>Math.abs(lower.x-record.x)<.2&&Math.abs(lower.z-record.z)<.2&&Math.abs((lower.y+(heights[lower.kind]||1.5))-record.y)<.24);if(!supported&&record.y>terrainHeight(record.x,record.z)+.12)record.y=terrainHeight(record.x,record.z);buildRecords.push(record);createBuildPiece(record);}});
  } catch(error){ console.warn("ILOX: no se pudieron recuperar las construcciones",error); }
}
function placeBuildAtPointer(event){
  const rect=renderer.domElement.getBoundingClientRect(),pointer=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-((event.clientY-rect.top)/rect.height)*2+1),raycaster=new THREE.Raycaster();raycaster.setFromCamera(pointer,camera);
  if(buildTool==="erase"){const hits=raycaster.intersectObjects(buildGroups,true);if(!hits.length){showToast("Tocá una construcción para borrarla.");return;}let root=hits[0].object;while(root.parent&&root.parent!==scene)root=root.parent;const rec=root.userData.buildRecord,idx=buildRecords.indexOf(rec);if(idx>=0){buildRecords.splice(idx,1);scene.remove(root);const gi=buildGroups.indexOf(root);if(gi>=0)buildGroups.splice(gi,1);persistBuilds();showToast("Pieza eliminada");}return;}
  if(!terrainMesh)return;const terrainHit=raycaster.intersectObject(terrainMesh,false)[0],pieceHits=raycaster.intersectObjects(buildGroups,true),hit=pieceHits[0];
  if(!terrainHit&&!hit){showToast("Tocá el terreno para colocar.");return;}
  const onPiece=!!hit&&(!terrainHit||hit.distance<terrainHit.distance);let point=onPiece?hit.point:terrainHit.point;
  let x=Math.round(point.x/1.5)*1.5,z=Math.round(point.z/1.5)*1.5;
  if(onPiece&&buildTool!=="water"&&hit.face){const normal=hit.object.localToWorld(hit.face.normal.clone()).sub(hit.object.getWorldPosition(new THREE.Vector3())).normalize();if(normal.y<.65){x=Math.round((point.x+normal.x*.76)/1.5)*1.5;z=Math.round((point.z+normal.z*.76)/1.5)*1.5;}}
  if(Math.abs(x)>worldSize/2-5||Math.abs(z)>worldSize/2-5)return;
  if(buildTool==="water"&&(Math.abs(x)>42||Math.abs(z)>42)){showToast("El agua solo se puede colocar en los sectores habilitados del valle central.");return;}
  const ground=terrainHeight(x,z);let baseY=ground;
  if(onPiece&&buildTool!=="water"){let root=hit.object;while(root.parent&&root.parent!==scene)root=root.parent;const top=new THREE.Box3().setFromObject(root).max.y;baseY=Math.round(top/1.5)*1.5;}
  const record={kind:buildTool,x,z,y:baseY,rotation:buildRotation,color:selectedBlockColor};
  buildRecords.push(record);createBuildPiece(record);persistBuilds();showToast(buildTool==="water"?"Agua colocada en sector habilitado":"¡Pieza colocada y alineada!");
}
function triggerJump(){if(!started||!player||!playerGrounded||cameraLocked)return;playerVerticalVelocity=7.2;playerGrounded=false;}
function updateMoveStick(event) {
  const rect = movePad.getBoundingClientRect();
  const radius = Math.min(rect.width, rect.height) * 0.36;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let x = (event.clientX - cx) / radius;
  let y = (event.clientY - cy) / radius;
  const magnitude = Math.hypot(x, y);
  if (magnitude > 1) { x /= magnitude; y /= magnitude; }
  moveStick.x = x;
  moveStick.y = y;
  moveKnob.style.transform = `translate(calc(-50% + ${x * radius}px), calc(-50% + ${y * radius}px))`;
}
function resetMoveStick() {
  moveStickPointer = null;
  moveStick.x = 0;
  moveStick.y = 0;
  moveKnob.style.transform = "translate(-50%, -50%)";
}

function updateBuildGravity(delta){
  for(const group of buildGroups){
    const record=group.userData.buildRecord;if(!record)continue;
    let supportY=terrainHeight(group.position.x,group.position.z);
    for(const other of buildGroups){if(other===group)continue;if(Math.abs(other.position.x-group.position.x)>.2||Math.abs(other.position.z-group.position.z)>.2)continue;const top=other.position.y+(other.userData.buildHeight||1.5);if(top<=group.position.y+.12&&top>supportY)supportY=top;}
    if(group.position.y>supportY+.015){group.userData.vy=(group.userData.vy||0)-18*delta;group.position.y+=group.userData.vy*delta;if(group.position.y<=supportY){group.position.y=supportY;group.userData.vy=0;record.y=supportY;}}
    else if(group.position.y<supportY-.015){group.position.y=supportY;group.userData.vy=0;record.y=supportY;}
  }
}
function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  if (started && player) {
    // Entrada nueva: el joystick da un vector 360°. La cámara define el frente;
    // por eso, al mantener el joystick arriba y arrastrar la vista a la derecha,
    // el personaje sigue avanzando y curva su trayectoria con la cámara.
    let forward = cameraLocked ? 0 : (-moveStick.y + (keys.has("w") ? 1 : 0) - (keys.has("s") ? 1 : 0)
      + (keys.has("arrowup") ? 1 : 0) - (keys.has("arrowdown") ? 1 : 0));
    let strafe = cameraLocked ? 0 : (moveStick.x + (keys.has("d") ? 1 : 0) - (keys.has("a") ? 1 : 0)
      + (keys.has("arrowright") ? 1 : 0) - (keys.has("arrowleft") ? 1 : 0));
    const inputLength = Math.hypot(forward, strafe);
    if (inputLength > 1) { forward /= inputLength; strafe /= inputLength; }
    const speed = 7.2;
    const cameraYaw = yaw;
    const dx = (-Math.sin(cameraYaw) * forward + Math.cos(cameraYaw) * strafe) * speed * delta;
    const dz = (-Math.cos(cameraYaw) * forward - Math.sin(cameraYaw) * strafe) * speed * delta;
    const nextX = THREE.MathUtils.clamp(player.position.x + dx, -worldSize / 2 + 4, worldSize / 2 - 4);
    const nextZ = THREE.MathUtils.clamp(player.position.z + dz, -worldSize / 2 + 4, worldSize / 2 - 4);
    const collides = (x,z) => {
      const feet = terrainHeight(x,z), body = new THREE.Box3(
        new THREE.Vector3(x-0.38, feet+0.12, z-0.38),
        new THREE.Vector3(x+0.38, feet+2.55, z+0.38));
      return buildGroups.some(g => {
        const k=g.userData.buildRecord?.kind;
        if(!["wall","door","window","block"].includes(k)) return false;
        const bounds=new THREE.Box3().setFromObject(g);
        // Los bloques elevados no deben aprisionar al jugador al construir o volver a explorar.
        if (k === "block") {
          const lowerBody = new THREE.Box3(
            new THREE.Vector3(x-0.38, feet+0.12, z-0.38),
            new THREE.Vector3(x+0.38, feet+1.42, z+0.38)
          );
          return lowerBody.intersectsBox(bounds);
        }
        return body.intersectsBox(bounds);
      });
    };
    if (!collides(nextX, player.position.z)) player.position.x = nextX;
    if (!collides(player.position.x, nextZ)) player.position.z = nextZ;
    const groundY=terrainHeight(player.position.x,player.position.z);playerVerticalVelocity-=20*delta;player.position.y+=playerVerticalVelocity*delta;if(player.position.y<=groundY){player.position.y=groundY;playerVerticalVelocity=0;playerGrounded=true;}else playerGrounded=false;
    const moving = inputLength > 0.08;
    if (player.userData.isRiggedAvatar) {
      player.userData.mixer?.update(delta);
      setRiggedAvatarMotion(player, moving);
    }
    // La espalda y la mochila quedan siempre orientadas hacia la cámara.
    // El movimiento es independiente: caminar hacia atrás o de costado no da vuelta el avatar.
    const targetHeading = cameraLocked ? playerHeading : yaw;
    const angleDelta = Math.atan2(Math.sin(targetHeading - playerHeading), Math.cos(targetHeading - playerHeading));
    playerHeading += angleDelta * Math.min(1, delta * 12);
    player.userData.walkPhase = (player.userData.walkPhase || 0) + (moving ? delta * 10.5 : 0);
    const swing = moving ? Math.sin(player.userData.walkPhase) * 0.48 : 0;
    const stride = moving ? Math.cos(player.userData.walkPhase * 2) : 0;
    const rig = player.userData.rig;
    if (rig) {
      rig.position.y = moving ? Math.abs(stride) * 0.055 : 0;
      rig.rotation.z = moving ? Math.sin(player.userData.walkPhase) * 0.035 : 0;
      rig.rotation.x = moving ? -0.035 : 0;
    }
    player.userData.legs?.forEach((leg,i) => { leg.rotation.x = i===0 ? swing : -swing; });
    player.userData.arms?.forEach((arm,i) => { arm.rotation.x = i===0 ? -swing*0.82 : swing*0.82; arm.rotation.z = i===0 ? -0.035 : 0.035; });
    // La cámara nunca modifica la orientación del personaje.
    player.rotation.y = playerHeading;
  }
  const focus = player || {position:new THREE.Vector3(0,terrainHeight(0,0),0)};
  const firstPerson = player && cameraMode === "first";
  for(const group of buildGroups){if(group.userData.animalMixer)group.userData.animalMixer.update(delta);if(group.userData.water){const water=group.children.find(child=>child.userData.water);if(water){const pos=water.geometry.attributes.position,base=water.userData.basePositions,t=clock.elapsedTime;for(let i=0;i<pos.count;i++){const x=base[i*3],z=base[i*3+1];pos.setZ(i,Math.sin(x*4+t*1.8)*.012+Math.cos(z*4+t*1.4)*.012);}pos.needsUpdate=true;water.geometry.computeVertexNormals();}}}
  if (player) player.visible = !firstPerson;
  if (viewHands) viewHands.visible = !!firstPerson && buildMode && buildTool !== "erase";
  const distance = cameraMode === "second" ? cameraDistance : (buildMode ? cameraDistance : 5.4);
  const orbitDistance = Math.cos(pitch) * distance;
  // La cámara conserva su ángulo relativo y acompaña el rumbo del personaje.
  const cameraYaw = yaw;
  const targetX = focus.position.x + Math.sin(cameraYaw) * orbitDistance;
  const targetZ = focus.position.z + Math.cos(cameraYaw) * orbitDistance;
  const targetY = focus.position.y + 1.8 + Math.sin(pitch) * distance;
  if (firstPerson) {
    const eye = new THREE.Vector3(player.position.x,player.position.y+1.72,player.position.z);
    camera.position.lerp(eye,1-Math.pow(0.001,delta));
    const cameraYaw = yaw;
    camera.lookAt(eye.x-Math.sin(cameraYaw)*10,eye.y+pitch*8,eye.z-Math.cos(cameraYaw)*10);
  } else {
    camera.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), 1 - Math.pow(0.001, delta));
    camera.lookAt(focus.position.x, focus.position.y + 1.25, focus.position.z);
  }
  renderer.render(scene, camera);
}

try {
  init();
  loadFreeNatureAssets();
} catch (error) {
  console.error(error);
  loading.innerHTML = '<div class="loading-mark">ILOX</div><p>No se pudo iniciar el mundo 3D. Revisá la conexión y volvé a intentar.</p>';
}
