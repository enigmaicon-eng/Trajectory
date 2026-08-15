// Resolves the ideal/normal/minimum day (§3.2 CapacityProfile) into concrete
// available calendar days and per-day/per-week minute budgets. Pure and
// I/O-free like graph.ts/dates.ts — callers (scheduler.ts, plan generation,
// signals.ts) pass in already-loaded profile fields.

import { daysInRange, isoWeekday, type ISODate, type WeekBoundary } from "./dates";

export interface CapacityProfileLike {
  idealMinutes: number;
  normalMinutes: number;
  minimumMinutes: number;
  daysPerWeek: number;
  preferredDays: number[]; // ISO weekday, 1 = Monday ... 7 = Sunday
  blackoutDates: ISODate[];
}

export interface DayCapacity {
  date: ISODate;
  idealMinutes: number;
  normalMinutes: number;
  minimumMinutes: number;
}

/**
 * The calendar days within `week` that are actually workable: preferred
 * weekdays, minus blackout dates, capped at `daysPerWeek` (earliest days in
 * the week win when preferredDays has more entries than daysPerWeek).
 */
export function availableDaysInWeek(profile: CapacityProfileLike, week: WeekBoundary): ISODate[] {
  const preferred = new Set(profile.preferredDays);
  const blackout = new Set(profile.blackoutDates);
  const candidates = daysInRange(week.startsOn, week.endsOn).filter(
    (d) => preferred.has(isoWeekday(d)) && !blackout.has(d),
  );
  return candidates.slice(0, profile.daysPerWeek);
}

export function dayCapacity(profile: CapacityProfileLike, date: ISODate): DayCapacity | null {
  if (profile.blackoutDates.includes(date)) return null;
  if (!profile.preferredDays.includes(isoWeekday(date))) return null;
  return {
    date,
    idealMinutes: profile.idealMinutes,
    normalMinutes: profile.normalMinutes,
    minimumMinutes: profile.minimumMinutes,
  };
}

/** Total ideal-pace budget for a week, e.g. for `plan_weeks.capacity_minutes`. */
export function weekCapacityMinutes(profile: CapacityProfileLike, week: WeekBoundary): number {
  return availableDaysInWeek(profile, week).length * profile.idealMinutes;
}
