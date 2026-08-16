import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { submitReflection } from "@/server/actions/reflect";
import { requestReplan } from "@/server/actions/adapt";
import { buttonClass } from "@/components/ui/button-styles";

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours}h`;
}

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
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-16">
        <a href={`/goals/${goalId}/today`} className="text-sm text-neutral-500 underline">
          ← Today
        </a>
        <h1 className="text-xl font-medium">{goal.title}</h1>
        <p className="text-sm text-neutral-600">No active plan yet — nothing to reflect on.</p>
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
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-16">
      <div>
        <nav aria-label="Goal" className="flex flex-wrap gap-4 text-sm text-neutral-500">
          <a href={`/goals/${goalId}/today`} className="underline">
            Today
          </a>
          <a href={`/goals/${goalId}/week`} className="underline">
            This week
          </a>
          <a href={`/goals/${goalId}/history`} className="underline">
            History
          </a>
        </nav>
        <h1 className="mt-2 text-xl font-medium">{goal.title}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Week {week.week_index + 1} · {week.starts_on} → {week.ends_on}
        </p>
      </div>

      <dl className="flex gap-6 border-b border-neutral-200 pb-6 text-sm">
        <div>
          <dt className="text-neutral-500">Planned</dt>
          <dd className="font-medium tabular-nums">{formatMinutes(plannedMinutes)}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Completed</dt>
          <dd className="font-medium tabular-nums">{formatMinutes(completedMinutes)}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Tasks done</dt>
          <dd className="font-medium tabular-nums">
            {tasksDone} / {tasks.length}
          </dd>
        </div>
      </dl>

      {reflection ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-md border border-neutral-200 p-4 text-sm">
            <h2 className="font-medium">Your reflection</h2>
            {reflection.what_worked && (
              <p className="mt-2">
                <span className="text-neutral-500">Worked: </span>
                {reflection.what_worked}
              </p>
            )}
            {reflection.what_didnt && (
              <p className="mt-2">
                <span className="text-neutral-500">Didn&apos;t: </span>
                {reflection.what_didnt}
              </p>
            )}
            {reflection.blockers && (
              <p className="mt-2">
                <span className="text-neutral-500">Blockers: </span>
                {reflection.blockers}
              </p>
            )}
          </div>
          {synthesis && (
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm">
              <h2 className="font-medium">Synthesis</h2>
              {synthesis.summary && <p className="mt-2">{synthesis.summary}</p>}
              {synthesis.patterns && synthesis.patterns.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-neutral-600">
                  {synthesis.patterns.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              )}
              {synthesis.recommendation && (
                <p className="mt-2">
                  <span className="font-medium text-neutral-700">Recommendation: </span>
                  {synthesis.recommendation}
                </p>
              )}
            </div>
          )}
          <form action={requestReplanAction}>
            <button type="submit" className={buttonClass("secondary", "small")}>
              Request a replan
            </button>
          </form>
        </div>
      ) : (
        <form action={submitAction} className="flex flex-col gap-4 text-sm">
          <label className="flex flex-col gap-1">
            What worked
            <textarea name="whatWorked" rows={3} className="rounded-md border border-neutral-300 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1">
            What didn&apos;t
            <textarea name="whatDidnt" rows={3} className="rounded-md border border-neutral-300 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1">
            Blockers
            <textarea name="blockers" rows={3} className="rounded-md border border-neutral-300 px-3 py-2" />
          </label>
          <button type="submit" className={`self-start ${buttonClass("primary", "small")}`}>
            Submit reflection
          </button>
        </form>
      )}

      <nav aria-label="Week navigation" className="flex justify-between border-t border-neutral-200 pt-4 text-sm">
        {weekIndex > 0 ? (
          <a href={`/goals/${goalId}/reflect?week=${weekIndex - 1}`} className="underline">
            ← Previous week
          </a>
        ) : (
          <span />
        )}
        <a href={`/goals/${goalId}/reflect?week=${weekIndex + 1}`} className="underline">
          Next week →
        </a>
      </nav>
    </main>
  );
}
