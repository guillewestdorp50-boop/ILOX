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
const quickSaveButton = document.querySelector("#quick-save");
let moveStickPointer = null;
let playerVerticalVelocity = 0, playerGrounded = true;
let moveStick = { x: 0, y: 0 };

let scene, camera, renderer, player, clock, terrainMesh;
let buildMode = false, buildTool = "block", buildRotation = 0, firstPersonBuild = false, viewHands = null;
let selectedBlockColor = 0xff3030;
let buildGuide = null, buildPointer = null;
const buildRecords = [], buildGroups = [];
let started = false;
let yaw = 0, playerHeading = 0, pitch = 0;
let cameraMode = "third", cameraLocked = false;
// Nueva movilidad estilo Free Fire: joystick izquierdo y cámara libre independiente.


const polyHavenLoader = new GLTFLoader();
const avatarModelLoader = new GLTFLoader();
const animalModelLoader = new GLTFLoader();
const ANIMAL_MODELS = {sheep:"https://gobkit.com/freebies/animal005/Lamb.glb",cow:"https://gobkit.com/freebies/animal005/HolsteinCow.glb",horse:"https://gobkit.com/freebies/animal012/PalominoHorse.glb",chicken:"https://gobkit.com/freebies/animal009/BrahmaChicken.glb",pig:"https://gobkit.com/freebies/animal005/Pig.glb",goat:"https://gobkit.com/freebies/animalB/Goat.glb"};
const animalAssetPromises = new Map();
// Modelo humanoide GLB con malla skinned, texturas PBR y clips Idle/Walk/Run.
// Recurso de ejemplo oficial de Three.js (licencia MIT).
const RIGGED_AVATAR_URL = "https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Soldier.glb";
const HUMAN_AVATAR_MODELS = {
  man:["https://gobkit.com/freebies/human001/StoreManager.glb","https://gobkit.com/freebies/human002/ItEngineer.glb","https://gobkit.com/freebies/human015/OfficeWorker.glb","https://gobkit.com/freebies/human002/Accountant.glb","https://gobkit.com/freebies/human002/CompanyCeo.glb","https://gobkit.com/freebies/human002/OfficeManager.glb","https://gobkit.com/freebies/human002/SecurityGuard.glb","https://gobkit.com/freebies/human015/DeliveryRider.glb","https://gobkit.com/freebies/human015/HeadChef.glb","https://gobkit.com/freebies/human015/PoliceOfficer.glb","https://gobkit.com/freebies/human015/Student.glb","https://gobkit.com/freebies/human020/SiteForeman.glb"],
  woman:["https://gobkit.com/freebies/human001/OfficeLady.glb","https://gobkit.com/freebies/human002/Receptionist.glb","https://gobkit.com/freebies/human005/ChiefSurgeon.glb","https://gobkit.com/freebies/human005/WardNurse.glb","https://gobkit.com/freebies/human005/Pharmacist.glb","https://gobkit.com/freebies/human005/Paramedic.glb","https://gobkit.com/freebies/human001/GrandmaShopper.glb","https://gobkit.com/freebies/human001/FoodCourier.glb","https://gobkit.com/freebies/human008/CabinAttendant.glb","https://gobkit.com/freebies/human007/FireChief.glb"],
  boy:["https://gobkit.com/freebies/human019/Schoolboy.glb","https://gobkit.com/freebies/human001/Schoolkid.glb"],
  girl:["https://gobkit.com/freebies/human019/Schoolgirl.glb"]
};
const HUMAN_AVATAR_LABELS = {
  man:["Gerente de tienda","Ingeniero IT","Trabajador de oficina","Contador","Director ejecutivo","Gerente de oficina","Guardia de seguridad","Repartidor","Chef","Policía","Estudiante","Jefe de obra"],
  woman:["Oficinista","Recepcionista","Cirujana","Enfermera","Farmacéutica","Paramédica","Abuela","Repartidora","Tripulante de cabina","Jefa de bomberos"],
  boy:["Escolar","Estudiante"],girl:["Escolar"]
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
const BLOCK_SIZE=1.5,FOUNDATION_SIZE=6,PLAYER_HEIGHT=2.05;
function foundationAt(x,z){for(const r of buildRecords){if(r.kind!=="platea"&&r.kind!=="pool")continue;const w=r.kind==="pool"?(r.poolWidth||6):FOUNDATION_SIZE,d=r.kind==="pool"?(r.poolDepth||6):FOUNDATION_SIZE,a=r.rotation||0,dx=x-r.x,dz=z-r.z,lx=dx*Math.cos(a)-dz*Math.sin(a),lz=dx*Math.sin(a)+dz*Math.cos(a);if(Math.abs(lx)<=w/2&&Math.abs(lz)<=d/2)return r;}return null;}
function supportHeightAt(x,z,feet=Infinity,ignore=null){const f=foundationAt(x,z);let top=f?(f.kind==="pool"&&Math.abs(x-f.x)<(f.poolWidth||6)/2-.3&&Math.abs(z-f.z)<(f.poolDepth||6)/2-.3?f.y-2:f.y+(f.kind==="platea"?.3:.22)):terrainHeight(x,z);for(const g of buildGroups){if(g===ignore)continue;const kind=g.userData.buildRecord?.kind;if(!kind||kind==="water")continue;g.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(g);if(x>=b.min.x-.02&&x<=b.max.x+.02&&z>=b.min.z-.02&&z<=b.max.z+.02&&b.max.y<=feet+.28&&b.max.y>top)top=b.max.y;}return top;}
function refreshTerrainSurface(){if(!terrainMesh)return;const a=terrainMesh.geometry.attributes.position;for(let i=0;i<a.count;i++){const x=a.getX(i),z=a.getZ(i),f=foundationAt(x,z);a.setY(i,f?Math.min(terrainHeight(x,z),f.y-.36):terrainHeight(x,z));}a.needsUpdate=true;terrainMesh.geometry.computeVertexNormals();}

function terrainHeight(x, z) {
  // Planicie uniforme: misma cota desde el centro hasta los cuatro bordes del mapa.
  return 0;
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
  mesh.receiveShadow = true; scene.add(mesh); terrainMesh = mesh; refreshTerrainSurface();
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
    if (avatarType !== "soldier") model.rotation.y = Math.PI;
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
  // Escenario limpio: sin montañas, árboles, plantas ni rocas decorativas atravesables.
  // El terreno queda libre para construir; la naturaleza se agrega desde las herramientas
  // del jugador, con las colisiones del sistema de construcción.
  makeTerrain();
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
    buildPointer={x:e.clientX,y:e.clientY};
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
    buildPointer={x:e.clientX,y:e.clientY};
    if(activePointers.has(e.pointerId)) activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(activePointers.size>=2){const p=[...activePointers.values()];const d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);cameraDistance=THREE.MathUtils.clamp(pinchStartZoom*(pinchStartDistance/Math.max(1,d)),1.2,40);return;}
    if (lookPointer !== e.pointerId || !started) return;
    const dx = e.clientX - lastLookX;
    const dy = e.clientY - lastLookY;
    if (Math.hypot(e.clientX-lookStartX,e.clientY-lookStartY)>7) pointerDragged = true;
    lastLookX = e.clientX;
    lastLookY = e.clientY;
    // Cámara libre compartida por primera, segunda, tercera persona y bloqueo.
    // Arrastrar el dedo hacia arriba mira al cielo; hacia abajo, al suelo.
    // Giro horizontal completo y vertical casi de cenit a nadir, en las tres vistas.
    yaw -= dx * 0.0048;
    pitch = THREE.MathUtils.clamp(pitch - dy * 0.0048, -1.565, 1.565);
  });
  game.addEventListener("pointerup", e => {
    activePointers.delete(e.pointerId);
    if (lookPointer !== e.pointerId) return;
    if (started && !pointerDragged && activePointers.size===0) {
      if(buildMode)placeBuildAtPointer(e);
      else toggleDoorAtPointer(e);
    }
    lookPointer = activePointers.size ? [...activePointers.keys()][0] : null;
    if(lookPointer!==null){const p=activePointers.get(lookPointer);lastLookX=p.x;lastLookY=p.y;pointerDragged=true;}
  });
  game.addEventListener("pointercancel", e => { activePointers.delete(e.pointerId); if (lookPointer === e.pointerId) lookPointer = activePointers.size ? [...activePointers.keys()][0] : null; });
  game.addEventListener("wheel", e => {
    if (!started) return;
    e.preventDefault();
    cameraDistance = THREE.MathUtils.clamp(cameraDistance + Math.sign(e.deltaY)*0.9, 1.2, 40);
  }, {passive:false});

  startButton.addEventListener("click", () => {
    welcome.classList.add("hidden");
    avatarSelect.classList.remove("hidden");
  });
  const avatarCatalog = [
    ["man","👨","Hombre 3D",12],["woman","👩","Mujer 3D",10],["boy","👦","Niño 3D",2],["girl","👧","Niña 3D",1],
    ["soldier","🧍","Humano original",1],["explorer","🧑‍🦰","Explorador",10],["builder","👷","Constructor",10],["builderwoman","👩‍🔧","Constructora",10],
    ["astronaut","🧑‍🚀","Astronauta",8],["robot","🤖","Robot",8],["elf","🧝","Elfo",7],
    ["knight","🛡️","Caballero",7],["ninja","🥷","Ninja",7],["mage","🧙","Mago",7]
  ];
  const avatarGrid = document.querySelector(".avatar-options");
  avatarGrid.innerHTML = "";
  const humanHeading=document.createElement("div");
  humanHeading.className="avatar-section-title";
  humanHeading.textContent="HUMANOS 3D REALISTAS · ANIMADOS";
  avatarGrid.appendChild(humanHeading);
  let firstAvatar = true;
  avatarCatalog.forEach(([type,emoji,label,count]) => {
    if(type==="soldier"){
      const otherHeading=document.createElement("div");
      otherHeading.className="avatar-section-title";
      otherHeading.textContent="FANTASÍA Y PERSONAJES CLÁSICOS";
      avatarGrid.appendChild(otherHeading);
    }
    for (let variant=0; variant<count; variant++) {
      const option=document.createElement("button");
      const human=!!HUMAN_AVATAR_MODELS[type];
      const displayName=HUMAN_AVATAR_LABELS[type]?.[variant] || label+(count>1?" "+(variant+1):"");
      option.className="avatar-option"+(human?" human-avatar":"")+(firstAvatar?" selected":"");
      option.dataset.avatar=type+":"+variant;
      option.innerHTML='<span class="avatar-emoji">'+emoji+'</span><strong>'+displayName+'</strong><small>'+(human?"MODELO HUMANO 3D · ANIMADO":"Modelo "+String(variant+1).padStart(2,"0"))+'</small>';
      avatarGrid.appendChild(option);firstAvatar=false;
    }
  });
  selectedAvatar = "man:0";
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
    hint.textContent = "";
    loadBuilds();
    showToast("¡Tu mundo, tus reglas!");
  });
  const applyCameraMode = mode => {
    if (cameraLocked && mode === "first") mode = "second";
    cameraMode = mode;
    firstPersonBuild = mode === "first";
    cameraDistance = mode === "first" ? 0.08 : mode === "second" ? 3.0 : 5.4;
    // Conservamos el ángulo orbital al cambiar de cámara: las tres vistas
    // y el bloqueo comparten exactamente el mismo control libre.
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
    structure:[["platea","▰","PLATEA"],["pool-small","🏊","PILETA CHICA"],["pool-large","🏊","PILETA GRANDE"],["pool-municipal","🏊","PILETA MUNICIPAL"],["floor","▰","PISO"],["wall","▥","PARED"],["roof","🏠","TECHO"],["stairs","🪜","ESCALERA"],["door","🚪","PUERTA"],["window","▣","VENTANA"],["gate","🚧","PORTÓN"],["fence","🪵","TRANQUERA"],["erase","⌫","BORRAR"],["rotate","↻","GIRAR"]],
    furniture:[["chair","🪑","SILLA"],["table","🪵","MESA"],["bed","🛏️","CAMA"],["sofa","🛋️","SOFÁ"],["lamp","💡","LÁMPARA"],["erase","⌫","BORRAR"]],
    farm:[["pen","🐑","CORRAL"],["sheep","🐑","OVEJA"],["cow","🐄","VACA"],["horse","🐎","CABALLO"],["chicken","🐔","GALLINA"],["pig","🐖","CHANCHO"],["goat","🐐","CABRA"],["erase","⌫","BORRAR"],["rotate","↻","GIRAR"]]
  };
  function renderBuildTools(category="block"){
    buildToolsHost.innerHTML="";
    for(const [kind,emoji,label] of (toolCatalog[category]||toolCatalog.block)){
      const button=document.createElement("button");button.type="button";button.className="build-tool"+(kind===buildTool?" selected":"");button.dataset.tool=kind;button.innerHTML=emoji+"<small>"+label+"</small>";
      button.addEventListener("click",()=>{
        if(kind==="rotate"){buildRotation=(buildRotation+Math.PI/2)%(Math.PI*2);showToast("Pieza girada");return;}
        buildTool=kind;buildToolsHost.querySelectorAll(".build-tool").forEach(item=>item.classList.toggle("selected",item===button));
        document.querySelector("#build-help").textContent=kind==="erase"?"Tocá una construcción para eliminar esa pieza.":kind==="door"?"Puerta modular: 1 bloque de ancho por 2 de alto; el marco coincide con la segunda fila.":kind==="water"?"Llená la pileta completa con agua.":kind==="platea"?"La platea aplana el terreno y se alinea con las vecinas.":kind.startsWith("pool-")?"Pileta con base propia y 2 metros de profundidad.":"Primero colocá una PLATEA; después construí sobre ella.";
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
    for(const group of buildGroups)scene.remove(group);buildGroups.length=0;buildRecords.length=0;refreshTerrainSurface();persistBuilds();
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
  quickSaveButton?.addEventListener("click",()=>{
    if(persistBuilds()){
      quickSaveButton.classList.add("saved");
      quickSaveButton.textContent="✓";
      showToast("Guardado rápido: tu construcción quedó guardada en este dispositivo.");
      window.setTimeout(()=>{quickSaveButton.classList.remove("saved");quickSaveButton.textContent="💾";},1100);
    }
  });
  document.querySelector("#fullscreen").addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) await game.requestFullscreen();
      else await document.exitFullscreen();
    } catch { showToast("La pantalla completa no está disponible en este navegador."); }
  });
}


function createBuildPiece(record, options = {}) {
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
  if(kind==="platea"){const slab=mat(0xb8b9b3,.88);box(6,.3,6,slab,0,.15,0);group.userData.isFoundation=true;group.userData.buildHeight=.3;}
  if(kind==="pool"){const w=record.poolWidth||6,d=record.poolDepth||6,depth=2,pf=mat(0x8ca6a4,.82),pw=mat(0xe7e4d8,.78),rim=mat(0xf4f0e4,.72);box(w,.3,d,pf,0,-depth-.37,0);box(w-.36,.22,d-.36,pf,0,-depth-.11,0);box(.28,depth+.22,d,pw,-w/2+.14,-depth/2+.11,0);box(.28,depth+.22,d,pw,w/2-.14,-depth/2+.11,0);box(w-.28,depth+.22,.28,pw,0,-depth/2+.11,-d/2+.14);box(w-.28,depth+.22,.28,pw,0,-depth/2+.11,d/2-.14);box(w,.22,.34,rim,0,.11,-d/2+.17);box(w,.22,.34,rim,0,.11,d/2-.17);box(.34,.22,d-.34,rim,-w/2+.17,.11,0);box(.34,.22,d-.34,rim,w/2-.17,.11,0);group.userData.isPool=true;group.userData.isFoundation=true;group.userData.buildHeight=.22;}
  if(kind==="floor")box(1.5,.16,1.5,wood,0,.08,0);
  if(kind==="roof"){const roofPiece=box(1.5,.16,1.5,mat(0x9a5545),0,1.42,0);roofPiece.rotation.z=-.12;}
  if(kind==="wall")box(1.5,1.5,.16,wall,0,.75,0);
  if(kind==="door"){
    const doorWidth=1.5,doorHeight=3.0,post=.10,frameDepth=.16,leafWidth=doorWidth-post*2-.08,leafHeight=doorHeight-.16;
    // Marco modular: una celda exacta de ancho y dos alturas de bloque.
    box(post,doorHeight,frameDepth,wall,-doorWidth/2+post/2,doorHeight/2,0);
    box(post,doorHeight,frameDepth,wall,doorWidth/2-post/2,doorHeight/2,0);
    box(doorWidth,.12,frameDepth,wall,0,doorHeight-.06,0);
    const hinge=new THREE.Group();hinge.position.set(-doorWidth/2+post,.08,.015);group.add(hinge);
    const leaf=new THREE.Mesh(new THREE.BoxGeometry(leafWidth,leafHeight,.055),wood);
    leaf.position.set(leafWidth/2,leafHeight/2,0);leaf.castShadow=true;leaf.receiveShadow=true;hinge.add(leaf);
    const rail=new THREE.Mesh(new THREE.BoxGeometry(leafWidth,.055,.07),darkWood);rail.position.set(leafWidth/2,.32,.005);hinge.add(rail);
    const knob=new THREE.Mesh(new THREE.SphereGeometry(.055,14,12),metal);knob.position.set(leafWidth-.09,1.42,.055);hinge.add(knob);
    for(const yy of [.16,doorHeight-.24]){const h=new THREE.Mesh(new THREE.BoxGeometry(.045,.12,.19),metal);h.position.set(.015,yy,0);hinge.add(h);}
    group.userData.doorLeafPivot=hinge;group.userData.buildHeight=doorHeight;
    if(record.open)hinge.rotation.y=Math.PI/2;
  }
  if(kind==="window"){box(.18,1.5,.16,wall,-.66,.75,0);box(.18,1.5,.16,wall,.66,.75,0);box(1.5,.18,.16,wall,0,1.41,0);box(1.5,.18,.16,wall,0,.09,0);box(1.25,1.15,.045,glass,0,.75,-.04);box(.06,1.2,.08,wood,0,.75,-.08);box(1.3,.06,.08,wood,0,.75,-.08);}
  if(kind==="stairs"){for(let i=0;i<5;i++)box(1.5,.3,.3,wood,0,.15+i*.3,-.6+i*.3);}
  if(kind==="tree"){cyl(0,.68,0,.12,.2,1.35,darkWood);for(let i=0;i<10;i++){const ang=i*2.399;ball(Math.cos(ang)*.28,1.3+(i%3)*.22,Math.sin(ang)*.28,.48,.56,.48,mat([0x3e713d,0x4d8245,0x608b4b][i%3]));}}
  if(kind==="rock"){const o=new THREE.Mesh(new THREE.DodecahedronGeometry(.68,1),mat(0x85877e));o.position.y=.48;o.scale.set(1.1,.7,.9);o.rotation.set(.2,.4,.1);o.castShadow=true;group.add(o);}
  if(kind==="water"){const w=record.poolWidth||6,d=record.poolDepth||6,geo=new THREE.PlaneGeometry(w-.62,d-.62,32,32),water=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0x3dadd0,roughness:.16,metalness:.12,transparent:true,opacity:.84,side:THREE.DoubleSide}));water.rotation.x=-Math.PI/2;water.userData.water=true;water.userData.basePositions=geo.attributes.position.array.slice();group.add(water);group.userData.water=true;group.userData.buildHeight=.02;}
  if(kind==="chair"){box(.95,.12,.9,wood,0,.72,0);box(.95,.85,.12,wood,0,1.15,-.39);for(const sx of [-.38,.38])for(const sz of [-.32,.32])box(.12,.68,.12,darkWood,sx,.34,sz);}
  if(kind==="table"){box(1.4,.14,1.2,wood,0,.92,0);for(const sx of [-.55,.55])for(const sz of [-.42,.42])box(.12,.9,.12,darkWood,sx,.45,sz);}
  if(kind==="bed"){box(1.4,.22,1.5,darkWood,0,.38,0);box(1.32,.2,1.32,mat(0xe4dfd0),0,.58,0);box(.55,.18,.35,mat(0xf4eee0),-.36,.76,-.45);box(1.4,.95,.12,wood,0,.55,-.7);}
  if(kind==="sofa"){box(1.5,.42,.72,mat(0x547a74),0,.45,0);box(1.5,.72,.16,mat(0x547a74),0,.83,-.28);for(const sx of [-.68,.68])box(.16,.62,.72,mat(0x42635d),sx,.67,0);}
  if(kind==="lamp"){cyl(0,.4,0,.07,.09,.8,metal);ball(0,.95,0,.28,.22,.28,mat(0xffd98a,.25));}
  if(["gate","fence","pen"].includes(kind)){for(const sx of [-.75,.75])box(.12,1.25,.12,darkWood,sx,.625,0);for(const yy of [.35,.95])box(1.5,.12,.1,wood,0,yy,0);if(kind!=="fence")for(let i=-2;i<=2;i++)box(.07,.75,.09,wood,i*.28,.62,0);}
  group.position.set(x,baseY,z);group.rotation.y=rotation;group.userData.buildRecord=record;group.userData.vy=0;group.userData.buildHeight=group.userData.buildHeight||new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3()).y;scene.add(group);buildGroups.push(group);
  if(kind==="platea"||kind==="pool")refreshTerrainSurface();
  if(["sheep","cow","horse","chicken","pig","goat"].includes(kind)) loadAnimalModel(group,kind,options.notify===true);
  return group;
}
async function loadAnimalModel(group,kind,notify=false){
  const url=ANIMAL_MODELS[kind];if(!url)return;
  try{
    let pending=animalAssetPromises.get(url);
    if(!pending){pending=animalModelLoader.loadAsync(url);animalAssetPromises.set(url,pending);}
    let gltf;
    try{gltf=await pending;}catch(error){animalAssetPromises.delete(url);throw error;}
    if(group.parent!==scene)return;
    const model=cloneSkeleton(gltf.scene);
    model.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(model),size=new THREE.Vector3();bounds.getSize(size);
    let meshCount=0;model.traverse(o=>{if(o.isMesh)meshCount++;});
    if(!meshCount||!Number.isFinite(size.y)||size.y<.01)throw new Error("El GLB no contiene una malla 3D visible.");
    const targetHeight={sheep:.95,cow:1.55,horse:1.65,chicken:.55,pig:.9,goat:.95}[kind]||1;
    const scale=targetHeight/size.y;
    model.scale.setScalar(scale);
    model.position.y=-bounds.min.y*scale;
    model.visible=true;
    model.traverse(o=>{if(o.isMesh){o.visible=true;o.castShadow=true;o.receiveShadow=true;if(o.material){const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){m.visible=true;m.needsUpdate=true;}}}});
    group.add(model);group.updateMatrixWorld(true);
    const mixer=new THREE.AnimationMixer(model),actions={};
    for(const clip of gltf.animations){const name=clip.name.toLowerCase();if(name.includes("idle"))actions.idle=mixer.clipAction(clip);else if(name.includes("walk"))actions.walk=mixer.clipAction(clip);else if(name.includes("run"))actions.run=mixer.clipAction(clip);}
    const idle=actions.idle||(gltf.animations[0]&&mixer.clipAction(gltf.animations[0]));if(idle){idle.play();actions.current=idle;}
    group.userData.animalMixer=mixer;group.userData.animalActions=actions;group.userData.buildHeight=targetHeight;group.userData.roamOrigin=group.position.clone();group.userData.roamTarget=group.position.clone().add(new THREE.Vector3((Math.random()-.5)*5,0,(Math.random()-.5)*5));group.userData.roamTimer=2+Math.random()*3;
    if(notify)showToast("Animal 3D cargado y visible");
  }catch(error){
    console.error("ILOX: falló la carga del animal 3D",kind,url,error);
    const record=group.userData.buildRecord,recordIndex=buildRecords.indexOf(record);
    if(recordIndex>=0)buildRecords.splice(recordIndex,1);
    scene.remove(group);
    const groupIndex=buildGroups.indexOf(group);if(groupIndex>=0)buildGroups.splice(groupIndex,1);
    persistBuilds();
    if(notify)showToast("No se pudo cargar el animal 3D. No quedó colocado.");
  }
}
function persistBuilds() {
  try { localStorage.setItem("ilox-builds-v1",JSON.stringify(buildRecords)); return true; }
  catch(error){ showToast("No se pudo guardar el mundo en este dispositivo."); return false; }
}
function loadBuilds() {
  if(buildRecords.length) return;
  try {
    const saved=JSON.parse(localStorage.getItem("ilox-builds-v1")||"[]");
    if(Array.isArray(saved)) saved.slice(0,1200).forEach(record=>{if(record&&["block","brick","platea","floor","wall","door","window","roof","stairs","pool","tree","rock","water","chair","table","bed","sofa","lamp","gate","fence","pen","sheep","cow","horse","chicken","pig","goat"].includes(record.kind)&&Number.isFinite(record.x)&&Number.isFinite(record.z)){const heights={block:1.5,brick:1.5,platea:.3,wall:1.5,door:3.0,window:1.5,roof:1.5,stairs:1.5,pool:.22,floor:.16,tree:2.5,rock:.9,chair:1.5,table:1.05,bed:1.1,sofa:1.2,lamp:1.2,gate:1.25,fence:1.25,pen:1.25,sheep:.6,cow:.95,horse:1.2,chicken:.4,pig:.62,goat:.62};const supported=buildRecords.some(lower=>Math.abs(lower.x-record.x)<.2&&Math.abs(lower.z-record.z)<.2&&Math.abs((lower.y+(heights[lower.kind]||1.5))-record.y)<.24);if(!supported&&!["platea","pool"].includes(record.kind)&&Math.abs(record.y-terrainHeight(record.x,record.z))>.12)record.y=terrainHeight(record.x,record.z);buildRecords.push(record);createBuildPiece(record);}});
  } catch(error){ console.warn("ILOX: no se pudieron recuperar las construcciones",error); }
}
function buildFootprint(kind){
  const sizes={block:[1.5,1.5],brick:[1.5,1.5],floor:[1.5,1.5],roof:[1.5,1.5],wall:[1.5,.16],door:[1.5,.16],window:[1.5,.16],stairs:[1.5,1.5],chair:[.95,.9],table:[1.4,1.2],bed:[1.5,1.5],sofa:[1.5,.72],lamp:[.56,.56],gate:[1.5,.12],fence:[1.5,.12],pen:[1.5,.12],tree:[1.2,1.2],rock:[1.5,1.5],sheep:[1.2,1.2],cow:[1.5,1.5],horse:[1.8,1.5],chicken:[.8,.8],pig:[1.1,1.1],goat:[1.1,1.1]};
  return sizes[kind]||[1.5,1.5];
}
function foundationContainsFootprint(x,z,kind,rotation=0){
  const f=foundationAt(x,z);if(!f||f.kind!=="platea")return false;
  const [w,d]=buildFootprint(kind),c=Math.cos(rotation),s=Math.sin(rotation);
  for(const [dx,dz] of [[-w/2,-d/2],[-w/2,d/2],[w/2,-d/2],[w/2,d/2]]){
    const px=x+dx*c-dz*s,pz=z+dx*s+dz*c;
    const same=foundationAt(px,pz);if(same!==f)return false;
  }
  return true;
}

function autoSnapBuildPlacement(x,z,kind,rotation=0){
  const snapKinds=new Set(["block","brick","wall","floor","roof","window","stairs","door"]);
  if(!snapKinds.has(kind))return {x,z,rotation,snapped:false};
  const [nw,nd]=buildFootprint(kind),nc=Math.cos(rotation),ns=Math.sin(rotation);
  const newU={x:nc,z:ns},newV={x:-ns,z:nc};
  const candidates=[];
  for(const other of buildRecords){
    if(!snapKinds.has(other.kind)||Math.abs((other.y||0)-(supportHeightAt(x,z)-1.5))>2.2)continue;
    const [ow,od]=buildFootprint(other.kind),a=other.rotation||0,oc=Math.cos(a),os=Math.sin(a);
    const ou={x:oc,z:os},ov={x:-os,z:oc};
    for(const axis of [ou,ov]){
      for(const sign of [-1,1]){
        const normal={x:axis.x*sign,z:axis.z*sign},tangent={x:-normal.z,z:normal.x};
        const otherHalfN=(ow/2)*Math.abs(normal.x*ou.x+normal.z*ou.z)+(od/2)*Math.abs(normal.x*ov.x+normal.z*ov.z);
        const otherHalfT=(ow/2)*Math.abs(tangent.x*ou.x+tangent.z*ou.z)+(od/2)*Math.abs(tangent.x*ov.x+tangent.z*ov.z);
        let candidateRotation=rotation;
        if(kind==="wall"||kind==="door"){
          const longAxis=other.kind==="wall"?ou:tangent;
          candidateRotation=Math.atan2(longAxis.z,longAxis.x);
        }
        const cc=Math.cos(candidateRotation),ss=Math.sin(candidateRotation),cu={x:cc,z:ss},cv={x:-ss,z:cc};
        const newHalfN=(nw/2)*Math.abs(normal.x*cu.x+normal.z*cu.z)+(nd/2)*Math.abs(normal.x*cv.x+normal.z*cv.z);
        const newHalfT=(nw/2)*Math.abs(tangent.x*cu.x+tangent.z*cu.z)+(nd/2)*Math.abs(tangent.x*cv.x+tangent.z*cv.z);
        const available=otherHalfT-newHalfT;
        if(available<-.015)continue;
        const along=THREE.MathUtils.clamp((x-other.x)*tangent.x+(z-other.z)*tangent.z,-available,available);
        const cx=other.x+normal.x*(otherHalfN+newHalfN)+tangent.x*along;
        const cz=other.z+normal.z*(otherHalfN+newHalfN)+tangent.z*along;
        const distance=Math.hypot(cx-x,cz-z);
        if(distance>1.25)continue;
        if(!foundationContainsFootprint(cx,cz,kind,candidateRotation))continue;
        candidates.push({x:cx,z:cz,rotation:candidateRotation,distance,snapped:true});
      }
    }
  }
  candidates.sort((a,b)=>a.distance-b.distance);
  return candidates[0]||{x,z,rotation,snapped:false};
}

function findDoorOpening(x,z){
  const supports=buildRecords.filter(r=>["wall","block","brick"].includes(r.kind));
  let best=null,bestDistance=2.35;
  const halfSize=r=>r.kind==="wall"?[.75,.08]:[.75,.75];
  const halfAlong=(r,ax,az)=>{const [hx,hz]=halfSize(r),a=r.rotation||0;return hx*Math.abs(Math.cos(a)*ax-Math.sin(a)*az)+hz*Math.abs(Math.sin(a)*ax+Math.cos(a)*az);};
  for(let i=0;i<supports.length;i++)for(let j=i+1;j<supports.length;j++){
    const a=supports[i],b=supports[j],dx=b.x-a.x,dz=b.z-a.z,dist=Math.hypot(dx,dz);
    if(dist<.1||Math.abs((a.y||0)-(b.y||0))>.38)continue;
    const ax=dx/dist,az=dz/dist;
    if(Math.min(Math.abs(ax),Math.abs(az))>.18)continue;
    if(a.kind==="wall"&&Math.abs(Math.cos((a.rotation||0))*ax-Math.sin((a.rotation||0))*az)<.92)continue;
    if(b.kind==="wall"&&Math.abs(Math.cos((b.rotation||0))*ax-Math.sin((b.rotation||0))*az)<.92)continue;
    const gap=dist-halfAlong(a,ax,az)-halfAlong(b,ax,az);
    if(gap<.82||gap>1.68)continue;
    const mx=(a.x+b.x)/2,mz=(a.z+b.z)/2,near=Math.hypot(mx-x,mz-z);
    if(near>bestDistance)continue;
    const rotation=Math.abs(ax)>=Math.abs(az)?(ax>=0?0:Math.PI):(az>=0?Math.PI/2:-Math.PI/2);
    bestDistance=near;best={x:mx,z:mz,rotation,width:gap,supportA:{x:a.x,z:a.z},supportB:{x:b.x,z:b.z},baseY:((a.y||0)+(b.y||0))/2};
  }
  return best;
}

function updateBuildPlacementGuide(){
  if(!scene||!renderer||!camera||!buildMode||buildTool==="erase"||!buildPointer){if(buildGuide)buildGuide.visible=false;return;}
  const rect=renderer.domElement.getBoundingClientRect();
  if(buildPointer.x<rect.left||buildPointer.x>rect.right||buildPointer.y<rect.top||buildPointer.y>rect.bottom){if(buildGuide)buildGuide.visible=false;return;}
  const pointer=new THREE.Vector2((buildPointer.x-rect.left)/rect.width*2-1,-((buildPointer.y-rect.top)/rect.height)*2+1);
  const raycaster=new THREE.Raycaster();raycaster.setFromCamera(pointer,camera);
  const terrainHit=terrainMesh?raycaster.intersectObject(terrainMesh,false)[0]:null;
  const pieceHit=raycaster.intersectObjects(buildGroups,true)[0];
  if(!terrainHit&&!pieceHit){if(buildGuide)buildGuide.visible=false;return;}
  const onPiece=!!pieceHit&&(!terrainHit||pieceHit.distance<terrainHit.distance);
  const point=onPiece?pieceHit.point:terrainHit.point;
  let x=point.x,z=point.z;
  const poolTool=["pool-small","pool-large","pool-municipal"].includes(buildTool);
  if(buildTool==="platea"||buildTool==="water"||poolTool){x=Math.round(x/BLOCK_SIZE)*BLOCK_SIZE;z=Math.round(z/BLOCK_SIZE)*BLOCK_SIZE;}
  if(buildTool==="platea"){x=Math.round(x/6)*6;z=Math.round(z/6)*6;}
  if(onPiece&&buildTool!=="water"&&buildTool!=="platea"&&!poolTool&&pieceHit.face){
    const normal=pieceHit.object.localToWorld(pieceHit.face.normal.clone()).sub(pieceHit.object.getWorldPosition(new THREE.Vector3())).normalize();
    if(normal.y<.65){x=point.x+normal.x*.76;z=point.z+normal.z*.76;}
  }
  const snap=autoSnapBuildPlacement(x,z,buildTool,buildRotation);
  x=snap.x;z=snap.z;
  const guideRotation=snap.rotation;
  if(buildTool==="door"&&!snap.snapped){x=Math.round(x/BLOCK_SIZE)*BLOCK_SIZE;z=Math.round(z/BLOCK_SIZE)*BLOCK_SIZE;}
  const [w,d]=buildTool==="platea"?[6,6]:poolTool?[buildTool==="pool-municipal"?24:buildTool==="pool-large"?12:6,buildTool==="pool-municipal"?12:buildTool==="pool-large"?12:6]:buildFootprint(buildTool);
  if(snap.snapped)buildRotation=guideRotation;
  const valid=buildTool==="platea"||poolTool||buildTool==="water"||foundationContainsFootprint(x,z,buildTool,buildRotation);
  if(!buildGuide){
    const material=new THREE.LineBasicMaterial({color:0x22ee66,transparent:true,opacity:.98,depthTest:false});
    const geometry=new THREE.BufferGeometry();
    buildGuide=new THREE.LineLoop(geometry,material);buildGuide.renderOrder=999;buildGuide.frustumCulled=false;scene.add(buildGuide);
  }
  const c=Math.cos(guideRotation),sn=Math.sin(guideRotation),pts=[];
  for(const [dx,dz] of [[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]])pts.push(new THREE.Vector3(dx*c-dz*sn,0.035,dx*sn+dz*c));
  buildGuide.geometry.dispose();buildGuide.geometry=new THREE.BufferGeometry().setFromPoints(pts);
  buildGuide.position.set(x,buildTool==="platea"?terrainHeight(x,z)+.05:supportHeightAt(x,z)+.035,z);
  buildGuide.material.color.setHex(valid?0x22ee66:0xff3333);
  buildGuide.visible=true;
}

function placeBuildAtPointer(event){
  const rect=renderer.domElement.getBoundingClientRect(),pointer=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-((event.clientY-rect.top)/rect.height)*2+1),raycaster=new THREE.Raycaster();raycaster.setFromCamera(pointer,camera);
  if(buildTool==="erase"){const hits=raycaster.intersectObjects(buildGroups,true);if(!hits.length){showToast("Tocá una construcción para borrarla.");return;}let root=hits[0].object;while(root.parent&&root.parent!==scene)root=root.parent;const rec=root.userData.buildRecord,idx=buildRecords.indexOf(rec);if(idx>=0){buildRecords.splice(idx,1);scene.remove(root);const gi=buildGroups.indexOf(root);if(gi>=0)buildGroups.splice(gi,1);refreshTerrainSurface();persistBuilds();showToast("Pieza eliminada");}return;}
  if(!terrainMesh)return;const terrainHit=raycaster.intersectObject(terrainMesh,false)[0],pieceHits=raycaster.intersectObjects(buildGroups,true),hit=pieceHits[0];
  if(!terrainHit&&!hit){showToast("Tocá el terreno para colocar.");return;}
  const onPiece=!!hit&&(!terrainHit||hit.distance<terrainHit.distance);let point=onPiece?hit.point:terrainHit.point;
  if(buildTool==="door"){
    const snap=autoSnapBuildPlacement(point.x,point.z,"door",buildRotation);
    const x=snap.snapped?snap.x:Math.round(point.x/BLOCK_SIZE)*BLOCK_SIZE;
    const z=snap.snapped?snap.z:Math.round(point.z/BLOCK_SIZE)*BLOCK_SIZE;
    const rotation=snap.snapped?snap.rotation:buildRotation;
    if(!foundationContainsFootprint(x,z,"door",rotation)){showToast("El marco de la puerta debe quedar completamente dentro de la platea.");return;}
    if(buildRecords.some(item=>item.kind==="door"&&Math.hypot(item.x-x,item.z-z)<.2&&Math.abs((item.y||0)-supportHeightAt(x,z))<.2)){showToast("Ya hay una puerta en ese lugar.");return;}
    const baseY=supportHeightAt(x,z);
    const record={kind:"door",x,z,y:baseY,rotation,color:selectedBlockColor,doorWidth:1.5,open:false};
    buildRecords.push(record);createBuildPiece(record);persistBuilds();showToast("Puerta modular: 1,50 m de ancho y 3,00 m de alto.");return;
  }
  let x=point.x,z=point.z;
  if(buildTool==="platea"||buildTool==="water"||["pool-small","pool-large","pool-municipal"].includes(buildTool)){x=Math.round(x/BLOCK_SIZE)*BLOCK_SIZE;z=Math.round(z/BLOCK_SIZE)*BLOCK_SIZE;}
  const isPoolTool=["pool-small","pool-large","pool-municipal"].includes(buildTool),poolWidth=buildTool==="pool-large"?12:buildTool==="pool-municipal"?24:6,poolDepth=buildTool==="pool-municipal"?12:poolWidth;
  if(buildTool==="platea"){x=Math.round(x/6)*6;z=Math.round(z/6)*6;}
  if(isPoolTool){x=Math.round(x/(poolWidth/2))*(poolWidth/2);z=Math.round(z/(poolDepth/2))*(poolDepth/2);}
  if(onPiece&&buildTool!=="water"&&buildTool!=="platea"&&!isPoolTool&&hit.face){const normal=hit.object.localToWorld(hit.face.normal.clone()).sub(hit.object.getWorldPosition(new THREE.Vector3())).normalize();if(normal.y<.65){x=point.x+normal.x*.76;z=point.z+normal.z*.76;}}
  const snap=autoSnapBuildPlacement(x,z,buildTool,buildRotation);
  x=snap.x;z=snap.z;if(snap.snapped)buildRotation=snap.rotation;
  if(Math.abs(x)>worldSize/2-5||Math.abs(z)>worldSize/2-5)return;
  let containingPool=null;
  if(buildTool==="water"){containingPool=buildRecords.find(item=>item.kind==="pool"&&Math.abs(x-item.x)<(item.poolWidth||6)/2-.35&&Math.abs(z-item.z)<(item.poolDepth||6)/2-.35);if(!containingPool){showToast("El agua solo se puede colocar dentro de una pileta.");return;}if(buildRecords.some(item=>item.kind==="water"&&item.poolX===containingPool.x&&item.poolZ===containingPool.z)){showToast("Esta pileta ya está llena.");return;}x=containingPool.x;z=containingPool.z;}
  if(isPoolTool&&buildRecords.some(item=>item.kind==="pool"&&Math.abs(item.x-x)<poolWidth/2+(item.poolWidth||6)/2&&Math.abs(item.z-z)<poolDepth/2+(item.poolDepth||6)/2)){showToast("Ese espacio ya tiene una pileta.");return;}
  if(buildTool!=="platea"&&!isPoolTool&&buildTool!=="water"){
    if(!foundationAt(x,z)){showToast("Primero colocá una PLATEA. El terreno se nivela dentro de ella.");return;}
    if(!foundationContainsFootprint(x,z,buildTool,buildRotation)){showToast("La pieza debe quedar completamente dentro de la platea.");return;}
  }
  if(buildTool==="pen"||buildTool==="fence"){
    const angle=buildRotation,half=.75,ux=Math.cos(angle),uz=-Math.sin(angle);
    let best=null,bestDistance=.95;
    for(const segment of buildRecords){
      if(segment.kind!=="pen"&&segment.kind!=="fence")continue;
      const a=segment.rotation||0,ex=Math.cos(a)*half,ez=-Math.sin(a)*half;
      for(const sign of [-1,1]){
        const endX=segment.x+ex*sign,endZ=segment.z+ez*sign;
        for(const newSign of [-1,1]){
          const candidateX=endX-ux*half*newSign,candidateZ=endZ-uz*half*newSign;
          const distance=Math.hypot(candidateX-x,candidateZ-z);
          if(distance<bestDistance){bestDistance=distance;best={x:candidateX,z:candidateZ};}
        }
      }
    }
    if(best){x=best.x;z=best.z;}
  }
  let baseY=buildTool==="water"?containingPool.y:supportHeightAt(x,z);
  if(buildTool==="platea"){const n=buildRecords.find(r=>r.kind==="platea"&&((Math.abs(Math.abs(r.x-x)-6)<.2&&Math.abs(r.z-z)<.2)||(Math.abs(Math.abs(r.z-z)-6)<.2&&Math.abs(r.x-x)<.2)));if(n)baseY=n.y;else{let top=-Infinity;for(let ix=-2;ix<=2;ix++)for(let iz=-2;iz<=2;iz++)top=Math.max(top,terrainHeight(x+ix*1.5,z+iz*1.5));baseY=top+.04;}}
  if(isPoolTool){let top=-Infinity;for(let ix=-poolWidth/2;ix<=poolWidth/2;ix+=1.5)for(let iz=-poolDepth/2;iz<=poolDepth/2;iz+=1.5)top=Math.max(top,terrainHeight(x+ix,z+iz));baseY=top+.04;}
  if(onPiece&&buildTool!=="water"&&buildTool!=="platea"&&!isPoolTool){let root=hit.object;while(root.parent&&root.parent!==scene)root=root.parent;const sr=root.userData.buildRecord;if(sr){const normal=hit.face?hit.object.localToWorld(hit.face.normal.clone()).sub(hit.object.getWorldPosition(new THREE.Vector3())).normalize():new THREE.Vector3(0,1,0);baseY=normal.y<.65?sr.y:sr.y+(root.userData.buildHeight||1.5);}else baseY=new THREE.Box3().setFromObject(root).max.y;}
  const record={kind:isPoolTool?"pool":buildTool,x,z,y:baseY+((buildTool==="water"||buildTool==="platea"||isPoolTool)?0:2.4),rotation:buildRotation,color:selectedBlockColor};if(isPoolTool){record.poolWidth=poolWidth;record.poolDepth=poolDepth;}if(buildTool==="water"){record.poolWidth=containingPool.poolWidth||6;record.poolDepth=containingPool.poolDepth||6;record.poolX=containingPool.x;record.poolZ=containingPool.z;}
  buildRecords.push(record);
  const isAnimal=["sheep","cow","horse","chicken","pig","goat"].includes(buildTool);
  createBuildPiece(record,{notify:isAnimal});persistBuilds();
  if(isAnimal)showToast("Descargando modelo 3D del animal...");
  else showToast(buildTool==="water"?"Pileta llena: ¡a nadar!":isPoolTool?"Pileta instalada con dos metros de profundidad.":"¡Pieza colocada y alineada!");
}
function toggleDoorAtPointer(event){
  if(!renderer||!camera)return;
  const rect=renderer.domElement.getBoundingClientRect(),pointer=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-((event.clientY-rect.top)/rect.height)*2+1),raycaster=new THREE.Raycaster();
  raycaster.setFromCamera(pointer,camera);
  const doors=buildGroups.filter(g=>g.userData.buildRecord?.kind==="door");
  const hit=raycaster.intersectObjects(doors,true)[0];if(!hit)return;
  let root=hit.object;while(root.parent&&root.parent!==scene)root=root.parent;
  const pivot=root.userData.doorLeafPivot,record=root.userData.buildRecord;if(!pivot||!record)return;
  record.open=!record.open;pivot.rotation.y=record.open?Math.PI/2:0;persistBuilds();
  showToast(record.open?"Puerta abierta":"Puerta cerrada");
}

function triggerJump(){if(!started||!player||!playerGrounded||cameraLocked||player.userData.isSwimming)return;playerVerticalVelocity=8.4;playerGrounded=false;}
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
    const record=group.userData.buildRecord;if(!record||record.kind==="water")continue;
    if(record.kind==="platea"||record.kind==="pool")continue;
    let supportY=supportHeightAt(group.position.x,group.position.z,group.position.y,group);
    for(const other of buildGroups){if(other===group)continue;if(Math.abs(other.position.x-group.position.x)>.2||Math.abs(other.position.z-group.position.z)>.2)continue;const top=other.position.y+(other.userData.buildHeight||1.5);if(top<=group.position.y+.12&&top>supportY)supportY=top;}
    if(group.position.y>supportY+.015){group.userData.vy=(group.userData.vy||0)-18*delta;group.position.y+=group.userData.vy*delta;if(group.position.y<=supportY){group.position.y=supportY;group.userData.vy=0;record.y=supportY;persistBuilds();}}
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
    const speed = player?.userData.isSwimming ? 2.2 : 7.2;
    const cameraYaw = yaw;
    const dx = (-Math.sin(cameraYaw) * forward + Math.cos(cameraYaw) * strafe) * speed * delta;
    const dz = (-Math.cos(cameraYaw) * forward - Math.sin(cameraYaw) * strafe) * speed * delta;
    const nextX = THREE.MathUtils.clamp(player.position.x + dx, -worldSize / 2 + 4, worldSize / 2 - 4);
    const nextZ = THREE.MathUtils.clamp(player.position.z + dz, -worldSize / 2 + 4, worldSize / 2 - 4);
    const collides = (x,z) => {
      const feet = player.position.y;
      const body = new THREE.Box3(
        new THREE.Vector3(x-0.34, feet+0.08, z-0.34),
        new THREE.Vector3(x+0.34, feet+2.05, z+0.34)
      );
      const solidKinds = new Set(["block","brick","platea","pool","floor","wall","door","window","roof","stairs","tree","rock","chair","table","bed","sofa","lamp","gate","fence","pen","sheep","cow","horse","chicken","pig","goat"]);
      const playerSwimming=!!player.userData.isSwimming;
      const filledPoolAtCandidate=buildRecords.some(p=>p.kind==="pool"&&buildRecords.some(w=>w.kind==="water"&&w.poolX===p.x&&w.poolZ===p.z)&&Math.abs(x-p.x)<(p.poolWidth||6)/2-.48&&Math.abs(z-p.z)<(p.poolDepth||6)/2-.48);
      for (const g of buildGroups) {
        const kind=g.userData.buildRecord?.kind;
        if (!solidKinds.has(kind) || !g.visible) continue;
        // Dentro del agua, las paredes dejan de bloquear al nadador; al entrar
        // se permite cruzar el borde desde un salto, y al nadar se puede salir.
        if(kind==="pool"&&(playerSwimming||(filledPoolAtCandidate&&player.position.y>=(g.userData.buildRecord.y||0)+.18)))continue;
        g.updateMatrixWorld(true);
        let blocked=false;g.traverse(mesh=>{if(blocked||!mesh.isMesh||!mesh.visible||mesh.userData.water)return;const geometry=mesh.geometry;if(!geometry.boundingBox)geometry.computeBoundingBox();const bounds=geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);if(bounds.max.y<=feet+.08||bounds.min.y>=feet+PLAYER_HEIGHT)return;if(body.intersectsBox(bounds))blocked=true;});if(blocked)return true;
      }
      return false;
    };
    if (!collides(nextX, player.position.z)) player.position.x = nextX;
    if (!collides(player.position.x, nextZ)) player.position.z = nextZ;
    const pool=buildRecords.find(p=>p.kind==="pool"&&buildRecords.some(w=>w.kind==="water"&&w.poolX===p.x&&w.poolZ===p.z)&&Math.abs(player.position.x-p.x)<(p.poolWidth||6)/2-.48&&Math.abs(player.position.z-p.z)<(p.poolDepth||6)/2-.48);
    const surface=pool?pool.y:-Infinity,swimming=!!pool&&player.position.y<surface+.35&&player.position.y>pool.y-2.25;
    if(swimming){playerVerticalVelocity=0;const target=surface-.95+Math.sin(clock.elapsedTime*2.4)*.045;player.position.y+=(target-player.position.y)*Math.min(1,delta*3.5);playerGrounded=false;player.userData.isSwimming=true;}
    else{player.userData.isSwimming=false;const groundY=supportHeightAt(player.position.x,player.position.z,player.position.y);playerVerticalVelocity-=20*delta;player.position.y+=playerVerticalVelocity*delta;if(player.position.y<=groundY){player.position.y=groundY;playerVerticalVelocity=0;playerGrounded=true;}else playerGrounded=false;}
    const moving = inputLength > 0.08;
    if (player.userData.isRiggedAvatar) {
      player.userData.mixer?.update(delta);
      setRiggedAvatarMotion(player, moving && !player.userData.isSwimming);
      if(player.userData.isSwimming){
        const t=clock.elapsedTime;
        player.userData.swimmingPoseActive=true;
        player.traverse(bone=>{
          if(!bone.isBone)return;
          const n=bone.name.toLowerCase();
          if(!/(arm|hand|leg|foot)/.test(n))return;
          if(!bone.userData.iloxSwimBase)bone.userData.iloxSwimBase=bone.rotation.clone();
          const base=bone.userData.iloxSwimBase,side=n.includes("left")?-1:1;
          if(n.includes("arm")||n.includes("hand")){bone.rotation.x=base.x+Math.sin(t*3.2+side)*.42;bone.rotation.z=base.z+side*.22;}
          else{bone.rotation.x=base.x+Math.sin(t*3.2+side*Math.PI)*.22;}
        });
      }else if(player.userData.swimmingPoseActive){
        player.traverse(bone=>{if(bone.isBone&&bone.userData.iloxSwimBase){bone.rotation.copy(bone.userData.iloxSwimBase);}});
        player.userData.swimmingPoseActive=false;
      }
    }
    // La espalda y la mochila quedan siempre orientadas hacia la cámara.
    // El movimiento es independiente: caminar hacia atrás o de costado no da vuelta el avatar.
    const targetHeading = cameraLocked ? playerHeading : yaw;
    const angleDelta = Math.atan2(Math.sin(targetHeading - playerHeading), Math.cos(targetHeading - playerHeading));
    playerHeading += angleDelta * Math.min(1, delta * 12);
    player.userData.walkPhase = (player.userData.walkPhase || 0) + (moving ? delta * 10.5 : 0);
    const swimmingNow=!!player.userData.isSwimming;
    const swing = swimmingNow ? Math.sin(player.userData.walkPhase*1.7)*.24 : moving ? Math.sin(player.userData.walkPhase)*0.48 : 0;
    const stride = swimmingNow ? Math.cos(player.userData.walkPhase*1.4)*.35 : moving ? Math.cos(player.userData.walkPhase * 2) : 0;
    const rig = player.userData.rig;
    if (rig) {
      rig.position.y = swimmingNow ? Math.sin(clock.elapsedTime*2.4)*.035 : moving ? Math.abs(stride)*.055 : 0;
      rig.rotation.z = swimmingNow ? Math.sin(player.userData.walkPhase)*.025 : moving ? Math.sin(player.userData.walkPhase)*.035 : 0;
      rig.rotation.x = swimmingNow ? -.12 : moving ? -.035 : 0;
    }
    player.userData.legs?.forEach((leg,i) => { leg.rotation.x = i===0 ? swing : -swing; });
    player.userData.arms?.forEach((arm,i) => { arm.rotation.x = swimmingNow ? Math.sin(player.userData.walkPhase*1.8+i*Math.PI)*.72 : i===0 ? -swing*0.82 : swing*0.82; arm.rotation.z = i===0 ? -0.035 : 0.035; });
    // La cámara nunca modifica la orientación del personaje.
    player.rotation.y = playerHeading;
  }
  const focus = player || {position:new THREE.Vector3(0,terrainHeight(0,0),0)};
  const firstPerson = player && cameraMode === "first";
  updateBuildGravity(delta);
  for(const group of buildGroups){if(group.userData.animalMixer){ group.userData.animalMixer.update(delta);const actions=group.userData.animalActions;group.userData.roamTimer-=delta; if(group.userData.roamTimer<=0){const origin=group.userData.roamOrigin;group.userData.roamTarget.set(origin.x+(Math.random()-.5)*7,0,origin.z+(Math.random()-.5)*7);group.userData.roamTimer=5+Math.random()*6;} const target=group.userData.roamTarget,dx=target.x-group.position.x,dz=target.z-group.position.z,dist=Math.hypot(dx,dz),moving=dist>.22; if(moving){const speed=group.userData.buildRecord?.kind==="horse"?.72:.42;group.position.x+=dx/dist*speed*delta;group.position.z+=dz/dist*speed*delta;group.rotation.y=Math.atan2(dx,dz);group.userData.buildRecord.x=group.position.x;group.userData.buildRecord.z=group.position.z;} const next=moving?(actions.walk||actions.idle):(actions.idle||actions.walk);if(next&&next!==actions.current){next.reset().fadeIn(.35).play();if(actions.current)actions.current.fadeOut(.35);actions.current=next;}}if(group.userData.water){const water=group.children.find(child=>child.userData.water);if(water){const pos=water.geometry.attributes.position,base=water.userData.basePositions,t=clock.elapsedTime;for(let i=0;i<pos.count;i++){const x=base[i*3],z=base[i*3+1];pos.setZ(i,Math.sin(x*4+t*1.8)*.012+Math.cos(z*4+t*1.4)*.012);}pos.needsUpdate=true;water.geometry.computeVertexNormals();}}}
  if (player) player.visible = !firstPerson;
  if (viewHands) viewHands.visible = !!firstPerson && buildMode && buildTool !== "erase";
  const distance = cameraDistance;
  // Pitch orbital compartido: permite mirar desde el suelo hasta el cielo
  // en primera, segunda y tercera persona, sin límite superior artificial.
  const cameraYaw = yaw;
  const targetX = focus.position.x + Math.sin(cameraYaw) * distance;
  const targetZ = focus.position.z + Math.cos(cameraYaw) * distance;
  if (firstPerson) {
    const eye = new THREE.Vector3(player.position.x,player.position.y+1.72,player.position.z);
    camera.position.copy(eye);
    const viewDistance = 10;
    camera.lookAt(
      eye.x-Math.sin(cameraYaw)*Math.cos(pitch)*viewDistance,
      eye.y+Math.sin(pitch)*viewDistance,
      eye.z-Math.cos(cameraYaw)*Math.cos(pitch)*viewDistance
    );
  } else {
    const cameraHeight = cameraMode === "second" ? 2.55 : 3.35;
    camera.position.set(targetX, focus.position.y + cameraHeight, targetZ);
    const viewDistance = Math.max(8, distance + 3);
    camera.lookAt(
      focus.position.x-Math.sin(cameraYaw)*Math.cos(pitch)*viewDistance,
      focus.position.y+1.25+Math.sin(pitch)*viewDistance,
      focus.position.z-Math.cos(cameraYaw)*Math.cos(pitch)*viewDistance
    );
  }
  updateBuildPlacementGuide();
  renderer.render(scene, camera);
}

try {
  init();
} catch (error) {
  console.error(error);
  loading.innerHTML = '<div class="loading-mark">ILOX</div><p>No se pudo iniciar el mundo 3D. Revisá la conexión y volvé a intentar.</p>';
}
