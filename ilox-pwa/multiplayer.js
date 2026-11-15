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
    if (error) throw error;
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
  const channel = client.channel("world:" + worldId, {
    config: { private: true, presence: { key: user.id } }
  });
  channel
    .on("broadcast", { event: "player_state" }, ({ payload }) => handlers.onPlayerState?.(payload))
    .on("broadcast", { event: "world_refresh" }, () => handlers.onWorldRefresh?.())
    .on("presence", { event: "sync" }, () => handlers.onPresence?.(channel.presenceState()));
  return new Promise((resolve, reject) => {
    channel.subscribe(async status => {
      if (status === "SUBSCRIBED") {
        await channel.track({ user_id: user.id, joined_at: new Date().toISOString() });
        resolve({
          channel,
          userId: user.id,
          sendPlayerState: payload => channel.send({ type: "broadcast", event: "player_state", payload }),
          sendWorldRefresh: () => channel.send({ type: "broadcast", event: "world_refresh", payload: { at: Date.now() } }),
          updatePresence: payload => channel.track({ ...payload, user_id: user.id }),
          close: () => client.removeChannel(channel)
        });
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        reject(new Error("No se pudo conectar al canal privado del mundo (" + status + ")."));
      }
    });
  });
}
