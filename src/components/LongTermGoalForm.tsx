import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import {
  categories,
  type LongTermGoal,
  type LongTermGoalFields,
} from "../../shared/types";
import { validateLongTermFields } from "../../shared/personalization";
import { Modal } from "./Modal";

export function LongTermGoalForm({
  goal,
  today,
  busy,
  onClose,
  onSave,
}: {
  goal: LongTermGoal | null;
  today: string;
  busy: boolean;
  onClose: () => void;
  onSave: (
    goal: LongTermGoal | null,
    fields: LongTermGoalFields,
    operationKey: string,
  ) => Promise<boolean>;
}) {
  const [operationKey] = useState(() => crypto.randomUUID());
  const [title, setTitle] = useState(goal?.title ?? "");
  const [description, setDescription] = useState(goal?.description ?? "");
  const [category, setCategory] = useState<LongTermGoalFields["category"]>(
    goal?.category ?? "Pessoal",
  );
  const [target, setTarget] = useState(String(goal?.target ?? 1));
  const [current, setCurrent] = useState(String(goal?.current ?? 0));
  const [unit, setUnit] = useState(goal?.unit ?? "etapas");
  const [dueOn, setDueOn] = useState(goal?.dueOn ?? "");
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    try {
      if (!target.trim() || !current.trim())
        throw new Error("Informe a quantidade desejada e o progresso atual.");
      const fields = validateLongTermFields({
        title,
        description,
        category,
        target: Number(target),
        current: Number(current),
        unit,
        dueOn: dueOn || null,
      });
      if (await onSave(goal, fields, operationKey)) onClose();
    } catch (issue) {
      setError(
        issue instanceof Error
          ? issue.message.replace(
              /^Error invoking remote method '[^']+': (Error: )?/,
              "",
            )
          : "Não foi possível salvar o objetivo. Suas escolhas continuam aqui.",
      );
    }
  }
  return (
    <Modal
      title={
        goal ? "Atualize seu próximo horizonte" : "Um objetivo para ir além"
      }
      subtitle="Acompanhe uma conquista maior, no seu próprio ritmo."
      onClose={onClose}
    >
      <form className="longterm-form" onSubmit={submit} noValidate>
        <fieldset disabled={busy}>
          <label>
            Nome do objetivo
            <input
              autoFocus
              maxLength={100}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex.: Ler 12 livros neste ano"
            />
          </label>
          <label>
            Por que este objetivo importa?
            <textarea
              aria-label="Por que este objetivo importa?"
              rows={2}
              maxLength={500}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Opcional. Uma razão para lembrar no caminho."
            />
          </label>
          <div className="journey-form-row">
            <label>
              Categoria do objetivo
              <select
                aria-label="Categoria do objetivo"
                value={category}
                onChange={(event) =>
                  setCategory(
                    event.target.value as LongTermGoalFields["category"],
                  )
                }
              >
                {categories.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              Unidade
              <input
                maxLength={30}
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
                placeholder="Livros, aulas, etapas…"
              />
            </label>
          </div>
          <div className="journey-form-row">
            <label>
              Quantidade desejada
              <input
                type="number"
                min={1}
                max={1e9}
                step="any"
                value={target}
                onChange={(event) => setTarget(event.target.value)}
              />
            </label>
            <label>
              Progresso atual
              <input
                type="number"
                min={0}
                max={1e9}
                step="any"
                value={current}
                onChange={(event) => setCurrent(event.target.value)}
              />
            </label>
          </div>
          <label>
            Prazo do objetivo <span className="optional">opcional</span>
            <input
              aria-label="Prazo do objetivo"
              type="date"
              min={goal ? undefined : today}
              value={dueOn}
              onChange={(event) => setDueOn(event.target.value)}
            />
          </label>
        </fieldset>
        <p className="journey-note">
          Você informa o progresso deste objetivo. Ele tem acompanhamento
          próprio: não cria metas na agenda, pontos ou obrigações diárias.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button type="submit" className="button primary" disabled={busy}>
            {busy ? "Salvando…" : goal ? "Salvar objetivo" : "Criar objetivo"}
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
