import type { ModuleDefinition, RunContext } from "../../run";
import { runModule } from "../../run";
import { planDayInputSchema, type PlanDayInput } from "./input.schema";
import { planDayOutputSchema, type PlanDayOutput } from "./output.schema";
import { buildPlanDayPrompt } from "./prompt.v1";

const planDayModule: ModuleDefinition<PlanDayInput, PlanDayOutput> = {
  name: "plan_day",
  moduleClass: "light",
  inputSchema: planDayInputSchema,
  outputSchema: planDayOutputSchema,
  schemaName: "PlanDayOutput",
  buildPrompt: buildPlanDayPrompt,
};

/**
 * Purely a narrative layer (§5.2: "may fall back to a purely deterministic
 * selection if the provider fails"). The tier *contents* always come from
 * day-tiers.ts regardless of this call's outcome — callers should wrap this
 * in try/catch and treat a thrown error as "no framing today," never as a
 * reason to block rendering (AC-5.19).
 */
export async function runPlanDay(input: PlanDayInput, ctx: RunContext): Promise<PlanDayOutput> {
  return runModule(planDayModule, input, ctx);
}
