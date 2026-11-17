# ILOX World Authority — protocol v1

Isolated Node.js WebSocket service for authenticated, per-world sessions. It does not replace the static PWA or modify saved Supabase records.

## Runtime configuration

- `PORT`: supplied by Render.
- `SUPABASE_URL`: existing Supabase project URL.
- `SUPABASE_PUBLISHABLE_KEY`: existing publishable key (never a service-role key).

## Endpoints

- `GET /health`: process health.
- `WSS /world`: authenticated world session. First frame: `{ "type":"auth", "accessToken":"...", "worldId":"..." }`.

The service validates the access token through Supabase Auth and checks membership in `multiplayer_world_members` using that user's token/RLS. It loads only elevator structure IDs belonging to that world.

## Elevator protocol

- `elevator:passenger`: `{ elevatorId, joined }`. The first passenger becomes captain; captain transfers to the earliest remaining passenger after exit/disconnect.
- `elevator:travel`: `{ elevatorId, targetFloor }`. Only the captain can request a valid floor while idle. Server broadcasts one shared start time/duration and a single arrival event.
- `elevator:door`: `{ elevatorId, open }`. Server rejects door changes during travel and restricts occupied-cabin controls to the captain.

## Limits of this first revision

This revision is an isolated authority endpoint; the PWA is not connected yet, so current gameplay continues unchanged. Room state is in process memory and the service is designed to run as one instance. On restart, active rooms are reconstructed from saved structure records. Multi-instance scaling requires shared state/pub-sub and reconnect handling before enabling additional instances.

Run `npm test` for automated checks.
