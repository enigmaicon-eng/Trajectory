import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { submitReflection } from "@/server/actions/reflect";
import { requestReplan } from "@/server/actions/adapt";
import { buttonClass } from "@/components/ui/button-styles";
import { StandingAnswer } from "@/components/ui/StandingAnswer";
import { formatMinutes } from "@/lib/format";

type Synthesis = { summary?: string; patterns?: string[]; recommendation?: string; confidence?: number };

export default async function GoalReflectPage({
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
  if (!user) redirect(`/auth/sign-in?next=${encodeURIComponent(`/goals/${goalId}/reflect`)}`);

  const { data: goal } = await db.from("goals").select("id, title").eq("id", goalId).maybeSingle();
  if (!goal) notFound();

  const { data: plan } = await db
    .from("plans")
    .select("id")
    .eq("goal_id", goalId)
    .eq("status", "active")
    .maybeSingle();

  if (!plan) {
    return (
      <main id="main" className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-16">
        <StandingAnswer line1="Nothing to reflect on yet." />
        <p className="text-sm text-ink-muted">There&apos;s no active plan on record for this goal.</p>
        <Link href={`/goals/${goalId}/today`} className="text-sm text-ink underline decoration-rule underline-offset-2 hover:text-accent">
          ← Today
        </Link>
      </main>
    );
  }

  const requestedIndex = weekParam ? Number.parseInt(weekParam, 10) : 0;
  const weekIndex = Number.isFinite(requestedIndex) && requestedIndex >= 0 ? requestedIndex : 0;

  const { data: week } = await db
    .from("plan_weeks")
    .select("id, week_index, starts_on, ends_on")
    .eq("plan_id", plan.id)
    .eq("week_index", weekIndex)
    .maybeSingle();
  if (!week) notFound();
  const weekId = week.id;

  const { data: taskRows } = await db.from("tasks").select("effort_minutes, status").eq("plan_week_id", weekId);
  const tasks = taskRows ?? [];
  const plannedMinutes = tasks.reduce((s, t) => s + t.effort_minutes, 0);
  const completedMinutes = tasks.filter((t) => t.status === "done").reduce((s, t) => s + t.effort_minutes, 0);
  const tasksDone = tasks.filter((t) => t.status === "done").length;

  const { data: reflection } = await db
    .from("reflections")
    .select("what_worked, what_didnt, blockers, ai_synthesis")
    .eq("plan_week_id", weekId)
    .maybeSingle();
  const synthesis = (reflection?.ai_synthesis as Synthesis | null) ?? null;

  async function submitAction(formData: FormData) {
    "use server";
    await submitReflection({
      goalId,
      planWeekId: weekId,
      whatWorked: (formData.get("whatWorked") as string) || undefined,
      whatDidnt: (formData.get("whatDidnt") as string) || undefined,
      blockers: (formData.get("blockers") as string) || undefined,
    });
  }

  async function requestReplanAction() {
    "use server";
    await requestReplan({ goalId });
    redirect(`/goals/${goalId}/history`);
  }

  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-16">
      <StandingAnswer line1={`Week ${week.week_index + 1}, in review.`} line2={`${week.starts_on} → ${week.ends_on}`} />

      <dl className="flex gap-8 border-b border-rule pb-6 text-sm">
        <div>
          <dt className="text-ink-muted">Planned</dt>
          <dd className="font-medium tabular-nums text-ink">{formatMinutes(plannedMinutes)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Completed</dt>
          <dd className="font-medium tabular-nums text-ink">{formatMinutes(completedMinutes)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Tasks done</dt>
          <dd className="font-medium tabular-nums text-ink">
            {tasksDone} / {tasks.length}
          </dd>
        </div>
      </dl>

      {reflection ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2 text-sm">
            {reflection.what_worked && (
              <p>
                <span className="text-ink-muted">Worked: </span>
                <span className="text-ink">{reflection.what_worked}</span>
              </p>
            )}
            {reflection.what_didnt && (
              <p>
                <span className="text-ink-muted">Didn&apos;t: </span>
                <span className="text-ink">{reflection.what_didnt}</span>
              </p>
            )}
            {reflection.blockers && (
              <p>
                <span className="text-ink-muted">In the way: </span>
                <span className="text-ink">{reflection.blockers}</span>
              </p>
            )}
          </div>
          {synthesis && (
            <div className="flex flex-col gap-2 border-t border-rule pt-4 text-sm">
              {synthesis.summary && <p className="text-ink">{synthesis.summary}</p>}
              {synthesis.patterns && synthesis.patterns.length > 0 && (
                <ul className="flex flex-col gap-1 text-ink-muted">
                  {synthesis.patterns.map((p, i) => (
                    <li key={i}>· {p}</li>
                  ))}
                </ul>
              )}
              {synthesis.recommendation && (
                <p className="text-ink">
                  <span className="font-medium">Next: </span>
                  {synthesis.recommendation}
                </p>
              )}
            </div>
          )}
          <form action={requestReplanAction}>
            <button type="submit" className={`self-start ${buttonClass("secondary", "small")}`}>
              Get a fresh read on the plan
            </button>
          </form>
        </div>
      ) : (
        <form action={submitAction} className="flex flex-col gap-5 text-sm">
          <label className="flex flex-col gap-1.5">
            What worked
            <textarea name="whatWorked" rows={3} className="rounded-md border border-rule bg-paper px-3 py-2 text-base text-ink" />
          </label>
          <label className="flex flex-col gap-1.5">
            What didn&apos;t
            <textarea name="whatDidnt" rows={3} className="rounded-md border border-rule bg-paper px-3 py-2 text-base text-ink" />
          </label>
          <label className="flex flex-col gap-1.5">
            What was in the way
            <textarea name="blockers" rows={3} className="rounded-md border border-rule bg-paper px-3 py-2 text-base text-ink" />
          </label>
          <div className="flex gap-3">
            <button type="submit" className={`self-start ${buttonClass("primary", "small")}`}>
              Submit
            </button>
          </div>
        </form>
      )}

      <nav aria-label="Week navigation" className="flex justify-between border-t border-rule pt-4 text-sm">
        {weekIndex > 0 ? (
          <Link href={`/goals/${goalId}/reflect?week=${weekIndex - 1}`} className="text-ink underline decoration-rule underline-offset-2 hover:text-accent">
            ← Previous week
          </Link>
        ) : (
          <span />
        )}
        <Link href={`/goals/${goalId}/reflect?week=${weekIndex + 1}`} className="text-ink underline decoration-rule underline-offset-2 hover:text-accent">
          Next week →
        </Link>
      </nav>
    </main>
  );
}
