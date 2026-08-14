"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createGoalDraft } from "@/server/actions/goal";

export function GoalInputForm() {
  const router = useRouter();
  const [rawInput, setRawInput] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!rawInput.trim()) return;

    setStatus("submitting");
    try {
      await createGoalDraft({ rawInput: rawInput.trim() });
      router.push("/start");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-xl flex-col gap-3">
      <textarea
        required
        rows={3}
        placeholder="What do you want to accomplish?"
        value={rawInput}
        onChange={(e) => setRawInput(e.target.value)}
        disabled={status === "submitting"}
        className="resize-none rounded-md border border-neutral-300 px-4 py-3 text-lg outline-none focus:border-neutral-500"
      />
      <button
        type="submit"
        disabled={status === "submitting" || !rawInput.trim()}
        className="self-start rounded-md bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-40"
      >
        {status === "submitting" ? "Thinking..." : "Get started"}
      </button>
      {status === "error" && (
        <p className="text-sm text-red-600">Something went wrong. Try again.</p>
      )}
    </form>
  );
}
