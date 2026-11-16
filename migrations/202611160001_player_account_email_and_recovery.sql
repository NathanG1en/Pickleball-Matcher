-- Add email and email_verified columns to player_accounts
alter table player_accounts
  add column if not exists email text,
  add column if not exists email_verified boolean not null default false;

-- Create unique index on lower-cased email for non-null values
create unique index if not exists player_accounts_email_unique_idx
  on player_accounts (lower(trim(email)))
  where email is not null;

-- Table for password reset tokens
create table if not exists password_reset_tokens (
  id text primary key,
  account_id text not null references player_accounts(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists password_reset_tokens_account_id_idx
  on password_reset_tokens(account_id);
create index if not exists password_reset_tokens_expires_at_idx
  on password_reset_tokens(expires_at);

-- Table for email verification tokens
create table if not exists email_verification_tokens (
  id text primary key,
  account_id text not null references player_accounts(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists email_verification_tokens_account_id_idx
  on email_verification_tokens(account_id);
create index if not exists email_verification_tokens_expires_at_idx
  on email_verification_tokens(expires_at);

-- Grant SELECT on player_accounts email columns to pickleball_rating_maintenance if the role exists
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'pickleball_rating_maintenance') then
    grant select (email, email_verified) on player_accounts to pickleball_rating_maintenance;
  end if;
end $$;

