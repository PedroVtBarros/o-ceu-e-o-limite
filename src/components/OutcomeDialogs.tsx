import { useState } from "react";
import type { Goal, Snapshot, Status } from "../../shared/types";
import { shiftDate, statusFor, weekStart } from "../../shared/domain";
import {
  occurrenceFor,
  resultLabel,
  statusNames,
} from "../../shared/checklist";
import { formatDay } from "../goalPresentation";
import { Modal } from "./Modal";
const periodLabel = (goal: Goal, date: string) =>
  goal.frequency === "weekly"
    ? `Semana de ${formatDay(weekStart(date), { day: "numeric", month: "long" })} a ${formatDay(shiftDate(weekStart(date), 6), { day: "numeric", month: "long", year: "numeric" })}`
    : formatDay(date, { day: "numeric", month: "long", year: "numeric" });
export function ResultCorrection({
  goal,
  date,
  initialStatus,
  snapshot,
  today,
  busy,
  onSave,
  onClose,
}: {
  goal: Goal;
  date: string;
  initialStatus: Status;
  snapshot: Snapshot;
  today: string;
  busy: boolean;
  onSave: (status: Status) => Promise<void>;
  onClose: () => void;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState("");
  const current = statusFor(goal, date, snapshot.entries);
  return (
    <Modal
      title="Corrigir resultado no histórico"
      subtitle={`${goal.title} · ${periodLabel(goal, date)}`}
      onClose={onClose}
    >
      <div className="correction-context">
        <span>Resultado atual</span>
        <strong>{resultLabel(goal, date, snapshot, today)}</strong>
      </div>
      <p className="modal-body-copy">
        Escolha a avaliação que representa esse período. A correção fica
        registrada e os totais são atualizados, preservando a definição original
        da meta.
      </p>
      <div
        className="correction-options"
        role="group"
        aria-label="Novo resultado"
      >
        {(["done", "missed", "pending"] as const).map((value) => (
          <button
            key={value}
            className={status === value ? "selected" : ""}
            aria-pressed={status === value}
            disabled={busy}
            onClick={() => setStatus(value)}
          >
            {statusNames[value]}
          </button>
        ))}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button className="button secondary" disabled={busy} onClick={onClose}>
          Cancelar
        </button>
        <button
          className="button primary"
          disabled={busy || status === current}
          onClick={async () => {
            setError("");
            try {
              await onSave(status);
            } catch (failure) {
              setError(
                failure instanceof Error
                  ? failure.message.replace(
                      /^Error invoking remote method '[^']+': (Error: )?/,
                      "",
                    )
                  : "Não foi possível salvar a correção.",
              );
            }
          }}
        >
          Salvar correção
        </button>
      </div>
    </Modal>
  );
}
export function OutcomeHistory({
  goal,
  date,
  snapshot,
  onClose,
}: {
  goal: Goal;
  date: string;
  snapshot: Snapshot;
  onClose: () => void;
}) {
  const occurrence = occurrenceFor(snapshot, goal, date);
  const events =
    snapshot.events
      ?.filter((event) => event.occurrenceId === occurrence?.id)
      .slice()
      .reverse() ?? [];
  return (
    <Modal
      title={`Registros de ${goal.title}`}
      subtitle={periodLabel(goal, date)}
      onClose={onClose}
    >
      {events.length > 0 ? (
        <ol className="outcome-events">
          {events.map((event) => (
            <li key={event.id}>
              <span className="frequency-tag">
                {event.reason === "history_correction"
                  ? "Correção no calendário"
                  : "Checklist"}
              </span>
              <strong>
                {statusNames[event.previousStatus]} →{" "}
                {statusNames[event.nextStatus]}
              </strong>
              <time dateTime={event.changedAt}>
                {new Date(event.changedAt).toLocaleString("pt-BR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </time>
            </li>
          ))}
        </ol>
      ) : (
        <p className="modal-body-copy">
          {occurrence && occurrence.status !== "pending"
            ? "Este resultado foi preservado de um banco antigo, que não registrava o horário da avaliação."
            : "Nenhuma avaliação registrada para este período. Uma pendência não é transformada automaticamente em meta não atingida."}
        </p>
      )}
      <div className="modal-actions">
        <button className="button primary" onClick={onClose}>
          Fechar registros
        </button>
      </div>
    </Modal>
  );
}
