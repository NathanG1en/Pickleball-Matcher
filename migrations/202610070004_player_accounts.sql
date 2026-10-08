create table player_accounts (
  id text primary key,
  username text not null unique check (username = lower(username)),
  name text not null check (length(trim(name)) > 0),
  password_hash text not null,
  skill_level text not null check (skill_level in ('beginner', 'intermediate', 'advanced')),
  initial_rating double precision not null check (initial_rating between 100 and 3000),
  created_at timestamptz not null default now()
);

alter table players
  add column account_id text references player_accounts(id) on delete set null;

create unique index players_group_account_unique_idx
  on players(group_id, account_id)
  where account_id is not null;

create index players_account_id_idx on players(account_id);
