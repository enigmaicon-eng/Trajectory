"use client";

// Only fires if the root layout itself throws — everywhere else, app/error.tsx
// handles it. Next requires this file to render its own <html>/<body> since it
// replaces the root layout wholesale.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main className="mx-auto flex min-h-screen max-w-xl flex-col items-start justify-center gap-4 px-6 py-16">
          <h1 className="text-xl font-medium">Something went wrong</h1>
          <p className="text-sm text-neutral-600">
            The app hit an unexpected error. Nothing was lost — try reloading.
          </p>
          <button
            onClick={() => reset()}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white"
          >
            Reload
          </button>
        </main>
      </body>
    </html>
  );
}
