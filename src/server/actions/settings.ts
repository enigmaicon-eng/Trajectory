"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import {
  setByokKey,
  clearByokKey,
  listByokStatus,
  type ByokProvider,
  type ByokStatus,
} from "@/lib/security/byok-session";
import { GeminiProvider } from "@/lib/ai/providers/gemini";

// v1 only has a live BYOK integration for gemini (open assumption #11 —
// anthropic/openai ship as conforming stubs). Restricting the write path
// here, not just the UI, so a crafted request can't silently store a key
// for a provider that will only ever throw NotConfiguredError.
const LIVE_BYOK_PROVIDERS: ByokProvider[] = ["gemini"];

const saveApiKeyInput = z.object({
  provider: z.enum(["gemini", "openai", "anthropic"]),
  apiKey: z.string().trim().min(8).max(512),
});

async function requireUserId(): Promise<string> {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Sign in to manage AI provider keys.");
  return user.id;
}

export async function getByokSettings(): Promise<ByokStatus[]> {
  await requireUserId();
  return listByokStatus();
}

export async function saveApiKey(
  input: z.infer<typeof saveApiKeyInput>,
): Promise<{ keyHint: string }> {
  await requireUserId();
  const { provider, apiKey } = saveApiKeyInput.parse(input);

  if (!LIVE_BYOK_PROVIDERS.includes(provider)) {
    throw new Error(`${provider} isn't available for BYOK yet — Gemini only for now.`);
  }

  // Verify before storing: a bad key should never sit silently in the
  // session only to surface as a confusing failure mid-plan-generation.
  try {
    await new GeminiProvider(undefined, apiKey).generateText({
      system: "Reply with the single word OK.",
      prompt: "OK",
      maxOutputTokens: 8,
      timeoutMs: 15_000,
      traceId: `byok-verify-${Date.now()}`,
    });
  } catch {
    throw new Error("That key didn't work. Check it and try again.");
  }

  await setByokKey(provider, apiKey);
  return { keyHint: `····${apiKey.slice(-4)}` };
}

export async function deleteApiKey(input: { provider: ByokProvider }): Promise<void> {
  await requireUserId();
  await clearByokKey(input.provider);
}

const updateProfileInput = z.object({
  displayName: z.string().trim().max(120).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
});

export async function updateProfile(input: z.infer<typeof updateProfileInput>): Promise<void> {
  const { displayName, timezone } = updateProfileInput.parse(input);
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Sign in to update your profile.");

  const { error } = await db
    .from("profiles")
    .update({
      ...(displayName !== undefined ? { display_name: displayName || null } : {}),
      ...(timezone !== undefined ? { timezone } : {}),
    })
    .eq("id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/settings/account");
}
