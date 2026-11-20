# ILOX — Owner Key Pilot (design and discovery)

**Status:** documentation only; not deployed; no production code or database objects changed.

## Goal

Prepare an independent owner-security page for the ILOX pilot without changing the game scene, world content, construction data, existing accounts, or the PDA / Choferes Argentinos projects.

## Verified deployment architecture

The repository's GitHub Pages workflow builds and publishes multiple independent routes:
- Root `/`: stable Island world.
- `/forest/`: third-person Forest preview, built from a separate experimental branch.
- `/ilox/`: static World Hub PWA, also copied from a separate experimental branch.

The `ilox-pwa/README.md` explicitly says its inventory, friends/multiplayer, and construction areas are not connected to server accounts or cloud saves. The root `README.md` likewise says the initial version does not implement accounts, family authorization, multiplayer, or private saves.

Repository code search did not find Supabase client initialization or references to the multiplayer tables. Therefore, the Supabase multiplayer database currently cannot be assumed to be wired to any of these published frontends. The owner page must not be inserted into the World Hub or 3D game until the actual live multiplayer client and its deployment path are identified.

## Verified Supabase state

- The project has existing Auth users and existing multiplayer/world records. Treat all as production data.
- `public.multiplayer_worlds`, `public.multiplayer_world_members`, `public.multiplayer_structures`, and related tables contain existing records.
- `private.ilox_world_backups` has RLS disabled. Direct table privileges for `anon` and `authenticated` were checked and are false; this is not evidence of public access through those roles. Do not auto-enable RLS: doing so without appropriate policies could break service access.
- `public.multiplayer_delete_world(uuid)` is SECURITY DEFINER and executable by anon and authenticated roles, but its body rejects missing `auth.uid()` and checks that the caller owns the specified world before deleting. Review this separately; do not change it as part of owner-key installation.
- Existing door credentials are stored in `private.multiplayer_door_credentials`; never reuse or alter this table for owner-key secrets.
- Existing diagnostic Edge Function `ilox-error-report` is not an authentication endpoint and must not be repurposed.

## Proposed security model

1. **Independent route:** a separate owner-only page, not embedded in the 3D scene and not linked as public navigation.
2. **Real account authentication first:** require a valid Supabase Auth session belonging to the explicitly enrolled owner. The question challenge is an additional factor, never the only factor.
3. **Ten-question enrollment:** questions and answers are entered only on the secured owner page. Never send answers to ChatGPT, GitHub issues, logs, analytics, or client telemetry.
4. **Three random challenges:** select three distinct questions with cryptographically secure randomness for each authorization attempt.
5. **Server-side verification:** normalize answers consistently and verify keyed HMAC-SHA-256 values using a dedicated pepper stored only as a Supabase Edge Function secret. Never store plaintext answers, unkeyed answer hashes, or the pepper in this public repository.
6. **Abuse controls:** server-enforced attempt limits, progressive lockout, generic failure messages, audit events without answers, challenge expiry, and single-use authorization grants bound to a specific action.
7. **Fail closed:** missing owner enrollment, unavailable verifier, expired challenge, invalid session, or backend error must deny authorization.
8. **No silent deployment:** code changes are reviewed in GitHub; production database changes and function deployments remain separate approval steps.

## Bootstrap requirement (must be solved before coding enrollment)

The published static frontends do not currently expose an owner sign-in flow. Supabase already contains accounts, but we must not guess which account belongs to the owner or create a second owner identity. First enrollment needs an explicit, administrator-controlled binding between the owner's existing Supabase Auth user and the owner record. The bootstrap credential must be entered only through a private server-side configuration channel, be single-use, and never be committed to this public repository.

## Scope and limits

This mechanism can protect owner-only operations explicitly routed through the new backend verification service. It cannot, by itself, block direct edits in GitHub, Supabase Dashboard, or provider consoles. Those provider-level actions need their own account permissions and approval controls.

## Safety gates before implementation

- Identify the actual live multiplayer client and its hosting/deployment route. The repo's Pages routes above do not establish which app the user currently plays.
- Map the intended owner account and world permissions without exposing account data or guessing from email/name.
- Review RLS, grants, private-schema exposure, and existing backup/door-credential functions before schema changes.
- Confirm a safe bootstrap method and explicit owner identity binding.
- Build and test only on a separate branch / isolated test path first.
- Do not deploy, run migrations, rotate keys, alter RLS, or modify world data as part of this documentation stage.

## Explicit non-actions in this stage

- No questions or answers collected.
- No secrets, hashes, owner IDs, or credentials added to Git.
- No Supabase schema or Edge Function changes.
- No changes to the game world, constructions, backups, door credentials, or existing user accounts.
- No production deployment.
