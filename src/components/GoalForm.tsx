import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import {
  categories,
  type Category,
  type Frequency,
  type Goal,
  type GoalInput,
} from "../../shared/types";
import { isValidDate, weekStart } from "../../shared/domain";
import {
  earliestRevision,
  revisionDateError,
  weekdays,
} from "../../shared/schedule";
import { categoryIcons, formatDay } from "../goalPresentation";
import { Modal } from "./Modal";

export function GoalForm({
  goal,
  today,
  hasOccurrences,
  busy,
  onSave,
  onClose,
}: {
  goal: Goal | null;
  today: string;
  hasOccurrences: boolean;
  busy: boolean;
  onSave: (input: GoalInput & { effectiveFrom?: string }) => Promise<void>;
  onClose: () => void;
}) {
  const draft = goal?.nextRevision ?? goal;
  const [title, setTitle] = useState(draft?.title ?? "");
  const [description, setDescription] = useState(draft?.description ?? "");
  const [category, setCategory] = useState<Category>(
    draft?.category ?? "Pessoal",
  );
  const [frequency, setFrequency] = useState<Frequency>(
    draft?.frequency ?? "daily",
  );
  const [mask, setMask] = useState(
    draft?.frequency === "daily" ? (draft.weekdayMask ?? 127) : 127,
  );
  const initial = goal
    ? (goal.nextRevision?.effectiveFrom ??
      (hasOccurrences
        ? earliestRevision(today, goal.frequency, draft!.frequency)
        : goal.startDate < today
          ? today
          : goal.startDate))
    : today;
  const [effective, setEffective] = useState(initial);
  const [saveError, setSaveError] = useState("");
  const minimum = goal
    ? earliestRevision(today, goal.frequency, frequency, hasOccurrences)
    : today;
  const dateError = goal
    ? revisionDateError(
        effective,
        today,
        goal.frequency,
        frequency,
        hasOccurrences,
      )
    : !isValidDate(effective) || effective < today
      ? "Escolha hoje ou uma data futura para começar."
      : null;
  const daysError =
    frequency === "daily" && mask === 0
      ? "Selecione pelo menos um dia para a sua meta."
      : null;
  function chooseFrequency(value: "daily" | "weekly") {
    setFrequency(value);
    setSaveError("");
    const nextMin = goal
      ? earliestRevision(today, goal.frequency, value, hasOccurrences)
      : today;
    if (
      effective < nextMin ||
      (goal &&
        hasOccurrences &&
        (goal.frequency === "weekly" || value === "weekly") &&
        weekStart(effective) !== effective)
    )
      setEffective(nextMin);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaveError("");
    if (dateError || daysError || !title.trim()) return;
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        category,
        frequency,
        weekdayMask: frequency === "daily" ? mask : 0,
        startDate: goal?.startDate ?? effective,
        ...(goal ? { effectiveFrom: effective } : {}),
      });
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message.replace(
              /^Error invoking remote method '[^']+': (Error: )?/,
              "",
            )
          : "Não foi possível salvar sua meta.",
      );
    }
  }
  return (
    <Modal
      title={
        goal ? "Um ajuste no seu caminho" : "Toda conquista começa com uma meta"
      }
      subtitle={
        goal
          ? "Escolha o que muda e quando a nova versão começa."
          : "Dê um nome, escolha os dias e defina o primeiro passo."
      }
      onClose={onClose}
    >
      <form onSubmit={submit} className="goal-form">
        <fieldset disabled={busy} className="goal-fields">
          <label>
            O que você quer conquistar?
            <input
              autoFocus
              placeholder="Ex.: Ler 10 páginas de um livro"
              maxLength={100}
              required
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setSaveError("");
              }}
            />
          </label>
          <label>
            Um pouco mais sobre sua meta{" "}
            <span className="optional">opcional</span>
            <textarea
              placeholder="Como você vai saber que conseguiu?"
              maxLength={500}
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <div className="field-label" id="category-label">
            Categoria
          </div>
          <div
            className="category-options"
            role="group"
            aria-labelledby="category-label"
          >
            {categories.map((item) => {
              const Icon = categoryIcons[item];
              return (
                <button
                  type="button"
                  key={item}
                  aria-pressed={category === item}
                  className={category === item ? "selected" : ""}
                  onClick={() => setCategory(item)}
                >
                  <Icon size={17} />
                  {item}
                </button>
              );
            })}
          </div>
          <div className="field-label" id="frequency-label">
            Com que frequência?
          </div>
          <div
            className="frequency-options"
            role="group"
            aria-labelledby="frequency-label"
          >
            <button
              type="button"
              aria-pressed={frequency === "daily"}
              className={frequency === "daily" ? "selected" : ""}
              onClick={() => chooseFrequency("daily")}
            >
              <span>Diária</span>
              <small>Escolha os dias da semana</small>
            </button>
            <button
              type="button"
              aria-pressed={frequency === "weekly"}
              className={frequency === "weekly" ? "selected" : ""}
              onClick={() => chooseFrequency("weekly")}
            >
              <span>Toda semana</span>
              <small>Um compromisso por semana</small>
            </button>
          </div>
          {frequency === "daily" && (
            <>
              <div className="days-heading">
                <span id="days-label" className="field-label">
                  Dias programados
                </span>
                <div>
                  <button type="button" onClick={() => setMask(127)}>
                    Todos os dias
                  </button>
                  <button type="button" onClick={() => setMask(31)}>
                    Dias úteis
                  </button>
                  <button type="button" onClick={() => setMask(0)}>
                    Limpar dias
                  </button>
                </div>
              </div>
              <div
                className="weekday-options"
                role="group"
                aria-labelledby="days-label"
              >
                {weekdays.map((day) => (
                  <button
                    type="button"
                    key={day.bit}
                    aria-label={day.name}
                    aria-pressed={(mask & day.bit) !== 0}
                    className={(mask & day.bit) !== 0 ? "selected" : ""}
                    onClick={() => {
                      setMask((current) => current ^ day.bit);
                      setSaveError("");
                    }}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </>
          )}
          <label>
            {goal ? "Vigência da alteração" : "Começa em"}
            <input
              type="date"
              min={minimum}
              value={effective}
              required
              onChange={(event) => {
                setEffective(event.target.value);
                setSaveError("");
              }}
              aria-describedby="date-explanation"
            />
          </label>
          <p id="date-explanation" className="form-note">
            {goal && hasOccurrences
              ? `A partir de ${formatDay(effective || minimum, { day: "numeric", month: "long", year: "numeric" })}, a nova versão passa a valer. As ocorrências anteriores mantêm sua programação e seus resultados.`
              : "O início pode ser hoje ou uma data futura. Dias anteriores não recebem obrigações."}
            {frequency === "weekly" &&
              " O resultado semanal é único, de segunda a domingo."}
          </p>
          {(dateError || daysError || saveError) && (
            <p className="form-error" role="alert">
              {saveError || dateError || daysError}
            </p>
          )}
        </fieldset>
        <div className="modal-actions">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="button primary"
            disabled={busy || !title.trim() || !!dateError || !!daysError}
          >
            {busy
              ? "Salvando…"
              : goal
                ? "Salvar alterações"
                : "Criar minha meta"}
            <ArrowRight size={17} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
