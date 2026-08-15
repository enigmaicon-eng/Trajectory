import { describe, expect, it } from "vitest";
import { scheduleTasks, totalMinutes, type CandidateTaskLike } from "@/lib/domain/scheduler";

function task(tempId: string, effortMinutes: number, outcomeTempId = "o1"): CandidateTaskLike {
  return { tempId, title: tempId, why: "because", effortMinutes, tier: "normal", outcomeTempId, projectNodeId: "p1" };
}

describe("scheduleTasks", () => {
  it("places tasks that fit within a single day's capacity", () => {
    const { scheduled, dropped } = scheduleTasks([task("t1", 30)], ["2026-08-10"], 90);
    expect(dropped).toHaveLength(0);
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].scheduledFor).toBe("2026-08-10");
  });

  it("spreads tasks across days rather than cramming one day", () => {
    // Two 60min tasks can't share a single 90min day, so across 2 days only
    // 2 of the 3 tasks fit at all — but they must land on *different* days.
    const tasks = [task("t1", 60), task("t2", 60), task("t3", 60)];
    const { scheduled, dropped } = scheduleTasks(tasks, ["2026-08-10", "2026-08-11"], 90);
    expect(scheduled).toHaveLength(2);
    expect(dropped).toHaveLength(1);
    const byDay = new Map<string, number>();
    for (const t of scheduled) byDay.set(t.scheduledFor, (byDay.get(t.scheduledFor) ?? 0) + 1);
    expect([...byDay.values()].every((count) => count <= 1)).toBe(true);
  });

  it("never exceeds a day's capacity", () => {
    const tasks = [task("t1", 80), task("t2", 80)];
    const { scheduled } = scheduleTasks(tasks, ["2026-08-10"], 90);
    // only one of the two 80min tasks can fit in a single 90min day
    expect(scheduled).toHaveLength(1);
    const dayTotal = totalMinutes(scheduled.filter((t) => t.scheduledFor === "2026-08-10"));
    expect(dayTotal).toBeLessThanOrEqual(90);
  });

  it("drops tasks that fit nowhere", () => {
    const tasks = [task("t1", 500)];
    const { scheduled, dropped } = scheduleTasks(tasks, ["2026-08-10"], 90);
    expect(scheduled).toHaveLength(0);
    expect(dropped.map((t) => t.tempId)).toEqual(["t1"]);
  });

  it("caps total scheduled tasks at maxTasks, dropping the tail", () => {
    const tasks = [task("t1", 10), task("t2", 10), task("t3", 10)];
    const { scheduled, dropped } = scheduleTasks(tasks, ["2026-08-10"], 90, 2);
    expect(scheduled.map((t) => t.tempId)).toEqual(["t1", "t2"]);
    expect(dropped.map((t) => t.tempId)).toEqual(["t3"]);
  });

  it("returns tasks sorted by scheduled date then sequence", () => {
    const tasks = [task("t1", 30), task("t2", 30), task("t3", 30)];
    const { scheduled } = scheduleTasks(tasks, ["2026-08-11", "2026-08-10"], 30);
    for (let i = 1; i < scheduled.length; i++) {
      expect(scheduled[i].scheduledFor >= scheduled[i - 1].scheduledFor).toBe(true);
    }
  });

  it("never schedules more total minutes on a day than dailyCapacityMinutes", () => {
    const tasks = Array.from({ length: 10 }, (_, i) => task(`t${i}`, 25));
    const { scheduled } = scheduleTasks(tasks, ["2026-08-10", "2026-08-11", "2026-08-12"], 90, 10);
    const byDay = new Map<string, number>();
    for (const t of scheduled) byDay.set(t.scheduledFor, (byDay.get(t.scheduledFor) ?? 0) + t.effortMinutes);
    for (const total of byDay.values()) expect(total).toBeLessThanOrEqual(90);
  });
});
