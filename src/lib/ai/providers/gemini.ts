import { generateObject, generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type {
  AIProvider,
  StructuredRequest,
  StructuredResult,
  TextRequest,
  TextResult,
} from "../provider";

// The only complete AIProvider implementation in v1. Calls Google's
// Generative Language API directly with a free-tier API key — not routed
// through the Vercel AI Gateway, which gates all traffic (including free
// credits) behind a billing card on the Vercel team. BYOK providers (Phase
// 6) may still go through the gateway; this one intentionally doesn't.
function google() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return createGoogleGenerativeAI({ apiKey });
}

export class GeminiProvider implements AIProvider {
  readonly id = "gemini" as const;

  constructor(readonly model: string = "gemini-flash-lite-latest") {}

  async generateStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
    const { object, usage, response } = await generateObject({
      model: google()(this.model),
      schema: req.schema,
      schemaName: req.schemaName,
      system: req.system,
      prompt: req.prompt,
      temperature: req.temperature ?? 0.3,
      ...(req.maxOutputTokens ? { maxOutputTokens: req.maxOutputTokens } : {}),
      abortSignal: AbortSignal.timeout(req.timeoutMs ?? 45_000),
    });

    return {
      data: object,
      usage: { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens },
      model: response.modelId ?? this.model,
      raw: JSON.stringify(object),
    };
  }

  async generateText(req: TextRequest): Promise<TextResult> {
    const { text, usage, response } = await generateText({
      model: google()(this.model),
      system: req.system,
      prompt: req.prompt,
      temperature: req.temperature ?? 0.3,
      ...(req.maxOutputTokens ? { maxOutputTokens: req.maxOutputTokens } : {}),
      abortSignal: AbortSignal.timeout(req.timeoutMs ?? 45_000),
    });

    return {
      text,
      usage: { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens },
      model: response.modelId ?? this.model,
    };
  }
}
