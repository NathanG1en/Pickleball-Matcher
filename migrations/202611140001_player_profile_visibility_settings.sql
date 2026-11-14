-- Add visibility_settings jsonb column to player_accounts for granular Strava-style visibility options
alter table player_accounts
  add column if not exists visibility_settings jsonb;

