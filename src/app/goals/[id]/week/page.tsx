import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { GenerateNowButton } from "@/components/goal/GenerateNowButton";
import { StandingAnswer } from "@/components/ui/StandingAnswer";
import { StatusMark } from "@/components/ui/HealthMark";
import { formatMinutes, weekdayLabel } from "@/lib/format";
import { daysInRange, isoWeekday, todayISO } from "@/lib/domain/dates";
import { TRIGGER_NOTICE, TRIGGER_LEAD } from "@/lib/replan-copy";

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

  const { data: goal } = await db.from("goals").select("id, title, horizon_weeks").eq("id", goalId).maybeSingle();
  if (!goal) notFound();

  const { data: plan } = await db
    .from("plans")
    .select("id, version, horizon_start, horizon_end, status")
    .eq("goal_id", goalId)
    .eq("status", "active")
    .maybeSingle();

  if (!plan) {
    return (
      <main id="main" className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-16">
        <StandingAnswer line1="Your plan is being built." />
        <p className="text-sm text-ink-muted">
          Generation may have been interrupted — this is usually a temporary limit, and nothing was lost.
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

  const allTasks = tasks ?? [];
  const outcomeList = outcomes ?? [];
  const tasksByOutcome = new Map<string, typeof allTasks>();
  for (const t of allTasks) {
    if (!t.weekly_outcome_id) continue;
    const list = tasksByOutcome.get(t.weekly_outcome_id) ?? [];
    list.push(t);
    tasksByOutcome.set(t.weekly_outcome_id, list);
  }

  const plannedMinutes = allTasks.reduce((sum, t) => sum + t.effort_minutes, 0);
  const overBudget = plannedMinutes > week.capacity_minutes;
  const barPct = week.capacity_minutes > 0 ? Math.min(100, Math.round((plannedMinutes / week.capacity_minutes) * 100)) : 0;

  const today = todayISO();
  const days = daysInRange(week.starts_on, week.ends_on);
  const tasksByDay = new Map<string, typeof allTasks>();
  for (const t of allTasks) {
    if (!t.scheduled_for) continue;
    const list = tasksByDay.get(t.scheduled_for) ?? [];
    list.push(t);
    tasksByDay.set(t.scheduled_for, list);
  }

  const notDone = allTasks.filter((t) => t.status === "deferred");

  const { data: pendingReplan } = await db
    .from("replan_events")
    .select("id, trigger")
    .eq("goal_id", goalId)
    .is("accepted", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const outcomesDone = outcomeList.filter((o) => o.status === "complete").length;
  const standingLine1 =
    outcomeList.length === 0
      ? `Week ${week.week_index + 1} doesn't have outcomes yet.`
      : `This week: ${outcomeList[0].statement.charAt(0).toLowerCase() + outcomeList[0].statement.slice(1)}.`;

  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-3xl flex-col gap-10 px-6 py-16">
      <StandingAnswer line1={standingLine1} />

      <div className="flex flex-col gap-2">
        <p className="text-sm text-ink-muted">
          Week {week.week_index + 1}
          {goal.horizon_weeks ? ` of ${goal.horizon_weeks}` : ""} · {week.starts_on} → {week.ends_on} ·{" "}
          <span className="tabular-nums">{formatMinutes(plannedMinutes)}</span> planned of{" "}
          <span className="tabular-nums">{formatMinutes(week.capacity_minutes)}</span>
          {overBudget && <span className="text-health-risk"> — over budget</span>}
        </p>
        <div className="h-0.5 w-full max-w-xs rounded-full bg-rule" role="img" aria-label={`${barPct}% of capacity planned`}>
          <div
            className={`h-0.5 rounded-full ${overBudget ? "bg-health-risk" : "bg-accent"}`}
            style={{ width: `${barPct}%` }}
          />
        </div>
      </div>

      <section aria-labelledby="outcomes-heading" className="flex flex-col gap-6">
        <h2 id="outcomes-heading" className="text-[13px] font-medium uppercase tracking-wide text-ink-muted">
          Outcomes
        </h2>
        {outcomeList.length === 0 ? (
          <p className="text-sm text-ink-muted">
            This week doesn&apos;t have outcomes yet — that&apos;s a fault on our side.
          </p>
        ) : (
          <ol className="flex flex-col gap-6">
            {outcomeList.map((o) => {
              const outcomeTasks = (tasksByOutcome.get(o.id) ?? []).sort((a, b) =>
                a.scheduled_for && b.scheduled_for ? a.scheduled_for.localeCompare(b.scheduled_for) : 0,
              );
              return (
                <li key={o.id} className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <StatusMark status={o.status} />
                      <h3 className="text-base font-medium text-ink">{o.statement}</h3>
                    </div>
                  </div>
                  <p className="pl-[1.9rem] text-sm text-ink-muted">
                    <span className="font-medium text-ink">Done when: </span>
                    {o.success_criteria}
                  </p>
                  {outcomeTasks.length > 0 && (
                    <ul className="mt-1 flex flex-col gap-1 pl-[1.9rem]">
                      {outcomeTasks.map((t) => (
                        <li key={t.id} className="flex items-baseline justify-between gap-2 text-sm text-ink-muted">
                          <span className={t.status === "done" ? "text-ink-faint line-through" : ""}>{t.title}</span>
                          <span className="tabular-nums shrink-0">{formatMinutes(t.effort_minutes)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        {outcomeList.length > 0 && (
          <p className="text-sm text-ink-muted">
            {outcomesDone} of {outcomeList.length} outcome{outcomeList.length === 1 ? "" : "s"} met
          </p>
        )}
      </section>

      <section aria-labelledby="days-heading" className="flex flex-col gap-2">
        <h2 id="days-heading" className="text-[13px] font-medium uppercase tracking-wide text-ink-muted">
          Days
        </h2>
        <ul className="flex flex-col">
          {days.map((d) => {
            const dayTasks = (tasksByDay.get(d) ?? []).filter((t) => t.status !== "deferred");
            const isToday = d === today;
            const minutes = dayTasks.reduce((s, t) => s + t.effort_minutes, 0);
            return (
              <li key={d} className={`flex min-h-11 flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-rule py-2 last:border-b-0`}>
                <span className={`w-10 shrink-0 text-sm ${isToday ? "font-medium text-accent" : "text-ink-muted"}`}>
                  {weekdayLabel(isoWeekday(d))}
                </span>
                {dayTasks.length === 0 ? (
                  <span className="text-sm text-ink-faint">— no work planned</span>
                ) : (
                  <span className="flex flex-1 flex-wrap items-baseline gap-x-2 text-sm">
                    <StatusMark status={dayTasks.every((t) => t.status === "done") ? "complete" : "not_started"} />
                    <span className="tabular-nums text-ink-muted">{formatMinutes(minutes)}</span>
                    <span className="text-ink">{dayTasks.map((t) => t.title).join(" · ")}</span>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {notDone.length > 0 && (
        <section aria-labelledby="not-done-heading" className="flex flex-col gap-2 border-t border-rule pt-6">
          <h2 id="not-done-heading" className="text-[13px] font-medium uppercase tracking-wide text-ink-muted">
            Not done this week
          </h2>
          <ul className="flex flex-col gap-1">
            {notDone.map((t) => (
              <li key={t.id} className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-ink-muted">
                  {t.scheduled_for ? weekdayLabel(isoWeekday(t.scheduled_for)) : ""} {t.title}
                </span>
                <span className="tabular-nums text-ink-faint">{formatMinutes(t.effort_minutes)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pendingReplan && (
        <Link
          href={`/goals/${goalId}/history`}
          className="flex items-baseline justify-between gap-4 border-t border-rule pt-4 text-sm text-ink hover:text-accent"
        >
          <span>
            <span className="font-medium">{TRIGGER_LEAD[pendingReplan.trigger]}</span> {TRIGGER_NOTICE[pendingReplan.trigger]}
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      )}

      <nav aria-label="Week navigation" className="flex justify-between border-t border-rule pt-4 text-sm">
        {weekIndex > 0 ? (
          <Link href={`/goals/${goalId}/week?week=${weekIndex - 1}`} className="text-ink underline decoration-rule underline-offset-2 hover:text-accent">
            ← Previous week
          </Link>
        ) : (
          <span />
        )}
        <Link href={`/goals/${goalId}/week?week=${weekIndex + 1}`} className="text-ink underline decoration-rule underline-offset-2 hover:text-accent">
          Next week →
        </Link>
      </nav>
    </main>
  );
}
