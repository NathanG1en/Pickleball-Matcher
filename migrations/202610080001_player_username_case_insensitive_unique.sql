drop index if exists players_username_unique_idx;

create unique index players_username_case_insensitive_unique_idx
  on players (lower(username))
  where username is not null;
