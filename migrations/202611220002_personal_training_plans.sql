-- Personal Weekly Training Plans Schema

create table if not exists personal_training_plans (
  id text primary key,
  account_id text not null references player_accounts(id) on delete cascade,
  year integer not null check (year between 2020 and 2100),
  week_number integer not null check (week_number between 1 and 53),
  title text not null check (length(trim(title)) > 0),
  focus_notes text,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, year, week_number)
);
create index if not exists personal_training_plans_account_week_idx on personal_training_plans(account_id, year, week_number);

create table if not exists personal_training_plan_items (
  id text primary key,
  plan_id text not null references personal_training_plans(id) on delete cascade,
  challenge_id text not null references challenge_templates(id) on delete restrict,
  custom_goal_description text,
  target_benchmark double precision,
  sort_order integer not null default 0,
  unique (plan_id, challenge_id)
);
create index if not exists personal_training_plan_items_plan_idx on personal_training_plan_items(plan_id);

alter table personal_training_plans enable row level security;
alter table personal_training_plan_items enable row level security;

grant select, insert, update, delete on personal_training_plans, personal_training_plan_items to anon;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'pickleball_rating_maintenance') then
    grant select on personal_training_plans, personal_training_plan_items to pickleball_rating_maintenance;
  end if;
end $$;

