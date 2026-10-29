import {
  categories,
  type RoutineActivityInput,
  type RoutineRun,
  type RoutineRunInput,
  type Snapshot,
} from "./types";
import { routines, type Routine } from "./routines";
import { isValidDate, opportunities, shiftDate } from "./domain";
import { countResults } from "./analytics";

export const MAX_ROUTINE_DAYS = 31;
export function routineDates(startsOn: string, endsOn: string) {
  if (
    !isValidDate(startsOn) ||
    !isValidDate(endsOn) ||
    startsOn < "1900-01-01" ||
    endsOn < startsOn
  )
    throw new Error("Escolha um período válido para a experiência.");
  const dates: string[] = [];
  for (let date = startsOn; date <= endsOn; date = shiftDate(date, 1)) {
    dates.push(date);
    if (dates.length > MAX_ROUTINE_DAYS)
      throw new Error("Uma experiência pode durar até 31 dias.");
  }
  return dates;
}
export function validateActivity(
  value: RoutineActivityInput,
): RoutineActivityInput {
  if (
    !value ||
    typeof value !== "object" ||
    typeof value.activityId !== "string" ||
    !value.activityId.trim() ||
    value.activityId.length > 100
  )
    throw new Error("Atividade inválida.");
  if (
    typeof value.title !== "string" ||
    !value.title.trim() ||
    value.title.trim().length > 100
  )
    throw new Error("Cada atividade precisa de um nome de até 100 caracteres.");
  if (
    typeof value.description !== "string" ||
    value.description.length > 500 ||
    !categories.includes(value.category)
  )
    throw new Error("Confira a descrição e a categoria da atividade.");
  if (
    value.minutes !== null &&
    (!Number.isInteger(value.minutes) ||
      value.minutes < 1 ||
      value.minutes > 1440)
  )
    throw new Error(
      "A duração deve ser de 1 a 1440 minutos, ou ficar em branco.",
    );
  if (
    value.time !== null &&
    (typeof value.time !== "string" ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time))
  )
    throw new Error("Escolha um horário válido, ou deixe em branco.");
  if (typeof value.intensity !== "string" || value.intensity.length > 120)
    throw new Error("A anotação de ritmo deve ter até 120 caracteres.");
  return {
    activityId: value.activityId,
    title: value.title.trim(),
    description: value.description.trim(),
    category: value.category,
    time: value.time,
    minutes: value.minutes,
    intensity: value.intensity.trim(),
  };
}
export function normalizeRoutineInput(value: RoutineRunInput): RoutineRunInput {
  if (
    !value ||
    typeof value !== "object" ||
    typeof value.operationKey !== "string" ||
    !value.operationKey.trim() ||
    value.operationKey.length > 200 ||
    typeof value.templateId !== "string" ||
    !value.templateId ||
    value.templateId.length > 200 ||
    !Number.isInteger(value.templateVersion) ||
    value.templateVersion < 1 ||
    typeof value.allowRepeat !== "boolean"
  )
    throw new Error("Experiência inválida.");
  routineDates(value.startsOn, value.endsOn);
  if (
    !Array.isArray(value.activities) ||
    value.activities.length < 1 ||
    value.activities.length > 20
  )
    throw new Error("Selecione pelo menos uma atividade, até o limite de 20.");
  const activities = value.activities.map(validateActivity);
  if (
    new Set(activities.map((item) => item.activityId)).size !==
    activities.length
  )
    throw new Error("Há atividades repetidas na experiência.");
  return {
    operationKey: value.operationKey,
    templateId: value.templateId,
    templateVersion: value.templateVersion,
    startsOn: value.startsOn,
    endsOn: value.endsOn,
    activities,
    allowRepeat: value.allowRepeat,
  };
}
export function defaultRoutineInput(
  routine: Routine,
  today: string,
  operationKey: string,
): RoutineRunInput {
  return {
    operationKey,
    templateId: routine.id,
    templateVersion: routine.version,
    startsOn: today,
    endsOn: today,
    allowRepeat: false,
    activities: routine.goals.map((goal) => ({
      activityId: goal.id,
      title: goal.title,
      description: goal.description,
      category: goal.category,
      time: null,
      minutes: null,
      intensity: "",
    })),
  };
}
export function validateTemplate(input: RoutineRunInput): Routine {
  const template = routines.find(
    (item) =>
      item.id === input.templateId && item.version === input.templateVersion,
  );
  if (
    !template ||
    input.activities.some(
      (activity) =>
        !template.goals.some((goal) => goal.id === activity.activityId),
    )
  )
    throw new Error(
      "Modelo de rotina inválido ou desatualizado. Abra a rotina novamente.",
    );
  return template;
}
export function overlappingRuns(
  snapshot: Snapshot,
  templateId: string,
  startsOn: string,
  endsOn: string,
) {
  return (
    snapshot.routineRuns?.some(
      (run) =>
        run.templateId === templateId &&
        run.startsOn <= endsOn &&
        run.endsOn >= startsOn,
    ) ||
    snapshot.goals.some(
      (goal) =>
        !goal.routineRunId &&
        goal.routineId === templateId &&
        goal.startDate >= startsOn &&
        goal.startDate <= endsOn,
    )
  );
}
export function activitySchedule(activity: {
  time: string | null;
  minutes: number | null;
  intensity: string;
}) {
  return [
    activity.time,
    activity.minutes === null ? null : `${activity.minutes} min`,
    activity.intensity ? `Meu ritmo: ${activity.intensity}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
export function routineProgress(
  snapshot: Snapshot,
  run: RoutineRun,
  today: string,
) {
  const planned = run.activities.flatMap((activity) => activity.goals);
  const ids = new Set(planned.map((goal) => goal.id));
  const eligible = opportunities(
    snapshot,
    run.startsOn,
    run.endsOn < today ? run.endsOn : today,
  ).filter((item) => ids.has(item.goal.id));
  const goals = new Map(snapshot.goals.map((goal) => [goal.id, goal]));
  const remaining = planned.filter((plan) => {
    const goal = goals.get(plan.id);
    return goal && (!goal.archivedOn || goal.archivedOn > plan.date);
  });
  const rest = remaining.filter((plan) =>
    snapshot.dayPlans?.some((day) => day.date === plan.date),
  ).length;
  const future = remaining.filter(
    (plan) =>
      plan.date > today &&
      !snapshot.dayPlans?.some((day) => day.date === plan.date),
  ).length;
  return {
    ...countResults(eligible),
    rest,
    future,
    removed: planned.length - eligible.length - rest - future,
    planned: planned.length,
    partial: run.startsOn <= today && run.endsOn >= today,
    isFuture: run.startsOn > today,
  };
}
