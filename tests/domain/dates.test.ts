import { describe, expect, it } from "vitest";
import {
  addDays,
  addWeeks,
  daysBetween,
  daysInRange,
  horizonEnd,
  isoWeekday,
  startOfWeekMonday,
  toISODate,
  weekBoundaries,
  weekBoundary,
} from "@/lib/domain/dates";

describe("addDays / addWeeks / daysBetween", () => {
  it("adds days across a month boundary", () => {
    expect(addDays("2026-01-30", 3)).toBe("2026-02-02");
  });

  it("adds days across a leap-year Feb boundary", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29"); // 2028 is a leap year
    expect(addDays("2028-02-29", 1)).toBe("2028-03-01");
  });

  it("adds days across a year boundary", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });

  it("subtracts days with a negative delta", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("adds whole weeks", () => {
    expect(addWeeks("2026-01-01", 2)).toBe("2026-01-15");
  });

  it("computes the day distance between two dates", () => {
    expect(daysBetween("2026-01-01", "2026-01-08")).toBe(7);
    expect(daysBetween("2026-01-08", "2026-01-01")).toBe(-7);
  });
});

describe("isoWeekday / startOfWeekMonday", () => {
  it("returns 1 for Monday through 7 for Sunday", () => {
    // 2026-08-10 is a Monday.
    expect(isoWeekday("2026-08-10")).toBe(1);
    expect(isoWeekday("2026-08-14")).toBe(5); // Friday
    expect(isoWeekday("2026-08-16")).toBe(7); // Sunday
  });

  it("finds the Monday on or before an arbitrary date", () => {
    expect(startOfWeekMonday("2026-08-14")).toBe("2026-08-10"); // Friday -> that week's Monday
    expect(startOfWeekMonday("2026-08-10")).toBe("2026-08-10"); // already Monday
    expect(startOfWeekMonday("2026-08-16")).toBe("2026-08-10"); // Sunday -> previous Monday
  });
});

describe("weekBoundary / weekBoundaries / horizonEnd", () => {
  it("aligns week 0 to the Monday of the horizon-start week", () => {
    const w0 = weekBoundary("2026-08-14", 0); // Friday
    expect(w0).toEqual({ weekIndex: 0, startsOn: "2026-08-10", endsOn: "2026-08-16" });
  });

  it("produces consecutive 7-day weeks", () => {
    const w1 = weekBoundary("2026-08-14", 1);
    expect(w1).toEqual({ weekIndex: 1, startsOn: "2026-08-17", endsOn: "2026-08-23" });
  });

  it("weekBoundaries returns exactly horizonWeeks entries in order", () => {
    const weeks = weekBoundaries("2026-08-14", 12);
    expect(weeks).toHaveLength(12);
    expect(weeks[0].startsOn).toBe("2026-08-10");
    expect(weeks[11].weekIndex).toBe(11);
    for (let i = 1; i < weeks.length; i++) {
      expect(weeks[i].startsOn).toBe(addDays(weeks[i - 1].startsOn, 7));
    }
  });

  it("horizonEnd matches the last week's end date", () => {
    const weeks = weekBoundaries("2026-08-14", 12);
    expect(horizonEnd("2026-08-14", 12)).toBe(weeks[weeks.length - 1].endsOn);
  });
});

describe("daysInRange", () => {
  it("is inclusive of both endpoints", () => {
    expect(daysInRange("2026-08-10", "2026-08-12")).toEqual(["2026-08-10", "2026-08-11", "2026-08-12"]);
  });

  it("returns an empty array when end precedes start", () => {
    expect(daysInRange("2026-08-12", "2026-08-10")).toEqual([]);
  });
});

describe("toISODate", () => {
  it("round-trips through toDate/toISODate without drift", () => {
    expect(toISODate(new Date("2026-08-14T00:00:00Z"))).toBe("2026-08-14");
  });
});
