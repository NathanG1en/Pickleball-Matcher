alter table tournaments add column if not exists format text not null default 'bracket';
alter table tournaments add column if not exists team_data jsonb;

