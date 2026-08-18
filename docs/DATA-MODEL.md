# Trajectory — Data Model

This is the as-migrated reference for the Postgres/Supabase schema: every
table, its columns, keys, and constraints, as they actually exist across
`supabase/migrations/`. For *why* the schema is shaped this way, see
`docs/PRODUCT-ARCHITECTURE.md` §3 (domain model) and §4 (database schema) —
that document is the design rationale; this one is the implementation record,
kept in sync with it.

**Migrations, in order:**

1. `20260813214337_initial_schema.sql` — v1: all core tables, enums, RLS.
2. `20260813223407_usage_counter_rpc.sql` — `increment_usage_counter` RPC for §5.12 quota enforcement.
3. `20260818120000_v2_data_integrity.sql` — the three schema fixes the v2 architecture review (`PRODUCT-ARCHITECTURE.md` §15) flagged as launch-blocking. See §7 below.

---

## 1. Conventions

- Every table carries `user_id uuid not null references auth.users(id) on delete cascade`.
- Every table has RLS enabled with a single `owner_all` policy: `using (auth.uid() = user_id) with check (auth.uid() = user_id)` — except `profiles` (`auth.uid() = id`) and `user_credentials` (see §6).
- `updated_at` is maintained by a shared `set_updated_at()` trigger where present.
- Primary keys are `uuid default gen_random_uuid()` unless noted.
- As of migration 3, every table that carries both `goal_id` and `user_id` enforces ownership consistency structurally via a **composite FK** `foreign key (goal_id, user_id) references goals (id, user_id)`, not just a single-column `goal_id` FK — see §7.2.

---

## 2. Enums

| Enum | Values |
| --- | --- |
| `goal_status` | `draft`, `active`, `paused`, `achieved`, `abandoned`, `rescoped` |
| `feasibility_verdict` | `realistic`, `ambitious_but_possible`, `unrealistic_as_stated` |
| `node_kind` | `milestone`, `project` |
| `node_status` | `not_started`, `in_progress`, `blocked`, `complete`, `dropped` |
| `node_health` | `on_track`, `at_risk`, `off_track`, `unknown` |
| `node_origin` [v2] | `ai`, `user`, `ai_edited` |
| `dependency_type` | `blocks`, `informs` |
| `plan_status` | `generating`, `draft`, `active`, `superseded`, `failed` |
| `plan_source` | `initial`, `replan`, `manual` |
| `task_tier` | `minimum`, `normal`, `ideal` |
| `task_status` | `pending`, `done`, `skipped`, `deferred`, `dropped` |
| `checkin_kind` | `daily`, `weekly` |
| `evidence_kind` | `link`, `text`, `file`, `self_attest` |
| `constraint_kind` | `time`, `money`, `hard_date`, `commitment`, `preference`, `prohibition` |
| `replan_trigger` | `user_requested`, `low_execution`, `milestone_off_track`, `capacity_changed`, `ahead_of_schedule`, `missed_checkins`, `priority_change`, `dependency_change` |
| `ai_module` | `clarify`, `assess`, `decompose`, `plan_week`, `plan_day`, `progress`, `reflect`, `replan` |
| `user_tier` | `free`, `byok` |

---

## 3. Entity map

```
User
 └─ Goal ──────────────────────────────────────────────────────────┐
     ├─ GoalIntake (1:1)          onboarding Q&A                   │
     ├─ FeasibilityAssessment*    versioned verdict                │
     ├─ Constraint*               typed limits                     │
     ├─ CapacityProfile*          effective-dated ideal/normal/min │
     ├─ GoalNode graph            kind=milestone|project, DAG      │
     │    ├─ NodeDependency edges (blocks|informs)                 │
     │    └─ GraphRevision*  [v2] immutable whole-graph snapshots  │
     ├─ Plan* (one active)                                         │
     │    └─ PlanWeek                                              │
     │         ├─ WeeklyOutcome → project GoalNode                 │
     │         └─ Task (tiered daily action)                       │
     ├─ CheckIn* (daily/weekly)                                    │
     ├─ Evidence → task | weekly outcome | node                    │
     ├─ Reflection* (weekly)                                       │
     ├─ ReplanEvent* (trigger → diagnosis → patch → accepted?)     │
     └─ GoalSignal* (daily deterministic snapshot)                 │
                                                                    │
AI observability: AIRun*, UsageCounter*  ──────────────────────────┘
Identity: Profile (1:1 with auth.users), UserCredential* (BYOK)
```

`*` = many per goal / user. Full column-level definitions follow.

---

## 4. Identity

### `profiles`
1:1 with `auth.users`. `id uuid primary key references auth.users(id)`.
| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | = `auth.users.id` |
| `display_name` | text? | |
| `timezone` | text | default `'UTC'` |
| `tier` | `user_tier` | default `'free'` |
| `onboarded_at` | timestamptz? | |
| `created_at`, `updated_at` | timestamptz | |

Auto-provisioned by `handle_new_user()` trigger on `auth.users` insert.

### `user_credentials` — BYOK
| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `user_id` | uuid | FK `auth.users`, cascade |
| `provider` | text | `check in ('gemini','openai','anthropic')` |
| `ciphertext`, `iv`, `auth_tag` | bytea | AES-256-GCM |
| `key_hint` | text | last 4 chars only |
| `last_verified_at` | timestamptz? | |
| `created_at` | timestamptz | |

`unique (user_id, provider)`. Client roles have **no `select` on `ciphertext`** — see §6.

---

## 5. Goal, assessment, constraints, capacity

### `goals`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `user_id` | uuid | FK `auth.users`, cascade |
| `raw_input` | text | immutable, verbatim user input |
| `title` | text | |
| `outcome_statement` | text | AI-normalized, user-editable |
| `domain` | text? | career / skill / business / fitness / finance / project / other |
| `target_date` | date? | |
| `horizon_weeks` | int? | `check between 1 and 260` |
| `status` | `goal_status` | default `'draft'` |
| `started_on` | date? | |
| `archived_at` | timestamptz? | |
| `created_at`, `updated_at` | timestamptz | |

Index: `(user_id, status)`. **[v2]** `unique (id, user_id)` — the target every other goal-scoped table's composite FK references (§7.2).

### `goal_intake` — 1:1 with `goals`
`goal_id uuid primary key references goals(id)`. Columns: `questions jsonb`, `answers jsonb`, `starting_point text?`, `motivation text?`, `completed_at timestamptz?`, `created_at`.

### `feasibility_assessments` — versioned, append-only
`verdict feasibility_verdict`, `confidence numeric(3,2) check between 0 and 1`, `rationale text`, `key_risks jsonb`, `comparable_basis text?`, `alternative jsonb?`. Index `(goal_id, created_at desc)`.

### `constraints`
`kind constraint_kind`, `label text`, `value_numeric`/`value_date`/`value_text`, `is_hard boolean default true`.

### `capacity_profiles` — effective-dated
`effective_from date`, `ideal_minutes`/`normal_minutes`/`minimum_minutes int` (each range-checked, and `minimum ≤ normal ≤ ideal`), `days_per_week int check 1..7`, `preferred_days int[]` (ISO weekday), `blackout_dates date[]`, `note text?`. Index `(goal_id, effective_from desc)`.

---

## 6. Goal graph

### `goal_nodes`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `goal_id`, `user_id` | uuid | composite owner FK [v2] |
| `kind` | `node_kind` | `milestone` \| `project` |
| `parent_id` | uuid? | FK self, cascade |
| `title`, `summary?`, `verification` | text | `verification` = how we know it's genuinely done |
| `sequence` | int | default 0 |
| `target_date` | date? | |
| `estimated_minutes` | int? | projects only |
| `status` | `node_status` | default `'not_started'` |
| `health` | `node_health` | default `'unknown'` |
| `origin` | `node_origin` [v2] | default `'ai'` |
| `completed_at` | timestamptz? | |
| `dropped_at` | timestamptz? [v2] | set when `status` transitions to `'dropped'` |
| `dropped_reason` | text? [v2] | |
| `created_at`, `updated_at` | timestamptz | |

Constraints: `milestone_has_no_parent`, `project_has_parent`, `project_has_estimate`. Indexes: `(goal_id, kind, sequence)`, `(parent_id)`.

**[v2] Append-only.** Nothing deletes a `goal_nodes` row. `drop_project` (a replan op) sets `status='dropped'`, `dropped_at`, `dropped_reason` — see `src/server/actions/replan.ts`. A dropped node is excluded from active planning but stays in the graph and in every `graph_revisions` snapshot taken before it was dropped.

### `node_dependencies`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `goal_id`, `user_id` | uuid | composite owner FK [v2] |
| `from_node_id`, `to_node_id` | uuid | FK `goal_nodes`, cascade |
| `type` | `dependency_type` | default `'blocks'` |
| `rationale` | text? | |
| `removed_at` | timestamptz? [v2] | soft-delete marker |
| `removed_reason` | text? [v2] | |
| `created_at` | timestamptz | |

`check (from_node_id <> to_node_id)`. Index `(goal_id)`.

**[v2] Live-row uniqueness.** The v1 table-level `unique (from_node_id, to_node_id, type)` was replaced with a **partial** unique index `node_dependencies_live_key on (from_node_id, to_node_id, type) where removed_at is null` — a removed edge frees its key so the replanner can later re-add the identical edge without a constraint conflict, while two *live* edges with the same key are still rejected.

**Acyclicity** (`blocks` edges only): `assert_dependency_acyclic()` trigger runs a recursive reachability check before insert/update, and — as of migration 3 — ignores edges where `removed_at is not null`, since a removed edge can no longer create a cycle. Application code never hard-deletes an edge; `src/server/actions/replan.ts`'s `remove_dependency` op does `update(removed_at, removed_reason)` filtered to live rows only.

### `graph_revisions` [v2] — immutable whole-graph snapshots
| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `goal_id`, `user_id` | uuid | composite FK → `goals(id, user_id)`, cascade |
| `revision` | int | monotonic per goal; `unique (goal_id, revision)` |
| `snapshot` | jsonb | `{ nodes: [...], edges: [...] }`, fully materialized (live rows only) |
| `reason` | text | `'initial'` \| `'replan'` \| `'manual_edit'` |
| `replan_event_id` | uuid? | FK `replan_events` |
| `created_at` | timestamptz | |

Written by `snapshotGraphRevision()` (`src/server/actions/graph-revisions.ts`), called after `decomposeGoal()` (reason `'initial'`) and after `applyPlanPatch()` (reason `'replan'`, tagged with the triggering `replan_events.id`). This is what lets a superseded plan render the graph exactly as it stood when it was generated, including projects later dropped — nothing about the graph is ever destructively overwritten.

---

## 7. Plan, weeks, outcomes, tasks

### `plans`
`version int`, `status plan_status` default `'generating'`, `source plan_source`, `supersedes_id uuid? references plans(id)`, `horizon_start`/`horizon_end date`, `rationale text?`, `generated_at`, `activated_at timestamptz?`. `unique (goal_id, version)`; partial unique index `one_active_plan_per_goal on (goal_id) where status='active'` — at most one active plan per goal, ever.

### `plan_weeks`
`plan_id` FK cascade, `week_index int`, `starts_on`/`ends_on date`, `theme text?`, `capacity_minutes int`. `unique (plan_id, week_index)`; index `(goal_id, starts_on)`.

### `weekly_outcomes`
`plan_week_id` FK cascade, `project_node_id uuid? references goal_nodes(id) on delete set null`, `statement`/`success_criteria text`, `priority int default 1` (1 = highest leverage), `status node_status`, `completed_at timestamptz?`. Index `(plan_week_id, priority)`.

### `tasks`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `plan_week_id` | uuid | FK `plan_weeks`, cascade |
| `weekly_outcome_id` | uuid? | FK `weekly_outcomes`, set null |
| `project_node_id` | uuid? | FK `goal_nodes`, set null |
| `goal_id`, `user_id` | uuid | |
| `title`, `why?` | text | `why` = one line linking task → outcome |
| `effort_minutes` | int | `check between 5 and 480` |
| `tier` | `task_tier` | default `'normal'` |
| `scheduled_for` | date? | |
| `sequence` | int | default 0 |
| `status` | `task_status` | default `'pending'` |
| `blocked_by_task_id` | uuid? | FK self, set null |
| `is_user_added` | boolean | default false |
| `completed_at`, `created_at` | timestamptz | |

Indexes: `(goal_id, scheduled_for, status)`, `(plan_week_id, sequence)`.

---

## 8. Execution & feedback

### `checkins`
`kind checkin_kind`, `occurred_on date`, `minutes_available?`, `minutes_spent?`, `energy int? check 1..5`, `note text?`. `unique (goal_id, kind, occurred_on)`.

### `evidence`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `goal_id`, `user_id` | uuid | composite owner FK [v2] |
| `task_id` | uuid? | FK `tasks`, **restrict** [v2, was cascade] |
| `weekly_outcome_id` | uuid? | FK `weekly_outcomes`, **restrict** [v2, was cascade] |
| `node_id` | uuid? | FK `goal_nodes`, **restrict** [v2, was cascade] |
| `kind` | `evidence_kind` | |
| `url`, `body`, `storage_path` | text? | |
| `created_at` | timestamptz | |

`exactly_one_subject`: exactly one of `task_id` / `weekly_outcome_id` / `node_id` is set.

**[v2] Restrict, not cascade.** v1 cascaded evidence deletion from its subject — deleting a task silently destroyed the user's proof of work. Nothing in the product issues `delete` against `tasks` / `weekly_outcomes` / `goal_nodes` for rows that have evidence attached, and the database now refuses rather than silently losing it.

### `reflections`
`plan_week_id uuid? references plan_weeks(id) on delete set null`, `what_worked`/`what_didnt`/`blockers text?`, `ai_synthesis jsonb?` (`{summary, patterns[], recommendation, confidence}`). `unique (goal_id, plan_week_id)`.

### `replan_events`
`trigger replan_trigger`, `trigger_detail jsonb`, `diagnosis text`, `patch jsonb` (a `PlanOp[]`), `from_plan_id`/`to_plan_id uuid? references plans(id)`, `accepted boolean?`, `responded_at timestamptz?`. Index `(goal_id, created_at desc)`.

### `goal_signals`
Daily deterministic snapshot: `captured_on date`, `momentum numeric(4,1)`, `execution_rate numeric(4,3)`, `plan_confidence numeric(3,2)`, `risk_level node_health`, `projected_completion_date date?`, `inputs jsonb` (raw counters), `explanation jsonb` (per-signal `{value, basis, caveat}`). `unique (goal_id, captured_on)`.

---

## 9. AI observability & limits

### `ai_runs`
`module ai_module`, `provider text`, `model text`, `prompt_version text`, `used_byok boolean`, `status text` (`ok` \| `schema_invalid` \| `invariant_failed` \| `provider_error` \| `timeout`), `attempts int`, `input_tokens?`/`output_tokens?`, `latency_ms?`, `error_code text?` — always redacted of secrets before insert (`lib/security/redact.ts`) since a BYOK caller's raw key can appear in provider SDK error text. `goal_id uuid? references goals(id) on delete set null` (pre-auth clarify/assess calls have no goal yet). Index `(user_id, created_at desc)`.

### `usage_counters`
Composite PK `(user_id, period_start, module_class)`. `count int`. Incremented via the `increment_usage_counter` RPC (migration 2) for atomicity under concurrent requests.

---

## 10. Row-level security

Every table: `enable row level security` plus `owner_all`: `using (auth.uid() = user_id) with check (auth.uid() = user_id)`, except:

- **`profiles`**: `auth.uid() = id`.
- **`user_credentials`**: `revoke select`, then `grant select (id, user_id, provider, key_hint, last_verified_at, created_at)` to `anon, authenticated` — **`ciphertext`, `iv`, `auth_tag` are not selectable from the client at all**, at the column-grant level, not just via RLS. Decryption happens server-side with the service-role client (`lib/db/admin.ts`) using a key from `lib/env/server.ts`.

**[v2] Composite ownership FKs.** RLS's `auth.uid() = user_id` alone permits inserting a row that carries the caller's own `user_id` but someone else's `goal_id` — the policy check passes, and a single-column `goal_id` FK also passes, because it only checks that the goal exists, not that it belongs to the same user. Migration 3 replaces every goal-scoped table's single-column `goal_id` FK with `foreign key (goal_id, user_id) references goals (id, user_id)`, against a new `goals` `unique (id, user_id)`. This makes a cross-tenant row structurally unrepresentable — RLS remains the authority for *reads*, the composite FK is the authority for *ownership consistency*. Applies to: `goal_intake`, `feasibility_assessments`, `constraints`, `capacity_profiles`, `goal_nodes`, `node_dependencies`, `plans`, `plan_weeks`, `weekly_outcomes`, `tasks`, `checkins`, `evidence`, `reflections`, `replan_events`, `goal_signals`, `graph_revisions`. (`ai_runs.goal_id` is nullable/`set null` and intentionally excluded — pre-auth AI calls have no goal yet.)

---

## 11. What changed in migration 3, and what's still open

Migration 3 implements exactly the three items `PRODUCT-ARCHITECTURE.md` §15 named as blocking a real launch:

1. `evidence` FKs `cascade` → `restrict` (§8).
2. Composite `(goal_id, user_id)` FKs everywhere (§10).
3. Append-only graph: `goal_nodes`/`node_dependencies` soft-delete columns + `graph_revisions` (§6).

**Deliberately not in scope here** — tracked as open follow-up against `PRODUCT-ARCHITECTURE.md` §4.2's remaining v2 additions, none of which are migrated yet:

- `goal_revisions` (auditable outcome-statement history) and `goals.timezone`/`revision`/`completed_at`.
- Replan proposal lifecycle: `replan_status`, `base_plan_version`, `base_graph_revision`, `expires_at`, `high_impact`, storm control (`one_open_proposal_per_goal`), stale-patch revalidation.
- Task lapse/missed handling: `task_status` gaining `'missed'`, `origin`, `carried_from_task_id`, `lapse_count`, `missed_at`; `in_week_shortfall` replan trigger.
- `ai_runs` cost/provenance columns (`estimated_cost_usd`, `context_tokens`, `context_truncated`, `refusal`, `subject_table`/`subject_id`) and `ai_run_id` back-references from `feasibility_assessments`/`reflections`/`replan_events`.
- `user_credentials.model_preference`/`last_failure_at`/`last_failure_code`/`revoked_at`.
- `plan_drafts`, `rate_limits`, `platform_spend`, `product_events` (pre-auth intake, serverless-safe rate limiting, spend circuit breaker, first-party funnel telemetry).
- `goal_nodes.actual_minutes` (realized-effort roll-up for estimate calibration).

None of these block data integrity the way the three implemented items did; they support v2's scheduler spec, adaptive-replanning levels, cost governance, and telemetry, which are larger, sequenced product work (`PRODUCT-ARCHITECTURE.md` §14, §15).
