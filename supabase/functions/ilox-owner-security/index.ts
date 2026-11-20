const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const OWNER_USER_ID = Deno.env.get("ILOX_OWNER_USER_ID") ?? "";
const OWNER_PEPPER = Deno.env.get("ILOX_OWNER_PEPPER") ?? "";
const ORIGIN = "https://ilox-mundo-abierto.onrender.com";
import { answerVerifier, chooseThree, constantTimeEqual, normalizeAnswer } from "./security-core.ts";

function readKey(name: string, legacyName: string): string {
  const bundle = Deno.env.get(name);
  if (bundle) {
    try {
      const parsed = JSON.parse(bundle);
      if (typeof parsed.default === "string" && parsed.default.length > 20) return parsed.default;
    } catch { /* use the legacy variable below */ }
  }
  return Deno.env.get(legacyName) ?? "";
}

const PUBLISHABLE_KEY = readKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
const SECRET_KEY = readKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-headers": "authorization, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-max-age": "86400",
  "vary": "Origin",
};

function reply(body: unknown, status = 200, originAllowed = true): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(originAllowed ? corsHeaders : {}),
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

async function authenticateOwner(request: Request): Promise<{ id: string; email: string }> {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match || !OWNER_USER_ID || !/^[0-9a-f-]{36}$/i.test(OWNER_USER_ID)) throw new Error("unauthorized");
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: PUBLISHABLE_KEY, authorization: `Bearer ${match[1]}` },
  });
  if (!response.ok) throw new Error("unauthorized");
  const user = await response.json();
  if (user?.id !== OWNER_USER_ID || user?.is_anonymous === true || !user?.email_confirmed_at) {
    throw new Error("unauthorized");
  }
  return { id: user.id, email: user.email ?? "" };
}

async function rpc(name: string, args: Record<string, unknown>): Promise<any> {
  const headers: Record<string, string> = {
    apikey: SECRET_KEY,
    "content-type": "application/json",
  };
  // Legacy service_role keys are JWTs and can also be used as Bearer tokens.
  // New sb_secret keys belong only in apikey, never in Authorization.
  if (SECRET_KEY.startsWith("eyJ")) headers.authorization = `Bearer ${SECRET_KEY}`;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(args),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error("storage_unavailable");
  return body;
}

function validAction(value: unknown): value is string {
  return typeof value === "string" && /^[a-z][a-z0-9_.:-]{2,63}$/.test(value);
}

async function handle(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return reply({ error: "method_not_allowed" }, 405);
  const origin = request.headers.get("origin");
  if (origin && origin !== ORIGIN) return reply({ error: "not_found" }, 404, false);
  if (!SUPABASE_URL || !PUBLISHABLE_KEY || !SECRET_KEY || !OWNER_PEPPER || OWNER_PEPPER.length < 32 || !OWNER_USER_ID) {
    return reply({ error: "service_not_configured" }, 503);
  }

  try {
    const owner = await authenticateOwner(request);
    const body = await request.json();
    if (!isRecord(body) || typeof body.action !== "string") return reply({ error: "invalid_request" }, 400);

    if (body.action === "status") {
      const security = await rpc("ilox_owner_get_security", { p_owner_user_id: owner.id });
      return reply({
        ok: true,
        enrolled: !!security,
        lockedUntil: security?.locked_until ?? null,
      });
    }

    if (body.action === "enroll") {
      if (!Array.isArray(body.questions) || body.questions.length !== 10) return reply({ error: "invalid_questions" }, 400);
      const verifiers: Record<string, { question: string; verifier: string }> = {};
      for (let index = 0; index < 10; index++) {
        const item = body.questions[index];
        if (!isRecord(item) || item.id !== index + 1 || typeof item.question !== "string") {
          return reply({ error: "invalid_questions" }, 400);
        }
        const question = item.question.trim();
        if (question.length < 3 || question.length > 120) return reply({ error: "invalid_questions" }, 400);
        const answer = normalizeAnswer(item.answer);
        verifiers[String(index + 1)] = {
          question,
          verifier: await answerVerifier(owner.id, index + 1, answer, OWNER_PEPPER),
        };
      }
      const enrolled = await rpc("ilox_owner_enroll", {
        p_owner_user_id: owner.id,
        p_verifiers: verifiers,
      });
      return enrolled === true
        ? reply({ ok: true, enrolled: true })
        : reply({ error: "already_enrolled" }, 409);
    }

    if (body.action === "challenge") {
      if (!validAction(body.targetAction)) return reply({ error: "invalid_action" }, 400);
      const security = await rpc("ilox_owner_get_security", { p_owner_user_id: owner.id });
      if (!security) return reply({ error: "not_enrolled" }, 409);
      if (security.locked_until && Date.parse(security.locked_until) > Date.now()) {
        return reply({ error: "temporarily_locked" }, 423);
      }
      const ids = chooseThree();
      const created = await rpc("ilox_owner_start_challenge", {
        p_owner_user_id: owner.id,
        p_question_ids: ids,
        p_target_action: body.targetAction,
      });
      const questions = security.answer_verifiers ?? {};
      return reply({
        ok: true,
        challengeId: created.id,
        expiresAt: created.expires_at,
        questions: ids.map(id => ({ id, question: questions[String(id)]?.question ?? "" })),
      });
    }

    if (body.action === "verify") {
      if (typeof body.challengeId !== "string" || !Array.isArray(body.answers) || body.answers.length !== 3) {
        return reply({ error: "invalid_request" }, 400);
      }
      const claimed = await rpc("ilox_owner_claim_challenge", {
        p_owner_user_id: owner.id,
        p_challenge_id: body.challengeId,
      });
      if (!claimed || !Array.isArray(claimed.question_ids) || !validAction(claimed.target_action)) {
        return reply({ error: "challenge_invalid" }, 401);
      }
      const security = await rpc("ilox_owner_get_security", { p_owner_user_id: owner.id });
      const answers = new Map<number, string>();
      for (const item of body.answers) {
        if (!isRecord(item) || !Number.isInteger(item.id) || answers.has(item.id as number)) {
          await rpc("ilox_owner_record_failure", { p_owner_user_id: owner.id });
          return reply({ error: "verification_failed" }, 401);
        }
        answers.set(item.id as number, normalizeAnswer(item.answer));
      }
      let valid = answers.size === 3;
      for (const id of claimed.question_ids as number[]) {
        const expected = security?.answer_verifiers?.[String(id)]?.verifier;
        const supplied = answers.get(id);
        if (typeof expected !== "string" || !supplied) { valid = false; continue; }
        const actual = await answerVerifier(owner.id, id, supplied, OWNER_PEPPER);
        if (!constantTimeEqual(actual, expected)) valid = false;
      }
      if (!valid) {
        await rpc("ilox_owner_record_failure", { p_owner_user_id: owner.id });
        return reply({ error: "verification_failed" }, 401);
      }
      const grant = await rpc("ilox_owner_issue_grant", {
        p_owner_user_id: owner.id,
        p_target_action: claimed.target_action,
      });
      return reply({ ok: true, grantId: grant.grant_id, targetAction: claimed.target_action, expiresAt: grant.expires_at });
    }

    return reply({ error: "unknown_action" }, 400);
  } catch (error) {
    const code = error instanceof Error ? error.message : "internal_error";
    if (code === "invalid_input") return reply({ error: "invalid_request" }, 400);
    if (code === "unauthorized") return reply({ error: "unauthorized" }, 401);
    if (code === "owner_temporarily_locked") return reply({ error: "temporarily_locked" }, 423);
    if (code === "owner_not_enrolled") return reply({ error: "not_enrolled" }, 409);
    if (code === "owner_rate_limited") return reply({ error: "rate_limited" }, 429);
    return reply({ error: "security_service_unavailable" }, 503);
  }
}

Deno.serve(handle);
