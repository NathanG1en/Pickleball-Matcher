create table if not exists tournaments (
  id text primary key,
  group_id text not null references groups(id) on delete cascade,
  name text not null,
  status text not null default 'active' check (status in ('draft', 'active', 'completed')),
  divisions jsonb not null default '[]'::jsonb,
  brackets jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tournaments_group_id_idx on tournaments(group_id);

alter table tournaments enable row level security;
grant select, insert, update, delete on tournaments to anon;

