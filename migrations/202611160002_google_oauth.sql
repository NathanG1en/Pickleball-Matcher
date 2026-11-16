-- Allow password_hash to be null for OAuth-only users
alter table player_accounts alter column password_hash drop not null;

-- OAuth accounts table linking external identity providers (e.g. Google) to player accounts
create table if not exists oauth_accounts (
  id text primary key,
  account_id text not null references player_accounts(id) on delete cascade,
  provider text not null,
  provider_user_id text not null,
  email text,
  created_at timestamptz not null default now(),
  constraint oauth_accounts_provider_user_unique unique (provider, provider_user_id)
);

create index if not exists oauth_accounts_account_id_idx on oauth_accounts(account_id);
create index if not exists oauth_accounts_provider_user_idx on oauth_accounts(provider, provider_user_id);

