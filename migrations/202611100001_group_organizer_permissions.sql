alter table groups
  add column if not exists organizer_permissions jsonb not null default '{"edit_group_name": true, "edit_group_privacy": true, "manage_organizers": false, "delete_group": false}'::jsonb;

