-- Intentionally unconfigured: the owner must bind this database and register
-- the two personal, SQL-created login roles before the maintenance CLI can run.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'pickleball_rating_maintenance') then
    create role pickleball_rating_maintenance nologin;
  end if;
end $$;

create table rating_maintenance_target (
  singleton boolean primary key default true check (singleton),
  environment text not null check (environment in ('test', 'production')),
  database_host text not null check (length(database_host) > 0),
  database_port integer not null default 5432 check (database_port between 1 and 65535),
  database_name text not null check (length(database_name) > 0)
);

create table rating_maintenance_operators (
  slot smallint primary key check (slot in (1, 2)),
  database_role name not null unique,
  display_name text not null check (length(trim(display_name)) > 0)
);

create table rating_correction_audit (
  id text primary key,
  performed_at timestamptz not null default clock_timestamp(),
  actor name not null default session_user check (actor = session_user),
  environment text not null check (environment in ('test', 'production')),
  account_id text not null,
  username text not null,
  old_starting_elo double precision not null,
  new_starting_elo double precision not null,
  reason text not null check (length(trim(reason)) between 1 and 500),
  report jsonb not null
);

revoke all on rating_maintenance_target, rating_maintenance_operators, rating_correction_audit from public;
grant usage on schema public to pickleball_rating_maintenance;
grant select on rating_maintenance_target, rating_maintenance_operators, rating_correction_audit to pickleball_rating_maintenance;
grant insert on rating_correction_audit to pickleball_rating_maintenance;
grant select (id, username, name, gender, initial_rating, rating, rated_games_played) on player_accounts to pickleball_rating_maintenance;
grant select on players, matches, match_players, rounds, sessions to pickleball_rating_maintenance;
grant update (initial_rating, rating, rated_games_played) on player_accounts, players to pickleball_rating_maintenance;
grant update (rating_before, rating_after) on match_players to pickleball_rating_maintenance;

-- Existing app tables have RLS enabled. Group membership alone must not allow
-- an unregistered third login to bypass the CLI by issuing SQL directly.
do $$
declare relation text;
begin
  foreach relation in array array['player_accounts', 'players', 'matches', 'match_players', 'rounds', 'sessions'] loop
    execute format('create policy rating_maintenance_read on public.%I for select to pickleball_rating_maintenance using (exists (select 1 from public.rating_maintenance_operators where database_role = session_user))', relation);
  end loop;
  foreach relation in array array['player_accounts', 'players', 'match_players'] loop
    execute format('create policy rating_maintenance_update on public.%I for update to pickleball_rating_maintenance using (exists (select 1 from public.rating_maintenance_operators where database_role = session_user)) with check (exists (select 1 from public.rating_maintenance_operators where database_role = session_user))', relation);
  end loop;
end $$;

alter table rating_correction_audit enable row level security;
create policy rating_maintenance_audit_read on rating_correction_audit for select to pickleball_rating_maintenance
  using (exists (select 1 from rating_maintenance_operators where database_role = session_user));
create policy rating_maintenance_audit_insert on rating_correction_audit for insert to pickleball_rating_maintenance
  with check (actor = session_user and exists (select 1 from rating_maintenance_operators where database_role = session_user));

-- Column-only UPDATE grants cannot lock all replay input tables. This narrowly
-- scoped owner function takes only fixed locks; it never accepts SQL or a target.
-- Include plain readers so older deployed guest-link code cannot retain a stale
-- baseline across a correction, even before the app's row-lock update ships.
create function lock_rating_maintenance_history() returns void
language plpgsql security definer set search_path = pg_catalog
as $$
begin
  if not exists (select 1 from public.rating_maintenance_operators where database_role = session_user)
     or not pg_has_role(session_user, 'pickleball_rating_maintenance', 'MEMBER') then
    raise exception 'Maintenance login is not authorized' using errcode = '42501';
  end if;
  lock table public.player_accounts, public.players, public.matches,
    public.match_players, public.rounds, public.sessions,
    public.rating_maintenance_target, public.rating_maintenance_operators
    in access exclusive mode nowait;
end $$;
revoke all on function lock_rating_maintenance_history() from public;
grant execute on function lock_rating_maintenance_history() to pickleball_rating_maintenance;
