"use client";

import { useEffect } from "react";
import Link from "next/link";
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
    <main id="main" className="mx-auto flex min-h-screen max-w-xl flex-col items-start justify-center gap-4 px-6 py-16">
      <h1 className="text-[28px] font-normal leading-tight tracking-tight text-ink">This page didn&apos;t load</h1>
      <p className="text-sm text-ink-muted">
        Nothing you did caused this, and nothing was lost. Retry, or go back to your goals.
      </p>
      <div className="flex gap-3">
        <button onClick={() => reset()} className={buttonClass("primary")}>
          Retry
        </button>
        <Link href="/goals" className={buttonClass("secondary")}>
          Back to your goals
        </Link>
      </div>
    </main>
  );
}
