import { test } from "vitest";
import assert from "node:assert/strict";
import {
  isValidDate,
  opportunities,
  periodFor,
  scheduled,
  shiftDate,
  statusFor,
  streak,
  summarize,
  weekStart,
} from "../shared/domain";
import type { Goal, Snapshot } from "../shared/types";

const daily: Goal = {
  id: "daily",
  title: "Ler",
  description: "",
  category: "Estudos",
  frequency: "daily",
  startDate: "2026-10-19",
  archivedOn: null,
  routineId: null,
};
test("local calendar dates handle month, leap year and Monday boundaries", () => {
  assert.equal(shiftDate("2026-03-01", -1), "2026-02-28");
  assert.equal(shiftDate("2024-02-28", 1), "2024-02-29");
  assert.equal(weekStart("2026-10-25"), "2026-10-19");
  assert.equal(weekStart("2026-10-26"), "2026-10-26");
  assert.equal(isValidDate("2026-02-30"), false);
  assert.equal(isValidDate("2026-10-27"), true);
});
test("daily progress includes pending and missed goals in the denominator", () => {
  const goals = [daily, { ...daily, id: "second" }, { ...daily, id: "third" }];
  const summary = summarize(goals, "2026-10-20", [
    { goalId: "daily", period: "2026-10-20", status: "done" },
    { goalId: "second", period: "2026-10-20", status: "missed" },
  ]);
  assert.deepEqual(summary, {
    total: 3,
    done: 1,
    missed: 1,
    pending: 1,
    percent: 33,
  });
  assert.equal(summarize([], "2026-10-20", []).percent, 0);
});
test("daily goals reset next day; weekly goals share one result Monday through Sunday", () => {
  const weekly = { ...daily, id: "weekly", frequency: "weekly" as const };
  const entries = [
    { goalId: "weekly", period: "2026-10-19", status: "done" as const },
    { goalId: "daily", period: "2026-10-20", status: "done" as const },
  ];
  assert.equal(statusFor(daily, "2026-10-21", entries), "pending");
  assert.equal(statusFor(weekly, "2026-10-25", entries), "done");
  assert.equal(statusFor(weekly, "2026-10-26", entries), "pending");
  assert.equal(periodFor(weekly, "2026-10-21"), "2026-10-19");
});
test("one-time routines expire next day and archives retain previous dates", () => {
  const once = { ...daily, frequency: "once" as const };
  assert.equal(scheduled(once, "2026-10-19"), true);
  assert.equal(scheduled(once, "2026-10-20"), false);
  assert.equal(
    scheduled({ ...daily, archivedOn: "2026-10-21" }, "2026-10-20"),
    true,
  );
  assert.equal(
    scheduled({ ...daily, archivedOn: "2026-10-21" }, "2026-10-21"),
    false,
  );
  assert.equal(scheduled(daily, "2026-10-18"), false);
});
test("period totals count each weekly goal once and never create pre-start opportunities", () => {
  const snapshot: Snapshot = {
    goals: [daily, { ...daily, id: "weekly", frequency: "weekly" }],
    entries: [],
  };
  const items = opportunities(snapshot, "2026-10-01", "2026-10-25");
  assert.equal(items.length, 8);
  assert.equal(
    items.filter((item) => item.goal.frequency === "weekly").length,
    1,
  );
  assert.equal(
    opportunities(snapshot, "2026-10-19", "2026-10-26").filter(
      (item) => item.goal.frequency === "weekly",
    ).length,
    2,
  );
});
test("streak allows an unfinished today, breaks on an empty day and ignores weekly completions", () => {
  const snapshot: Snapshot = {
    goals: [daily, { ...daily, id: "weekly", frequency: "weekly" }],
    entries: [
      { goalId: "daily", period: "2026-10-19", status: "done" },
      { goalId: "daily", period: "2026-10-20", status: "done" },
      { goalId: "weekly", period: "2026-10-19", status: "done" },
    ],
  };
  assert.equal(streak(snapshot, "2026-10-21"), 2);
  assert.equal(streak(snapshot, "2026-10-22"), 0);
});
