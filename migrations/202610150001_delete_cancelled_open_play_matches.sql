-- Clean up any cancelled matches in open play sessions from the database
delete from match_players
where match_id in (
  select m.id
  from matches m
  join rounds r on r.id = m.round_id
  join sessions s on s.id = r.session_id
  where s.type = 'open_play' and m.status = 'cancelled'
);

delete from matches
where status = 'cancelled'
  and round_id in (
    select r.id
    from rounds r
    join sessions s on s.id = r.session_id
    where s.type = 'open_play'
  );

