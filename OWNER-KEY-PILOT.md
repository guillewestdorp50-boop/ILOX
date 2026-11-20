# ILOX — Owner Key Pilot (verified discovery and implementation plan)

**Status:** isolated implementation is committed on `security/owner-key-v127` and remains unmerged. The PWA screen, Edge Function, migration draft, and helper tests are code-review artifacts only. No production migration, secret, Auth setting, user account, world data, or deployment has been changed.

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

## Implemented on the isolated branch

- `ilox-pwa/owner-pilot/index.html`: private owner screen with separate email OTP/magic-link authentication, no persistent browser session, one-time ten-question enrollment, random three-question challenge, and answer fields that are cleared after use.
- `supabase/functions/ilox-owner-security/index.ts`: server-side owner identity check against the exact configured Auth user UUID; anonymous sessions and unconfirmed email identities are rejected. It supports enrollment, status, challenge, and verification.
- `supabase/functions/ilox-owner-security/security-core.ts`: CSPRNG question selection and HMAC-SHA-256 answer verifiers with Unicode/case/whitespace normalization.
- `supabase/migrations/20261120000000_ilox_owner_security_pilot.sql`: isolated private tables, RLS enabled with no client policies, service-role-only RPCs, atomic challenge consumption, single-use action grants, and answer-free audit events.
- `supabase/config.toml`: JWT verification stays enabled for the Edge Function.
- `.github/workflows/ilox-owner-security-tests.yml`: Deno helper tests run in GitHub Actions.

### Server-enforced controls in the draft

- Each challenge expires after 5 minutes and is atomically consumed on its first verification attempt.
- Maximum 10 challenge creations per owner in 10 minutes.
- Five failed answers trigger a 15-minute lockout.
- Successful verification issues a grant bound to the requested action; the grant expires after 60 seconds and can be consumed only once by a server-side caller.
- Answer values are never written to database rows, audit events, logs, browser storage, or Git. Only keyed HMAC verifiers and question labels are stored.
- The browser uses a separate ephemeral Auth client; the existing anonymous gameplay session is not reused or overwritten.

### Configuration still required before any live test

- Set `ILOX_OWNER_USER_ID` to the exact UUID of the verified permanent Supabase Auth account that the owner chooses. It must not be inferred from a display name, email guess, world ownership, or account order.
- Set `ILOX_OWNER_PEPPER` to a newly generated random secret of at least 32 bytes in Supabase Edge Function secrets. Never put it in Git, the browser, or ChatGPT.
- Confirm the project's `SUPABASE_SECRET_KEYS` environment is present for the Edge Function (or the legacy server-role secret environment during the key migration). The Edge Function also reads the public publishable key for Auth user validation.
- Add the exact owner route to Supabase Auth's allowed redirect URLs so the email magic link returns to `https://ilox-mundo-abierto.onrender.com/owner-pilot/`.
- The owner must already have a permanent, email-confirmed Auth identity. The existing anonymous gameplay account is deliberately ineligible.
- Apply the migration and deploy the Edge Function only after separate explicit approval.

### Known boundary — not yet connected to game operations

The pilot can issue a short-lived action-scoped grant, and the migration includes a service-role-only atomic consume RPC. No existing world deletion, restore, transfer, bulk edit, or other owner operation has been wired to consume that grant yet. Therefore the screen does not execute or protect a live game action. Before enabling it as an actual lock, map the precise owner actions and make each corresponding server-side operation consume the grant transactionally. Do not treat the UI's success message as proof that an operation is protected.
## Required review gates before enabling owner actions

- Finish mapping the owner bootstrap and account binding without revealing personal account data.
- Confirm exact owner-only actions that will require a grant; do not intercept or change ordinary multiplayer gameplay.
- Review the exact RLS policies, grants, and any SECURITY DEFINER paths that the new owner endpoint will use.
- Build and test on an isolated branch/test path only.
- Do not deploy, run migrations, change RLS, rotate keys, alter backups/door credentials, modify world records, or change existing player accounts without a separate explicit approval.

## Isolated interface and backend

The route `ilox-pwa/owner-pilot/index.html` now contains the working client flow for the isolated pilot. The preview endpoint only accepts the fixed `owner.preview.test` action; it cannot mint grants for arbitrary world operations. Configure `ILOX_OWNER_ALLOWED_ORIGIN` to the exact Preview origin before deployment; the production origin remains the default. It is not linked from normal navigation and is not deployed. Its backend implementation and database migration are also committed only on `security/owner-key-v127`; see the implementation and configuration sections above. No migration has been run, no Edge Function has been deployed, and no production Auth or secret settings have been changed.

## Explicit non-actions so far

- No actual owner question/answer content, pepper, bootstrap credential, or owner UUID has been collected or committed.
- No migration has been applied to Supabase and no Edge Function has been deployed.
- No Supabase secret, Auth redirect allowlist, account, RLS policy, or existing RPC has been changed.
- No world, construction, backup, door credential, or existing player account has been modified.
- No production Render deploy or PR merge has occurred.
