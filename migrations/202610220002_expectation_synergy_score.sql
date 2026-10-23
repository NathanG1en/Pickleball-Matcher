-- Migration: Expectation-adjusted synergy score with 6-game recency and score margin
alter table player_synergy
  drop constraint if exists player_synergy_synergy_score_check;

alter table player_synergy
  add constraint player_synergy_synergy_score_check
  check (synergy_score between -100 and 100);

alter table player_synergy
  alter column synergy_score set default 0;

alter table player_synergy
  add column if not exists weight_sum double precision not null default 0,
  add column if not exists contribution_sum double precision not null default 0,
  add column if not exists weight_sq_sum double precision not null default 0;
