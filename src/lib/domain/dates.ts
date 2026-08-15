// Pure calendar-date arithmetic (§14 Phase 3, R6). Plan/task dates are
// Postgres `date` columns — never `timestamptz` — specifically so this module
// never has to reason about a wall-clock instant or an IANA zone: every
// function here treats an ISO "YYYY-MM-DD" string as a calendar day and does
// arithmetic by anchoring it at UTC midnight, which sidesteps local-timezone
// and DST drift entirely (a Date built from `${s}T00:00:00Z` never shifts
// day when formatted back with toISOString().slice(0, 10)).
//
// No I/O, no framework imports — pure and unit-testable like graph.ts.

export type ISODate = string; // "YYYY-MM-DD"

function assertISODate(s: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new Error(`dates: expected an ISO "YYYY-MM-DD" date, got ${JSON.stringify(s)}`);
  }
}

export function toDate(s: ISODate): Date {
  assertISODate(s);
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`dates: invalid date ${JSON.stringify(s)}`);
  return d;
}

export function toISODate(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function addDays(s: ISODate, days: number): ISODate {
  const d = toDate(s);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

export function addWeeks(s: ISODate, weeks: number): ISODate {
  return addDays(s, weeks * 7);
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / (24 * 60 * 60 * 1000));
}

/** ISO weekday: 1 = Monday ... 7 = Sunday. */
export function isoWeekday(s: ISODate): number {
  const jsDay = toDate(s).getUTCDay(); // 0 = Sunday ... 6 = Saturday
  return jsDay === 0 ? 7 : jsDay;
}

/** The Monday on or before `s` (§13.3: weeks start Monday, not user-configurable in v1). */
export function startOfWeekMonday(s: ISODate): ISODate {
  return addDays(s, -(isoWeekday(s) - 1));
}

export interface WeekBoundary {
  weekIndex: number;
  startsOn: ISODate;
  endsOn: ISODate;
}

/**
 * Monday-aligned week boundaries for a horizon. `horizonStart` need not
 * itself be a Monday — week 0 starts at the Monday of the week containing
 * horizonStart, matching how a mid-week goal start still gets a full week 1.
 */
export function weekBoundary(horizonStart: ISODate, weekIndex: number): WeekBoundary {
  const startsOn = addWeeks(startOfWeekMonday(horizonStart), weekIndex);
  return { weekIndex, startsOn, endsOn: addDays(startsOn, 6) };
}

export function weekBoundaries(horizonStart: ISODate, horizonWeeks: number): WeekBoundary[] {
  return Array.from({ length: horizonWeeks }, (_, i) => weekBoundary(horizonStart, i));
}

/** Last day of the horizon — the end of its final week. */
export function horizonEnd(horizonStart: ISODate, horizonWeeks: number): ISODate {
  return weekBoundary(horizonStart, horizonWeeks - 1).endsOn;
}

/** All calendar days in [startsOn, endsOn], inclusive. */
export function daysInRange(startsOn: ISODate, endsOn: ISODate): ISODate[] {
  const n = daysBetween(startsOn, endsOn);
  if (n < 0) return [];
  return Array.from({ length: n + 1 }, (_, i) => addDays(startsOn, i));
}

/**
 * UTC "today" as an ISO date. Per open assumption #9, signals/cron accept up
 * to 24h of lag for non-UTC users in v1; a per-user IANA-zone "today" is a
 * documented follow-up, not a Phase 3 requirement.
 */
export function todayISO(): ISODate {
  return toISODate(new Date());
}
