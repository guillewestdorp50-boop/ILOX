import { createServer } from 'node:http';
import { acceptWebSocket } from './ws-peer.mjs';

const PORT = Number(process.env.PORT || 10000);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const AUTH_TIMEOUT_MS = 8000;
const HEARTBEAT_MS = 25000;
const rooms = new Map();
const peers = new Set();

if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY.');

const httpServer = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    const body = JSON.stringify({ ok: true, service: 'ilox-world-authority', protocol: 1, rooms: rooms.size, sockets: peers.size });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(body);
    return;
  }
  res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: 'not_found' }));
});

function send(ws, type, payload = {}) {
  if (ws.readyState === 1) ws.send(JSON.stringify({ type, ...payload }));
}
function broadcast(room, type, payload = {}) {
  for (const peer of room.clients) send(peer, type, payload);
}
function safeInteger(value, min, max) { return Number.isInteger(value) && value >= min && value <= max; }

async function supabaseGet(path, token) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` }
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(response.status === 401 ? 'unauthorized' : 'supabase_request_failed');
  return data;
}

async function authenticate(accessToken, worldId) {
  if (typeof accessToken !== 'string' || accessToken.length < 20 || accessToken.length > 8192) throw new Error('invalid_token');
  if (typeof worldId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(worldId)) throw new Error('invalid_world');
  const user = await supabaseGet('/auth/v1/user', accessToken);
  if (!user?.id) throw new Error('unauthorized');
  const membershipPath = `/rest/v1/multiplayer_world_members?select=world_id,role&world_id=eq.${encodeURIComponent(worldId)}&user_id=eq.${encodeURIComponent(user.id)}&limit=1`;
  const membership = await supabaseGet(membershipPath, accessToken);
  if (!Array.isArray(membership) || !membership.length) throw new Error('world_access_denied');
  const elevatorsPath = `/rest/v1/multiplayer_structures?select=id,kind,payload&world_id=eq.${encodeURIComponent(worldId)}&kind=eq.elevator`;
  const elevators = await supabaseGet(elevatorsPath, accessToken);
  return { userId: user.id, role: membership[0].role || 'member', elevatorRows: Array.isArray(elevators) ? elevators : [] };
}

function makeElevator(row) {
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
  const floorCount = Math.max(1, Math.min(40, Number(payload.floorCount) || 40));
  const currentFloor = Math.max(1, Math.min(floorCount, Number(payload.currentFloor) || 1));
  return {
    id: row.id, x: Number(payload.x) || 0, y: Number(payload.y) || 0, z: Number(payload.z) || 0,
    floorCount, currentFloor, targetFloor: currentFloor, moving: false, doorOpen: false,
    captainId: null, passengers: new Map(), timer: null
  };
}
function getOrCreateRoom(worldId, rows) {
  let room = rooms.get(worldId);
  if (!room) { room = { worldId, clients: new Set(), userConnections: new Map(), elevators: new Map() }; rooms.set(worldId, room); }
  for (const row of rows) if (!room.elevators.has(row.id)) room.elevators.set(row.id, makeElevator(row));
  return room;
}
function elevatorSnapshot(e) {
  return { elevatorId: e.id, x: e.x, y: e.y, z: e.z, floorCount: e.floorCount, currentFloor: e.currentFloor,
    targetFloor: e.targetFloor, moving: e.moving, doorOpen: e.doorOpen, captainId: e.captainId,
    passengers: [...e.passengers.entries()].map(([userId, joinedAt]) => ({ userId, joinedAt })) };
}
function removePassenger(room, userId) {
  for (const e of room.elevators.values()) {
    if (!e.passengers.delete(userId)) continue;
    if (e.captainId === userId) e.captainId = [...e.passengers.entries()].sort((a,b) => a[1]-b[1])[0]?.[0] || null;
    broadcast(room, 'elevator:passengers', elevatorSnapshot(e));
  }
}
function handleMessage(ws, message) {
  const { room, userId } = ws.session;
  if (message.type === 'elevator:passenger') {
    const e = room.elevators.get(message.elevatorId);
    if (!e || typeof message.joined !== 'boolean') return send(ws, 'error', { code: 'invalid_elevator' });
    if (message.joined) { if (!e.passengers.has(userId)) e.passengers.set(userId, Date.now()); if (!e.captainId) e.captainId = userId; }
    else { e.passengers.delete(userId); if (e.captainId === userId) e.captainId = [...e.passengers.entries()].sort((a,b) => a[1]-b[1])[0]?.[0] || null; }
    broadcast(room, 'elevator:passengers', elevatorSnapshot(e));
    return;
  }
  if (message.type === 'elevator:travel') {
    const e = room.elevators.get(message.elevatorId), target = message.targetFloor;
    if (!e) return send(ws, 'error', { code: 'invalid_elevator' });
    if (!safeInteger(target, 1, e.floorCount)) return send(ws, 'error', { code: 'invalid_floor' });
    if (e.moving) return send(ws, 'error', { code: 'elevator_busy' });
    if (!e.passengers.has(userId) || e.captainId !== userId) return send(ws, 'error', { code: 'not_elevator_captain' });
    if (target === e.currentFloor) return send(ws, 'elevator:unchanged', elevatorSnapshot(e));
    const fromFloor = e.currentFloor, duration = Math.max(1200, Math.abs(target-fromFloor)*1250), startedAt = Date.now();
    e.targetFloor = target; e.moving = true; e.doorOpen = false;
    broadcast(room, 'elevator:travel', { elevatorId:e.id, x:e.x, y:e.y, z:e.z, fromFloor, toFloor:target, startedAt, duration, captainId:userId });
    e.timer = setTimeout(() => { e.currentFloor=target; e.targetFloor=target; e.moving=false; e.timer=null; broadcast(room,'elevator:arrived',elevatorSnapshot(e)); }, duration+30);
    return;
  }
  if (message.type === 'elevator:door') {
    const e = room.elevators.get(message.elevatorId);
    if (!e || typeof message.open !== 'boolean') return send(ws, 'error', { code:'invalid_elevator' });
    if (e.moving) return send(ws, 'error', { code:'elevator_busy' });
    if (e.passengers.size && e.captainId !== userId) return send(ws, 'error', { code:'not_elevator_captain' });
    e.doorOpen=message.open; broadcast(room,'elevator:door',elevatorSnapshot(e)); return;
  }
  send(ws, 'error', { code: 'unknown_message' });
}

httpServer.on('upgrade', (req, socket, head) => {
  if (req.url !== '/world') { socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n'); socket.destroy(); return; }
  const ws = acceptWebSocket(req, socket, head);
  if (!ws) return;
  peers.add(ws); ws.session=null; ws.authInProgress=false;
  const authTimer=setTimeout(()=>{ if(!ws.session){send(ws,'error',{code:'authentication_timeout'});ws.close(4401,'authentication timeout');}},AUTH_TIMEOUT_MS);
  ws.on('pong',()=>{ws.isAlive=true;});
  ws.on('message',async raw=>{
    let message; try{message=JSON.parse(raw.toString());}catch{return send(ws,'error',{code:'invalid_json'});}
    if(!message||typeof message.type!=='string')return send(ws,'error',{code:'invalid_message'});
    if(!ws.session){
      if(message.type!=='auth')return send(ws,'error',{code:'authentication_required'});
      if(ws.authInProgress)return;
      ws.authInProgress=true;
      try{
        const identity=await authenticate(message.accessToken,message.worldId);
        if(ws.readyState!==1)return;
        clearTimeout(authTimer);
        const room=getOrCreateRoom(message.worldId,identity.elevatorRows);
        ws.session={room,userId:identity.userId,role:identity.role}; room.clients.add(ws);
        room.userConnections.set(identity.userId,(room.userConnections.get(identity.userId)||0)+1);
        send(ws,'world:ready',{worldId:room.worldId,userId:identity.userId,role:identity.role,elevators:[...room.elevators.values()].map(elevatorSnapshot),connectedPlayers:room.userConnections.size});
        broadcast(room,'world:presence',{connectedPlayers:room.userConnections.size});
      }catch(error){const code=['invalid_token','invalid_world','unauthorized','world_access_denied'].includes(error.message)?error.message:'authentication_failed';send(ws,'error',{code});ws.close(4403,code);}
      return;
    }
    try{handleMessage(ws,message);}catch(error){console.error('ILOX world message failed:',error?.message||error);send(ws,'error',{code:'internal_error'});}
  });
  ws.on('close',()=>{
    clearTimeout(authTimer); peers.delete(ws); if(!ws.session)return;
    const {room,userId}=ws.session; room.clients.delete(ws);
    const remaining=(room.userConnections.get(userId)||1)-1;
    if(remaining<=0){room.userConnections.delete(userId);removePassenger(room,userId);}else room.userConnections.set(userId,remaining);
    broadcast(room,'world:presence',{connectedPlayers:room.userConnections.size});
    if(room.userConnections.size===0){for(const e of room.elevators.values())if(e.timer)clearTimeout(e.timer);rooms.delete(room.worldId);}
  });
  ws.on('error',error=>console.warn('ILOX world socket error:',error?.message||error));
});

const heartbeat=setInterval(()=>{for(const ws of peers){if(!ws.isAlive){ws.terminate();continue;}ws.isAlive=false;ws.ping();}},HEARTBEAT_MS);
function shutdown(){clearInterval(heartbeat);for(const room of rooms.values()){for(const e of room.elevators.values())if(e.timer)clearTimeout(e.timer);broadcast(room,'world:restarting',{reconnect:true});}for(const ws of peers)ws.close(1001,'server restarting');httpServer.close(()=>process.exit(0));setTimeout(()=>process.exit(0),25000).unref();}
process.on('SIGTERM',shutdown); process.on('SIGINT',shutdown);
httpServer.listen(PORT,'0.0.0.0',()=>console.log(`ILOX world authority listening on ${PORT}`));
