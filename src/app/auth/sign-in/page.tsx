"use client";

import { createClient } from "@/lib/db/client";
import { useState } from "react";
import { buttonClass } from "@/components/ui/button-styles";

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
    <main id="main" className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <h1 className="text-[28px] font-normal leading-tight tracking-tight text-ink">Sign in</h1>

      {status === "sent" ? (
        <p className="text-sm text-ink-muted">Check {email} for a sign-in link.</p>
      ) : (
        <form onSubmit={signInWithEmail} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm text-ink-muted">
            Email
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-rule bg-paper px-3 py-2 text-base text-ink"
            />
          </label>
          <button type="submit" className={buttonClass("primary")}>
            Send sign-in link
          </button>
          {status === "error" && (
            <p role="alert" className="text-sm text-danger-ink">
              That didn&apos;t send. Try again.
            </p>
          )}
        </form>
      )}

      <div className="flex items-center gap-3 text-xs text-ink-muted">
        <div className="h-px flex-1 bg-rule" />
        or
        <div className="h-px flex-1 bg-rule" />
      </div>

      <button onClick={signInWithGoogle} className={buttonClass("secondary")}>
        Continue with Google
      </button>
    </main>
  );
}
