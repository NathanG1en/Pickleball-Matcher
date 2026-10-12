alter table sessions
  add column if not exists type text not null default 'regular';

