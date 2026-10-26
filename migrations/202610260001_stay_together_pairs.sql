-- Session-local friend pairs. Existing sessions retain ordinary rotation.
alter table sessions add column if not exists stay_together_pairs jsonb not null default '[]'::jsonb
  check (jsonb_typeof(stay_together_pairs) = 'array');
