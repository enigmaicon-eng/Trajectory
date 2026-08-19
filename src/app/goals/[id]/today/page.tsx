import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { packDayTiers, type DayTaskLike } from "@/lib/domain/day-tiers";
import { addDays, todayISO } from "@/lib/domain/dates";
import { TRIGGER_NOTICE, TRIGGER_LEAD } from "@/lib/replan-copy";
import { pickDefaultTier, TIER_ORDER, type TierKey } from "@/lib/tier-select";
import { StandingAnswer } from "@/components/ui/StandingAnswer";
import { GenerateNowButton } from "@/components/goal/GenerateNowButton";
import { TodayBody, type TodayTaskVM } from "@/components/goal/TodayBody";
import { buttonClass } from "@/components/ui/button-styles";
import Link from "next/link";

const TIER_MINUTES_ORDER = TIER_ORDER;

export default async function GoalTodayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: goalId } = await params;
  const db = await createClient();

  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect(`/auth/sign-in?next=${encodeURIComponent(`/goals/${goalId}/today`)}`);

  const { data: goal } = await db
    .from("goals")
    .select("id, title, outcome_statement, status")
    .eq("id", goalId)
    .maybeSingle();
  if (!goal) notFound();

  const { data: plan } = await db
    .from("plans")
    .select("id, horizon_start")
    .eq("goal_id", goalId)
    .eq("status", "active")
    .maybeSingle();

  if (!plan) {
    return (
      <main id="main" className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-16">
        <StandingAnswer line1="Your plan is being built." />
        <p className="text-sm text-ink-muted">
          Generation may have been interrupted — this is usually a temporary limit, and nothing was lost.
        </p>
        <GenerateNowButton goalId={goalId} />
      </main>
    );
  }

  const today = todayISO();
  const yesterday = addDays(today, -1);

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

  const { data: taskRows } = await db
    .from("tasks")
    .select("id, title, why, effort_minutes, tier, sequence, status, scheduled_for, weekly_outcome_id")
    .eq("goal_id", goalId)
    .eq("scheduled_for", today)
    .order("sequence", { ascending: true });
  const allTasks = taskRows ?? [];
  const pendingTasks = allTasks.filter((t) => t.status === "pending");
  const doneTasks = allTasks.filter((t) => t.status === "done");
  const doneCount = doneTasks.length;

  const { data: missedRows } = await db
    .from("tasks")
    .select("id, title, effort_minutes")
    .eq("goal_id", goalId)
    .eq("scheduled_for", yesterday)
    .eq("status", "pending")
    .order("sequence", { ascending: true });
  const missed = missedRows ?? [];

  const { data: forwardCheckin } = await db
    .from("checkins")
    .select("minutes_available, energy")
    .eq("goal_id", goalId)
    .eq("kind", "daily")
    .eq("occurred_on", today)
    .maybeSingle();

  const { data: pendingReplan } = await db
    .from("replan_events")
    .select("id, trigger")
    .eq("goal_id", goalId)
    .is("accepted", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { count: allTimeDoneCount } = await db
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("goal_id", goalId)
    .eq("status", "done");
  const isFirstRun = (allTimeDoneCount ?? 0) === 0;

  const { data: currentWeekRow } = await db
    .from("plan_weeks")
    .select("id, week_index")
    .eq("plan_id", plan.id)
    .lte("starts_on", today)
    .gte("ends_on", today)
    .maybeSingle();

  let weekContextLine: string | null = null;
  const { data: goalRow } = await db.from("goals").select("horizon_weeks").eq("id", goalId).maybeSingle();
  if (currentWeekRow) {
    const { data: topOutcome } = await db
      .from("weekly_outcomes")
      .select("statement")
      .eq("plan_week_id", currentWeekRow.id)
      .order("priority", { ascending: true })
      .limit(1)
      .maybeSingle();
    const total = goalRow?.horizon_weeks;
    weekContextLine = `Week ${currentWeekRow.week_index + 1}${total ? ` of ${total}` : ""}${
      topOutcome ? ` · ${topOutcome.statement}` : ""
    }`;
  }

  const tierBudget: Record<TierKey, number> = {
    minimum: capacity.minimumMinutes,
    normal: capacity.normalMinutes,
    ideal: capacity.idealMinutes,
  };

  const toVM = (t: { id: string; title: string; why: string | null; effort_minutes: number }): TodayTaskVM => ({
    id: t.id,
    title: t.title,
    why: t.why,
    effortMinutes: t.effort_minutes,
  });

  const tierInput: (DayTaskLike & { id: string })[] = pendingTasks.map((t) => ({
    id: t.id,
    tier: t.tier,
    sequence: t.sequence,
    effortMinutes: t.effort_minutes,
  }));
  const pendingTierSets = packDayTiers(tierInput, capacity);
  const defaultTier = pickDefaultTier(forwardCheckin?.minutes_available ?? null, tierBudget);

  let standingLine1: string;
  let standingLine2: string | null = null;

  if (allTasks.length === 0) {
    standingLine1 = weekContextLine
      ? `Nothing is scheduled today. ${weekContextLine.split(" · ")[0]} continues tomorrow.`
      : "Nothing is scheduled today.";
  } else {
    const firstOfDefault = pendingTierSets[defaultTier][0];

    if (pendingTasks.length === 0) {
      standingLine1 = "That's today. Everything planned is done.";
    } else if (defaultTier === "minimum" && firstOfDefault) {
      const task = pendingTasks.find((t) => t.id === firstOfDefault.id);
      standingLine1 = `You have ${capacity.minimumMinutes} minutes today. One thing: ${task?.title ?? "the next task"}.`;
    } else if (firstOfDefault) {
      const task = pendingTasks.find((t) => t.id === firstOfDefault.id);
      standingLine1 = `${task?.title ?? "Your next task"} — ${firstOfDefault.effortMinutes} minutes.`;
      standingLine2 = task?.why ?? null;
    } else {
      standingLine1 = "That's today. Everything in this tier is done.";
    }
  }

  const pendingById = new Map(pendingTasks.map((t) => [t.id, t]));
  const doneVMs = doneTasks.map((t) => ({ ...toVM(t), tierRank: TIER_MINUTES_ORDER.indexOf(t.tier as TierKey) }));

  const tiers: Record<TierKey, TodayTaskVM[]> = { minimum: [], normal: [], ideal: [] };
  for (const tierKey of TIER_MINUTES_ORDER) {
    const rank = TIER_MINUTES_ORDER.indexOf(tierKey);
    const pending = pendingTierSets[tierKey]
      .map((t) => pendingById.get(t.id))
      .filter((t): t is NonNullable<typeof t> => Boolean(t))
      .map(toVM);
    const done = doneVMs.filter((t) => t.tierRank <= rank).map(({ tierRank: _tierRank, ...rest }) => rest);
    const bySeq = new Map(allTasks.map((t) => [t.id, t.sequence]));
    tiers[tierKey] = [...pending, ...done].sort((a, b) => (bySeq.get(a.id) ?? 0) - (bySeq.get(b.id) ?? 0));
  }

  const doneIds = new Set(doneTasks.map((t) => t.id));

  let replanNotice: { id: string; lead: string; line: string } | null = null;
  if (pendingReplan) {
    replanNotice = {
      id: pendingReplan.id,
      lead: TRIGGER_LEAD[pendingReplan.trigger],
      line: TRIGGER_NOTICE[pendingReplan.trigger],
    };
  }

  if (goal.status === "paused") {
    return (
      <main id="main" className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-16">
        <StandingAnswer line1={`${goal.title} is paused.`} />
        <Link href={`/goals/${goalId}`} className={buttonClass("primary")}>
          Go to progress
        </Link>
      </main>
    );
  }

  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-16">
      <TodayBody
        goalId={goalId}
        todayISO={today}
        standingLine1={standingLine1}
        standingLine2={standingLine2}
        tiers={tiers}
        doneIds={[...doneIds]}
        tierMinutes={tierBudget}
        defaultTier={defaultTier}
        doneCount={doneCount}
        totalCount={allTasks.length}
        missed={missed.map((m) => ({ id: m.id, title: m.title, effortMinutes: m.effort_minutes }))}
        weekContextLine={weekContextLine}
        replanNotice={replanNotice}
        hasForwardCheckinToday={!!forwardCheckin}
        isFirstRun={isFirstRun}
      />
    </main>
  );
}
