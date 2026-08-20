import { describe, expect, it } from "vitest";
import { rescheduleTask } from "@/lib/domain/reschedule";

describe("rescheduleTask", () => {
  it("carries a missed task's content forward unchanged onto the new day", () => {
    const original = { title: "Draft the outline", why: "Unblocks Thursday", effortMinutes: 20, tier: "minimum" as const, sequence: 2 };
    const result = rescheduleTask(original, "2026-08-21");
    expect(result.title).toBe(original.title);
    expect(result.why).toBe(original.why);
    expect(result.effortMinutes).toBe(original.effortMinutes);
    expect(result.tier).toBe(original.tier);
    expect(result.sequence).toBe(original.sequence);
  });

  it("lands on the target date as a fresh pending task, not a completed or skipped one", () => {
    const result = rescheduleTask(
      { title: "Send the intro email", why: null, effortMinutes: 10, tier: "minimum", sequence: 0 },
      "2026-08-22",
    );
    expect(result.scheduledFor).toBe("2026-08-22");
    expect(result.status).toBe("pending");
  });

  it("is never marked as user-added, distinguishing a carry from a manually added task", () => {
    const result = rescheduleTask(
      { title: "Review notes", why: null, effortMinutes: 15, tier: "normal", sequence: 1 },
      "2026-08-22",
    );
    expect(result.isUserAdded).toBe(false);
  });

  it("preserves a null why line rather than inventing one", () => {
    const result = rescheduleTask(
      { title: "Stretch", why: null, effortMinutes: 5, tier: "minimum", sequence: 0 },
      "2026-08-22",
    );
    expect(result.why).toBeNull();
  });
});
