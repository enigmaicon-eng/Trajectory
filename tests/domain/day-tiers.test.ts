import { describe, expect, it } from "vitest";
import { packDayTiers, type DayTaskLike } from "@/lib/domain/day-tiers";

function t(tier: DayTaskLike["tier"], effortMinutes: number, sequence: number): DayTaskLike {
  return { tier, effortMinutes, sequence };
}

const capacity = { idealMinutes: 90, normalMinutes: 60, minimumMinutes: 20 };

describe("packDayTiers", () => {
  it("returns empty tiers for an empty day", () => {
    const result = packDayTiers([], capacity);
    expect(result).toEqual({ minimum: [], normal: [], ideal: [] });
  });

  it("nests minimum inside normal inside ideal by tier tag", () => {
    const tasks = [t("minimum", 15, 0), t("normal", 30, 1), t("ideal", 40, 2)];
    const result = packDayTiers(tasks, capacity);
    expect(result.minimum).toHaveLength(1);
    expect(result.normal).toHaveLength(2); // minimum + normal
    expect(result.ideal).toHaveLength(3); // all three
  });

  it("never leaves the minimum tier empty when any task exists, even all-ideal", () => {
    const tasks = [t("ideal", 40, 0), t("ideal", 25, 1)];
    const result = packDayTiers(tasks, capacity);
    expect(result.minimum.length).toBeGreaterThan(0);
    expect(result.minimum[0].effortMinutes).toBe(25); // cheapest task, even though tagged "ideal"
  });

  it("drops tasks that would overflow a tier's budget, but keeps the first", () => {
    const tasks = [t("minimum", 15, 0), t("minimum", 15, 1), t("minimum", 15, 2)];
    // budget 20: only the first 15min task fits; a second would push to 30 > 20
    const result = packDayTiers(tasks, capacity);
    expect(result.minimum).toHaveLength(1);
  });

  it("keeps at least one task in a tier even if it alone overflows the budget", () => {
    const tasks = [t("minimum", 500, 0)];
    const result = packDayTiers(tasks, capacity);
    expect(result.minimum).toHaveLength(1);
  });

  it("orders within a tier by sequence", () => {
    const tasks = [t("normal", 10, 2), t("normal", 10, 0), t("normal", 10, 1)];
    const result = packDayTiers(tasks, capacity);
    expect(result.normal.map((x) => x.sequence)).toEqual([0, 1, 2]);
  });
});
