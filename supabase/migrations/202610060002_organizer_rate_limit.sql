create table organizer_login_attempts (
  group_id text not null check (length(group_id) between 1 and 128),
  fingerprint_hash text not null check (fingerprint_hash ~ '^[a-f0-9]{64}$'),
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  window_started_at timestamptz not null,
  locked_until timestamptz,
  updated_at timestamptz not null,
  primary key (group_id, fingerprint_hash)
);

alter table organizer_login_attempts enable row level security;
grant select, insert, update, delete on organizer_login_attempts to anon;

create or replace function check_organizer_rate_limit(
  p_group_id text,
  p_fingerprint_hash text,
  p_outcome text,
  p_now timestamptz default now(),
  p_max_attempts integer default 5,
  p_window_seconds integer default 900,
  p_lock_seconds integer default 900
)
returns table (
  allowed boolean,
  remaining_attempts integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_failed_attempts integer;
  v_window_started_at timestamptz;
  v_locked_until timestamptz;
begin
  if p_group_id is null or length(p_group_id) not between 1 and 128 then
    raise exception 'invalid group identifier';
  end if;
  if p_fingerprint_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid fingerprint hash';
  end if;
  if p_outcome not in ('check', 'failure', 'success') then
    raise exception 'invalid rate-limit outcome';
  end if;
  if p_max_attempts not between 1 and 100
    or p_window_seconds not between 1 and 86400
    or p_lock_seconds not between 1 and 86400 then
    raise exception 'invalid rate-limit configuration';
  end if;

  if p_outcome = 'success' then
    delete from organizer_login_attempts
    where group_id = p_group_id and fingerprint_hash = p_fingerprint_hash;
    return query select true, p_max_attempts, 0;
    return;
  end if;

  insert into organizer_login_attempts (
    group_id,
    fingerprint_hash,
    failed_attempts,
    window_started_at,
    locked_until,
    updated_at
  ) values (
    p_group_id,
    p_fingerprint_hash,
    0,
    p_now,
    null,
    p_now
  ) on conflict (group_id, fingerprint_hash) do nothing;

  select attempts.failed_attempts, attempts.window_started_at, attempts.locked_until
  into v_failed_attempts, v_window_started_at, v_locked_until
  from organizer_login_attempts as attempts
  where attempts.group_id = p_group_id
    and attempts.fingerprint_hash = p_fingerprint_hash
  for update;

  if v_locked_until is not null and v_locked_until > p_now then
    return query select
      false,
      0,
      greatest(1, ceil(extract(epoch from (v_locked_until - p_now)))::integer);
    return;
  end if;

  if p_now >= v_window_started_at + make_interval(secs => p_window_seconds) then
    v_failed_attempts := 0;
    v_window_started_at := p_now;
    v_locked_until := null;
  end if;

  if p_outcome = 'failure' then
    v_failed_attempts := v_failed_attempts + 1;
    if v_failed_attempts >= p_max_attempts then
      v_locked_until := p_now + make_interval(secs => p_lock_seconds);
    end if;
  end if;

  update organizer_login_attempts
  set failed_attempts = v_failed_attempts,
      window_started_at = v_window_started_at,
      locked_until = v_locked_until,
      updated_at = p_now
  where group_id = p_group_id and fingerprint_hash = p_fingerprint_hash;

  return query select
    v_locked_until is null,
    greatest(0, p_max_attempts - v_failed_attempts),
    case
      when v_locked_until is null then 0
      else greatest(1, ceil(extract(epoch from (v_locked_until - p_now)))::integer)
    end;
end;
$$;

revoke all on function check_organizer_rate_limit(
  text, text, text, timestamptz, integer, integer, integer
) from public;
