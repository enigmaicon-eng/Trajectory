import type { AIProvider } from "./provider";
import { GeminiProvider } from "./providers/gemini";

// v1: platform Gemini only. BYOK credential resolution (decrypt
// user_credentials, pick openai/anthropic/gemini pro tier) ships in
// Phase 6 — see docs/PRODUCT-ARCHITECTURE.md build order.
export async function resolveProvider(_userId: string | null): Promise<AIProvider> {
  return new GeminiProvider();
}
