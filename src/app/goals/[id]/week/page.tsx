import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { GenerateNowButton } from "@/components/goal/GenerateNowButton";

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours}h`;
}

export default async function GoalWeekPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { id: goalId } = await params;
  const { week: weekParam } = await searchParams;
  const db = await createClient();

  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect(`/auth/sign-in?next=${encodeURIComponent(`/goals/${goalId}/week`)}`);

  const { data: goal } = await db
    .from("goals")
    .select("id, title, outcome_statement")
    .eq("id", goalId)
    .maybeSingle();
  if (!goal) notFound();

  const { data: plan } = await db
    .from("plans")
    .select("id, version, horizon_start, horizon_end, status")
    .eq("goal_id", goalId)
    .eq("status", "active")
    .maybeSingle();

  if (!plan) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-16">
        <Link href={`/goals/${goalId}/map`} className="text-sm text-neutral-500 underline">
          ← Goal map
        </Link>
        <h1 className="text-xl font-medium">{goal.title}</h1>
        <p className="text-sm text-neutral-600">
          This goal doesn&apos;t have an active plan yet — generation may have been interrupted
          (often a temporary generation limit).
        </p>
        <GenerateNowButton goalId={goalId} />
      </main>
    );
  }

  const requestedIndex = weekParam ? Number.parseInt(weekParam, 10) : 0;
  const weekIndex = Number.isFinite(requestedIndex) && requestedIndex >= 0 ? requestedIndex : 0;

  const { data: week } = await db
    .from("plan_weeks")
    .select("id, week_index, starts_on, ends_on, theme, capacity_minutes")
    .eq("plan_id", plan.id)
    .eq("week_index", weekIndex)
    .maybeSingle();

  if (!week) notFound();

  const { data: outcomes } = await db
    .from("weekly_outcomes")
    .select("id, statement, success_criteria, priority, status, project_node_id")
    .eq("plan_week_id", week.id)
    .order("priority", { ascending: true });

  const { data: tasks } = await db
    .from("tasks")
    .select("id, weekly_outcome_id, title, why, effort_minutes, tier, scheduled_for, status, sequence")
    .eq("plan_week_id", week.id)
    .order("scheduled_for", { ascending: true })
    .order("sequence", { ascending: true });

  const tasksByOutcome = new Map<string, typeof tasks>();
  const unlinkedTasks: NonNullable<typeof tasks> = [];
  for (const t of tasks ?? []) {
    if (!t.weekly_outcome_id) {
      unlinkedTasks.push(t);
      continue;
    }
    const list = tasksByOutcome.get(t.weekly_outcome_id) ?? [];
    list.push(t);
    tasksByOutcome.set(t.weekly_outcome_id, list);
  }

  const plannedMinutes = (tasks ?? []).reduce((sum, t) => sum + t.effort_minutes, 0);
  const overBudget = plannedMinutes > week.capacity_minutes;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-16">
      <div>
        <nav aria-label="Goal" className="flex flex-wrap gap-4 text-sm text-neutral-500">
          <Link href={`/goals/${goalId}/today`} className="underline">
            Today
          </Link>
          <Link href={`/goals/${goalId}/map`} className="underline">
            Goal map
          </Link>
          <Link href={`/goals/${goalId}/reflect`} className="underline">
            Reflect
          </Link>
          <Link href={`/goals/${goalId}/history`} className="underline">
            History
          </Link>
        </nav>
        <h1 className="mt-2 text-xl font-medium">{goal.title}</h1>
        <p className="mt-1 text-neutral-600">{goal.outcome_statement}</p>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-neutral-200 pb-6">
        <div>
          <h2 className="text-lg font-medium">
            Week {week.week_index + 1}
            {week.theme && <span className="ml-2 text-neutral-500">— {week.theme}</span>}
          </h2>
          <p className="text-sm text-neutral-500">
            {week.starts_on} → {week.ends_on}
          </p>
        </div>
        <dl className="flex gap-6 text-sm">
          <div>
            <dt className="text-neutral-500">Capacity budget</dt>
            <dd className="font-medium tabular-nums">{formatMinutes(week.capacity_minutes)}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Planned</dt>
            <dd className={`font-medium tabular-nums ${overBudget ? "text-red-600" : ""}`}>
              {formatMinutes(plannedMinutes)}
            </dd>
          </div>
        </dl>
      </div>

      {!outcomes || outcomes.length === 0 ? (
        <p className="text-sm text-neutral-600">
          Week {week.week_index + 1} doesn&apos;t have generated outcomes yet — it will fill in as you get
          closer to it.
        </p>
      ) : (
        <ol className="flex flex-col gap-6">
          {outcomes.map((o) => {
            const outcomeTasks = (tasksByOutcome.get(o.id) ?? []).sort((a, b) =>
              a.scheduled_for && b.scheduled_for ? a.scheduled_for.localeCompare(b.scheduled_for) : 0,
            );
            return (
              <li key={o.id} className="rounded-md border border-neutral-200 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-medium">{o.statement}</h3>
                  <span className="text-xs uppercase tracking-wide text-neutral-500">
                    Priority {o.priority}
                  </span>
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  <span className="font-medium text-neutral-700">Success: </span>
                  {o.success_criteria}
                </p>

                {outcomeTasks.length > 0 && (
                  <ul className="mt-4 flex flex-col gap-2 border-t border-neutral-100 pt-4 text-sm">
                    {outcomeTasks.map((t) => (
                      <li key={t.id} className="rounded-md bg-neutral-50 p-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="font-medium">{t.title}</span>
                          <span className="flex items-center gap-2 text-xs text-neutral-500">
                            <span>{t.scheduled_for ?? "unscheduled"}</span>
                            <span className="tabular-nums">{formatMinutes(t.effort_minutes)}</span>
                          </span>
                        </div>
                        {t.why && <p className="mt-1 text-xs text-neutral-500">{t.why}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {unlinkedTasks.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-neutral-700">Other tasks this week</h3>
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {unlinkedTasks.map((t) => (
              <li key={t.id} className="rounded-md bg-neutral-50 p-3">
                {t.title} — <span className="tabular-nums">{formatMinutes(t.effort_minutes)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <nav aria-label="Week navigation" className="flex justify-between border-t border-neutral-200 pt-4 text-sm">
        {weekIndex > 0 ? (
          <Link href={`/goals/${goalId}/week?week=${weekIndex - 1}`} className="underline">
            ← Previous week
          </Link>
        ) : (
          <span />
        )}
        <Link href={`/goals/${goalId}/week?week=${weekIndex + 1}`} className="underline">
          Next week →
        </Link>
      </nav>
    </main>
  );
}
