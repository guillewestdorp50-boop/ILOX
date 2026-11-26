import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const publishable = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")!).default;
const secret = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")!).default;
const admin = createClient(URL, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const authClient = createClient(URL, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
const allowed = new Set(["https://ilox-mundo-abierto.onrender.com", "https://west-vill-production.onrender.com", "http://localhost:4173", "http://127.0.0.1:4173"]);
const headers = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && allowed.has(origin) ? origin : "https://ilox-mundo-abierto.onrender.com",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
  "Content-Type": "application/json"
});
const reply = (data: unknown, status = 200, origin: string | null = null) => new Response(JSON.stringify(data), { status, headers: headers(origin) });
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map(x => x.toString(16).padStart(2, "0")).join("");
const syntheticEmail = async (username: string) => (await hash("westvill-user:" + username)) + "@identity.westvill.invalid";
const cleanUsername = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const validUsername = (s: string) => /^[\p{L}\p{N}][\p{L}\p{N} ._-]{0,23}$/u.test(s);
const randomCode = () => "WV-" + Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
const safeClientId = (value: unknown) => {
  const s = String(value ?? "");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s) ? s : null;
};
async function logSecurity(input: any, action: string, role: string | null, outcome: "success" | "failure" | "blocked", reason: string | null = null) {
  const clientId = safeClientId(input?.client_id);
  await admin.from("westvill_security_events").insert({ action, role, outcome, reason_code: reason, client_id: clientId, app_version: String(input?.app_version ?? "").slice(0, 24) || null });
  if (action === "login" && outcome === "failure" && clientId) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await admin.from("westvill_security_events").select("id", { count: "exact", head: true }).eq("client_id", clientId).eq("action", "login").eq("outcome", "failure").gte("created_at", since);
    return (count ?? 0) >= 10;
  }
  return false;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: headers(origin) });
  if (req.method !== "POST") return reply({ error: "Método no permitido." }, 405, origin);
  if (req.headers.get("apikey") !== publishable) return reply({ error: "Acceso no autorizado." }, 401, origin);
  try {
    const input = await req.json();
    const action = String(input.action ?? "");
    if (action === "bootstrap-admin") {
      const username = cleanUsername(input.username);
      const password = String(input.password ?? "");
      const displayName = String(input.display_name ?? "").trim().slice(0, 60);
      if (!validUsername(username)) return reply({ error: "El usuario puede tener de 1 a 24 caracteres, con letras, números y espacios." }, 400, origin);
      if (password.length < 4 || password.length > 128) return reply({ error: "La contraseña debe tener al menos 4 caracteres." }, 400, origin);
      if (!displayName) return reply({ error: "Ingresá tu nombre para mostrar." }, 400, origin);
      const { count, error: countError } = await admin.from("westvill_profiles").select("id", { count: "exact", head: true }).eq("role", "admin");
      if (countError) return reply({ error: "No se pudo verificar el acceso inicial." }, 500, origin);
      if ((count ?? 0) > 0) return reply({ error: "La administración inicial ya está configurada. Volvé e ingresá con tu usuario y contraseña." }, 403, origin);
      const email = await syntheticEmail(username);
      const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (createError || !created.user) return reply({ error: createError?.message?.toLowerCase().includes("already") ? "Ese nombre de usuario ya está registrado." : "No se pudo crear la cuenta. Revisá los datos e intentá nuevamente." }, 400, origin);
      const { error: profileError } = await admin.from("westvill_profiles").insert({ id: created.user.id, username, display_name: displayName, role: "admin" });
      if (profileError) {
        await admin.auth.admin.deleteUser(created.user.id);
        return reply({ error: "No se pudo activar la administración. Intentá nuevamente." }, 500, origin);
      }
      const { data: signed, error: signError } = await authClient.auth.signInWithPassword({ email, password });
      if (signError || !signed.session) return reply({ error: "La administración quedó creada. Ingresá con tu usuario y contraseña." }, 200, origin);
      return reply({ session: signed.session, profile: { id: created.user.id, username, display_name: displayName, role: "admin" } }, 200, origin);
    }
    if (action === "register") {
      const username = cleanUsername(input.username);
      const password = String(input.password ?? "");
      const displayName = String(input.display_name ?? "").trim().slice(0, 60);
      const role = String(input.role ?? "");
      const invite = String(input.invite_code ?? "").trim().toUpperCase();
      if (!validUsername(username)) { await logSecurity(input, "register", role, "failure", "invalid_username"); return reply({ error: "El usuario puede tener de 1 a 24 caracteres, con letras, números y espacios." }, 400, origin); }
      if (password.length < 10 || password.length > 128) { await logSecurity(input, "register", role, "failure", "password_policy"); return reply({ error: "La contraseña debe tener al menos 10 caracteres." }, 400, origin); }
      if (!displayName) { await logSecurity(input, "register", role, "failure", "display_name_missing"); return reply({ error: "Ingresá tu nombre para mostrar." }, 400, origin); }
      if (!["admin", "conductor", "pasajero"].includes(role)) { await logSecurity(input, "register", role, "blocked", "invalid_role"); return reply({ error: "Tipo de cuenta no permitido." }, 403, origin); }
      if (role === "admin") { await logSecurity(input, "register", role, "blocked", "admin_signup_disabled"); return reply({ error: "La creación de cuentas administrativas está cerrada." }, 403, origin); }
      if (!invite) { await logSecurity(input, "register", role, "failure", "invite_missing"); return reply({ error: "Para crear esta cuenta necesitás un código de invitación generado por administración." }, 403, origin); }
      const codeHash = await hash(invite);
      {
        const { data: consumed, error: inviteError } = await admin.rpc("westvill_consume_invite", { p_hash: codeHash, p_role: role });
        if (inviteError || consumed !== true) { const help = await logSecurity(input, "register", role, "failure", "invite_invalid_or_used"); return reply({ error: "Código de invitación inválido, vencido, ya utilizado o correspondiente a otro tipo de cuenta.", help_needed: help }, 403, origin); }
      }
      const email = await syntheticEmail(username);
      const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (createError || !created.user) {
        if (codeHash) await admin.rpc("westvill_release_invite", { p_hash: codeHash });
        const message = createError?.message?.toLowerCase().includes("already") ? "Ese nombre de usuario ya está registrado." : "No se pudo crear la cuenta. Revisá los datos e intentá nuevamente.";
        const help = await logSecurity(input, "register", role, "failure", createError?.message?.toLowerCase().includes("already") ? "username_exists" : "account_create_failed");
        return reply({ error: message, help_needed: help }, 400, origin);
      }
      const { error: profileError } = await admin.from("westvill_profiles").insert({ id: created.user.id, username, display_name: displayName, role });
      if (profileError) {
        await admin.auth.admin.deleteUser(created.user.id);
        if (codeHash) await admin.rpc("westvill_release_invite", { p_hash: codeHash });
        await logSecurity(input, "register", role, "failure", "profile_create_failed");
        return reply({ error: "No se pudo completar el perfil. Intentá nuevamente." }, 500, origin);
      }
      const { data: session, error: signInError } = await authClient.auth.signInWithPassword({ email, password });
      if (signInError || !session.session) return reply({ error: "La cuenta se creó, pero no se pudo iniciar sesión. Volvé a ingresar con tu usuario y contraseña." }, 200, origin);
      await logSecurity(input, "register", role, "success", null);
      return reply({ session: session.session, profile: { id: created.user.id, username, display_name: displayName, role } }, 200, origin);
    }
    if (action === "login") {
      const username = cleanUsername(input.username);
      const password = String(input.password ?? "");
      if (!validUsername(username) || !password) { const help = await logSecurity(input, "login", String(input.role ?? ""), "failure", "invalid_input"); return reply({ error: "Usuario o contraseña incorrectos.", help_needed: help }, 400, origin); }
      const { data: profile, error: profileError } = await admin.from("westvill_profiles").select("id,username,display_name,role").eq("username", username).maybeSingle();
      if (profileError || !profile) { const help = await logSecurity(input, "login", String(input.role ?? ""), "failure", "credentials_not_matched"); return reply({ error: "Usuario o contraseña incorrectos.", help_needed: help }, 401, origin); }
      if (profile.role !== String(input.role ?? "")) { await logSecurity(input, "login", String(input.role ?? ""), "blocked", "role_mismatch"); return reply({ error: "Esta cuenta pertenece a otro tipo de acceso." }, 403, origin); }
      const email = await syntheticEmail(username);
      const { data: signed, error: signError } = await authClient.auth.signInWithPassword({ email, password });
      if (signError || !signed.session) { const help = await logSecurity(input, "login", profile.role, "failure", "credentials_not_matched"); return reply({ error: "Usuario o contraseña incorrectos.", help_needed: help }, 401, origin); }
      await logSecurity(input, "login", profile.role, "success", null);
      return reply({ session: signed.session, profile }, 200, origin);
    }

    if (action === "create-password-reset") {
      const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\\s+/i, "");
      if (!token) return reply({ error: "Sesión requerida." }, 401, origin);
      const { data: userData, error: userError } = await authClient.auth.getUser(token);
      if (userError || !userData.user) return reply({ error: "Sesión vencida." }, 401, origin);
      const { data: actor } = await admin.from("westvill_profiles").select("role").eq("id", userData.user.id).maybeSingle();
      if (actor?.role !== "admin") { await logSecurity(input, "password-reset-create", null, "blocked", "not_admin"); return reply({ error: "Solo administración puede generar blanqueos." }, 403, origin); }
      const username = cleanUsername(input.username);
      if (!validUsername(username)) return reply({ error: "Ingresá un usuario válido." }, 400, origin);
      const { data: target } = await admin.from("westvill_profiles").select("id,username").eq("username", username).maybeSingle();
      if (!target) return reply({ error: "No encontramos ese usuario." }, 404, origin);
      const code = randomCode();
      const codeHash = await hash(code);
      await admin.from("westvill_password_resets").update({ consumed_at: new Date().toISOString() }).eq("user_id", target.id).is("consumed_at", null);
      const { error: insertError } = await admin.from("westvill_password_resets").insert({
        user_id: target.id, code_hash: codeHash, created_by: userData.user.id,
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      });
      if (insertError) return reply({ error: "No se pudo generar el blanqueo." }, 500, origin);
      await logSecurity(input, "password-reset-create", null, "success", null);
      return reply({ reset_code: code, username: target.username, expires_in_minutes: 15 }, 200, origin);
    }
    if (action === "complete-password-reset") {
      const username = cleanUsername(input.username);
      const code = String(input.reset_code ?? "").trim().toUpperCase();
      const newPassword = String(input.new_password ?? "");
      if (!validUsername(username) || !code || newPassword.length < 10 || newPassword.length > 128) {
        await logSecurity(input, "password-reset-complete", null, "failure", "invalid_reset_input");
        return reply({ error: "Revisá el usuario, el código y la nueva contraseña (mínimo 10 caracteres)." }, 400, origin);
      }
      const { data: target } = await admin.from("westvill_profiles").select("id,role").eq("username", username).maybeSingle();
      if (!target) { await logSecurity(input, "password-reset-complete", null, "failure", "reset_not_valid"); return reply({ error: "El código no es válido o venció." }, 400, origin); }
      const { data: reset } = await admin.from("westvill_password_resets").select("id,user_id").eq("user_id", target.id).eq("code_hash", await hash(code)).is("consumed_at", null).gt("expires_at", new Date().toISOString()).maybeSingle();
      if (!reset) { await logSecurity(input, "password-reset-complete", target.role, "failure", "reset_not_valid"); return reply({ error: "El código no es válido o venció." }, 400, origin); }
      const { error: updateError } = await admin.auth.admin.updateUserById(target.id, { password: newPassword });
      if (updateError) { await logSecurity(input, "password-reset-complete", target.role, "failure", "password_update_failed"); return reply({ error: "No se pudo actualizar la contraseña. Pedí un nuevo blanqueo." }, 500, origin); }
      await admin.from("westvill_password_resets").update({ consumed_at: new Date().toISOString() }).eq("id", reset.id).is("consumed_at", null);
      await logSecurity(input, "password-reset-complete", target.role, "success", null);
      return reply({ ok: true }, 200, origin);
    }
    if (action === "create-invite") {
      const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
      if (!token) return reply({ error: "Sesión requerida." }, 401, origin);
      const { data: userData, error: userError } = await authClient.auth.getUser(token);
      if (userError || !userData.user) return reply({ error: "Sesión vencida." }, 401, origin);
      const { data: profile } = await admin.from("westvill_profiles").select("role").eq("id", userData.user.id).maybeSingle();
      if (profile?.role !== "admin") return reply({ error: "Solo administración puede crear invitaciones." }, 403, origin);
      const role = String(input.role ?? "");
      const maxUses = Math.max(1, Math.min(100, Number(input.max_uses ?? 1)));
      if (!["admin", "conductor", "pasajero"].includes(role)) return reply({ error: "Tipo de invitación no permitido." }, 400, origin);
      if (role === "admin") { await logSecurity(input, "create-invite", role, "blocked", "admin_invites_disabled"); return reply({ error: "No se pueden generar nuevas invitaciones de administración." }, 403, origin); }
      const code = randomCode();
      const { error: insertError } = await admin.from("westvill_invites").insert({ code_hash: await hash(code), role, max_uses: maxUses, created_by: userData.user.id });
      if (insertError) return reply({ error: "No se pudo generar el código." }, 500, origin);
      return reply({ code, role, max_uses: maxUses }, 200, origin);
    }
    return reply({ error: "Acción no reconocida." }, 400, origin);
  } catch (_error) {
    return reply({ error: "No se pudo procesar la solicitud." }, 500, origin);
  }
});