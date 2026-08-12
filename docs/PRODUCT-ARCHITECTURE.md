# Trajectory — Product Architecture

**Status:** Proposed · v1 · implementation-ready
**Scope:** the complete core loop (Goal → Clarify → Assess → Decompose → Plan → Execute → Reflect → Adapt → Plan)
**Audience:** engineers implementing v1

---

## 1. Product frame

Trajectory turns an ambitious natural-language outcome into a realistic, dependency-aware execution system, and keeps that system honest as reality diverges from the plan.

The product is judged by one question: **is the user making real progress on a hard goal?** Not "did we generate a beautiful plan?"

Three commitments drive every architectural decision below:

1. **Honesty over enthusiasm.** The system states when a timeline is unrealistic and proposes the strongest achievable alternative instead of silently producing a fantasy plan.
2. **Adaptation is the product.** A plan is a versioned, patchable artifact with an audit trail — not a one-shot generation.
3. **AI proposes, the engine decides.** See §5.1. This is the single most important principle in this document.

### 1.1 Non-goals for v1

No social features, no chat-first interface, no calendar replacement, no team collaboration, no marketplace, no gamification, no integrations. One user, their goals, and the loop.

---

## 2. System architecture

### 2.1 Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js (App Router, 15+), React 19, TypeScript strict |
| Styling | Tailwind CSS + shadcn/ui (Radix primitives) |
| Persistence | Supabase Postgres + Row Level Security |
| Auth | Supabase Auth (email OTP + Google OAuth) |
| AI | Gemini via internal `AIProvider` abstraction |
| Validation | Zod (single source of truth for AI I/O, actions, forms) |
| Deployment | Vercel |
| Package manager | pnpm |
| Testing | Vitest (unit/domain), Playwright (core-loop E2E) |

Single Next.js application. **Not** a monorepo — module boundaries are enforced by directory structure and lint rules, not by packages.

### 2.2 Layers

```
┌───────────────────────────────────────────────────────────┐
│  UI (App Router — RSC by default, client islands)         │
├───────────────────────────────────────────────────────────┤
│  Server Actions  ·  Route Handlers (SSE for generation)   │
├───────────────────────────────────────────────────────────┤
│  Domain Engine (pure TypeScript, no I/O, fully testable)  │
│   scheduler · signals · graph · invariants · replan-apply │
├───────────────────────────────────────────────────────────┤
│  AI Layer      lib/ai/run.ts → modules → AIProvider       │
├───────────────────────────────────────────────────────────┤
│  Data Access   lib/db/queries · lib/db/mutations          │
├───────────────────────────────────────────────────────────┤
│  Supabase Postgres (RLS) · pgcrypto                       │
└───────────────────────────────────────────────────────────┘
```

**Rule:** the domain engine is pure and dependency-free. Every scheduling, scoring, and health decision is deterministic TypeScript that can be unit-tested without an LLM or a database. This is what keeps the product from being "ChatGPT with a database."

### 2.3 Directory layout

```
src/
  app/
    (marketing)/                  landing
    (onboarding)/start/           intake → assessment → first plan
    (app)/goals/[goalId]/         today · week · map · reflect · history · settings
    (app)/settings/               account · ai (BYOK)
    api/
      ai/generate/route.ts        SSE generation stream
      ai/replan/route.ts          SSE replan stream
      health/route.ts
  components/
    ui/                           shadcn primitives
    goal/ plan/ today/ graph/ signals/ marketing/
  lib/
    ai/
      provider.ts                 AIProvider interface + types
      providers/{gemini,openai,anthropic}.ts
      registry.ts                 resolveProvider(userId) → platform | BYOK
      run.ts                      runModule(): validate · repair · retry · log
      modules/                    one file per AI capability (§5.2)
      schemas/                    zod I/O schemas per module
      prompts/                    versioned prompt text
    domain/
      types.ts                    domain types (derived from zod where shared)
      graph.ts                    DAG build, topo sort, critical path, slack
      scheduler.ts                capacity-aware task placement
      signals.ts                  momentum · execution rate · risk · projection
      replan.ts                   trigger detection + patch application
      invariants.ts               post-AI structural validation
      capacity.ts                 ideal/normal/minimum day resolution
      dates.ts                    timezone-safe week/day arithmetic
    db/
      server.ts client.ts admin.ts
      queries/ mutations/ types.generated.ts
    security/crypto.ts redact.ts
    usage/limits.ts
  server/actions/                 all mutations, zod-validated
supabase/migrations/
tests/{domain,ai,e2e}/
docs/
```

---

## 3. Domain model

### 3.1 Concept map

```
User
 └─ Goal ─────────────────────────────────────────────┐
     ├─ FeasibilityAssessment (versioned)             │
     ├─ Constraint*                                   │
     ├─ CapacityProfile (versioned, effective-dated)  │
     ├─ GoalNode graph                                │
     │    ├─ kind=milestone  (outcome checkpoints)    │
     │    └─ kind=project    (bodies of work)         │
     │        └─ NodeDependency edges (DAG)           │
     ├─ Plan (versioned; one active)                  │
     │    └─ PlanWeek                                 │
     │         ├─ WeeklyOutcome → project node        │
     │         └─ Task (daily action, tiered)         │
     ├─ CheckIn (daily / weekly)                      │
     ├─ Evidence → task | weekly outcome | node       │
     ├─ Reflection (weekly)                           │
     ├─ ReplanEvent (trigger, diagnosis, patch)       │
     └─ GoalSignal (daily snapshot)                   │
```

### 3.2 Entity definitions

**Goal** — the ambition. Holds the raw user input verbatim (never overwritten) plus the AI-normalized outcome statement, domain, target date, and lifecycle status. One goal = one execution system.

**FeasibilityAssessment** — an immutable, versioned verdict: `realistic` | `ambitious_but_possible` | `unrealistic_as_stated`. Carries confidence, rationale, key risks, and — when unrealistic — a concrete recommended alternative (extended horizon and/or narrowed outcome). Re-run on major replans so we can show "we flagged this in week 2."

**Constraint** — an explicit limit the plan must respect: `time` (weekly minutes), `money`, `hard_date`, `commitment` (existing obligations), `preference` (e.g. "no weekends"), `prohibition`. Typed, not free text, so the scheduler and replanner can honor them.

**CapacityProfile** — effective-dated. Defines the **ideal / normal / minimum viable day** in minutes, days per week, preferred days, and blackout dates. Versioned because *available time changing* is a first-class replan trigger, not an edit.

**GoalNode** — a node in the goal graph. `kind = milestone | project`. Milestones are outcome checkpoints ("Ship a public case study"); projects are the work that produces them. Milestones have no parent; projects have exactly one milestone parent. Both carry `verification` — how we will know it is genuinely done.

**NodeDependency** — a directed edge `from_node → to_node` with `type = blocks | informs`. `blocks` edges must form a DAG (enforced by trigger). This is what makes the graph dependency-aware rather than a nested list.

**Plan** — a versioned snapshot of the execution schedule for the whole remaining horizon. Exactly one plan per goal is `active`. Superseded plans are retained — plan history is a product feature, not just an audit log.

**PlanWeek** — one calendar week of a plan: date range, theme, and the capacity budget assumed for that week.

**WeeklyOutcome** — the meaningful weekly result ("Complete and publish teardown #2"), linked to a project node, with explicit success criteria. Weeks are measured by outcomes, not task counts.

**Task** — a daily action. Carries `effort_minutes`, a `tier` (`minimum` | `normal` | `ideal`), `scheduled_for`, and a short `why` linking it to its outcome. Tiering is what lets a chaotic day still count.

**CheckIn** — a lightweight daily or weekly log: minutes actually available, energy, notes. Drives signals and replan triggers. Must be completable in under 10 seconds.

**Evidence** — proof of completion attached to exactly one of task / weekly outcome / node. Kinds: `link`, `text`, `file`, `self_attest`. Milestones require non-`self_attest` evidence to be marked complete; this is the anti-self-deception mechanism.

**Reflection** — weekly synthesis: what worked, what didn't, blockers, decisions. Half user-authored, half AI-synthesized from actual execution data.

**ReplanEvent** — a record of adaptation: trigger, diagnosis, the typed patch proposed, whether the user accepted it, and the resulting plan version.

**GoalSignal** — a daily deterministic snapshot of momentum, execution rate, plan confidence, risk level, and projected completion, plus a machine-readable explanation of how each was derived.

### 3.3 Key modeling decisions

| Decision | Rationale |
| --- | --- |
| Milestones and projects share one `goal_nodes` table | Real FKs on dependency edges; one recursive CTE loads the whole graph; one RLS policy. Kind-specific rules enforced by CHECK constraints. |
| Tasks live under `plan_weeks`, not under the graph | The graph is *what must become true* (stable); tasks are *what you do this week* (churny, regenerated on replan). Separating them means replanning never destroys structure. |
| Plans are versioned; replans emit **patches** | Full regeneration destroys history and is unexplainable. Typed ops (§5.6) are reviewable, diffable, and reversible. |
| Capacity is effective-dated, not a column | "My available time changed" is the most common real-world divergence. It must be a modeled event. |
| `goals.raw_input` is immutable | Preserves what the user actually asked for, independent of AI normalization. |
| Evidence uses three nullable FKs + exactly-one CHECK | Keeps referential integrity instead of a polymorphic `subject_id`. |

---

## 4. Database schema

Postgres via Supabase. All tables carry `user_id uuid not null references auth.users(id) on delete cascade` and RLS `using (auth.uid() = user_id)`. `updated_at` maintained by a shared trigger.

### 4.1 Enums

```sql
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
```

### 4.2 Tables

```sql
-- ── identity ────────────────────────────────────────────────────────────────
create table profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  display_name      text,
  timezone          text not null default 'UTC',
  tier              user_tier not null default 'free',
  onboarded_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

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

-- ── goal ────────────────────────────────────────────────────────────────────
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

-- ── goal graph ──────────────────────────────────────────────────────────────
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
```

**Acyclicity trigger** (`blocks` edges only):

```sql
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
```

```sql
-- ── plan ────────────────────────────────────────────────────────────────────
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

-- ── execution & feedback ────────────────────────────────────────────────────
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
```

### 4.3 RLS

Every table above: `alter table X enable row level security;` plus

```sql
create policy owner_all on X
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

`user_credentials` additionally **denies column access to ciphertext from the client**: the anon/authenticated roles are granted `select (id, provider, key_hint, last_verified_at, created_at)` only. Decryption happens server-side using the service role.

`profiles` uses `auth.uid() = id`.

---

## 5. AI architecture

### 5.1 The governing principle — *AI proposes, the engine decides*

| The LLM does | The deterministic engine does |
| --- | --- |
| Propose milestones, projects, dependencies | Validate the DAG, topologically sort, compute critical path and slack |
| Propose tasks and effort estimates | Fit tasks into real capacity; assign dates; enforce constraints |
| Explain a signal in plain language | **Compute** momentum, execution rate, risk, projected completion |
| Diagnose why a plan is off track | Detect that it *is* off track (thresholds, §5.6) |
| Propose a plan patch | Apply, validate, and version the patch |

The LLM never computes a number the product reports as fact, and never writes to the database directly. Every AI output passes schema validation, then domain invariants, then persistence.

### 5.2 Modules

Eight focused modules. No monolithic prompt. Each is a directory with `input.schema.ts`, `output.schema.ts`, `prompt.v1.ts`, `index.ts` (post-processor).

| Module | Input | Output | Class |
| --- | --- | --- | --- |
| `clarify` | raw goal text | normalized title, outcome statement, inferred domain/horizon, **≤4** high-value questions | light |
| `assess` | goal + intake + capacity | feasibility verdict, confidence, rationale, risks, recommended alternative | light |
| `decompose` | goal + assessment + constraints | milestones, projects (with effort estimates + verification), dependency edges | heavy |
| `plan_week` | graph + capacity + current state + recent execution | weekly outcomes + candidate tasks (unscheduled) | heavy |
| `plan_day` | today's tasks + today's available minutes | ideal / normal / minimum-viable day selection + one-line framing | light |
| `progress` | signal inputs + recent execution | plain-language explanation of each signal, top bottleneck | light |
| `reflect` | week's execution data + user reflection text | synthesis, observed patterns, one concrete recommendation | light |
| `replan` | diagnosis inputs + graph + active plan | typed `PlanPatch` + diagnosis narrative | heavy |

`plan_day` is the cheapest and most frequent call and must complete in <3s; it may fall back to a purely deterministic selection if the provider fails (see §5.4 step 8 / §6.3).

### 5.3 Provider abstraction

```ts
// lib/ai/provider.ts
export type ProviderId = 'gemini' | 'openai' | 'anthropic';

export interface StructuredRequest<T> {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  schemaName: string;
  temperature?: number;      // default 0.3
  maxOutputTokens?: number;
  timeoutMs?: number;        // default 45_000
  traceId: string;
}

export interface StructuredResult<T> {
  data: T;
  usage: { inputTokens?: number; outputTokens?: number };
  model: string;
  raw: string;
}

export interface AIProvider {
  readonly id: ProviderId;
  readonly model: string;
  generateStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>>;
  generateText(req: TextRequest): Promise<TextResult>;  // narrative copy only
}
```

`lib/ai/registry.ts` → `resolveProvider(userId, module)`:

1. If the user has a verified BYOK credential for a supported provider → decrypt server-side, construct that provider with the pro-tier model.
2. Otherwise → platform Gemini provider with the fast model, subject to free-tier limits.

`GeminiProvider` is the only complete implementation in v1. `OpenAIProvider` and `AnthropicProvider` ship as conforming stubs with the interface implemented and a clear `NotConfiguredError`, so the abstraction is proven rather than theoretical.

**Gemini structured-output note:** Gemini accepts an OpenAPI-3.0-subset `responseSchema`. It does not support the full JSON Schema surface (no `$ref`, no top-level `oneOf`/discriminated unions, limited `anyOf`). `lib/ai/schema-adapter.ts` converts a Zod schema into that subset and **fails loudly at build/test time** if a module schema uses an unsupported construct. Design module output schemas as flat object trees with enums and arrays; express variants as an enum discriminator field plus nullable branches, not as unions.

### 5.4 The execution wrapper

```ts
// lib/ai/run.ts
export async function runModule<TIn, TOut>(
  def: ModuleDefinition<TIn, TOut>,
  input: TIn,
  ctx: RunContext,          // { userId, goalId?, traceId, signal }
): Promise<TOut>;
```

Pipeline for every call:

1. **Limit check** — free tier quota for the module class; throws `QuotaExceededError` (recoverable UI state, never a 500).
2. **Input validation** — zod parse of the module input.
3. **Provider resolution** — platform or BYOK.
4. **Generate** with the provider's native structured-output mode.
5. **Schema validation** — zod parse of the output.
6. **Repair pass (once)** — on failure, re-prompt with the raw output and the zod error paths, asking only for a corrected object. If it fails again → `AIValidationError`.
7. **Domain invariants** — `lib/domain/invariants.ts` (§7). Violations are auto-repaired where deterministic (e.g. dropping a cyclic edge, clamping effort to capacity) and otherwise trigger one targeted re-ask.
8. **Log** — write `ai_runs` (never the prompt or response bodies; metadata only), increment `usage_counters`.

Retries: one transport retry on 5xx/timeout with jitter, one repair retry on schema failure. Hard ceiling of 3 provider calls per module invocation.

### 5.5 Deterministic signals (`lib/domain/signals.ts`)

All computed in TypeScript. Definitions are fixed so they're comparable over time.

| Signal | Definition | Reported as unknown when |
| --- | --- | --- |
| **Execution rate** | `completed_effort_minutes / planned_effort_minutes` over trailing 14 days | <7 days of plan history |
| **Momentum** | EWMA (α = 0.3) over trailing 21 days of "active day" (any task done, or a check-in with `minutes_spent > 0`), scaled 0–100 | <7 days of data |
| **Plan confidence** | `w₁·feasibility_confidence + w₂·clamp(execution_rate) + w₃·(1 − effort_variance) + w₄·data_sufficiency`, weights `0.35 / 0.30 / 0.15 / 0.20` | never — but reported "low confidence: limited data" while `data_sufficiency < 0.5` |
| **Milestone risk** | `required_remaining_minutes / projected_available_minutes_before_target`. ≤0.8 `on_track`, ≤1.0 `at_risk`, >1.0 `off_track` | milestone has no target date |
| **Projected completion** | remaining critical-path effort ÷ trailing 4-week realized weekly minutes, floored by critical-path week count | <2 weeks of realized data |
| **Goal risk** | worst milestone risk on the critical path | — |

Every signal writes its `inputs` and a per-signal `explanation` (`{value, basis, caveat}`) into `goal_signals`. **The UI must always be able to answer "why does it say that?" from the database alone** — the AI narrative is a layer on top, not the source.

### 5.6 Replanning

**Triggers** (evaluated by `lib/domain/replan.ts` on daily signal computation and on weekly reflection submit):

| Trigger | Condition |
| --- | --- |
| `low_execution` | execution rate < 0.5 for 2 consecutive weeks |
| `milestone_off_track` | any critical-path milestone at `off_track` |
| `capacity_changed` | new capacity profile differs from prior weekly total by >25% |
| `missed_checkins` | no completed task and no check-in for 10+ consecutive days |
| `ahead_of_schedule` | execution rate > 1.4 for 2 consecutive weeks |
| `dependency_change` | a `blocks` edge added/removed, or a project dropped |
| `priority_change` / `user_requested` | user action |

**PlanPatch** — the replan module returns typed operations, not a new plan:

```ts
type PlanOp =
  | { op: 'shift_milestone';    nodeId: string; newTargetDate: string; reason: string }
  | { op: 'rescope_milestone';  nodeId: string; newTitle: string; newVerification: string; reason: string }
  | { op: 'drop_project';       nodeId: string; reason: string }
  | { op: 'insert_project';     parentMilestoneId: string; project: ProjectDraft; reason: string }
  | { op: 'reorder';            nodeIds: string[]; reason: string }
  | { op: 'add_dependency';     fromNodeId: string; toNodeId: string; reason: string }
  | { op: 'remove_dependency';  fromNodeId: string; toNodeId: string; reason: string }
  | { op: 'adjust_capacity';    ideal: number; normal: number; minimum: number; daysPerWeek: number; reason: string }
  | { op: 'rebuild_weeks';      fromWeekIndex: number; reason: string }
  | { op: 'extend_horizon';     newTargetDate: string; reason: string }
  | { op: 'narrow_outcome';     newOutcomeStatement: string; reason: string };

interface PlanPatch { diagnosis: string; confidence: number; ops: PlanOp[]; tradeoffs: string[] }
```

`applyPatch(plan, graph, patch)` is a pure function producing a new plan version. The user sees a **before/after diff with reasons and stated trade-offs** and explicitly accepts or rejects. Rejection is recorded in `replan_events` (`accepted = false`) and feeds future prompts — the system learns which adaptations this user refuses.

Replanning **never** silently deletes history: the prior plan becomes `superseded` and remains viewable at `/goals/[id]/history`.

### 5.7 Prompting rules (encoded in the shared system preamble)

- Prefer realistic over aspirational; state uncertainty explicitly rather than hedging with confident prose.
- Never generate task volume to look thorough. Cap: ≤5 milestones, ≤4 projects per milestone, ≤5 tasks per week initially.
- Every task must have a `why` connecting it to a weekly outcome; if you cannot write one, drop the task.
- No motivational language, no exclamation marks, no "you've got this."
- Prefer high-leverage actions that produce evidence over consumption actions ("read about X").
- When the requested outcome is not achievable in the requested time, say so plainly and propose the strongest achievable alternative. Do not generate a plan for the impossible version.
- Ground effort estimates in the stated capacity; never propose a week that exceeds the ideal-day budget.

### 5.8 Evaluation harness

`tests/ai/` holds ~12 golden goal fixtures across domains (including two deliberately unrealistic and one vague). Assertions target **structure, not prose**: schema validity, invariant satisfaction, DAG acyclicity, effort within capacity, milestone dates within horizon, question count ≤4, and correct verdict on the known-unrealistic fixtures. Runs against a recorded-response cache by default; live mode is opt-in via env flag.

---

## 6. Routes & UI

### 6.1 Route map

| Route | Render | Purpose |
| --- | --- | --- |
| `/` | static | Landing. One large input: "What do you want to accomplish?" |
| `/start` | client + SSE | Intake: clarify → answer ≤4 questions → assessment → auth → first plan |
| `/goals` | RSC | Goal list. Free tier shows one active goal + archive. |
| `/goals/[id]` | RSC | Overview: signals, milestone timeline, next actions, current risks |
| `/goals/[id]/today` | RSC + island | **Default landing.** Today's plan at three tiers. The execution surface. |
| `/goals/[id]/week` | RSC | Weekly outcomes, task board, capacity budget |
| `/goals/[id]/map` | RSC + island | Goal graph: milestones, projects, dependencies, critical path |
| `/goals/[id]/reflect` | RSC + island | Weekly reflection → synthesis → replan proposal |
| `/goals/[id]/history` | RSC | Plan versions, replan log, accepted/rejected adaptations |
| `/goals/[id]/settings` | RSC | Capacity, constraints, target date, pause/archive |
| `/settings/account` | RSC | Profile, timezone, tier |
| `/settings/ai` | RSC | BYOK key management |
| `/auth/callback`, `/auth/sign-in` | — | Supabase auth |

### 6.2 The onboarding flow (the highest-stakes surface)

```
Landing
  └─ user types goal, presses Enter
      └─ [clarify]  ~3s   → normalized outcome + ≤4 questions, one screen
          └─ user answers (skippable; defaults inferred)
              └─ [assess] ~4s → feasibility verdict shown honestly
                  ├─ realistic / ambitious → "Build my plan"
                  └─ unrealistic → fork:
                        [Extend the timeline]  [Narrow the outcome]  [Proceed anyway]
                      └─ auth gate (magic link / Google)
                          └─ [decompose] + [plan_week] ~25s with staged progress
                              └─ /goals/[id]/today
```

**Auth is gated after value, before persistence.** The feasibility verdict is delivered free and unauthenticated; saving the plan requires an account. The pre-auth draft is held in a signed, short-lived server-side draft record keyed by an httpOnly cookie, so nothing is lost across the auth redirect.

Target: goal typed → first plan visible in **under 90 seconds**, with ≤4 questions.

### 6.3 Major UI states

Every data surface must implement all of these. No dead ends: every error state carries a specific recovery action.

| State | Requirement |
| --- | --- |
| **Empty — no goal** | Landing-style prompt, one input, one example. Never an empty table. |
| **Empty — no data yet** | Signals show "Not enough data yet — check back after 7 days of execution," not `0%`. |
| **Loading — fast (<1s)** | Skeletons matching final layout. No spinners. |
| **Loading — generation (5–40s)** | Staged, honest progress: "Assessing feasibility → Mapping milestones → Finding dependencies → Building week 1." Cancellable. Never a bare spinner. |
| **Streaming partial** | Show milestones as they resolve; the plan assembles visibly. |
| **AI validation failure** | "We couldn't produce a reliable plan. Retry" + "Adjust my answers." Never raw error text, never a broken plan. |
| **Quota exceeded** | Explain the limit, show reset time, offer BYOK. Read paths stay fully functional. |
| **Provider unavailable** | Today's plan falls back to deterministic tier selection; banner explains advanced features are degraded. Execution never blocks. |
| **Off track** | Non-punitive framing: "Week 3 is behind. Here's the smallest change that keeps this real." One primary action. |
| **Replan proposed** | Side-by-side diff, reasons, stated trade-offs, explicit Accept / Reject / Modify. Never auto-applied. |
| **Milestone complete** | Requires evidence. Quiet acknowledgement, then "what's next." No confetti. |
| **Chaotic day** | Minimum-viable day is always one tap away and always visible on `/today`. |
| **Offline / stale** | Today's tasks render from cached RSC payload; completion queues and reconciles. |

### 6.4 Design direction

Restrained, typographic, information-dense without clutter. Text-forward — this product is read, not decorated.

- **Type:** one high-quality sans for UI, tabular numerals for all metrics. Strict scale, generous line height, max ~68ch measure for prose.
- **Color:** neutral base; a single accent. Health states use a three-step semantic scale (`on_track` / `at_risk` / `off_track`) that is **never color-only** — always paired with a label or icon.
- **Motion:** purposeful only — state transitions and progress. Respect `prefers-reduced-motion`.
- **Mobile:** `/today` is designed mobile-first; it is the surface used daily, often standing up.
- **Accessibility:** WCAG 2.2 AA. Full keyboard navigation, visible focus rings, correct landmarks and headings, live regions for generation progress, ≥44px touch targets. `Cmd/Ctrl+K` command palette; `T` today, `W` week, `M` map.
- **Language:** no "AI," "agent," "prompt," "token," "LLM," or "model" anywhere in the primary UI. The system speaks about plans, weeks, risks, and evidence.

---

## 7. Validation strategy

Five layers, outermost to innermost:

1. **Client form validation** — zod schemas shared with the server via `react-hook-form` resolvers. UX only; never trusted.
2. **Server action / route boundary** — every mutation begins with `schema.parse(input)` plus an ownership assertion (`assertGoalOwner(userId, goalId)`). No action reads raw input.
3. **AI output validation** — provider structured mode → zod parse → one repair pass → hard failure surfaces as a recoverable UI state (§5.4).
4. **Domain invariants** (`lib/domain/invariants.ts`) — semantic rules zod cannot express:
   - milestone `target_date` ordering is consistent with `blocks` dependencies
   - the `blocks` graph is acyclic
   - every project has a verification criterion and a non-zero estimate
   - every milestone target date ≤ goal target date
   - weekly planned effort ≤ ideal-day budget × days per week
   - each week has ≥1 weekly outcome and ≤5 initial tasks
   - the three day tiers satisfy `minimum ≤ normal ≤ ideal`, and every day with planned work has a non-empty minimum-viable subset
   - no task without a `why` and a parent outcome
   - every plan week falls inside `[horizon_start, horizon_end]`
5. **Database constraints** — CHECKs, uniques, FKs, the acyclicity trigger, and RLS as the final authority.

Invariant violations from AI output are **repaired deterministically where possible** (drop the cyclic edge, clamp the effort, trim excess tasks by lowest priority) and logged to `ai_runs.status = 'invariant_failed'` for prompt iteration. Only unrepairable violations reach the user.

---

## 8. Server actions & API surface

All mutations are Server Actions except long-running generation, which uses SSE route handlers.

### 8.1 Server Actions (`src/server/actions/`)

```ts
// goal
createGoalDraft(input: { rawInput: string })                        → { draftId, clarification }
answerIntake(input: { draftId | goalId, answers })                  → { assessment }
commitGoal(input: { draftId, choice: 'proceed'|'extend'|'narrow' }) → { goalId }
updateGoal(input: { goalId, title?, outcomeStatement?, targetDate? })
setGoalStatus(input: { goalId, status })
archiveGoal(input: { goalId })

// constraints & capacity
upsertConstraint(input: { goalId, kind, label, value…, isHard })
deleteConstraint(input: { constraintId })
setCapacityProfile(input: { goalId, ideal, normal, minimum, daysPerWeek, preferredDays, blackoutDates, effectiveFrom })
  // → may enqueue a `capacity_changed` replan proposal

// graph (manual editing — the user is always in control)
updateNode(input: { nodeId, title?, summary?, verification?, targetDate?, estimatedMinutes? })
setNodeStatus(input: { nodeId, status })     // 'complete' requires evidence for milestones
addDependency(input: { fromNodeId, toNodeId, type })
removeDependency(input: { dependencyId })

// execution
completeTask(input: { taskId, evidence? })
skipTask(input: { taskId, reason? })
deferTask(input: { taskId, toDate })
addTask(input: { planWeekId, title, effortMinutes, tier, weeklyOutcomeId? })
reorderTasks(input: { planWeekId, orderedIds })
submitCheckIn(input: { goalId, kind, occurredOn, minutesAvailable?, minutesSpent?, energy?, note? })
selectDayTier(input: { goalId, date, tier })    // ideal | normal | minimum
attachEvidence(input: { subject, kind, url? | body? | storagePath? })

// reflection & adaptation
submitReflection(input: { goalId, planWeekId, whatWorked, whatDidnt, blockers })
requestReplan(input: { goalId, reason?: string })
respondToReplan(input: { replanEventId, accept: boolean, modifiedOps?: PlanOp[] })

// account
updateProfile(input: { displayName?, timezone? })
saveApiKey(input: { provider, apiKey })      // verifies, encrypts, stores; never echoes
deleteApiKey(input: { provider })
```

### 8.2 Route handlers

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/ai/generate` | POST (SSE) | Initial plan: `decompose` → invariants → `plan_week` → schedule → persist. Emits staged progress events. |
| `/api/ai/replan` | POST (SSE) | Diagnosis → `replan` → patch preview (does **not** persist until accepted) |
| `/api/ai/day` | POST | `plan_day` for a given date; deterministic fallback on failure |
| `/api/health` | GET | Liveness + provider reachability |

SSE event shape: `{ stage, label, progress, partial? }`. If the client disconnects mid-generation, the server completes and persists the work; on reconnect the client reads `plans.status` and resumes — generation is never lost to a refresh.

### 8.3 Scheduled work

A single Vercel Cron job (`/api/cron/daily`, service-role authenticated):

1. Compute `goal_signals` for every active goal (deterministic, no AI).
2. Evaluate replan triggers; create `replan_events` in a *proposed* state.
3. Roll forward the current `plan_week` when a week boundary passes in the user's timezone.

No AI runs in cron. The diagnosis narrative is generated lazily when the user opens the proposal — this keeps cost bounded and proportional to actual engagement.

---

## 9. Free tier & BYOK

| | Free (no key) | BYOK |
| --- | --- | --- |
| Active goals | 1 | 5 |
| Model | Gemini fast tier | User's chosen provider/model, pro tier |
| Heavy ops (`decompose`, `plan_week`, `replan`) | 8 / rolling 30 days | Unlimited (user's own quota) |
| Light ops (`clarify`, `assess`, `plan_day`, `progress`, `reflect`) | 20 / day | Unlimited |
| Replanning | Standard patches | Deeper diagnosis, larger context window, multi-option patches |
| History retained in prompts | Last 4 weeks | Full history |

**The user never encounters the words "API key" during onboarding.** BYOK is discovered at `/settings/ai`, or offered contextually the first time a limit is reached — with a plain explanation of what it buys.

Quota exhaustion never blocks execution: completing tasks, checking in, attaching evidence, and viewing plans always work. Only new generation is limited.

---

## 10. Security

- **Server keys never reach the browser.** `GEMINI_API_KEY` and `BYOK_ENCRYPTION_KEY` are server-only env vars, never `NEXT_PUBLIC_*`. No AI call is ever made from a client component.
- **BYOK at rest:** AES-256-GCM via Node `crypto`, key from `BYOK_ENCRYPTION_KEY` (32 bytes, base64). Ciphertext, IV, and auth tag stored separately. Decryption occurs only inside `lib/ai/registry.ts` on the server, per request, never cached to disk.
- **BYOK never returned:** the client can read only `provider`, `key_hint`, `last_verified_at`. Enforced by column-level grants, not by application discipline alone.
- **No secrets in logs.** `lib/security/redact.ts` scrubs anything matching key patterns from all log paths. `ai_runs` stores metadata only — never prompt or response bodies, which contain personal goal data.
- **RLS is the authority.** The service-role client is used only in cron and BYOK decryption, never in a user-facing request path.
- **User content is user data.** Goals are personal. No third-party analytics receives goal text. Provider calls are the only egress, and BYOK users' data goes to their own provider account.
- **Rate limiting** on `/api/ai/*` per user and per IP, above the tier quotas, to bound abuse.

---

## 11. Acceptance criteria — core loop

The core loop is complete when every criterion below passes. These are the E2E test plan.

### AC-1 · Goal capture
1. A visitor types a goal on `/` and sees a normalized outcome statement plus **≤4** clarifying questions within 5s.
2. Skipping every optional question still yields a plan; the system infers defaults and marks them as assumptions.
3. `goals.raw_input` matches the typed text exactly after the full flow.

### AC-2 · Honest assessment
4. For the flagship input ("PM at a top tech company within 12 months") with 5 h/week and no PM experience, the verdict is `ambitious_but_possible` with named risks.
5. For a deliberately unrealistic input (e.g. "become a surgeon in 6 months" at 3 h/week), the verdict is `unrealistic_as_stated`, **no plan for the stated outcome is generated**, and a concrete alternative with a specific horizon and narrowed outcome is offered.
6. Every assessment is persisted and viewable later at `/goals/[id]/history`.

### AC-3 · Decomposition
7. Decomposition yields 3–5 milestones, each with ≥1 project and an explicit `verification` criterion.
8. At least one non-trivial `blocks` dependency exists and the graph is acyclic (DB trigger holds under a fuzz test of 200 generated graphs).
9. `/goals/[id]/map` renders the graph with the critical path visually distinguished.
10. Total estimated effort across all projects is within ±25% of `horizon_weeks × ideal_minutes × days_per_week`; violations trigger repair before persistence.

### AC-4 · Planning
11. An active plan exists with weeks covering `horizon_start → horizon_end`, and `one_active_plan_per_goal` holds.
12. Week 1 has 1–3 weekly outcomes and ≤5 tasks, each with a `why` and a parent outcome.
13. No week's planned effort exceeds that week's `capacity_minutes`.
14. Time from goal submission to a rendered plan is **<90s** at p50 and <150s at p95.

### AC-5 · Execution
15. `/goals/[id]/today` shows exactly three selectable day tiers whose totals match the active capacity profile's minimum/normal/ideal minutes (±20%).
16. Selecting the minimum-viable day yields a non-empty, genuinely progress-bearing task set on every day with any planned work.
17. Completing a task updates status, timestamps, week progress, and next-day planning inputs in one round trip.
18. A milestone cannot be marked complete without attached evidence of kind ≠ `self_attest`.
19. With the AI provider forced to fail, `/today` still renders a deterministic tiered plan and all execution actions succeed.

### AC-6 · Progress & signals
20. After 14 days of simulated execution, `goal_signals` contains momentum, execution rate, plan confidence, risk, and projected completion for each day.
21. Every displayed signal exposes a "why this number" explanation derived from `goal_signals.explanation` — with the AI disabled.
22. With <7 days of data, signals render "not enough data yet" rather than a misleading 0.

### AC-7 · Reflection
23. At week end, `/reflect` prompts three questions and shows actual execution data alongside them.
24. Submitting a reflection produces a synthesis with ≥1 concrete, specific recommendation and no motivational filler.
25. Reflections are retained and visible in history.

### AC-8 · Adaptation — *the differentiator*
26. Simulating 2 weeks at 30% execution automatically raises a `low_execution` replan proposal.
27. Reducing weekly capacity by >25% raises a `capacity_changed` proposal within one cron cycle.
28. Simulating 2 weeks at 150% execution raises an `ahead_of_schedule` proposal that pulls work forward or raises ambition.
29. Every proposal renders a before/after diff with per-op reasons and explicit trade-offs.
30. Accepting creates plan version N+1, marks version N `superseded`, and preserves all history; rejecting records the rejection and leaves the plan untouched.
31. A rejected adaptation is not re-proposed for the same trigger within 7 days.
32. After acceptance, `/today` reflects the new plan on the next render.

### AC-9 · Quality bar
33. Lighthouse ≥95 accessibility on `/`, `/today`, `/week`, `/map`.
34. Full keyboard traversal of the core loop with no mouse, with visible focus throughout.
35. `/today` is fully usable at 360px width.
36. No string containing "AI", "prompt", "token", "LLM", or "model" appears in primary UI copy (enforced by a lint test over user-facing strings).
37. Every error state offers a specific recovery action; no dead ends (audited across all states in §6.3).
38. All 12 evaluation fixtures pass their structural assertions.

---

## 12. Risks

| # | Risk | Severity | Mitigation |
| --- | --- | --- | --- |
| R1 | **Generic plans.** Output is plausible but not genuinely useful — the failure mode that kills this product. | Critical | Verification criteria required per node; task `why` required; volume caps; eval fixtures scored on structure; domain-specific prompt exemplars for the flagship career case. |
| R2 | **Week-2 abandonment.** Users love the plan, stop executing. | Critical | Minimum-viable day; non-punitive off-track framing; adaptation instead of guilt; check-in under 10s. This is the metric to instrument first. |
| R3 | **Over-planning.** Users tune the plan instead of doing the work. | High | `/today` is the default landing surface; graph editing is deliberately secondary; replans require an explicit trigger. |
| R4 | **First-plan latency.** 25–40s is a long silence. | High | Staged SSE progress; render milestones as they resolve; server completes generation even if the client disconnects. |
| R5 | **Gemini schema-subset limits** break structured outputs. | High | Schema adapter with build-time validation; flat schemas; enum discriminators instead of unions; repair pass. |
| R6 | **Timezone/date bugs** in daily and weekly boundaries. | High | All date math in `lib/domain/dates.ts` against the user's IANA timezone; `date` columns only (never `timestamptz`) for plan/task dates; property tests across DST transitions. |
| R7 | **Free-tier cost** exceeds sustainable limits. | Medium | Heavy ops capped at 8/30d; no AI in cron; lazy diagnosis narrative; fast model on free tier. |
| R8 | **Cyclic or malformed graphs** from model output. | Medium | DB trigger + pre-persist deterministic repair + fuzz test (AC-3.8). |
| R9 | **BYOK key leakage.** | Medium | Column-level grants, server-only decryption, redaction in logs, metadata-only `ai_runs`. |
| R10 | **Feasibility judgements are wrong** — telling an ambitious user "no" incorrectly. | Medium | Three-tier verdict rather than binary; confidence and `comparable_basis` always shown; "Proceed anyway" is always available with recorded risks. Never a hard block. |
| R11 | Signals mislead early on thin data. | Medium | Explicit `data_sufficiency` gating; "not enough data" states; confidence surfaced everywhere. |

---

## 13. Open assumptions

These are decisions made unilaterally to avoid blocking. Each is cheap to revisit.

1. **Single-user, single-tenant.** No sharing, no coaching, no accountability partners in v1.
2. **English only.** Copy is not internationalized.
3. **Weeks start Monday** in the user's timezone; not user-configurable in v1.
4. **One goal is the free-tier norm.** Multi-goal is a BYOK affordance, not the default mental model. Cross-goal capacity contention is explicitly out of scope.
5. **Feasibility is judged from model priors,** not a retrieval corpus of real outcome data. `comparable_basis` exists to make that limitation visible. A grounded corpus is a strong v2 differentiator.
6. **Effort estimates come from the model and are corrected by realized data** over time. There is no calibration model in v1 beyond trailing execution rate.
7. **Evidence is lightweight** — a link, a note, or a file. The evidence itself is not verified.
8. **`plan_day` is model-assisted but degradable.** A deterministic tier packer is the fallback and is always correct-if-blunt.
9. **Cron runs once daily at 03:00 UTC**, so signals may lag up to 24h for users in some timezones. Acceptable for v1; per-timezone bucketing is a follow-up.
10. **No notifications** (email/push) in v1. Re-engagement is a known gap and the most likely first addition once the loop is proven.
11. **Anthropic and OpenAI providers ship as stubs.** The abstraction is proven by the interface and the registry, not by three live integrations.
12. **Free-tier limits (8 heavy / 20 light) are a starting guess** to be tuned from `ai_runs` cost data after launch.

---

## 14. Build order

Each phase ends in something demonstrable. Phases 1–5 constitute the complete core loop.

| Phase | Deliverable | Gate |
| --- | --- | --- |
| **0 · Foundation** | Next.js + Tailwind + shadcn scaffold, Supabase project, migrations, RLS, generated types, auth | Sign in, read/write a row under RLS |
| **1 · Capture & assess** | Landing, `clarify` + `assess`, provider abstraction, `run.ts`, draft persistence, auth gate | AC-1, AC-2 |
| **2 · Graph** | `decompose`, invariants, graph engine, `/map` | AC-3 |
| **3 · Plan** | `plan_week`, scheduler, plan versioning, `/week`, SSE generation | AC-4 |
| **4 · Execute** | `/today`, three tiers, `plan_day`, completion, evidence, check-ins | AC-5 |
| **5 · Signals, reflect, adapt** | `signals.ts`, cron, `/reflect`, replan triggers, `PlanPatch`, diff UI, `/history` | AC-6, AC-7, AC-8 |
| **6 · Polish & BYOK** | Empty/error/loading states, a11y pass, mobile, `/settings/ai`, quotas, eval harness | AC-9 |
