-- Add is_public column to players table (defaults to true)
alter table players
  add column if not exists is_public boolean not null default true;

-- Create canonical pairwise synergy table
create table if not exists player_synergy (
  account_id_1 text not null references players(id) on delete cascade,
  account_id_2 text not null references players(id) on delete cascade,
  matches_played integer not null default 0 check (matches_played >= 0),
  wins integer not null default 0 check (wins >= 0 and wins <= matches_played),
  synergy_score integer not null default 50 check (synergy_score between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (account_id_1, account_id_2),
  check (account_id_1 < account_id_2)
);

create index if not exists player_synergy_account_2_idx
  on player_synergy (account_id_2);

alter table player_synergy enable row level security;
grant select, insert, update, delete on player_synergy to anon;
