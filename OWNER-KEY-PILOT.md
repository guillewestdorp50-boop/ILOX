# ILOX — Owner Key Pilot (verified discovery and implementation plan)

**Status:** discovery and design only. The existing draft PR is not merged. No production code, database objects, secrets, user accounts, world data, or deployments have been changed.

## Goal and scope

Build an independent owner-security gate for the ILOX v127 pilot only. Preserve the existing game, worlds, constructions, multiplayer, backups, and player identities. PDA // ZONA and Choferes Argentinos are explicitly out of scope.

## Confirmed live deployment

Render workspace **My Workspace** was explicitly confirmed by the user. Read-only inspection found:

- **ILOX PWA:** `ilox-mundo-abierto`, static site, repo `guillewestdorp50-boop/ILOX`, branch `deploy/render-ilox`, publish directory `ilox-pwa`, URL `https://ilox-mundo-abierto.onrender.com`.
- Its latest live deploy is commit `01e337d9845ad3795af5b1d1084af9ea57062ce2`, message **“Refresh ILOX PWA cache for v127”**. The service worker cache name also identifies v127.
- **World authority backend:** `ilox-world-authority`, web service, same repository and branch, same live v127 commit, URL `https://ilox-world-authority.onrender.com`.
- Both services have auto-deploy enabled on `deploy/render-ilox`. Do not push pilot work to that branch; work only on the isolated security branch unless the user separately approves a deployment plan.

## Confirmed v127 integration

The live v127 source includes `ilox-pwa/multiplayer.js`, which initializes Supabase JS against the existing ILOX-MULTIJUGADOR project. It creates/reuses Supabase sessions with `signInAnonymously`, persists multiplayer profiles/world data, and opens a WebSocket to the Render world-authority service.

The world-authority server validates the Supabase access token through Auth and checks world membership before joining a room. The frontend and backend therefore really are connected to the existing Supabase project; earlier README/code-search conclusions that they were not connected were incorrect and are superseded by this verified v127 inspection. The PWA README is stale relative to the live v127 source.

## Authentication implication for the owner pilot

Current gameplay identity is anonymous Supabase Auth. An anonymous player session is useful for the existing multiplayer flow, but it is not by itself a strong, independently verified owner identity.

The owner gate must therefore:
- Keep current player sessions and gameplay untouched.
- Require a separately verified owner identity or a rigorously bootstrapped, explicitly allowlisted identity before owner actions.
- Reject anonymous sessions for owner authorization unless a separately approved design proves a safe binding; do not treat a display name, user-editable metadata, or possession of an arbitrary anonymous session as proof of ownership.
- Use the 10-question challenge only as an additional factor, never as the sole factor.
- Bind each successful authorization to one specific action, expire it quickly, and make it single-use.

No owner identity is to be guessed from email, display name, world owner, or account ordering. Enrollment/bootstrap must be performed through a private server-side process and must not require the user to send secrets or answers in ChatGPT.

## Supabase security discovery (read-only)

The existing `ILOX-MULTIJUGADOR` project is active and contains live multiplayer data. Existing player/world tables have RLS enabled and owner/member policies. No schema changes were made.

Findings requiring careful treatment:
- The Supabase Security Advisor flags `private.ilox_world_backups` as critical because RLS is disabled. A separate privilege check found no direct SELECT/INSERT privileges for either `anon` or `authenticated`, and there are no policies. Do not auto-enable RLS or alter backup access until every service path is mapped; enabling it without the correct service policy could break recovery.
- The Advisor warns that `public.multiplayer_delete_world(uuid)` is a SECURITY DEFINER function executable by anon/authenticated. Its current body checks `auth.uid()` is present and requires that caller to be the world's owner before deleting. Keep this separate from the owner-key pilot; do not change it as a shortcut.
- The Advisor reports anonymous-session policies on multiplayer tables and a collection of RLS-enabled/no-policy tables, including other app tables. Do not broaden this pilot into changes to those policies or to other apps.
- Existing door PIN material is held in `private.multiplayer_door_credentials`; do not reuse or modify it for owner-key secrets.
- Existing `ilox-error-report` Edge Function is diagnostic only; do not repurpose it as an auth endpoint.
- Never expose a Supabase service-role/secret key in browser code. The existing publishable key is client-side by design; all owner verification and privileged operations must remain server-side.

## Proposed security model

1. **Independent owner route:** separate from the 3D scene and ordinary public navigation.
2. **Explicit owner enrollment:** a private server-side bootstrap binds the real owner identity to a protected owner record. Do not guess or infer identity.
3. **10-question enrollment:** user enters questions/answers only in the protected owner page. Never send answers to ChatGPT, GitHub, logs, analytics, diagnostics, or client telemetry.
4. **Random challenge:** choose three distinct questions per attempt using cryptographically secure randomness.
5. **Server-side verification:** store keyed HMAC-SHA-256 verifiers, not plaintext answers or unkeyed hashes. Keep the pepper exclusively in a dedicated Edge Function secret.
6. **Abuse controls:** server-enforced rate limits, progressive lockout, generic errors, challenge expiry, single-use grants, and audit records without answers.
7. **Fail closed:** invalid/anonymous identity, missing enrollment, backend failure, expired challenge, or invalid grant denies the owner action.
8. **No silent production action:** code remains isolated for review. Migrations, Edge Function deployment, secret configuration, and any Render deployment are separate steps requiring explicit approval.

## Required review gates before enabling owner actions

- Finish mapping the owner bootstrap and account binding without revealing personal account data.
- Confirm exact owner-only actions that will require a grant; do not intercept or change ordinary multiplayer gameplay.
- Review the exact RLS policies, grants, and any SECURITY DEFINER paths that the new owner endpoint will use.
- Build and test on an isolated branch/test path only.
- Do not deploy, run migrations, change RLS, rotate keys, alter backups/door credentials, modify world records, or change existing player accounts without a separate explicit approval.

## Explicit non-actions so far

- No questions or answers collected.
- No secrets, hashes, owner IDs, or credentials added to Git.
- No Supabase schema or Edge Function changes.
- No changes to game worlds, constructions, backups, door credentials, or existing user accounts.
- No production deployment or merge.
