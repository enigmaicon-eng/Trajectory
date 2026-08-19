"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createGoalDraft } from "@/server/actions/goal";
import { buttonClass } from "@/components/ui/button-styles";

const EXAMPLES = ["Run a half marathon", "Ship a paid product", "Move into design"];

// The textarea's aria-labelledby targets id="goal-question" — the visible
// "What do you want to accomplish?" heading rendered by the landing page
// above this component (§3: "the prompt is a real heading above it," not a
// placeholder-only label). This component assumes that id exists in its
// parent context.
export function GoalInputForm() {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [rawInput, setRawInput] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [tooShort, setTooShort] = useState(false);

  async function submit(value: string) {
    const trimmed = value.trim();
    if (trimmed.length < 10) {
      setTooShort(true);
      textareaRef.current?.focus();
      return;
    }
    setTooShort(false);
    setStatus("submitting");
    try {
      await createGoalDraft({ rawInput: trimmed });
      router.push("/start");
    } catch {
      setStatus("error");
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    void submit(rawInput);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit(rawInput);
    }
  }

  function handleExampleClick(example: string) {
    setRawInput(example);
    setTooShort(false);
    const el = textareaRef.current;
    if (el) {
      el.focus();
      // Cursor at end, per §3: clicking an example fills and positions for
      // editing — it never auto-submits.
      requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
      <textarea
        ref={textareaRef}
        required
        rows={3}
        placeholder="What do you want to accomplish? e.g. Become a product manager at a top tech company within 12 months"
        value={rawInput}
        onChange={(e) => {
          setRawInput(e.target.value);
          if (tooShort) setTooShort(false);
        }}
        onKeyDown={handleKeyDown}
        disabled={status === "submitting"}
        aria-labelledby="goal-question"
        aria-describedby="goal-input-help"
        aria-invalid={tooShort}
        className="resize-none rounded-md border border-rule bg-paper-raised px-4 py-3 text-lg text-ink outline-none focus-visible:border-ink"
      />

      <div id="goal-input-help" className="order-1 flex flex-col gap-1">
        {tooShort ? (
          <p role="alert" className="text-sm text-danger-ink">
            Say a bit more — what would be true when you&apos;re done?
          </p>
        ) : (
          <p className="text-sm text-ink-muted">Press Enter. No account needed yet.</p>
        )}
      </div>

      {status === "error" && (
        <p role="alert" className="order-2 text-sm text-danger-ink">
          That didn&apos;t save. Try again.
        </p>
      )}

      {/* DOM order puts Continue right after the input so keyboard users reach
          the primary action before the secondary example buttons (order-3
          restores the spec's visual position beneath the permission line). */}
      <button
        type="submit"
        disabled={status === "submitting" || !rawInput.trim()}
        className={`order-2 sticky bottom-4 self-start sm:static ${buttonClass("primary")}`}
      >
        {status === "submitting" ? "Working…" : "Continue"}
      </button>

      <p className="order-3 text-sm text-ink-muted">
        Try:{" "}
        {EXAMPLES.map((ex, i) => (
          <span key={ex}>
            <button
              type="button"
              onClick={() => handleExampleClick(ex)}
              className="underline decoration-rule underline-offset-2 hover:text-ink"
            >
              {ex.toLowerCase()}
            </button>
            {i < EXAMPLES.length - 1 && " · "}
          </span>
        ))}
      </p>
    </form>
  );
}
