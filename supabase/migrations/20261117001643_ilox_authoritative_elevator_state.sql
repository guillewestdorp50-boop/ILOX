create table if not exists public.multiplayer_elevator_states (
  structure_id uuid primary key references public.multiplayer_structures(id) on delete cascade,
  world_id uuid not null references public.multiplayer_worlds(id) on delete cascade,
  current_floor integer not null default 1 check (current_floor between 1 and 40),
  target_floor integer not null default 1 check (target_floor between 1 and 40),
  moving boolean not null default false,
  travel_started_at timestamptz,
  travel_duration_ms integer not null default 0 check (travel_duration_ms between 0 and 3600000),
  door_open boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists multiplayer_elevator_states_world_idx
  on public.multiplayer_elevator_states(world_id);

create or replace function private.validate_multiplayer_elevator_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.multiplayer_structures s
    where s.id = new.structure_id
      and s.world_id = new.world_id
      and s.kind = 'elevator'
  ) then
    raise exception 'Elevator state must reference an elevator in the same world';
  end if;
  if new.moving and (new.travel_started_at is null or new.travel_duration_ms < 1 or new.target_floor = new.current_floor) then
    raise exception 'Moving elevator requires a valid travel interval and distinct floors';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_multiplayer_elevator_state on public.multiplayer_elevator_states;
create trigger validate_multiplayer_elevator_state
before insert or update on public.multiplayer_elevator_states
for each row execute function private.validate_multiplayer_elevator_state();

alter table public.multiplayer_elevator_states enable row level security;

drop policy if exists "world members can read elevator state" on public.multiplayer_elevator_states;
create policy "world members can read elevator state"
on public.multiplayer_elevator_states for select
to authenticated
using (private.is_world_member(world_id));

drop policy if exists "world members can create elevator state" on public.multiplayer_elevator_states;
create policy "world members can create elevator state"
on public.multiplayer_elevator_states for insert
to authenticated
with check (private.is_world_member(world_id));

drop policy if exists "world members can update elevator state" on public.multiplayer_elevator_states;
create policy "world members can update elevator state"
on public.multiplayer_elevator_states for update
to authenticated
using (private.is_world_member(world_id))
with check (private.is_world_member(world_id));

drop policy if exists "world members can delete elevator state" on public.multiplayer_elevator_states;
create policy "world members can delete elevator state"
on public.multiplayer_elevator_states for delete
to authenticated
using (private.is_world_member(world_id));

grant select, insert, update, delete on public.multiplayer_elevator_states to authenticated;
