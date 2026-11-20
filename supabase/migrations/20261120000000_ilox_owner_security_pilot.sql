-- ILOX v127 owner-security pilot.
-- Review-only migration: do not apply to the live project until the owner identity
-- and deployment plan are explicitly approved.

create table if not exists private.ilox_owner_security (
  owner_user_id uuid primary key,
  answer_verifiers jsonb not null,
  failed_attempts integer not null default 0 check (failed_attempts between 0 and 5),
  locked_until timestamptz,
  enrolled_at timestamptz not null default now(),
  constraint ilox_owner_security_verifiers_object check (jsonb_typeof(answer_verifiers) = 'object')
);

create table if not exists private.ilox_owner_challenges (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references private.ilox_owner_security(owner_user_id) on delete cascade,
  question_ids smallint[] not null check (cardinality(question_ids) = 3),
  target_action text not null check (target_action ~ '^[a-z][a-z0-9_.:-]{2,63}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);

create index if not exists ilox_owner_challenges_owner_created_idx
  on private.ilox_owner_challenges(owner_user_id, created_at desc);

create table if not exists private.ilox_owner_grants (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references private.ilox_owner_security(owner_user_id) on delete cascade,
  target_action text not null check (target_action ~ '^[a-z][a-z0-9_.:-]{2,63}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);

create table if not exists private.ilox_owner_audit (
  id bigint generated always as identity primary key,
  owner_user_id uuid not null,
  event_type text not null check (event_type in ('enrolled','challenge_created','challenge_failed','grant_issued','grant_consumed')),
  target_action text,
  created_at timestamptz not null default now()
);

alter table private.ilox_owner_security enable row level security;
alter table private.ilox_owner_challenges enable row level security;
alter table private.ilox_owner_grants enable row level security;
alter table private.ilox_owner_audit enable row level security;

revoke all on private.ilox_owner_security, private.ilox_owner_challenges,
  private.ilox_owner_grants, private.ilox_owner_audit from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert, update, delete on private.ilox_owner_security,
  private.ilox_owner_challenges, private.ilox_owner_grants, private.ilox_owner_audit to service_role;
grant usage, select on sequence private.ilox_owner_audit_id_seq to service_role;

create or replace function public.ilox_owner_enroll(p_owner_user_id uuid, p_verifiers jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_owner_user_id is null or jsonb_typeof(p_verifiers) <> 'object' then
    raise exception 'invalid_enrollment';
  end if;
  select count(*) into v_count from jsonb_object_keys(p_verifiers);
  if v_count <> 10 then raise exception 'invalid_enrollment'; end if;
  for i in 1..10 loop
    if not (p_verifiers ? i::text)
      or jsonb_typeof(p_verifiers -> i::text) <> 'object'
      or length(coalesce(p_verifiers -> i::text ->> 'question','')) not between 3 and 120
      or length(coalesce(p_verifiers -> i::text ->> 'verifier','')) <> 64 then
      raise exception 'invalid_enrollment';
    end if;
  end loop;
  insert into private.ilox_owner_security(owner_user_id, answer_verifiers)
  values (p_owner_user_id, p_verifiers)
  on conflict (owner_user_id) do nothing;
  if not found then return false; end if;
  insert into private.ilox_owner_audit(owner_user_id,event_type)
  values (p_owner_user_id,'enrolled');
  return true;
end;
$$;

create or replace function public.ilox_owner_get_security(p_owner_user_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'answer_verifiers', answer_verifiers,
    'failed_attempts', failed_attempts,
    'locked_until', locked_until
  )
  from private.ilox_owner_security
  where owner_user_id = p_owner_user_id;
$$;

create or replace function public.ilox_owner_start_challenge(
  p_owner_user_id uuid, p_question_ids smallint[], p_target_action text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_expires timestamptz := now() + interval '5 minutes';
  v_security private.ilox_owner_security%rowtype;
begin
  select * into v_security from private.ilox_owner_security
  where owner_user_id = p_owner_user_id for update;
  if not found then raise exception 'owner_not_enrolled'; end if;
  if v_security.locked_until is not null and v_security.locked_until > now() then
    raise exception 'owner_temporarily_locked';
  end if;
  if p_question_ids is null or cardinality(p_question_ids) <> 3
    or (select count(distinct x) from unnest(p_question_ids) x) <> 3
    or exists(select 1 from unnest(p_question_ids) x where x < 1 or x > 10)
    or p_target_action !~ '^[a-z][a-z0-9_.:-]{2,63}$' then
    raise exception 'invalid_challenge';
  end if;
  insert into private.ilox_owner_challenges(owner_user_id,question_ids,target_action,expires_at)
  values (p_owner_user_id,p_question_ids,p_target_action,v_expires)
  returning id into v_id;
  insert into private.ilox_owner_audit(owner_user_id,event_type,target_action)
  values (p_owner_user_id,'challenge_created',p_target_action);
  return jsonb_build_object('id',v_id,'expires_at',v_expires);
end;
$$;

create or replace function public.ilox_owner_claim_challenge(p_owner_user_id uuid, p_challenge_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_row private.ilox_owner_challenges%rowtype;
begin
  update private.ilox_owner_challenges
  set consumed_at = now()
  where id = p_challenge_id and owner_user_id = p_owner_user_id
    and consumed_at is null and expires_at > now()
  returning * into v_row;
  if not found then return null; end if;
  return jsonb_build_object(
    'question_ids',v_row.question_ids,
    'target_action',v_row.target_action,
    'expires_at',v_row.expires_at
  );
end;
$$;

create or replace function public.ilox_owner_record_failure(p_owner_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_failed integer; v_locked timestamptz;
begin
  update private.ilox_owner_security
  set failed_attempts = case when failed_attempts >= 4 then 0 else failed_attempts + 1 end,
      locked_until = case when failed_attempts >= 4 then now() + interval '15 minutes' else locked_until end
  where owner_user_id = p_owner_user_id
  returning failed_attempts, locked_until into v_failed, v_locked;
  insert into private.ilox_owner_audit(owner_user_id,event_type)
  values (p_owner_user_id,'challenge_failed');
  return jsonb_build_object('failed_attempts',v_failed,'locked_until',v_locked);
end;
$$;

create or replace function public.ilox_owner_issue_grant(p_owner_user_id uuid, p_target_action text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid; v_expires timestamptz := now() + interval '60 seconds';
begin
  if p_target_action !~ '^[a-z][a-z0-9_.:-]{2,63}$' then raise exception 'invalid_action'; end if;
  insert into private.ilox_owner_grants(owner_user_id,target_action,expires_at)
  values (p_owner_user_id,p_target_action,v_expires)
  returning id into v_id;
  insert into private.ilox_owner_audit(owner_user_id,event_type,target_action)
  values (p_owner_user_id,'grant_issued',p_target_action);
  return jsonb_build_object('grant_id',v_id,'expires_at',v_expires);
end;
$$;

create or replace function public.ilox_owner_consume_grant(
  p_owner_user_id uuid, p_grant_id uuid, p_target_action text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  update private.ilox_owner_grants
  set consumed_at = now()
  where id = p_grant_id and owner_user_id = p_owner_user_id
    and target_action = p_target_action and consumed_at is null and expires_at > now()
  returning id into v_id;
  if not found then return false; end if;
  insert into private.ilox_owner_audit(owner_user_id,event_type,target_action)
  values (p_owner_user_id,'grant_consumed',p_target_action);
  return true;
end;
$$;

revoke all on function public.ilox_owner_enroll(uuid,jsonb) from public, anon, authenticated;
revoke all on function public.ilox_owner_get_security(uuid) from public, anon, authenticated;
revoke all on function public.ilox_owner_start_challenge(uuid,smallint[],text) from public, anon, authenticated;
revoke all on function public.ilox_owner_claim_challenge(uuid,uuid) from public, anon, authenticated;
revoke all on function public.ilox_owner_record_failure(uuid) from public, anon, authenticated;
revoke all on function public.ilox_owner_issue_grant(uuid,text) from public, anon, authenticated;
revoke all on function public.ilox_owner_consume_grant(uuid,uuid,text) from public, anon, authenticated;

grant execute on function public.ilox_owner_enroll(uuid,jsonb) to service_role;
grant execute on function public.ilox_owner_get_security(uuid) to service_role;
grant execute on function public.ilox_owner_start_challenge(uuid,smallint[],text) to service_role;
grant execute on function public.ilox_owner_claim_challenge(uuid,uuid) to service_role;
grant execute on function public.ilox_owner_record_failure(uuid) to service_role;
grant execute on function public.ilox_owner_issue_grant(uuid,text) to service_role;
grant execute on function public.ilox_owner_consume_grant(uuid,uuid,text) to service_role;
