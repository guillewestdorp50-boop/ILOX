create or replace function public.westvill_guard_admin_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed_username text;
begin
  allowed_username := trim(coalesce(new.username, ''));
  if tg_op = 'UPDATE' and old.role = 'admin' then
    if new.role <> 'admin'
       or new.username is distinct from allowed_username
       or allowed_username not in ('westdorp','sole_villalba99') then
      raise exception 'No se puede modificar la identidad de una cuenta administrativa protegida.';
    end if;
  end if;
  if new.role = 'admin'
     and (new.username is distinct from allowed_username
       or allowed_username not in ('westdorp','sole_villalba99')) then
    raise exception 'No está autorizada la creación de nuevas cuentas administrativas.';
  end if;
  return new;
end;
$$;