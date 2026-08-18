-- Trajectory — v2 data-integrity fixes
-- Source: docs/PRODUCT-ARCHITECTURE.md §4.2 (v2 additions), §15 "Implementation status"
--
-- Implements the three schema changes the v2 architecture review flagged as
-- blocking a real launch, and only those three:
--
--   1. evidence FKs: on delete cascade → restrict. A user's proof of
--      completed work must never be destroyed as a side effect of deleting
--      the task/outcome/node it documents.
--   2. Composite (goal_id, user_id) FKs on every goal-scoped table. RLS
--      (auth.uid() = user_id) alone permits attaching a row that carries the
--      caller's own user_id but someone else's goal_id — the policy check
--      and the single-column FK both pass. The composite FK makes that row
--      unrepresentable.
--   3. Append-only graph: goal_nodes/node_dependencies gain soft-delete
--      columns, and graph_revisions stores immutable whole-graph snapshots,
--      so a superseded plan can still render the graph as it stood when it
--      was generated.
--
-- Everything else in §4.2 (goal_revisions, replan proposal lifecycle, task
-- lapse/missed handling, ai_runs cost columns, plan_drafts, rate_limits,
-- platform_spend, product_events, BYOK model_preference) is out of scope for
-- this migration — see docs/DATA-MODEL.md for the tracked gap.

-- ── 1. evidence: cascade → restrict ─────────────────────────────────────────
-- Nothing in the product may delete a piece of evidence as a byproduct of
-- deleting what it documents; the database now refuses instead of silently
-- destroying the user's proof of work.
alter table evidence
  drop constraint evidence_task_id_fkey,
  add  constraint evidence_task_fk
       foreign key (task_id) references tasks(id) on delete restrict,
  drop constraint evidence_weekly_outcome_id_fkey,
  add  constraint evidence_outcome_fk
       foreign key (weekly_outcome_id) references weekly_outcomes(id) on delete restrict,
  drop constraint evidence_node_id_fkey,
  add  constraint evidence_node_fk
       foreign key (node_id) references goal_nodes(id) on delete restrict;

-- ── 2. composite (goal_id, user_id) FKs ─────────────────────────────────────
alter table goals
  add constraint goals_id_user_key unique (id, user_id);

alter table goal_intake
  drop constraint goal_intake_goal_id_fkey,
  add  constraint goal_intake_goal_owner_fk
       foreign key (goal_id, user_id) references goals (id, user_id) on delete cascade;

alter table feasibility_assessments
  drop constraint feasibility_assessments_goal_id_fkey,
  add  constraint feasibility_assessments_goal_owner_fk
       foreign key (goal_id, user_id) references goals (id, user_id) on delete cascade;

alter table constraints
  drop constraint constraints_goal_id_fkey,
  add  constraint constraints_goal_owner_fk
       foreign key (goal_id, user_id) references goals (id, user_id) on delete cascade;

alter table capacity_profiles
  drop constraint capacity_profiles_goal_id_fkey,
  add  constraint capacity_profiles_goal_owner_fk
       foreign key (goal_id, user_id) references goals (id, user_id) on delete cascade;

alter table goal_nodes
  drop constraint goal_nodes_goal_id_fkey,
  add  constraint goal_nodes_goal_owner_fk
       foreign key (goal_id, user_id) references goals (id, user_id) on delete cascade;

alter table node_dependencies
  drop constraint node_dependencies_goal_id_fkey,
  add  constraint node_dependencies_goal_owner_fk
       foreign key (goal_id, user_id) references goals (id, user_id) on delete cascade;

alter table plans
  drop constraint plans_goal_id_fkey,
  add  constraint plans_goal_owner_fk
       foreign key (goal_id, user_id) references goals (id, user_id) on delete cascade;

alter table plan_weeks
  drop constraint plan_weeks_goal_id_fkey,
  add  constraint plan_weeks_goal_owner_fk
       foreign key (goal_id, user_id) references goals (id, user_id) on delete cascade;

alter table weekly_outcomes
  drop constraint weekly_outcomes_goal_id_fkey,
  add  constraint weekly_outcomes_goal_owner_fk
       foreign key (goal_id, user_id) references goals (id, user_id) on delete cascade;

alter table tasks
  drop constraint tasks_goal_id_fkey,
  add  constraint tasks_goal_owner_fk
       foreign key (goal_id, user_id) references goals (id, user_id) on delete cascade;

alter table checkins
  drop constraint checkins_goal_id_fkey,
  add  constraint checkins_goal_owner_fk
       foreign key (goal_id, user_id) references goals (id, user_id) on delete cascade;

alter table evidence
  drop constraint evidence_goal_id_fkey,
  add  constraint evidence_goal_owner_fk
       foreign key (goal_id, user_id) references goals (id, user_id) on delete cascade;

alter table reflections
  drop constraint reflections_goal_id_fkey,
  add  constraint reflections_goal_owner_fk
       foreign key (goal_id, user_id) references goals (id, user_id) on delete cascade;

alter table replan_events
  drop constraint replan_events_goal_id_fkey,
  add  constraint replan_events_goal_owner_fk
       foreign key (goal_id, user_id) references goals (id, user_id) on delete cascade;

alter table goal_signals
  drop constraint goal_signals_goal_id_fkey,
  add  constraint goal_signals_goal_owner_fk
       foreign key (goal_id, user_id) references goals (id, user_id) on delete cascade;

-- ── 3. append-only graph + graph_revisions ──────────────────────────────────
create type node_origin as enum ('ai','user','ai_edited');

alter table goal_nodes
  add column origin         node_origin not null default 'ai',
  add column dropped_at     timestamptz,
  add column dropped_reason text;

alter table node_dependencies
  add column removed_at     timestamptz,
  add column removed_reason text;

-- A removed edge frees its (from, to, type) slot for re-use (e.g. the
-- replanner removes then later re-adds the same dependency), while two live
-- edges with the same key are still rejected.
alter table node_dependencies drop constraint node_dependencies_from_node_id_to_node_id_type_key;
create unique index node_dependencies_live_key
  on node_dependencies (from_node_id, to_node_id, type)
  where removed_at is null;

-- The acyclicity check must only reason about live edges — a removed edge
-- can no longer create a cycle.
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
       where d.type = 'blocks' and d.removed_at is null
    )
    select 1 from reach where node_id = new.from_node_id
  ) then
    raise exception 'dependency cycle: % -> %', new.from_node_id, new.to_node_id
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

-- Immutable whole-graph snapshots — what makes a superseded plan in
-- /history able to render the graph as it stood when it was generated,
-- including projects later dropped.
create table graph_revisions (
  id                uuid primary key default gen_random_uuid(),
  goal_id           uuid not null,
  user_id           uuid not null,
  revision          int  not null,
  snapshot          jsonb not null,      -- {nodes:[…], edges:[…]} fully materialized
  reason            text not null,       -- 'initial' | 'replan' | 'manual_edit'
  replan_event_id   uuid references replan_events(id),
  created_at        timestamptz not null default now(),
  unique (goal_id, revision),
  foreign key (goal_id, user_id) references goals (id, user_id) on delete cascade
);
create index on graph_revisions (goal_id, revision desc);

alter table graph_revisions enable row level security;
create policy owner_all on graph_revisions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
