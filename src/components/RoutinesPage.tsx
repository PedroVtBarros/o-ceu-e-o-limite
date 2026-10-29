import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Dumbbell,
  History,
  Leaf,
  Sparkles,
} from "lucide-react";
import { routines, type Routine } from "../../shared/routines";
import type { RoutineRun, Snapshot } from "../../shared/types";
import { activitySchedule, routineProgress } from "../../shared/routineRuns";
import { opportunities } from "../../shared/domain";
import { countResults } from "../../shared/analytics";
import { formatDay as formatDate } from "../goalPresentation";
import { Modal } from "./Modal";

const pct = (value: number | null) =>
  value === null ? "Sem nota" : `${value}%`;
const formatDay = (date: string) =>
  formatDate(date, { day: "2-digit", month: "short", year: "numeric" });
const dateRange = (from: string, through: string) =>
  from === through
    ? formatDay(from)
    : `${formatDay(from)} – ${formatDay(through)}`;

function RunDetails({
  run,
  snapshot,
  today,
  onClose,
  onReview,
  onSource,
}: {
  run: RoutineRun;
  snapshot: Snapshot;
  today: string;
  onClose: () => void;
  onReview: (date: string) => void;
  onSource: (url: string) => void;
}) {
  const summary = routineProgress(snapshot, run, today);
  return (
    <Modal
      title={`Minha experiência com ${run.name}`}
      subtitle={dateRange(run.startsOn, run.endsOn)}
      wide
      onClose={onClose}
    >
      <div className="run-detail-summary">
        <strong>{pct(summary.percent)}</strong>
        <span>
          {summary.done} de {summary.total} compromissos elegíveis atingidos até
          hoje
        </span>
        <span>
          {summary.future} futuros · {summary.rest} dispensados por descanso ·{" "}
          {summary.removed} retirados da agenda
        </span>
      </div>
      <div className="routine-provenance">
        <strong>Modelo v{run.templateVersion} · sua cópia pessoal</strong>
        <p>{run.principle}</p>
        <button className="source-link" onClick={() => onSource(run.sourceUrl)}>
          <BookOpen size={15} />
          {run.sourceLabel}
          <ArrowUpRight size={14} />
        </button>
        <span>Fonte consultada em {formatDay(run.sourceCheckedOn)}</span>
      </div>
      <div className="run-chosen-activities">
        <h3>As escolhas desta experiência</h3>
        {run.activities.map((activity) => (
          <article key={activity.activityId}>
            <strong>{activity.title}</strong>
            <span>
              {activity.category}
              {activitySchedule(activity)
                ? ` · ${activitySchedule(activity)}`
                : " · sem horário ou duração definidos"}
            </span>
            <p>{activity.description}</p>
          </article>
        ))}
      </div>
      <div className="run-day-links">
        <h3>Consultar a agenda</h3>
        {run.activities[0].goals.map((plan) => (
          <button
            key={plan.date}
            className="button secondary"
            disabled={plan.date > today}
            onClick={() => {
              onClose();
              onReview(plan.date);
            }}
          >
            {formatDay(plan.date)}
            {plan.date > today ? " · futuro" : ""}
            <ArrowRight size={13} />
          </button>
        ))}
      </div>
      <p className="form-note">
        Esta cópia mantém a versão, as escolhas e a fonte do momento em que você
        a criou. Atualizar o catálogo não altera sua experiência.
      </p>
    </Modal>
  );
}

export function RoutinesPage({
  snapshot,
  today,
  onChoose,
  onReview,
  onSource,
}: {
  snapshot: Snapshot;
  today: string;
  onChoose: (routine: Routine) => void;
  onReview: (date: string) => void;
  onSource: (url: string) => void;
}) {
  const [tab, setTab] = useState<"catalog" | "history">("catalog");
  const [template, setTemplate] = useState("all");
  const [detail, setDetail] = useState<RoutineRun | null>(null);
  const runs = [...(snapshot.routineRuns ?? [])]
    .reverse()
    .filter((run) => template === "all" || run.templateId === template);
  const closed = runs.filter((run) => run.endsOn < today);
  const comparable = template !== "all" ? closed.slice(0, 2) : [];
  const legacy = new Map<
    string,
    { templateId: string; date: string; title: string; ids: string[] }
  >();
  for (const goal of snapshot.goals.filter(
    (goal) =>
      goal.routineId &&
      !goal.routineRunId &&
      (template === "all" || goal.routineId === template),
  )) {
    const key = `${goal.routineId}:${goal.startDate}`;
    const group = legacy.get(key) ?? {
      templateId: goal.routineId!,
      date: goal.startDate,
      title:
        routines.find((item) => item.id === goal.routineId)?.name ??
        "Rotina anterior",
      ids: [],
    };
    group.ids.push(goal.id);
    legacy.set(key, group);
  }
  return (
    <div className="routines-page">
      <div className="routine-tabs" role="group" aria-label="Seções de rotinas">
        <button
          className={tab === "catalog" ? "selected" : ""}
          aria-pressed={tab === "catalog"}
          onClick={() => setTab("catalog")}
        >
          <Sparkles size={17} />
          Catálogo
        </button>
        <button
          className={tab === "history" ? "selected" : ""}
          aria-pressed={tab === "history"}
          onClick={() => setTab("history")}
        >
          <History size={17} />
          Minhas experiências
        </button>
      </div>
      {tab === "catalog" ? (
        <>
          <div className="routines-intro">
            <span>
              <Sparkles size={21} />
            </span>
            <p>
              Inspire-se em uma história. Escolha atividades, adapte ao seu
              ritmo e construa uma experiência sua. O ponto de partida é{" "}
              <strong>só hoje</strong>.
            </p>
          </div>
          <div className="routines-grid">
            {routines.map((routine, index) => (
              <article
                key={routine.id}
                className={`routine-card ${routine.theme}`}
              >
                <div className="routine-art">
                  <span className="routine-number">
                    0{index + 1} / INSPIRE-SE
                  </span>
                  <span className="routine-orbit" />
                  <span className="routine-orbit second" />
                  <span className="routine-monogram">{routine.initials}</span>
                  <span className="routine-symbol">
                    {index === 0 ? (
                      <Dumbbell size={39} strokeWidth={1.3} />
                    ) : index === 1 ? (
                      <BookOpen size={39} strokeWidth={1.3} />
                    ) : (
                      <Leaf size={39} strokeWidth={1.3} />
                    )}
                  </span>
                  <span className="routine-art-star">✧</span>
                </div>
                <div className="routine-content">
                  <span className="eyebrow">{routine.role}</span>
                  <h2>{routine.name}</h2>
                  <h3>{routine.title}</h3>
                  <p>{routine.description}</p>
                  <div className="routine-model-meta">
                    Modelo v{routine.version} · {routine.goals.length}{" "}
                    atividades adaptáveis
                  </div>
                  <div className="routine-bottom">
                    <span>Faça do seu jeito</span>
                    <button
                      className="round-button"
                      onClick={() => onChoose(routine)}
                      aria-label={`Conhecer rotina de ${routine.name}`}
                    >
                      <ArrowUpRight size={21} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <p className="routines-footnote">
            <BookOpen size={17} />O catálogo e as atividades estão disponíveis
            offline. As fontes e as adaptações estão na prévia de cada rotina.
          </p>
        </>
      ) : (
        <section className="card routine-experiences">
          <div className="section-heading">
            <div>
              <h2>Suas experiências, seu caminho</h2>
              <p>
                Compare suas próprias tentativas, com escolhas e períodos
                visíveis.
              </p>
            </div>
            <label className="routine-history-filter">
              Filtrar por inspiração
              <select
                value={template}
                onChange={(event) => setTemplate(event.target.value)}
              >
                <option value="all">Todas as rotinas</option>
                {routines.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
                {[
                  ...new Set(
                    snapshot.routineRuns?.map((run) => run.templateId) ?? [],
                  ),
                ]
                  .filter((id) => !routines.some((item) => item.id === id))
                  .map((id) => (
                    <option key={id} value={id}>
                      {
                        snapshot.routineRuns?.find(
                          (run) => run.templateId === id,
                        )?.name
                      }
                    </option>
                  ))}
              </select>
            </label>
          </div>
          {comparable.length === 2 && (
            <div className="run-comparison">
              <h3>Suas duas últimas experiências encerradas</h3>
              <div>
                {comparable.map((run) => {
                  const result = routineProgress(snapshot, run, today);
                  return (
                    <div key={run.id}>
                      <span>{dateRange(run.startsOn, run.endsOn)}</span>
                      <strong>{pct(result.percent)}</strong>
                      <span>
                        {result.done} de {result.total} atingidos ·{" "}
                        {run.activities.length} atividades escolhidas
                      </span>
                    </div>
                  );
                })}
              </div>
              <p>
                Compare o seu cumprimento. Durações, escolhas e dias de descanso
                podem variar entre experiências.
              </p>
            </div>
          )}
          {runs.length ? (
            <div className="table-scroll run-history-table">
              <table>
                <thead>
                  <tr>
                    <th>Inspiração e período</th>
                    <th>Situação</th>
                    <th>Cumprimento até hoje</th>
                    <th>Escolhas</th>
                    <th>
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => {
                    const result = routineProgress(snapshot, run, today);
                    return (
                      <tr key={run.id}>
                        <th scope="row">
                          <strong>{run.name}</strong>
                          <span>
                            {dateRange(run.startsOn, run.endsOn)} · v
                            {run.templateVersion}
                          </span>
                        </th>
                        <td>
                          <span
                            className={`run-status ${result.isFuture ? "future" : result.partial ? "partial" : "closed"}`}
                          >
                            {result.isFuture
                              ? "Planejada"
                              : result.partial
                                ? "Parcial"
                                : "Encerrada"}
                          </span>
                        </td>
                        <td>
                          <strong>{pct(result.percent)}</strong>
                          <span>
                            {result.done}/{result.total} atingidos ·{" "}
                            {result.pending}{" "}
                            {run.endsOn < today ? "sem registro" : "pendentes"}
                          </span>
                          <span>
                            {result.future} futuros · {result.rest} descansos ·{" "}
                            {result.removed} retirados
                          </span>
                        </td>
                        <td>{run.activities.length} atividades</td>
                        <td>
                          <button
                            className="text-button"
                            onClick={() => setDetail(run)}
                            aria-label={`Ver experiência com ${run.name} de ${formatDay(run.startsOn)}`}
                          >
                            Ver escolhas <ArrowRight size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="routine-history-empty">
              <Sparkles size={30} />
              <h3>Seu próximo experimento começa com uma escolha.</h3>
              <p>
                Encontre uma inspiração no catálogo e personalize seu primeiro
                dia.
              </p>
              <button
                className="button secondary"
                onClick={() => setTab("catalog")}
              >
                Explorar catálogo
              </button>
            </div>
          )}
          {legacy.size > 0 && (
            <div className="legacy-routine-history">
              <h3>Rotinas anteriores à personalização</h3>
              <p>
                Os resultados foram preservados. A versão do modelo, os horários
                e a data de consulta da fonte não eram registrados.
              </p>
              {[...legacy.values()]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((item) => {
                  const result = countResults(
                    opportunities(
                      snapshot,
                      item.date,
                      item.date < today ? item.date : today,
                    ).filter((plan) => item.ids.includes(plan.goal.id)),
                  );
                  return (
                    <div key={`${item.templateId}:${item.date}`}>
                      <span>
                        <strong>{item.title}</strong> · {formatDay(item.date)}
                      </span>
                      <span>
                        {result.done}/{result.total} · {pct(result.percent)} ·
                        legado
                      </span>
                      <button
                        className="text-button"
                        disabled={item.date > today}
                        onClick={() => onReview(item.date)}
                      >
                        Consultar dia <ArrowRight size={13} />
                      </button>
                    </div>
                  );
                })}
            </div>
          )}
        </section>
      )}
      {detail && (
        <RunDetails
          run={detail}
          snapshot={snapshot}
          today={today}
          onClose={() => setDetail(null)}
          onReview={onReview}
          onSource={onSource}
        />
      )}
    </div>
  );
}
