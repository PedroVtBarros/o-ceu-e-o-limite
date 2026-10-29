import { dailySummary } from "./checklist";
import { opportunities } from "./domain";
import type { Snapshot } from "./types";

export const levels = [
  { level: 1, name: "Primeiro passo", points: 0 },
  { level: 2, name: "Criando raízes", points: 100 },
  { level: 3, name: "Em movimento", points: 300 },
  { level: 4, name: "Novos horizontes", points: 700 },
  { level: 5, name: "Cada vez mais longe", points: 1500 },
] as const;

// Always derived from current outcomes. Events, repeated clicks, rest and future
// plans cannot add rewards; a historical correction simply recomputes the result.
export function journeySummary(snapshot: Snapshot, today: string) {
  const first = snapshot.goals.map((goal) => goal.startDate).sort()[0] ?? today;
  const items =
    first > today
      ? []
      : opportunities(snapshot, first, today).filter(
          (item) =>
            item.goal.frequency === "weekly" ||
            !snapshot.dayPlans?.some((plan) => plan.date === item.date),
        );
  const done = items.filter((item) => item.status === "done");
  const daily = new Map<string, boolean>();
  for (const item of items.filter((item) => item.goal.frequency !== "weekly"))
    daily.set(
      item.date,
      daily.get(item.date) === true || item.status === "done",
    );
  let sequence = 0,
    bestStreak = 0;
  for (const [date, complete] of [...daily].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (complete) {
      sequence++;
      bestStreak = Math.max(bestStreak, sequence);
    } else if (date < today) sequence = 0;
  }
  const points = done.length * 10;
  const currentLevel = [...levels]
    .reverse()
    .find((level) => points >= level.points)!;
  const nextLevel = levels.find((level) => level.points > points) ?? null;
  const levelPercent = nextLevel
    ? Math.round(
        (100 * (points - currentLevel.points)) /
          (nextLevel.points - currentLevel.points),
      )
    : 100;
  const weeklyDone = done.filter(
    (item) => item.goal.frequency === "weekly",
  ).length;
  const routineDone = done.filter((item) =>
    Boolean(item.goal.routineId),
  ).length;
  const achievements = [
    {
      id: "first",
      title: "Um passo de verdade",
      description:
        "Atinja seu primeiro compromisso diário, semanal ou de rotina.",
      value: done.length,
      target: 1,
      unit: "conclusões",
      icon: "sprout",
    },
    {
      id: "ten",
      title: "Pequenas ações somam",
      description:
        "Some dez compromissos atingidos. Cada semanal conta uma vez por semana.",
      value: done.length,
      target: 10,
      unit: "conclusões",
      icon: "target",
    },
    {
      id: "three",
      title: "Encontrando seu ritmo",
      description:
        "Alcance uma sequência de três dias com ao menos uma meta diária ou de rotina atingida. Folgas e descanso são ignorados.",
      value: bestStreak,
      target: 3,
      unit: "dias na melhor sequência",
      icon: "flame",
    },
    {
      id: "seven",
      title: "Constância que cresce",
      description:
        "Alcance sete dias na melhor sequência, com as mesmas regras de folgas e descanso.",
      value: bestStreak,
      target: 7,
      unit: "dias na melhor sequência",
      icon: "mountain",
    },
    {
      id: "weekly",
      title: "Um compromisso com a semana",
      description:
        "Atinja uma meta semanal. Ela conta uma vez, independentemente do dia usado para registrar.",
      value: weeklyDone,
      target: 1,
      unit: "semanais atingidas",
      icon: "calendar",
    },
    {
      id: "routine",
      title: "Inspiração em ação",
      description:
        "Atinja uma atividade copiada de uma rotina inspirada, inclusive do seu histórico anterior.",
      value: routineDone,
      target: 1,
      unit: "atividades de rotina atingidas",
      icon: "sparkles",
    },
  ].map((item) => ({
    ...item,
    achieved: item.value >= item.target,
    percent: Math.min(100, Math.round((100 * item.value) / item.target)),
  }));
  return {
    points,
    completed: done.length,
    currentLevel,
    nextLevel,
    levelPercent,
    bestStreak,
    achievements,
  };
}

export function encouragement(snapshot: Snapshot, today: string) {
  const day = dailySummary(snapshot, today, today);
  if (day.state === "rest")
    return "Descansar também faz parte do caminho. Retome no seu ritmo.";
  if (!day.total)
    return "Escolha um passo possível para começar. O seu caminho pode crescer aos poucos.";
  if (day.done === day.total)
    return "Você cumpriu o que planejou para hoje. Reserve um momento para reconhecer seu esforço.";
  if (day.done)
    return "Cada ação que você concluiu já faz parte da sua história. Siga no seu ritmo.";
  return "Seu dia ainda pode ter um pequeno avanço. Escolha uma ação que caiba no momento de agora.";
}
