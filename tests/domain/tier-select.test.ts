import { describe, expect, it } from "vitest";
import { pickDefaultTier } from "@/lib/tier-select";

// Minimum Viable Progress: which of the three effort tiers Today defaults to,
// given what the user actually said about today (or nothing at all).
const budget = { minimum: 20, normal: 60, ideal: 90 };

describe("pickDefaultTier", () => {
  it("normal day: no check-in defaults to normal", () => {
    expect(pickDefaultTier(null, budget)).toBe("normal");
  });

  it("normal day: ample minutes selects ideal", () => {
    expect(pickDefaultTier(120, budget)).toBe("ideal");
  });

  it("normal day: minutes exactly at a tier's budget select that tier", () => {
    expect(pickDefaultTier(90, budget)).toBe("ideal");
    expect(pickDefaultTier(60, budget)).toBe("normal");
    expect(pickDefaultTier(20, budget)).toBe("minimum");
  });

  it("reduced availability: enough for minimum but not normal selects minimum", () => {
    expect(pickDefaultTier(40, budget)).toBe("minimum");
  });

  it("reduced availability: just under the normal budget still selects minimum", () => {
    expect(pickDefaultTier(59, budget)).toBe("minimum");
  });

  it("zero available time: still resolves to minimum, never crashes or returns nothing", () => {
    expect(pickDefaultTier(0, budget)).toBe("minimum");
  });

  it("zero available time: even when the minimum tier's own budget is nonzero", () => {
    // The user has genuinely nothing today, but the product's guarantee (§7:
    // "the minimum-viable day is always one tap away") means the tier
    // selector never refuses to name a smallest option.
    expect(pickDefaultTier(0, { minimum: 10, normal: 45, ideal: 90 })).toBe("minimum");
  });

  it("repeated low-capacity days: the same low input keeps resolving the same way, not degrading further", () => {
    const days = [15, 10, 5, 0, 8];
    for (const minutesAvailable of days) {
      expect(pickDefaultTier(minutesAvailable, budget)).toBe("minimum");
    }
  });
});
