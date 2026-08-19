"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { updateProfile } from "@/server/actions/settings";
import { buttonClass } from "@/components/ui/button-styles";

const FALLBACK_TIMEZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

function supportedTimezones(): string[] {
  try {
    // Not in every runtime's TS lib yet; guard rather than widen tsconfig for it.
    const supported = (
      Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
    ).supportedValuesOf?.("timeZone");
    return supported && supported.length > 0 ? supported : FALLBACK_TIMEZONES;
  } catch {
    return FALLBACK_TIMEZONES;
  }
}

export function AccountSettingsForm({
  initialDisplayName,
  initialTimezone,
  tier,
}: {
  initialDisplayName: string;
  initialTimezone: string;
  tier: "free" | "byok";
}) {
  const timezones = useMemo(() => supportedTimezones(), []);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("saving");
    try {
      await updateProfile({ displayName, timezone });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="rounded-md border border-rule p-4">
        <p className="text-sm text-ink-muted">Plan</p>
        <p className="mt-1 font-medium capitalize">{tier === "byok" ? "Your own key" : "Free"}</p>
        {tier === "free" && (
          <Link href="/settings/ai" className="mt-1 inline-block text-sm underline">
            Add your own key to remove generation limits
          </Link>
        )}
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Display name
        <input
          type="text"
          value={displayName}
          onChange={(e) => {
            setDisplayName(e.target.value);
            setStatus("idle");
          }}
          placeholder="Optional"
          className="rounded-md border border-rule px-3 py-2 outline-none focus-visible:border-ink"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Timezone
        <select
          value={timezone}
          onChange={(e) => {
            setTimezone(e.target.value);
            setStatus("idle");
          }}
          className="rounded-md border border-rule px-3 py-2 outline-none focus-visible:border-ink"
        >
          {!timezones.includes(timezone) && <option value={timezone}>{timezone}</option>}
          {timezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
        <span className="text-xs text-ink-muted">
          Used to figure out your day and week boundaries.
        </span>
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status === "saving"}
          className={`self-start ${buttonClass("primary")}`}
        >
          {status === "saving" ? "Saving..." : "Save changes"}
        </button>
        {status === "saved" && <span className="text-sm text-ink-muted">Saved.</span>}
        {status === "error" && (
          <span className="text-sm text-danger-ink">Couldn&apos;t save. Try again.</span>
        )}
      </div>
    </form>
  );
}
