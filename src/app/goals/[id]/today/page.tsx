import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { packDayTiers, type DayTaskLike } from "@/lib/domain/day-tiers";
import { todayISO } from "@/lib/domain/dates";
import { completeTask, skipTask, submitCheckIn } from "@/server/actions/execution";
import { buttonClass } from "@/components/ui/button-styles";

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours}h`;
}

const TIER_LABEL = { minimum: "Minimum-viable", normal: "Normal", ideal: "Ideal" } as const;
type Tier = keyof typeof TIER_LABEL;

export default async function GoalTodayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tier?: string }>;
}) {
  const { id: goalId } = await params;
  const { tier: tierParam } = await searchParams;
  const db = await createClient();

  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect(`/auth/sign-in?next=${encodeURIComponent(`/goals/${goalId}/today`)}`);

  const { data: goal } = await db
    .from("goals")
    .select("id, title, outcome_statement")
    .eq("id", goalId)
    .maybeSingle();
  if (!goal) notFound();

  const { data: capacityRow } = await db
    .from("capacity_profiles")
    .select("ideal_minutes, normal_minutes, minimum_minutes")
    .eq("goal_id", goalId)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  const capacity = {
    idealMinutes: capacityRow?.ideal_minutes ?? 90,
    normalMinutes: capacityRow?.normal_minutes ?? 60,
    minimumMinutes: capacityRow?.minimum_minutes ?? 20,
  };

  const today = todayISO();
  const { data: taskRows } = await db
    .from("tasks")
    .select("id, title, why, effort_minutes, tier, sequence, status, scheduled_for")
    .eq("goal_id", goalId)
    .eq("scheduled_for", today)
    .order("sequence", { ascending: true });

  const allTasks = taskRows ?? [];
  const pendingTasks = allTasks.filter((t) => t.status === "pending");
  const doneCount = allTasks.filter((t) => t.status === "done").length;

  const tierInput: (DayTaskLike & { id: string; title: string; why: string | null; effortMinutes: number })[] =
    pendingTasks.map((t) => ({
      id: t.id,
      title: t.title,
      why: t.why,
      effortMinutes: t.effort_minutes,
      tier: t.tier,
      sequence: t.sequence,
    }));
  const tiers = packDayTiers(tierInput, capacity);

  const selectedTier: Tier = tierParam === "minimum" || tierParam === "ideal" ? tierParam : "normal";
  const selectedTasks = tiers[selectedTier];
  const selectedMinutes = selectedTasks.reduce((sum, t) => sum + t.effortMinutes, 0);

  async function submitCheckInAction(formData: FormData) {
    "use server";
    const minutesSpentRaw = formData.get("minutesSpent");
    const energyRaw = formData.get("energy");
    await submitCheckIn({
      goalId,
      kind: "daily",
      occurredOn: todayISO(),
      minutesSpent: minutesSpentRaw ? Number(minutesSpentRaw) : undefined,
      energy: energyRaw ? Number(energyRaw) : undefined,
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-16">
      <div>
        <Link href={`/goals/${goalId}/week`} className="text-sm text-neutral-500 underline">
          ← This week
        </Link>
        <h1 className="mt-2 text-xl font-medium">{goal.title}</h1>
        <p className="mt-1 text-sm text-neutral-500">{today}</p>
      </div>

      {allTasks.length === 0 ? (
        <p className="text-sm text-neutral-600">
          Nothing scheduled today. Check <Link href={`/goals/${goalId}/week`} className="underline">this week</Link>{" "}
          for what&apos;s coming up.
        </p>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto border-b border-neutral-200 pb-4">
            {(Object.keys(TIER_LABEL) as Tier[]).map((t) => (
              <Link
                key={t}
                href={`/goals/${goalId}/today?tier=${t}`}
                className={`inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 ${
                  t === selectedTier
                    ? "bg-neutral-900 text-white"
                    : "border border-neutral-300 text-neutral-700"
                }`}
              >
                {TIER_LABEL[t]}
                <span className="ml-1.5 tabular-nums opacity-70">({tiers[t].length})</span>
              </Link>
            ))}
          </div>

          <div className="flex items-baseline justify-between text-sm text-neutral-500">
            <span>
              {doneCount} of {allTasks.length} done today
            </span>
            <span className="tabular-nums">{formatMinutes(selectedMinutes)} selected</span>
          </div>

          {selectedTasks.length === 0 ? (
            <p className="text-sm text-neutral-600">Nothing in this tier — everything&apos;s already done.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {selectedTasks.map((t) => (
                <li key={t.id} className="rounded-md border border-neutral-200 p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">{t.title}</span>
                    <span className="tabular-nums text-xs text-neutral-500">{formatMinutes(t.effortMinutes)}</span>
                  </div>
                  {t.why && <p className="mt-1 text-sm text-neutral-600">{t.why}</p>}
                  <div className="mt-3 flex gap-2">
                    <form action={completeTask.bind(null, { taskId: t.id })}>
                      <button type="submit" className={buttonClass("primary", "small")}>
                        Done
                      </button>
                    </form>
                    <form action={skipTask.bind(null, { taskId: t.id })}>
                      <button type="submit" className={buttonClass("secondary", "small")}>
                        Skip
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <form action={submitCheckInAction} className="flex flex-wrap items-end gap-3 border-t border-neutral-200 pt-6 text-sm">
        <label className="flex flex-col gap-1">
          Minutes spent today
          <input
            type="number"
            name="minutesSpent"
            min={0}
            className="w-28 rounded-md border border-neutral-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          Energy (1-5)
          <input
            type="number"
            name="energy"
            min={1}
            max={5}
            className="w-20 rounded-md border border-neutral-300 px-2 py-1"
          />
        </label>
        <button type="submit" className={buttonClass("secondary", "small")}>
          Check in
        </button>
      </form>
    </main>
  );
}
