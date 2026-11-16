import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/utils/SkeletonUtils.js";
import * as Multiplayer from "./multiplayer.js?v=ilox-elevator-real-controls-20261116";

const game = document.querySelector("#game");
const loading = document.querySelector("#loading");
const welcome = document.querySelector("#welcome");
const welcomeScene = document.querySelector("#welcome-scene");
const avatarSelect = document.querySelector("#avatar-select");
const enterWorldButton = document.querySelector("#enter-world");
let selectedAvatar = "boy";
const startButton = document.querySelector("#start");
const hint = document.querySelector("#hint");
const toast = document.querySelector("#toast");
const movePad = document.querySelector("#move-pad");
const moveKnob = document.querySelector("#move-knob");
const cameraControls = document.querySelector("#hud-controls");
const hudDock=document.querySelector("#hud-dock");
const hudDockToggle=document.querySelector("#hud-dock-toggle");
const cameraLockButton = document.querySelector("#camera-lock");
const cameraMenuToggle = document.querySelector("#camera-menu-toggle");
const cameraFreeQuickButton = document.querySelector("#camera-free-quick");
const cameraModePanel = document.querySelector("#camera-mode-panel");
const cameraFreeControls = document.querySelector("#camera-free-controls");
const cameraFreePad = document.querySelector("#camera-free-pad");
const cameraFreeKnob = document.querySelector("#camera-free-knob");
const cameraFreeUp = document.querySelector("#camera-free-up");
const cameraFreeDown = document.querySelector("#camera-free-down");
const menuToggle = document.querySelector("#menu-toggle");
const hudBuildButton = document.querySelector("#hud-build");
const hudConfirmButton = document.querySelector("#hud-confirm");
const hudDeleteButton = document.querySelector("#hud-delete");
const elevatorCallLabel = document.querySelector("#elevator-call-label");
const menuPanel = document.querySelector("#menu-panel");
const buildPanel = document.querySelector("#build-panel");
const quickSaveButton = document.querySelector("#quick-save");
const doorPinDialog = document.querySelector("#door-pin-dialog");
const doorPinForm = document.querySelector("#door-pin-form");
const doorPinInput = document.querySelector("#door-pin-input");
const doorPinCurrent = document.querySelector("#door-pin-current");
const doorPinNew = document.querySelector("#door-pin-new");
const doorPinTitle = document.querySelector("#door-pin-title");
const doorPinHelp = document.querySelector("#door-pin-help");
const doorPinChangeButton = document.querySelector("#door-pin-change");
let doorPinTarget = null, doorPinMode = "setup";
let activeMultiplayerWorldId = null, multiplayerSession = null, multiplayerUserId = null;
let multiplayerSyncTimer = null, multiplayerSyncing = false, multiplayerSyncAgain = false;
let multiplayerFallbackTimer = null, multiplayerFallbackBusy = false, multiplayerLastChatPoll = 0;
let multiplayerLastBroadcast = 0, multiplayerLastPresence = 0, multiplayerLastDbState = 0, multiplayerLastStructurePoll = 0;
let multiplayerUnreadMessages = 0, multiplayerChatAudio = null;
let activeElevator=null,elevatorRiding=false,elevatorUiTimer=0,elevatorJustExitedAt=0,elevatorSelectedFloor=1;
const elevatorPanel=document.querySelector("#elevator-panel"),elevatorStatus=document.querySelector("#elevator-status"),elevatorDisplay=document.querySelector("#elevator-display");
const elevatorCallButton=document.querySelector("#elevator-call-button");
const elevatorDoorOpenButton=document.querySelector("#elevator-door-open-button");
const elevatorDoorCloseButton=document.querySelector("#elevator-door-close-button");
let elevatorBot=null,elevatorBotRemoteState=null,elevatorBotTarget=null,elevatorBotPhase="idle",elevatorBotElevator=null,elevatorBotLastBroadcast=0,elevatorBotWaitUntil=0;
const multiplayerCloudSnapshot = new Map(), remotePlayers = new Map();
const remoteAvatarModelPromises = new Map();
const multiplayerChatSeen = new Set();
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
let cameraMode = "third", cameraLocked = false, cameraFreeMode = false;
let cameraFreePointer = null;
let cameraFreeStick = {x:0,y:0};
let cameraFreePosition = null, cameraFreeYaw = 0, cameraFreePitch = 0, cameraFreeZoom = 30;
let cameraFreeVertical = 0;
// Nueva movilidad estilo Free Fire: joystick izquierdo y cámara libre independiente.


const polyHavenLoader = new GLTFLoader();
// Las tres piletas ILOX se construyen con geometría propia; no dependen de modelos externos.
const POOL_DESIGNS = Object.freeze({
  small: {width:6,depth:6,water:0x28c9df,tile:0x9ee7e8,edge:0xf4f3e9},
  large: {width:12,depth:12,water:0x20b9dc,tile:0x8edce7,edge:0xf8f5eb},
  municipal: {width:24,depth:12,water:0x168fca,tile:0xd7edf0,edge:0xf6f4ec}
});
const avatarModelLoader = new GLTFLoader();
const animalModelLoader = new GLTFLoader();
const ANIMAL_MODELS = {sheep:"https://gobkit.com/freebies/animal005/Lamb.glb",cow:"https://gobkit.com/freebies/animal005/HolsteinCow.glb",horse:"https://gobkit.com/freebies/animal012/PalominoHorse.glb",chicken:"https://gobkit.com/freebies/animal009/BrahmaChicken.glb",pig:"https://gobkit.com/freebies/animal005/Pig.glb",goat:"https://gobkit.com/freebies/animalB/Goat.glb",fox:"https://wihbxfebobfmohmqqhkt.supabase.co/storage/v1/object/public/ilox-assets/bake3d-fox-animated.glb",person:"https://wihbxfebobfmohmqqhkt.supabase.co/storage/v1/object/public/ilox-assets/bake3d-person-animated.glb",robot:"https://wihbxfebobfmohmqqhkt.supabase.co/storage/v1/object/public/ilox-assets/bake3d-robot-animated.glb",trex:"https://wihbxfebobfmohmqqhkt.supabase.co/storage/v1/object/public/ilox-assets/bake3d-trex-animated.glb"};
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
let sprintHeld = false;
const worldSize = 320;
const BLOCK_SIZE=1.5,FOUNDATION_SIZE=6,PLAYER_HEIGHT=2.1;
// Dependencias declarativas: cada componente indica qué estructura principal necesita.
const BUILD_DEPENDENCIES={
  water:{parents:["pool"],label:"pileta",parentField:"poolStructureId",positionFields:["poolX","poolZ"]}
};
function findRequiredParent(kind,x,z){
  const rule=BUILD_DEPENDENCIES[kind];
  if(!rule)return null;
  for(const parentKind of rule.parents){
    const parent=buildRecords.find(item=>item.kind===parentKind&&
      Math.abs(x-item.x)<(item.poolWidth||item.width||6)/2-.35&&
      Math.abs(z-item.z)<(item.poolDepth||item.depth||6)/2-.35);
    if(parent)return parent;
  }
  return null;
}
function isLivingBuildKind(kind){return ["sheep","cow","horse","chicken","pig","goat","fox","person","robot","trex"].includes(kind);}
function foundationAt(x,z){for(const r of buildRecords){if(r.kind!=="platea"&&r.kind!=="pool")continue;const w=r.kind==="pool"?(r.poolWidth||6):FOUNDATION_SIZE,d=r.kind==="pool"?(r.poolDepth||6):FOUNDATION_SIZE,a=r.rotation||0,dx=x-r.x,dz=z-r.z,lx=dx*Math.cos(a)-dz*Math.sin(a),lz=dx*Math.sin(a)+dz*Math.cos(a);if(Math.abs(lx)<=w/2&&Math.abs(lz)<=d/2)return r;}return null;}
function plateasAreAdjacent(a,b){
  if(!a||!b||a===b||a.kind!=="platea"||b.kind!=="platea")return false;
  const dx=Math.abs(a.x-b.x),dz=Math.abs(a.z-b.z);
  return (Math.abs(dx-FOUNDATION_SIZE)<.03&&dz<.03)||(Math.abs(dz-FOUNDATION_SIZE)<.03&&dx<.03);
}
function foundationHasDoor(foundation){
  if(!foundation||foundation.kind!=="platea")return false;
  const connected=new Set([foundation]),queue=[foundation];
  while(queue.length){
    const current=queue.shift();
    for(const candidate of buildRecords){
      if(!connected.has(candidate)&&plateasAreAdjacent(current,candidate)){
        connected.add(candidate);queue.push(candidate);
      }
    }
  }
  return buildRecords.some(record=>record.kind==="door"&&connected.has(foundationAt(record.x,record.z)));
}
function stairSurfaceHeight(group,x,z,feet=Infinity){
  const dx=x-group.position.x,dz=z-group.position.z,a=group.rotation.y||0;
  const localX=dx*Math.cos(a)-dz*Math.sin(a),localZ=dx*Math.sin(a)+dz*Math.cos(a);
  if(Math.abs(localX)>.79||localZ<-2.25||localZ>2.25)return null;
  const rise=THREE.MathUtils.clamp((localZ+2.25)/4.5,0,1)*3;
  const surface=group.position.y+rise;
  if(feet!==Infinity&&(feet<surface-.72||feet>surface+.38))return null;
  return surface;
}
function supportHeightAt(x,z,feet=Infinity,ignore=null){
  const f=foundationAt(x,z);
  let top=f?(f.kind==="pool"&&Math.abs(x-f.x)<(f.poolWidth||6)/2-.3&&Math.abs(z-f.z)<(f.poolDepth||6)/2-.3?f.y-1.936:f.y+(f.kind==="platea"?.3:.22)):terrainHeight(x,z);
  for(const elevator of buildGroups){if(elevator===ignore||elevator.userData.buildRecord?.kind!=="elevator")continue;const cabin=elevator.userData.elevatorCabin;if(!cabin)continue;const floorY=elevator.position.y+cabin.position.y+.16;if(Math.abs(x-elevator.position.x)<2.96&&Math.abs(z-elevator.position.z)<2.96&&floorY<=feet+.35&&floorY>top)top=floorY;}
  for(const g of buildGroups){
    if(g===ignore)continue;
    const kind=g.userData.buildRecord?.kind;
    if(!kind||kind==="water")continue;
    if((kind==="platea"||kind==="roof")&&buildRecords.some(e=>e.kind==="elevator"&&g.position.y>e.y+.5&&Math.abs(x-e.x)<3.08&&Math.abs(z-e.z)<3.08))continue;
    if(kind==="stairs"){
      const stairTop=stairSurfaceHeight(g,x,z,feet);
      if(stairTop!==null&&stairTop>top)top=stairTop;
      continue;
    }
    g.updateMatrixWorld(true);
    const b=new THREE.Box3().setFromObject(g);
    if(x>=b.min.x-.02&&x<=b.max.x+.02&&z>=b.min.z-.02&&z<=b.max.z+.02&&b.max.y<=feet+.28&&b.max.y>top)top=b.max.y;
  }
  if(Math.abs(x-ILOX_NIGHTCLUB.x)<20.4&&Math.abs(z-ILOX_NIGHTCLUB.z)<15.4){
    const onDanceFloor=Math.abs(x-ILOX_NIGHTCLUB.x)<10&&Math.abs(z-ILOX_NIGHTCLUB.z)<7.6;
    top=Math.max(top,onDanceFloor ? 0.325 : 0.16);
  }
  return top;
}
function refreshTerrainSurface(){
  if(!terrainMesh)return;
  const a=terrainMesh.geometry.attributes.position;
  for(let i=0;i<a.count;i++){
    const x=a.getX(i),z=a.getZ(i),f=foundationAt(x,z);
    const cutY=f?(f.kind==="pool"?f.y-2.5:f.y-.36):terrainHeight(x,z);
    a.setY(i,Math.min(terrainHeight(x,z),cutY));
  }
  a.needsUpdate=true;terrainMesh.geometry.computeVertexNormals();
}

function backupIloxLocalData(){
  const backupKey="ilox-safety-backup-20261116";
  try{
    if(localStorage.getItem(backupKey))return true;
    const entries={};
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(key&&key.startsWith("ilox-")&&!key.startsWith("ilox-safety-backup-"))entries[key]=localStorage.getItem(key);
    }
    const snapshot={format:"ILOX_LOCAL_BACKUP",version:1,createdAt:new Date().toISOString(),entries};
    localStorage.setItem(backupKey,JSON.stringify(snapshot));
    console.info("ILOX: copia de seguridad local creada antes de actualizar el mundo.",Object.keys(entries).length,"registros.");
    return true;
  }catch(error){
    console.warn("ILOX: no se pudo crear la copia automática completa; no se modificaron los datos guardados.",error);
    return false;
  }
}

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


const ILOX_NIGHTCLUB={x:28,z:-22,width:42,depth:32};
let iloxNightclub=null,iloxClubTrack=null,iloxClubLightClock=0;
function makeIloxNightclub(){
  const group=new THREE.Group();
  group.position.set(ILOX_NIGHTCLUB.x,0,ILOX_NIGHTCLUB.z);
  const dark=new THREE.MeshStandardMaterial({color:0x101326,roughness:.72,metalness:.48});
  const wall=new THREE.MeshStandardMaterial({color:0x171a32,roughness:.78,metalness:.24});
  const neon=new THREE.MeshStandardMaterial({color:0x3d1b72,emissive:0x6d22ff,emissiveIntensity:1.15,roughness:.28,metalness:.35});
  const chrome=new THREE.MeshStandardMaterial({color:0xa7b5d8,metalness:.92,roughness:.2});
  const floor=new THREE.Mesh(new THREE.BoxGeometry(41.5,.28,31.5),dark);floor.position.y=.02;group.add(floor);
  // Salón monumental: paredes laterales y fondo, con entrada frontal abierta.
  const addBox=(w,h,d,x,y,z,mat)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);group.add(m);return m;};
  addBox(1,9.6,32,-20.5,4.9,0,wall);addBox(1,9.6,32,20.5,4.9,0,wall);
  addBox(42,9.6,1,0,4.9,-15.5,wall);
  addBox(14,9.6,1,-14,4.9,15.5,wall);addBox(14,9.6,1,14,4.9,15.5,wall);
  // Techo oscuro sostenido por vigas; deja ver la iluminación interior.
  const roofMat=new THREE.MeshStandardMaterial({color:0x0a0c1b,roughness:.62,metalness:.3,transparent:true,opacity:.86,side:THREE.DoubleSide});
  const roof=new THREE.Mesh(new THREE.BoxGeometry(42,.45,32),roofMat);roof.position.y=10;group.add(roof);
  for(let x=-19;x<=19;x+=9.5){addBox(.34,.42,31.5,x,9.7,0,chrome);addBox(.34,9.5,.34,x,4.9,15,chrome);}
  // Portal principal y rótulo luminoso.
  for(const x of [-7,7]){addBox(.7,9.7,.8,x,4.9,15.7,neon);addBox(1.2,.55,1.1,x,9.8,15.7,chrome);}
  const signCanvas=document.createElement("canvas");signCanvas.width=1024;signCanvas.height=256;
  const ctx=signCanvas.getContext("2d");ctx.fillStyle="#090b20";ctx.fillRect(0,0,1024,256);
  ctx.shadowColor="#ff39e8";ctx.shadowBlur=36;ctx.fillStyle="#ffffff";ctx.font="900 116px Arial";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("ILOX NIGHTCLUB",512,126);
  ctx.shadowBlur=0;ctx.fillStyle="#6efcff";ctx.font="bold 30px Arial";ctx.fillText("MÚSICA OFICIAL · PISTA ABIERTA",512,213);
  const signTex=new THREE.CanvasTexture(signCanvas);signTex.colorSpace=THREE.SRGBColorSpace;
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(17,4.25),new THREE.MeshBasicMaterial({map:signTex,transparent:true,side:THREE.DoubleSide}));
  sign.position.set(0,8.1,16.25);group.add(sign);
  // Pista central con 48 módulos luminosos en una sola llamada de dibujo.
  const danceBase=new THREE.Mesh(new THREE.BoxGeometry(20,.25,15),dark);danceBase.position.set(0,.2,0);group.add(danceBase);
  const tileGeo=new THREE.BoxGeometry(2.35,.13,2.35);
  const tileMat=new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xffffff,emissiveIntensity:.82,metalness:.42,roughness:.24});
  const tiles=new THREE.InstancedMesh(tileGeo,tileMat,48),dummy=new THREE.Object3D();
  const palette=[0xff32c8,0x28eaff,0x7c48ff,0xffc247,0x4dffad,0xffffff];
  let n=0;for(let z=-5;z<=5;z+=2.5)for(let x=-8.75;x<=8.75;x+=2.5){dummy.position.set(x,.42,z);dummy.updateMatrix();tiles.setMatrixAt(n,dummy.matrix);tiles.setColorAt(n,new THREE.Color(palette[(Math.round((x+z)*2)+30+ n)%palette.length]));n++;}
  tiles.instanceMatrix.needsUpdate=true;group.add(tiles);
  // Escenario y cabina de DJ al fondo.
  addBox(17,.8,4,0,.65,-11.2,neon);addBox(15,.32,3.3,0,1.18,-11.2,dark);
  addBox(8,1.4,.55,0,2.05,-12.6,chrome);
  for(const x of [-6,-2,2,6]){addBox(.22,1.5,.24,x,2.1,-12.35,neon);}
  // Columnas de sonido con subwoofers visibles.
  for(const x of [-17.2,17.2])for(const z of [-10,10]){
    addBox(2.1,5.6,1.5,x,2.9,z,dark);
    for(const y of [1.35,3.05,4.45]){
      const speaker=new THREE.Mesh(new THREE.CylinderGeometry(.48,.48,.16,20),chrome);
      speaker.rotation.x=Math.PI/2;speaker.position.set(x,y,z+.82);group.add(speaker);
      const cone=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.18,20),dark);
      cone.rotation.x=Math.PI/2;cone.position.set(x,y,z+.94);group.add(cone);
    }
  }
  // Bola espejada con jaula geométrica.
  const ball=new THREE.Group();ball.position.set(0,8.65,0);
  const sphere=new THREE.Mesh(new THREE.SphereGeometry(.82,18,14),new THREE.MeshStandardMaterial({color:0xdce7ff,metalness:1,roughness:.12}));
  ball.add(sphere);
  const cage=new THREE.Mesh(new THREE.SphereGeometry(.88,12,8),new THREE.MeshBasicMaterial({color:0x91eaff,wireframe:true,transparent:true,opacity:.75}));ball.add(cage);group.add(ball);
  // Haces cónicos de luz y cuatro luces móviles de bajo coste.
  const beams=[],lights=[];
  const beamColors=[0xff20d7,0x19dcff,0x7145ff,0xffd34e];
  for(let j=0;j<4;j++){
    const pivot=new THREE.Group();pivot.position.set(j%2?12:-12,9.25,j<2?-8:8);
    const beamMat=new THREE.MeshBasicMaterial({color:beamColors[j],transparent:true,opacity:.14,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
    const cone=new THREE.Mesh(new THREE.ConeGeometry(3.5,8.7,16,1,true),beamMat);cone.rotation.x=Math.PI;cone.position.y=-4.1;pivot.add(cone);group.add(pivot);beams.push(pivot);
    const light=new THREE.PointLight(beamColors[j],42,30,2);light.position.set(j%2?12:-12,7,j<2?-8:8);group.add(light);lights.push(light);
  }
  // Guirnaldas de neón alrededor del perímetro y entrada.
  for(const z of [-15.8,15.8]){const strip=new THREE.Mesh(new THREE.BoxGeometry(40,.12,.18),neon);strip.position.set(0,9.35,z);group.add(strip);}
  for(const x of [-20.4,20.4]){const strip=new THREE.Mesh(new THREE.BoxGeometry(.18,.12,30),neon);strip.position.set(x,9.35,0);group.add(strip);}
  scene.add(group);
  iloxNightclub={group,ball,beams,lights,beamMaterials:beams.map(b=>b.children[0].material),inside:false,dancing:false};
}
function isIloxNightclubWall(x,z,feet){
  const dx=x-ILOX_NIGHTCLUB.x,dz=z-ILOX_NIGHTCLUB.z;
  if(feet>9.5||feet+PLAYER_HEIGHT<0)return false;
  const side=Math.abs(Math.abs(dx)-20.5)<.72&&Math.abs(dz)<15.8;
  const back=Math.abs(dz+15.5)<.72&&Math.abs(dx)<20.8;
  const front=Math.abs(dz-15.5)<.72&&Math.abs(dx)>7.4&&Math.abs(dx)<20.8;
  return side||back||front;
}
function updateIloxNightclub(delta){
  if(!iloxNightclub)return;
  const now=clock.elapsedTime;
  iloxNightclub.ball.rotation.y+=delta*.9;iloxNightclub.ball.rotation.x+=delta*.34;
  iloxNightclub.beams.forEach((beam,i)=>{beam.rotation.y+=delta*(i%2?-.62:.78);beam.rotation.z=Math.sin(now*.8+i*1.7)*.28;});
  iloxClubLightClock-=delta;
  if(iloxClubLightClock<=0){
    iloxClubLightClock=.12;
    iloxNightclub.lights.forEach((light,i)=>{const hue=(now*.105+i*.235)%1;light.color.setHSL(hue,.95,.58);light.intensity=34+Math.sin(now*3.2+i*2)*9;});
    iloxNightclub.beamMaterials.forEach((mat,i)=>{mat.color.setHSL((now*.105+i*.235)%1,.98,.62);});
  }
  if(!started||!player)return;
  const dx=player.position.x-ILOX_NIGHTCLUB.x,dz=player.position.z-ILOX_NIGHTCLUB.z;
  const inside=Math.abs(dx)<18.9&&dz<15.1&&dz>-14.9;
  // Todo ser vivo colocado dentro del salón entra automáticamente en modo fiesta.
  for(const group of buildGroups){const kind=group.userData.buildRecord?.kind;if(!isLivingBuildKind(kind))continue;const gx=group.position.x-ILOX_NIGHTCLUB.x,gz=group.position.z-ILOX_NIGHTCLUB.z;group.userData.iloxClubDancing=Math.abs(gx)<18.9&&gz<15.1&&gz>-14.9;}
  if(inside&&!iloxNightclub.inside){
    iloxNightclub.inside=true;
    if(!iloxClubTrack){
      iloxClubTrack=new Audio(new URL("./elevator-party.mp3",import.meta.url).href);
      iloxClubTrack.preload="auto";iloxClubTrack.volume=.78;iloxClubTrack.loop=true;
      iloxClubTrack.addEventListener("error",()=>console.warn("ILOX: no se pudo cargar la música de la discoteca"));
    }
    iloxClubTrack.currentTime=0;
    const playback=iloxClubTrack.play();
    if(playback?.catch)playback.catch(error=>console.warn("ILOX: no se pudo reproducir la música de la discoteca",error));
    showToast("🪩 ¡Bienvenido a ILOX NIGHTCLUB!");
  }else if(!inside&&iloxNightclub.inside){
    iloxNightclub.inside=false;
    if(iloxClubTrack){iloxClubTrack.pause();try{iloxClubTrack.currentTime=0;}catch(_){}}
    if(iloxNightclub.dancing&&player){iloxNightclub.dancing=false;player.userData.iloxClubDancing=false;player.userData.iloxDancing=false;if(player.userData.iloxEmote){player.remove(player.userData.iloxEmote);player.userData.iloxEmote.material.map?.dispose();player.userData.iloxEmote.material.dispose();player.userData.iloxEmote=null;}}
  }
  const dance=inside&&Math.abs(dx)<9.7&&dz<7.5&&dz>-7.5;
  if(dance&&!iloxNightclub.dancing){
    iloxNightclub.dancing=true;player.userData.iloxClubDancing=true;player.userData.iloxDancing=true;player.userData.iloxEmoteNext=0;player.userData.iloxDanceStarted=clock.elapsedTime;
  }else if(!dance&&iloxNightclub.dancing){
    iloxNightclub.dancing=false;player.userData.iloxClubDancing=false;player.userData.iloxDancing=false;
    if(player.userData.iloxEmote){player.remove(player.userData.iloxEmote);player.userData.iloxEmote.material.map?.dispose();player.userData.iloxEmote.material.dispose();player.userData.iloxEmote=null;}
  }
}

function updateIloxLivingDance(group,delta){
  const model=group.userData.animalModel,actions=group.userData.animalActions;
  if(!model)return false;
  const dancing=!!group.userData.iloxClubDancing;
  if(dancing){
    if(!group.userData.iloxDanceActive){
      group.userData.iloxDanceActive=true;group.userData.iloxDanceStarted=clock.elapsedTime;
      group.userData.iloxDanceBase={position:model.position.clone(),rotation:model.rotation.clone()};
      model.traverse(bone=>{if(bone.isBone)bone.userData.iloxDanceBase=bone.rotation.clone();});
      const next=actions?.dance;
      if(next&&next!==actions.current){next.reset().fadeIn(.25).play();if(actions.current)actions.current.fadeOut(.25);actions.current=next;}
    }
    const t=clock.elapsedTime-group.userData.iloxDanceStarted,phase=t*Math.PI*2*1.92,base=group.userData.iloxDanceBase;
    // Baile universal: rebote, balanceo y giro suave, incluso en modelos sin clips de baile.
    model.position.y=base.position.y+Math.abs(Math.sin(phase))*.105;
    model.rotation.x=base.rotation.x+Math.sin(phase)*.075;
    model.rotation.z=base.rotation.z+Math.sin(phase*.5)*.17;
    model.rotation.y=base.rotation.y+Math.sin(phase*.5)*.16;
    model.traverse(bone=>{
      if(!bone.isBone||!bone.userData.iloxDanceBase)return;
      const name=bone.name.toLowerCase(),b=bone.userData.iloxDanceBase;
      if(/tail|cola/.test(name))bone.rotation.y=b.y+Math.sin(phase*.5)*.48;
      else if(/arm|hand|wing|ala/.test(name)){const side=/left|izq/.test(name)?-1:1;bone.rotation.x=b.x+Math.sin(phase+side)*.48;bone.rotation.z=b.z+side*(.16+Math.max(0,Math.sin(phase*.5+side))*.42);}
      else if(/leg|foot|paw|pierna|pata/.test(name))bone.rotation.x=b.x+Math.sin(phase+(/left|izq/.test(name)?0:Math.PI))*.36;
      else if(/neck|head|cuello|cabeza/.test(name))bone.rotation.z=b.z+Math.sin(phase*.5)*.08;
    });
    return true;
  }
  if(group.userData.iloxDanceActive){
    group.userData.iloxDanceActive=false;
    const base=group.userData.iloxDanceBase||group.userData.animalModelBase;
    if(base){model.position.copy(base.position);model.rotation.copy(base.rotation);}
    model.traverse(bone=>{if(bone.isBone&&bone.userData.iloxDanceBase){bone.rotation.copy(bone.userData.iloxDanceBase);delete bone.userData.iloxDanceBase;}});
    const next=actions?.idle||actions?.walk;
    if(next&&next!==actions.current){next.reset().fadeIn(.3).play();if(actions.current)actions.current.fadeOut(.3);actions.current=next;}
  }
  return false;
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
    const scale = PLAYER_HEIGHT / Math.max(size.y, 0.001);
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

async function loadRemoteAvatarModel(character, kind) {
  const [avatarType, variantText = "0"] = String(kind).split(":");
  const variant = Number(variantText) || 0;
  const avatarUrl = avatarType === "soldier" ? RIGGED_AVATAR_URL :
    HUMAN_AVATAR_MODELS[avatarType]?.[variant % (HUMAN_AVATAR_MODELS[avatarType]?.length || 1)];
  if (!avatarUrl) { character.userData.remoteModelLoading = false; return; }
  const token = (character.userData.remoteModelToken || 0) + 1;
  character.userData.remoteModelToken = token;
  let promise = remoteAvatarModelPromises.get(avatarUrl);
  if (!promise) {
    promise = (avatarType === "soldier" ? avatarModelLoader : HUMAN_MODEL_LOADER).loadAsync(avatarUrl);
    remoteAvatarModelPromises.set(avatarUrl, promise);
    promise.catch(() => remoteAvatarModelPromises.delete(avatarUrl));
  }
  try {
    const gltf = await promise;
    if (!remotePlayers.has(character.userData.remoteUserId) || character.userData.remoteModelToken !== token) return;
    const model = cloneSkeleton(gltf.scene);
    if (avatarType !== "soldier") model.rotation.y = Math.PI;
    // Normalización remota: medir con la escala original del GLB y volver
    // a medir tras escalar, dejando los pies en el suelo.
    model.scale.set(1,1,1);
    model.updateMatrixWorld(true);
    let bounds = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3(); bounds.getSize(size);
    if (!Number.isFinite(size.y) || size.y < 0.0001) throw new Error("El modelo remoto no tiene una altura válida.");
    const scale = PLAYER_HEIGHT / size.y;
    model.scale.setScalar(scale);
    model.updateMatrixWorld(true);
    bounds = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3(); bounds.getCenter(center);
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= bounds.min.y;
    model.updateMatrixWorld(true);
    const fittedBounds = new THREE.Box3().setFromObject(model);
    const fittedSize = new THREE.Vector3(); fittedBounds.getSize(fittedSize);
    if (!Number.isFinite(fittedSize.y) || fittedSize.y < 1.2 || fittedSize.y > 2.5) {
      throw new Error("La escala final del avatar remoto quedó fuera del rango humano.");
    }
    model.traverse(object => {
      if (!object.isMesh) return;
      object.castShadow = true; object.receiveShadow = true;
    });
    while (character.children.length) character.remove(character.children[0]);
    character.add(model);
    model.userData.remoteBaseY=model.position.y;
    character.userData.riggedMixer = new THREE.AnimationMixer(model);
    character.userData.actions = {};
    for (const clip of gltf.animations) {
      const name = clip.name.toLowerCase();
      if (name.includes("idle")) character.userData.actions.idle = character.userData.riggedMixer.clipAction(clip);
      else if (name.includes("walk")) character.userData.actions.walk = character.userData.riggedMixer.clipAction(clip);
      else if (name.includes("run")) character.userData.actions.run = character.userData.riggedMixer.clipAction(clip);
    }
    const idle = character.userData.actions.idle || (gltf.animations[0] && character.userData.riggedMixer.clipAction(gltf.animations[0]));
    if (idle) { idle.play(); character.userData.currentAction = idle; }
    character.userData.riggedAvatar = true;
  } catch (error) {
    console.warn("ILOX multiplayer: no se pudo cargar el modelo remoto", kind, error);
  } finally {
    if (character.userData.remoteModelToken === token) character.userData.remoteModelLoading = false;
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
  // Arroyo escénico en el borde occidental: mantiene libre la gran zona central de construcción.
  const positions = [], uvs = [], indices = [], steps = 180;
  for (let i = 0; i <= steps; i++) {
    const z = -worldSize / 2 + (i / steps) * worldSize;
    const x = -132 + Math.sin(z * .025) * 5.5 + Math.sin(z * .061) * 2.2;
    const width = 2.7 + Math.sin(i * .16) * .45;
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
    const x=(random()-.5)*290,z=(random()-.5)*290;
    const riverX=-132+Math.sin(z*.025)*5.5+Math.sin(z*.061)*2.2;
    if(Math.hypot(x,z)<82||Math.abs(x-riverX)<7) dummy.position.set(0,-100,0);
    else dummy.position.set(x,terrainHeight(x,z)+.18,z);
    const scale=.45+random()*.9;
    dummy.scale.set(scale,scale,scale); dummy.rotation.y=random()*Math.PI*2; dummy.updateMatrix(); grass.setMatrixAt(i,dummy.matrix);
  }
  grass.instanceMatrix.needsUpdate=true; scene.add(grass);
}
function makeNaturePerimeter(){
  // Naturaleza determinista y periférica: no modifica la cota del terreno ni la zona central de obras.
  const random=seededRandom(20261116);
  for(let i=0;i<42;i++){
    const angle=random()*Math.PI*2,radius=86+random()*55;
    const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
    const riverX=-132+Math.sin(z*.025)*5.5+Math.sin(z*.061)*2.2;
    if(Math.abs(x-riverX)<11)continue;
    makeTree(x,z,.72+random()*.65,random);
  }
  for(let i=0;i<30;i++){
    const angle=random()*Math.PI*2,radius=82+random()*58;
    const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
    const riverX=-132+Math.sin(z*.025)*5.5+Math.sin(z*.061)*2.2;
    if(Math.abs(x-riverX)<9)continue;
    makeRock(x,z,.35+random()*1.1,random);
  }
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
  const isToon = ["burbu","marea","pipo","zarpa","luma"].includes(kind);
  const isFemale = kind === "woman" || kind === "girl";
  const adult = kind === "woman" || isBuilder || kind === "knight";
  const scale = adult ? 1 : 0.94;
  const mat = (color, roughness = 0.86, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const skinTones = [0xd49a76,0xb97855,0x8e5b42,0xe0b18d,0x70452f];
  const toonSkinColors = {burbu:0xffd95c,marea:0xffa0a0,pipo:0xc98b65,zarpa:0x536b86,luma:0xd99bcf};
  const skin = mat(isToon ? toonSkinColors[kind] : kind === "girl" ? 0xc98b65 : kind === "woman" ? 0xb97855 : skinTones[variant % skinTones.length], 0.92);
  const hairColors = [0x30231d,0x5a321f,0x171717,0x9a6734,0x6d344f,0x344b72,0xb5a06c,0x4c6b47,0x773c2b,0xaaa7a0];
  const hair = mat(hairColors[(variant + (kind === "girl" ? 2 : 0)) % hairColors.length], 1);
  const shirtColor = isBuilder ? 0x263c36 : isAstronaut ? 0xe2e7e9 : isRobot ? 0x536a79 : kind === "girl" ? 0x8a547f : kind === "woman" ? 0x315d76 : 0x315a8c;
  const palette = [0x315a8c,0x8a547f,0x386b52,0x9b542f,0x5b5b91,0x9b813c,0x347d86,0x873d4c,0x596b39,0x6b5547];
  const toonShirtColors = {burbu:0xffc928,marea:0x38b9d4,pipo:0xf0793c,zarpa:0x42536d,luma:0x9a64bd};
  const shirt = mat(isToon ? toonShirtColors[kind] : isBuilder ? shirtColor : isAstronaut ? shirtColor : isRobot ? shirtColor : palette[variant % palette.length]);
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

  if (isToon) {
    const fur = mat(kind==="burbu"?0xffd22e:kind==="marea"?0xf49a9b:kind==="pipo"?0xc98b65:kind==="zarpa"?0x536b86:0xc56bc2,0.88);
    const accent = mat(kind==="burbu"?0x2d9e9a:kind==="marea"?0x4a9ec2:kind==="pipo"?0x35c4c8:kind==="zarpa"?0x7cc7c2:0x573c88,0.82);
    const eyeWhite = mat(0xfffaf0,0.48), pupil = mat(0x202536,0.42), blush = mat(0xf28b83,0.8);
    if(kind==="burbu"){
      add(rig,new THREE.SphereGeometry(.43,24,20),fur,0,1.38,0,1.08,1.26,.78);
      add(rig,new THREE.SphereGeometry(.31,24,18),fur,0,2.10,-.015,1.05,.94,.88);
      for(const side of [-1,1]){add(rig,new THREE.SphereGeometry(.095,16,12),eyeWhite,side*.115,2.13,-.265);add(rig,new THREE.SphereGeometry(.047,12,10),pupil,side*.115,2.13,-.345);add(rig,new THREE.SphereGeometry(.045,12,10),blush,side*.235,1.99,-.19);}
      add(rig,new THREE.TorusGeometry(.075,.012,6,18,Math.PI),pupil,0,1.98,-.29);
      for(let i=0;i<4;i++)add(rig,new THREE.SphereGeometry(.035,8,8),accent,(i-1.5)*.18,1.48+(i%2)*.13,-.31);
      add(rig,new THREE.SphereGeometry(.13,12,10),accent,0,1.77,.03,1,.48,.8);
    } else if(kind==="marea"){
      const star=new THREE.Shape();
      for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2===0?.57:.29,x=Math.cos(a)*r,y=Math.sin(a)*r;i===0?star.moveTo(x,y):star.lineTo(x,y);}
      star.closePath();
      const starMesh=add(rig,new THREE.ShapeGeometry(star),fur,0,1.45,0,1,1.12,1);starMesh.rotation.y=Math.PI;
      add(rig,new THREE.SphereGeometry(.20,18,14),accent,0,1.40,-.035,1.15,1.15,.28);
      for(const side of [-1,1]){add(rig,new THREE.SphereGeometry(.075,14,12),eyeWhite,side*.13,1.88,-.045);add(rig,new THREE.SphereGeometry(.034,10,8),pupil,side*.13,1.88,-.105);}
      add(rig,new THREE.TorusGeometry(.065,.012,6,16,Math.PI),pupil,0,1.72,-.07);
      add(rig,new THREE.SphereGeometry(.055,10,8),blush,-.29,1.67,-.04);add(rig,new THREE.SphereGeometry(.055,10,8),blush,.29,1.67,-.04);
    } else if(kind==="pipo"){
      add(rig,new THREE.CapsuleGeometry(.34,.48,6,14),shirt,0,1.34,0,1.04,1,.8);
      add(rig,new THREE.SphereGeometry(.30,22,18),skin,0,2.06,-.015,1,.98,.9);
      for(const side of [-1,1]){add(rig,new THREE.SphereGeometry(.065,14,12),eyeWhite,side*.105,2.09,-.265);add(rig,new THREE.SphereGeometry(.03,10,8),pupil,side*.105,2.09,-.325);add(rig,new THREE.SphereGeometry(.025,8,8),blush,side*.21,1.99,-.24);}
      add(rig,new THREE.CapsuleGeometry(.014,.07,3,6),pupil,0,1.96,-.285);
      const curls=mat(0x6b3828,0.94);
      add(rig,new THREE.SphereGeometry(.29,18,12,0,Math.PI*2,0,Math.PI*.52),curls,0,2.25,.02,1.08,.68,1);
      for(let i=0;i<5;i++){const a=-Math.PI*.82+i*Math.PI*.41;add(rig,new THREE.SphereGeometry(.105,12,10),curls,Math.cos(a)*.23,2.30+Math.sin(a)*.10,-.08);}
      add(rig,new THREE.TorusGeometry(.25,.065,8,20),accent,0,1.78,-.015,1,.55,.72);
      add(rig,new THREE.BoxGeometry(.11,.42,.035),accent,-.22,1.38,-.315);
      add(rig,new THREE.BoxGeometry(.11,.42,.035),accent,.22,1.38,-.315);
    } else if(kind==="zarpa"){
      add(rig,new THREE.SphereGeometry(.34,22,18),fur,0,1.38,0,1.02,1.20,.82);
      add(rig,new THREE.SphereGeometry(.30,22,18),fur,0,2.08,0,1.08,.98,.88);
      for(const side of [-1,1]){const ear=add(rig,new THREE.ConeGeometry(.12,.34,8),fur,side*.21,2.43,0);ear.rotation.z=side*-.22;add(rig,new THREE.ConeGeometry(.055,.22,8),accent,side*.21,2.43,-.018);add(rig,new THREE.SphereGeometry(.07,14,12),eyeWhite,side*.11,2.11,-.255);add(rig,new THREE.SphereGeometry(.033,10,8),pupil,side*.11,2.11,-.315);}
      add(rig,new THREE.SphereGeometry(.12,14,10),accent,0,1.99,-.27,1.25,.72,.65);
      add(rig,new THREE.SphereGeometry(.045,10,8),pupil,0,2.03,-.335);
    } else {
      add(rig,new THREE.CapsuleGeometry(.29,.62,6,12),fur,0,1.38,0,1.08,1.22,.78);
      add(rig,new THREE.SphereGeometry(.28,20,16),fur,0,2.10,-.015,1,.98,.88);
      for(const side of [-1,1]){const ear=add(rig,new THREE.CapsuleGeometry(.065,.30,4,8),fur,side*.18,2.47,.015,1,.72,1);ear.rotation.z=side*-.18;add(rig,new THREE.SphereGeometry(.07,12,10),eyeWhite,side*.10,2.12,-.255);add(rig,new THREE.SphereGeometry(.032,10,8),pupil,side*.10,2.12,-.315);}
      add(rig,new THREE.CylinderGeometry(.035,.035,.40,8),accent,0,1.70,-.30,1,1,.35);
      add(rig,new THREE.SphereGeometry(.10,12,10),accent,0,1.48,-.31,1.3,.7,.5);
    }
  } else if (isRobot) {
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

  // Mochila de lona para exploradores; la pandilla toon lleva su propio emblema.
  if(!isToon){
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
  }else{
    add(rig,new THREE.CircleGeometry(.11,20),mat(0xfff0bd),0,1.25,-.34);
    add(rig,new THREE.BoxGeometry(.10,.025,.012),mat(0x283c4c),0,1.25,-.455);
  }

  // Variantes fantásticas con siluetas reconocibles, no solo cambios de color.
  if (kind === "elf") { for (const side of [-1,1]) { const ear=add(rig,new THREE.ConeGeometry(.09,.34,8),skin,side*.34,2.06,-.01); ear.rotation.z=side*-Math.PI/2; } }
  if (kind === "knight") { const armor=mat(0x87939d,.38,.62); add(rig,new THREE.CapsuleGeometry(.37,.48,5,12),armor,0,1.36,-.02,1.12,1,.82); add(rig,new THREE.SphereGeometry(.31,18,14),armor,0,2.08,0,1.05,1,.95); add(rig,new THREE.BoxGeometry(.43,.12,.08),dark,0,2.05,-.27); }
  if (kind === "ninja") { const mask=mat(0x252735); add(rig,new THREE.BoxGeometry(.43,.20,.12),mask,0,1.99,-.25); add(rig,new THREE.BoxGeometry(.48,.10,.20),hair,0,2.28,0); }
  if (kind === "mage") { const robe=mat(0x493b78); add(rig,new THREE.CylinderGeometry(.22,.43,.85,16),robe,0,1.14,0); add(rig,new THREE.ConeGeometry(.34,.55,16),robe,0,2.40,0); }
  if (kind === "orc") { const tusk=mat(0xf0e6ce); for(const side of [-1,1]) add(rig,new THREE.ConeGeometry(.055,.20,8),tusk,side*.13,1.94,-.26); add(rig,new THREE.SphereGeometry(.32,18,14),mat(0x66834d),0,2.05,-.01,1.05,1.08,.92); }
  if (kind === "fairy") { const wing=mat(0x9edbe0,.3,.15); for(const side of [-1,1]) { const w=add(rig,new THREE.SphereGeometry(.22,16,12),wing,side*.40,1.62,.25,1.25,1.7,.28); w.rotation.z=side*.35; } }
  let toonTail=null;
  if(kind==="zarpa"||kind==="luma"){
    toonTail=new THREE.Group();toonTail.position.set(0,1.12,.30);rig.add(toonTail);
    const points=kind==="zarpa"?[new THREE.Vector3(0,0,0),new THREE.Vector3(.16,.02,.30),new THREE.Vector3(.24,.16,.58),new THREE.Vector3(.12,.34,.72)]:[new THREE.Vector3(0,0,0),new THREE.Vector3(-.10,.02,.32),new THREE.Vector3(-.22,.18,.62),new THREE.Vector3(-.12,.34,.86)];
    const tailCurve=new THREE.CatmullRomCurve3(points);
    const tailMat=mat(kind==="zarpa"?0x536b86:0xc56bc2,.9);
    const tailMesh=new THREE.Mesh(new THREE.TubeGeometry(tailCurve,16,.075,8,false),tailMat);tailMesh.castShadow=true;toonTail.add(tailMesh);
  }
  // Ajuste de tonos y rasgos por variante para que las cien opciones se distingan.
  group.scale.setScalar(scale);
  group.position.set(0,terrainHeight(0,0),0);
  group.userData.avatarKind=kind;
  group.userData.toonTail=toonTail;
  group.userData.toonType=isToon?kind:null;
  group.userData.legs=legs;
  group.userData.arms=arms;
  group.userData.rig=rig;
  scene.add(group);
  return group;

  function leatherMaterial() { return mat(0x49382a,1); }
}
function isToonType(type){return ["burbu","marea","pipo","zarpa","luma"].includes(type);}

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
  createJumpCanvasControl();
  createRunCanvasControl();
  scene.add(new THREE.HemisphereLight(0xeaf3ed, 0x46533c, 1.8));
  const sun = new THREE.DirectionalLight(0xffe7c0, 3.1);
  sun.position.set(-55, 85, 42);
  scene.add(sun);
  // Respaldo local previo a cualquier actualización visual del mundo.
  backupIloxLocalData();
  // Entorno natural V102 adaptado: la llanura central y la cota de las construcciones se conservan.
  makeDistantMountains();
  makeTerrain();
  makeMeadowDetails();
  makeRiver();
  makeNaturePerimeter();
  makeIloxNightclub();
  clock = new THREE.Clock();
  camera.position.set(0, terrainHeight(0,0) + 4.1, 8.5);
  camera.lookAt(0, terrainHeight(0,0) + 1.2, 0);
  addEvents();
  animate();
  requestAnimationFrame(() => loading.classList.add("done"));
}

function createJumpCanvasControl(){
  const canvas=document.createElement("canvas");
  canvas.id="ilox-jump-canvas";
  // El control es una capa HUD: fijar sus dimensiones aquí evita que la regla global canvas lo convierta en pantalla completa.
  for(const [prop,value] of Object.entries({
    position:"absolute",left:"auto",top:"auto",right:"max(12px, env(safe-area-inset-right))",
    bottom:"max(14px, env(safe-area-inset-bottom))",width:"68px",height:"68px",
    minWidth:"68px",minHeight:"68px",maxWidth:"68px",maxHeight:"68px",
    zIndex:"46",pointerEvents:"auto",touchAction:"none",
    userSelect:"none",webkitUserSelect:"none"
  })) canvas.style.setProperty(prop.replace(/[A-Z]/g,m=>"-"+m.toLowerCase()),value,"important");
  canvas.style.setProperty("width","68px","important");
  canvas.style.setProperty("height","68px","important");
  canvas.setAttribute("role","img");
  canvas.setAttribute("aria-label","Control gráfico para saltar");
  canvas.width=224;canvas.height=224;
  const ctx=canvas.getContext("2d");
  let pressed=false,activePointer=null;
  const draw=()=>{
    if(!ctx)return;
    ctx.clearRect(0,0,224,224);
    const cx=112,cy=112,r=98;
    ctx.save();
    ctx.shadowColor=pressed?"#ff263f":"#000000a8";
    ctx.shadowBlur=pressed?24:16;ctx.shadowOffsetY=pressed?3:7;
    const fill=ctx.createRadialGradient(78,62,8,112,112,r);
    if(pressed){fill.addColorStop(0,"#ff9a9a");fill.addColorStop(.58,"#f12b45");fill.addColorStop(1,"#85051d");}
    else{fill.addColorStop(0,"#ffb5b5");fill.addColorStop(.52,"#ed263d");fill.addColorStop(1,"#8f061d");}
    ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();
    ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.lineWidth=7;ctx.strokeStyle="#ffe0e4";ctx.stroke();
    ctx.beginPath();ctx.arc(cx,cy,r-12,Math.PI*1.08,Math.PI*1.92);ctx.strokeStyle="#ffffff65";ctx.lineWidth=3;ctx.stroke();
    ctx.fillStyle="#fff";ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.font="900 82px system-ui, sans-serif";ctx.fillText("↑",cx,cy-13);
    ctx.font="1000 23px system-ui, sans-serif";ctx.letterSpacing="2px";ctx.fillText("SALTAR",cx,cy+59);
    ctx.restore();
  };
  const release=e=>{
    if(e&&activePointer!==null&&e.pointerId!==activePointer)return;
    activePointer=null;pressed=false;draw();
  };
  canvas.addEventListener("pointerdown",e=>{
    e.preventDefault();e.stopPropagation();
    if(!started||activePointer!==null||e.button!==0)return;
    const rect=canvas.getBoundingClientRect();
    const x=(e.clientX-rect.left)/rect.width*224-112;
    const y=(e.clientY-rect.top)/rect.height*224-112;
    if(Math.hypot(x,y)>101)return;
    activePointer=e.pointerId;pressed=true;
    try{canvas.setPointerCapture(e.pointerId);}catch{}
    draw();triggerJump();
  });
  canvas.addEventListener("pointerup",e=>{e.preventDefault();e.stopPropagation();release(e);});
  canvas.addEventListener("pointercancel",e=>{e.preventDefault();e.stopPropagation();release(e);});
  canvas.addEventListener("lostpointercapture",release);
  canvas.addEventListener("contextmenu",e=>{e.preventDefault();e.stopPropagation();});
  addEventListener("blur",()=>release());
  game.appendChild(canvas);draw();return canvas;
}


function createRunCanvasControl(){
  const canvas=document.createElement("canvas");
  canvas.id="ilox-run-canvas";
  // Control diagonal al SALTAR: separado unos pocos píxeles y con tamaño blindado.
  for(const [prop,value] of Object.entries({
    position:"absolute",left:"auto",top:"auto",
    right:"calc(max(12px, env(safe-area-inset-right)) + 52px)",
    bottom:"calc(max(14px, env(safe-area-inset-bottom)) + 52px)",
    width:"68px",height:"68px",minWidth:"68px",minHeight:"68px",
    maxWidth:"68px",maxHeight:"68px",zIndex:"46",pointerEvents:"auto",
    touchAction:"none",userSelect:"none"
  })) canvas.style.setProperty(prop.replace(/[A-Z]/g,m=>"-"+m.toLowerCase()),value,"important");
  canvas.style.setProperty("width","68px","important");
  canvas.style.setProperty("height","68px","important");
  canvas.setAttribute("role","img");
  canvas.setAttribute("aria-label","Mantener presionado para correr");
  canvas.width=224;canvas.height=224;
  const ctx=canvas.getContext("2d");
  let pressed=false,activePointer=null;
  const draw=()=>{
    if(!ctx)return;
    ctx.clearRect(0,0,224,224);
    const cx=112,cy=112,r=98;
    ctx.save();
    ctx.shadowColor=pressed?"#42f5a2":"#000000a8";
    ctx.shadowBlur=pressed?24:16;ctx.shadowOffsetY=pressed?3:7;
    const fill=ctx.createRadialGradient(78,62,8,112,112,r);
    if(pressed){fill.addColorStop(0,"#b8ffda");fill.addColorStop(.58,"#12b978");fill.addColorStop(1,"#075c42");}
    else{fill.addColorStop(0,"#aaffd1");fill.addColorStop(.52,"#16a66d");fill.addColorStop(1,"#07583d");}
    ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();
    ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.lineWidth=7;ctx.strokeStyle="#d8ffeb";ctx.stroke();
    ctx.beginPath();ctx.arc(cx,cy,r-12,Math.PI*1.08,Math.PI*1.92);ctx.strokeStyle="#ffffff65";ctx.lineWidth=3;ctx.stroke();
    ctx.fillStyle="#fff";ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.font="900 67px system-ui, sans-serif";ctx.fillText("»",cx,cy-13);
    ctx.font="1000 22px system-ui, sans-serif";ctx.letterSpacing="1.5px";ctx.fillText("CORRER",cx,cy+58);
    ctx.restore();
  };
  const release=e=>{
    if(e&&activePointer!==null&&e.pointerId!==activePointer)return;
    activePointer=null;pressed=false;sprintHeld=false;draw();
  };
  canvas.addEventListener("pointerdown",e=>{
    e.preventDefault();e.stopPropagation();
    if(!started||activePointer!==null||e.button!==0)return;
    const rect=canvas.getBoundingClientRect();
    const x=(e.clientX-rect.left)/rect.width*224-112;
    const y=(e.clientY-rect.top)/rect.height*224-112;
    if(Math.hypot(x,y)>101)return;
    activePointer=e.pointerId;pressed=true;sprintHeld=true;
    try{canvas.setPointerCapture(e.pointerId);}catch{}
    draw();
  });
  canvas.addEventListener("pointerup",e=>{e.preventDefault();e.stopPropagation();release(e);});
  canvas.addEventListener("pointercancel",e=>{e.preventDefault();e.stopPropagation();release(e);});
  canvas.addEventListener("lostpointercapture",release);
  canvas.addEventListener("contextmenu",e=>{e.preventDefault();e.stopPropagation();});
  addEventListener("blur",()=>release());
  game.appendChild(canvas);draw();return canvas;
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
  cameraFreePad?.addEventListener("pointerdown", e => {
    if (!started || !cameraFreeMode || cameraFreePointer !== null || e.button !== 0) return;
    e.preventDefault(); e.stopPropagation(); cameraFreePointer=e.pointerId;
    cameraFreePad.setPointerCapture(e.pointerId); updateCameraFreeStick(e);
  });
  cameraFreePad?.addEventListener("pointermove", e => {
    if (e.pointerId !== cameraFreePointer) return;
    e.preventDefault(); updateCameraFreeStick(e);
  });
  const resetCameraFreeStick = e => {
    if (e && e.pointerId !== cameraFreePointer) return;
    cameraFreePointer=null; cameraFreeStick.x=0; cameraFreeStick.y=0;
    if(cameraFreeKnob)cameraFreeKnob.style.transform="translate(-50%, -50%)";
  };
  cameraFreePad?.addEventListener("pointerup", resetCameraFreeStick);
  cameraFreePad?.addEventListener("pointercancel", resetCameraFreeStick);
  const setCameraVertical = value => { cameraFreeVertical=value; };
  [cameraFreeUp,cameraFreeDown].forEach((button,index)=>{
    if(!button)return;
    button.addEventListener("pointerdown",e=>{
      if(!started||!cameraFreeMode||e.button!==0)return;
      e.preventDefault();e.stopPropagation();
      setCameraVertical(index===0?1:-1);
      button.setPointerCapture?.(e.pointerId);
    });
    const stop=()=>setCameraVertical(0);
    button.addEventListener("pointerup",stop);
    button.addEventListener("pointercancel",stop);
    button.addEventListener("lostpointercapture",stop);
  });
  game.addEventListener("pointerdown", e => {
    buildPointer={x:e.clientX,y:e.clientY};
    if (e.target.closest("#ilox-jump-canvas") || e.target.closest("button") || e.target.closest("#move-pad") || e.target.closest("#camera-free-pad") || e.target.closest("#camera-free-controls") || e.target.closest("#build-panel") || e.target.closest("#menu-panel") || e.target.closest("#menu-toggle")) return;
    activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(activePointers.size===2){const p=[...activePointers.values()];pinchStartDistance=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);pinchStartZoom=cameraFreeMode?cameraFreeZoom:cameraDistance;pointerDragged=true;}
    lookPointer = e.pointerId;
    lastLookX = lookStartX = e.clientX;
    lastLookY = lookStartY = e.clientY;
    pointerDragged = false;
    if (game.setPointerCapture) game.setPointerCapture(e.pointerId);
  });
  game.addEventListener("pointermove", e => {
    buildPointer={x:e.clientX,y:e.clientY};
    if(activePointers.has(e.pointerId)) activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(activePointers.size>=2){const p=[...activePointers.values()];const d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);const zoom=THREE.MathUtils.clamp(pinchStartZoom*(pinchStartDistance/Math.max(1,d)),4,100);if(cameraFreeMode&&cameraFreePosition){const dolly=cameraFreeZoom-zoom;cameraFreePosition.x+=-Math.sin(cameraFreeYaw)*Math.cos(cameraFreePitch)*dolly;cameraFreePosition.y+=Math.sin(cameraFreePitch)*dolly;cameraFreePosition.z+=-Math.cos(cameraFreeYaw)*Math.cos(cameraFreePitch)*dolly;cameraFreeZoom=zoom;}else cameraDistance=zoom;return;}
    if (lookPointer !== e.pointerId || !started) return;
    const dx = e.clientX - lastLookX;
    const dy = e.clientY - lastLookY;
    if (Math.hypot(e.clientX-lookStartX,e.clientY-lookStartY)>7) pointerDragged = true;
    lastLookX = e.clientX;
    lastLookY = e.clientY;
    // Cámara libre compartida por primera, segunda, tercera persona y bloqueo.
    // Arrastrar el dedo hacia arriba mira al cielo; hacia abajo, al suelo.
    // Giro horizontal completo y vertical casi de cenit a nadir, en las tres vistas.
    if(cameraFreeMode&&cameraFreePosition&&activePointers.size===1){
      cameraFreeYaw -= dx * 0.0048;
      cameraFreePitch = THREE.MathUtils.clamp(cameraFreePitch - dy * 0.0048, -1.48, 1.48);
    }else if(!cameraFreeMode){
      yaw -= dx * 0.0048;
      pitch = THREE.MathUtils.clamp(pitch - dy * 0.0048, -1.565, 1.565);
    }
  });
  elevatorPanel?.addEventListener("click",e=>{const key=e.target.closest("[data-floor]");if(key){const max=Math.max(1,Math.min(40,activeElevator?.userData.buildRecord?.floorCount||40));elevatorSelectedFloor=THREE.MathUtils.clamp(Math.round(Number(key.dataset.floor)||1),1,max);elevatorPanel.querySelectorAll(".elevator-key").forEach(button=>button.classList.toggle("selected",button===key));updateElevatorDisplay();return;}if(e.target.closest("#elevator-ok"))confirmElevatorTravel(activeElevator);});
  document.querySelector("#elevator-keypad-close")?.addEventListener("click",closeElevatorKeypad);
  elevatorCallButton?.addEventListener("click",()=>{callElevator(activeElevator);setHudDockOpen(false);});
  elevatorDoorOpenButton?.addEventListener("click",()=>{if(setElevatorDoorState(activeElevator,true,true,true))showToast("Puertas abiertas.");});
  elevatorDoorCloseButton?.addEventListener("click",()=>{if(setElevatorDoorState(activeElevator,false,true,true))showToast("Puertas cerradas.");});
  game.addEventListener("pointerup", e => {
    activePointers.delete(e.pointerId);
    if (lookPointer !== e.pointerId) return;
    if (started && !pointerDragged && activePointers.size===0) {
      if(buildMode){const before=buildRecords.length;placeBuildAtPointer(e);if(buildRecords.length>before)setHudDockOpen(false);}
      else if(!tryElevatorConsoleAtPointer(e))toggleDoorAtPointer(e);
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
    ["knight","🛡️","Caballero",7],["ninja","🥷","Ninja",7],["mage","🧙","Mago",7],
    ["burbu","🫧","Burbu",1],["marea","⭐","Marea",1],["pipo","🧢","Pipo",1],["zarpa","🐈","Zarpa",1],["luma","🦊","Luma",1]
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
      otherHeading.textContent="FANTASÍA Y ROBÓTICOS ORIGINALES";
      avatarGrid.appendChild(otherHeading);
    }
    if(type==="burbu"){
      const toonHeading=document.createElement("div");
      toonHeading.className="avatar-section-title";
      toonHeading.textContent="ILOX TOON CREW · PERSONAJES ORIGINALES";
      avatarGrid.appendChild(toonHeading);
    }
    for (let variant=0; variant<count; variant++) {
      const option=document.createElement("button");
      const human=!!HUMAN_AVATAR_MODELS[type];
      const displayName=HUMAN_AVATAR_LABELS[type]?.[variant] || label+(count>1?" "+(variant+1):"");
      option.className="avatar-option"+(human?" human-avatar":"")+(firstAvatar?" selected":"");
      option.dataset.avatar=type+":"+variant;
      const toon=isToonType(type);
      option.innerHTML='<span class="avatar-emoji">'+emoji+'</span><strong>'+displayName+'</strong><small>'+(human?"MODELO HUMANO 3D · ANIMADO":toon?"3D ORIGINAL · ANIMADO":"Modelo "+String(variant+1).padStart(2,"0"))+'</small>';
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
  enterWorldButton.addEventListener("click", async () => {
    const firstEntry = !started;
    const oldPosition=player?player.position.clone():new THREE.Vector3(0,terrainHeight(0,0),0);
    const oldHeading=player?player.rotation.y:yaw;
    if (player) scene.remove(player);
    player = makePlayer(selectedAvatar);
    player.position.copy(oldPosition);player.rotation.y=oldHeading;
    if(activeMultiplayerWorldId)spawnPlayerAtMultiplayerMeetingPoint();
    started = true;
    document.querySelector("#mp-chat-toggle")?.classList.remove("hidden");
    game.classList.add("playing");
    if (welcomeScene) {
      welcomeScene.classList.add("hidden");
      welcomeScene.style.display = "none";
    }
    if (welcome) welcome.style.display = "none";
    loading?.classList.add("done");
    if (renderer?.domElement) renderer.domElement.style.visibility = "visible";
    hudDock.classList.remove("hidden");
    cameraControls.classList.add("hidden");
    // El control plegable fue eliminado: el zócalo queda siempre visible.
    loadRiggedAvatar(selectedAvatar);
    if(multiplayerSession) Multiplayer.updateMyAvatar(selectedAvatar).catch(error=>console.warn("ILOX multiplayer: no se pudo actualizar el avatar",error));
    avatarSelect.classList.add("hidden");

    if (hint) hint.textContent = "";

    if (firstEntry && !activeMultiplayerWorldId) {
      showToast("Buscando tu mundo compartido…");
      try {
        const resumed = await resumeSavedMultiplayerWorld();
        if (!resumed && !activeMultiplayerWorldId) loadBuilds();
      } catch (error) {
        console.warn("ILOX multiplayer: no se pudo recuperar la última partida", error);
        if (!activeMultiplayerWorldId) loadBuilds();
        openMultiplayerDialog();
        showMultiplayerBranch("load");
        showMultiplayerError(error);
      }
    } else if (!activeMultiplayerWorldId) {
      loadBuilds();
    }

    if (activeMultiplayerWorldId) showToast("¡Estás en el mundo compartido!");
    else if (!firstEntry) showToast("¡Personaje actualizado!");
  });
  const applyCameraMode = mode => {
    if (cameraLocked && mode === "first") mode = "second";
    const enteringFree = mode === "free" && !cameraFreeMode;
    cameraMode = mode;
    cameraFreeMode = mode === "free";
    if(enteringFree){
      if(player){
        cameraFreePosition = new THREE.Vector3(
          player.position.x - Math.sin(yaw)*5.2,
          player.position.y + 2.6,
          player.position.z - Math.cos(yaw)*5.2
        );
        cameraFreeYaw = yaw + Math.PI;
        cameraFreePitch = -0.08;
      }else{
        cameraFreePosition = camera.position.clone();
        cameraFreeYaw = yaw; cameraFreePitch = pitch;
      }
    }
    if(!cameraFreeMode)cameraFreeVertical=0;
    if(cameraFreeControls)cameraFreeControls.classList.toggle("hidden",!cameraFreeMode||cameraControls.classList.contains("hidden"));
    if(cameraFreeMode){cameraFreePosition ||= camera.position.clone();}
    else cameraDistance = mode === "first" ? 0.08 : mode === "second" ? 3.0 : 5.4;
    // Conservamos el ángulo orbital al cambiar de cámara: las tres vistas
    // y el bloqueo comparten exactamente el mismo control libre.
    document.querySelectorAll(".camera-mode").forEach(button => button.classList.toggle("selected", button.dataset.camera === mode));
    cameraFreeQuickButton?.classList.toggle("active",cameraFreeMode);
    cameraFreeQuickButton?.setAttribute("aria-pressed",String(cameraFreeMode));
    const buildView = document.querySelector("#view-toggle");
    if (buildView) buildView.textContent = mode === "first" ? "👁 PRIMERA PERSONA" : mode === "free" ? "✈ CÁMARA LIBRE" : "⬆ VISTA AÉREA";
    showToast(mode === "first" ? "Cámara en primera persona" : mode === "second" ? "Cámara cercana: segunda persona" : mode === "free" ? "Cámara libre: el personaje queda independiente" : "Cámara en tercera persona");
  };
  cameraFreeQuickButton?.addEventListener("click",()=>{
    const nextMode=cameraFreeMode?"third":"free";
    applyCameraMode(nextMode);
    cameraModePanel.classList.add("hidden");
    cameraFreeQuickButton.setAttribute("aria-pressed",String(nextMode==="free"));
    cameraFreeQuickButton.classList.toggle("active",nextMode==="free");
  });
  cameraMenuToggle.addEventListener("click",()=>{
     const modes=["first","second","third","free"];
     const current=modes.indexOf(cameraMode);
     applyCameraMode(modes[(current+1)%modes.length]);
     cameraModePanel.classList.add("hidden");
     showToast("Cámara: "+(cameraMode==="first"?"primera persona":cameraMode==="second"?"cercana":cameraMode==="third"?"tercera persona":"libre"));
   });
  document.querySelectorAll(".camera-mode").forEach(button => button.addEventListener("click", () => {applyCameraMode(button.dataset.camera);cameraModePanel.classList.add("hidden");setHudDockOpen(false);}));
  cameraLockButton.addEventListener("click", () => {
    cameraLocked = !cameraLocked;
    game.classList.toggle("camera-locked", cameraLocked);
    if (cameraLocked) {
      if (cameraMode === "first") applyCameraMode("second");
      if (cameraFreeMode) applyCameraMode("third");
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
    setHudDockOpen(false);
  });
  const viewToggle = document.querySelector("#view-toggle");
  const categorySelect = document.querySelector("#build-category");
  const buildToolsHost = document.querySelector("#build-tools");
  const doorRotateControl = document.querySelector("#door-rotate-control");
  doorRotateControl?.addEventListener("click",()=>{buildRotation=(buildRotation+Math.PI/2)%(Math.PI*2);showToast(`Puerta girada ${Math.round(buildRotation*180/Math.PI)}°`);setHudDockOpen(false);});
  const toolCatalog = {
    block:[["block","🧱","CUBO"],["brick","🧱","LADRILLO"],["erase","⌫","BORRAR"],["rotate","↻","GIRAR"]],
    nature:[["tree","🌳","ÁRBOL"],["rock","🪨","ROCA"],["erase","⌫","BORRAR"]],
    water:[["water","🌊","AGUA"],["erase","⌫","BORRAR"]],
    structure:[["platea","▰","PLATEA"],["pool-small","🏊","PILETA CHICA"],["pool-large","🏊","PILETA GRANDE"],["pool-municipal","🏊","PILETA MUNICIPAL"],["floor","▰","PISO"],["wall","▥","PARED"],["roof","🏠","TECHO CERRADO"],["roof-hole","🛗","TECHO CON HUECO"],["stairs","🪜","ESCALERA"],["elevator","🛗","ASCENSOR"],["door-solid","🚪","PUERTA SÓLIDA"],["door-brick","🚪","PUERTA LADRILLO"],["window","▣","VENTANA"],["gate","🚧","PORTÓN"],["fence","🪵","TRANQUERA"],["erase","⌫","BORRAR"],["rotate","↻","GIRAR"]],
    furniture:[["chair","🪑","SILLA"],["table","🪵","MESA"],["bed","🛏️","CAMA"],["sofa","🛋️","SOFÁ"],["lamp","💡","LÁMPARA"],["erase","⌫","BORRAR"]],
    farm:[["pen","🐑","CORRAL"],["sheep","🐑","OVEJA"],["cow","🐄","VACA"],["horse","🐎","CABALLO"],["chicken","🐔","GALLINA"],["pig","🐖","CHANCHO"],["goat","🐐","CABRA"],["erase","⌫","BORRAR"],["rotate","↻","GIRAR"]],
    farmRealistic:[["fox","🦊","ZORRO REALISTA"],["person","🧓","ANCIANO 3D"],["robot","🤖","ROBOT 3D"],["trex","🦖","T-REX REALISTA"],["erase","⌫","BORRAR"],["rotate","↻","GIRAR"]]
  };
  const animalStyleSelect=document.querySelector("#animal-style-select");
  function renderBuildTools(category="block"){
    buildToolsHost.innerHTML="";
    const selectedCatalog=category==="farm"&&animalStyleSelect?.value==="realistic"?"farmRealistic":category;
    for(const [kind,emoji,label] of (toolCatalog[selectedCatalog]||toolCatalog.block)){
      const button=document.createElement("button");button.type="button";button.className="build-tool"+(kind===buildTool?" selected":"");button.dataset.tool=kind;button.innerHTML=emoji+"<small>"+label+"</small>";
      button.addEventListener("click",()=>{
        if(kind==="rotate"){buildRotation=(buildRotation+Math.PI/2)%(Math.PI*2);showToast("Pieza girada");return;}
        buildTool=kind;buildToolsHost.querySelectorAll(".build-tool").forEach(item=>item.classList.toggle("selected",item===button));
        doorRotateControl?.classList.toggle("hidden",!["door-solid","door-brick","door"].includes(kind));hudDeleteButton.classList.toggle("active",kind==="erase");
        document.querySelector("#build-help").textContent=kind==="erase"?"Tocá una construcción para eliminar esa pieza.":(kind==="door"||kind==="door-solid"||kind==="door-brick")?"Puerta completa prediseñada: columnas de bloques incorporadas. Colocala antes de levantar las paredes.":kind==="water"?"Llená la pileta completa con agua.":kind==="platea"?"La platea aplana el terreno y se alinea con las vecinas.":kind.startsWith("pool-")?"Pileta con base propia y 2 metros de profundidad.":isLivingBuildKind(kind)?"Seres vivos: colocación directa sobre el terreno, sin platea.":"Primero colocá una PLATEA; después construí sobre ella.";
        buildPanel.classList.add("hidden");
        setHudDockOpen(false);
      });buildToolsHost.appendChild(button);
    }
  }
  renderBuildTools();
  categorySelect.addEventListener("change",()=>{
    const isFarm=categorySelect.value==="farm";
    if(animalStyleSelect)animalStyleSelect.classList.toggle("hidden",!isFarm);
    document.querySelector("#animal-style-label")?.classList.toggle("hidden",!isFarm);
    renderBuildTools(categorySelect.value);
  });
  animalStyleSelect?.addEventListener("change",()=>renderBuildTools("farm"));
  menuToggle.addEventListener("click",()=>{const open=menuPanel.classList.contains("hidden");menuPanel.classList.toggle("hidden",!open);menuToggle.setAttribute("aria-expanded",String(open));setHudDockOpen(false);});
  document.querySelector("#force-app-update")?.addEventListener("click",async event=>{
    const button=event.currentTarget;
    if(button.disabled)return;
    button.disabled=true;
    button.textContent="⚡ BUSCANDO ACTUALIZACIÓN…";
    showToast("Conectando con la última versión publicada…");
    try{
      if(!("serviceWorker" in navigator))throw new Error("Este navegador no permite actualizar la aplicación.");
      const registrations=await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration=>registration.update().catch(()=>{})));
      await Promise.all(registrations.map(registration=>registration.unregister()));
      if("caches" in window){
        const cacheNames=await caches.keys();
        await Promise.all(cacheNames.map(name=>caches.delete(name)));
      }
      showToast("Caché renovada. Cargando la última versión publicada…");
      const freshUrl=new URL("./",window.location.href);
      freshUrl.searchParams.set("ilox-force-update",String(Date.now()));
      window.location.replace(freshUrl.href);
    }catch(error){
      console.error("ILOX: actualización forzada fallida",error);
      showToast("No se pudo actualizar. Revisá tu conexión e intentá otra vez.");
      button.disabled=false;
      button.textContent="⚡ FORZAR ACTUALIZACIÓN";
    }
  });
   menuPanel.addEventListener("click",event=>{if(event.target.closest("#hud-build,#hud-delete,#hud-confirm,#door-rotate-control,#elevator-call-button,#mp-chat-toggle,#quick-save,#fullscreen,#force-app-update")){menuPanel.classList.add("hidden");menuToggle.setAttribute("aria-expanded","false");}});
  document.querySelector("#multiplayer-open")?.addEventListener("click",()=>{menuPanel.classList.add("hidden");openMultiplayerDialog();});
  document.querySelector("#mp-branch-load")?.addEventListener("click",()=>showMultiplayerBranch("load"));
  document.querySelector("#mp-branch-create")?.addEventListener("click",()=>showMultiplayerBranch("create"));
  document.querySelector("#mp-back-branches-load")?.addEventListener("click",()=>showMultiplayerBranch("home"));
  document.querySelector("#mp-back-branches-create")?.addEventListener("click",()=>showMultiplayerBranch("home"));
  document.querySelector("#mp-close")?.addEventListener("click",()=>document.querySelector("#multiplayer-dialog").classList.add("hidden"));
  document.querySelector("#mp-permissions-open")?.addEventListener("click",()=>{
    menuPanel.classList.add("hidden");openMultiplayerPermissions();
  });
  document.querySelector("#mp-permissions-close")?.addEventListener("click",()=>document.querySelector("#mp-permissions-dialog").classList.add("hidden"));
  document.querySelector("#mp-permission-structure")?.addEventListener("change",()=>renderMultiplayerPermissionRows().catch(error=>showToast(error.message)));
  document.querySelector("#mp-grant-permission")?.addEventListener("click",async()=>{
    const structureIds=selectedPermissionStructureIds();
    const userId=document.querySelector("#mp-permission-player").value;
    if(!structureIds.length||!userId){showToast("Elegí una construcción y un compañero.");return;}
    try{await Multiplayer.grantStructurePermissions(structureIds,userId);await renderMultiplayerPermissionRows();showToast("Permiso concedido sobre toda la selección.");}
    catch(error){showToast(error.message||"No se pudo conceder el permiso.");}
  });
  document.querySelector("#mp-create-world")?.addEventListener("click",async()=>{
    const status=document.querySelector("#multiplayer-status"),name=document.querySelector("#mp-display-name").value.trim(),worldName=document.querySelector("#mp-world-name").value.trim();
    if(!name||!worldName){status.textContent="Completá tu nombre y el nombre de la partida.";return;}
    const button=document.querySelector("#mp-create-world");button.disabled=true;status.textContent="Conectando con ILOX…";
    try{
      localStorage.setItem("ilox-player-name",name);
      const user=await Multiplayer.ensureIdentity(name,selectedAvatar);multiplayerUserId=user.id;
      const created=await Multiplayer.createWorld(worldName);
      await enterMultiplayerWorld(created.world_id);
      document.querySelector("#mp-code-value").textContent=created.invite_code;
      document.querySelector("#mp-created-code").classList.remove("hidden");
      status.textContent="¡Partida creada! Compartí este código con tu compañero. El mundo ya queda guardado en línea.";
      renderMultiplayerWorldList();
    }catch(error){showMultiplayerError(error);}
    finally{button.disabled=false;}
  });
  document.querySelector("#mp-join-world")?.addEventListener("click",async()=>{
    const status=document.querySelector("#multiplayer-status"),name=document.querySelector("#mp-display-name").value.trim(),code=document.querySelector("#mp-invite-code").value.replace(/\D/g,"");
    if(!name||code.length!==5){status.textContent="Ingresá tu nombre y el código numérico de 5 dígitos.";return;}
    const button=document.querySelector("#mp-join-world");button.disabled=true;status.textContent="Buscando la partida…";
    try{
      localStorage.setItem("ilox-player-name",name);
      const user=await Multiplayer.ensureIdentity(name,selectedAvatar);multiplayerUserId=user.id;
      const worldId=await Multiplayer.joinWorld(code);
      await enterMultiplayerWorld(worldId);
      document.querySelector("#mp-created-code").classList.add("hidden");
      status.textContent="¡Te uniste al mundo! Las construcciones se guardan automáticamente.";
      renderMultiplayerWorldList();
    }catch(error){showMultiplayerError(error);}
    finally{button.disabled=false;}
  });
  document.querySelector("#mp-copy-code")?.addEventListener("click",async()=>{
    const code=document.querySelector("#mp-code-value").textContent;
    try{await navigator.clipboard.writeText(code);showToast("Código copiado.");}
    catch{showToast("No se pudo copiar. Compartí el código: "+code);}
  });
  addEventListener("online",()=>{if(activeMultiplayerWorldId)showToast("Conexión recuperada. Tus cambios locales siguen disponibles; pulsá GUARDAR para sincronizarlos.");});
  document.querySelector("#mp-leave-world")?.addEventListener("click",async()=>{
    await leaveMultiplayerWorld();document.querySelector("#multiplayer-dialog").classList.add("hidden");
  });
  document.querySelector("#mp-chat-toggle")?.addEventListener("click",()=>{
    if(!activeMultiplayerWorldId){showToast("El chat funciona dentro de un mundo compartido.");openMultiplayerDialog();return;}
    const panel=document.querySelector("#mp-chat-panel");panel?.classList.toggle("hidden");setHudDockOpen(false);
    if(panel&&!panel.classList.contains("hidden")){markMultiplayerChatRead();const list=document.querySelector("#mp-chat-messages");if(list)list.scrollTop=list.scrollHeight;document.querySelector("#mp-chat-input")?.focus();}
  });
  const unlockChatAudio=()=>{
    try{const AudioContextClass=window.AudioContext||window.webkitAudioContext;if(AudioContextClass&&!multiplayerChatAudio)multiplayerChatAudio=new AudioContextClass();if(multiplayerChatAudio?.state==="suspended")multiplayerChatAudio.resume().catch(()=>{});}catch{}
  };
  addEventListener("pointerdown",unlockChatAudio,{once:true,passive:true});
  addEventListener("keydown",unlockChatAudio,{once:true});
  document.querySelector("#mp-chat-close")?.addEventListener("click",()=>document.querySelector("#mp-chat-panel")?.classList.add("hidden"));
  document.querySelector("#mp-chat-form")?.addEventListener("submit",async event=>{
    event.preventDefault();
    const input=document.querySelector("#mp-chat-input"),button=document.querySelector("#mp-chat-send"),message=input.value.trim();
    if(!message||!multiplayerSession||!activeMultiplayerWorldId)return;
    button.disabled=true;
    try{
      const row=await multiplayerSession.sendChatMessage(message,localStorage.getItem("ilox-player-name")||"Jugador");
      appendMultiplayerChatMessage(row);input.value="";
    }catch(error){showToast(error.message||"No se pudo enviar el mensaje.");}
    finally{button.disabled=false;input.focus();}
  });
  document.querySelector("#change-avatar").addEventListener("click",()=>{
    menuPanel.classList.add("hidden");menuToggle.setAttribute("aria-expanded","false");cameraControls.classList.add("hidden");avatarSelect.classList.remove("hidden");
    enterWorldButton.innerHTML="APLICAR PERSONAJE <span>→</span>";
    document.querySelectorAll(".avatar-option").forEach(option=>option.classList.toggle("selected",option.dataset.avatar===selectedAvatar));
  });
  document.querySelector("#erase-all").addEventListener("click",()=>{
    if(activeMultiplayerWorldId){showToast("En el multijugador no se puede borrar todo el mundo de una vez.");return;}
    if(!buildRecords.length){showToast("Todavía no hay construcciones para eliminar.");return;}
    if(!confirm("¿Eliminar definitivamente todo lo construido en este mundo?"))return;
    for(const group of buildGroups)scene.remove(group);buildGroups.length=0;buildRecords.length=0;refreshTerrainSurface();persistBuilds();
    menuPanel.classList.add("hidden");menuToggle.setAttribute("aria-expanded","false");showToast("Se eliminaron todas las construcciones.");
  });
  function setHudDockOpen(open){cameraControls.classList.remove("hidden");if(cameraFreeControls)cameraFreeControls.classList.toggle("hidden",!cameraFreeMode);hudDockToggle?.setAttribute("aria-expanded","true");hudDockToggle?.setAttribute("aria-label","Controles siempre visibles");if(!open)cameraModePanel.classList.add("hidden");}
  if(hudDockToggle)hudDockToggle.classList.add("hidden");
  function setBuildMode(enabled,tool=buildTool,showPanel=enabled,notify=true){
    buildMode=enabled;buildTool=tool;if(enabled)renderBuildTools(categorySelect.value);
    buildPanel.classList.toggle("hidden",!enabled||!showPanel);doorRotateControl?.classList.add("hidden");
    menuPanel.classList.add("hidden");menuToggle.setAttribute("aria-expanded","false");
    setHudDockOpen(false);
    hudConfirmButton.disabled=!enabled;hudDeleteButton.classList.toggle("active",enabled&&tool==="erase");
    cameraDistance=cameraMode==="first"?0.08:(cameraMode==="second"?3:(enabled?9.5:5.4));if(enabled&&!firstPersonBuild)pitch=.48;
    viewToggle.classList.toggle("hidden",!enabled);viewToggle.textContent=firstPersonBuild?"👁 PRIMERA PERSONA":"⬆ VISTA AÉREA";
    document.querySelector("#build-help").textContent=enabled?(tool==="erase"?"Tocá cada pieza que quieras eliminar.":"Elegí una categoría y una pieza. Tocá para colocar; todo encaja en cuadrícula."):"Explorá el mundo y construí.";
    if(notify)showToast(!enabled?"¡A explorar!":tool==="erase"?"Modo eliminación activado":"Modo construcción activado");
  }
  hudBuildButton.addEventListener("click",()=>{if(!buildMode||buildTool==="erase")setBuildMode(true,"block",true);else buildPanel.classList.toggle("hidden");setHudDockOpen(false);});
  hudConfirmButton.addEventListener("click",()=>{if(buildMode)setBuildMode(false,buildTool,false);setHudDockOpen(false);});
  hudDeleteButton.addEventListener("click",()=>{setBuildMode(true,"erase",false);setHudDockOpen(false);});
  viewToggle.addEventListener("click",()=>{applyCameraMode(cameraMode==="first"?"third":"first");cameraDistance=firstPersonBuild?0.08:9.5;});
  document.querySelectorAll(".block-color").forEach(button => {
    button.addEventListener("click", () => {
      selectedBlockColor = Number(button.dataset.color);
      document.querySelectorAll(".block-color").forEach(item => item.classList.toggle("selected", item === button));
      buildPanel.classList.add("hidden");
      showToast("Color seleccionado");
    });
  });
  quickSaveButton?.addEventListener("click",async()=>{
    if(!flushLocalBuildSave())return;
    quickSaveButton.disabled=true;
    try{
      if(activeMultiplayerWorldId){
        const synced=await syncMultiplayerStructures();
        if(!synced)throw new Error("La copia local está guardada, pero no se pudo confirmar la copia en línea.");
      }
      quickSaveButton.classList.add("saved");
      quickSaveButton.textContent="✓";
      showToast(activeMultiplayerWorldId?"Guardado local y copia en línea confirmada.":"Guardado en este teléfono.");
    }catch(error){showToast(error.message||"No se pudo confirmar el guardado.");}
    finally{
      quickSaveButton.disabled=false;
      window.setTimeout(()=>{quickSaveButton.classList.remove("saved");quickSaveButton.textContent="💾";},1100);
    }
  });
  const worldJsonInput=document.querySelector("#world-json-input");
  document.querySelector("#export-world-json")?.addEventListener("click",()=>{
    try{
      flushLocalBuildSave();
      const structures=buildRecords.map(record=>{const copy={...record};delete copy.pin;return copy;});
      const backup={format:"ILOX_WORLD",version:1,exportedAt:new Date().toISOString(),worldId:activeMultiplayerWorldId,worldName:activeMultiplayerWorldId?"Mundo compartido":"Mundo individual",structures};
      const blob=new Blob([JSON.stringify(backup,null,2)],{type:"application/json"});
      const url=URL.createObjectURL(blob),anchor=document.createElement("a");
      anchor.href=url;anchor.download="ILOX-mundo-"+new Date().toISOString().slice(0,10)+".json";
      document.body.append(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);
      showToast("Copia JSON exportada. Guardala en un lugar seguro.");
    }catch(error){showToast("No se pudo exportar el mundo.");console.warn(error);}
  });
  document.querySelector("#import-world-json")?.addEventListener("click",()=>worldJsonInput?.click());
  worldJsonInput?.addEventListener("change",async()=>{
    const file=worldJsonInput.files?.[0];if(!file)return;
    try{
      const parsed=JSON.parse(await file.text());
      const structures=Array.isArray(parsed)?parsed:parsed?.structures;
      if(!Array.isArray(structures)||structures.length>1200)throw new Error("El archivo no contiene un mundo ILOX válido (máximo 1200 piezas).");
      if(parsed?.format&&parsed.format!=="ILOX_WORLD")throw new Error("Este archivo no es una copia JSON de ILOX.");
      if(parsed?.worldId&&activeMultiplayerWorldId&&parsed.worldId!==activeMultiplayerWorldId)throw new Error("Esta copia pertenece a otra partida compartida.");
      const allowed=new Set(["block","brick","platea","floor","wall","door","window","roof","stairs","elevator","pool","tree","rock","water","chair","table","bed","sofa","lamp","gate","fence","pen","sheep","cow","horse","chicken","pig","goat","fox","person","robot","trex"]);
      const clean=structures.filter(record=>record&&allowed.has(record.kind)&&Number.isFinite(record.x)&&Number.isFinite(record.z)).map(record=>{
        const copy={...record};
        if(!activeMultiplayerWorldId){delete copy.cloudId;delete copy.cloudOwnerId;}
        if(copy.kind==="door")copy.pin=null;
        return copy;
      });
      if(clean.length!==structures.length)throw new Error("El archivo contiene piezas inválidas. No se modificó el mundo.");
      if(!confirm("¿Reemplazar las construcciones actuales por las "+clean.length+" piezas de esta copia JSON?"))return;
      clearCurrentBuildWorld();
      for(const record of clean){buildRecords.push(record);createBuildPiece(record);}
      refreshTerrainSurface();
      flushLocalBuildSave();
      showToast("Copia cargada en este teléfono. Pulsá GUARDAR para sincronizar el mundo compartido.");
    }catch(error){showToast(error.message||"No se pudo importar el archivo JSON.");}
    finally{worldJsonInput.value="";}
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
  if(kind==="platea"){
    const slab=mat(0xb8b9b3,.88),elevator=buildRecords.find(e=>e.kind==="elevator"&&baseY>e.y+.5);
    if(elevator&&Math.abs(x-elevator.x)<4.7&&Math.abs(z-elevator.z)<4.7){
      const dx=elevator.x-x,dz=elevator.z-z,a=rotation||0,lx=dx*Math.cos(a)-dz*Math.sin(a),lz=dx*Math.sin(a)+dz*Math.cos(a),half=3.08,L=-3,R=3,B=-3,F=3;
      const hl=Math.max(L,lx-half),hr=Math.min(R,lx+half),hb=Math.max(B,lz-half),hf=Math.min(F,lz+half);
      if(hl>L)box(hl-L,.3,6,slab,(L+hl)/2,.15,0);
      if(R>hr)box(R-hr,.3,6,slab,(hr+R)/2,.15,0);
      if(hf>hb&&hr>hl){if(hb>B)box(hr-hl,.3,hb-B,slab,(hl+hr)/2,.15,(B+hb)/2);if(F>hf)box(hr-hl,.3,F-hf,slab,(hl+hr)/2,.15,(hf+F)/2);}
    }else box(6,.3,6,slab,0,.15,0);
    group.userData.isFoundation=true;group.userData.buildHeight=.3;
  }
  if(kind==="pool"){
    const design=POOL_DESIGNS[record.poolDesign]||POOL_DESIGNS.small;
    const w=record.poolWidth||design.width,d=record.poolDepth||design.depth,depth=2;
    const shell=mat(0x6b9da5,.88),inner=mat(design.tile,.72),rim=mat(design.edge,.62),accent=mat(record.poolDesign==="municipal"?0x176fa7:0x22aebc,.55);
    // Vasija monolítica con paredes dobles y fondo revestido: toda la geometría es original de ILOX.
    box(w,.34,d,shell,0,-depth-.38,0);
    box(w-.48,.12,d-.48,inner,0,-depth-.17,0);
    box(.34,depth+.24,d,shell,-w/2+.17,-depth/2+.10,0);
    box(.34,depth+.24,d,shell,w/2-.17,-depth/2+.10,0);
    box(w-.34,depth+.24,.34,shell,0,-depth/2+.10,-d/2+.17);
    box(w-.34,depth+.24,.34,shell,0,-depth/2+.10,d/2-.17);
    // Revestimiento interior en bandas y borde perimetral ancho.
    box(.045,depth-.12,d-.62,inner,-w/2+.365,-depth/2+.10,0);
    box(.045,depth-.12,d-.62,inner,w/2-.365,-depth/2+.10,0);
    box(w-.62,depth-.12,.045,inner,0,-depth/2+.10,-d/2+.365);
    box(w-.62,depth-.12,.045,inner,0,-depth/2+.10,d/2-.365);
    box(w+.22,.22,.48,rim,0,.11,-d/2+.20);box(w+.22,.22,.48,rim,0,.11,d/2-.20);
    box(.48,.22,d-.18,rim,-w/2+.20,.11,0);box(.48,.22,d-.18,rim,w/2-.20,.11,0);
    // Línea decorativa de mosaicos bajo la coronación.
    for(let side of [-1,1])box(w-.85,.10,.055,accent,0,-.34,side*(d/2-.37));
    if(record.poolDesign==="municipal"){
      // DISEÑO MUNICIPAL LIMPIO v2: sin arcos, tubos ni barandas transversales.
      // Accesos sumergidos compactos en los dos extremos; no cruzan el recorrido central.
      for(const end of [-1,1]){
        for(let step=0;step<3;step++){
          box(1.05,.16,.58,inner,end*(w/2-1.05),-.34-step*.22,-d/2+.52+step*.38);
          box(1.05,.16,.58,inner,end*(w/2-1.05),-.34-step*.22,d/2-.52-step*.38);
        }
      }
      group.userData.poolRevision="municipal-clean-v2";
    }else if(record.poolDesign==="large"){
      // Escalones sumergidos en una esquina para facilitar la entrada.
      for(let step=0;step<3;step++)box(1.05,.18,.62,inner,-w/2+.78+step*.42,-.34-step*.28,-d/2+.62+step*.42);
      // Se eliminó el conjunto de tubos de acceso que generaba colisiones dentro de la pileta.
    }else{
      // Escalera compacta integrada en un lateral.
      for(let i=0;i<3;i++)box(.65,.12,.22,inner,-w/2+.48+i*.18,-.35-i*.30,-d/2+.55+i*.12);
    }
    group.userData.isPool=true;group.userData.isFoundation=true;group.userData.buildHeight=.22;
  }
  if(kind==="floor"){
    const shaftOverlap=buildRecords.some(e=>e.kind==="elevator"&&baseY>e.y+.5&&Math.abs(x-e.x)<3.35&&Math.abs(z-e.z)<3.35);
    if(!shaftOverlap)box(1.5,.16,1.5,wood,0,.08,0);
  }
  if(kind==="elevator"){
    const shaftHeight=Math.max(3,Math.min(120,(record.floorCount||40)*3));
    const steel=mat(0x56636b,.42,.72),glassPanel=new THREE.MeshPhysicalMaterial({color:0x9feaf5,transparent:true,opacity:.16,roughness:.1,metalness:.08,depthWrite:false,side:THREE.DoubleSide}),cabinMat=mat(0x9ba8aa,.48,.48),dark=mat(0x25343b,.6,.35);
    // Guías verticales y cuatro montantes dejan el hueco central libre.
    for(const sx of [-2.92,2.92])for(const sz of [-2.92,2.92]){
      box(.16,shaftHeight,.16,steel,sx,shaftHeight/2,sz);box(.08,shaftHeight,.08,dark,sx*.94,shaftHeight/2,sz*.94);
    }
    for(const sx of [-2.92,2.92])box(.16,.16,6,steel,sx,shaftHeight,0);
    for(const sz of [-2.92,2.92])box(6,.16,.16,steel,0,shaftHeight,sz);
    const cabin=new THREE.Group();cabin.name="ilox-elevator-cabin";
    const cabinFloor= new THREE.Mesh(new THREE.BoxGeometry(6,.16,6),cabinMat);cabinFloor.position.y=.08;cabinFloor.userData.elevatorFloor=true;cabin.add(cabinFloor);
    for(const sx of [-2.92,2.92]){const side=new THREE.Mesh(new THREE.BoxGeometry(.08,2.65,5.84),glassPanel);side.position.set(sx,1.4,0);cabin.add(side);}
    const back=new THREE.Mesh(new THREE.BoxGeometry(5.84,2.65,.08),glassPanel);back.position.set(0,1.4,-2.92);cabin.add(back);
    const roof=new THREE.Mesh(new THREE.BoxGeometry(6,.12,6),cabinMat);roof.position.y=2.75;cabin.add(roof);
    const doorL=new THREE.Mesh(new THREE.BoxGeometry(2.9,2.55,.08),glassPanel),doorR=doorL.clone();
    doorL.position.set(-1.45,1.36,2.92);doorR.position.set(1.45,1.36,2.92);cabin.add(doorL,doorR);
    // El mando verde queda montado directamente sobre la hoja derecha de la puerta.
    // Al deslizarse la puerta, el mando se desplaza con ella y nunca queda flotando en la cabina.
    const consoleBody=new THREE.Mesh(new THREE.BoxGeometry(.42,.62,.12),dark);consoleBody.position.set(-.78,1.36,.09);doorR.add(consoleBody);
    const consoleFace=new THREE.Mesh(new THREE.BoxGeometry(.33,.51,.035),mat(0x173e48,.3,.3));consoleFace.position.set(-.78,1.36,.17);consoleFace.userData.elevatorConsole=true;doorR.add(consoleFace);
    const consoleLight=new THREE.Mesh(new THREE.CylinderGeometry(.105,.105,.055,24),mat(0x63f4c4,.2,.1));consoleLight.rotation.x=Math.PI/2;consoleLight.position.set(-.78,1.51,.205);doorR.add(consoleLight);
    cabin.userData.doorLeft=doorL;cabin.userData.doorRight=doorR;
    cabin.position.y=.18;group.add(cabin);
    group.userData.elevatorCabin=cabin;group.userData.elevatorConsole=consoleFace;group.userData.elevatorDoorOpen=false;
    group.userData.elevatorDoorProgress=0;group.userData.elevatorDoorAnimation=null;
    const landingDoors=[];
    for(let floor=1;floor<=(record.floorCount||40);floor++){
      const offset=(floor-1)*3,left=new THREE.Mesh(new THREE.BoxGeometry(2.9,2.55,.08),steel),right=left.clone();
      left.position.set(-1.45,1.36+offset,3.08);right.position.set(1.45,1.36+offset,3.08);
      left.castShadow=right.castShadow=true;group.add(left,right);landingDoors.push({floor,left,right});
    }
    group.userData.elevatorLandingDoors=landingDoors;
    group.userData.buildHeight=shaftHeight;
    group.userData.elevatorFloorCount=record.floorCount||20;
    group.userData.elevatorCurrentFloor=record.currentFloor||1;
  }
  if(kind==="roof"){
    const rw=record.roofWidth||1.5,rd=record.roofDepth||1.5,roofMat=mat(0x9a5545);
    const elevator=record.roofOpening?buildRecords.find(e=>e.kind==="elevator"&&baseY>e.y+.5):null;
    let opening=null;
    if(record.roofOpening){
      const dx=elevator?elevator.x-x:0,dz=elevator?elevator.z-z:0,a=rotation||0;
      const lx=dx*Math.cos(a)-dz*Math.sin(a),lz=dx*Math.sin(a)+dz*Math.cos(a),half=3.08;
      if(!elevator||(Math.abs(lx)<rw/2+half&&Math.abs(lz)<rd/2+half))opening={left:lx-half,right:lx+half,back:lz-half,front:lz+half};
    }
    if(!opening){const roofPiece=box(rw,.16,rd,roofMat,0,.08,0);roofPiece.rotation.z=-.12;}
    else{
      const L=-rw/2,R=rw/2,B=-rd/2,F=rd/2,hl=Math.max(L,opening.left),hr=Math.min(R,opening.right),hb=Math.max(B,opening.back),hf=Math.min(F,opening.front);
      if(hl>L)box(hl-L,.16,rd,roofMat,(L+hl)/2,.08,0);
      if(R>hr)box(R-hr,.16,rd,roofMat,(hr+R)/2,.08,0);
      if(hf>hb&&hr>hl){
        if(hb>B)box(hr-hl,.16,hb-B,roofMat,(hl+hr)/2,.08,(B+hb)/2);
        if(F>hf)box(hr-hl,.16,F-hf,roofMat,(hl+hr)/2,.08,(hf+F)/2);
      }
    }
  }
  if(kind==="wall")box(1.5,1.5,.16,wall,0,.75,0);
  if(kind==="door"){
    const doorHeight=3.0,openingWidth=1.5,leafWidth=1.38,leafHeight=2.88,depth=1.5;
    let frameMaterial=mat(record.color??0xff3030);
    if(record.doorStyle==="brick"){
      const canvas=document.createElement("canvas");canvas.width=256;canvas.height=256;const ctx=canvas.getContext("2d");ctx.fillStyle="#9d5946";ctx.fillRect(0,0,256,256);ctx.strokeStyle="#e5b49b";ctx.lineWidth=5;
      for(let row=0;row<6;row++){const yy=row*43;ctx.beginPath();ctx.moveTo(0,yy);ctx.lineTo(256,yy);ctx.stroke();const off=row%2?0:64;for(let col=-1;col<4;col++){ctx.beginPath();ctx.moveTo(off+col*128,yy);ctx.lineTo(off+col*128,yy+43);ctx.stroke();}}
      const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;frameMaterial=new THREE.MeshStandardMaterial({map:texture,roughness:.95});
    }
    // Dos columnas estructurales: dos bloques cúbicos apilados a cada lado.
    for(const side of [-1,1]){
      const cx=side*1.5;
      box(1.5,1.5,depth,frameMaterial,cx,.75,0);
      box(1.5,1.5,depth,frameMaterial,cx,2.25,0);
    }
    // La hoja ocupa la abertura central de 1,50 m y gira sobre sus bisagras.
    const hinge=new THREE.Group();hinge.position.set(-openingWidth/2+.06,.06,-.70);group.add(hinge);
    const leaf=new THREE.Mesh(new THREE.BoxGeometry(leafWidth,leafHeight,.055),wood);
    leaf.position.set(leafWidth/2,leafHeight/2,0);leaf.castShadow=true;leaf.receiveShadow=true;hinge.add(leaf);
    const rail=new THREE.Mesh(new THREE.BoxGeometry(leafWidth,.055,.07),darkWood);rail.position.set(leafWidth/2,.32,.005);hinge.add(rail);
    for(const side of [-1,1]){const knob=new THREE.Mesh(new THREE.SphereGeometry(.055,14,12),metal);knob.position.set(leafWidth-.09,1.42,side*.075);hinge.add(knob);}
    for(const yy of [.16,doorHeight-.24]){const h=new THREE.Mesh(new THREE.BoxGeometry(.045,.12,.19),metal);h.position.set(.015,yy,0);hinge.add(h);}
    group.userData.doorLeafPivot=hinge;group.userData.buildHeight=doorHeight;
    if(record.open){
      hinge.rotation.y=Math.PI/2;
      group.userData.doorIsOpen=true;
      group.userData.doorAutoCloseAt=Date.now()+3000;
    }
  }
  if(kind==="window"){box(.18,1.5,.16,wall,-.66,.75,0);box(.18,1.5,.16,wall,.66,.75,0);box(1.5,.18,.16,wall,0,1.41,0);box(1.5,.18,.16,wall,0,.09,0);box(1.25,1.15,.045,glass,0,.75,-.04);box(.06,1.2,.08,wood,0,.75,-.08);box(1.3,.06,.08,wood,0,.75,-.08);}
  if(kind==="stairs"){
    // Diez peldaños sólidos alcanzan los 3 m del marco de puerta en un tramo de 4,5 m.
    for(let i=0;i<10;i++){
      const tread=box(1.5,.3,.48,wood,0,.15+i*.3,-2.01+i*.45);
      tread.userData.stairTread=true;
      box(1.5,.3,.12,darkWood,0,.15+i*.3,-2.19+i*.45);
    }
    group.userData.isWalkableStair=true;
    group.userData.buildHeight=3;
  }
  if(kind==="tree"){cyl(0,.68,0,.12,.2,1.35,darkWood);for(let i=0;i<10;i++){const ang=i*2.399;ball(Math.cos(ang)*.28,1.3+(i%3)*.22,Math.sin(ang)*.28,.48,.56,.48,mat([0x3e713d,0x4d8245,0x608b4b][i%3]));}}
  if(kind==="rock"){const o=new THREE.Mesh(new THREE.DodecahedronGeometry(.68,1),mat(0x85877e));o.position.y=.48;o.scale.set(1.1,.7,.9);o.rotation.set(.2,.4,.1);o.castShadow=true;group.add(o);}
  if(kind==="water"){
    const w=record.poolWidth||6,d=record.poolDepth||6;
    // Superficie estable: no deformar la malla cada frame evita actualizaciones repetidas
    // de vértices/normales que pueden producir parpadeos en móviles.
    const geo=new THREE.PlaneGeometry(w-.62,d-.62,1,1);
    const material=new THREE.MeshPhongMaterial({
      color:0x16bce8, specular:0x9beaff, shininess:85,
      transparent:true, opacity:.88, side:THREE.DoubleSide,
      depthWrite:false
    });
    const water=new THREE.Mesh(geo,material);
    water.rotation.x=-Math.PI/2;water.position.y=.035;water.renderOrder=8;
    water.frustumCulled=false;water.userData.water=true;
    group.add(water);group.userData.water=true;group.userData.buildHeight=.04;
  }
  if(kind==="chair"){box(.95,.12,.9,wood,0,.72,0);box(.95,.85,.12,wood,0,1.15,-.39);for(const sx of [-.38,.38])for(const sz of [-.32,.32])box(.12,.68,.12,darkWood,sx,.34,sz);}
  if(kind==="table"){box(1.4,.14,1.2,wood,0,.92,0);for(const sx of [-.55,.55])for(const sz of [-.42,.42])box(.12,.9,.12,darkWood,sx,.45,sz);}
  if(kind==="bed"){box(1.4,.22,1.5,darkWood,0,.38,0);box(1.32,.2,1.32,mat(0xe4dfd0),0,.58,0);box(.55,.18,.35,mat(0xf4eee0),-.36,.76,-.45);box(1.4,.95,.12,wood,0,.55,-.7);}
  if(kind==="sofa"){box(1.5,.42,.72,mat(0x547a74),0,.45,0);box(1.5,.72,.16,mat(0x547a74),0,.83,-.28);for(const sx of [-.68,.68])box(.16,.62,.72,mat(0x42635d),sx,.67,0);}
  if(kind==="lamp"){cyl(0,.4,0,.07,.09,.8,metal);ball(0,.95,0,.28,.22,.28,mat(0xffd98a,.25));}
  if(["gate","fence","pen"].includes(kind)){for(const sx of [-.75,.75])box(.12,1.25,.12,darkWood,sx,.625,0);for(const yy of [.35,.95])box(1.5,.12,.1,wood,0,yy,0);if(kind!=="fence")for(let i=-2;i<=2;i++)box(.07,.75,.09,wood,i*.28,.62,0);}
  group.position.set(x,baseY,z);group.rotation.y=rotation;group.userData.buildRecord=record;group.userData.vy=0;group.userData.buildHeight=group.userData.buildHeight||new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3()).y;scene.add(group);buildGroups.push(group);
  if(kind==="elevator")rebuildElevatorOpenings();
  if(kind==="pool"||kind==="platea")refreshTerrainSurface();
  if(["sheep","cow","horse","chicken","pig","goat","fox","person","robot","trex"].includes(kind)) loadAnimalModel(group,kind,options.notify===true);
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
    const targetHeight={sheep:.95,cow:1.55,horse:1.65,chicken:.55,pig:.9,goat:.95,fox:.65,person:1.75,robot:1.9,trex:4}[kind]||1;
    const scale=targetHeight/size.y;
    model.scale.setScalar(scale);
    model.position.y=-bounds.min.y*scale;
    model.visible=true;
    model.traverse(o=>{if(o.isMesh){o.visible=true;o.castShadow=true;o.receiveShadow=true;if(o.material){const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){m.visible=true;m.needsUpdate=true;}}}});
    group.add(model);group.updateMatrixWorld(true);
    const mixer=new THREE.AnimationMixer(model),actions={};
    for(const clip of gltf.animations){const name=clip.name.toLowerCase();if(/dance|disco|hip.?hop|party|salsa/.test(name))actions.dance=mixer.clipAction(clip);else if(name.includes("idle"))actions.idle=mixer.clipAction(clip);else if(name.includes("walk"))actions.walk=mixer.clipAction(clip);else if(name.includes("run"))actions.run=mixer.clipAction(clip);else if(!actions.idle&&(name.includes("look")||name.includes("tail")||name.includes("wag")))actions.idle=mixer.clipAction(clip);}
    const idle=actions.idle||(actions.walk)||(gltf.animations[0]&&mixer.clipAction(gltf.animations[0]));if(idle){idle.play();actions.current=idle;}
    group.userData.animalMixer=mixer;group.userData.animalActions=actions;group.userData.animalModel=model;group.userData.animalModelBase={position:model.position.clone(),rotation:model.rotation.clone()};group.userData.buildHeight=targetHeight;group.userData.roamOrigin=group.position.clone();group.userData.roamTarget=group.position.clone().add(new THREE.Vector3((Math.random()-.5)*5,0,(Math.random()-.5)*5));group.userData.roamTimer=2+Math.random()*3;
    if(notify)showToast("Animal 3D cargado y visible");
  }catch(error){
    console.error("ILOX: falló la carga del animal 3D",kind,url,error);
    if(!group.userData.fallbackAnimal){const fallback=new THREE.Mesh(new THREE.CapsuleGeometry(.34,.72,4,8),new THREE.MeshStandardMaterial({color:kind==="cow"?0xe8e5dc:kind==="horse"?0x8b5738:0xb6a27c,roughness:.92}));fallback.position.y=.72;fallback.castShadow=true;fallback.receiveShadow=true;fallback.userData.animalFallback=true;group.add(fallback);group.userData.fallbackAnimal=true;group.userData.buildHeight=1.45;}
    if(notify)showToast("El modelo 3D no respondió. Dejamos un animal de respaldo y conservamos tu construcción.");
  }
}
let localBuildSaveTimer=null,localBuildSaveMaxTimer=null;
let lastAnimalPositionSave=0,animalPositionsDirty=false;
function writeLocalBuildSave(){
  const key=activeMultiplayerWorldId?"ilox-mp-cache-"+activeMultiplayerWorldId:"ilox-builds-v1";
  const records=buildRecords.map(record=>activeMultiplayerWorldId?multiplayerPayload(record):record);
  localStorage.setItem(key,JSON.stringify(records));
  if(localBuildSaveTimer)clearTimeout(localBuildSaveTimer);
  if(localBuildSaveMaxTimer)clearTimeout(localBuildSaveMaxTimer);
  localBuildSaveTimer=null;localBuildSaveMaxTimer=null;
}
function flushLocalBuildSave(){
  if(localBuildSaveTimer){clearTimeout(localBuildSaveTimer);localBuildSaveTimer=null;}
  if(localBuildSaveMaxTimer){clearTimeout(localBuildSaveMaxTimer);localBuildSaveMaxTimer=null;}
  try{writeLocalBuildSave();return true;}
  catch(error){showToast("No se pudo guardar el mundo en este dispositivo.");return false;}
}
function persistBuilds(){
  // Guardado local agrupado: pausa corta o límite máximo de 3 segundos durante construcción continua.
  if(localBuildSaveTimer)clearTimeout(localBuildSaveTimer);
  localBuildSaveTimer=setTimeout(()=>{
    try{writeLocalBuildSave();}
    catch(error){localBuildSaveTimer=null;localBuildSaveMaxTimer=null;showToast("No se pudo guardar el mundo en este dispositivo.");}
  },650);
  if(!localBuildSaveMaxTimer)localBuildSaveMaxTimer=setTimeout(()=>{
    try{writeLocalBuildSave();}
    catch(error){localBuildSaveTimer=null;localBuildSaveMaxTimer=null;showToast("No se pudo guardar el mundo en este dispositivo.");}
  },3000);
  // La nube se actualiza por tandas, no con cada objeto colocado.
  if(activeMultiplayerWorldId)scheduleMultiplayerSync();
  return true;
}
function migrateConnectedRoofs(){
  let changed=false;const seen=new Set();
  for(const record of [...buildRecords]){
    if(record.kind!=="roof")continue;
    const area=connectedPlateaFootprint(foundationAt(record.x,record.z));if(!area)continue;
    const previousOpening=record.roofOpening;
    if(previousOpening===undefined)record.roofOpening=buildRecords.some(item=>item.kind==="elevator"&&item.y<record.y&&Math.abs(item.x-area.x)<area.width/2&&Math.abs(item.z-area.z)<area.depth/2);
    const key=[area.x,area.z,area.width,area.depth].map(v=>Math.round(v*100)/100).join(":");
    if(seen.has(key)){
      const group=buildGroups.find(item=>item.userData.buildRecord===record);
      if(group){scene.remove(group);const index=buildGroups.indexOf(group);if(index>=0)buildGroups.splice(index,1);}
      const index=buildRecords.indexOf(record);if(index>=0)buildRecords.splice(index,1);
      changed=true;continue;
    }
    seen.add(key);
    const supportTops=buildRecords.filter(item=>["wall","block","brick","door","window"].includes(item.kind)&&Math.abs(item.x-area.x)<=area.width/2&&Math.abs(item.z-area.z)<=area.depth/2&&(Math.abs(item.x-(area.x-area.width/2))<1.1||Math.abs(item.x-(area.x+area.width/2))<1.1||Math.abs(item.z-(area.z-area.depth/2))<1.1||Math.abs(item.z-(area.z+area.depth/2))<1.1)).map(item=>(item.y||0)+(item.kind==="door"?3:1.5));
    const supportY=supportTops.length?Math.max(...supportTops):record.y;
    if(record.roofRevision!=="connected-plateas-v2"||Math.abs((record.roofWidth||1.5)-area.width)>.01||Math.abs((record.roofDepth||1.5)-area.depth)>.01||Math.abs(record.x-area.x)>.01||Math.abs(record.z-area.z)>.01||Math.abs((record.y||0)-supportY)>.08||record.roofOpening!==previousOpening){
      record.x=area.x;record.z=area.z;record.y=supportY;record.roofWidth=area.width;record.roofDepth=area.depth;record.roofRevision="connected-plateas-v2";
      const old=buildGroups.find(group=>group.userData.buildRecord===record);
      if(old){scene.remove(old);const index=buildGroups.indexOf(old);if(index>=0)buildGroups.splice(index,1);}
      createBuildPiece(record);changed=true;
    }
  }
  return changed;
}
function loadBuilds() {
  if(buildRecords.length) return;
  try {
    const saved=JSON.parse(localStorage.getItem("ilox-builds-v1")||"[]");
    if(Array.isArray(saved)) saved.slice(0,1200).forEach(record=>{if(record&&["block","brick","platea","floor","wall","door","window","roof","stairs","elevator","pool","tree","rock","water","chair","table","bed","sofa","lamp","gate","fence","pen","sheep","cow","horse","chicken","pig","goat","fox","person","robot","trex"].includes(record.kind)&&Number.isFinite(record.x)&&Number.isFinite(record.z)){if(record.kind==="door")record.open=false;const heights={block:1.5,brick:1.5,platea:.3,wall:1.5,door:3.0,window:1.5,roof:1.5,stairs:1.5,elevator:120,pool:.22,floor:.16,tree:2.5,rock:.9,chair:1.5,table:1.05,bed:1.1,sofa:1.2,lamp:1.2,gate:1.25,fence:1.25,pen:1.25,sheep:.6,cow:.95,horse:1.2,chicken:.4,pig:.62,goat:.62,fox:.9,person:1.75,robot:1.8,trex:3.2};const supported=buildRecords.some(lower=>Math.abs(lower.x-record.x)<.2&&Math.abs(lower.z-record.z)<.2&&Math.abs((lower.y+(heights[lower.kind]||1.5))-record.y)<.24);if(!supported&&!["platea","pool"].includes(record.kind)&&Math.abs(record.y-terrainHeight(record.x,record.z))>.12)record.y=terrainHeight(record.x,record.z);buildRecords.push(record);createBuildPiece(record);}});
     if(migrateConnectedRoofs())flushLocalBuildSave();
  } catch(error){ console.warn("ILOX: no se pudieron recuperar las construcciones",error); }
}

function rebuildElevatorOpenings(){
  const targets=buildGroups.filter(g=>["platea","floor","roof"].includes(g.userData.buildRecord?.kind));
  for(const old of targets){
    const record=old.userData.buildRecord,index=buildGroups.indexOf(old);
    scene.remove(old);if(index>=0)buildGroups.splice(index,1);
    createBuildPiece(record);
  }
}
function elevatorFloorAtPlayer(group){
  const rec=group?.userData.buildRecord,count=Math.max(1,Math.min(40,rec?.floorCount||40));
  return THREE.MathUtils.clamp(Math.round((player.position.y-(group.position.y+.34))/3)+1,1,count);
}
function elevatorLandingExists(group,floor){
  const targetY=group.position.y+(floor-1)*3,gx=group.position.x,gz=group.position.z;
  return buildRecords.some(record=>{
    if(!["platea","floor","roof"].includes(record.kind)||Math.abs((Number(record.y)||0)-targetY)>.8)return false;
    const halfW=record.kind==="platea"?3:record.kind==="roof"?(record.roofWidth||1.5)/2:.75;
    const halfD=record.kind==="platea"?3:record.kind==="roof"?(record.roofDepth||1.5)/2:.75;
    return Math.abs(record.x-gx)<=halfW+1.25&&Math.abs(record.z-gz)<=halfD+1.25;
  });
}
function elevatorDoorAreaOccupied(group){
  if(!group||!player)return false;
  const floorY=group.position.y+((group.userData.buildRecord?.currentFloor||1)-1)*3+.34;
  const playerNear=Math.hypot(player.position.x-group.position.x,player.position.z-(group.position.z+3.1))<2.25&&Math.abs(player.position.y-floorY)<1.4;
  if(playerNear)return true;
  if(elevatorBot&&elevatorBotElevator===group&&["approachFront","board","waitingTop","rideDown","exit"].includes(elevatorBotPhase)){
    const cabin=group.userData.elevatorCabin,insideY=group.position.y+(cabin?.position.y||0)+.16;
    const outside=new THREE.Vector3(group.position.x, floorY, group.position.z+4.35);
    const inside=new THREE.Vector3(group.position.x, insideY, group.position.z);
    if(elevatorBot.position.distanceTo(outside)<2.4||elevatorBot.position.distanceTo(inside)<2.4)return true;
  }
  return false;
}
function setElevatorDoorState(group,open,broadcast=true,manual=false){
  const rec=group?.userData.buildRecord;
  if(!rec||group.userData.elevatorTravel)return false;
  const floor=rec.currentFloor||1;
  if(open&&!elevatorLandingExists(group,floor)){showToast("No hay una plataforma segura en esta planta.");return false;}
  if(!open&&manual&&elevatorDoorAreaOccupied(group)){showToast("Esperá a que todos salgan de la entrada.");return false;}
  const now=Date.now();
  const currentProgress=Number(group.userData.elevatorDoorProgress??(group.userData.elevatorDoorOpen?1:0));
  group.userData.elevatorDoorOpen=!!open;
  group.userData.elevatorDoorAnimation={from:currentProgress,to:open?1:0,startedAt:now,duration:850};
  group.userData.elevatorDoorCloseAt=open?now+4500:0;
  group.userData.elevatorDoorChangedAt=now;
  if(broadcast&&multiplayerSession?.sendElevatorDoorState){
    multiplayerSession.sendElevatorDoorState({x:rec.x,z:rec.z,floor,open:!!open,changedAt:group.userData.elevatorDoorChangedAt})
      .catch(error=>console.warn("ILOX elevator door sync:",error));
  }
  return true;
}
function animateElevator(group,now=Date.now()){
  const rec=group.userData.buildRecord,cabin=group.userData.elevatorCabin;if(!rec||!cabin)return;
  const travel=group.userData.elevatorTravel;
  let offset=((rec.currentFloor||1)-1)*3;
  if(travel){
    const t=THREE.MathUtils.clamp((now-travel.startedAt)/travel.duration,0,1);
    offset=((travel.fromFloor-1)+(travel.toFloor-travel.fromFloor)*t)*3;
    if(t>=1){
      rec.currentFloor=travel.toFloor;rec.targetFloor=travel.toFloor;
      group.userData.elevatorTravel=null;
      group.userData.elevatorDoorOpen=false;
      group.userData.elevatorDoorCloseAt=0;
      if(elevatorLandingExists(group,travel.toFloor))setElevatorDoorState(group,true,!group.userData.elevatorRemoteTravel,false);
      else showToast("No hay una plataforma segura en ese piso. Las puertas permanecen cerradas.");
      if(elevatorRiding&&activeElevator===group&&group.userData.elevatorDoorOpen)openElevatorKeypad(group);
      if(!group.userData.elevatorRemoteTravel)persistBuilds();
      group.userData.elevatorRemoteTravel=false;
    }
  }
  if(group.userData.elevatorDoorCloseAt&&now>=group.userData.elevatorDoorCloseAt&&!elevatorRiding){
    if(elevatorDoorAreaOccupied(group))group.userData.elevatorDoorCloseAt=now+900;
    else setElevatorDoorState(group,false,true,false);
  }
  cabin.position.y=.18+offset;
  const currentFloor=rec.currentFloor||1;
  const open=!!group.userData.elevatorDoorOpen&&!group.userData.elevatorTravel&&elevatorLandingExists(group,currentFloor);
  const doorAnimation=group.userData.elevatorDoorAnimation;
  let doorProgress=Number(group.userData.elevatorDoorProgress??(open?1:0));
  if(doorAnimation){
    const t=THREE.MathUtils.clamp((now-doorAnimation.startedAt)/doorAnimation.duration,0,1);
    const eased=t*t*(3-2*t);
    doorProgress=doorAnimation.from+(doorAnimation.to-doorAnimation.from)*eased;
    if(t>=1)group.userData.elevatorDoorAnimation=null;
  }
  group.userData.elevatorDoorProgress=doorProgress;
  const slide=doorProgress*2.9;
  const left=cabin.userData.doorLeft,right=cabin.userData.doorRight;
  if(left&&right){left.position.x=-1.45-slide;right.position.x=1.45+slide;}
  for(const landing of group.userData.elevatorLandingDoors||[]){
    const landingProgress=landing.floor===currentFloor?doorProgress:0;
    const landingSlide=landingProgress*2.9;
    landing.left.position.x=-1.45-landingSlide;landing.right.position.x=1.45+landingSlide;
  }
  if(elevatorRiding&&activeElevator===group&&player){
    const wantsExit=open&&doorProgress>=.98&&(Math.hypot(moveStick.x,moveStick.y)>.12||keys.has("arrowup")||keys.has("arrowdown")||keys.has("arrowleft")||keys.has("arrowright"));
    if(wantsExit){elevatorRiding=false;elevatorJustExitedAt=now;stopIloxElevatorParty();group.userData.elevatorDoorCloseAt=now+900;closeElevatorKeypad();}
    else if(elevatorRiding){player.position.set(group.position.x,group.position.y+cabin.position.y+.16,group.position.z);playerVerticalVelocity=0;playerGrounded=true;}
  }
}

// Pista instrumental original de Suno para el ascensor ILOX.
let iloxElevatorTrack=null;
const ILOX_ELEVATOR_EMOTES=["😂","🤩","🎉","❤️","⭐","🎵","🕺","🥳","✨","💃","🚀","👏"];
function startIloxElevatorParty(){
  try{
    stopIloxElevatorParty(false);
    if(!iloxElevatorTrack){
      iloxElevatorTrack=new Audio(new URL("./elevator-party.mp3",import.meta.url).href);
      iloxElevatorTrack.preload="auto";
      iloxElevatorTrack.volume=.9;
      iloxElevatorTrack.loop=false;
      iloxElevatorTrack.addEventListener("error",()=>console.warn("ILOX: no se pudo cargar elevator-party.mp3"));
    }
    iloxElevatorTrack.pause();
    try{iloxElevatorTrack.currentTime=0;}catch(_){}
    // play() se invoca sincrónicamente desde la acción de viaje del jugador
    // para respetar las políticas de audio de Android y navegadores móviles.
    const playback=iloxElevatorTrack.play();
    if(playback?.catch)playback.catch(error=>console.warn("ILOX: no se pudo reproducir la canción del ascensor",error));
    if(player){player.userData.iloxDancing=true;player.userData.iloxEmoteNext=0;player.userData.iloxDanceStarted=clock.elapsedTime;}
  }catch(error){console.warn("ILOX: no se pudo iniciar la canción del ascensor",error);}
}
function stopIloxElevatorParty(clearDance=true){
  if(iloxElevatorTrack){
    iloxElevatorTrack.pause();
    try{iloxElevatorTrack.currentTime=0;}catch(_){}
  }
  if(clearDance&&player){player.userData.iloxDancing=false;if(player.userData.iloxEmote){player.remove(player.userData.iloxEmote);player.userData.iloxEmote.material.map?.dispose();player.userData.iloxEmote.material.dispose();player.userData.iloxEmote=null;}}
}
function updateIloxElevatorParty(delta){
  if(!player?.userData.iloxDancing)return;
  const t=clock.elapsedTime-(player.userData.iloxDanceStarted||0),beat=t* Math.PI*2*1.92,phase=beat;
  const groove=Math.sin(phase),side=Math.sin(phase*.5),accent=Math.sin(phase*2);
  const bar=((t*1.92)%4)/4;
  const rig=player.userData.rig;
  // Coreografía pop-funk visible: rebote de rodillas, cadera marcada y torso que se inclina.
  if(rig){
    const bounce=Math.abs(Math.sin(phase))*.22;
    rig.position.y=(player.userData.toonType?Math.sin(clock.elapsedTime*2)*.022:0)+bounce;
    rig.rotation.z=side*.34+Math.sin(phase*.25)*.10;
    rig.rotation.x=Math.sin(phase*.5)*.20+Math.sin(phase*1.5)*.07;
    rig.rotation.y=Math.sin(phase*.5)*.18;
  }else{
    player.position.y+=Math.sin(phase*2)*.004;
    player.rotation.z=side*.18;
  }
  // Brazos alternan bombeos, apertura lateral y poses por encima de la cabeza.
  player.userData.arms?.forEach((arm,n)=>{
    const sign=n===0?-1:1;
    const overhead=Math.max(0,Math.sin(phase*.5+(n*Math.PI)));
    const punch=Math.sin(phase+n*Math.PI);
    const reach=Math.sin(phase*.5+n*Math.PI);
    arm.rotation.x=-.35+punch*.95+Math.max(0,Math.sin(phase*2+n*Math.PI))*.42;
    arm.rotation.z=sign*(.28+overhead*1.65+Math.max(0,reach)*.48);
    arm.rotation.y=sign*(.12+Math.sin(phase+n*Math.PI)*.34);
  });
  // Pasos laterales y patadas alternadas, con amplitud suficiente para que se note el baile.
  player.userData.legs?.forEach((leg,n)=>{
    const kick=Math.sin(phase+n*Math.PI);
    leg.rotation.x=kick*.92+Math.max(0,Math.sin(phase*2+n*Math.PI))*.28;
    leg.rotation.z=(n===0?-1:1)*(.10+Math.max(0,Math.sin(phase*.5+n*Math.PI))*.20);
  });
  if(t>=(player.userData.iloxEmoteNext||0)){
    const emoji=ILOX_ELEVATOR_EMOTES[Math.floor(Math.random()*ILOX_ELEVATOR_EMOTES.length)];
    const canvas=document.createElement("canvas");canvas.width=128;canvas.height=128;
    const ctx=canvas.getContext("2d");ctx.font="100px sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(emoji,64,68);
    const texture=new THREE.CanvasTexture(canvas);texture.needsUpdate=true;
    if(player.userData.iloxEmote){player.remove(player.userData.iloxEmote);player.userData.iloxEmote.material.map?.dispose();player.userData.iloxEmote.material.dispose();}
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false}));
    sprite.scale.set(.78,.78,1);sprite.position.set((Math.random()-.5)*.75,2.85,0);sprite.userData.started=t;
    player.add(sprite);player.userData.iloxEmote=sprite;player.userData.iloxEmoteNext=t+.48+Math.random()*.42;
  }
  const emote=player.userData.iloxEmote;
  if(emote){const age=t-(emote.userData.started||0);emote.position.y=2.85+Math.min(age,.7)*.55;emote.material.opacity=Math.max(0,1-age/.95);}
}

function beginElevatorTravel(group,targetFloor,startedAt=Date.now(),broadcast=true){
  const rec=group?.userData.buildRecord;if(!rec||group.userData.elevatorTravel)return false;
  const floorCount=Math.max(1,Math.min(40,Number(rec.floorCount)||40));
  const fromFloor=THREE.MathUtils.clamp(Math.round(Number(rec.currentFloor)||1),1,floorCount);
  const toFloor=THREE.MathUtils.clamp(Math.round(Number(targetFloor)||1),1,floorCount);
  if(fromFloor===toFloor){
    const opened=setElevatorDoorState(group,true,broadcast,false);
    if(!opened)showToast("No hay una plataforma segura en ese piso. Las puertas permanecen cerradas.");
    return opened;
  }
  // Cerrar las puertas y comenzar el desplazamiento en la misma operación.
  // No esperar a un estado pendiente: ese segundo paso podía quedar bloqueado
  // por la animación de las hojas y dejar inmóvil tanto al jugador como al bot.
  group.userData.elevatorPendingTravel=null;
  if(!setElevatorDoorState(group,false,broadcast,false))return false;
  const duration=Math.max(1200,Math.abs(toFloor-fromFloor)*1250);
  group.userData.elevatorTravel={fromFloor,toFloor,startedAt,duration};
  if(elevatorRiding&&activeElevator===group)startIloxElevatorParty();
  rec.targetFloor=toFloor;
  if(broadcast&&multiplayerSession)multiplayerSession.sendElevatorState({x:rec.x,z:rec.z,y:rec.y,fromFloor,toFloor,startedAt,duration}).catch(error=>console.warn("ILOX elevator sync:",error));
  if(fromFloor===12&&toFloor===1&&elevatorBotIsController(rec)&&["waitingTop","rideDown"].includes(elevatorBotPhase))setElevatorBotPhase("rideDown",group,new THREE.Vector3(group.position.x,group.position.y+group.userData.elevatorCabin.position.y+.16,group.position.z));
  return true;
}
function applyRemoteElevatorState(state){
  const group=buildGroups.find(item=>item.userData.buildRecord?.kind==="elevator"&&Math.abs(item.position.x-state.x)<.1&&Math.abs(item.position.z-state.z)<.1);
  if(!group)return;
  const rec=group.userData.buildRecord;
  rec.currentFloor=state.fromFloor;group.userData.elevatorDoorOpen=false;group.userData.elevatorDoorCloseAt=0;
  group.userData.elevatorTravel={fromFloor:state.fromFloor,toFloor:state.toFloor,startedAt:state.startedAt,duration:state.duration};group.userData.elevatorRemoteTravel=true;
  if(state.fromFloor===12&&state.toFloor===1&&elevatorBotIsController(rec)&&["waitingTop","rideDown"].includes(elevatorBotPhase))setElevatorBotPhase("rideDown",group,new THREE.Vector3(group.position.x,group.position.y+group.userData.elevatorCabin.position.y+.16,group.position.z));
}
function updateElevatorDisplay(){if(elevatorDisplay)elevatorDisplay.textContent=String(elevatorSelectedFloor);}
function openElevatorKeypad(group){if(!elevatorRiding||!group||activeElevator!==group||group.userData.elevatorTravel)return;const count=Math.max(1,Math.min(40,group.userData.buildRecord?.floorCount||40));elevatorSelectedFloor=THREE.MathUtils.clamp(group.userData.buildRecord?.currentFloor||1,1,count);const keys=elevatorPanel?.querySelector(".elevator-keys");if(!keys)return;keys.innerHTML="";for(let floor=1;floor<=count;floor++){const b=document.createElement("button");b.type="button";b.className="elevator-key";b.dataset.floor=String(floor);b.textContent=String(floor);if(floor===elevatorSelectedFloor)b.classList.add("selected");keys.appendChild(b);}elevatorStatus.textContent="Elegí el piso de destino";elevatorPanel.classList.remove("hidden");updateElevatorDisplay();}
function closeElevatorKeypad(){elevatorPanel?.classList.add("hidden");}
function confirmElevatorTravel(group){if(!elevatorRiding||!group||activeElevator!==group)return false;const target=THREE.MathUtils.clamp(Math.round(elevatorSelectedFloor||1),1,Math.max(1,Math.min(40,group.userData.buildRecord?.floorCount||40)));const started=beginElevatorTravel(group,target);if(started){elevatorStatus.textContent="Viajando al piso "+target;closeElevatorKeypad();}else{elevatorStatus.textContent="No se pudo iniciar el viaje. Revisá el estado del ascensor.";showToast("No se pudo iniciar el viaje.");}return started;}
function tryElevatorConsoleAtPointer(event){if(!elevatorRiding||!activeElevator?.userData.elevatorConsole||activeElevator.userData.elevatorTravel)return false;const rect=renderer.domElement.getBoundingClientRect(),pointer=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-((event.clientY-rect.top)/rect.height)*2+1),raycaster=new THREE.Raycaster();raycaster.setFromCamera(pointer,camera);activeElevator.updateMatrixWorld(true);const hit=raycaster.intersectObject(activeElevator.userData.elevatorConsole,true)[0];if(!hit)return false;if(elevatorPanel&&!elevatorPanel.classList.contains("hidden"))confirmElevatorTravel(activeElevator);else openElevatorKeypad(activeElevator);return true;}
function elevatorCabinOccupied(group){
  if(!group)return false;
  const cabin=group.userData.elevatorCabin;
  const floorY=group.position.y+(cabin?.position.y||.18)+.16;
  const inside=actor=>!!actor&&Math.abs(actor.position.x-group.position.x)<2.72&&Math.abs(actor.position.z-group.position.z)<2.72&&Math.abs(actor.position.y-floorY)<1.35;
  if(elevatorRiding&&activeElevator===group)return true;
  if(inside(player))return true;
  if(elevatorBot&&elevatorBotElevator===group&&["board","waitingTop","rideDown"].includes(elevatorBotPhase)&&inside(elevatorBot))return true;
  for(const avatar of remotePlayers.values())if(inside(avatar))return true;
  return false;
}
function callElevator(group){
  if(!group||!player||elevatorRiding||group.userData.elevatorTravel)return;
  if(elevatorCabinOccupied(group)){showToast("Ascensor ocupado. Esperá a que los pasajeros desciendan.");return;}
  const floor=elevatorFloorAtPlayer(group),landingY=group.position.y+.34+(floor-1)*3;
  if(Math.abs(player.position.y-landingY)>1.35){showToast("Acercate a una planta del ascensor para llamarlo.");return;}
  if(!elevatorLandingExists(group,floor)){showToast("No hay un descanso seguro en esta planta.");return;}
  if(beginElevatorTravel(group,floor))showToast("Ascensor llamado a la planta "+floor+".");
}
function updateElevators(delta){
  const elevators=buildGroups.filter(g=>g.userData.buildRecord?.kind==="elevator");
  let nearest=null,nearestFloor=1,nearestDistance=Infinity;
  for(const group of elevators){
    animateElevator(group);
    const d=Math.hypot(player.position.x-group.position.x,player.position.z-group.position.z);
    const floor=elevatorFloorAtPlayer(group),landingY=group.position.y+.34+(floor-1)*3,verticalGap=Math.abs(player.position.y-landingY);
    const score=d+verticalGap*2;
    const botNear=elevatorBot&&elevatorBotElevator===group&&elevatorBotPhase!=="done"&&Math.hypot(elevatorBot.position.x-group.position.x,elevatorBot.position.z-group.position.z)<7.1&&Math.abs(elevatorBot.position.y-landingY)<1.6;
    if(!group.userData.elevatorTravel&&!group.userData.elevatorDoorOpen&&elevatorLandingExists(group,floor)&&((d<7.1&&verticalGap<1.35)||botNear))setElevatorDoorState(group,true,true,false);
    if(d<5.5&&verticalGap<1.35&&score<nearestDistance){nearest=group;nearestFloor=floor;nearestDistance=score;}
    const cabin=group.userData.elevatorCabin,level=group.position.y+cabin.position.y+.16;
    if(!elevatorRiding&&Date.now()-elevatorJustExitedAt>1200&&!group.userData.elevatorTravel&&group.userData.elevatorDoorOpen&&Number(group.userData.elevatorDoorProgress||0)>=.98&&elevatorLandingExists(group,group.userData.buildRecord?.currentFloor||1)&&d<2.65&&Math.abs(player.position.y-level)<.65){
      activeElevator=group;elevatorRiding=true;
      player.position.set(group.position.x,level,group.position.z);playerVerticalVelocity=0;playerGrounded=true;
      openElevatorKeypad(group);
    }
  }
  if(!elevatorRiding){
    activeElevator=nearest;
    if(nearest){
      elevatorDoorOpenButton?.classList.toggle("hidden",!!nearest.userData.elevatorTravel||!!nearest.userData.elevatorDoorOpen);
      elevatorDoorCloseButton?.classList.toggle("hidden",!!nearest.userData.elevatorTravel||!nearest.userData.elevatorDoorOpen);
      elevatorCallButton?.classList.remove("hidden");
      if(elevatorCallButton){elevatorCallButton.disabled=!!nearest.userData.elevatorTravel;if(elevatorCallLabel)elevatorCallLabel.textContent=nearest.userData.elevatorTravel?"EN VIAJE":"PISO "+nearestFloor;}
    }else elevatorCallButton?.classList.add("hidden");
  }else {elevatorCallButton?.classList.add("hidden");elevatorDoorOpenButton?.classList.toggle("hidden",!!activeElevator?.userData.elevatorTravel||!!activeElevator?.userData.elevatorDoorOpen);elevatorDoorCloseButton?.classList.toggle("hidden",!!activeElevator?.userData.elevatorTravel||!activeElevator?.userData.elevatorDoorOpen);}
  if(!elevatorRiding)closeElevatorKeypad();
  if(elevatorRiding&&activeElevator?.userData.elevatorTravel)closeElevatorKeypad();
}
function ensureElevatorBot(){
  if(elevatorBot||!scene)return;
  elevatorBot=new THREE.Group();elevatorBot.name="ilox-shared-elevator-bot";
  elevatorBot.position.set(-6,terrainHeight(-6,-6),-6);
  elevatorBot.userData.buildHeight=1.9;
  scene.add(elevatorBot);
  loadAnimalModel(elevatorBot,"robot",false);
}
function applyRemoteElevatorDoorState(state){
  if(!state||!Number.isFinite(Number(state.x))||!Number.isFinite(Number(state.z)))return;
  const group=buildGroups.find(item=>item.userData.buildRecord?.kind==="elevator"&&Math.abs(item.position.x-state.x)<.1&&Math.abs(item.position.z-state.z)<.1);
  if(!group||Number(state.changedAt||0)<Number(group.userData.elevatorDoorChangedAt||0))return;
  if(group.userData.elevatorTravel)return;
  const floor=group.userData.buildRecord?.currentFloor||1;
  if(Number(state.floor)!==floor|| (state.open&&!elevatorLandingExists(group,floor)))return;
  const now=Date.now(),progress=Number(group.userData.elevatorDoorProgress??(group.userData.elevatorDoorOpen?1:0));
  group.userData.elevatorDoorOpen=!!state.open;
  group.userData.elevatorDoorAnimation={from:progress,to:state.open?1:0,startedAt:now,duration:850};
  group.userData.elevatorDoorCloseAt=state.open?now+4500:0;
  group.userData.elevatorDoorChangedAt=Number(state.changedAt)||now;
}
function applyRemoteElevatorBotState(state){
  if(!state||state.userId===multiplayerUserId)return;
  if(!elevatorBot)ensureElevatorBot();
  if(!elevatorBot)return;
  elevatorBotRemoteState={...state};
  elevatorBotTarget=new THREE.Vector3(Number(state.x)||0,Number(state.y)||0,Number(state.z)||0);
  elevatorBot.rotation.y=Number(state.rotation)||0;
  elevatorBotPhase=String(state.phase||"idle");
}
function elevatorBotIsController(record){
  if(!multiplayerSession)return true;
  return !!record?.cloudOwnerId&&record.cloudOwnerId===multiplayerUserId;
}
function setElevatorBotPhase(phase,group,target){
  elevatorBotPhase=phase;elevatorBotElevator=group;elevatorBotTarget=target?target.clone():null;
  if(phase!=="waitingTop")elevatorBotWaitUntil=0;
}
function updateElevatorBot(delta){
  if(!elevatorBot)return;
  if(elevatorBot.userData.animalMixer)elevatorBot.userData.animalMixer.update(delta);
  if(elevatorBotElevator&&!buildGroups.includes(elevatorBotElevator)){
    elevatorBotElevator=null;elevatorBotPhase="idle";elevatorBotTarget=null;elevatorBotWaitUntil=0;
  }
  const group=elevatorBotElevator||buildGroups.find(item=>item.userData.buildRecord?.kind==="elevator");
  if(!group){
    if(elevatorBotRemoteState&&elevatorBotTarget)elevatorBot.position.lerp(elevatorBotTarget,Math.min(1,delta*8));
    return;
  }
  const record=group.userData.buildRecord,controller=elevatorBotIsController(record);
  if(!controller){
    if(elevatorBotTarget)elevatorBot.position.lerp(elevatorBotTarget,Math.min(1,delta*8));
    const remoteActions=elevatorBot.userData.animalActions,remoteMoving=!!elevatorBotRemoteState?.moving;
    const remoteNext=remoteMoving?(remoteActions?.walk||remoteActions?.run):(remoteActions?.idle||remoteActions?.walk);
    if(remoteNext&&remoteNext!==remoteActions.current){remoteNext.reset().fadeIn(.2).play();if(remoteActions.current)remoteActions.current.fadeOut(.2);remoteActions.current=remoteNext;}
    return;
  }
  if(!elevatorBotElevator){
    elevatorBot.position.set(-6,terrainHeight(-6,-6),-6);
    setElevatorBotPhase("approach",group,new THREE.Vector3(group.position.x-4.5,terrainHeight(group.position.x-4.5,group.position.z+4.35),group.position.z+4.35));
  }
  const cabin=group.userData.elevatorCabin;if(!cabin)return;
  const floorOneY=group.position.y+.34;
  const floorY=group.position.y+cabin.position.y+.16;
  const inside=new THREE.Vector3(group.position.x,floorY,group.position.z);
  const outside=new THREE.Vector3(group.position.x,floorOneY,group.position.z+4.35);
  if(elevatorBotPhase==="approach"){
    elevatorBotTarget.set(group.position.x-4.5,terrainHeight(group.position.x-4.5,group.position.z+4.35),group.position.z+4.35);
    if(elevatorBot.position.distanceTo(elevatorBotTarget)<.35)setElevatorBotPhase("approachFront",group,outside);
  }else if(elevatorBotPhase==="approachFront"){
    elevatorBotTarget=outside;
    if(elevatorBot.position.distanceTo(outside)<.35&&!group.userData.elevatorTravel&&!group.userData.elevatorDoorOpen&&elevatorLandingExists(group,1))beginElevatorTravel(group,1,Date.now(),true);
    if(elevatorBot.position.distanceTo(outside)<.35&&group.userData.elevatorDoorOpen&&Number(group.userData.elevatorDoorProgress||0)>=.98&&!group.userData.elevatorTravel&&elevatorLandingExists(group,1))setElevatorBotPhase("board",group,inside);
  }else if(elevatorBotPhase==="board"){
    elevatorBotTarget=inside;
    if(elevatorBot.position.distanceTo(inside)<.48&&elevatorLandingExists(group,1)){
      elevatorBot.position.copy(inside);
      if(!group.userData.elevatorTravel&&beginElevatorTravel(group,12,Date.now(),true))setElevatorBotPhase("waitingTop",group,inside);
    }
  }else if(elevatorBotPhase==="waitingTop"){
    elevatorBotTarget=inside;elevatorBot.position.copy(inside);
    if((record.currentFloor||1)===12&&!group.userData.elevatorTravel){
      if(!elevatorBotWaitUntil)elevatorBotWaitUntil=Date.now()+6500;
      if(Date.now()>=elevatorBotWaitUntil&&beginElevatorTravel(group,1,Date.now(),true))setElevatorBotPhase("rideDown",group,inside);
    }
  }else if(elevatorBotPhase==="rideDown"){
    elevatorBotTarget=inside;elevatorBot.position.copy(inside);
    if((record.currentFloor||1)===1&&!group.userData.elevatorTravel&&group.userData.elevatorDoorOpen&&Number(group.userData.elevatorDoorProgress||0)>=.98&&elevatorLandingExists(group,1))setElevatorBotPhase("exit",group,outside);
  }else if(elevatorBotPhase==="exit"){
    elevatorBotTarget=outside;
    if(elevatorBot.position.distanceTo(outside)<.35){elevatorBot.position.copy(outside);setElevatorBotPhase("done",group,outside);}
  }else if(elevatorBotPhase==="done"){
    elevatorBotTarget=outside;elevatorBot.position.lerp(outside,Math.min(1,delta*4));
  }
  if(elevatorBotTarget&&elevatorBotPhase!=="waitingTop"&&elevatorBotPhase!=="rideDown"){
    const dx=elevatorBotTarget.x-elevatorBot.position.x,dz=elevatorBotTarget.z-elevatorBot.position.z,dist=Math.hypot(dx,dz);
    if(dist>.08){const step=Math.min(dist,1.45*delta);elevatorBot.position.x+=dx/dist*step;elevatorBot.position.z+=dz/dist*step;elevatorBot.position.y+=THREE.MathUtils.clamp(elevatorBotTarget.y-elevatorBot.position.y,-1.8*delta,1.8*delta);elevatorBot.rotation.y=Math.atan2(dx,dz);}
  }
  const actions=elevatorBot.userData.animalActions,moving=["approach","approachFront","board","exit"].includes(elevatorBotPhase)&&elevatorBotTarget&&elevatorBot.position.distanceTo(elevatorBotTarget)>.12;
  const next=moving?(actions?.walk||actions?.run||actions?.idle):(actions?.idle||actions?.walk);
  if(next&&next!==actions.current){next.reset().fadeIn(.2).play();if(actions.current)actions.current.fadeOut(.2);actions.current=next;}
  if(multiplayerSession&&performance.now()-elevatorBotLastBroadcast>120){
    elevatorBotLastBroadcast=performance.now();
    multiplayerSession.sendBotState({x:elevatorBot.position.x,y:elevatorBot.position.y,z:elevatorBot.position.z,rotation:elevatorBot.rotation.y,phase:elevatorBotPhase,moving:!!moving}).catch(error=>console.warn("ILOX bot sync:",error));
  }
}

function multiplayerPayload(record){
  const payload={...record};
  delete payload.cloudId;delete payload.cloudOwnerId;delete payload.pin;
  return payload;
}
function multiplayerFingerprint(record){return JSON.stringify(multiplayerPayload(record));}
function clearCurrentBuildWorld(){
  for(const group of buildGroups)scene.remove(group);
  buildGroups.length=0;buildRecords.length=0;refreshTerrainSurface();
}
async function loadMultiplayerStructures(worldId){
  const rows=await Multiplayer.getWorldStructures(worldId);
  clearCurrentBuildWorld();multiplayerCloudSnapshot.clear();
  for(const row of rows){
    const record={...(row.payload||{}),kind:row.kind,cloudId:row.id,cloudOwnerId:row.owner_id};
    if(record.kind==="door")record.pin=null;
    buildRecords.push(record);createBuildPiece(record);
    multiplayerCloudSnapshot.set(row.id,multiplayerFingerprint(record));
  }
  migrateConnectedRoofs();
  refreshTerrainSurface();
  return rows.length;
}
function scheduleMultiplayerSync(){
  if(!activeMultiplayerWorldId)return;
  if(multiplayerSyncTimer)clearTimeout(multiplayerSyncTimer);
  multiplayerSyncTimer=setTimeout(()=>{multiplayerSyncTimer=null;syncMultiplayerStructures();},5000);
}
async function syncMultiplayerStructures(){
  if(!activeMultiplayerWorldId||!multiplayerUserId)return true;
  if(multiplayerSyncing){multiplayerSyncAgain=true;return false;}
  multiplayerSyncing=true;
  let changed=false,failed=false;
  const currentIds=new Set();
  try{
    // La pileta se sincroniza antes que el agua para que el agua guarde
    // una referencia real a la estructura que la contiene.
    const syncRecords=[...buildRecords].sort((a,b)=>(a.kind==="pool"?-1:0)-(b.kind==="pool"?-1:0));
    for(const record of syncRecords){
      const dependency=BUILD_DEPENDENCIES[record.kind];
      if(dependency){
        const [parentXField,parentZField]=dependency.positionFields||[];
        const parentX=parentXField?(record[parentXField]??record.x):record.x;
        const parentZ=parentZField?(record[parentZField]??record.z):record.z;
        const parent=buildRecords.find(item=>dependency.parents.includes(item.kind)&&
          Math.abs(item.x-parentX)<.05&&Math.abs(item.z-parentZ)<.05);
        if(!parent)throw new Error("Falta la estructura principal: "+dependency.label+".");
        if(!parent.cloudId)throw new Error("Primero se debe guardar la estructura principal ("+dependency.label+").");
        record[dependency.parentField]=parent.cloudId;
      }
      const fingerprint=multiplayerFingerprint(record);
      if(record.cloudId)currentIds.add(record.cloudId);
      if(record.cloudId&&multiplayerCloudSnapshot.get(record.cloudId)===fingerprint)continue;
      const saved=await Multiplayer.saveStructure(activeMultiplayerWorldId,multiplayerUserId,record);
      record.cloudId=saved.id;record.cloudOwnerId=saved.owner_id;
      currentIds.add(saved.id);multiplayerCloudSnapshot.set(saved.id,fingerprint);changed=true;
    }
    for(const [id] of [...multiplayerCloudSnapshot]){
      if(currentIds.has(id))continue;
      await Multiplayer.deleteStructure(activeMultiplayerWorldId,id);
      multiplayerCloudSnapshot.delete(id);changed=true;
    }
    if(changed&&multiplayerSession)await multiplayerSession.sendWorldRefresh();
  }catch(error){
    failed=true;
    console.warn("ILOX multiplayer: no se pudo guardar la estructura",error);
    showToast(error.message||"No se pudo guardar en línea. Revisá tu conexión.");
    // No recargar desde la nube ante un error: podría borrar cambios locales aún no guardados.
  }finally{
    multiplayerSyncing=false;
    if(multiplayerSyncAgain){multiplayerSyncAgain=false;scheduleMultiplayerSync();}
    if(!failed)localStorage.setItem("ilox-mp-cache-"+activeMultiplayerWorldId,JSON.stringify(buildRecords.map(multiplayerPayload)));
  }
  return !failed;
}
function removeRemotePlayer(userId){
  const avatar=remotePlayers.get(userId);
  if(avatar){scene.remove(avatar);remotePlayers.delete(userId);}
}
function updateRemotePlayer(data){
  const userId=data?.userId||data?.user_id;
  if(!data||!userId||userId===multiplayerUserId)return;
  const avatarKind=String(data.avatar||"boy:0");
  let avatar=remotePlayers.get(userId);
  if(avatar&&avatar.userData.remoteAvatarSelection!==avatarKind){scene.remove(avatar);remotePlayers.delete(userId);avatar=null;}
  const target=new THREE.Vector3(Number(data.x)||0,Number(data.y)||0,Number(data.z)||0);
  if(!avatar){
    avatar=makePlayer(avatarKind);
    avatar.position.copy(target);
    avatar.userData.remoteUserId=userId;
    avatar.userData.remoteAvatarSelection=avatarKind;
    avatar.userData.netTarget=target.clone();
    avatar.userData.remoteWalkPhase=0;
    avatar.userData.remoteMoving=!!data.moving;
    remotePlayers.set(userId,avatar);
  }else {
    const previousTarget=avatar.userData.netTarget;
    const displacement=previousTarget ? previousTarget.distanceTo(target) : 0;
    avatar.userData.netTarget.copy(target);
    avatar.userData.remoteMoving=!!data.moving || displacement>0.025;
  }
  avatar.userData.remoteLastSeen=Date.now();
  const remoteType = avatarKind.split(":")[0];
  const hasImportedModel = remoteType === "soldier" || !!HUMAN_AVATAR_MODELS[remoteType];
  if (hasImportedModel && !avatar.userData.riggedAvatar && !avatar.userData.remoteModelLoading) {
    avatar.userData.remoteModelLoading = true;
    loadRemoteAvatarModel(avatar, avatarKind);
  }
  avatar.userData.netRotation=Number(data.rotation)||0;
  if(data.moving===true) avatar.userData.remoteMoving=true;
  else if(!avatar.userData.remoteMoving) avatar.userData.remoteMoving=false;
  avatar.userData.remoteSwimming=!!data.swimming;
  avatar.userData.remoteJumping=!!data.jumping;
}
function playMultiplayerMessageSound(){
  try{
    const AudioContextClass=window.AudioContext||window.webkitAudioContext;
    if(!AudioContextClass)return;
    if(!multiplayerChatAudio)multiplayerChatAudio=new AudioContextClass();
    if(multiplayerChatAudio.state==="suspended")multiplayerChatAudio.resume().catch(()=>{});
    const context=multiplayerChatAudio,oscillator=context.createOscillator(),gain=context.createGain();
    oscillator.type="sine";oscillator.frequency.setValueAtTime(880,context.currentTime);
    oscillator.frequency.setValueAtTime(1175,context.currentTime+0.09);
    gain.gain.setValueAtTime(0.0001,context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12,context.currentTime+0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001,context.currentTime+0.22);
    oscillator.connect(gain);gain.connect(context.destination);oscillator.start();oscillator.stop(context.currentTime+0.24);
  }catch(error){console.warn("ILOX: no se pudo reproducir el aviso del chat",error);}
}
function updateMultiplayerUnreadBadge(){
  const toggle=document.querySelector("#mp-chat-toggle");if(!toggle)return;
  let badge=toggle.querySelector(".mp-chat-unread");
  if(!badge){badge=document.createElement("span");badge.className="mp-chat-unread";badge.setAttribute("aria-live","polite");toggle.appendChild(badge);}
  badge.textContent=multiplayerUnreadMessages>99?"99+":String(multiplayerUnreadMessages);
  badge.classList.toggle("hidden",multiplayerUnreadMessages===0);
  toggle.setAttribute("aria-label",multiplayerUnreadMessages?`Chat del mundo, ${multiplayerUnreadMessages} mensajes sin leer`:"Abrir chat del mundo");
}
function markMultiplayerChatRead(){multiplayerUnreadMessages=0;updateMultiplayerUnreadBadge();}
function appendMultiplayerChatMessage(row,notify=false){
  if(!row||row.id===undefined)return;
  const id=String(row.id);if(multiplayerChatSeen.has(id))return;
  multiplayerChatSeen.add(id);
  const incoming=!!notify&&!!row.user_id&&row.user_id!==multiplayerUserId;
  const chatPanel=document.querySelector("#mp-chat-panel");
  if(incoming){
    playMultiplayerMessageSound();
    if(chatPanel?.classList.contains("hidden")){multiplayerUnreadMessages++;updateMultiplayerUnreadBadge();}
  }
  const list=document.querySelector("#mp-chat-messages");if(!list)return;
  list.querySelector(".mp-chat-empty")?.remove();
  const item=document.createElement("article");item.className="mp-chat-message";
  const head=document.createElement("div");head.className="mp-chat-message-head";
  const name=document.createElement("strong");name.textContent=String(row.display_name||"Jugador").slice(0,32);
  const time=document.createElement("time");
  const date=new Date(row.created_at||Date.now());time.textContent=date.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
  head.append(name,time);
  const body=document.createElement("p");body.textContent=String(row.message||"").slice(0,500);
  item.append(head,body);list.appendChild(item);list.scrollTop=list.scrollHeight;
}
async function loadMultiplayerChat(worldId){
  const list=document.querySelector("#mp-chat-messages");if(!list)return;
  list.replaceChildren();multiplayerChatSeen.clear();
  const rows=await Multiplayer.getChatMessages(worldId);
  if(!rows.length){const empty=document.createElement("p");empty.className="mp-chat-empty";empty.textContent="Todavía no hay mensajes. ¡Saludá a tu compañero!";list.appendChild(empty);return;}
  for(const row of rows)appendMultiplayerChatMessage(row);
}
function stopMultiplayerFallbackSync(){
  if(multiplayerFallbackTimer){clearInterval(multiplayerFallbackTimer);multiplayerFallbackTimer=null;}
  multiplayerFallbackBusy=false;
}
async function refreshMultiplayerStructures(worldId) {
  if (activeMultiplayerWorldId !== worldId || multiplayerSyncing || multiplayerSyncTimer) return;
  const rows = await Multiplayer.getWorldStructures(worldId);
  const serverSnapshot = new Map(rows.map(row => {
    const record = { ...(row.payload || {}), kind: row.kind };
    if (record.kind === "door") record.pin = null;
    return [row.id, multiplayerFingerprint(record)];
  }));
  let changed = serverSnapshot.size !== multiplayerCloudSnapshot.size;
  if (!changed) {
    for (const [id, fingerprint] of serverSnapshot) {
      if (multiplayerCloudSnapshot.get(id) !== fingerprint) { changed = true; break; }
    }
  }
  if (changed && activeMultiplayerWorldId === worldId && !multiplayerSyncing && !multiplayerSyncTimer) {
    await loadMultiplayerStructures(worldId);
  }
}
function startMultiplayerFallbackSync(worldId){
  stopMultiplayerFallbackSync();
  multiplayerLastChatPoll=Date.now();
  multiplayerLastStructurePoll=Date.now();
  // Respaldo real de mundo: consulta posiciones, chat y construcciones persistidas.
  multiplayerFallbackTimer=setInterval(async()=>{
    if(!multiplayerSession||activeMultiplayerWorldId!==worldId||multiplayerFallbackBusy)return;
    multiplayerFallbackBusy=true;
    try{
      const states=await Multiplayer.getWorldPlayerStates(worldId);
      for(const state of states)updateRemotePlayer(state);
      const now=Date.now();
      if(now-multiplayerLastStructurePoll>=1200){
        multiplayerLastStructurePoll=now;
        await refreshMultiplayerStructures(worldId);
      }
      if(now-multiplayerLastChatPoll>=1200){
        multiplayerLastChatPoll=now;
        const messages=await Multiplayer.getChatMessages(worldId);
        for(const row of messages)appendMultiplayerChatMessage(row,true);
      }
    }catch(error){
      console.warn("ILOX multiplayer: falló la sincronización de respaldo",error);
    }finally{
      multiplayerFallbackBusy=false;
    }
  },500);
}
function syncRemotePresence(state){
  const seen=new Set();
  for(const entries of Object.values(state||{})){
    for(const entry of entries||[]){
      const userId=entry.user_id||entry.userId;
      if(!userId||userId===multiplayerUserId)continue;
      seen.add(userId);
      updateRemotePlayer({userId,x:entry.x||0,y:entry.y||0,z:entry.z||0,rotation:entry.rotation||0,avatar:entry.avatar||"boy:0",moving:entry.moving,swimming:entry.swimming,jumping:entry.jumping});
    }
  }
  for(const userId of remotePlayers.keys())if(!seen.has(userId))removeRemotePlayer(userId);
}
// Punto de encuentro compartido: todos los jugadores aparecen cerca del origen del mundo.
const MULTIPLAYER_SPAWN_CENTER = Object.freeze({ x: 0, z: 0 });
// Área de aparición de 20 m² (radio aproximado de 2,52 m).
const MULTIPLAYER_SPAWN_RADIUS = Math.sqrt(20 / Math.PI);
function spawnPlayerAtMultiplayerMeetingPoint(){
  if(!player)return;
  const angle=Math.random()*Math.PI*2;
  const distance=Math.sqrt(Math.random())*MULTIPLAYER_SPAWN_RADIUS;
  const x=MULTIPLAYER_SPAWN_CENTER.x+Math.cos(angle)*distance;
  const z=MULTIPLAYER_SPAWN_CENTER.z+Math.sin(angle)*distance;
  player.position.set(x,terrainHeight(x,z),z);
  player.userData.vy=0;
  player.userData.isSwimming=false;
  playerVerticalVelocity=0;
  playerGrounded=true;
  yaw=Math.atan2(-x,-z);
  player.rotation.y=yaw;
}
async function enterMultiplayerWorld(worldId){
  if(activeMultiplayerWorldId){
    if(multiplayerSyncTimer){clearTimeout(multiplayerSyncTimer);multiplayerSyncTimer=null;}
    await syncMultiplayerStructures();
  }
  if(multiplayerSession){await multiplayerSession.close();multiplayerSession=null;}
  for(const avatar of remotePlayers.values())scene.remove(avatar);
  remotePlayers.clear();clearCurrentBuildWorld();multiplayerCloudSnapshot.clear();
  activeMultiplayerWorldId=worldId;
  localStorage.setItem("ilox-last-multiplayer-world",worldId);
  // Cada integrante que entra aparece junto al punto común del mundo, sin superponerse.
  spawnPlayerAtMultiplayerMeetingPoint();
  try{
    const count=await loadMultiplayerStructures(worldId);
    multiplayerSession=await Multiplayer.subscribeWorld(worldId,{
      onPlayerState:updateRemotePlayer,
      onElevatorState:applyRemoteElevatorState,
      onElevatorDoorState:applyRemoteElevatorDoorState,
      onElevatorBotState:applyRemoteElevatorBotState,
      onPlayerStateChange:payload=>{
        if(payload.eventType==="DELETE")removeRemotePlayer(payload.old?.user_id);
        else updateRemotePlayer(payload.new);
      },
      onWorldRefresh:()=>refreshMultiplayerStructures(worldId).catch(error=>console.warn("ILOX multiplayer: no se pudo refrescar las construcciones",error)),
      onPresence:syncRemotePresence,
      onChatMessage:row=>appendMultiplayerChatMessage(row,true)
    });
    multiplayerUserId=multiplayerSession.userId;
    scheduleMultiplayerSync();
    const peerStates=await Multiplayer.getWorldPlayerStates(worldId);
    for(const state of peerStates)updateRemotePlayer(state);
    document.querySelector("#mp-chat-toggle")?.classList.remove("hidden");
    document.querySelector("#mp-chat-panel")?.classList.add("hidden");
    await loadMultiplayerChat(worldId);
    startMultiplayerFallbackSync(worldId);
    const mpLeave=document.querySelector("#mp-leave-world");
    if(mpLeave)mpLeave.classList.remove("hidden");
    showToast("Mundo compartido conectado. Guardado automático activo.");
    return count;
  }catch(error){
    stopMultiplayerFallbackSync();
    activeMultiplayerWorldId=null;multiplayerUserId=null;
    if(multiplayerSession){try{await multiplayerSession.close();}catch(closeError){console.warn(closeError);}multiplayerSession=null;}
    for(const avatar of remotePlayers.values())scene.remove(avatar);
    remotePlayers.clear();clearCurrentBuildWorld();loadBuilds();
    document.querySelector("#mp-leave-world")?.classList.add("hidden");
    document.querySelector("#mp-chat-panel")?.classList.add("hidden");
    showToast(error.message||"No se pudo entrar al mundo compartido.");
    throw error;
  }
}

async function resumeSavedMultiplayerWorld(){
  const hasSession=await Multiplayer.hasSavedIdentity();
  if(!hasSession){
    openMultiplayerDialog();
    showMultiplayerBranch("load");
    document.querySelector("#multiplayer-status").textContent="Para volver a tu mundo compartido, elegí una partida guardada o ingresá el código de invitación.";
    return false;
  }
  const savedName=localStorage.getItem("ilox-player-name")||"Jugador";
  const user=await Multiplayer.ensureIdentity(savedName,selectedAvatar);
  multiplayerUserId=user.id;
  const worlds=await Multiplayer.listMyWorlds();
  const lastWorldId=localStorage.getItem("ilox-last-multiplayer-world");
  let target=worlds.find(world=>world.id===lastWorldId)||null;
  if(!target&&worlds.length===1)target=worlds[0];
  if(target){
    await enterMultiplayerWorld(target.id);
    return true;
  }
  openMultiplayerDialog();
  showMultiplayerBranch("load");
  document.querySelector("#multiplayer-status").textContent=worlds.length
    ?"Tenés varias partidas guardadas. Elegí el mundo al que querés entrar."
    :"No encontramos partidas guardadas para esta sesión. Si tu mundo sigue activo, ingresá su código de invitación.";
  return false;
}
async function leaveMultiplayerWorld(){
  stopMultiplayerFallbackSync();
  if(activeMultiplayerWorldId){
    if(multiplayerSyncTimer){clearTimeout(multiplayerSyncTimer);multiplayerSyncTimer=null;}
    await syncMultiplayerStructures();
  }
  if(multiplayerSession){try{await multiplayerSession.close();}catch(error){console.warn(error);}multiplayerSession=null;}
  for(const avatar of remotePlayers.values())scene.remove(avatar);
  remotePlayers.clear();activeMultiplayerWorldId=null;multiplayerUserId=null;multiplayerCloudSnapshot.clear();
  clearCurrentBuildWorld();loadBuilds();
  document.querySelector("#mp-leave-world")?.classList.add("hidden");
  document.querySelector("#mp-chat-panel")?.classList.add("hidden");
  document.querySelector("#mp-chat-messages")?.replaceChildren();
  multiplayerChatSeen.clear();multiplayerUnreadMessages=0;updateMultiplayerUnreadBadge();
  showToast("Volviste a tu mundo individual. Tu construcción sigue intacta.");
}

function selectedPermissionStructureIds(){
  const value=document.querySelector("#mp-permission-structure").value;
  if(value.startsWith("group:"))return value.slice(6).split(",").filter(Boolean);
  return value?[value]:[];
}
async function refreshMultiplayerPermissions(){
  const structureSelect=document.querySelector("#mp-permission-structure");
  const playerSelect=document.querySelector("#mp-permission-player");
  const list=document.querySelector("#mp-permission-current");
  const status=document.querySelector("#mp-permissions-status");
  if(!activeMultiplayerWorldId){status.textContent="Primero entrá a un mundo multijugador.";return;}
  const ownStructures=buildRecords.filter(record=>record.cloudId&&(record.cloudOwnerId===multiplayerUserId||foundationAt(record.x,record.z)?.cloudOwnerId===multiplayerUserId));
  structureSelect.innerHTML="";
  const ownedPlateas=ownStructures.filter(record=>record.kind==="platea");
  const visited=new Set(),grouped=new Set();
  for(const foundation of ownedPlateas){
    if(visited.has(foundation.cloudId))continue;
    const cluster=[foundation],queue=[foundation];visited.add(foundation.cloudId);
    while(queue.length){
      const current=queue.shift();
      for(const candidate of ownedPlateas){
        if(!visited.has(candidate.cloudId)&&plateasAreAdjacent(current,candidate)){
          visited.add(candidate.cloudId);cluster.push(candidate);queue.push(candidate);
        }
      }
    }
    const groupRecords=ownStructures.filter(record=>{
      const base=record.kind==="platea"?record:foundationAt(record.x,record.z);
      return base&&cluster.some(item=>item.cloudId===base.cloudId);
    });
    const ids=groupRecords.map(record=>record.cloudId);
    ids.forEach(id=>grouped.add(id));
    if(ids.length){
      const option=document.createElement("option");
      option.value="group:"+ids.join(",");
      option.textContent="CONSTRUCCIÓN COMPLETA · "+ids.length+" piezas";
      structureSelect.appendChild(option);
    }
  }
  ownStructures.filter(record=>!grouped.has(record.cloudId)).forEach(record=>{
    const option=document.createElement("option");
    option.value=record.cloudId;
    option.textContent=String(record.kind).toUpperCase()+" · "+record.x.toFixed(1)+", "+record.z.toFixed(1);
    structureSelect.appendChild(option);
  });
  const members=await Multiplayer.listWorldMembers(activeMultiplayerWorldId);
  playerSelect.innerHTML="";
  members.filter(member=>member.user_id!==multiplayerUserId).forEach(member=>{
    const option=document.createElement("option");
    option.value=member.user_id;
    option.textContent=member.display_name||("Jugador "+member.user_id.slice(0,6));
    playerSelect.appendChild(option);
  });
  if(!ownStructures.length){status.textContent="Todavía no tenés construcciones guardadas en línea para compartir.";list.innerHTML="";return;}
  if(!playerSelect.options.length){status.textContent="Todavía no se unió ningún compañero a este mundo.";list.innerHTML="";return;}
  status.textContent="Podés autorizar una construcción completa (plateas conectadas) o una pieza individual.";
  await renderMultiplayerPermissionRows();
}
async function renderMultiplayerPermissionRows(){
  const ids=selectedPermissionStructureIds();
  const list=document.querySelector("#mp-permission-current");
  list.innerHTML="";
  if(!ids.length)return;
  const permissions=await Multiplayer.getPermissionsForStructures(ids);
  const members=await Multiplayer.listWorldMembers(activeMultiplayerWorldId);
  const grouped=new Map();
  for(const permission of permissions.filter(item=>item.can_edit)){
    grouped.set(permission.user_id,(grouped.get(permission.user_id)||0)+1);
  }
  if(!grouped.size){list.innerHTML='<div class="mp-permission-empty">Nadie más tiene permiso sobre esta construcción.</div>';return;}
  for(const [userId,count] of grouped){
    const member=members.find(item=>item.user_id===userId);
    const row=document.createElement("div");row.className="mp-permission-row";
    const label=document.createElement("span");label.textContent=(member?.display_name||"Compañero")+" · "+count+"/"+ids.length+" piezas autorizadas";
    const button=document.createElement("button");button.type="button";button.textContent="RETIRAR";
    button.addEventListener("click",async()=>{
      try{await Multiplayer.revokeStructurePermissions(ids,userId);await renderMultiplayerPermissionRows();showToast("Permiso retirado de toda la selección.");}
      catch(error){showToast(error.message||"No se pudo retirar el permiso.");}
    });
    row.append(label,button);list.appendChild(row);
  }
}
async function openMultiplayerPermissions(){
  if(!activeMultiplayerWorldId){showToast("Entrá primero a un mundo multijugador.");return;}
  try{
    await syncMultiplayerStructures();
    await refreshMultiplayerPermissions();
    document.querySelector("#mp-permissions-dialog").classList.remove("hidden");
  }catch(error){showToast(error.message||"No se pudieron cargar los permisos.");}
}

async function renderMultiplayerWorldList(){
  const host=document.querySelector("#mp-world-list");
  host.innerHTML='<div class="mp-permission-empty">Buscando partidas guardadas…</div>';
  try{
    const worlds=await Multiplayer.listMyWorlds();
    host.innerHTML="";
    if(!worlds.length){
      const empty=document.createElement("div");empty.className="mp-permission-empty";empty.textContent="Todavía no hay mundos guardados en este teléfono.";
      const create=document.createElement("button");create.type="button";create.className="door-pin-submit";create.textContent="CREAR MUNDO";create.addEventListener("click",()=>showMultiplayerBranch("create"));
      host.append(empty,create);return;
    }
    for(const world of worlds){
      const row=document.createElement("div");row.className="mp-world-row";
      const enter=document.createElement("button");enter.type="button";enter.className="mp-world-enter";
      const info=document.createElement("div");
      const title=document.createElement("strong");title.textContent=world.name;
      const meta=document.createElement("small");meta.textContent=world.role==="owner"?"Tu mundo · propietario":"Mundo compartido";
      info.append(title,meta);
      const action=document.createElement("span");action.textContent=activeMultiplayerWorldId===world.id?"CONECTADO":"ENTRAR →";
      enter.append(info,action);
      enter.addEventListener("click",async()=>{
        try{
          document.querySelector("#multiplayer-status").textContent="Abriendo "+world.name+"…";
          await enterMultiplayerWorld(world.id);
          document.querySelector("#multiplayer-dialog").classList.add("hidden");
        }catch(error){showMultiplayerError(error);}
      });
      row.appendChild(enter);
      if(world.role==="owner"){
        const remove=document.createElement("button");remove.type="button";remove.className="mp-world-delete";remove.textContent="ELIMINAR";
        remove.disabled=activeMultiplayerWorldId===world.id;
        remove.title=remove.disabled?"Salí de este mundo antes de eliminarlo":"Eliminar este mundo y todas sus construcciones";
        remove.addEventListener("click",async()=>{
          if(activeMultiplayerWorldId===world.id){showToast("Primero salí del mundo para poder eliminarlo.");return;}
          const accepted=confirm('¿Eliminar definitivamente el mundo "'+world.name+'" y todas sus construcciones? Esta acción no se puede deshacer.');
          if(!accepted)return;
          remove.disabled=true;
          try{
            await Multiplayer.deleteWorld(world.id);
            showToast('Mundo "'+world.name+'" eliminado.');
            await renderMultiplayerWorldList();
          }catch(error){remove.disabled=false;showToast(error.message||"No se pudo eliminar el mundo.");}
        });
        row.appendChild(remove);
      }
      host.appendChild(row);
    }
  }catch(error){host.innerHTML='<div class="mp-permission-empty">No se pudieron cargar tus partidas. Revisá la conexión.</div>';console.warn(error);}
}
function showMultiplayerBranch(branch){
  const branches=document.querySelector("#mp-branches");
  const load=document.querySelector("#mp-load-panel");
  const create=document.querySelector("#mp-create-panel");
  branches?.classList.toggle("hidden",branch!=="home");
  load?.classList.toggle("hidden",branch!=="load");
  create?.classList.toggle("hidden",branch!=="create");
  if(branch==="home")document.querySelector("#multiplayer-status").textContent=activeMultiplayerWorldId?"Estás conectado a un mundo compartido. Elegí cargar otro mundo o crear uno nuevo.":"Elegí cargar un mundo guardado o crear uno nuevo.";
  if(branch==="load"){
    document.querySelector("#multiplayer-status").textContent="Estos son los mundos guardados a los que tenés acceso.";
    renderMultiplayerWorldList();
  }
  if(branch==="create")document.querySelector("#multiplayer-status").textContent="Poné el nombre que tendrá tu nuevo mundo.";
}
function openMultiplayerDialog(){
  const dialog=document.querySelector("#multiplayer-dialog");
  const nameInput=document.querySelector("#mp-display-name");
  if(nameInput&&!nameInput.value)nameInput.value=localStorage.getItem("ilox-player-name")||"Jugador";
  document.querySelector("#mp-leave-world")?.classList.toggle("hidden",!activeMultiplayerWorldId);
  showMultiplayerBranch("home");
  dialog.classList.remove("hidden");
}
function showMultiplayerError(error){
  const message=String(error?.message||error||"Error desconocido");
  const authHint=/anonymous|anonymous sign|disabled|not enabled/i.test(message)
    ?" El servidor tiene desactivados los inicios anónimos. Hay que habilitarlos en Supabase → Authentication → Sign In / Providers → Anonymous: https://supabase.com/dashboard/project/wihbxfebobfmohmqqhkt/auth/providers"
    :"";
  document.querySelector("#multiplayer-status").textContent=message+authHint;
}

function connectedPlateaFootprint(seed){
  if(!seed||seed.kind!=="platea")return null;
  const component=[],pending=[seed],seen=new Set();
  while(pending.length){
    const current=pending.pop();if(seen.has(current))continue;
    seen.add(current);component.push(current);
    for(const candidate of buildRecords){
      if(candidate.kind!=="platea"||seen.has(candidate)||Math.abs((candidate.y||0)-(seed.y||0))>.24)continue;
      const dx=Math.abs(candidate.x-current.x),dz=Math.abs(candidate.z-current.z);
      if((Math.abs(dx-6)<.22&&dz<.22)||(Math.abs(dz-6)<.22&&dx<.22))pending.push(candidate);
    }
  }
  const minX=Math.min(...component.map(p=>p.x)),maxX=Math.max(...component.map(p=>p.x));
  const minZ=Math.min(...component.map(p=>p.z)),maxZ=Math.max(...component.map(p=>p.z));
  return {x:(minX+maxX)/2,z:(minZ+maxZ)/2,width:maxX-minX+6,depth:maxZ-minZ+6,foundation:seed,component};
}
function roofHasFourWalls(area){
  if(!area)return false;
  const supports=buildRecords.filter(item=>["wall","block","brick","door","window"].includes(item.kind)&&Math.abs(item.x-area.x)<=area.width/2+0.2&&Math.abs(item.z-area.z)<=area.depth/2+0.2);
  const tol=1.1;
  const sides=[
    supports.some(item=>Math.abs(item.x-(area.x-area.width/2))<tol&&Math.abs(item.z-area.z)<=area.depth/2),
    supports.some(item=>Math.abs(item.x-(area.x+area.width/2))<tol&&Math.abs(item.z-area.z)<=area.depth/2),
    supports.some(item=>Math.abs(item.z-(area.z-area.depth/2))<tol&&Math.abs(item.x-area.x)<=area.width/2),
    supports.some(item=>Math.abs(item.z-(area.z+area.depth/2))<tol&&Math.abs(item.x-area.x)<=area.width/2)
  ];
  return sides.every(Boolean);
}
function buildFootprint(kind){
  const sizes={block:[1.5,1.5],brick:[1.5,1.5],floor:[1.5,1.5],roof:[1.5,1.5],elevator:[6,6],wall:[1.5,.16],door:[4.5,1.5],window:[1.5,.16],stairs:[1.5,4.5],chair:[.95,.9],table:[1.4,1.2],bed:[1.5,1.5],sofa:[1.5,.72],lamp:[.56,.56],gate:[1.5,.12],fence:[1.5,.12],pen:[1.5,.12],tree:[1.2,1.2],rock:[1.5,1.5],sheep:[1.2,1.2],cow:[1.5,1.5],horse:[1.8,1.5],chicken:[.8,.8],pig:[1.1,1.1],goat:[1.1,1.1],fox:[1.2,1.2],person:[1,1],robot:[1.2,1.2],trex:[2.4,3]};
  return sizes[kind]||[1.5,1.5];
}
function snapDoorToPlateaGrid(x,z,rotation=0){
  // La puerta se ancla al borde más cercano de la platea bajo el puntero.
  // Su huella ocupa tres módulos de 1,50 m a lo largo del filo y uno hacia dentro.
  const foundation=foundationAt(x,z);
  if(foundation?.kind==="platea"){
    const a=foundation.rotation||0,dx=x-foundation.x,dz=z-foundation.z;
    const localX=dx*Math.cos(a)-dz*Math.sin(a);
    const localZ=dx*Math.sin(a)+dz*Math.cos(a);
    const half=FOUNDATION_SIZE/2,depth=BLOCK_SIZE/2;
    const edgeX=Math.abs(localX)>=Math.abs(localZ);
    let doorX=0,doorZ=0,edgeRotation=0;
    if(edgeX){
      const side=Math.sign(localX)||1;
      doorX=side*(half-depth);
      // El ancho de 4,50 m ocupa tres módulos alineados; queda un módulo libre
      // en uno de los extremos, según el lado hacia el que se arrastra.
      doorZ=(Math.sign(localZ)||1)*depth;
      edgeRotation=a+Math.PI/2;
    }else{
      const side=Math.sign(localZ)||1;
      doorZ=side*(half-depth);
      doorX=(Math.sign(localX)||1)*depth;
      edgeRotation=a;
    }
    const worldX=foundation.x+doorX*Math.cos(a)+doorZ*Math.sin(a);
    const worldZ=foundation.z-doorX*Math.sin(a)+doorZ*Math.cos(a);
    const quarter=Math.round(edgeRotation/(Math.PI/2));
    const snappedRotation=((quarter%4)+4)%4*(Math.PI/2);
    return {x:worldX,z:worldZ,rotation:snappedRotation,snapped:true};
  }
  // Sin una platea debajo, conservar la cuadrícula y el giro de 90° existente.
  const quarter=Math.round(rotation/(Math.PI/2));
  const snappedRotation=((quarter%4)+4)%4*(Math.PI/2);
  const cell=BLOCK_SIZE,offset=cell/2;
  return {x:Math.round((x-offset)/cell)*cell+offset,z:Math.round((z-offset)/cell)*cell+offset,rotation:snappedRotation,snapped:false};
}
function foundationContainsFootprint(x,z,kind,rotation=0){
  const [w,d]=buildFootprint(kind),c=Math.cos(rotation),s=Math.sin(rotation);
  if(kind==="door"){
    const nx=Math.round(w/BLOCK_SIZE),nz=Math.round(d/BLOCK_SIZE);
    for(let ix=0;ix<nx;ix++)for(let iz=0;iz<nz;iz++){
      const dx=-w/2+BLOCK_SIZE/2+ix*BLOCK_SIZE,dz=-d/2+BLOCK_SIZE/2+iz*BLOCK_SIZE;
      const px=x+dx*c-dz*s,pz=z+dx*s+dz*c;
      const f=foundationAt(px,pz);if(!f||f.kind!=="platea")return false;
    }
    return true;
  }
  const f=foundationAt(x,z);if(!f||f.kind!=="platea")return false;
  const connected=connectedPlateaFootprint(f),component=new Set(connected?.component||[f]);
  for(const [dx,dz] of [[-w/2,-d/2],[-w/2,d/2],[w/2,-d/2],[w/2,d/2]]){
    const px=x+dx*c-dz*s,pz=z+dx*s+dz*c;
    const same=foundationAt(px,pz);if(!same||!component.has(same))return false;
  }
  return true;
}

function autoSnapBuildPlacement(x,z,kind,rotation=0){
  const snapKinds=new Set(["block","brick","wall","floor","roof","window","stairs","door"]);
  if(!snapKinds.has(kind)||kind==="roof")return {x,z,rotation,snapped:false};
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
  const placementKind=buildTool==="door-solid"||buildTool==="door-brick"?"door":buildTool==="roof-hole"?"roof":buildTool;
  const snap=placementKind==="door"?snapDoorToPlateaGrid(x,z,buildRotation):autoSnapBuildPlacement(x,z,placementKind,buildRotation);
  x=snap.x;z=snap.z;
  const guideRotation=snap.rotation;
  let roofArea=null;
  if(buildTool==="roof"||buildTool==="roof-hole"){roofArea=connectedPlateaFootprint(foundationAt(x,z));}
  const [w,d]=buildTool==="platea"?[6,6]:poolTool?[buildTool==="pool-municipal"?24:buildTool==="pool-large"?12:6,buildTool==="pool-municipal"?12:buildTool==="pool-large"?12:6]:(buildTool==="roof"||buildTool==="roof-hole")?(roofArea?[roofArea.width,roofArea.depth]:[1.5,1.5]):buildFootprint(placementKind);
  if(snap.snapped&&placementKind!=="door")buildRotation=guideRotation;
  const activeFoundation=foundationAt(x,z);
  const needsDoor=["block","brick","wall"].includes(buildTool);
  const doorReady=foundationHasDoor(activeFoundation);
  const roofAligned=!!roofArea&&Math.abs(x-roofArea.x)<.9&&Math.abs(z-roofArea.z)<.9;
  const roofSupported=roofHasFourWalls(roofArea);
  const roofPreviewTops=roofArea?buildRecords.filter(item=>["wall","block","brick","door","window"].includes(item.kind)&&Math.abs(item.x-roofArea.x)<=roofArea.width/2&&Math.abs(item.z-roofArea.z)<=roofArea.depth/2&&(Math.abs(item.x-(roofArea.x-roofArea.width/2))<1.1||Math.abs(item.x-(roofArea.x+roofArea.width/2))<1.1||Math.abs(item.z-(roofArea.z-roofArea.depth/2))<1.1||Math.abs(item.z-(roofArea.z+roofArea.depth/2))<1.1)).map(item=>(item.y||0)+(item.kind==="door"?3:1.5)):[];
  const roofPreviewY=roofPreviewTops.length?Math.max(...roofPreviewTops):null;
  const valid=isLivingBuildKind(buildTool)||buildTool==="platea"||poolTool||buildTool==="water"||((buildTool==="roof"||buildTool==="roof-hole")?(roofAligned&&roofSupported):(needsDoor&&!doorReady?false:foundationContainsFootprint(x,z,placementKind,buildRotation)));
  if(!buildGuide){
    const material=new THREE.LineBasicMaterial({color:0x22ee66,transparent:true,opacity:.98,depthTest:false});
    const geometry=new THREE.BufferGeometry();
    buildGuide=new THREE.LineSegments(geometry,material);buildGuide.renderOrder=999;buildGuide.frustumCulled=false;scene.add(buildGuide);
  }
  const c=Math.cos(guideRotation),sn=Math.sin(guideRotation),pts=[];
  const addSegment=(ax,az,bx,bz)=>{
    pts.push(new THREE.Vector3(ax*c-az*sn,0.035,ax*sn+az*c));
    pts.push(new THREE.Vector3(bx*c-bz*sn,0.035,bx*sn+bz*c));
  };
  const corners=[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]];
  for(let i=0;i<4;i++)addSegment(...corners[i],...corners[(i+1)%4]);
  if(placementKind==="door"){
    // La vista previa separa visualmente los tres módulos estructurales:
    // columna de marco, abertura central y columna de marco.
    addSegment(-BLOCK_SIZE/2,-d/2,-BLOCK_SIZE/2,d/2);
    addSegment(BLOCK_SIZE/2,-d/2,BLOCK_SIZE/2,d/2);
  }
  buildGuide.geometry.dispose();buildGuide.geometry=new THREE.BufferGeometry().setFromPoints(pts);
  buildGuide.position.set(x,buildTool==="platea"?terrainHeight(x,z)+.05:(roofPreviewY!==null?roofPreviewY:supportHeightAt(x,z))+.035,z);
  buildGuide.material.color.setHex(valid?0x22ee66:0xff3333);
  buildGuide.visible=true;
}

async function placeBuildAtPointer(event){
  const rect=renderer.domElement.getBoundingClientRect(),pointer=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-((event.clientY-rect.top)/rect.height)*2+1),raycaster=new THREE.Raycaster();raycaster.setFromCamera(pointer,camera);
  if(buildTool==="erase"){
    const hits=raycaster.intersectObjects(buildGroups,true);
    if(!hits.length){showToast("Tocá una construcción para borrar una sola pieza.");return;}
    let root=hits[0].object;while(root.parent&&root.parent!==scene)root=root.parent;
    const rec=root.userData.buildRecord,idx=buildRecords.indexOf(rec);
    if(idx<0){showToast("No se pudo identificar esa pieza.");return;}
    if(activeMultiplayerWorldId&&multiplayerSyncing){showToast("Esperá a que termine el guardado compartido y volvé a borrar.");return;}
    if(activeMultiplayerWorldId&&rec.cloudId){
      if(multiplayerSyncTimer){clearTimeout(multiplayerSyncTimer);multiplayerSyncTimer=null;}
      try{
        await Multiplayer.deleteStructure(activeMultiplayerWorldId,rec.cloudId);
        multiplayerCloudSnapshot.delete(rec.cloudId);
        buildRecords.splice(idx,1);scene.remove(root);
        const gi=buildGroups.indexOf(root);if(gi>=0)buildGroups.splice(gi,1);
        if(rec.kind==="elevator")rebuildElevatorOpenings();
        refreshTerrainSurface();flushLocalBuildSave();
        if(multiplayerSession)multiplayerSession.sendWorldRefresh().catch(error=>console.warn("ILOX multiplayer: no se pudo avisar la eliminación en tiempo real",error));
        scheduleMultiplayerSync();
        showToast("Pieza eliminada del mundo compartido.");
      }catch(error){showToast(error.message||"No se pudo eliminar esta pieza del mundo compartido.");}
      return;
    }
    buildRecords.splice(idx,1);scene.remove(root);
    const gi=buildGroups.indexOf(root);if(gi>=0)buildGroups.splice(gi,1);
    if(rec.kind==="elevator")rebuildElevatorOpenings();
    refreshTerrainSurface();persistBuilds();
    showToast(activeMultiplayerWorldId?"Pieza local eliminada; se sincronizará el cambio.":"Pieza eliminada.");
    return;
  }
  if(!terrainMesh)return;const terrainHit=raycaster.intersectObject(terrainMesh,false)[0],pieceHits=raycaster.intersectObjects(buildGroups,true),hit=pieceHits[0];
  if(!terrainHit&&!hit){showToast("Tocá el terreno para colocar.");return;}
  const onPiece=!!hit&&(!terrainHit||hit.distance<terrainHit.distance);let point=onPiece?hit.point:terrainHit.point;
  if(buildTool==="elevator"){
    const x=Math.round(point.x/3)*3,z=Math.round(point.z/3)*3;
    const foundation=foundationAt(x,z);
    if(!foundation||foundation.kind!=="platea"||!foundationContainsFootprint(x,z,"elevator",buildRotation)){
      showToast("El ascensor necesita una platea libre de al menos 3,2 × 3,2 metros.");return;
    }
    if(buildRecords.some(r=>r.kind==="elevator"&&Math.hypot(r.x-x,r.z-z)<3.1)){
      showToast("Ya hay un ascensor en ese hueco.");return;
    }
    const record={kind:"elevator",x,z,y:supportHeightAt(x,z),rotation:buildRotation,floorCount:40,currentFloor:1,targetFloor:1};
    buildRecords.push(record);createBuildPiece(record);persistBuilds();
    showToast("Ascensor instalado: 40 plantas disponibles.");return;
  }
  if(buildTool==="door"||buildTool==="door-solid"||buildTool==="door-brick"){
    const snap=snapDoorToPlateaGrid(point.x,point.z,buildRotation);
    const x=snap.x,z=snap.z,rotation=snap.rotation;
    if(!foundationContainsFootprint(x,z,"door",rotation)){showToast("La puerta debe ocupar espacios completos de 1,50 m dentro de las plateas. Movela a otro espacio de la cuadrícula.");return;}
    if(buildRecords.some(item=>item.kind==="door"&&Math.hypot(item.x-x,item.z-z)<.2&&Math.abs((item.y||0)-supportHeightAt(x,z))<.2)){showToast("Ya hay una puerta en ese lugar.");return;}
    const baseY=supportHeightAt(x,z);
    const record={kind:"door",x,z,y:baseY,rotation,color:selectedBlockColor,doorStyle:buildTool==="door-brick"?"brick":"solid",doorWidth:1.5,open:false,pin:null};
    buildRecords.push(record);createBuildPiece(record);persistBuilds();openDoorPinDialog(record,"setup");showToast("Puerta colocada. Configurá su PIN para protegerla.");return;
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
  if(buildTool==="water"){containingPool=findRequiredParent("water",x,z);if(!containingPool){showToast("Primero colocá una PILETA. El agua necesita una estructura que la contenga.");return;}if(buildRecords.some(item=>item.kind==="water"&&item.poolX===containingPool.x&&item.poolZ===containingPool.z)){showToast("Esta pileta ya está llena.");return;}x=containingPool.x;z=containingPool.z;}
  if(isPoolTool&&buildRecords.some(item=>item.kind==="pool"&&Math.abs(item.x-x)<poolWidth/2+(item.poolWidth||6)/2&&Math.abs(item.z-z)<poolDepth/2+(item.poolDepth||6)/2)){showToast("Ese espacio ya tiene una pileta.");return;}
  if(!isLivingBuildKind(buildTool)&&buildTool!=="platea"&&!isPoolTool&&buildTool!=="water"){
    const currentFoundation=foundationAt(x,z);
    if(["block","brick","wall"].includes(buildTool)&&!foundationHasDoor(currentFoundation)){showToast("Primero colocá la puerta completa de esta construcción.");return;}
    if(!currentFoundation){showToast("Primero colocá una PLATEA. El terreno se nivela dentro de ella.");return;}
    if(buildTool==="roof"||buildTool==="roof-hole"){
      const area=connectedPlateaFootprint(currentFoundation);
      if(!area){showToast("No se encontró una superficie de plateas conectadas.");return;}
      if(!roofHasFourWalls(area)){showToast("El techo necesita paredes de apoyo en los cuatro lados.");return;}
      x=area.x;z=area.z;
    }else if(!foundationContainsFootprint(x,z,buildTool,buildRotation)){showToast("La pieza debe quedar completamente dentro de la platea.");return;}
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
  const poolDesign=buildTool==="pool-municipal"?"municipal":buildTool==="pool-large"?"large":"small";
  const roofArea=(buildTool==="roof"||buildTool==="roof-hole")?connectedPlateaFootprint(foundationAt(x,z)):null;
  if(roofArea){
    x=roofArea.x;z=roofArea.z;
    const wallTops=buildRecords.filter(item=>["wall","block","brick","door","window"].includes(item.kind)&&Math.abs(item.x-roofArea.x)<=roofArea.width/2&&Math.abs(item.z-roofArea.z)<=roofArea.depth/2&&(Math.abs(Math.abs(item.x-roofArea.x)-roofArea.width/2)<1.1||Math.abs(Math.abs(item.z-roofArea.z)-roofArea.depth/2)<1.1)).map(item=>(item.y||0)+(item.kind==="door"?3:1.5));
    if(wallTops.length)baseY=Math.max(baseY,...wallTops);
  }
  const record={kind:isPoolTool?"pool":(buildTool==="roof-hole"?"roof":buildTool),x,z,y:baseY+((isLivingBuildKind(buildTool)||buildTool==="water"||buildTool==="platea"||buildTool==="floor"||isPoolTool)?0:(roofArea?0:2.4)),rotation:buildRotation,color:selectedBlockColor};
  if(roofArea){record.roofWidth=roofArea.width;record.roofDepth=roofArea.depth;record.roofRevision="connected-plateas-v2";record.roofOpening=buildTool==="roof-hole";}
  if(isPoolTool){record.poolDesign=poolDesign;record.poolWidth=poolWidth;record.poolDepth=poolDepth;}if(buildTool==="water"){record.poolWidth=containingPool.poolWidth||6;record.poolDepth=containingPool.poolDepth||6;record.poolX=containingPool.x;record.poolZ=containingPool.z;}
  buildRecords.push(record);
  const isAnimal=["sheep","cow","horse","chicken","pig","goat","fox","person","robot","trex"].includes(buildTool);
  createBuildPiece(record,{notify:isAnimal});persistBuilds();
  if(isAnimal)showToast("Descargando modelo 3D del animal...");
  else showToast(buildTool==="water"?"Pileta llena: ¡a nadar!":isPoolTool?"Pileta instalada con dos metros de profundidad.":"¡Pieza colocada y alineada!");
}
function openDoorPinDialog(record,mode="unlock"){
  if(!doorPinDialog||!record)return;
  doorPinTarget=record;doorPinMode=mode;doorPinInput.autocomplete=mode==="setup"?"new-password":"current-password";doorPinDialog.classList.remove("hidden");
  doorPinCurrent.value="";doorPinNew.value="";doorPinInput.value="";
  doorPinCurrent.classList.toggle("hidden",mode!=="change");doorPinNew.classList.toggle("hidden",mode!=="change");
  doorPinInput.classList.toggle("hidden",mode==="change");
  doorPinChangeButton?.classList.add("hidden");
  if(mode==="setup"){doorPinTitle.textContent="PROTEGER PUERTA";doorPinHelp.textContent="Creá una contraseña numérica de 4 a 8 números. Solo se configura una vez.";}
  else{doorPinTitle.textContent="PUERTA PROTEGIDA";doorPinHelp.textContent="Ingresá el PIN para abrir esta puerta.";}
  window.setTimeout(()=>doorPinInput.focus(),80);
}
function closeDoorPinDialog(){doorPinDialog?.classList.add("hidden");doorPinTarget=null;doorPinMode="setup";}
function openDoorLeaf(group){
  const pivot=group?.userData.doorLeafPivot;if(!pivot)return;
  pivot.rotation.y=Math.PI/2;
  group.userData.doorIsOpen=true;
  if(group.userData.buildRecord)group.userData.buildRecord.open=true;
  group.userData.doorAutoCloseAt=Date.now()+3000;
  group.userData.doorPreviousLocalZ=null;
  if(activeMultiplayerWorldId)persistBuilds();
}
doorPinForm?.addEventListener("submit",async event=>{
  event.preventDefault();const record=doorPinTarget;if(!record)return;
  const pin=doorPinInput.value.trim();
  if(!/^\d{4,8}$/.test(pin)){doorPinHelp.textContent="El PIN debe tener entre 4 y 8 números.";return;}
  const group=buildGroups.find(item=>item.userData.buildRecord===record);
  if(!group?.userData.doorLeafPivot){closeDoorPinDialog();return;}
  const isMultiplayer=!!activeMultiplayerWorldId;
  const isOwner=!isMultiplayer||record.cloudOwnerId===multiplayerUserId;
  try{
    if(doorPinMode==="setup"){
      if(isMultiplayer){
        if(!record.cloudId)throw new Error("La puerta todavía se está guardando. Esperá un instante y volvé a tocarla.");
        await Multiplayer.setDoorPin(record.cloudId,pin);
      }else{
        record.pin=pin;
        persistBuilds();
      }
      record.pinConfigured=true;
      if(isMultiplayer)persistBuilds();
      closeDoorPinDialog();showToast("PIN configurado una sola vez. Puerta protegida.");return;
    }
    if(isOwner){
      openDoorLeaf(group);closeDoorPinDialog();return;
    }
    let valid=false;
    if(isMultiplayer){
      if(!record.cloudId)throw new Error("No se pudo identificar la puerta.");
      valid=await Multiplayer.verifyDoorPin(record.cloudId,pin);
    }else valid=pin===String(record.pin||"");
    if(!valid){doorPinHelp.textContent="PIN incorrecto. La puerta sigue cerrada.";return;}
    openDoorLeaf(group);closeDoorPinDialog();showToast("PIN correcto. Puerta abierta.");
  }catch(error){doorPinHelp.textContent=error.message||"No se pudo verificar el PIN.";}
});
document.querySelector("#door-pin-cancel")?.addEventListener("click",closeDoorPinDialog);
function toggleDoorAtPointer(event){
  if(!renderer||!camera||doorPinTarget)return;
  const rect=renderer.domElement.getBoundingClientRect(),pointer=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-((event.clientY-rect.top)/rect.height)*2+1),raycaster=new THREE.Raycaster();
  raycaster.setFromCamera(pointer,camera);const doors=buildGroups.filter(g=>g.userData.buildRecord?.kind==="door");
  const hit=raycaster.intersectObjects(doors,true)[0];if(!hit)return;
  let root=hit.object;while(root.parent&&root.parent!==scene)root=root.parent;
  const record=root.userData.buildRecord;if(!root.userData.doorLeafPivot||!record)return;
  const isOwner=!activeMultiplayerWorldId||record.cloudOwnerId===multiplayerUserId;
  if(isOwner){
    if(activeMultiplayerWorldId&&!record.cloudId){showToast("La puerta se está guardando. Probá de nuevo en un instante.");return;}
    if(activeMultiplayerWorldId&&!record.pinConfigured){
      // El servidor no entrega el PIN; el propietario puede establecerlo solo una vez.
      openDoorPinDialog(record,"setup");return;
    }
    if(!activeMultiplayerWorldId&&!record.pin){openDoorPinDialog(record,"setup");return;}
    openDoorLeaf(root);return;
  }
  openDoorPinDialog(record,"unlock");
}

function triggerJump(){if(!started||!player||cameraLocked)return;
  if(player.userData.isSwimming){player.userData.poolExitJumpUntil=Date.now()+950;player.userData.isSwimming=false;playerVerticalVelocity=8.4;playerGrounded=false;return;}
  if(!playerGrounded)return;playerVerticalVelocity=8.4;playerGrounded=false;
}
function updateCameraFreeStick(event){
  if(!cameraFreePad||!cameraFreeKnob)return;
  const rect=cameraFreePad.getBoundingClientRect(),radius=Math.min(rect.width,rect.height)*.36;
  let x=(event.clientX-(rect.left+rect.width/2))/radius;
  let y=(event.clientY-(rect.top+rect.height/2))/radius;
  const magnitude=Math.hypot(x,y);if(magnitude>1){x/=magnitude;y/=magnitude;}
  cameraFreeStick.x=x;cameraFreeStick.y=y;
  cameraFreeKnob.style.transform=`translate(calc(-50% + ${x*radius}px), calc(-50% + ${y*radius}px))`;
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

function updateBuildGravity(delta){
  for(const group of buildGroups){
    const record=group.userData.buildRecord;if(!record||record.kind==="water")continue;
    if(record.kind==="platea"||record.kind==="pool"||record.kind==="elevator")continue;
    if(record.kind==="roof"&&roofHasFourWalls(connectedPlateaFootprint(foundationAt(record.x,record.z))))continue;
    let supportY=supportHeightAt(group.position.x,group.position.z,group.position.y,group);
    for(const other of buildGroups){if(other===group)continue;if(Math.abs(other.position.x-group.position.x)>.2||Math.abs(other.position.z-group.position.z)>.2)continue;const top=other.position.y+(other.userData.buildHeight||1.5);if(top<=group.position.y+.12&&top>supportY)supportY=top;}
    if(group.position.y>supportY+.015){group.userData.vy=(group.userData.vy||0)-18*delta;group.position.y+=group.userData.vy*delta;if(group.position.y<=supportY){group.position.y=supportY;group.userData.vy=0;record.y=supportY;persistBuilds();}}
    else if(group.position.y<supportY-.015){group.position.y=supportY;group.userData.vy=0;record.y=supportY;}
  }
}
function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  let localMoving = false;
  if (started && player) {
    // Entrada nueva: el joystick da un vector 360°. La cámara define el frente;
    // por eso, al mantener el joystick arriba y arrastrar la vista a la derecha,
    // el personaje sigue avanzando y curva su trayectoria con la cámara.
    let forward = (cameraLocked||cameraFreeMode) ? 0 : (-moveStick.y + (keys.has("w") ? 1 : 0) - (keys.has("s") ? 1 : 0)
      + (keys.has("arrowup") ? 1 : 0) - (keys.has("arrowdown") ? 1 : 0));
    let strafe = (cameraLocked||cameraFreeMode) ? 0 : (moveStick.x + (keys.has("d") ? 1 : 0) - (keys.has("a") ? 1 : 0)
      + (keys.has("arrowright") ? 1 : 0) - (keys.has("arrowleft") ? 1 : 0));
    const inputLength = Math.hypot(forward, strafe);
    localMoving = inputLength > 0.08;
    if (inputLength > 1) { forward /= inputLength; strafe /= inputLength; }
    const swimming = !!player?.userData.isSwimming;
    const speed = swimming ? 2.2 : (sprintHeld || keys.has("shift") ? 10.8 : 7.2);
    const cameraYaw = yaw;
    const dx = (-Math.sin(cameraYaw) * forward + Math.cos(cameraYaw) * strafe) * speed * delta;
    const dz = (-Math.cos(cameraYaw) * forward - Math.sin(cameraYaw) * strafe) * speed * delta;
    const nextX = THREE.MathUtils.clamp(player.position.x + dx, -worldSize / 2 + 4, worldSize / 2 - 4);
    const nextZ = THREE.MathUtils.clamp(player.position.z + dz, -worldSize / 2 + 4, worldSize / 2 - 4);
    const collides = (x,z,feetOverride=player.position.y) => {
      const feet = feetOverride;
      const body = new THREE.Box3(
        new THREE.Vector3(x-0.28, feet+0.08, z-0.28),
        new THREE.Vector3(x+0.28, feet+PLAYER_HEIGHT, z+0.28)
      );
      const solidKinds = new Set(["block","brick","platea","pool","floor","wall","door","window","roof","elevator","tree","rock","chair","table","bed","sofa","lamp","gate","fence","pen","sheep","cow","horse","chicken","pig","goat","fox","person","robot","trex"]); // Las escaleras se resuelven como superficie transitable, no como una caja que bloquea.
      const playerSwimming=!!player.userData.isSwimming;
      const filledPoolAtCandidate=buildRecords.some(p=>p.kind==="pool"&&buildRecords.some(w=>w.kind==="water"&&w.poolX===p.x&&w.poolZ===p.z)&&Math.abs(x-p.x)<(p.poolWidth||6)/2-.48&&Math.abs(z-p.z)<(p.poolDepth||6)/2-.48);
      for (const g of buildGroups) {
        const kind=g.userData.buildRecord?.kind;
        if (!solidKinds.has(kind) || !g.visible) continue;
        // Dentro del agua, las paredes dejan de bloquear al nadador; al entrar
        // se permite cruzar el borde desde un salto, y al nadar se puede salir.
        if(kind==="pool"&&player.position.y>=(g.userData.buildRecord.y||0)+.22)continue;
        g.updateMatrixWorld(true);
        let blocked=false;g.traverse(mesh=>{if(blocked||!mesh.isMesh||!mesh.visible||mesh.userData.water||mesh.userData.elevatorFloor)return;const geometry=mesh.geometry;if(!geometry.boundingBox)geometry.computeBoundingBox();const bounds=geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);if(bounds.max.y<=feet+.08||bounds.min.y>=feet+PLAYER_HEIGHT)return;if(body.intersectsBox(bounds))blocked=true;});if(blocked)return true;
      }
      if(isIloxNightclubWall(x,z,feet))return true;
      return false;
    };
    const tryStepMove=(x,z,axis)=>{
      if(!collides(x,z)){if(axis==="x")player.position.x=x;else player.position.z=z;return;}
      const currentY=player.position.y,stepLimit=.42;
      const candidateFloor=supportHeightAt(x,z,currentY+stepLimit+.02);
      const rise=candidateFloor-currentY;
      if(rise>.035&&rise<=stepLimit&&!collides(x,z,candidateFloor+.015)){
        player.position.y=candidateFloor;playerVerticalVelocity=0;playerGrounded=true;
        if(axis==="x")player.position.x=x;else player.position.z=z;
      }
    };
    tryStepMove(nextX,player.position.z,"x");
    tryStepMove(player.position.x,nextZ,"z");
    const pool=buildRecords.find(p=>p.kind==="pool"&&buildRecords.some(w=>w.kind==="water"&&w.poolX===p.x&&w.poolZ===p.z)&&Math.abs(player.position.x-p.x)<(p.poolWidth||6)/2-.48&&Math.abs(player.position.z-p.z)<(p.poolDepth||6)/2-.48);
    const surface=pool?pool.y:-Infinity,inWater=!!pool&&Date.now()>(player.userData.poolExitJumpUntil||0)&&player.position.y<surface+.35&&player.position.y>pool.y-2.25;
    if(inWater){playerVerticalVelocity=0;const target=surface-.95+Math.sin(clock.elapsedTime*2.4)*.045;player.position.y+=(target-player.position.y)*Math.min(1,delta*3.5);playerGrounded=false;player.userData.isSwimming=true;}
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
      rig.position.y = swimmingNow ? Math.sin(clock.elapsedTime*2.4)*.035 : moving ? Math.abs(stride)*.055 : player.userData.toonType ? Math.sin(clock.elapsedTime*2.0)*.022 : 0;
      rig.rotation.z = swimmingNow ? Math.sin(player.userData.walkPhase)*.025 : moving ? Math.sin(player.userData.walkPhase)*.035 : 0;
      rig.rotation.x = swimmingNow ? -.12 : moving ? -.035 : 0;
    }
    player.userData.legs?.forEach((leg,i) => { leg.rotation.x = i===0 ? swing : -swing; });
    player.userData.arms?.forEach((arm,i) => { arm.rotation.x = swimmingNow ? Math.sin(player.userData.walkPhase*1.8+i*Math.PI)*.72 : i===0 ? -swing*0.82 : swing*0.82; arm.rotation.z = i===0 ? -0.035 : 0.035; });
    if(player.userData.toonTail){player.userData.toonTail.rotation.y=Math.sin(clock.elapsedTime*2.2)*.42;player.userData.toonTail.rotation.x=Math.sin(clock.elapsedTime*1.7)*.16;}
    updateIloxNightclub(delta);
    if(player.userData.iloxDancing)updateIloxElevatorParty(delta);
    // La cámara nunca modifica la orientación del personaje.
    player.rotation.y = playerHeading+(player.userData.iloxDancing?Math.sin((clock.elapsedTime-(player.userData.iloxDanceStarted||0))*Math.PI*1.92)*.30:0);
  }
  for(const [remoteId,avatar] of remotePlayers){
    const target=avatar.userData.netTarget;
    if(target)avatar.position.lerp(target,1-Math.exp(-delta*13));
    const targetRotation=avatar.userData.netRotation||0;
    const angle=Math.atan2(Math.sin(targetRotation-avatar.rotation.y),Math.cos(targetRotation-avatar.rotation.y));
    avatar.rotation.y+=angle*(1-Math.exp(-delta*14));
    const moving=!!avatar.userData.remoteMoving,swimming=!!avatar.userData.remoteSwimming;
    if(avatar.userData.toonTail){avatar.userData.toonTail.rotation.y=Math.sin(clock.elapsedTime*2.2+avatar.position.x)*.42;avatar.userData.toonTail.rotation.x=Math.sin(clock.elapsedTime*1.7+avatar.position.z)*.16;}
    if(avatar.userData.riggedMixer){
      avatar.userData.riggedMixer.update(delta);
      const hasWalkClip=!!(avatar.userData.actions?.walk||avatar.userData.actions?.run);
      if(hasWalkClip) setRiggedAvatarMotion(avatar,moving);
      else {
        const importedModel=avatar.children[0];
        if(importedModel){
          const phase=(avatar.userData.remoteWalkPhase||0)+(moving?delta*10.5:0);
          avatar.userData.remoteWalkPhase=phase;
          importedModel.position.y=(importedModel.userData.remoteBaseY||0)+(moving?Math.abs(Math.sin(phase*2))*.045:0);
          importedModel.rotation.z=moving?Math.sin(phase)*.025:0;
        }
      }
      continue;
    }
    avatar.userData.remoteWalkPhase=(avatar.userData.remoteWalkPhase||0)+(moving?delta*10.5:0);
    const phase=avatar.userData.remoteWalkPhase;
    const swing=swimming?Math.sin(phase*1.7)*.24:moving?Math.sin(phase)*.48:0;
    const stride=swimming?Math.cos(phase*1.4)*.35:moving?Math.cos(phase*2):0;
    const rig=avatar.userData.rig;
    if(rig){rig.position.y=swimming?Math.sin(clock.elapsedTime*2.4)*.035:moving?Math.abs(stride)*.055:avatar.userData.toonType?Math.sin(clock.elapsedTime*2.0+avatar.position.x)*.022:0;rig.rotation.z=swimming?Math.sin(phase)*.025:moving?Math.sin(phase)*.035:0;rig.rotation.x=swimming?-.12:moving?-.035:0;}
    avatar.userData.legs?.forEach((leg,i)=>{leg.rotation.x=i===0?swing:-swing;});
    avatar.userData.arms?.forEach((arm,i)=>{arm.rotation.x=swimming?Math.sin(phase*1.8+i*Math.PI)*.72:i===0?-swing*.82:swing*.82;arm.rotation.z=i===0?-.035:.035;});
  }
  if(player){
    const now=Date.now();
    for(const group of buildGroups){
      if(group.userData.buildRecord?.kind!=="door")continue;
      if(group.userData.doorIsOpen){
        const dx=player.position.x-group.position.x,dz=player.position.z-group.position.z,a=group.rotation.y;
        const localX=dx*Math.cos(a)-dz*Math.sin(a),localZ=dx*Math.sin(a)+dz*Math.cos(a);
        const previous=group.userData.doorPreviousLocalZ;
        if(Math.abs(localX)<.82&&previous!==null&&previous!==undefined&&previous*localZ<0&&Math.abs(previous)<1.25&&Math.abs(localZ)<1.25){
          group.userData.doorAutoCloseAt=now+3000;
        }
        group.userData.doorPreviousLocalZ=localZ;
        if(now>=group.userData.doorAutoCloseAt){
          group.userData.doorLeafPivot.rotation.y=0;
          group.userData.doorIsOpen=false;
          if(group.userData.buildRecord?.open){
            group.userData.buildRecord.open=false;
            if(activeMultiplayerWorldId)persistBuilds();
          }
          group.userData.doorAutoCloseAt=0;
          group.userData.doorPreviousLocalZ=null;
        }
      }
    }
  }
  if(started&&player){ensureElevatorBot();updateElevators(delta);updateElevatorBot(delta);}
  const focus = player || {position:new THREE.Vector3(0,terrainHeight(0,0),0)};
  const firstPerson = player && cameraMode === "first";
  if(cameraFreeMode && cameraFreePosition){
    const keyboardForward=(keys.has("w")?1:0)-(keys.has("s")?1:0);
    const keyboardStrafe=(keys.has("d")?1:0)-(keys.has("a")?1:0);
    const forward=cameraFreeStick.y*-1+keyboardForward;
    const strafe=cameraFreeStick.x+keyboardStrafe;
    const length=Math.hypot(forward,strafe)||1;
    const speed=keys.has("shift")?22:12;
    const fx=-Math.sin(cameraFreeYaw),fz=-Math.cos(cameraFreeYaw);
    const rx=Math.cos(cameraFreeYaw),rz=-Math.sin(cameraFreeYaw);
    cameraFreePosition.x+=(fx*forward+rx*strafe)/Math.max(1,length)*speed*delta;
    cameraFreePosition.z+=(fz*forward+rz*strafe)/Math.max(1,length)*speed*delta;
    const vertical=cameraFreeVertical+(keys.has("e")?1:0)-(keys.has("q")?1:0);
    cameraFreePosition.y+=vertical*speed*delta;
    cameraFreePosition.x=THREE.MathUtils.clamp(cameraFreePosition.x,-worldSize/2,worldSize/2);
    cameraFreePosition.z=THREE.MathUtils.clamp(cameraFreePosition.z,-worldSize/2,worldSize/2);
    cameraFreePosition.y=THREE.MathUtils.clamp(cameraFreePosition.y,0,180);
  }
  updateBuildGravity(delta);
  for(const group of buildGroups){
    if(!group.userData.animalMixer)continue;
    group.userData.animalMixer.update(delta);
    const actions=group.userData.animalActions;
    if(updateIloxLivingDance(group,delta))continue;
    const canWalk=!!(actions.walk||actions.run);
    if(canWalk){
      group.userData.roamTimer-=delta;
      if(group.userData.roamTimer<=0){const origin=group.userData.roamOrigin;group.userData.roamTarget.set(origin.x+(Math.random()-.5)*7,0,origin.z+(Math.random()-.5)*7);group.userData.roamTimer=5+Math.random()*6;}
      const target=group.userData.roamTarget,dx=target.x-group.position.x,dz=target.z-group.position.z,dist=Math.hypot(dx,dz),moving=dist>.22;
      if(moving){
        const speed=group.userData.buildRecord?.kind==="horse"?.72:group.userData.buildRecord?.kind==="trex"?.55:.42,nx=group.position.x+dx/dist*speed*delta,nz=group.position.z+dz/dist*speed*delta;
        const body=new THREE.Box3(new THREE.Vector3(nx-.42,group.position.y+.04,nz-.42),new THREE.Vector3(nx+.42,group.position.y+Math.max(.55,group.userData.buildHeight||1),nz+.42));let blocked=false;
        for(const obstacle of buildGroups){if(blocked||obstacle===group||!obstacle.visible)continue;const obstacleKind=obstacle.userData.buildRecord?.kind;if(!["block","brick","wall","door","window","roof","platea","floor","gate","fence","pen","tree","rock","elevator","sheep","cow","horse","chicken","pig","goat","fox","person","robot","trex"].includes(obstacleKind))continue;obstacle.updateMatrixWorld(true);obstacle.traverse(mesh=>{if(blocked||!mesh.isMesh||!mesh.visible||mesh.userData.water||mesh.userData.elevatorFloor)return;const geo=mesh.geometry;if(!geo.boundingBox)geo.computeBoundingBox();const bounds=geo.boundingBox.clone().applyMatrix4(mesh.matrixWorld);if(bounds.max.y>body.min.y+.05&&bounds.min.y<body.max.y-.05&&body.intersectsBox(bounds))blocked=true;});}
        if(!blocked){group.position.x=nx;group.position.z=nz;group.rotation.y=Math.atan2(dx,dz);group.userData.buildRecord.x=nx;group.userData.buildRecord.z=nz;animalPositionsDirty=true;}else{group.userData.roamTarget.copy(group.position);group.userData.roamTimer=1;}
      }
      const next=moving?(actions.walk||actions.run||actions.idle):(actions.idle||actions.walk);if(next&&next!==actions.current){next.reset().fadeIn(.35).play();if(actions.current)actions.current.fadeOut(.35);actions.current=next;}
    }
  }
  if(animalPositionsDirty&&Date.now()-lastAnimalPositionSave>5000){lastAnimalPositionSave=Date.now();animalPositionsDirty=false;persistBuilds();}
  if (player) player.visible = !firstPerson;
  if (viewHands) viewHands.visible = !!firstPerson && buildMode && buildTool !== "erase";
  const distance = cameraDistance;
  // La cámara libre tiene posición y orientación propias; nunca sigue al jugador.
  const cameraYaw = yaw;
  const targetX = focus.position.x + Math.sin(cameraYaw) * distance;
  const targetZ = focus.position.z + Math.cos(cameraYaw) * distance;
  if(cameraFreeMode && cameraFreePosition){
    camera.position.copy(cameraFreePosition);
    const lookDistance=30;
    camera.lookAt(
      cameraFreePosition.x-Math.sin(cameraFreeYaw)*Math.cos(cameraFreePitch)*lookDistance,
      cameraFreePosition.y+Math.sin(cameraFreePitch)*lookDistance,
      cameraFreePosition.z-Math.cos(cameraFreeYaw)*Math.cos(cameraFreePitch)*lookDistance
    );
  } else if (firstPerson) {
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
  if(multiplayerSession&&player){
    const now=performance.now();
    if(now-multiplayerLastDbState>100){
      multiplayerLastDbState=now;
      const state={userId:multiplayerUserId,x:player.position.x,y:player.position.y,z:player.position.z,rotation:player.rotation.y,avatar:selectedAvatar,moving:localMoving,swimming:!!player.userData.isSwimming,jumping:!playerGrounded};
      multiplayerSession.sendPlayerState(state).catch(error=>console.warn("ILOX multiplayer: sincronización de jugador falló",error));
      if(now-multiplayerLastPresence>1000){multiplayerLastPresence=now;multiplayerSession.updatePresence(state).catch(error=>console.warn(error));}
    }
  }
  renderer.render(scene, camera);
}

try {
  init();
} catch (error) {
  console.error(error);
  if (window.__iloxReportStartupError) window.__iloxReportStartupError("INIT", error?.stack || error?.message || error);
  else loading.innerHTML = '<div class="loading-mark">ILOX</div><p>No se pudo iniciar el mundo 3D. Revisá la conexión y volvé a intentar.</p>';
}
