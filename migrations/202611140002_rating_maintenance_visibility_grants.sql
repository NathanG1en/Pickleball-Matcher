-- Grant SELECT on player_accounts visibility columns to pickleball_rating_maintenance role
-- so listPlayers() can be called by rating maintenance operators without 42501 permission errors.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'pickleball_rating_maintenance') then
    grant select (is_public, visibility_settings) on player_accounts to pickleball_rating_maintenance;
  end if;
end $$;
