-- Atomic upsert used by lib/usage/limits.ts to record AI module usage.
create or replace function increment_usage_counter(
  p_user_id uuid,
  p_period_start date,
  p_module_class text
) returns void
language sql security invoker as $$
  insert into usage_counters (user_id, period_start, module_class, count)
  values (p_user_id, p_period_start, p_module_class, 1)
  on conflict (user_id, period_start, module_class)
  do update set count = usage_counters.count + 1;
$$;

grant execute on function increment_usage_counter(uuid, date, text) to authenticated;
