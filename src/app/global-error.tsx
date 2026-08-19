"use client";

import { buttonClass } from "@/components/ui/button-styles";

// Only fires if the root layout itself throws — everywhere else, app/error.tsx
// handles it. Next requires this file to render its own <html>/<body> since it
// replaces the root layout wholesale.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main id="main" className="mx-auto flex min-h-screen max-w-xl flex-col items-start justify-center gap-4 px-6 py-16">
          <h1 className="text-[28px] font-normal leading-tight tracking-tight text-ink">Something on our side failed</h1>
          <p className="text-sm text-ink-muted">
            The app hit an unexpected error. Nothing was lost — try reloading.
          </p>
          <button onClick={() => reset()} className={buttonClass("primary")}>
            Reload
          </button>
        </main>
      </body>
    </html>
  );
}
