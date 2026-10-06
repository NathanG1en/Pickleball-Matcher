create table groups (
  id text primary key,
  name text not null check (length(trim(name)) > 0),
  organizer_pin_hash text not null,
  public_share_id text not null unique,
  created_at timestamptz not null default now()
);

create table players (
  id text primary key,
  group_id text not null references groups(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  initial_rating double precision not null default 1000,
  rating double precision not null default 1000,
  rated_games_played integer not null default 0 check (rated_games_played >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index players_group_id_idx on players(group_id);

create table sessions (
  id text primary key,
  group_id text not null references groups(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  court_count integer not null check (court_count > 0),
  status text not null check (status in ('active', 'completed')),
  current_round_number integer not null default 0 check (current_round_number >= 0),
  version integer not null default 1 check (version > 0)
);
create index sessions_group_id_idx on sessions(group_id);

create table session_attendance (
  session_id text not null references sessions(id) on delete cascade,
  player_id text not null references players(id) on delete cascade,
  joined_round integer not null check (joined_round >= 1),
  left_round integer check (left_round is null or left_round >= joined_round),
  primary key (session_id, player_id)
);

create table rounds (
  id text primary key,
  session_id text not null references sessions(id) on delete cascade,
  round_number integer not null check (round_number >= 1),
  status text not null check (status in ('started', 'completed', 'cancelled')),
  seed bigint not null,
  score_breakdown jsonb not null,
  created_at timestamptz not null default now(),
  started_at timestamptz not null,
  completed_at timestamptz,
  version integer not null default 1 check (version > 0),
  unique (session_id, round_number)
);
create index rounds_session_id_idx on rounds(session_id);

create table matches (
  id text primary key,
  round_id text not null references rounds(id) on delete cascade,
  court_number integer not null check (court_number >= 1),
  status text not null check (status in ('pending', 'completed', 'cancelled')),
  team1_score integer check (team1_score is null or team1_score >= 0),
  team2_score integer check (team2_score is null or team2_score >= 0),
  completed_at timestamptz,
  version integer not null default 1 check (version > 0),
  unique (round_id, court_number),
  check (
    status <> 'completed'
    or (
      team1_score is not null
      and team2_score is not null
      and team1_score <> team2_score
      and completed_at is not null
    )
  ),
  check (status <> 'cancelled' or (team1_score is null and team2_score is null))
);
create index matches_round_id_idx on matches(round_id);

create table match_players (
  match_id text not null references matches(id) on delete cascade,
  player_id text not null references players(id) on delete restrict,
  team smallint not null check (team in (1, 2)),
  rating_before double precision,
  rating_after double precision,
  primary key (match_id, player_id)
);
create index match_players_player_id_idx on match_players(player_id);

create table round_sits (
  round_id text not null references rounds(id) on delete cascade,
  player_id text not null references players(id) on delete restrict,
  primary key (round_id, player_id)
);

create table idempotency_keys (
  group_id text not null references groups(id) on delete cascade,
  key text not null,
  result jsonb not null default '{}',
  created_at timestamptz not null default now(),
  primary key (group_id, key)
);

alter table groups enable row level security;
alter table players enable row level security;
alter table sessions enable row level security;
alter table session_attendance enable row level security;
alter table rounds enable row level security;
alter table matches enable row level security;
alter table match_players enable row level security;
alter table round_sits enable row level security;
alter table idempotency_keys enable row level security;

grant usage on schema public to anon;
grant select, insert, update, delete on all tables in schema public to anon;
