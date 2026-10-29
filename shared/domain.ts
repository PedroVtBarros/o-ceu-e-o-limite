import type { Entry, Goal, Snapshot, Status } from "./types";

export function dateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function parseDate(date: string): Date {
  return new Date(`${date}T12:00:00`);
}
export function shiftDate(date: string, days: number): string {
  const value = parseDate(date);
  value.setDate(value.getDate() + days);
  return dateKey(value);
}
export function weekStart(date: string): string {
  return shiftDate(date, -((parseDate(date).getDay() + 6) % 7));
}
export function isValidDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(parseDate(value).getTime()) &&
    dateKey(parseDate(value)) === value
  );
}
export function scheduled(goal: Goal, date: string): boolean {
  return (
    goal.startDate <= date &&
    (!goal.archivedOn || goal.archivedOn > date) &&
    (goal.frequency !== "daily" ||
      ((goal.weekdayMask ?? 127) &
        (1 << ((parseDate(date).getDay() + 6) % 7))) !==
        0) &&
    (goal.frequency !== "once" || goal.startDate === date)
  );
}
export function periodFor(goal: Goal, date: string): string {
  return goal.frequency === "weekly" ? weekStart(date) : date;
}
export function statusFor(goal: Goal, date: string, entries: Entry[]): Status {
  return (
    entries.find(
      (entry) =>
        entry.goalId === goal.id && entry.period === periodFor(goal, date),
    )?.status ?? "pending"
  );
}
// Desktop history is read from frozen occurrences, never the latest goal definition.
// The fallback keeps browser-preview data from the original prototype readable.
export function goalsOn(
  snapshot: Snapshot,
  date: string,
  today = dateKey(),
): Goal[] {
  const isRest = snapshot.dayPlans?.some((plan) => plan.date === date) ?? false;
  const order = new Map(snapshot.goals.map((goal, index) => [goal.id, index]));
  const ordered = (goals: Goal[]) =>
    goals.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  if (!snapshot.occurrences)
    return snapshot.goals.filter(
      (goal) =>
        scheduled(goal, date) && (!isRest || goal.frequency === "weekly"),
    );
  const stored = snapshot.occurrences
    .filter(
      (item) =>
        item.disposition === "scheduled" &&
        (!isRest || item.frequency === "weekly") &&
        item.eligibleFrom <= date &&
        item.periodEndExclusive > date,
    )
    .map((item) => ({
      id: item.goalId,
      title: item.title,
      description: item.description,
      category: item.category,
      frequency: item.frequency,
      startDate: item.eligibleFrom,
      archivedOn: null,
      routineId: item.routineId,
      ...(item.routineRunId
        ? {
            routineRunId: item.routineRunId,
            routineActivity: item.routineActivity,
          }
        : {}),
    }));
  if (date <= today || !snapshot.revisions) return ordered(stored);
  const projected = snapshot.goals.flatMap((goal) => {
    if (stored.some((item) => item.id === goal.id)) return [];
    const revision = snapshot.revisions!.find(
      (item) =>
        item.goalId === goal.id &&
        item.effectiveFrom <= date &&
        (!item.effectiveTo || item.effectiveTo > date),
    );
    if (!revision) return [];
    const view: Goal = {
      ...goal,
      title: revision.title,
      description: revision.description,
      category: revision.category,
      frequency: revision.frequency,
      weekdayMask: revision.weekdayMask,
      startDate: revision.effectiveFrom,
    };
    return scheduled(view, date) && (!isRest || view.frequency === "weekly")
      ? [view]
      : [];
  });
  return ordered([...stored, ...projected]);
}
export function summarize(goals: Goal[], date: string, entries: Entry[]) {
  const done = goals.filter(
    (goal) => statusFor(goal, date, entries) === "done",
  ).length;
  const missed = goals.filter(
    (goal) => statusFor(goal, date, entries) === "missed",
  ).length;
  return {
    total: goals.length,
    done,
    missed,
    pending: goals.length - done - missed,
    percent: goals.length ? Math.round((done / goals.length) * 100) : 0,
  };
}
// Each weekly goal contributes exactly one opportunity per ISO week.
export function opportunities(
  snapshot: Snapshot,
  from: string,
  through: string,
) {
  if (snapshot.occurrences) {
    return snapshot.occurrences
      .filter(
        (item) =>
          item.disposition === "scheduled" &&
          item.eligibleFrom <= through &&
          item.periodEndExclusive > from,
      )
      .map((item) => ({
        goal: {
          id: item.goalId,
          title: item.title,
          description: item.description,
          category: item.category,
          frequency: item.frequency,
          startDate: item.eligibleFrom,
          archivedOn: null,
          routineId: item.routineId,
          ...(item.routineRunId
            ? {
                routineRunId: item.routineRunId,
                routineActivity: item.routineActivity,
              }
            : {}),
        } as Goal,
        period: item.periodStart,
        status: item.status,
        date: item.eligibleFrom < from ? from : item.eligibleFrom,
      }));
  }
  const result: { goal: Goal; period: string; status: Status; date: string }[] =
    [];
  const seen = new Set<string>();
  for (let date = from; date <= through; date = shiftDate(date, 1)) {
    for (const goal of snapshot.goals.filter((goal) => scheduled(goal, date))) {
      const period = periodFor(goal, date);
      const key = `${goal.id}:${period}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push({
          goal,
          period,
          date,
          status: statusFor(goal, date, snapshot.entries),
        });
      }
    }
  }
  return result;
}
export function streak(snapshot: Snapshot, today: string): number {
  let count = 0;
  const first = snapshot.goals.map((goal) => goal.startDate).sort()[0];
  if (!first) return 0;
  for (let day = today; day >= first; day = shiftDate(day, -1)) {
    const goals = goalsOn(snapshot, day, today).filter(
      (goal) => goal.frequency !== "weekly",
    );
    if (!goals.length) continue;
    if (goals.some((goal) => statusFor(goal, day, snapshot.entries) === "done"))
      count++;
    else if (day < today) break;
  }
  return count;
}
