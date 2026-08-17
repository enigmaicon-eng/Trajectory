import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types.generated";
import { resolveProvider } from "./registry";
import { checkAndIncrementUsage } from "@/lib/usage/limits";
import { AIValidationError } from "./errors";
import { redactSecrets } from "@/lib/security/redact";

type AiModule = Database["public"]["Enums"]["ai_module"];

export interface RunContext {
  userId: string | null;
  goalId?: string;
  traceId: string;
  db: SupabaseClient<Database>;
}

export interface ModuleDefinition<TIn, TOut> {
  name: AiModule;
  moduleClass: "light" | "heavy";
  inputSchema: z.ZodType<TIn>;
  outputSchema: z.ZodType<TOut>;
  schemaName: string;
  buildPrompt: (input: TIn) => { system: string; prompt: string };
  // Deterministic repair/validation beyond what zod can express (§7.4).
  // Return the (possibly repaired) output, or throw to hard-fail.
  applyInvariants?: (output: TOut, input: TIn) => TOut;
}

function buildRepairPrompt(originalPrompt: string, issues: unknown): string {
  return [
    originalPrompt,
    "",
    "Your previous response did not match the required schema.",
    `Schema errors: ${JSON.stringify(issues)}`,
    "Return a corrected object that satisfies the schema exactly.",
  ].join("\n");
}

export async function runModule<TIn, TOut>(
  def: ModuleDefinition<TIn, TOut>,
  rawInput: TIn,
  ctx: RunContext,
): Promise<TOut> {
  const input = def.inputSchema.parse(rawInput);
  const { provider, usedByok } = await resolveProvider(ctx.userId);

  // Pre-auth calls (onboarding clarify/assess) have no user row yet — quota
  // and ai_runs both FK to auth.users, so neither applies until sign-in.
  // §9: BYOK is unlimited (the user's own quota), so it bypasses the
  // platform counters entirely.
  if (ctx.userId && !usedByok) {
    await checkAndIncrementUsage(ctx.db, ctx.userId, def.moduleClass);
  }

  const { system, prompt } = def.buildPrompt(input);

  let attempts = 0;
  let status: "ok" | "schema_invalid" | "invariant_failed" | "provider_error" = "ok";
  let errorCode: string | null = null;
  let finalOutput: TOut | undefined;
  let lastParseIssues: unknown;
  let lastUsage: { inputTokens?: number; outputTokens?: number } = {};
  let lastModel = provider.model;
  const startedAt = Date.now();

  for (let attempt = 0; attempt < 2 && !finalOutput; attempt++) {
    attempts++;
    try {
      const result = await provider.generateStructured({
        system,
        prompt: attempt === 0 ? prompt : buildRepairPrompt(prompt, lastParseIssues),
        schema: def.outputSchema,
        schemaName: def.schemaName,
        traceId: ctx.traceId,
      });
      lastUsage = result.usage;
      lastModel = result.model;

      const parsed = def.outputSchema.safeParse(result.data);
      if (!parsed.success) {
        status = "schema_invalid";
        lastParseIssues = parsed.error.issues;
        continue;
      }

      try {
        finalOutput = def.applyInvariants
          ? def.applyInvariants(parsed.data, input)
          : parsed.data;
        status = "ok";
      } catch (invariantErr) {
        status = "invariant_failed";
        lastParseIssues = invariantErr instanceof Error ? invariantErr.message : invariantErr;
      }
    } catch (err) {
      status = "provider_error";
      // A BYOK caller's raw key can appear in provider SDK error text (e.g.
      // Google's API embeds it in the request URL) — never persist that
      // un-redacted (§10, R9: "metadata-only ai_runs").
      errorCode = redactSecrets(err instanceof Error ? err.message : String(err));
    }
  }

  if (ctx.userId) {
    await ctx.db.from("ai_runs").insert({
      user_id: ctx.userId,
      goal_id: ctx.goalId ?? null,
      module: def.name,
      provider: provider.id,
      model: lastModel,
      prompt_version: "v1",
      used_byok: usedByok,
      status,
      attempts,
      input_tokens: lastUsage.inputTokens ?? null,
      output_tokens: lastUsage.outputTokens ?? null,
      latency_ms: Date.now() - startedAt,
      error_code: errorCode,
    });
  }

  if (!finalOutput) {
    throw new AIValidationError(
      `${def.name} failed after ${attempts} attempt(s): ${status}`,
      lastParseIssues,
    );
  }

  return finalOutput;
}
