-- Group & Solo Training & Challenges Schema

create table if not exists challenge_templates (
  id text primary key,
  scope text not null check (scope in ('system', 'group')),
  group_id text references groups(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  slug text not null,
  description text not null,
  instructions text not null,
  skill_category text not null check (
    skill_category in ('dinking', 'third_shot', 'serving', 'volleys', 'resets', 'conditioning')
  ),
  participant_format text not null check (
    participant_format in ('individual', 'partner', 'group')
  ),
  tracking_format text not null check (
    tracking_format in ('highest_score', 'accuracy', 'wins', 'completion', 'timed')
  ),
  score_unit text not null,
  higher_is_better boolean not null default true,
  default_target_goal double precision,
  recommended_duration_minutes integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scope, group_id, slug)
);
create index if not exists challenge_templates_group_idx on challenge_templates(group_id);
create index if not exists challenge_templates_category_idx on challenge_templates(skill_category);

create table if not exists group_training_plans (
  id text primary key,
  group_id text not null references groups(id) on delete cascade,
  year integer not null check (year between 2020 and 2100),
  week_number integer not null check (week_number between 1 and 53),
  title text not null,
  focus_notes text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_by_account_id text references player_accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, year, week_number)
);
create index if not exists group_training_plans_group_week_idx on group_training_plans(group_id, year, week_number);

create table if not exists group_training_plan_items (
  id text primary key,
  plan_id text not null references group_training_plans(id) on delete cascade,
  challenge_id text not null references challenge_templates(id) on delete restrict,
  custom_goal_description text,
  target_benchmark double precision,
  sort_order integer not null default 0,
  unique (plan_id, challenge_id)
);
create index if not exists group_training_plan_items_plan_idx on group_training_plan_items(plan_id);

create table if not exists training_results (
  id text primary key,
  account_id text references player_accounts(id) on delete cascade,
  group_id text references groups(id) on delete cascade,
  plan_item_id text references group_training_plan_items(id) on delete set null,
  challenge_id text not null references challenge_templates(id) on delete cascade,
  logged_by_player_id text references players(id) on delete cascade,
  score_primary double precision not null,
  score_secondary double precision,
  metric_value double precision not null,
  completed boolean not null default true,
  notes text,
  recorded_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0)
);
create index if not exists training_results_challenge_actor_idx on training_results(challenge_id, coalesce(account_id, logged_by_player_id));
create index if not exists training_results_plan_item_idx on training_results(plan_item_id);
create index if not exists training_results_recorded_at_idx on training_results(recorded_at desc);

create table if not exists training_result_participants (
  id text primary key,
  result_id text not null references training_results(id) on delete cascade,
  player_id text references players(id) on delete cascade,
  account_id text references player_accounts(id) on delete cascade,
  role text not null default 'participant' check (role in ('primary', 'partner', 'opponent', 'feeder', 'group_member'))
);
create unique index if not exists training_result_participants_idx on training_result_participants(result_id, coalesce(account_id, player_id));

alter table challenge_templates enable row level security;
alter table group_training_plans enable row level security;
alter table group_training_plan_items enable row level security;
alter table training_results enable row level security;
alter table training_result_participants enable row level security;

grant select, insert, update, delete on challenge_templates, group_training_plans, group_training_plan_items, training_results, training_result_participants to anon;

-- Seed system challenges covering the 5 tracking formats
insert into challenge_templates (
  id, scope, group_id, title, slug, description, instructions, skill_category,
  participant_format, tracking_format, score_unit, higher_is_better, default_target_goal, recommended_duration_minutes
) values
(
  'ch_wall_streak_100', 'system', null,
  'Wall Dink Rally Streak', 'wall-dink-rally-streak',
  'Continuous forehand and backhand dinks against a practice wall without letting the ball bounce twice.',
  'Stand 7 feet back from the wall (simulating the non-volley zone line). Hit alternating forehand and backhand dinks above a 34-inch net line. Count consecutive successful hits without an error or double bounce.',
  'dinking', 'individual', 'highest_score', 'dinks', true, 50, 10
),
(
  'ch_drop_accuracy_20', 'system', null,
  'Third Shot Drop Target Test', 'third-shot-drop-target-test',
  'Hit 20 third shot drops from the baseline into the opposing kitchen zone to measure depth and touch accuracy.',
  'Position yourself at the baseline. Feed or have a partner hit deep balls to you. Hit 20 drops targeting the opposite kitchen. Count how many land cleanly inside the kitchen without touching the non-volley line.',
  'third_shot', 'individual', 'accuracy', 'drops', true, 75, 15
),
(
  'ch_dink_711_game', 'system', null,
  '7-11 Kitchen Game', '7-11-kitchen-game',
  'Competitive non-volley zone control game where games are played up to 7 or 11 points.',
  'Both players start at the kitchen line. Rally starts with an underhand cooperative dink. Points can only be scored through clean placement or opponent unforced errors. Count games won in your practice session.',
  'dinking', 'partner', 'wins', 'games', true, 3, 20
),
(
  'ch_group_drop_1000', 'system', null,
  'Group 1,000 Kitchen Drop Milestone', 'group-1000-kitchen-drop-milestone',
  'Collective group milestone where all participants contribute successful drop repetitions toward a shared target.',
  'Players practice third shot drops during group warm-ups or station drills. Every participant logs their total completed drop reps. All reps accumulate into the group community progress bar.',
  'third_shot', 'group', 'completion', 'drops', true, 1000, 30
),
(
  'ch_kitchen_shuttle_timed', 'system', null,
  'Kitchen Line Shuttle Sprint', 'kitchen-line-shuttle-sprint',
  'Timed lateral footwork and kitchen tap drill to improve speed and recovery at the net.',
  'Start at the center of the kitchen line. Shuffle laterally to touch the right sideline, shuffle across to touch the left sideline, and return to center. Repeat 5 times as fast as possible. Record total elapsed time in seconds.',
  'conditioning', 'individual', 'timed', 'seconds', false, 30, 5
),
(
  'ch_speed_volley_battle', 'system', null,
  'Speed Volley Reflex Battle', 'speed-volley-reflex-battle',
  'Fast-paced volley-to-volley rally between two players at the kitchen line to develop quick hands.',
  'Both partners stand at opposite kitchen lines. Initiate an airborne volley rally at chest height. Count the maximum consecutive volleys exchanged before the ball hits the ground or an unforced error occurs.',
  'volleys', 'partner', 'highest_score', 'volleys', true, 30, 10
)
on conflict (id) do nothing;

