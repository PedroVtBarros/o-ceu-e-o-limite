import { useState, type FormEvent } from "react";
import { Leaf } from "lucide-react";
import type { Snapshot } from "../../shared/types";
import { isValidDate } from "../../shared/domain";
import { hasDailyEvaluation, restFor } from "../../shared/checklist";
import { Modal } from "./Modal";
export function RestPlanner({
  snapshot,
  initialDate,
  today,
  busy,
  onSave,
  onRemove,
  onClose,
}: {
  snapshot: Snapshot;
  initialDate: string;
  today: string;
  busy: boolean;
  onSave: (date: string, note: string) => Promise<void>;
  onRemove: (date: string) => Promise<void>;
  onClose: () => void;
}) {
  const [date, setDate] = useState(initialDate);
  const [note, setNote] = useState(restFor(snapshot, initialDate)?.note ?? "");
  const [error, setError] = useState("");
  const plan = restFor(snapshot, date);
  const invalid =
    !isValidDate(date) || date < today
      ? "Escolha hoje ou uma data futura. Dias encerrados permanecem preservados."
      : hasDailyEvaluation(snapshot, date)
        ? "Este dia já teve resultados diários registrados, mesmo que depois desmarcados. Você pode planejar o descanso para outra data."
        : "";
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (invalid) return;
    setError("");
    try {
      await onSave(date, note);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message.replace(
              /^Error invoking remote method '[^']+': (Error: )?/,
              "",
            )
          : "Não foi possível salvar o descanso.",
      );
    }
  }
  return (
    <Modal
      title="Um espaço para recuperar as energias"
      subtitle="Descansar também pode fazer parte do seu planejamento."
      onClose={onClose}
    >
      <form className="goal-form" onSubmit={submit}>
        <fieldset className="goal-fields" disabled={busy}>
          <label>
            Dia de descanso
            <input
              type="date"
              min={today}
              required
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setNote(restFor(snapshot, event.target.value)?.note ?? "");
                setError("");
              }}
            />
          </label>
          <label>
            Uma observação <span className="optional">opcional</span>
            <textarea
              maxLength={500}
              rows={3}
              value={note}
              placeholder="Ex.: Um dia para desacelerar."
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <div className="rest-preview">
            <Leaf size={22} />
            <p>
              As metas diárias e de rotina ficam dispensadas nesta data. Metas
              semanais continuam com seu próprio compromisso. O dia de descanso
              fica sem porcentagem de desempenho.
            </p>
          </div>
          {(invalid || error) && (
            <p className="form-error" role="alert">
              {error || invalid}
            </p>
          )}
        </fieldset>
        <div className="modal-actions">
          {plan && (
            <button
              type="button"
              className="button secondary"
              disabled={busy || !!invalid}
              onClick={async () => {
                try {
                  await onRemove(date);
                } catch (failure) {
                  setError(
                    failure instanceof Error
                      ? failure.message.replace(
                          /^Error invoking remote method '[^']+': (Error: )?/,
                          "",
                        )
                      : "Não foi possível restaurar a programação.",
                  );
                }
              }}
            >
              Voltar à programação
            </button>
          )}
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className="button primary"
            type="submit"
            disabled={busy || !!invalid}
          >
            {busy
              ? "Salvando…"
              : plan
                ? "Salvar descanso"
                : "Confirmar descanso"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
