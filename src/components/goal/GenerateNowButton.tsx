"use client";

import { useState } from "react";
import { retryGeneration } from "@/server/actions/goal";
import { buttonClass } from "@/components/ui/button-styles";

function formatResetsAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "soon";
  }
}

export function GenerateNowButton({ goalId }: { goalId: string }) {
  const [state, setState] = useState<"idle" | "busy" | "error" | "quota">("idle");
  const [resetsAt, setResetsAt] = useState<string | null>(null);

  async function handleClick() {
    setState("busy");
    try {
      const result = await retryGeneration({ goalId });
      if (result?.error === "quota_exceeded") {
        setResetsAt(result.resetsAt);
        setState("quota");
      }
      // On success retryGeneration redirects server-side to /today.
    } catch {
      setState("error");
    }
  }

  if (state === "quota") {
    return (
      <div className="flex flex-col gap-2 text-sm">
        <p className="text-neutral-800">
          Still over the free plan&apos;s limit — resets {resetsAt ? formatResetsAt(resetsAt) : "soon"}.
        </p>
        <a href="/settings/ai" className={`self-start ${buttonClass("primary", "small")}`}>
          Add a key to finish now
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleClick}
        disabled={state === "busy"}
        className={`self-start ${buttonClass("primary", "small")}`}
      >
        {state === "busy" ? "Generating..." : "Generate now"}
      </button>
      {state === "error" && (
        <p className="text-sm text-red-600">That didn&apos;t work. Try again.</p>
      )}
    </div>
  );
}
