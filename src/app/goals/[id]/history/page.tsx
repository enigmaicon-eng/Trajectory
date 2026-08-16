import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { respondToReplan } from "@/server/actions/adapt";
import { buttonClass } from "@/components/ui/button-styles";
import type { PlanOp } from "@/lib/ai/modules/replan/output.schema";

const OP_LABEL: Record<PlanOp["op"], string> = {
  shift_milestone: "Shift milestone date",
  rescope_milestone: "Rescope milestone",
  drop_project: "Drop project",
  add_dependency: "Add dependency",
  remove_dependency: "Remove dependency",
  adjust_capacity: "Adjust capacity",
  extend_horizon: "Extend horizon",
  narrow_outcome: "Narrow outcome",
};

function describeOp(op: PlanOp): string {
  switch (op.op) {
    case "shift_milestone":
      return `Move target date to ${op.newTargetDate}`;
    case "rescope_milestone":
      return op.newTitle ? `Rename to "${op.newTitle}"` : "Rescope";
    case "drop_project":
      return "Drop this project from the plan";
    case "add_dependency":
      return "Add a blocking dependency between two nodes";
    case "remove_dependency":
      return "Remove a blocking dependency between two nodes";
    case "adjust_capacity":
      return `Set capacity to ideal ${op.idealMinutes}m / normal ${op.normalMinutes}m / minimum ${op.minimumMinutes}m, ${op.daysPerWeek}d per week`;
    case "extend_horizon":
      return `Extend the target date to ${op.newTargetDate}`;
    case "narrow_outcome":
      return op.newOutcomeStatement ? `Narrow the outcome to "${op.newOutcomeStatement}"` : "Narrow the outcome";
    default:
      return op.op;
  }
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

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-10 px-6 py-16">
      <div>
        <nav aria-label="Goal" className="flex flex-wrap gap-4 text-sm text-neutral-500">
          <a href={`/goals/${goalId}/today`} className="underline">
            Today
          </a>
          <a href={`/goals/${goalId}/reflect`} className="underline">
            Reflect
          </a>
        </nav>
        <h1 className="mt-2 text-xl font-medium">{goal.title}</h1>
        <p className="mt-1 text-sm text-neutral-500">Plan history & adaptation log</p>
      </div>

      {pending.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
            Proposed replan{pending.length > 1 ? "s" : ""}
          </h2>
          {pending.map((e) => {
            const patch = e.patch as { ops: PlanOp[]; confidence: number; tradeoffs: string[] };
            async function acceptAction() {
              "use server";
              await respondToReplan({ replanEventId: e.id, accept: true });
            }
            async function rejectAction() {
              "use server";
              await respondToReplan({ replanEventId: e.id, accept: false });
            }
            return (
              <div key={e.id} className="rounded-md border border-neutral-300 p-4">
                <p className="text-xs uppercase tracking-wide text-neutral-500">{e.trigger.replace(/_/g, " ")}</p>
                <p className="mt-1 text-sm">{e.diagnosis}</p>
                <ul className="mt-3 flex flex-col gap-2 border-t border-neutral-100 pt-3 text-sm">
                  {patch.ops.map((op, i) => (
                    <li key={i} className="rounded-md bg-neutral-50 p-3">
                      <span className="font-medium">{OP_LABEL[op.op] ?? op.op}</span>
                      <p className="mt-1 text-neutral-600">{describeOp(op)}</p>
                      <p className="mt-1 text-xs text-neutral-500">{op.reason}</p>
                    </li>
                  ))}
                </ul>
                {patch.tradeoffs && patch.tradeoffs.length > 0 && (
                  <div className="mt-3 text-xs text-neutral-500">
                    <span className="font-medium text-neutral-700">Trade-offs: </span>
                    {patch.tradeoffs.join(" · ")}
                  </div>
                )}
                <div className="mt-4 flex gap-2">
                  <form action={acceptAction}>
                    <button type="submit" className={buttonClass("primary", "small")}>
                      Accept
                    </button>
                  </form>
                  <form action={rejectAction}>
                    <button type="submit" className={buttonClass("secondary", "small")}>
                      Reject
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">Plan versions</h2>
        <ol className="flex flex-col gap-2 text-sm">
          {(plans ?? []).map((p) => (
            <li key={p.id} className="flex items-baseline justify-between rounded-md border border-neutral-200 p-3">
              <span>
                v{p.version} <span className="text-neutral-500">({p.source})</span>
              </span>
              <span className="text-xs text-neutral-500">
                {p.status} · {p.horizon_start} → {p.horizon_end}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {resolved.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">Adaptation log</h2>
          <ol className="flex flex-col gap-2 text-sm">
            {resolved.map((e) => (
              <li key={e.id} className="rounded-md border border-neutral-200 p-3">
                <div className="flex items-baseline justify-between">
                  <span>{e.trigger.replace(/_/g, " ")}</span>
                  <span className={`text-xs ${e.accepted ? "text-emerald-700" : "text-neutral-500"}`}>
                    {e.accepted ? "Accepted" : "Rejected"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-neutral-500">{e.diagnosis}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {pending.length === 0 && resolved.length === 0 && (plans ?? []).length <= 1 && (
        <p className="text-sm text-neutral-600">No adaptations yet — this goal is still on its original plan.</p>
      )}
    </main>
  );
}
