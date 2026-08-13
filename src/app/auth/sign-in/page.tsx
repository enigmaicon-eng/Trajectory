"use client";

import { createClient } from "@/lib/db/client";
import { useState } from "react";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");

  async function signInWithEmail(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setStatus(error ? "error" : "sent");
  }

  async function signInWithGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <h1 className="text-xl font-medium">Sign in</h1>

      {status === "sent" ? (
        <p className="text-sm text-neutral-600">
          Check {email} for a sign-in link.
        </p>
      ) : (
        <form onSubmit={signInWithEmail} className="flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white"
          >
            Send sign-in link
          </button>
          {status === "error" && (
            <p className="text-sm text-red-600">Something went wrong. Try again.</p>
          )}
        </form>
      )}

      <div className="flex items-center gap-3 text-xs text-neutral-400">
        <div className="h-px flex-1 bg-neutral-200" />
        or
        <div className="h-px flex-1 bg-neutral-200" />
      </div>

      <button
        onClick={signInWithGoogle}
        className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
      >
        Continue with Google
      </button>
    </main>
  );
}
