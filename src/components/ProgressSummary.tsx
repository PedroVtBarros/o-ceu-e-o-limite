import type { Snapshot } from "../../shared/types";
import {
  dailySummary,
  dailyWeekSummary,
  weeklySummary,
} from "../../shared/checklist";
import { formatDay } from "../goalPresentation";

function Meter({ percent, label }: { percent: number | null; label: string }) {
  return percent === null ? null : (
    <div
      className="progress-track"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <div style={{ width: `${percent}%` }} />
    </div>
  );
}
export function DailyProgress({
  snapshot,
  date,
  today,
}: {
  snapshot: Snapshot;
  date: string;
  today: string;
}) {
  const summary = dailySummary(snapshot, date, today);
  const week = dailyWeekSummary(snapshot, date, today);
  const title =
    summary.state === "rest"
      ? "Descanso planejado"
      : summary.state === "empty"
        ? "Sem metas programadas"
        : summary.state === "planned"
          ? "Seu próximo passo já tem um lugar."
          : summary.percent === 100
            ? "Você chegou lá. Celebre!"
            : summary.done
              ? "Olha só o quanto você já fez!"
              : "O primeiro passo faz a diferença.";
  return (
    <section
      className={`progress-card card day-progress state-${summary.state}`}
      aria-label="Progresso diário"
    >
      <div className="eyebrow">
        <span>
          {summary.state === "planned"
            ? "AGENDA PLANEJADA"
            : "SEU PROGRESSO DIÁRIO"}
        </span>
        <span>
          {date === today
            ? "Hoje"
            : formatDay(date, {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
        </span>
      </div>
      <div className="progress-title">
        <h2>{title}</h2>
        {summary.percent !== null && (
          <strong>
            {summary.percent}
            <span>%</span>
          </strong>
        )}
      </div>
      <Meter percent={summary.percent} label="Metas diárias atingidas" />
      {summary.state === "active" ? (
        <div className="progress-legend">
          <span>
            <i />
            {summary.done} atingidas
          </span>
          <span>
            <i />
            {summary.pending} {date < today ? "sem registro" : "pendentes"}
          </span>
          <span>
            <i />
            {summary.missed} não atingidas
          </span>
        </div>
      ) : (
        <p className="progress-explanation">
          {summary.state === "rest"
            ? "Neste dia o compromisso é recuperar as energias. Metas diárias e de rotina estão dispensadas; as semanais continuam na sua própria aba."
            : summary.state === "planned"
              ? "Estas metas estão previstas para uma data futura. Você poderá registrar resultados quando o dia chegar."
              : "Este dia não tem compromissos diários. Ele fica sem nota de desempenho."}
        </p>
      )}
      <div className="daily-week-summary">
        <span>Metas diárias na semana</span>
        <strong>
          {week.percent === null
            ? week.planned
              ? "Planejamento futuro"
              : "Sem compromissos no período"
            : `${week.done} de ${week.total} atingidas · ${week.percent}%`}
        </strong>
        {week.partial && (
          <small>
            Semana em andamento · considera somente os dias que já chegaram
          </small>
        )}
      </div>
    </section>
  );
}
export function WeeklyProgress({
  snapshot,
  date,
  today,
}: {
  snapshot: Snapshot;
  date: string;
  today: string;
}) {
  const summary = weeklySummary(snapshot, date, today);
  return (
    <div className="weekly-progress" aria-label="Resumo das metas semanais">
      <div>
        <strong>Metas semanais</strong>
        <span>
          {summary.partial
            ? "Semana em andamento"
            : summary.planned
              ? "Planejamento futuro"
              : "Semana encerrada"}
        </span>
        {summary.percent !== null && <b>{summary.percent}%</b>}
      </div>
      <Meter percent={summary.percent} label="Metas semanais atingidas" />
      <p>
        {summary.goals.length
          ? summary.planned
            ? `${summary.total} compromissos planejados`
            : `${summary.done} de ${summary.total} atingidos · ${summary.pending} ${summary.partial ? "pendentes" : "sem registro"} · ${summary.missed} não atingidos`
          : "Sem metas semanais programadas."}
      </p>
      <small>
        Um resultado por meta, de segunda a domingo. Não altera a porcentagem
        diária.
      </small>
    </div>
  );
}
