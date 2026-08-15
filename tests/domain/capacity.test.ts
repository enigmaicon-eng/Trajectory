import { describe, expect, it } from "vitest";
import { availableDaysInWeek, dayCapacity, weekCapacityMinutes, type CapacityProfileLike } from "@/lib/domain/capacity";
import { weekBoundary } from "@/lib/domain/dates";

const profile: CapacityProfileLike = {
  idealMinutes: 90,
  normalMinutes: 60,
  minimumMinutes: 20,
  daysPerWeek: 5,
  preferredDays: [1, 2, 3, 4, 5], // Mon-Fri
  blackoutDates: [],
};

describe("availableDaysInWeek", () => {
  it("returns the preferred weekdays within the week", () => {
    const week = weekBoundary("2026-08-14", 0); // 2026-08-10..2026-08-16 (Mon..Sun)
    expect(availableDaysInWeek(profile, week)).toEqual([
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
      "2026-08-14",
    ]);
  });

  it("excludes blackout dates", () => {
    const week = weekBoundary("2026-08-14", 0);
    const withBlackout = { ...profile, blackoutDates: ["2026-08-12"] };
    expect(availableDaysInWeek(withBlackout, week)).toEqual([
      "2026-08-10",
      "2026-08-11",
      "2026-08-13",
      "2026-08-14",
    ]);
  });

  it("caps at daysPerWeek even if more preferred days fall in the week", () => {
    const week = weekBoundary("2026-08-14", 0);
    const allWeek = { ...profile, daysPerWeek: 3, preferredDays: [1, 2, 3, 4, 5, 6, 7] };
    expect(availableDaysInWeek(allWeek, week)).toEqual(["2026-08-10", "2026-08-11", "2026-08-12"]);
  });
});

describe("dayCapacity", () => {
  it("returns the day's minute budgets on a preferred, non-blackout day", () => {
    expect(dayCapacity(profile, "2026-08-10")).toEqual({
      date: "2026-08-10",
      idealMinutes: 90,
      normalMinutes: 60,
      minimumMinutes: 20,
    });
  });

  it("returns null on a non-preferred weekday", () => {
    expect(dayCapacity(profile, "2026-08-15")).toBeNull(); // Saturday
  });

  it("returns null on a blackout date even if it's a preferred weekday", () => {
    const withBlackout = { ...profile, blackoutDates: ["2026-08-10"] };
    expect(dayCapacity(withBlackout, "2026-08-10")).toBeNull();
  });
});

describe("weekCapacityMinutes", () => {
  it("multiplies available days by idealMinutes", () => {
    const week = weekBoundary("2026-08-14", 0);
    expect(weekCapacityMinutes(profile, week)).toBe(5 * 90);
  });
});
