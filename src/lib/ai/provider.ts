import type { z } from "zod";

export type ProviderId = "gemini" | "openai" | "anthropic";

export interface StructuredRequest<T> {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  schemaName: string;
  temperature?: number; // default 0.3
  maxOutputTokens?: number;
  timeoutMs?: number; // default 45_000
  traceId: string;
}

export interface StructuredResult<T> {
  data: T;
  usage: { inputTokens?: number; outputTokens?: number };
  model: string;
  raw: string;
}

export interface TextRequest {
  system: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  traceId: string;
}

export interface TextResult {
  text: string;
  usage: { inputTokens?: number; outputTokens?: number };
  model: string;
}

export interface AIProvider {
  readonly id: ProviderId;
  readonly model: string;
  generateStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>>;
  generateText(req: TextRequest): Promise<TextResult>;
}

// Thrown by stub providers (OpenAI, Anthropic in v1) and by BYOK resolution
// when a provider has no usable credential.
export class NotConfiguredError extends Error {
  constructor(public readonly provider: ProviderId) {
    super(`${provider} provider is not configured`);
    this.name = "NotConfiguredError";
  }
}
