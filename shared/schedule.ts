import { isValidDate, parseDate, shiftDate, weekStart } from "./domain";
import type { Frequency } from "./types";

export const weekdays = [
  { label: "Seg", name: "Segunda-feira", bit: 1 },
  { label: "Ter", name: "Terça-feira", bit: 2 },
  { label: "Qua", name: "Quarta-feira", bit: 4 },
  { label: "Qui", name: "Quinta-feira", bit: 8 },
  { label: "Sex", name: "Sexta-feira", bit: 16 },
  { label: "Sáb", name: "Sábado", bit: 32 },
  { label: "Dom", name: "Domingo", bit: 64 },
] as const;

export function weekdayBit(date: string): number {
  return 1 << ((parseDate(date).getDay() + 6) % 7);
}
export function scheduleLabel(frequency: Frequency, mask = 127): string {
  if (frequency === "weekly") return "Um compromisso de segunda a domingo";
  if (frequency === "once") return "Atividade para um único dia";
  return mask === 127
    ? "Todos os dias"
    : weekdays
        .filter((day) => (mask & day.bit) !== 0)
        .map((day) => day.label)
        .join(" · ");
}
export function earliestRevision(
  today: string,
  current: Frequency,
  next: Frequency,
  hasOccurrences = true,
): string {
  if (!hasOccurrences) return today;
  return current === "weekly" || next === "weekly"
    ? shiftDate(weekStart(today), 7)
    : shiftDate(today, 1);
}
export function revisionDateError(
  date: string,
  today: string,
  current: Frequency,
  next: Frequency,
  hasOccurrences = true,
): string | null {
  if (
    !isValidDate(date) ||
    date < earliestRevision(today, current, next, hasOccurrences)
  )
    return "Escolha uma vigência a partir da data mínima indicada.";
  if (
    hasOccurrences &&
    (current === "weekly" || next === "weekly") &&
    weekStart(date) !== date
  )
    return "Escolha uma segunda-feira para preservar os períodos semanais.";
  return null;
}
