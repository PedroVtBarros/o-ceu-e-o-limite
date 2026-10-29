import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  History,
  Leaf,
  Plus,
  Sprout,
  X,
} from "lucide-react";
import type { Goal, Snapshot, Status } from "../../shared/types";
import {
  goalsOn,
  isValidDate,
  parseDate,
  shiftDate,
  statusFor,
  summarize,
  weekStart,
} from "../../shared/domain";
import {
  dailySummary,
  dayLabel,
  resultLabel,
  restFor,
  weeklyGoals,
} from "../../shared/checklist";
import { categoryClasses, categoryIcons, formatDay } from "../goalPresentation";
import { WeeklyProgress } from "./ProgressSummary";
import { activitySchedule } from "../../shared/routineRuns";

function ChecklistRow({
  goal,
  date,
  today,
  snapshot,
  busy,
  onAction,
  onInspect,
}: {
  goal: Goal;
  date: string;
  today: string;
  snapshot: Snapshot;
  busy: boolean;
  onAction: (goal: Goal, status: Status) => void;
  onInspect: (goal: Goal) => void;
}) {
  const status = statusFor(goal, date, snapshot.entries);
  const Icon = categoryIcons[goal.category];
  return (
    <div className={`goal-row checklist-row ${status}`}>
      <button
        className={`goal-check ${status === "done" ? "checked" : ""}`}
        aria-label={
          status === "done"
            ? `Desmarcar ${goal.title}`
            : `Concluir ${goal.title}`
        }
        aria-pressed={status === "done"}
        aria-disabled={busy || date > today}
        disabled={date > today}
        onClick={() => {
          if (!busy) onAction(goal, status === "done" ? "pending" : "done");
        }}
      >
        {status === "done" && <Check size={17} strokeWidth={3} />}
      </button>
      <span className={`goal-category-icon ${categoryClasses[goal.category]}`}>
        <Icon size={19} />
      </span>
      <div className="goal-copy">
        <strong>{goal.title}</strong>
        <span>
          {goal.description ||
            (goal.frequency === "weekly"
              ? "Uma conquista nesta semana"
              : "Um pequeno compromisso com você")}
          {goal.routineId && <em>Rotina inspirada</em>}
        </span>
        {goal.routineActivity && activitySchedule(goal.routineActivity) && (
          <span className="routine-schedule">
            {activitySchedule(goal.routineActivity)}
          </span>
        )}
        <span className={`outcome-label ${status}`}>
          {date > today
            ? "Planejada"
            : resultLabel(goal, date, snapshot, today)}
        </span>
      </div>
      <div className="result-actions">
        <button
          title={
            status === "missed"
              ? "Voltar para pendente"
              : "Marcar como não atingida"
          }
          aria-label={
            status === "missed"
              ? `Deixar ${goal.title} pendente`
              : `Não atingi ${goal.title}`
          }
          aria-pressed={status === "missed"}
          aria-disabled={busy || date > today}
          className={`miss-button ${status === "missed" ? "selected" : ""}`}
          disabled={date > today}
          onClick={() => {
            if (!busy)
              onAction(goal, status === "missed" ? "pending" : "missed");
          }}
        >
          <X size={17} />
        </button>
        {date <= today && (snapshot.schemaVersion ?? 0) >= 2 && (
          <button
            className="icon-button result-history-button"
            aria-label={`Registros de ${goal.title}`}
            onClick={() => onInspect(goal)}
          >
            <History size={17} />
          </button>
        )}
      </div>
    </div>
  );
}
export function DailyChecklist({
  snapshot,
  date,
  today,
  filter,
  busy,
  desktop,
  onDate,
  onFilter,
  onCreate,
  onAction,
  onInspect,
  onRest,
}: {
  snapshot: Snapshot;
  date: string;
  today: string;
  filter: "daily" | "weekly";
  busy: boolean;
  desktop: boolean;
  onDate: (date: string) => void;
  onFilter: (filter: "daily" | "weekly") => void;
  onCreate: () => void;
  onAction: (goal: Goal, status: Status) => void;
  onInspect: (goal: Goal) => void;
  onRest: () => void;
}) {
  const day = dailySummary(snapshot, date, today);
  const weekly = weeklyGoals(snapshot, date, today);
  const displayed = filter === "daily" ? day.goals : weekly;
  const rest = restFor(snapshot, date);
  const start = weekStart(date);
  const summary = summarize(displayed, date, snapshot.entries);
  return (
    <section className="card goals-panel checklist-panel">
      <div className="section-heading">
        <div>
          <h2>Um compromisso com você</h2>
          <p>Suas metas, no seu ritmo.</p>
        </div>
        <button
          className="icon-button add-small"
          onClick={onCreate}
          aria-label="Adicionar meta"
        >
          <Plus size={21} />
        </button>
      </div>
      <div className="goal-tabs">
        <button
          className={filter === "daily" ? "active" : ""}
          aria-pressed={filter === "daily"}
          onClick={() => onFilter("daily")}
        >
          Metas do dia <span>{day.goals.length}</span>
        </button>
        <button
          className={filter === "weekly" ? "active" : ""}
          aria-pressed={filter === "weekly"}
          onClick={() => onFilter("weekly")}
        >
          Da semana <span>{weekly.length}</span>
        </button>
      </div>
      <div className="week-picker">
        <button
          className="icon-button"
          aria-label="Semana anterior"
          onClick={() => onDate(shiftDate(date, -7))}
        >
          <ChevronLeft size={17} />
        </button>
        {Array.from({ length: 7 }, (_, index) => shiftDate(start, index)).map(
          (dayDate) => {
            const label = dayLabel(snapshot, dayDate, today);
            const info = dailySummary(snapshot, dayDate, today);
            const marker =
              info.state === "rest"
                ? "rest"
                : info.state === "planned"
                  ? "future"
                  : info.state === "empty"
                    ? "empty"
                    : info.done === info.total
                      ? "complete"
                      : info.done
                        ? "partial"
                        : info.missed
                          ? "missed"
                          : dayDate < today
                            ? "unrecorded"
                            : "pending";
            return (
              <button
                key={dayDate}
                className={`day-button ${date === dayDate ? "selected" : ""} ${dayDate === today ? "is-today" : ""} day-${marker}`}
                aria-pressed={date === dayDate}
                aria-label={formatDay(dayDate, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
                aria-describedby={`agenda-${dayDate}`}
                title={label}
                onClick={() => onDate(dayDate)}
              >
                <span>
                  {formatDay(dayDate, { weekday: "short" }).replace(".", "")}
                </span>
                <strong>{parseDate(dayDate).getDate()}</strong>
                <i className={`calendar-marker ${marker}`} />
                <span className="sr-only" id={`agenda-${dayDate}`}>
                  {label}
                </span>
              </button>
            );
          },
        )}
        <button
          className="icon-button"
          aria-label="Próxima semana"
          onClick={() => onDate(shiftDate(date, 7))}
        >
          <ChevronRight size={17} />
        </button>
      </div>
      <div className="agenda-controls">
        <label>
          <CalendarDays size={15} />
          <span>Escolher data</span>
          <input
            type="date"
            aria-label="Data da agenda"
            value={date}
            min="1900-01-01"
            onChange={(event) => {
              if (
                isValidDate(event.target.value) &&
                event.target.value >= "1900-01-01"
              )
                onDate(event.target.value);
            }}
          />
        </label>
        {date !== today && (
          <button onClick={() => onDate(today)}>Voltar para hoje</button>
        )}
        {desktop && date >= today && (
          <button className="rest-trigger" onClick={onRest}>
            <Leaf size={15} />
            {rest ? "Ajustar descanso" : "Planejar descanso"}
          </button>
        )}
      </div>
      <div className="calendar-key">
        <span>
          <i className="complete" />
          Atingidas
        </span>
        <span>
          <i className="unrecorded" />
          Sem registro
        </span>
        <span>
          <i className="rest" />
          Descanso
        </span>
        <span>
          <i className="future" />
          Futuro
        </span>
      </div>
      {filter === "weekly" && (
        <WeeklyProgress snapshot={snapshot} date={date} today={today} />
      )}
      {date > today && (
        <p className="weekly-note planned-note">
          Planejado para uma data futura. Os resultados ficam disponíveis quando
          o dia chegar.
        </p>
      )}
      {filter === "daily" && rest && (
        <div className="rest-day-banner">
          <Leaf size={29} />
          <h3>Descanso planejado</h3>
          <p>
            {rest.note ||
              "Um espaço para cuidar de você e recuperar as energias."}
          </p>
          <span>
            Metas diárias e de rotina dispensadas. As semanais seguem
            separadamente.
          </span>
          {date < today && (
            <small>
              Este descanso faz parte do histórico e permanece preservado.
            </small>
          )}
        </div>
      )}
      <div className="goal-rows">
        {displayed.map((goal) => (
          <ChecklistRow
            key={goal.id}
            goal={goal}
            date={date}
            today={today}
            snapshot={snapshot}
            busy={busy}
            onAction={onAction}
            onInspect={onInspect}
          />
        ))}
        {!displayed.length && !(filter === "daily" && rest) && (
          <div className="empty-goals">
            <span className="empty-icon">
              <Sprout size={29} strokeWidth={1.5} />
            </span>
            <h3>
              {filter === "weekly"
                ? "Sem metas semanais programadas"
                : "Sem metas programadas"}
            </h3>
            <p>
              {date > today
                ? "Você pode preparar seus próximos passos sem compromisso de desempenho antecipado."
                : "Este período não tinha compromissos programados. Ele fica sem nota de desempenho."}
            </p>
            <button className="text-button" onClick={onCreate}>
              Criar uma meta <Plus size={15} />
            </button>
          </div>
        )}
      </div>
      {displayed.length > 0 && (
        <p className="checklist-help">
          Marque ✓ para atingida ou × para não atingida. Clique novamente para
          voltar a pendente.
          {date < today &&
            " Períodos encerrados pedem confirmação da correção."}
        </p>
      )}
      <div className="goals-footer">
        <Leaf size={15} />
        <span>Progresso é continuar, mesmo que um pouquinho.</span>
        <span className="goals-count">
          {date > today
            ? `${displayed.length} planejadas`
            : filter === "daily" && rest
              ? "Descanso"
              : displayed.length
                ? `${summary.done}/${displayed.length} feitas`
                : "Sem agenda"}
        </span>
      </div>
    </section>
  );
}
