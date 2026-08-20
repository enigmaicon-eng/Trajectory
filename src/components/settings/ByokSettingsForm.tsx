"use client";

import { useState } from "react";
import { saveApiKey, deleteApiKey } from "@/server/actions/settings";
import type { ByokProvider, ByokStatus } from "@/lib/security/byok-session";
import { buttonClass } from "@/components/ui/button-styles";

const PROVIDERS: Array<{ id: ByokProvider; label: string; live: boolean }> = [
  { id: "gemini", label: "Gemini", live: true },
  { id: "anthropic", label: "Anthropic", live: false },
  { id: "openai", label: "OpenAI", live: false },
];

export function ByokSettingsForm({ initialStatus }: { initialStatus: ByokStatus[] }) {
  const [status, setStatus] = useState(initialStatus);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<ByokProvider | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hint = (id: ByokProvider) => status.find((s) => s.provider === id)?.keyHint;

  async function handleSave(id: ByokProvider) {
    if (!draft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { keyHint } = await saveApiKey({ provider: id, apiKey: draft.trim() });
      setStatus((prev) => [...prev.filter((s) => s.provider !== id), { provider: id, keyHint }]);
      setDraft("");
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(id: ByokProvider) {
    setBusy(true);
    setError(null);
    try {
      await deleteApiKey({ provider: id });
      setStatus((prev) => prev.filter((s) => s.provider !== id));
    } catch {
      setError("Couldn't remove that key. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {PROVIDERS.map(({ id, label, live }) => {
        const configuredHint = hint(id);
        return (
          <div key={id} className="rounded-md border border-rule p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">{label}</p>
                {!live && (
                  <p className="mt-1 text-xs uppercase tracking-wide text-ink-muted">
                    Coming soon
                  </p>
                )}
                {live && configuredHint && (
                  <p className="mt-1 text-sm text-ink-muted">Key on file: {configuredHint}</p>
                )}
                {live && !configuredHint && (
                  <p className="mt-1 text-sm text-ink-muted">No key set — using the free tier.</p>
                )}
              </div>

              {live && configuredHint && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleRemove(id)}
                  className={`shrink-0 ${buttonClass("secondary", "small")}`}
                >
                  Remove
                </button>
              )}
              {live && !configuredHint && editing !== id && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setEditing(id);
                    setDraft("");
                    setError(null);
                  }}
                  className={`shrink-0 ${buttonClass("secondary", "small")}`}
                >
                  Add key
                </button>
              )}
            </div>

            {live && editing === id && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSave(id);
                }}
                className="mt-3 flex flex-col gap-2"
              >
                <input
                  autoFocus
                  type="password"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={`${label} API key`}
                  disabled={busy}
                  className="rounded-md border border-rule px-3 py-2 text-sm outline-none focus-visible:border-ink"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={busy || !draft.trim()}
                    className={buttonClass("primary", "small")}
                  >
                    {busy ? "Verifying..." : "Save"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setEditing(null);
                      setError(null);
                    }}
                    className={buttonClass("ghost", "small")}
                  >
                    Cancel
                  </button>
                </div>
                {error && <p className="text-sm text-danger-ink">{error}</p>}
              </form>
            )}
          </div>
        );
      })}
      <p className="text-xs text-ink-muted">
        Your key is held for this browser session only and is never stored in our database.
        Closing your browser clears it.
      </p>
    </div>
  );
}
