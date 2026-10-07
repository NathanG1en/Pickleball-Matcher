alter table match_players
  drop constraint if exists match_players_player_id_fkey,
  add constraint match_players_player_id_fkey
    foreign key (player_id) references players(id) on delete cascade;

alter table round_sits
  drop constraint if exists round_sits_player_id_fkey,
  add constraint round_sits_player_id_fkey
    foreign key (player_id) references players(id) on delete cascade;
