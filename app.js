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
const joystick = document.querySelector("#joystick");
const stick = document.querySelector("#stick");

let scene, camera, renderer, player, clock;
let started = false;
let yaw = 0, pitch = 0.18;
let moveX = 0, moveZ = 0;
let joyPointer = null;
const polyHavenLoader = new GLTFLoader();
const proceduralTreeGroups = [];
let importedNatureReady = false;
let lookPointer = null;
let lastLookX = 0, lastLookY = 0;
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
  mesh.receiveShadow = true; scene.add(mesh);
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
  for(let i=0;i<1900;i++){
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
  const jacketColor = 0x151719;
  const jacket = new THREE.MeshStandardMaterial({ color: jacketColor, roughness: 0.92 });
  const pants = new THREE.MeshStandardMaterial({ color: kind === "girl" ? 0x4a5360 : 0x555b50, roughness: 1 });
  const skin = new THREE.MeshStandardMaterial({ color: kind === "woman" ? 0xc98d68 : kind === "girl" ? 0xd9a27d : 0xd49a76, roughness: 0.95 });
  const hair = new THREE.MeshStandardMaterial({ color: kind === "woman" ? 0x33251e : kind === "girl" ? 0x493026 : 0x30251f, roughness: 1 });
  const canvas = new THREE.MeshStandardMaterial({ color: 0x887957, roughness: 1 });
  const canvasLight = new THREE.MeshStandardMaterial({ color: 0xa18d68, roughness: 1 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x49382a, roughness: 1 });
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x302820, roughness: 1 });
  const buckleMat = new THREE.MeshStandardMaterial({ color: 0xb49a61, metalness: 0.25, roughness: 0.7 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.52, 5, 12), jacket);
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
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.255, 20, 16), skin);
  head.position.set(0, 2.02, -0.015);
  head.scale.set(0.9, 1.08, 0.94);
  group.add(head);
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.265, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), hair);
  hairCap.position.set(0, 2.12, -0.025);
  group.add(hairCap);
  if (isFemale) {
    const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), hair);
    hairBack.position.set(0, 1.91, -0.16);
    hairBack.scale.set(0.95, 1.12, 0.72);
    group.add(hairBack);
  }

  // Brazos naturales y mangas de la camperita.
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.48, 4, 10), jacket);
    arm.position.set(side * 0.43, 1.38, 0);
    arm.rotation.z = side * -0.12;
    group.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), skin);
    hand.position.set(side * 0.47, 1.05, -0.005);
    group.add(hand);

    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.125, 0.53, 4, 10), pants);
    leg.position.set(side * 0.18, 0.59, 0);
    group.add(leg);
    const boot = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.13, 3, 8), bootMat);
    boot.position.set(side * 0.18, 0.13, -0.055);
    boot.scale.set(1.05, 0.72, 1.45);
    group.add(boot);
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
  makeFantasyWorld();
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
    welcome.classList.add("hidden");
    avatarSelect.classList.remove("hidden");
  });
  document.querySelectorAll(".avatar-option").forEach(option => {
    option.addEventListener("click", () => {
      selectedAvatar = option.dataset.avatar;
      document.querySelectorAll(".avatar-option").forEach(item => item.classList.toggle("selected", item === option));
    });
  });
  enterWorldButton.addEventListener("click", () => {
    if (player) scene.remove(player);
    player = makePlayer(selectedAvatar);
    started = true;
    avatarSelect.classList.add("hidden");
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
  loadFreeNatureAssets();
} catch (error) {
  console.error(error);
  loading.innerHTML = '<div class="loading-mark">ILOX</div><p>No se pudo iniciar el mundo 3D. Revisá la conexión y volvé a intentar.</p>';
}
