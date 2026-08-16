"use client";

import { useEffect } from "react";
import { buttonClass } from "@/components/ui/button-styles";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-start justify-center gap-4 px-6 py-16">
      <h1 className="text-xl font-medium">Something went wrong</h1>
      <p className="text-sm text-neutral-600">
        We hit a snag loading this. Nothing you did caused it, and nothing was lost.
      </p>
      <div className="flex gap-3">
        <button onClick={() => reset()} className={buttonClass("primary")}>
          Retry
        </button>
        <a href="/goals" className={buttonClass("secondary")}>
          Back to your goals
        </a>
      </div>
    </main>
  );
}
