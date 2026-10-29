import { dailySummary, dayLabel } from "./checklist";
import {
  dateKey,
  opportunities,
  parseDate,
  shiftDate,
  weekStart,
} from "./domain";
import { categories, type Snapshot, type Status } from "./types";

export function countResults(items: { status: Status }[]) {
  const done = items.filter((item) => item.status === "done").length;
  const missed = items.filter((item) => item.status === "missed").length;
  return {
    total: items.length,
    done,
    missed,
    pending: items.length - done - missed,
    percent: items.length ? Math.round((100 * done) / items.length) : null,
  };
}
export type Counts = ReturnType<typeof countResults>;

// Weekly opportunities intersecting a range count once. Daily opportunities use
// their frozen occurrence fields; future plans never contribute to performance.
export function rangeSummary(
  snapshot: Snapshot,
  from: string,
  through: string,
  today: string,
) {
  const end = through < today ? through : today;
  const items =
    from > end
      ? []
      : opportunities(snapshot, from, end).filter(
          (item) =>
            item.goal.frequency === "weekly" ||
            !snapshot.dayPlans?.some((plan) => plan.date === item.date),
        );
  const daily = items.filter((item) => item.goal.frequency !== "weekly");
  const weekly = items.filter((item) => item.goal.frequency === "weekly");
  return {
    from,
    through,
    partial: from <= today && through >= today,
    daily: countResults(daily),
    weekly: countResults(weekly),
    categories: categories.map((category) => ({
      category,
      ...countResults(daily.filter((item) => item.goal.category === category)),
    })),
  };
}

export function dailySeries(
  snapshot: Snapshot,
  from: string,
  through: string,
  today: string,
) {
  const result = [];
  for (let date = from; date <= through; date = shiftDate(date, 1)) {
    const summary = dailySummary(snapshot, date, today);
    result.push({
      date,
      done: summary.done,
      total: summary.total,
      percent: summary.percent,
      label: dayLabel(snapshot, date, today),
    });
  }
  return result;
}

export function monthStart(date: string) {
  return `${date.slice(0, 7)}-01`;
}
export function shiftMonth(date: string, months: number) {
  const value = parseDate(monthStart(date));
  value.setMonth(value.getMonth() + months);
  return dateKey(value);
}
export function monthlyEvolution(
  snapshot: Snapshot,
  today: string,
  months = 6,
) {
  return Array.from({ length: months }, (_, index) => {
    const from = shiftMonth(today, index - months + 1);
    const through = shiftDate(shiftMonth(from, 1), -1);
    const summary = rangeSummary(snapshot, from, through, today);
    return { date: from, through, partial: summary.partial, ...summary.daily };
  });
}

export function weeklyComparison(snapshot: Snapshot, today: string) {
  const currentStart = weekStart(today);
  const previousStart = shiftDate(currentStart, -7);
  const olderStart = shiftDate(currentStart, -14);
  const previous = rangeSummary(
    snapshot,
    previousStart,
    shiftDate(currentStart, -1),
    today,
  );
  const older = rangeSummary(
    snapshot,
    olderStart,
    shiftDate(previousStart, -1),
    today,
  );
  // Compute percentage-point change from raw ratios, rounding only once.
  const delta = (a: Counts, b: Counts) =>
    a.total && b.total
      ? Math.round(100 * (a.done / a.total - b.done / b.total))
      : null;
  return {
    current: rangeSummary(
      snapshot,
      currentStart,
      shiftDate(currentStart, 6),
      today,
    ),
    previous,
    older,
    dailyDelta: delta(previous.daily, older.daily),
    weeklyDelta: delta(previous.weekly, older.weekly),
  };
}

export const consistencyLabels = {
  complete: "Todas atingidas",
  partial: "Cumprimento parcial",
  missed: "Não atingidas",
  unrecorded: "Sem registro",
  pending: "Em aberto",
  empty: "Sem metas",
  rest: "Descanso",
  future: "Futuro",
} as const;
export type ConsistencyState = keyof typeof consistencyLabels;
export function consistencyDay(
  snapshot: Snapshot,
  date: string,
  today: string,
) {
  const summary = dailySummary(snapshot, date, today);
  const state: ConsistencyState =
    date > today
      ? "future"
      : summary.state === "rest"
        ? "rest"
        : summary.state === "empty"
          ? "empty"
          : summary.done === summary.total
            ? "complete"
            : summary.done
              ? "partial"
              : summary.missed
                ? "missed"
                : date < today
                  ? "unrecorded"
                  : "pending";
  return { ...summary, date, state, label: dayLabel(snapshot, date, today) };
}
export function consistencyMonth(
  snapshot: Snapshot,
  month: string,
  today: string,
) {
  const from = monthStart(month);
  const through = shiftDate(shiftMonth(from, 1), -1);
  const days = [];
  for (let date = from; date <= through; date = shiftDate(date, 1))
    days.push(consistencyDay(snapshot, date, today));
  return { offset: (parseDate(from).getDay() + 6) % 7, days };
}
