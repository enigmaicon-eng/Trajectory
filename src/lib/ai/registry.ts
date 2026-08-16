import type { AIProvider } from "./provider";
import { GeminiProvider } from "./providers/gemini";
import { AnthropicProvider } from "./providers/anthropic";
import { OpenAIProvider } from "./providers/openai";
import { getByokKey } from "@/lib/security/byok-session";

export interface ResolvedProvider {
  provider: AIProvider;
  usedByok: boolean;
}

// Phase 6: BYOK resolution. Checked in priority order — gemini first since
// it's the only live implementation (see providers/gemini.ts); anthropic and
// openai remain conforming stubs (open assumption #11) but are still
// resolved here so a user who saved one of those keys gets a provider_error
// from the real thing they configured, not a silent fallback to the
// platform key.
const PRIORITY: Array<"gemini" | "anthropic" | "openai"> = ["gemini", "anthropic", "openai"];

export async function resolveProvider(userId: string | null): Promise<ResolvedProvider> {
  if (userId) {
    for (const id of PRIORITY) {
      const key = await getByokKey(id);
      if (!key) continue;
      if (id === "gemini") return { provider: new GeminiProvider(undefined, key), usedByok: true };
      if (id === "anthropic") return { provider: new AnthropicProvider(), usedByok: true };
      return { provider: new OpenAIProvider(), usedByok: true };
    }
  }
  return { provider: new GeminiProvider(), usedByok: false };
}
