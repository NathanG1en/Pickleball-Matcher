alter table sessions
  add column if not exists court_player_counts integer[] not null default '{}'::integer[];

alter table matches
  add column if not exists rated boolean not null default true;
