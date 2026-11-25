revoke all on public.westvill_tariff_config from anon, authenticated;
grant select, insert, update on public.westvill_tariff_config to authenticated;
grant all on public.westvill_tariff_config to service_role;
