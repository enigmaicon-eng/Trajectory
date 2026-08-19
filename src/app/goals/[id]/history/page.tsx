import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { respondToReplan } from "@/server/actions/adapt";
import { buttonClass } from "@/components/ui/button-styles";
import { StandingAnswer } from "@/components/ui/StandingAnswer";
import { formatMinutes } from "@/lib/format";
import { OP_LABEL, HIGH_IMPACT_OPS, TRIGGER_NOTICE, TRIGGER_LEAD, describeOp } from "@/lib/replan-copy";
import type { PlanOp } from "@/lib/ai/modules/replan/output.schema";

async function buildDiffRows(
  db: Awaited<ReturnType<typeof createClient>>,
  goalId: string,
  ops: PlanOp[],
): Promise<{ label: string; now: string; proposed: string; op: PlanOp }[]> {
  const rows: { label: string; now: string; proposed: string; op: PlanOp }[] = [];

  const nodeIds = [...new Set(ops.map((o) => o.nodeId).filter((id): id is string => !!id))];
  const nodesById = new Map<string, { title: string; target_date: string | null }>();
  if (nodeIds.length > 0) {
    const { data } = await db.from("goal_nodes").select("id, title, target_date").in("id", nodeIds);
    for (const n of data ?? []) nodesById.set(n.id, { title: n.title, target_date: n.target_date });
  }

  let currentCapacity: { ideal_minutes: number; normal_minutes: number; minimum_minutes: number; days_per_week: number } | null = null;
  let currentGoal: { outcome_statement: string; target_date: string | null } | null = null;

  for (const op of ops) {
    switch (op.op) {
      case "shift_milestone": {
        const node = op.nodeId ? nodesById.get(op.nodeId) : null;
        rows.push({
          label: node?.title ?? "Milestone",
          now: node?.target_date ?? "no date set",
          proposed: op.newTargetDate ?? "",
          op,
        });
        break;
      }
      case "rescope_milestone": {
        const node = op.nodeId ? nodesById.get(op.nodeId) : null;
        rows.push({ label: "Milestone", now: node?.title ?? "", proposed: op.newTitle ?? node?.title ?? "", op });
        break;
      }
      case "drop_project": {
        const node = op.nodeId ? nodesById.get(op.nodeId) : null;
        rows.push({ label: node?.title ?? "Project", now: "included", proposed: "dropped", op });
        break;
      }
      case "adjust_capacity": {
        if (!currentCapacity) {
          const { data } = await db
            .from("capacity_profiles")
            .select("ideal_minutes, normal_minutes, minimum_minutes, days_per_week")
            .eq("goal_id", goalId)
            .order("effective_from", { ascending: false })
            .limit(1)
            .maybeSingle();
          currentCapacity = data ?? null;
        }
        rows.push({
          label: "Capacity",
          now: currentCapacity ? `${formatMinutes(currentCapacity.ideal_minutes)}/day, ${currentCapacity.days_per_week}d/week` : "unknown",
          proposed: `${formatMinutes(op.idealMinutes ?? 0)}/day, ${op.daysPerWeek ?? "?"}d/week`,
          op,
        });
        break;
      }
      case "extend_horizon": {
        if (!currentGoal) {
          const { data } = await db.from("goals").select("outcome_statement, target_date").eq("id", goalId).maybeSingle();
          currentGoal = data ?? null;
        }
        rows.push({ label: "Target date", now: currentGoal?.target_date ?? "no date set", proposed: op.newTargetDate ?? "", op });
        break;
      }
      case "narrow_outcome": {
        if (!currentGoal) {
          const { data } = await db.from("goals").select("outcome_statement, target_date").eq("id", goalId).maybeSingle();
          currentGoal = data ?? null;
        }
        rows.push({ label: "Outcome", now: currentGoal?.outcome_statement ?? "", proposed: op.newOutcomeStatement ?? "", op });
        break;
      }
      default:
        break;
    }
  }
  return rows;
}

export default async function GoalHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: goalId } = await params;
  const db = await createClient();

  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect(`/auth/sign-in?next=${encodeURIComponent(`/goals/${goalId}/history`)}`);

  const { data: goal } = await db.from("goals").select("id, title").eq("id", goalId).maybeSingle();
  if (!goal) notFound();

  const { data: plans } = await db
    .from("plans")
    .select("id, version, status, source, horizon_start, horizon_end, generated_at")
    .eq("goal_id", goalId)
    .order("version", { ascending: false });

  const { data: events } = await db
    .from("replan_events")
    .select("id, trigger, diagnosis, patch, accepted, responded_at, created_at")
    .eq("goal_id", goalId)
    .order("created_at", { ascending: false });

  const pending = (events ?? []).filter((e) => e.accepted === null);
  const resolved = (events ?? []).filter((e) => e.accepted !== null);

  const standingLine1 =
    pending.length > 0
      ? TRIGGER_LEAD[pending[0].trigger]
      : (plans ?? []).length > 1
        ? "The plan has adapted as reality changed."
        : `One plan so far, from ${plans?.[0]?.generated_at?.slice(0, 10) ?? "the start"}.`;

  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-2xl flex-col gap-10 px-6 py-16">
      <StandingAnswer line1={standingLine1} />

      {pending.length > 0 && (
        <section className="flex flex-col gap-8">
          {await Promise.all(
            pending.map(async (e) => {
              const patch = e.patch as { ops: PlanOp[]; confidence: number; tradeoffs: string[]; diagnosis?: string };
              const diffRows = await buildDiffRows(db, goalId, patch.ops);
              async function acceptAction() {
                "use server";
                await respondToReplan({ replanEventId: e.id, accept: true });
              }
              async function rejectAction() {
                "use server";
                await respondToReplan({ replanEventId: e.id, accept: false });
              }
              return (
                <div key={e.id} className="flex flex-col gap-5">
                  <p className="text-sm text-ink-muted">
                    <span className="font-medium text-ink">{TRIGGER_LEAD[e.trigger]}</span> {TRIGGER_NOTICE[e.trigger]}
                  </p>
                  <p className="text-sm text-ink">{e.diagnosis}</p>

                  <div>
                    <h2 className="text-[13px] font-medium uppercase tracking-wide text-ink-muted">What we&apos;d change</h2>
                    <ul className="mt-3 flex flex-col gap-3">
                      {patch.ops.map((op, i) => (
                        <li key={i} className="border-b border-rule pb-3 last:border-b-0">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="font-medium text-ink">{OP_LABEL[op.op]}</span>
                            {HIGH_IMPACT_OPS.has(op.op) && (
                              <span className="text-xs uppercase tracking-wide text-accent">major change</span>
                            )}
                          </div>
                          <p className="text-sm text-ink-muted">{describeOp(op)}</p>
                          <p className="mt-1 text-xs text-ink-faint">because {op.reason}</p>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {patch.tradeoffs && patch.tradeoffs.length > 0 && (
                    <div>
                      <h2 className="text-[13px] font-medium uppercase tracking-wide text-ink-muted">What it costs</h2>
                      <ul className="mt-2 flex flex-col gap-1 text-sm text-ink-muted">
                        {patch.tradeoffs.map((t, i) => (
                          <li key={i}>· {t}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {diffRows.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[420px] border-collapse text-sm">
                        <caption className="sr-only">Now compared to proposed</caption>
                        <thead>
                          <tr className="border-b border-rule text-left text-ink-muted">
                            <th scope="col" className="py-1.5 font-medium">
                              Item
                            </th>
                            <th scope="col" className="py-1.5 font-medium">
                              Now
                            </th>
                            <th scope="col" className="py-1.5 font-medium">
                              Proposed
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {diffRows.map((row, i) => (
                            <tr key={i} className="border-b border-rule last:border-b-0">
                              <td className="py-1.5 pr-3 text-ink">{row.label}</td>
                              <td className={`py-1.5 pr-3 text-ink-muted ${row.op.op === "drop_project" ? "line-through" : ""}`}>
                                {row.now}
                              </td>
                              <td className="border-l-2 border-accent py-1.5 pl-3 text-ink">{row.proposed}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-4">
                    <form action={acceptAction}>
                      <button type="submit" className={buttonClass("primary")}>
                        Accept
                      </button>
                    </form>
                    <form action={rejectAction}>
                      <button type="submit" className={buttonClass("text")}>
                        Leave the plan as it is
                      </button>
                    </form>
                  </div>
                  <p className="text-xs text-ink-faint">
                    Leaving it means this won&apos;t be raised again for the same reason for a week.
                  </p>
                </div>
              );
            }),
          )}
        </section>
      )}

      <section className="flex flex-col gap-3 border-t border-rule pt-8">
        <h2 className="text-[13px] font-medium uppercase tracking-wide text-ink-muted">Plan versions</h2>
        <ol className="flex flex-col">
          {(plans ?? []).map((p) => (
            <li key={p.id} className="flex items-baseline justify-between border-b border-rule py-2 text-sm last:border-b-0">
              <span className="text-ink">
                v{p.version} <span className="text-ink-muted">({p.source})</span>
                {p.status === "superseded" && <span className="text-ink-faint"> — superseded</span>}
              </span>
              <span className="text-xs text-ink-muted">
                {p.horizon_start} → {p.horizon_end}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {resolved.length > 0 && (
        <section className="flex flex-col gap-3 border-t border-rule pt-8">
          <h2 className="text-[13px] font-medium uppercase tracking-wide text-ink-muted">Adaptation log</h2>
          <ol className="flex flex-col gap-4">
            {resolved.map((e) => (
              <li key={e.id} className="text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-ink">{TRIGGER_NOTICE[e.trigger]}</span>
                  <span className={e.accepted ? "text-health-on" : "text-ink-muted"}>
                    {e.accepted ? "Accepted" : "Rejected"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-ink-muted">{e.diagnosis}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {pending.length === 0 && resolved.length === 0 && (plans ?? []).length <= 1 && (
        <p className="text-sm text-ink-muted">Changes will appear here as the plan adapts.</p>
      )}

      <Link href={`/goals/${goalId}/today`} className="text-sm text-ink underline decoration-rule underline-offset-2 hover:text-accent">
        ← Today
      </Link>
    </main>
  );
}
