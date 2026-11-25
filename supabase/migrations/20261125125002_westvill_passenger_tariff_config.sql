create table if not exists public.westvill_tariff_config (
  id smallint primary key check (id = 1),
  distance_bands jsonb not null default '[]'::jsonb
    check (jsonb_typeof(distance_bands) = 'array'),
  free_wait_hours numeric(5,2) not null default 1
    check (free_wait_hours >= 0 and free_wait_hours <= 24),
  wait_hour_price numeric(12,2) not null default 10000
    check (wait_hour_price >= 0),
  updated_by uuid references public.westvill_profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.westvill_tariff_config enable row level security;

revoke all on public.westvill_tariff_config from anon;
grant select, insert, update on public.westvill_tariff_config to authenticated;
grant all on public.westvill_tariff_config to service_role;

drop policy if exists westvill_tariff_read_admin_passenger on public.westvill_tariff_config;
create policy westvill_tariff_read_admin_passenger
on public.westvill_tariff_config
for select
to authenticated
using (
  exists (
    select 1 from public.westvill_profiles p
    where p.id = (select auth.uid())
      and p.role in ('admin', 'pasajero')
  )
);

drop policy if exists westvill_tariff_insert_admin on public.westvill_tariff_config;
create policy westvill_tariff_insert_admin
on public.westvill_tariff_config
for insert
to authenticated
with check (public.westvill_is_admin());

drop policy if exists westvill_tariff_update_admin on public.westvill_tariff_config;
create policy westvill_tariff_update_admin
on public.westvill_tariff_config
for update
to authenticated
using (public.westvill_is_admin())
with check (public.westvill_is_admin());

insert into public.westvill_tariff_config (id, distance_bands, free_wait_hours, wait_hour_price)
values (1, '[]'::jsonb, 1, 10000)
on conflict (id) do nothing;
