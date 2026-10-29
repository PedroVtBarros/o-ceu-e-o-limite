import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CheckCheck,
  Sparkles,
} from "lucide-react";
import {
  categories,
  type RoutineActivityInput,
  type RoutineRunInput,
  type Snapshot,
} from "../../shared/types";
import type { Routine } from "../../shared/routines";
import {
  defaultRoutineInput,
  normalizeRoutineInput,
  overlappingRuns,
  routineDates,
} from "../../shared/routineRuns";
import { shiftDate } from "../../shared/domain";
import { formatDay } from "../goalPresentation";
import { Modal } from "./Modal";

export function RoutinePreview({
  routine,
  snapshot,
  today,
  busy,
  onSave,
  onClose,
  onSource,
}: {
  routine: Routine;
  snapshot: Snapshot;
  today: string;
  busy: boolean;
  onSave: (input: RoutineRunInput) => Promise<void>;
  onClose: () => void;
  onSource: (url: string) => void;
}) {
  const [draft, setDraft] = useState(() =>
    defaultRoutineInput(routine, today, crypto.randomUUID()),
  );
  const [selected, setSelected] = useState(
    () => new Set(draft.activities.map((item) => item.activityId)),
  );
  const [interval, setInterval] = useState(false);
  const [error, setError] = useState("");
  const update = (index: number, change: Partial<RoutineActivityInput>) =>
    setDraft((value) => ({
      ...value,
      activities: value.activities.map((item, i) =>
        i === index ? { ...item, ...change } : item,
      ),
    }));
  let days: string[] = [];
  try {
    days = routineDates(draft.startsOn, draft.endsOn);
  } catch {
    /* Submit explains invalid dates. */
  }
  const overlap = overlappingRuns(
    snapshot,
    routine.id,
    draft.startsOn,
    draft.endsOn,
  );
  const rests = days.filter((date) =>
    snapshot.dayPlans?.some((plan) => plan.date === date),
  ).length;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    try {
      await onSave(
        normalizeRoutineInput({
          ...draft,
          activities: draft.activities.filter((item) =>
            selected.has(item.activityId),
          ),
        }),
      );
    } catch (issue) {
      setError(
        issue instanceof Error
          ? issue.message.replace(
              /^Error invoking remote method '[^']+': (Error: )?/,
              "",
            )
          : "Não foi possível salvar sua experiência. Suas escolhas continuam aqui.",
      );
    }
  }
  return (
    <Modal
      title={`Inspire-se em ${routine.name}`}
      subtitle="Escolha o que combina com você. A experiência será sua."
      wide
      onClose={onClose}
    >
      <div className={`routine-modal-banner ${routine.theme}`}>
        <Sparkles size={24} />
        <p>{routine.principle}</p>
      </div>
      <div className="routine-provenance">
        <strong>O que a fonte relata</strong>
        <p>{routine.sourceSummary}</p>
        <button
          className="source-link"
          type="button"
          onClick={() => onSource(routine.sourceUrl)}
        >
          <BookOpen size={15} />
          {routine.sourceLabel}
          <ArrowUpRight size={14} />
        </button>
        <span>
          Modelo v{routine.version} · fonte consultada em{" "}
          {formatDay(routine.sourceCheckedOn, {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })}
        </span>
      </div>
      <form className="routine-preview-form" onSubmit={submit} noValidate>
        <fieldset disabled={busy}>
          <div className="routine-custom-heading">
            <div>
              <h3>Faça do seu jeito</h3>
              <p>
                Atividades, horários e durações são adaptações pessoais. Os
                campos opcionais podem ficar em branco.
              </p>
            </div>
            <div className="routine-selection-tools">
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  setSelected(
                    new Set(draft.activities.map((item) => item.activityId)),
                  )
                }
              >
                Selecionar todas
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => setSelected(new Set())}
              >
                Limpar seleção
              </button>
            </div>
          </div>
          <div className="routine-activity-list">
            {draft.activities.map((activity, index) => (
              <div
                className={`routine-activity-editor ${selected.has(activity.activityId) ? "included" : ""}`}
                key={activity.activityId}
              >
                <label className="activity-include">
                  <input
                    type="checkbox"
                    checked={selected.has(activity.activityId)}
                    onChange={(event) =>
                      setSelected((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(activity.activityId);
                        else next.delete(activity.activityId);
                        return next;
                      })
                    }
                  />
                  Incluir {routine.goals[index].title}
                </label>
                <details>
                  <summary>
                    Personalizar atividade {index + 1}
                    <span>
                      {activity.title} · {activity.category}
                    </span>
                  </summary>
                  <div className="routine-activity-fields">
                    <label>
                      Nome da atividade {index + 1}
                      <input
                        maxLength={100}
                        value={activity.title}
                        onChange={(event) =>
                          update(index, { title: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      Descrição da atividade {index + 1}
                      <textarea
                        aria-label={`Descrição da atividade ${index + 1}`}
                        rows={2}
                        maxLength={500}
                        value={activity.description}
                        onChange={(event) =>
                          update(index, { description: event.target.value })
                        }
                      />
                    </label>
                    <div className="routine-field-row">
                      <label>
                        Categoria da atividade {index + 1}
                        <select
                          aria-label={`Categoria da atividade ${index + 1}`}
                          value={activity.category}
                          onChange={(event) =>
                            update(index, {
                              category: event.target
                                .value as RoutineActivityInput["category"],
                            })
                          }
                        >
                          {categories.map((category) => (
                            <option key={category}>{category}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Duração em minutos da atividade {index + 1}
                        <input
                          type="number"
                          min={1}
                          max={1440}
                          step={1}
                          placeholder="Opcional"
                          value={activity.minutes ?? ""}
                          onChange={(event) =>
                            update(index, {
                              minutes:
                                event.target.value === ""
                                  ? null
                                  : Number(event.target.value),
                            })
                          }
                        />
                      </label>
                      <label>
                        Horário da atividade {index + 1}
                        <input
                          type="time"
                          value={activity.time ?? ""}
                          onChange={(event) =>
                            update(index, { time: event.target.value || null })
                          }
                        />
                      </label>
                    </div>
                    <label>
                      Meu ritmo na atividade {index + 1}
                      <input
                        maxLength={120}
                        placeholder="Opcional. Ex.: com calma, no meu ritmo"
                        value={activity.intensity}
                        onChange={(event) =>
                          update(index, { intensity: event.target.value })
                        }
                      />
                    </label>
                  </div>
                </details>
              </div>
            ))}
          </div>
          <div className="routine-period">
            <h3>Quando experimentar?</h3>
            <div
              className="range-picker"
              role="group"
              aria-label="Duração da experiência"
            >
              <button
                type="button"
                aria-pressed={!interval}
                className={!interval ? "selected" : ""}
                onClick={() => {
                  setInterval(false);
                  setDraft({
                    ...draft,
                    endsOn: draft.startsOn,
                    allowRepeat: false,
                  });
                }}
              >
                Só um dia
              </button>
              <button
                type="button"
                aria-pressed={interval}
                className={interval ? "selected" : ""}
                onClick={() => setInterval(true)}
              >
                Escolher um intervalo
              </button>
            </div>
            <div className="routine-field-row">
              <label>
                Primeiro dia
                <input
                  type="date"
                  min={today}
                  value={draft.startsOn}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      startsOn: event.target.value,
                      endsOn:
                        !interval || event.target.value > draft.endsOn
                          ? event.target.value
                          : draft.endsOn,
                      allowRepeat: false,
                    })
                  }
                />
              </label>
              {interval && (
                <label>
                  Último dia
                  <input
                    type="date"
                    min={draft.startsOn}
                    max={
                      days.length ? shiftDate(draft.startsOn, 30) : undefined
                    }
                    value={draft.endsOn}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        endsOn: event.target.value,
                        allowRepeat: false,
                      })
                    }
                  />
                </label>
              )}
            </div>
            <p className="form-note">
              O padrão é só hoje. Um intervalo repete suas atividades escolhidas
              a cada dia, por até 31 dias. Dias futuros ficam fora do
              cumprimento até chegarem.
            </p>
          </div>
          {overlap && (
            <label className="routine-repeat">
              <input
                type="checkbox"
                checked={draft.allowRepeat}
                onChange={(event) =>
                  setDraft({ ...draft, allowRepeat: event.target.checked })
                }
              />
              <span>
                Quero criar outra experiência neste período
                <small>
                  Você já tem esta rotina em datas que se cruzam. A nova cópia
                  terá metas e resultados próprios.
                </small>
              </span>
            </label>
          )}
          <div className="routine-save-summary" aria-live="polite">
            <CheckCheck size={21} />
            <div>
              <strong>
                {selected.size}{" "}
                {selected.size === 1 ? "atividade" : "atividades"} ×{" "}
                {days.length} {days.length === 1 ? "dia" : "dias"} ={" "}
                {selected.size * days.length}{" "}
                {selected.size * days.length === 1
                  ? "compromisso"
                  : "compromissos"}
              </strong>
              <span>
                {rests
                  ? `${rests} ${rests === 1 ? "dia de descanso planejado: as atividades ficarão dispensadas." : "dias de descanso planejado: as atividades ficarão dispensadas."}`
                  : "Você pode adaptar suas escolhas antes de salvar."}
              </span>
            </div>
          </div>
        </fieldset>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button
            className="button secondary"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className="button primary"
            type="submit"
            disabled={busy || Boolean(overlap && !draft.allowRepeat)}
          >
            {busy ? "Adicionando…" : "Quero experimentar"}
            <ArrowRight size={17} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
