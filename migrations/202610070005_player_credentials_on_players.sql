alter table players alter column group_id drop not null;
alter table players add column if not exists account_id text;
alter table players add column if not exists username text;
alter table players add column if not exists password_hash text;
alter table players add column if not exists skill_level text;

do $$
declare
  account_fk text;
begin
  -- Preserve accounts created by the earlier player_accounts migration by
  -- moving each account to its own standalone players row.
  if to_regclass('public.player_accounts') is not null then
    execute $sql$
      insert into players (id, group_id, name, initial_rating, rating,
        rated_games_played, active, username, password_hash, skill_level, created_at)
      select id, null, name, initial_rating, initial_rating, 0, true,
        username, password_hash, skill_level, created_at
      from player_accounts
      on conflict (id) do update set username = excluded.username,
        password_hash = excluded.password_hash, skill_level = excluded.skill_level
    $sql$;

    select conname into account_fk
    from pg_constraint
    where conrelid = 'public.players'::regclass and contype = 'f'
      and conkey = array[(select attnum from pg_attribute
        where attrelid = 'public.players'::regclass and attname = 'account_id')]::smallint[]
    limit 1;
    if account_fk is not null then
      execute format('alter table players drop constraint %I', account_fk);
    end if;
    execute 'drop table player_accounts';
  end if;
end
$$;

do $$
declare
  account_fk text;
begin
  select conname into account_fk
  from pg_constraint
  where conrelid = 'public.players'::regclass and contype = 'f'
    and conkey = array[(select attnum from pg_attribute
      where attrelid = 'public.players'::regclass and attname = 'account_id')]::smallint[]
  limit 1;
  if account_fk is not null then
    execute format('alter table players drop constraint %I', account_fk);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.players'::regclass and conname = 'players_account_id_fkey'
  ) then
    alter table players add constraint players_account_id_fkey
      foreign key (account_id) references players(id) on delete set null;
  end if;
end
$$;

create unique index if not exists players_username_unique_idx
  on players(username) where username is not null;
create unique index if not exists players_group_account_unique_idx
  on players(group_id, account_id) where account_id is not null;
create index if not exists players_account_id_idx on players(account_id);
alter table players add constraint players_skill_level_check
  check (skill_level is null or skill_level in ('beginner', 'intermediate', 'advanced'));
alter table players add constraint players_account_credentials_check
  check ((username is null and password_hash is null and skill_level is null)
    or (username is not null and password_hash is not null and skill_level is not null));
