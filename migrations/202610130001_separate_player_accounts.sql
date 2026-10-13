-- Separate player_accounts and players into distinct tables.
-- player_accounts: holds global authentication credentials, profile information, and account rating.
-- players: holds group-specific roster memberships, ratings, active flags, and session/match links.

create table if not exists player_accounts (
  id text primary key,
  username text not null unique check (username = lower(username)),
  name text not null check (length(trim(name)) > 0),
  gender text check (gender is null or gender in ('male', 'female')),
  is_public boolean not null default true,
  password_hash text not null,
  skill_level text not null check (skill_level in ('beginner', 'intermediate', 'advanced')),
  initial_rating double precision not null check (initial_rating between 100 and 3000),
  rating double precision not null default 1000,
  rated_games_played integer not null default 0 check (rated_games_played >= 0),
  created_at timestamptz not null default now()
);

create unique index if not exists player_accounts_username_unique_idx
  on player_accounts(username);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'players' and column_name = 'username'
  ) then
    insert into player_accounts (
      id, username, name, gender, is_public, password_hash, skill_level,
      initial_rating, rating, rated_games_played, created_at
    )
    select
      id, username, name, gender, coalesce(is_public, true), password_hash, skill_level,
      initial_rating, rating, rated_games_played, created_at
    from players
    where username is not null
    on conflict (id) do update set
      username = excluded.username,
      name = excluded.name,
      gender = excluded.gender,
      is_public = excluded.is_public,
      password_hash = excluded.password_hash,
      skill_level = excluded.skill_level,
      initial_rating = excluded.initial_rating,
      rating = excluded.rating,
      rated_games_played = excluded.rated_games_played;
  end if;
end
$$;

-- Foreign key on groups.owner_account_id -> player_accounts(id)
do $$
declare
  fk_name text;
begin
  select conname into fk_name
  from pg_constraint
  where conrelid = 'public.groups'::regclass and contype = 'f'
    and conkey = array[(select attnum from pg_attribute
      where attrelid = 'public.groups'::regclass and attname = 'owner_account_id')]::smallint[]
  limit 1;
  if fk_name is not null then
    execute format('alter table groups drop constraint %I', fk_name);
  end if;
  alter table groups add constraint groups_owner_account_id_fkey
    foreign key (owner_account_id) references player_accounts(id) on delete set null;
end
$$;

-- Foreign key on group_organizers.account_id -> player_accounts(id)
do $$
declare
  fk_name text;
begin
  select conname into fk_name
  from pg_constraint
  where conrelid = 'public.group_organizers'::regclass and contype = 'f'
    and conkey = array[(select attnum from pg_attribute
      where attrelid = 'public.group_organizers'::regclass and attname = 'account_id')]::smallint[]
  limit 1;
  if fk_name is not null then
    execute format('alter table group_organizers drop constraint %I', fk_name);
  end if;
  alter table group_organizers add constraint group_organizers_account_id_fkey
    foreign key (account_id) references player_accounts(id) on delete cascade;
end
$$;

-- Foreign key on player_synergy -> player_accounts(id)
do $$
declare
  fk_name text;
begin
  if to_regclass('public.player_synergy') is not null then
    for fk_name in (
      select conname
      from pg_constraint
      where conrelid = 'public.player_synergy'::regclass and contype = 'f'
    ) loop
      execute format('alter table player_synergy drop constraint %I', fk_name);
    end loop;

    alter table player_synergy add constraint player_synergy_account_id_1_fkey
      foreign key (account_id_1) references player_accounts(id) on delete cascade;
    alter table player_synergy add constraint player_synergy_account_id_2_fkey
      foreign key (account_id_2) references player_accounts(id) on delete cascade;
  end if;
end
$$;

-- Foreign key on players.account_id -> player_accounts(id)
do $$
declare
  fk_name text;
begin
  select conname into fk_name
  from pg_constraint
  where conrelid = 'public.players'::regclass and contype = 'f'
    and conkey = array[(select attnum from pg_attribute
      where attrelid = 'public.players'::regclass and attname = 'account_id')]::smallint[]
  limit 1;
  if fk_name is not null then
    execute format('alter table players drop constraint %I', fk_name);
  end if;
  alter table players add constraint players_account_id_fkey
    foreign key (account_id) references player_accounts(id) on delete set null;
end
$$;

-- Delete standalone account rows from players table
delete from players where group_id is null;

-- Ensure group_id is not null on players
alter table players alter column group_id set not null;

-- Drop obsolete constraints and columns on players
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'players_account_credentials_check') then
    alter table players drop constraint players_account_credentials_check;
  end if;
  if exists (select 1 from pg_constraint where conname = 'players_skill_level_check') then
    alter table players drop constraint players_skill_level_check;
  end if;

  drop index if exists players_username_unique_idx;
  drop index if exists players_username_case_insensitive_unique_idx;

  if exists (select 1 from information_schema.columns where table_name = 'players' and column_name = 'username') then
    alter table players drop column username;
  end if;
  if exists (select 1 from information_schema.columns where table_name = 'players' and column_name = 'password_hash') then
    alter table players drop column password_hash;
  end if;
  if exists (select 1 from information_schema.columns where table_name = 'players' and column_name = 'skill_level') then
    alter table players drop column skill_level;
  end if;
  if exists (select 1 from information_schema.columns where table_name = 'players' and column_name = 'is_public') then
    alter table players drop column is_public;
  end if;
end
$$;

alter table player_accounts enable row level security;
grant select, insert, update, delete on player_accounts to anon;
