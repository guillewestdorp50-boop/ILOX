update public.westvill_tariff_config
set distance_bands = '[{"id":"etruria-villa-maria-60","km_min":60,"km_max":60,"one_way_price":70000,"round_trip_price":80000}]'::jsonb,
    updated_at = now()
where id = 1
  and distance_bands = '[]'::jsonb;
