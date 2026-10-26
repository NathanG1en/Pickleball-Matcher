create table if not exists session_partner_requests (
  id text primary key,
  session_id text not null references sessions(id) on delete cascade,
  requester_player_id text not null references players(id) on delete cascade,
  partner_player_id text not null references players(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  version integer not null default 1 check (version > 0),
  check (requester_player_id <> partner_player_id),
  check ((status = 'pending' and resolved_at is null) or (status <> 'pending' and resolved_at is not null))
);
create index if not exists session_partner_requests_session_idx on session_partner_requests (session_id, status, created_at desc);
create unique index if not exists session_partner_requests_outgoing_pending_idx on session_partner_requests (session_id, requester_player_id) where status = 'pending';
create unique index if not exists session_partner_requests_pair_pending_idx on session_partner_requests
  (session_id, least(requester_player_id, partner_player_id), greatest(requester_player_id, partner_player_id)) where status = 'pending';
