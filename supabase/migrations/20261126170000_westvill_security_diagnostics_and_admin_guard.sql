-- WEST-VILL: private security diagnostics, password reset tokens, and protected admin identities.
create table if not exists public.westvill_security_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  action text not null check (action in ('login','register','bootstrap-admin','create-invite','password-reset-create','password-reset-complete','role-escalation')),
  role text,
  outcome text not null check (outcome in ('success','failure','blocked')),
  reason_code text,
  client_id uuid,
  app_version text,
  request_id uuid not null default gen_random_uuid()
);
create index if not exists westvill_security_events_client_action_time_idx
  on public.westvill_security_events (client_id, action, created_at desc);
create index if not exists westvill_security_events_created_at_idx
  on public.westvill_security_events (created_at desc);
alter table public.westvill_security_events enable row level security;
revoke all on public.westvill_security_events from anon, authenticated;
grant all on public.westvill_security_events to service_role;

create table if not exists public.westvill_password_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null unique,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);
create index if not exists westvill_password_resets_user_time_idx
  on public.westvill_password_resets (user_id, created_at desc);
alter table public.westvill_password_resets enable row level security;
revoke all on public.westvill_password_resets from anon, authenticated;
grant all on public.westvill_password_resets to service_role;

create or replace function public.westvill_guard_admin_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed_username text;
begin
  allowed_username := lower(trim(coalesce(new.username, '')));
  if tg_op = 'UPDATE' and old.role = 'admin' then
    if new.role <> 'admin' or allowed_username not in ('westdorp','sole_villalba99') then
      raise exception 'No se puede modificar la identidad de una cuenta administrativa protegida.';
    end if;
  end if;
  if new.role = 'admin' and allowed_username not in ('westdorp','sole_villalba99') then
    raise exception 'No está autorizada la creación de nuevas cuentas administrativas.';
  end if;
  return new;
end;
$$;
drop trigger if exists westvill_profiles_admin_guard on public.westvill_profiles;
create trigger westvill_profiles_admin_guard
before insert or update of role, username on public.westvill_profiles
for each row execute function public.westvill_guard_admin_role();
