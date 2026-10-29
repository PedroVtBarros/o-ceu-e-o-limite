import { isValidDate } from "./domain";
import {
  categories,
  themes,
  type Preferences,
  type LongTermGoalFields,
  type LongTermGoalInput,
} from "./types";

export const defaultPreferences: Preferences = {
  theme: "violet",
  showEncouragement: true,
};
export const themeOptions = [
  {
    id: "violet",
    name: "Violeta",
    background: "#0D1424",
    surface: "#1D2940",
    primary: "#6551D9",
    light: "#C4B8FF",
  },
  {
    id: "ocean",
    name: "Oceano",
    background: "#0C1929",
    surface: "#193047",
    primary: "#245DB9",
    light: "#9ECFFF",
  },
  {
    id: "forest",
    name: "Floresta",
    background: "#0D1D1B",
    surface: "#1B3430",
    primary: "#136B57",
    light: "#99EAC9",
  },
] as const;

export function longTermPercent(
  goal: Pick<LongTermGoalFields, "current" | "target">,
) {
  return goal.current >= goal.target
    ? 100
    : Math.min(99, Math.round((100 * goal.current) / goal.target));
}

export function validatePreferences(value: Preferences): Preferences {
  if (
    !value ||
    !themes.includes(value.theme) ||
    typeof value.showEncouragement !== "boolean"
  )
    throw new Error(
      "Preferências inválidas. Escolha um tema e a opção de incentivo.",
    );
  return { theme: value.theme, showEncouragement: value.showEncouragement };
}
export function validateLongTermFields(
  value: LongTermGoalFields,
): LongTermGoalFields {
  if (
    !value ||
    typeof value.title !== "string" ||
    !value.title.trim() ||
    value.title.trim().length > 100
  )
    throw new Error("O objetivo precisa de um nome de até 100 caracteres.");
  if (
    typeof value.description !== "string" ||
    value.description.length > 500 ||
    !categories.includes(value.category)
  )
    throw new Error("Confira a descrição e a categoria do objetivo.");
  if (
    typeof value.target !== "number" ||
    !Number.isFinite(value.target) ||
    value.target < 1 ||
    value.target > 1e9
  )
    throw new Error("A quantidade desejada deve estar entre 1 e 1 bilhão.");
  if (
    typeof value.current !== "number" ||
    !Number.isFinite(value.current) ||
    value.current < 0 ||
    value.current > value.target
  )
    throw new Error(
      "O progresso deve ficar entre zero e a quantidade desejada.",
    );
  if (
    typeof value.unit !== "string" ||
    !value.unit.trim() ||
    value.unit.trim().length > 30
  )
    throw new Error(
      "Informe uma unidade de até 30 caracteres, como livros ou etapas.",
    );
  if (
    value.dueOn !== null &&
    (!isValidDate(value.dueOn) || value.dueOn < "1900-01-01")
  )
    throw new Error("Informe um prazo válido, ou deixe em branco.");
  return {
    title: value.title.trim(),
    description: value.description.trim(),
    category: value.category,
    target: value.target,
    current: value.current,
    unit: value.unit.trim(),
    dueOn: value.dueOn,
  };
}
export function normalizeLongTermInput(
  value: LongTermGoalInput,
): LongTermGoalInput {
  const fields = validateLongTermFields(value);
  if (
    typeof value.operationKey !== "string" ||
    !value.operationKey.trim() ||
    value.operationKey.length > 200
  )
    throw new Error("Identificador do objetivo inválido.");
  return { ...fields, operationKey: value.operationKey };
}
