# ILOX — Owner Key Pilot (design proposal)

**Status:** design only; not deployed; no production files or database objects changed.

## Goal

Prepare an independent owner-security page for the ILOX pilot without changing the game scene, world content, construction data, existing accounts, or the PDA / Choferes Argentinos projects.

## Repository findings

- The current `ilox-pwa/` is a static PWA shell. Its README and UI explicitly state that accounts, multiplayer, and cloud saves are not connected in this frontend.
- The repository also contains the separate 3D forest preview and Android build workflows. The owner-security page must remain isolated from those entry points.
- The Supabase project already has Auth users and multiplayer/world tables. Existing data must be treated as production data and preserved.
- An existing diagnostic Edge Function is configured without platform JWT verification and performs its own app-key check. It is diagnostic-only and must not be reused as an owner-authentication endpoint.

## Proposed security model

1. **Independent route:** a separate owner-only page, not embedded in the 3D scene and not linked as a public navigation item.
2. **Real account authentication first:** require a valid Supabase Auth session belonging to the explicitly enrolled owner. The question challenge is an additional factor, never the only factor.
3. **Ten-question enrollment:** questions and answers are entered only on the secured owner page. Never send answers to ChatGPT, GitHub issues, logs, analytics, or client telemetry.
4. **Three random challenges:** select three distinct questions with cryptographically secure randomness for each authorization attempt.
5. **Server-side verification:** normalize answers consistently and verify keyed HMAC-SHA-256 values using a dedicated pepper stored only as a Supabase Edge Function secret. Never store plaintext answers, unkeyed answer hashes, or the pepper in this public repository.
6. **Abuse controls:** server-enforced attempt limits, progressive lockout, generic failure messages, audit events without answers, challenge expiry, and single-use authorization grants bound to a specific action.
7. **Fail closed:** missing owner enrollment, unavailable verifier, expired challenge, invalid session, or backend error must deny authorization.
8. **No silent deployment:** code changes are reviewed in GitHub; production database changes and function deployments remain separate approval steps.

## Bootstrap requirement (must be solved before coding the enrollment flow)

The current static PWA has no sign-in UI, while Supabase already contains accounts. We must not guess which existing account belongs to the owner or create a second owner identity. The first enrollment therefore needs an explicit, administrator-controlled binding between the owner's existing Supabase Auth user and the owner record. The bootstrap credential must be entered only into a private server-side configuration channel and must be single-use; it must never be committed to this public repository.

## Scope and limits

This mechanism can protect owner-only operations that are explicitly routed through the new backend verification service. It cannot, by itself, block direct edits in GitHub, Supabase Dashboard, Render, or other provider consoles. Those provider-level actions need their own account permissions and approval controls.

## Safety gates before implementation

- Confirm the correct deployed ILOX frontend and hosting route; do not assume the static PWA shell is the live multiplayer client.
- Map the existing Auth owner account and current owner/world permissions without exposing account data.
- Review current RLS, grants, private-schema exposure, and existing backup/door-credential functions before any schema change.
- Confirm the bootstrap method and owner identity binding.
- Build and test only on a separate branch / isolated test path first.
- Do not deploy, run migrations, rotate keys, alter RLS, or modify world data as part of this design-only stage.

## Explicit non-actions in this stage

- No questions or answers collected.
- No secrets, hashes, owner IDs, or credentials added to Git.
- No Supabase schema or Edge Function changes.
- No changes to the game world, constructions, backups, door credentials, or existing user accounts.
- No deployment to production.
