import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm";

const SUPABASE_URL = "https://wihbxfebobfmohmqqhkt.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_CmPT-xSeIUUtTUArdIYDgA_jhXY8nuZ";
export const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
});

export async function ensureIdentity(displayName, avatarKind) {
  let { data: { session } } = await client.auth.getSession();
  if (!session) {
    const result = await client.auth.signInAnonymously({
      options: { data: { display_name: displayName, avatar_kind: avatarKind } }
    });
    if (result.error) throw result.error;
    session = result.data.session;
  }
  const user = session.user;
  const safeName = String(displayName || "Jugador").trim().slice(0, 32) || "Jugador";
  const { error } = await client.from("multiplayer_profiles").upsert({
    user_id: user.id, display_name: safeName, avatar_kind: String(avatarKind || "boy").slice(0, 40), updated_at: new Date().toISOString()
  }, { onConflict: "user_id" });
  if (error) throw error;
  return user;
}

export async function updateMyAvatar(avatarKind) {
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) throw userError || new Error("No hay una sesión activa.");
  const { error } = await client.from("multiplayer_profiles").update({
    avatar_kind: String(avatarKind || "boy:0").slice(0, 40),
    updated_at: new Date().toISOString()
  }).eq("user_id", user.id);
  if (error) throw error;
}

export async function listMyWorlds() {
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) return [];
  const { data: memberships, error: memberError } = await client.from("multiplayer_world_members")
    .select("world_id,role").eq("user_id", user.id);
  if (memberError) throw memberError;
  const ids = (memberships || []).map(item => item.world_id);
  if (!ids.length) return [];
  const { data: worlds, error } = await client.from("multiplayer_worlds")
    .select("id,name,owner_id,created_at").in("id", ids).order("created_at", { ascending: false });
  if (error) throw error;
  return (worlds || []).map(world => ({
    ...world,
    role: memberships.find(item => item.world_id === world.id)?.role || "member"
  }));
}

export async function createWorld(name) {
  const { data, error } = await client.rpc("multiplayer_create_world", { p_name: name });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function joinWorld(inviteCode) {
  const { data, error } = await client.rpc("multiplayer_join_world", { p_invite_code: inviteCode });
  if (error) throw error;
  return data;
}

export async function getChatMessages(worldId) {
  const { data, error } = await client.from("multiplayer_chat_messages")
    .select("id,world_id,user_id,display_name,message,created_at")
    .eq("world_id", worldId).order("created_at", { ascending: false }).limit(50);
  if (error) throw error;
  return (data || []).reverse();
}

export async function getWorldPlayerStates(worldId) {
  const cutoff = new Date(Date.now() - 12000).toISOString();
  const { data, error } = await client.from("multiplayer_player_states")
    .select("world_id,user_id,x,y,z,rotation,avatar,moving,swimming,jumping,updated_at")
    .eq("world_id", worldId).gt("updated_at", cutoff);
  if (error) throw error;
  return data || [];
}

async function sendWorldChatMessage(worldId, message, displayName) {
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) throw userError || new Error("No hay una sesión activa.");
  const safeMessage = String(message || "").trim().slice(0, 500);
  if (!safeMessage) throw new Error("Escribí un mensaje antes de enviarlo.");
  const safeName = String(displayName || "Jugador").trim().slice(0, 32) || "Jugador";
  const { data, error } = await client.from("multiplayer_chat_messages").insert({
    world_id: worldId, user_id: user.id, display_name: safeName, message: safeMessage
  }).select("id,world_id,user_id,display_name,message,created_at").single();
  if (error) throw error;
  return data;
}

async function saveWorldPlayerState(worldId, payload) {
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) throw userError || new Error("No hay una sesión activa.");
  const { error } = await client.from("multiplayer_player_states").upsert({
    world_id: worldId, user_id: user.id,
    x: Number(payload.x) || 0, y: Number(payload.y) || 0, z: Number(payload.z) || 0,
    rotation: Number(payload.rotation) || 0,
    avatar: String(payload.avatar || "boy:0").slice(0, 40),
    moving: !!payload.moving, swimming: !!payload.swimming, jumping: !!payload.jumping,
    updated_at: new Date().toISOString()
  }, { onConflict: "world_id,user_id" });
  if (error) throw error;
}

async function removeWorldPlayerState(worldId, userId) {
  const { error } = await client.from("multiplayer_player_states")
    .delete().eq("world_id", worldId).eq("user_id", userId);
  if (error) throw error;
}

export async function getWorldStructures(worldId) {
  const { data, error } = await client.from("multiplayer_structures")
    .select("id,world_id,owner_id,kind,payload,version")
    .eq("world_id", worldId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function saveStructure(worldId, userId, record) {
  const payload = { ...record };
  delete payload.cloudId;
  delete payload.cloudOwnerId;
  delete payload.pin;
  const row = { world_id: worldId, owner_id: userId, kind: record.kind, payload };
  if (!record.cloudId) {
    const { data, error } = await client.from("multiplayer_structures")
      .insert(row).select("id,owner_id").single();
    if (error) {
      if (error.code === "42501") throw new Error("Esta platea está protegida. Pedile permiso al propietario para construir allí.");
      throw error;
    }
    return data;
  }
  const { data, error } = await client.from("multiplayer_structures")
    .update({ kind: record.kind, payload })
    .eq("id", record.cloudId).eq("world_id", worldId)
    .select("id,owner_id").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No tenés permiso para modificar esta estructura.");
  return data;
}

export async function deleteStructure(worldId, structureId) {
  const { data, error } = await client.from("multiplayer_structures")
    .delete().eq("id", structureId).eq("world_id", worldId).select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No tenés permiso para eliminar esta estructura.");
  return true;
}

export async function listWorldMembers(worldId) {
  const { data: memberships, error: memberError } = await client.from("multiplayer_world_members")
    .select("user_id,role").eq("world_id", worldId);
  if (memberError) throw memberError;
  const ids = (memberships || []).map(item => item.user_id);
  if (!ids.length) return [];
  const { data: profiles, error: profileError } = await client.from("multiplayer_profiles")
    .select("user_id,display_name,avatar_kind").in("user_id", ids);
  if (profileError) throw profileError;
  return (memberships || []).map(member => ({
    ...member,
    ...(profiles || []).find(profile => profile.user_id === member.user_id)
  }));
}

export async function getStructurePermissions(structureId) {
  const { data, error } = await client.from("multiplayer_structure_permissions")
    .select("structure_id,user_id,can_edit").eq("structure_id", structureId);
  if (error) throw error;
  return data || [];
}

export async function getPermissionsForStructures(structureIds) {
  if (!structureIds?.length) return [];
  const { data, error } = await client.from("multiplayer_structure_permissions")
    .select("structure_id,user_id,can_edit").in("structure_id", structureIds);
  if (error) throw error;
  return data || [];
}

export async function grantStructurePermissions(structureIds, userId) {
  const { data: { user } } = await client.auth.getUser();
  for (const structureId of structureIds) {
    const { error } = await client.from("multiplayer_structure_permissions").upsert({
      structure_id: structureId, user_id: userId, can_edit: true, granted_by: user.id
    }, { onConflict: "structure_id,user_id" });
    if (error) throw error;
  }
}

export async function revokeStructurePermissions(structureIds, userId) {
  for (const structureId of structureIds) {
    const { error } = await client.from("multiplayer_structure_permissions")
      .delete().eq("structure_id", structureId).eq("user_id", userId);
    if (error) throw error;
  }
}

export async function grantStructurePermission(structureId, userId) {
  const { data: { user } } = await client.auth.getUser();
  const { error } = await client.from("multiplayer_structure_permissions").upsert({
    structure_id: structureId, user_id: userId, can_edit: true, granted_by: user.id
  }, { onConflict: "structure_id,user_id" });
  if (error) throw error;
}

export async function revokeStructurePermission(structureId, userId) {
  const { error } = await client.from("multiplayer_structure_permissions")
    .delete().eq("structure_id", structureId).eq("user_id", userId);
  if (error) throw error;
}

export async function subscribeWorld(worldId, handlers = {}) {
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) throw userError || new Error("No hay una sesión activa.");
  await client.realtime.setAuth();
  const channel = client.channel("world:" + worldId, {
    config: { private: true, presence: { key: user.id } }
  });
  channel
    .on("broadcast", { event: "player_state" }, ({ payload }) => handlers.onPlayerState?.(payload))
    .on("broadcast", { event: "world_refresh" }, () => handlers.onWorldRefresh?.())
    .on("postgres_changes", { event: "*", schema: "public", table: "multiplayer_structures", filter: "world_id=eq." + worldId }, () => handlers.onWorldRefresh?.())
    .on("broadcast", { event: "chat_message" }, ({ payload }) => handlers.onChatMessage?.(payload?.message || payload))
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "multiplayer_chat_messages", filter: "world_id=eq." + worldId }, payload => handlers.onChatMessage?.(payload.new))
    .on("postgres_changes", { event: "*", schema: "public", table: "multiplayer_player_states", filter: "world_id=eq." + worldId }, payload => handlers.onPlayerStateChange?.(payload))
    .on("presence", { event: "sync" }, () => handlers.onPresence?.(channel.presenceState()))
    .on("presence", { event: "join" }, () => handlers.onPresence?.(channel.presenceState()))
    .on("presence", { event: "leave" }, () => handlers.onPresence?.(channel.presenceState()));
  let lastStatePersistAt = 0;
  return new Promise((resolve, reject) => {
    channel.subscribe(async status => {
      if (status === "SUBSCRIBED") {
        try {
          await channel.track({ user_id: user.id, joined_at: new Date().toISOString() });
          resolve({
          channel,
          userId: user.id,
          sendPlayerState: async payload => {
            const state = { ...payload, userId: user.id, user_id: user.id };
            const broadcastStatus = await channel.send({
              type: "broadcast", event: "player_state", payload: state
            });
            if (broadcastStatus !== "ok") throw new Error("No se pudo transmitir la posición en tiempo real.");
            const now = Date.now();
            if (now - lastStatePersistAt >= 2000) {
              lastStatePersistAt = now;
              await saveWorldPlayerState(worldId, state);
            }
          },
          sendWorldRefresh: () => channel.send({ type: "broadcast", event: "world_refresh", payload: { at: Date.now() } }),
          sendChatMessage: async (message, displayName) => {
            const row = await sendWorldChatMessage(worldId, message, displayName);
            const status = await channel.send({
              type: "broadcast", event: "chat_message", payload: { message: row }
            });
            if (status !== "ok") console.warn("ILOX multiplayer: el mensaje quedó guardado, pero falló el aviso en tiempo real.", status);
            return row;
          },
          updatePresence: payload => channel.track({ ...payload, user_id: user.id }),
          close: async () => {
            try { await removeWorldPlayerState(worldId, user.id); } catch (error) { console.warn("ILOX multiplayer: no se pudo retirar el estado del jugador", error); }
            return client.removeChannel(channel);
          }
          });
        } catch (error) {
          await client.removeChannel(channel);
          reject(error);
        }
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        reject(new Error("No se pudo conectar al canal privado del mundo (" + status + ")."));
      }
    });
  });
}

export async function setDoorPin(structureId, pin) {
  const { error } = await client.rpc("multiplayer_set_door_pin", {
    p_structure_id: structureId, p_pin: String(pin)
  });
  if (error) throw error;
  return true;
}

export async function verifyDoorPin(structureId, pin) {
  const { data, error } = await client.rpc("multiplayer_verify_door_pin", {
    p_structure_id: structureId, p_pin: String(pin)
  });
  if (error) throw error;
  return data === true;
}
