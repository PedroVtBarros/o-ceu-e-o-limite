import { BookOpen, Heart, Sprout, Target, type LucideIcon } from "lucide-react";
import { parseDate } from "../shared/domain";
import type { Category, Frequency } from "../shared/types";
export const categoryIcons: Record<Category, LucideIcon> = {
  Pessoal: Sprout,
  Saúde: Heart,
  Estudos: BookOpen,
  Trabalho: Target,
};
export const categoryClasses: Record<Category, string> = {
  Pessoal: "mint",
  Saúde: "peach",
  Estudos: "lavender",
  Trabalho: "butter",
};
export const frequencyNames: Record<Frequency, string> = {
  daily: "Diária",
  weekly: "Semanal",
  once: "Só neste dia",
};
export const formatDay = (date: string, options: Intl.DateTimeFormatOptions) =>
  parseDate(date).toLocaleDateString("pt-BR", options);
