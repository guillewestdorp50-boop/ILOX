import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.js";

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
let moveStickPointer = null;
let moveStick = { x: 0, y: 0 };

let scene, camera, renderer, player, clock, terrainMesh;
let buildMode = false, buildTool = "block", buildRotation = 0, firstPersonBuild = false, viewHands = null;
let selectedBlockColor = 0xff3030;
const buildRecords = [], buildGroups = [];
let started = false;
let yaw = 0, playerHeading = 0, pitch = 0.48;
// Nueva movilidad estilo Free Fire: joystick izquierdo y cámara libre independiente.


const polyHavenLoader = new GLTFLoader();
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
function makePlayer(kind = "boy") {
  const group = new THREE.Group();
  const isAdult = kind === "man" || kind === "woman";
  const isFemale = kind === "woman" || kind === "girl";
  const scale = isAdult ? 1.0 : 0.79;
  const jacketColor = kind === "builder" ? 0xd18a32 : kind === "astronaut" ? 0xe4e9ee : kind === "robot" ? 0x657b8a : 0x315a8c;
  const jacket = new THREE.MeshStandardMaterial({ color: jacketColor, roughness: 0.82 });
  const pants = new THREE.MeshStandardMaterial({ color: kind === "girl" ? 0x744f86 : kind === "builder" ? 0x3d4850 : kind === "astronaut" ? 0x536779 : kind === "robot" ? 0x344653 : 0x394b5c, roughness: 0.88, metalness: kind === "robot" ? 0.25 : 0 });
  const skin = new THREE.MeshStandardMaterial({ color: kind === "robot" ? 0x9cc9d6 : kind === "woman" ? 0xc98d68 : kind === "girl" ? 0xd9a27d : 0xd49a76, roughness: 0.75, metalness: kind === "robot" ? 0.75 : 0 });
  const hair = new THREE.MeshStandardMaterial({ color: kind === "robot" ? 0x263b4b : kind === "woman" ? 0x33251e : kind === "girl" ? 0x493026 : 0x30251f, roughness: 1 });
  const canvas = new THREE.MeshStandardMaterial({ color: 0x887957, roughness: 1 });
  const canvasLight = new THREE.MeshStandardMaterial({ color: 0xa18d68, roughness: 1 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x49382a, roughness: 1 });
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x302820, roughness: 1 });
  const buckleMat = new THREE.MeshStandardMaterial({ color: 0xb49a61, metalness: 0.25, roughness: 0.7 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.82, 0.42), jacket);
  torso.position.y = 1.36;
  group.add(torso);

  // Capucha negra: volumen de tela detrás de la cabeza, visible de perfil y desde atrás.
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.78), jacket);
  hood.position.set(0, 1.99, 0.105);
  hood.scale.set(1, 1.04, 0.82);
  group.add(hood);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.12, 0.18, 12), skin);
  neck.position.y = 1.79;
  group.add(neck);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.48), skin);
  head.position.set(0, 2.02, -0.015);
  head.scale.set(1, 1, 1);
  group.add(head);
  if(kind !== "robot") {
    const eyeMat=new THREE.MeshStandardMaterial({color:0x28231f,roughness:0.55});
    const eyeWhite=new THREE.MeshStandardMaterial({color:0xf4eee2,roughness:0.5});
    for(const side of [-1,1]) {
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.035,10,8),eyeWhite);
      eye.position.set(side*0.083,2.045,-0.239); group.add(eye);
      const pupil=new THREE.Mesh(new THREE.SphereGeometry(0.018,8,6),eyeMat);
      pupil.position.set(side*0.083,2.045,-0.269); group.add(pupil);
    }
    const nose=new THREE.Mesh(new THREE.SphereGeometry(0.035,8,6),skin);
    nose.position.set(0,1.985,-0.255); nose.scale.set(0.75,1,0.8); group.add(nose);
    const mouth=new THREE.Mesh(new THREE.BoxGeometry(0.075,0.014,0.012),new THREE.MeshStandardMaterial({color:0x754b43}));
    mouth.position.set(0,1.94,-0.246); group.add(mouth);
  }
  if (kind === "robot") {
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.39,0.13,0.12), new THREE.MeshStandardMaterial({color:0x35d8ef,emissive:0x126477,metalness:0.5,roughness:0.2}));
    visor.position.set(0,2.04,-0.235); group.add(visor);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.045,0.28,8), jacket); antenna.position.set(0,2.34,0); group.add(antenna);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.09,10,8), new THREE.MeshStandardMaterial({color:0xffc85a,emissive:0x664000})); tip.position.set(0,2.5,0); group.add(tip);
  }
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.265, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), hair);
  hairCap.position.set(0, 2.12, -0.025);
  group.add(hairCap);
  if (isFemale) {
    const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), hair);
    hairBack.position.set(0, 1.91, -0.16);
    hairBack.scale.set(0.95, 1.12, 0.72);
    group.add(hairBack);
  }
  if (kind === "builder") {
    const helmetMat = new THREE.MeshStandardMaterial({color:0xf0b72f,roughness:0.7});
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.31,16,12,0,Math.PI*2,0,Math.PI*0.55),helmetMat);
    helmet.position.set(0,2.19,0); group.add(helmet);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.36,0.36,0.07,16),helmetMat);
    brim.position.y=2.08; group.add(brim);
  }
  if (kind === "astronaut") {
    const glassHelmet = new THREE.Mesh(new THREE.SphereGeometry(0.36,20,16),new THREE.MeshPhysicalMaterial({color:0x8ed8ec,transparent:true,opacity:0.28,roughness:0.08,metalness:0.12}));
    glassHelmet.position.set(0,2.03,0); group.add(glassHelmet);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.29,0.07,8,20),new THREE.MeshStandardMaterial({color:0x9aa9b4,metalness:0.55}));
    collar.position.y=1.78; group.add(collar);
  }
  if (kind === "robot") {
    const earMat=new THREE.MeshStandardMaterial({color:0x35cce0,metalness:0.65,roughness:0.25});
    for(const side of [-1,1]) { const ear=new THREE.Mesh(new THREE.BoxGeometry(0.13,0.24,0.2),earMat); ear.position.set(side*0.29,2.02,0); group.add(ear); }
  }

  // Avatar humanoide cúbico estilo Roblox: torso, cabeza y extremidades rectangulares.
  const arms = [], legs = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.66, 0.24), jacket);
    arm.position.set(side * 0.48, 1.38, 0);
    arm.rotation.z = side * -0.12;
    group.add(arm); arms.push(arm);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.20, 0.22), skin);
    hand.position.set(side * 0.48, 1.00, -0.005);
    group.add(hand);

    const legPivot = new THREE.Group();
    legPivot.position.set(side * 0.18, 0.91, 0);
    group.add(legPivot);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.70, 0.30), pants);
    leg.position.set(0, -0.34, 0);
    legPivot.add(leg);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.18, 0.40), bootMat);
    boot.position.set(0, -0.78, -0.055);
    boot.scale.set(1.05, 0.72, 1.45);
    legPivot.add(boot); legs.push(legPivot);
  }

  // Mochila pequeña de lona vintage, con tapa, correas y bolsillos laterales.
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.66, 0.27), canvas);
  pack.position.set(0, 1.31, 0.34);
  pack.rotation.x = -0.06;
  group.add(pack);
  const flap = new THREE.Mesh(new THREE.BoxGeometry(0.60, 0.16, 0.30), canvasLight);
  flap.position.set(0, 1.68, 0.34);
  group.add(flap);
  const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.10), canvasLight);
  pocket.position.set(0, 1.22, 0.51);
  group.add(pocket);
  for (const side of [-1, 1]) {
    const sidePocket = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.22, 10), canvas);
    sidePocket.rotation.z = Math.PI / 2;
    sidePocket.position.set(side * 0.31, 1.31, 0.34);
    group.add(sidePocket);
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.69, 0.07), leather);
    strap.position.set(side * 0.20, 1.34, 0.18);
    group.add(strap);
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.075, 0.025), buckleMat);
    buckle.position.set(side * 0.20, 1.40, 0.145);
    group.add(buckle);
  }

  // Parche de tela con la marca ILOX en la parte alta de la espalda, visible sobre la mochila.
  const logoCanvas = document.createElement("canvas");
  logoCanvas.width = 512; logoCanvas.height = 128;
  const ctx = logoCanvas.getContext("2d");
  ctx.clearRect(0, 0, 512, 128);
  ctx.fillStyle = "#e7d29a";
  ctx.font = "900 82px Arial";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("ILOX", 256, 67);
  const logoTexture = new THREE.CanvasTexture(logoCanvas);
  const logo = new THREE.Mesh(
    new THREE.PlaneGeometry(0.48, 0.12),
    new THREE.MeshBasicMaterial({ map: logoTexture, transparent: true, side: THREE.DoubleSide })
  );
  logo.position.set(0, 1.83, 0.285);
  group.add(logo);

  group.scale.setScalar(scale);
  group.position.set(0, terrainHeight(0, 0), 0);
  group.userData.avatarKind = kind;
  group.userData.legs = legs;
  group.userData.arms = arms;
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
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(e.key.toLowerCase())) e.preventDefault();
  });
  addEventListener("keyup", e => keys.delete(e.key.toLowerCase()));
  movePad.addEventListener("pointerdown", e => {
    if (!started || e.button !== 0 || moveStickPointer !== null) return;
    e.preventDefault();
    e.stopPropagation();
    moveStickPointer = e.pointerId;
    movePad.setPointerCapture(e.pointerId);
    updateMoveStick(e);
  });
  movePad.addEventListener("pointermove", e => {
    if (e.pointerId !== moveStickPointer) return;
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
    if (e.target.closest("button") || e.target.closest("#move-pad") || e.target.closest("#build-panel") || e.target.closest("#build-toggle")) return;
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
    cameraDistance = THREE.MathUtils.clamp(cameraDistance + Math.sign(e.deltaY)*0.9, buildMode?3.2:4.2, 20);
  }, {passive:false});

  startButton.addEventListener("click", () => {
    welcome.classList.add("hidden");
    avatarSelect.classList.remove("hidden");
  });
  document.querySelectorAll(".avatar-option").forEach(option => {
    option.addEventListener("click", () => {
      selectedAvatar = option.dataset.avatar;
      document.querySelectorAll(".avatar-option").forEach(item => item.classList.toggle("selected", item === option));
      enterWorldButton.innerHTML = "ENTRAR COMO " + option.querySelector("strong").textContent.toUpperCase() + " <span>→</span>";
    });
  });
  enterWorldButton.addEventListener("click", () => {
    if (player) scene.remove(player);
    player = makePlayer(selectedAvatar);
    started = true;
    avatarSelect.classList.add("hidden");
    document.querySelector("#build-toggle").classList.remove("hidden");
    hint.textContent = "Explorá y construí tu propio mundo";
    loadBuilds();
    showToast("¡Tu mundo, tus reglas!");
  });
  const buildToggle = document.querySelector("#build-toggle");
  const viewToggle = document.querySelector("#view-toggle");
  const materialsToggle = document.querySelector("#materials-toggle");
  materialsToggle.addEventListener("click", () => buildPanel.classList.toggle("hidden"));
  viewToggle.addEventListener("click", () => { firstPersonBuild = !firstPersonBuild; viewToggle.textContent = firstPersonBuild ? "👁 PRIMERA PERSONA" : "⬆ VISTA AÉREA"; cameraDistance = firstPersonBuild ? 2.4 : 9.5; if(!firstPersonBuild) pitch=0.48; showToast(firstPersonBuild ? "Vista en primera persona" : "Vista en tercera persona"); });
  const buildPanel = document.querySelector("#build-panel");
  buildToggle.addEventListener("click", () => {
    buildMode = !buildMode;
    buildPanel.classList.toggle("hidden", !buildMode);
    document.querySelector("#materials-toggle").classList.toggle("hidden",!buildMode);
    buildToggle.textContent = buildMode ? "✓ TERMINAR" : "＋ CONSTRUIR";
    cameraDistance = buildMode ? (firstPersonBuild ? 2.4 : 9.5) : 5.4;
    if(buildMode && !firstPersonBuild) pitch = 0.48;
    viewToggle.classList.toggle("hidden",!buildMode);
    viewToggle.textContent = firstPersonBuild ? "👁 PRIMERA PERSONA" : "⬆ VISTA AÉREA";
    document.querySelector("#build-help").textContent = buildMode ? "BLOQUES PEQUEÑOS · TOCÁ para colocar · Arrastrá para mover la cámara aérea." : "Explorá el mundo y construí con bloques.";
    showToast(buildMode ? "Vista libre: arrastrá para mirar y tocá para construir" : "¡A explorar!");
  });
  document.querySelectorAll(".build-tool").forEach(button => {
    if (!button.dataset.tool) return;
    button.addEventListener("click", () => {
      buildTool = button.dataset.tool;
      document.querySelectorAll(".build-tool[data-tool]").forEach(item => item.classList.toggle("selected", item === button));
      document.querySelector("#build-help").textContent = buildTool === "erase" ? "Tocá una construcción para borrarla." : "Bloque pequeño seleccionado. Tocá el terreno para colocarlo.";
      buildPanel.classList.add("hidden");
    });
  });
  document.querySelectorAll(".block-color").forEach(button => {
    button.addEventListener("click", () => {
      selectedBlockColor = Number(button.dataset.color);
      document.querySelectorAll(".block-color").forEach(item => item.classList.toggle("selected", item === button));
      buildPanel.classList.add("hidden");
      showToast("Color seleccionado");
    });
  });
  document.querySelector("#rotate-build").addEventListener("click", () => { buildRotation = (buildRotation + Math.PI/2) % (Math.PI*2); showToast("Pieza girada"); });
  document.querySelector("#fullscreen").addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) await game.requestFullscreen();
      else await document.exitFullscreen();
    } catch { showToast("La pantalla completa no está disponible en este navegador."); }
  });
}


function createBuildPiece(record) {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({color:0xb88752,roughness:0.88});
  const wallMat = new THREE.MeshStandardMaterial({color:0xe7d9bb,roughness:0.95});
  const roofMat = new THREE.MeshStandardMaterial({color:0x9a5545,roughness:0.9});
  const glass = new THREE.MeshStandardMaterial({color:0x75cde0,transparent:true,opacity:0.62,roughness:0.2});
  const addBox=(w,h,d,mat,x,y,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);};
  const {kind,x,z,rotation=0}=record;
  const baseY=Number.isFinite(record.y) ? record.y : terrainHeight(x,z);
  if(kind==="block") { const blockMat=new THREE.MeshStandardMaterial({color:record.color??0xff3030,roughness:0.88}); addBox(1.5,1.5,1.5,blockMat,0,0.75,0); }
  if(kind==="floor") addBox(4,0.22,4,wood,0,0.11,0);
  if(kind==="wall") addBox(4,3,0.2,wallMat,0,1.5,0);
  if(kind==="door") {
    addBox(1.15,3,0.2,wallMat,-1.42,1.5,0); addBox(1.15,3,0.2,wallMat,1.42,1.5,0);
    addBox(1.7,0.8,0.2,wallMat,0,2.6,0); addBox(1.15,2.2,0.08,wood,0,1.1,-0.04);
    const knob=new THREE.Mesh(new THREE.SphereGeometry(0.07,8,8),new THREE.MeshStandardMaterial({color:0xe8c56b,metalness:0.6}));knob.position.set(.42,1.1,-.11);group.add(knob);
  }
  if(kind==="window") {
    addBox(1.1,3,0.2,wallMat,-1.45,1.5,0); addBox(1.1,3,0.2,wallMat,1.45,1.5,0);
    addBox(1.8,0.75,0.2,wallMat,0,2.625,0); addBox(1.8,0.65,0.2,wallMat,0,0.325,0);
    addBox(1.75,1.55,0.07,glass,0,1.5,-0.02);
    addBox(1.9,0.12,0.28,wood,0,2.32,0); addBox(0.12,1.65,0.28,wood,0,1.5,0);
  }
  if(kind==="roof") { const slab=new THREE.Mesh(new THREE.BoxGeometry(4.4,0.22,4.4),roofMat);slab.position.set(0,3.25,0);slab.rotation.z=-0.12;slab.castShadow=true;group.add(slab); }
  group.position.set(x,baseY,z); group.rotation.y=rotation; group.userData.buildRecord=record;
  scene.add(group); buildGroups.push(group); return group;
}
function persistBuilds() {
  try { localStorage.setItem("ilox-builds-v1",JSON.stringify(buildRecords)); }
  catch(error){ showToast("No se pudo guardar el mundo en este dispositivo."); }
}
function loadBuilds() {
  if(buildRecords.length) return;
  try {
    const saved=JSON.parse(localStorage.getItem("ilox-builds-v1")||"[]");
    if(Array.isArray(saved)) saved.slice(0,500).forEach(record=>{if(record&&["block","floor","wall","door","window","roof"].includes(record.kind)&&Number.isFinite(record.x)&&Number.isFinite(record.z)){buildRecords.push(record);createBuildPiece(record);}});
  } catch(error){ console.warn("ILOX: no se pudieron recuperar las construcciones",error); }
}
function placeBuildAtPointer(event) {
  const rect=renderer.domElement.getBoundingClientRect();
  const pointer=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-((event.clientY-rect.top)/rect.height)*2+1);
  const raycaster=new THREE.Raycaster();raycaster.setFromCamera(pointer,camera);
  if(buildTool==="erase") {
    const hits=raycaster.intersectObjects(buildGroups,true);
    if(!hits.length){showToast("Tocá una pieza construida para borrarla.");return;}
    let group=hits[0].object;while(group.parent&&group.parent!==scene)group=group.parent;
    const record=group.userData.buildRecord;const index=buildRecords.indexOf(record);
    if(index>=0){buildRecords.splice(index,1);scene.remove(group);const gi=buildGroups.indexOf(group);if(gi>=0)buildGroups.splice(gi,1);persistBuilds();showToast("Pieza borrada");}
    return;
  }
  if(!terrainMesh)return;
  const terrainHit=raycaster.intersectObject(terrainMesh,false)[0];
  const pieceHits=raycaster.intersectObjects(buildGroups,true);
  const firstPiece=pieceHits[0];
  let baseY=terrainHit?.point.y ?? terrainHeight(0,0);
  if(buildTool==="block" && firstPiece && (!terrainHit || firstPiece.distance<terrainHit.distance)) {
    let root=firstPiece.object; while(root.parent&&root.parent!==scene) root=root.parent;
    baseY=new THREE.Box3().setFromObject(root).max.y;
  }
  if(!terrainHit&&!firstPiece){showToast("Tocá el terreno para colocar una pieza.");return;}
  const grid=buildTool==="block"?1.5:4;
  const point=firstPiece && buildTool==="block" && (!terrainHit || firstPiece.distance<terrainHit.distance) ? firstPiece.point : terrainHit.point;
  const x=Math.round(point.x/grid)*grid,z=Math.round(point.z/grid)*grid;
  if(Math.abs(x)>worldSize/2-5||Math.abs(z)>worldSize/2-5)return;
  const record={kind:buildTool,x,z,y:buildTool==="block"?baseY:undefined,rotation:buildRotation,color:selectedBlockColor};
  buildRecords.push(record);createBuildPiece(record);persistBuilds();showToast("¡Pieza colocada!");
}

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

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  if (started && player) {
    // Entrada nueva: el joystick da un vector 360°. La cámara define el frente;
    // por eso, al mantener el joystick arriba y arrastrar la vista a la derecha,
    // el personaje sigue avanzando y curva su trayectoria con la cámara.
    let forward = -moveStick.y + (keys.has("w") ? 1 : 0) - (keys.has("s") ? 1 : 0)
      + (keys.has("arrowup") ? 1 : 0) - (keys.has("arrowdown") ? 1 : 0);
    let strafe = moveStick.x + (keys.has("d") ? 1 : 0) - (keys.has("a") ? 1 : 0)
      + (keys.has("arrowright") ? 1 : 0) - (keys.has("arrowleft") ? 1 : 0);
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
    player.position.y = terrainHeight(player.position.x, player.position.z);
    const moving = inputLength > 0.08;
    if (moving) {
      // Auto-rotación suave hacia el vector real de desplazamiento (estilo Free Fire).
      const targetHeading = Math.atan2(dx, -dz);
      const angleDelta = Math.atan2(Math.sin(targetHeading - playerHeading), Math.cos(targetHeading - playerHeading));
      playerHeading += angleDelta * Math.min(1, delta * 10);
    }
    player.userData.walkPhase = (player.userData.walkPhase || 0) + (moving ? delta * 10.5 : 0);
    const swing = moving ? Math.sin(player.userData.walkPhase) * 0.62 : 0;
    player.userData.legs?.forEach((leg,i) => { leg.rotation.x = i===0 ? swing : -swing; });
    player.userData.arms?.forEach((arm,i) => { arm.rotation.x = i===0 ? -swing*0.62 : swing*0.62; });
    // La cámara nunca modifica la orientación del personaje.
    player.rotation.y = playerHeading;
  }
  const focus = player || {position:new THREE.Vector3(0,terrainHeight(0,0),0)};
  const firstPerson = buildMode && firstPersonBuild && player;
  if (player) player.visible = !firstPerson;
  if (viewHands) viewHands.visible = !!firstPerson && buildTool !== "erase";
  const distance = buildMode ? cameraDistance : 5.4;
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
