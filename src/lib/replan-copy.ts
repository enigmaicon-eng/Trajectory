import type { PlanOp } from "@/lib/ai/modules/replan/output.schema";
import type { Database } from "@/lib/db/types.generated";

type ReplanTrigger = Database["public"]["Enums"]["replan_trigger"];

// §12.1: "it states the deterministic trigger in plain language." Shared
// between the Today/Week notice and the full proposal screen so the wording
// is learned once.
export const TRIGGER_NOTICE: Record<ReplanTrigger, string> = {
  low_execution: "Recent weeks have landed well under the planned effort.",
  milestone_off_track: "A milestone on the critical path is off track.",
  capacity_changed: "Your available time changed by more than a quarter.",
  ahead_of_schedule: "Recent weeks have landed well ahead of plan.",
  missed_checkins: "It's been over a week without an update.",
  user_requested: "A fresh look at the plan was requested.",
  priority_change: "Priorities changed.",
  dependency_change: "Dependencies changed.",
};

// The notice's lead sentence — never a moral judgment, always "the system
// takes responsibility for the plan, not the user" (§11.1 rule 6). For the
// two triggers that fire because work didn't happen, this is the exact
// non-punitive reframe: the plan is what changed, not a verdict on the user.
export const TRIGGER_LEAD: Record<ReplanTrigger, string> = {
  low_execution: "Your week changed. Let's adjust the plan.",
  missed_checkins: "Your week changed. Let's adjust the plan.",
  milestone_off_track: "The plan needs a change.",
  capacity_changed: "The plan needs a change.",
  ahead_of_schedule: "The plan can move faster.",
  user_requested: "Here's a fresh read on the plan.",
  priority_change: "The plan needs a change.",
  dependency_change: "The plan needs a change.",
};

export const OP_LABEL: Record<PlanOp["op"], string> = {
  shift_milestone: "Move a date",
  rescope_milestone: "Rescope a milestone",
  drop_project: "Drop a project",
  add_dependency: "Add a dependency",
  remove_dependency: "Remove a dependency",
  adjust_capacity: "Adjust capacity",
  extend_horizon: "Extend the horizon",
  narrow_outcome: "Narrow the outcome",
};

export const HIGH_IMPACT_OPS = new Set<PlanOp["op"]>([
  "narrow_outcome",
  "extend_horizon",
  "rescope_milestone",
  "drop_project",
]);

export function describeOp(op: PlanOp): string {
  switch (op.op) {
    case "shift_milestone":
      return `Move the target date to ${op.newTargetDate}`;
    case "rescope_milestone":
      return op.newTitle ? `Rename it to "${op.newTitle}"` : "Rescope this milestone";
    case "drop_project":
      return "Drop this project from the plan";
    case "add_dependency":
      return "Add a dependency between two items";
    case "remove_dependency":
      return "Remove a dependency between two items";
    case "adjust_capacity":
      return `Set capacity to ${op.idealMinutes}m ideal / ${op.normalMinutes}m normal / ${op.minimumMinutes}m minimum, ${op.daysPerWeek} days a week`;
    case "extend_horizon":
      return `Extend the target date to ${op.newTargetDate}`;
    case "narrow_outcome":
      return op.newOutcomeStatement ? `Narrow the outcome to "${op.newOutcomeStatement}"` : "Narrow the outcome";
    default:
      return OP_LABEL[op.op];
  }
}
