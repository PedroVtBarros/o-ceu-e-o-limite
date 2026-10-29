import type { Goal, GoalRevision, Snapshot } from "../../shared/types";
import { shiftDate } from "../../shared/domain";
import { scheduleLabel } from "../../shared/schedule";
import { formatDay, frequencyNames } from "../goalPresentation";
import { Modal } from "./Modal";
export function GoalHistory({
  goal,
  snapshot,
  today,
  onClose,
}: {
  goal: Goal;
  snapshot: Snapshot;
  today: string;
  onClose: () => void;
}) {
  const versions =
    snapshot.revisions
      ?.filter((item) => item.goalId === goal.id)
      .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)) ?? [];
  const versionStatus = (version: GoalRevision) => {
    if (goal.archivedOn && version.effectiveFrom > goal.archivedOn)
      return "Não aplicada";
    if (
      goal.archivedOn &&
      (!version.effectiveTo || version.effectiveTo > goal.archivedOn)
    )
      return "Arquivada";
    if (version.effectiveFrom > today) return "Programada";
    return version.effectiveTo && version.effectiveTo <= today
      ? "Encerrada"
      : "Vigente";
  };
  return (
    <Modal
      title={`Histórico de ${goal.title}`}
      subtitle="Cada versão conserva os compromissos do seu período."
      onClose={onClose}
    >
      {goal.archivedOn && (
        <p className="form-note">
          Meta arquivada em{" "}
          {formatDay(goal.archivedOn, {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          . Os resultados existentes foram preservados.
        </p>
      )}
      <div className="goal-version-list">
        {versions.map((version) => (
          <article key={version.id} className="goal-version">
            <div>
              <strong>Versão {version.revisionNumber}</strong>
              <span className="frequency-tag">{versionStatus(version)}</span>
            </div>
            <h3>{version.title}</h3>
            <p>
              {version.category} · {frequencyNames[version.frequency]}
            </p>
            <p>{scheduleLabel(version.frequency, version.weekdayMask)}</p>
            <p>
              Desde{" "}
              {formatDay(version.effectiveFrom, {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              {version.effectiveTo &&
                ` até ${formatDay(shiftDate(version.effectiveTo, -1), { day: "numeric", month: "long", year: "numeric" })}`}
            </p>
            {version.description && <p>{version.description}</p>}
          </article>
        ))}
      </div>
      {!versions.length && (
        <p className="modal-body-copy">
          O histórico de versões está disponível no aplicativo desktop.
        </p>
      )}
      <div className="modal-actions">
        <button className="button primary" onClick={onClose}>
          Fechar histórico
        </button>
      </div>
    </Modal>
  );
}
