# ILOX World Authority — protocol v2

Isolated Node.js WebSocket service for authenticated, per-world sessions. It does not replace the static PWA or modify saved construction records.

## Runtime configuration

- `PORT`: supplied by Render.
- `SUPABASE_URL`: existing Supabase project URL.
- `SUPABASE_PUBLISHABLE_KEY`: existing publishable key (never a service-role key).

## Endpoints

- `GET /health`: process health and active room/socket counts.
- `WSS /world`: authenticated world session. First frame: `{ "type":"auth", "accessToken":"...", "worldId":"..." }`.

The service validates the access token through Supabase Auth, checks membership in `multiplayer_world_members` with that user's token/RLS, and loads only elevator structures and their persisted runtime state from the same world.

## Authoritative elevator protocol

- `elevator:passenger`: `{ elevatorId, joined }`. The first passenger becomes captain; captain transfers to the earliest remaining passenger after exit/disconnect.
- `elevator:call`: `{ elevatorId, targetFloor }`. A nearby client may call an idle elevator; the server validates the floor and persists the trip before broadcasting it.
- `elevator:travel`: `{ elevatorId, targetFloor }`. Only the elected cabin captain can choose a destination while occupied.
- `elevator:door`: `{ elevatorId, open }`. Server rejects door changes during travel and restricts occupied-cabin controls to the captain.
- `elevator:pause`: `{ elevatorId, startedAt }`. Only the elected controller can report a collision pause; the server validates and persists the revised trip clock, then rebroadcasts it.
- The server broadcasts one shared travel start, pause, arrival, passenger roster, and door state for each stable structure ID.

Runtime state is stored separately in `public.multiplayer_elevator_states`, with RLS restricted to members of the associated world. The existing `multiplayer_structures` rows and saved construction payloads are not rewritten. The migration is recorded in `supabase/migrations/20261117001643_ilox_authoritative_elevator_state.sql`.

## Current limits

- One Render instance, one in-memory room authority per world. Durable elevator state is restored from Supabase after process restarts.
- The elected captain's client performs the existing local swept-collision check and reports pauses to the server. The server owns the trip clock, floor transitions, permissions, and persisted state. Moving collision validation fully onto the server is a later stage.
- This service is a first multiplayer authority, not a claim of million-user capacity. Multi-instance scaling requires shared state/pub-sub and room ownership before increasing instance count.
- The static PWA keeps existing player presence, chat, and construction synchronization. Only elevator control is moved to this service in this stage.

Run `npm test` for the WebSocket framing test.
