-- Trajectory — Minimum Viable Progress: AI-proposed initial capacity
--
-- Until now, every new goal's capacity_profiles row (ideal/normal/minimum
-- viable day, in minutes) was seeded from a single hardcoded default
-- (src/server/actions/decompose.ts's DEFAULT_CAPACITY) — identical for a
-- half marathon and a CPA exam. The `assess` module already reasons about
-- the goal's domain, timeline, and the user's own stated constraints; this
-- lets it also propose the three effort tiers, so decomposeGoal can seed a
-- personalized capacity profile instead of the same 90/60/20 for everyone.
--
-- Nullable and additive: existing rows (and any assessment run before this
-- migration ships) simply have no proposal, and decompose.ts's default
-- remains the fallback.
alter table feasibility_assessments
  add column proposed_capacity jsonb;

alter table feasibility_assessments
  add constraint feasibility_assessments_proposed_capacity_shape
  check (
    proposed_capacity is null
    or (
      (proposed_capacity ->> 'idealMinutes')::int between 5 and 960
      and (proposed_capacity ->> 'normalMinutes')::int between 5 and 960
      and (proposed_capacity ->> 'minimumMinutes')::int between 1 and 960
      and (proposed_capacity ->> 'minimumMinutes')::int <= (proposed_capacity ->> 'normalMinutes')::int
      and (proposed_capacity ->> 'normalMinutes')::int <= (proposed_capacity ->> 'idealMinutes')::int
    )
  );
