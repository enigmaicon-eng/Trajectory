import type { ModuleDefinition, RunContext } from "../../run";
import { runModule } from "../../run";
import { planWeekInputSchema, type PlanWeekInput } from "./input.schema";
import { planWeekOutputSchema, type PlanWeekOutput } from "./output.schema";
import { buildPlanWeekPrompt } from "./prompt.v1";
import { applyPlanWeekInvariants } from "@/lib/domain/plan-invariants";

const planWeekModule: ModuleDefinition<PlanWeekInput, PlanWeekOutput> = {
  name: "plan_week",
  moduleClass: "heavy",
  inputSchema: planWeekInputSchema,
  outputSchema: planWeekOutputSchema,
  schemaName: "PlanWeekOutput",
  buildPrompt: buildPlanWeekPrompt,
  applyInvariants: (output, input) =>
    applyPlanWeekInvariants(output, new Set(input.eligibleProjects.map((p) => p.id))),
};

export async function runPlanWeek(input: PlanWeekInput, ctx: RunContext): Promise<PlanWeekOutput> {
  return runModule(planWeekModule, input, ctx);
}
