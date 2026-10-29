import {
  dateKey,
  goalsOn,
  opportunities,
  periodFor,
  shiftDate,
  statusFor,
  summarize,
  weekStart,
} from "./domain";
import type { Goal, Snapshot, Status } from "./types";

export const statusNames: Record<Status, string> = {
  done: "Atingida",
  missed: "Não atingida",
  pending: "Pendente",
};
export function restFor(snapshot: Snapshot, date: string) {
  return snapshot.dayPlans?.find((plan) => plan.date === date);
}
export function dailySummary(
  snapshot: Snapshot,
  date: string,
  today = dateKey(),
) {
  const goals = goalsOn(snapshot, date, today).filter(
    (goal) => goal.frequency !== "weekly",
  );
  const summary = summarize(goals, date, snapshot.entries);
  const state = restFor(snapshot, date)
    ? "rest"
    : date > today
      ? "planned"
      : summary.total
        ? "active"
        : "empty";
  return {
    ...summary,
    state,
    percent: state === "active" ? summary.percent : null,
    goals,
  };
}
export function weeklyGoals(
  snapshot: Snapshot,
  date: string,
  today = dateKey(),
): Goal[] {
  const end = shiftDate(weekStart(date), 6);
  const reference = weekStart(date) > today || end < today ? end : today;
  return goalsOn(snapshot, reference, today).filter(
    (goal) => goal.frequency === "weekly",
  );
}
export function weeklySummary(
  snapshot: Snapshot,
  date: string,
  today = dateKey(),
) {
  const goals = weeklyGoals(snapshot, date, today);
  const summary = summarize(goals, weekStart(date), snapshot.entries);
  const planned = weekStart(date) > today;
  return {
    ...summary,
    goals,
    planned,
    partial: !planned && shiftDate(weekStart(date), 7) > today,
    percent: !planned && summary.total ? summary.percent : null,
  };
}
export function dailyWeekSummary(
  snapshot: Snapshot,
  date: string,
  today = dateKey(),
) {
  const start = weekStart(date);
  const end = shiftDate(start, 6);
  const through = end < today ? end : today;
  const items =
    start > today
      ? []
      : opportunities(snapshot, start, through).filter(
          (item) => item.goal.frequency !== "weekly",
        );
  const done = items.filter((item) => item.status === "done").length;
  return {
    done,
    total: items.length,
    percent: items.length ? Math.round((done / items.length) * 100) : null,
    partial: start <= today && end >= today,
    planned: start > today,
  };
}
export function isClosed(goal: Goal, date: string, today: string): boolean {
  return goal.frequency === "weekly"
    ? shiftDate(weekStart(date), 7) <= today
    : date < today;
}
export function resultLabel(
  goal: Goal,
  date: string,
  snapshot: Snapshot,
  today: string,
): string {
  const status = statusFor(goal, date, snapshot.entries);
  return status === "pending" && isClosed(goal, date, today)
    ? "Sem registro"
    : statusNames[status];
}
export function dayLabel(
  snapshot: Snapshot,
  date: string,
  today: string,
): string {
  const summary = dailySummary(snapshot, date, today);
  if (summary.state === "rest") return "Descanso planejado";
  if (summary.state === "planned") return "Futuro";
  if (summary.state === "empty") return "Sem metas";
  if (summary.done === summary.total) return "Todas atingidas";
  if (summary.done) return "Cumprimento parcial";
  if (summary.missed) return "Há metas não atingidas";
  return date < today ? "Sem registro" : "Pendente";
}
export function hasDailyEvaluation(snapshot: Snapshot, date: string): boolean {
  return (
    snapshot.occurrences?.some(
      (item) =>
        item.periodKind === "day" &&
        item.periodStart === date &&
        (item.status !== "pending" ||
          snapshot.events?.some((event) => event.occurrenceId === item.id)),
    ) ?? false
  );
}
export function occurrenceFor(snapshot: Snapshot, goal: Goal, date: string) {
  return snapshot.occurrences?.find(
    (item) =>
      item.goalId === goal.id &&
      item.periodStart === periodFor(goal, date) &&
      item.eligibleFrom <=
        (goal.frequency === "weekly" && goal.startDate > date
          ? goal.startDate
          : date),
  );
}
