alter table groups
  add column if not exists owner_account_id text references players(id) on delete set null;

create index if not exists groups_owner_account_id_idx
  on groups(owner_account_id) where owner_account_id is not null;

create table if not exists group_organizers (
  group_id text not null references groups(id) on delete cascade,
  account_id text not null references players(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, account_id)
);

alter table group_organizers enable row level security;
grant select, insert, update, delete on group_organizers to anon;
