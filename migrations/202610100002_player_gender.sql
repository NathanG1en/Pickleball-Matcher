alter table players add column if not exists gender text;
alter table players add constraint players_gender_check
  check (gender is null or gender in ('male', 'female'));

