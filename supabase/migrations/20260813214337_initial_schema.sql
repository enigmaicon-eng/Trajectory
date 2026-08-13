-- Trajectory — initial schema
-- Source: docs/PRODUCT-ARCHITECTURE.md §4

create extension if not exists pgcrypto;

-- ── enums ─────────────────────────────────────────────────────────────────
create type goal_status         as enum ('draft','active','paused','achieved','abandoned','rescoped');
create type feasibility_verdict as enum ('realistic','ambitious_but_possible','unrealistic_as_stated');
create type node_kind           as enum ('milestone','project');
create type node_status         as enum ('not_started','in_progress','blocked','complete','dropped');
create type node_health         as enum ('on_track','at_risk','off_track','unknown');
create type dependency_type     as enum ('blocks','informs');
create type plan_status         as enum ('generating','draft','active','superseded','failed');
create type plan_source         as enum ('initial','replan','manual');
create type task_tier           as enum ('minimum','normal','ideal');
create type task_status         as enum ('pending','done','skipped','deferred','dropped');
create type checkin_kind        as enum ('daily','weekly');
create type evidence_kind       as enum ('link','text','file','self_attest');
create type constraint_kind     as enum ('time','money','hard_date','commitment','preference','prohibition');
create type replan_trigger      as enum (
  'user_requested','low_execution','milestone_off_track','capacity_changed',
  'ahead_of_schedule','missed_checkins','priority_change','dependency_change'
);
create type ai_module           as enum (
  'clarify','assess','decompose','plan_week','plan_day','progress','reflect','replan'
);
create type user_tier           as enum ('free','byok');

-- ── shared trigger: maintain updated_at ─────────────────────────────────────
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ── identity ─────────────────────────────────────────────────────────────
create table profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  display_name      text,
  timezone          text not null default 'UTC',
  tier              user_tier not null default 'free',
  onboarded_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger trg_profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

-- BYOK. `ciphertext` is never exposed to the browser (see §10).
create table user_credentials (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  provider          text not null check (provider in ('gemini','openai','anthropic')),
  ciphertext        bytea not null,          -- AES-256-GCM
  iv                bytea not null,
  auth_tag          bytea not null,
  key_hint          text not null,           -- last 4 chars only, e.g. '····4f2a'
  last_verified_at  timestamptz,
  created_at        timestamptz not null default now(),
  unique (user_id, provider)
);

-- ── goal ─────────────────────────────────────────────────────────────────
create table goals (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  raw_input         text not null,                    -- immutable, verbatim
  title             text not null,
  outcome_statement text not null,                    -- AI-normalized, user-editable
  domain            text,                             -- career | skill | business | fitness | finance | project | other
  target_date       date,
  horizon_weeks     int check (horizon_weeks between 1 and 260),
  status            goal_status not null default 'draft',
  started_on        date,
  archived_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index on goals (user_id, status);
create trigger trg_goals_updated_at before update on goals
  for each row execute function set_updated_at();

create table goal_intake (
  goal_id           uuid primary key references goals(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  questions         jsonb not null default '[]',      -- AIQuestion[]
  answers           jsonb not null default '{}',      -- { [questionId]: string }
  starting_point    text,                             -- resolved: where the user is today
  motivation        text,
  completed_at      timestamptz,
  created_at        timestamptz not null default now()
);

create table feasibility_assessments (
  id                uuid primary key default gen_random_uuid(),
  goal_id           uuid not null references goals(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  verdict           feasibility_verdict not null,
  confidence        numeric(3,2) not null check (confidence between 0 and 1),
  rationale         text not null,
  key_risks         jsonb not null default '[]',      -- {risk, severity, mitigation}[]
  comparable_basis  text,                             -- what this judgement is grounded in
  alternative       jsonb,                            -- {outcome_statement, horizon_weeks, why_stronger}
  created_at        timestamptz not null default now()
);
create index on feasibility_assessments (goal_id, created_at desc);

create table constraints (
  id                uuid primary key default gen_random_uuid(),
  goal_id           uuid not null references goals(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  kind              constraint_kind not null,
  label             text not null,
  value_numeric     numeric,
  value_date        date,
  value_text        text,
  is_hard           boolean not null default true,
  created_at        timestamptz not null default now()
);

create table capacity_profiles (
  id                uuid primary key default gen_random_uuid(),
  goal_id           uuid not null references goals(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  effective_from    date not null,
  ideal_minutes     int not null check (ideal_minutes    between 5 and 960),
  normal_minutes    int not null check (normal_minutes   between 5 and 960),
  minimum_minutes   int not null check (minimum_minutes  between 1 and 960),
  days_per_week     int not null check (days_per_week between 1 and 7),
  preferred_days    int[] not null default '{1,2,3,4,5}',   -- ISO weekday
  blackout_dates    date[] not null default '{}',
  note              text,
  created_at        timestamptz not null default now(),
  check (minimum_minutes <= normal_minutes and normal_minutes <= ideal_minutes)
);
create index on capacity_profiles (goal_id, effective_from desc);

-- ── goal graph ───────────────────────────────────────────────────────────
create table goal_nodes (
  id                uuid primary key default gen_random_uuid(),
  goal_id           uuid not null references goals(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  kind              node_kind not null,
  parent_id         uuid references goal_nodes(id) on delete cascade,
  title             text not null,
  summary           text,
  verification      text not null,                    -- how we know it's genuinely done
  sequence          int not null default 0,
  target_date       date,
  estimated_minutes int,                              -- projects only
  status            node_status not null default 'not_started',
  health            node_health not null default 'unknown',
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint milestone_has_no_parent check (kind <> 'milestone' or parent_id is null),
  constraint project_has_parent      check (kind <> 'project'   or parent_id is not null),
  constraint project_has_estimate    check (kind <> 'project'   or estimated_minutes is not null)
);
create index on goal_nodes (goal_id, kind, sequence);
create index on goal_nodes (parent_id);
create trigger trg_goal_nodes_updated_at before update on goal_nodes
  for each row execute function set_updated_at();

create table node_dependencies (
  id                uuid primary key default gen_random_uuid(),
  goal_id           uuid not null references goals(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  from_node_id      uuid not null references goal_nodes(id) on delete cascade,
  to_node_id        uuid not null references goal_nodes(id) on delete cascade,
  type              dependency_type not null default 'blocks',
  rationale         text,
  created_at        timestamptz not null default now(),
  unique (from_node_id, to_node_id, type),
  check (from_node_id <> to_node_id)
);
create index on node_dependencies (goal_id);

-- acyclicity trigger (`blocks` edges only)
create or replace function assert_dependency_acyclic() returns trigger
language plpgsql as $$
begin
  if new.type <> 'blocks' then return new; end if;
  if exists (
    with recursive reach(node_id) as (
      select new.to_node_id
      union
      select d.to_node_id from node_dependencies d
        join reach r on d.from_node_id = r.node_id
       where d.type = 'blocks'
    )
    select 1 from reach where node_id = new.from_node_id
  ) then
    raise exception 'dependency cycle: % -> %', new.from_node_id, new.to_node_id
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger trg_dependency_acyclic
  before insert or update on node_dependencies
  for each row execute function assert_dependency_acyclic();

-- ── plan ─────────────────────────────────────────────────────────────────
create table plans (
  id                uuid primary key default gen_random_uuid(),
  goal_id           uuid not null references goals(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  version           int not null,
  status            plan_status not null default 'generating',
  source            plan_source not null,
  supersedes_id     uuid references plans(id),
  horizon_start     date not null,
  horizon_end       date not null,
  rationale         text,                             -- why the plan is shaped this way
  generated_at      timestamptz not null default now(),
  activated_at      timestamptz,
  unique (goal_id, version)
);
-- at most one active plan per goal
create unique index one_active_plan_per_goal
  on plans (goal_id) where status = 'active';

create table plan_weeks (
  id                uuid primary key default gen_random_uuid(),
  plan_id           uuid not null references plans(id) on delete cascade,
  goal_id           uuid not null references goals(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  week_index        int not null,
  starts_on         date not null,
  ends_on           date not null,
  theme             text,
  capacity_minutes  int not null,
  unique (plan_id, week_index)
);
create index on plan_weeks (goal_id, starts_on);

create table weekly_outcomes (
  id                uuid primary key default gen_random_uuid(),
  plan_week_id      uuid not null references plan_weeks(id) on delete cascade,
  goal_id           uuid not null references goals(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  project_node_id   uuid references goal_nodes(id) on delete set null,
  statement         text not null,
  success_criteria  text not null,
  priority          int not null default 1,           -- 1 = highest leverage
  status            node_status not null default 'not_started',
  completed_at      timestamptz
);
create index on weekly_outcomes (plan_week_id, priority);

create table tasks (
  id                 uuid primary key default gen_random_uuid(),
  plan_week_id       uuid not null references plan_weeks(id) on delete cascade,
  weekly_outcome_id  uuid references weekly_outcomes(id) on delete set null,
  project_node_id    uuid references goal_nodes(id) on delete set null,
  goal_id            uuid not null references goals(id) on delete cascade,
  user_id            uuid not null references auth.users(id) on delete cascade,
  title              text not null,
  why                text,                            -- one line linking task → outcome
  effort_minutes     int not null check (effort_minutes between 5 and 480),
  tier               task_tier not null default 'normal',
  scheduled_for      date,
  sequence           int not null default 0,
  status             task_status not null default 'pending',
  blocked_by_task_id uuid references tasks(id) on delete set null,
  is_user_added      boolean not null default false,
  completed_at       timestamptz,
  created_at         timestamptz not null default now()
);
create index on tasks (goal_id, scheduled_for, status);
create index on tasks (plan_week_id, sequence);

-- ── execution & feedback ─────────────────────────────────────────────────
create table checkins (
  id                uuid primary key default gen_random_uuid(),
  goal_id           uuid not null references goals(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  kind              checkin_kind not null,
  occurred_on       date not null,
  minutes_available int,
  minutes_spent     int,
  energy            int check (energy between 1 and 5),
  note              text,
  created_at        timestamptz not null default now(),
  unique (goal_id, kind, occurred_on)
);

create table evidence (
  id                uuid primary key default gen_random_uuid(),
  goal_id           uuid not null references goals(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  task_id           uuid references tasks(id) on delete cascade,
  weekly_outcome_id uuid references weekly_outcomes(id) on delete cascade,
  node_id           uuid references goal_nodes(id) on delete cascade,
  kind              evidence_kind not null,
  url               text,
  body              text,
  storage_path      text,
  created_at        timestamptz not null default now(),
  constraint exactly_one_subject check (
    (task_id is not null)::int + (weekly_outcome_id is not null)::int + (node_id is not null)::int = 1
  )
);

create table reflections (
  id                uuid primary key default gen_random_uuid(),
  goal_id           uuid not null references goals(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  plan_week_id      uuid references plan_weeks(id) on delete set null,
  what_worked       text,
  what_didnt        text,
  blockers          text,
  ai_synthesis      jsonb,        -- {summary, patterns[], recommendation, confidence}
  created_at        timestamptz not null default now(),
  unique (goal_id, plan_week_id)
);

create table replan_events (
  id                uuid primary key default gen_random_uuid(),
  goal_id           uuid not null references goals(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  trigger           replan_trigger not null,
  trigger_detail    jsonb not null default '{}',      -- deterministic evidence that fired it
  diagnosis         text not null,
  patch             jsonb not null,                   -- PlanPatch (§5.6)
  from_plan_id      uuid references plans(id),
  to_plan_id        uuid references plans(id),
  accepted          boolean,
  responded_at      timestamptz,
  created_at        timestamptz not null default now()
);
create index on replan_events (goal_id, created_at desc);

create table goal_signals (
  id                uuid primary key default gen_random_uuid(),
  goal_id           uuid not null references goals(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  captured_on       date not null,
  momentum          numeric(4,1),         -- 0..100
  execution_rate    numeric(4,3),         -- 0..1+
  plan_confidence   numeric(3,2),         -- 0..1
  risk_level        node_health not null default 'unknown',
  projected_completion_date date,
  inputs            jsonb not null,       -- raw counters used, for explainability
  explanation       jsonb not null,       -- per-signal {value, basis, caveat}
  created_at        timestamptz not null default now(),
  unique (goal_id, captured_on)
);

-- ── AI observability & limits ───────────────────────────────────────────────
create table ai_runs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  goal_id           uuid references goals(id) on delete set null,
  module            ai_module not null,
  provider          text not null,
  model             text not null,
  prompt_version    text not null,
  used_byok         boolean not null default false,
  status            text not null,        -- ok | schema_invalid | invariant_failed | provider_error | timeout
  attempts          int not null default 1,
  input_tokens      int,
  output_tokens     int,
  latency_ms        int,
  error_code        text,
  created_at        timestamptz not null default now()
);
create index on ai_runs (user_id, created_at desc);

create table usage_counters (
  user_id           uuid not null references auth.users(id) on delete cascade,
  period_start      date not null,        -- UTC day
  module_class      text not null,        -- 'light' | 'heavy'
  count             int not null default 0,
  primary key (user_id, period_start, module_class)
);

-- ── row level security ───────────────────────────────────────────────────
alter table profiles                 enable row level security;
alter table user_credentials         enable row level security;
alter table goals                    enable row level security;
alter table goal_intake              enable row level security;
alter table feasibility_assessments  enable row level security;
alter table constraints              enable row level security;
alter table capacity_profiles        enable row level security;
alter table goal_nodes               enable row level security;
alter table node_dependencies        enable row level security;
alter table plans                    enable row level security;
alter table plan_weeks               enable row level security;
alter table weekly_outcomes          enable row level security;
alter table tasks                    enable row level security;
alter table checkins                 enable row level security;
alter table evidence                 enable row level security;
alter table reflections              enable row level security;
alter table replan_events            enable row level security;
alter table goal_signals             enable row level security;
alter table ai_runs                  enable row level security;
alter table usage_counters           enable row level security;

create policy owner_all on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy owner_all on user_credentials
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy owner_all on goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy owner_all on goal_intake
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy owner_all on feasibility_assessments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy owner_all on constraints
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy owner_all on capacity_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy owner_all on goal_nodes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy owner_all on node_dependencies
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy owner_all on plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy owner_all on plan_weeks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy owner_all on weekly_outcomes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy owner_all on tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy owner_all on checkins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy owner_all on evidence
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy owner_all on reflections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy owner_all on replan_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy owner_all on goal_signals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy owner_all on ai_runs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy owner_all on usage_counters
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- user_credentials: deny ciphertext column access from client roles
revoke select on user_credentials from anon, authenticated;
grant select (id, user_id, provider, key_hint, last_verified_at, created_at)
  on user_credentials to anon, authenticated;
grant insert, update, delete on user_credentials to authenticated;

-- auto-provision a profile row when a new auth user is created
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end $$;

create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
