-- Synchronize player ratings across groups for registered accounts.
-- Sets account rows to the latest completed match rating (or initial_rating if no games),
-- and aligns all group memberships for that account with the unified account rating.

update players a
set rating = coalesce(
  (
    select mp.rating_after
    from match_players mp
    join matches m on m.id = mp.match_id and m.status = 'completed'
    join players p on p.id = mp.player_id
    where p.account_id = a.id and mp.rating_after is not null
    order by m.completed_at desc
    limit 1
  ),
  a.initial_rating
)
where a.group_id is null and a.username is not null;

update players p
set rating = a.rating,
    rated_games_played = a.rated_games_played
from players a
where p.account_id = a.id and a.username is not null;

