import { useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Flame,
  TrendingUp,
  Trophy,
} from "lucide-react";
import type { Snapshot } from "../../shared/types";
import { parseDate, shiftDate, streak } from "../../shared/domain";
import {
  consistencyDay,
  consistencyLabels,
  consistencyMonth,
  dailySeries,
  monthStart,
  monthlyEvolution,
  rangeSummary,
  shiftMonth,
  weeklyComparison,
  type Counts,
} from "../../shared/analytics";
import { categoryClasses, categoryIcons, formatDay } from "../goalPresentation";
import { ProgressChart } from "./ProgressCharts";

const pct = (value: number | null) =>
  value === null ? "Sem nota" : `${value}%`;
const dates = (from: string, through: string) =>
  `${formatDay(from, { day: "numeric", month: "short" })} – ${formatDay(through, { day: "numeric", month: "short" })}`;
const deltaText = (value: number | null) =>
  value === null
    ? "Sem base para comparar"
    : value === 0
      ? "Mesmo cumprimento"
      : `${value > 0 ? "+" : ""}${value} pontos percentuais`;

function ResultCount({ result }: { result: Counts }) {
  return (
    <>
      <strong>{pct(result.percent)}</strong>
      <span>
        {result.done} de {result.total} atingidas
      </span>
    </>
  );
}

function ConsistencyCalendar({
  snapshot,
  today,
  onReview,
}: {
  snapshot: Snapshot;
  today: string;
  onReview: (date: string) => void;
}) {
  const [month, setMonth] = useState(monthStart(today));
  const [selected, setSelected] = useState(today);
  const { offset, days } = consistencyMonth(snapshot, month, today);
  const detail = consistencyDay(snapshot, selected, today);
  const selectMonth = (next: string) => {
    setMonth(next);
    setSelected(next === monthStart(today) ? today : next);
  };
  return (
    <section
      className="card consistency-card"
      aria-labelledby="consistency-title"
    >
      <div className="section-heading">
        <div>
          <h2 id="consistency-title">Seu calendário de consistência</h2>
          <p>Cada dia tem seu próprio ritmo.</p>
        </div>
        <CalendarDays size={21} className="muted" />
      </div>
      <div className="calendar-nav">
        <button
          className="icon-button"
          aria-label="Mês anterior"
          onClick={() => selectMonth(shiftMonth(month, -1))}
        >
          <ChevronLeft size={18} />
        </button>
        <h3 aria-live="polite">
          {formatDay(month, { month: "long", year: "numeric" })}
        </h3>
        <button
          className="icon-button"
          aria-label="Próximo mês"
          onClick={() => selectMonth(shiftMonth(month, 1))}
        >
          <ChevronRight size={18} />
        </button>
        <button
          className="text-button"
          onClick={() => selectMonth(monthStart(today))}
        >
          Hoje
        </button>
      </div>
      <div className="consistency-grid" role="group" aria-label="Dias do mês">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => (
          <span className="calendar-weekday" key={day}>
            {day}
          </span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {days.map((day) => (
          <button
            key={day.date}
            className={`consistency-day state-${day.state} ${day.date === today ? "is-today" : ""}`}
            aria-pressed={selected === day.date}
            aria-label={`${formatDay(day.date, { day: "numeric", month: "long", year: "numeric" })}: ${day.label}${day.percent === null ? "" : `, ${day.percent}%`}`}
            onClick={() => setSelected(day.date)}
            title={day.label}
          >
            <span>{parseDate(day.date).getDate()}</span>
            <small>
              {day.percent === null
                ? day.state === "rest"
                  ? "folga"
                  : "—"
                : `${day.percent}%`}
            </small>
          </button>
        ))}
      </div>
      <div className="consistency-legend">
        {Object.entries(consistencyLabels).map(([state, label]) => (
          <span key={state}>
            <i className={`state-${state}`} />
            {label}
          </span>
        ))}
      </div>
      <div className="calendar-detail" aria-live="polite">
        <div>
          <strong>
            {formatDay(selected, { day: "numeric", month: "long" })} ·{" "}
            {detail.label}
          </strong>
          <p>
            {detail.percent === null
              ? detail.state === "future"
                ? "Planejamento futuro, fora das estatísticas."
                : "Dia sem nota de desempenho."
              : `${detail.done} atingidas · ${detail.missed} não atingidas · ${detail.pending} ${selected < today ? "sem registro" : "pendentes"}`}
          </p>
        </div>
        {selected <= today && (
          <button className="text-button" onClick={() => onReview(selected)}>
            Revisar este dia <ArrowRight size={15} />
          </button>
        )}
      </div>
      <p className="analytics-note">
        O calendário considera metas diárias e de rotinas. Compromissos semanais
        têm acompanhamento separado.
      </p>
    </section>
  );
}

export function EvolutionPage({
  snapshot,
  today,
  onReview,
}: {
  snapshot: Snapshot;
  today: string;
  onReview: (date: string) => void;
}) {
  const [range, setRange] = useState(30);
  const analytics = useMemo(() => {
    const from = shiftDate(today, -range + 1);
    return {
      summary: rangeSummary(snapshot, from, today, today),
      series: dailySeries(snapshot, from, today, today),
      months: monthlyEvolution(snapshot, today),
      weeks: weeklyComparison(snapshot, today),
      sequence: streak(snapshot, today),
    };
  }, [snapshot, today, range]);
  const { summary, series, months, weeks, sequence } = analytics;
  return (
    <div className="analytics-page">
      <div className="page-toolbar">
        <div>
          <h2>Sua jornada, em perspectiva</h2>
          <p className="muted">
            Pequenas ações. Resultados que você pode acompanhar.
          </p>
        </div>
        <div
          className="range-picker"
          role="group"
          aria-label="Intervalo da evolução"
        >
          {[7, 30, 90].map((days) => (
            <button
              key={days}
              className={range === days ? "selected" : ""}
              onClick={() => setRange(days)}
              aria-pressed={range === days}
            >
              {days} dias
            </button>
          ))}
        </div>
      </div>
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-icon mint">
            <Trophy size={23} />
          </span>
          <div>
            <span>Metas diárias atingidas</span>
            <strong data-testid="analytics-done">{summary.daily.done}</strong>
            <p>De {summary.daily.total} programadas no intervalo</p>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon lavender">
            <TrendingUp size={23} />
          </span>
          <div>
            <span>Cumprimento diário no período</span>
            <strong data-testid="analytics-percent">
              {pct(summary.daily.percent)}
            </strong>
            <p>Inclui pendentes e não atingidas</p>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon peach">
            <Flame size={23} />
          </span>
          <div>
            <span>Sequência atual</span>
            <strong>
              {sequence}
              <small> dias</small>
            </strong>
            <p>Com ao menos uma meta diária atingida</p>
          </div>
        </div>
      </div>
      <section className="card evolution-chart">
        <div className="section-heading">
          <div>
            <h2>Cada dia, um passo a mais</h2>
            <p>Cumprimento de metas diárias e de rotinas</p>
          </div>
          <span className="category-tag lavender">Últimos {range} dias</span>
        </div>
        <ProgressChart data={series} />
        <p className="analytics-note">
          Descanso e dias sem metas aparecem como lacunas, sem nota. Hoje está
          em aberto; dias futuros ficam fora dos cálculos. O total usa atingidas
          ÷ programadas, sem fazer média das porcentagens dos dias.
        </p>
      </section>
      <div className="analytics-columns">
        <ConsistencyCalendar
          snapshot={snapshot}
          today={today}
          onReview={onReview}
        />
        <div className="analytics-stack">
          <section
            className="card weekly-analytics"
            aria-labelledby="weekly-analytics-title"
          >
            <div className="section-heading">
              <div>
                <h2 id="weekly-analytics-title">Seus compromissos semanais</h2>
                <p>Semanas que cruzam os últimos {range} dias</p>
              </div>
            </div>
            <div className="weekly-result" data-testid="analytics-weekly">
              <ResultCount result={summary.weekly} />
            </div>
            <p className="analytics-note">
              Uma meta conta uma vez por semana, inclusive quando a semana cruza
              dois meses. A semana atual está parcial. Estes resultados não
              entram no cumprimento diário.
            </p>
            <div className="current-week">
              <strong>Semana atual · parcial</strong>
              <span>{dates(weeks.current.from, weeks.current.through)}</span>
              <div>
                <span>
                  Diárias: {weeks.current.daily.done}/
                  {weeks.current.daily.total} ·{" "}
                  {pct(weeks.current.daily.percent)}
                </span>
                <span>
                  Semanais: {weeks.current.weekly.done}/
                  {weeks.current.weekly.total} ·{" "}
                  {pct(weeks.current.weekly.percent)}
                </span>
              </div>
            </div>
          </section>
          <section className="card category-breakdown">
            <h2>Onde você está florescendo</h2>
            <p className="muted">
              Metas diárias por área · últimos {range} dias
            </p>
            {summary.categories.map((item) => {
              const Icon = categoryIcons[item.category];
              return (
                <div className="category-progress" key={item.category}>
                  <span
                    className={`goal-category-icon ${categoryClasses[item.category]}`}
                  >
                    <Icon size={18} />
                  </span>
                  <div>
                    <div>
                      <strong>{item.category}</strong>
                      <span>
                        {item.done}/{item.total} · {pct(item.percent)}
                      </span>
                    </div>
                    <div
                      className={`tiny-progress ${categoryClasses[item.category]}`}
                    >
                      <span style={{ width: `${item.percent ?? 0}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
            <p className="analytics-note">
              Cada resultado mantém a categoria que a meta tinha naquele dia.
            </p>
          </section>
        </div>
      </div>
      <section
        className="card weekly-comparison"
        aria-labelledby="comparison-title"
      >
        <div className="section-heading">
          <div>
            <h2 id="comparison-title">Uma semana de cada vez</h2>
            <p>Comparação das duas últimas semanas encerradas</p>
          </div>
          <span className="category-tag lavender">Segunda a domingo</span>
        </div>
        <div className="week-comparison-grid">
          {[
            { label: "Semana anterior", week: weeks.older },
            { label: "Última semana encerrada", week: weeks.previous },
          ].map(({ label, week }) => (
            <div className="week-comparison-item" key={week.from}>
              <h3>{label}</h3>
              <span>{dates(week.from, week.through)}</span>
              <div>
                <span>Metas diárias</span>
                <ResultCount result={week.daily} />
              </div>
              <div>
                <span>Metas semanais</span>
                <ResultCount result={week.weekly} />
              </div>
            </div>
          ))}
          <div className="week-delta">
            <TrendingUp size={23} />
            <h3>Variação entre semanas</h3>
            <strong>{deltaText(weeks.dailyDelta)}</strong>
            <span>Metas diárias</span>
            <strong>{deltaText(weeks.weeklyDelta)}</strong>
            <span>Metas semanais</span>
          </div>
        </div>
        <p className="analytics-note">
          Só contam compromissos programados em cada semana. Antes do início de
          uma meta não existe obrigação; sem agenda, não há base para uma
          comparação.
        </p>
      </section>
      <section className="card monthly-evolution">
        <div className="section-heading">
          <div>
            <h2>Seu progresso, mês a mês</h2>
            <p>Metas diárias e de rotinas nos últimos seis meses</p>
          </div>
          <span className="category-tag mint">Mês atual parcial</span>
        </div>
        <ProgressChart data={months} monthly />
        <p className="analytics-note">
          O mês atual inclui apenas os dias até hoje. Cada mês usa a proporção
          entre todas as metas atingidas e programadas. As metas semanais ficam
          no resumo próprio para não serem divididas entre meses.
        </p>
      </section>
      <p className="analytics-footnote">
        A sequência conta dias com pelo menos uma conclusão diária. Folgas e
        descanso são ignorados; hoje em aberto não interrompe a sequência. Um
        dia anterior programado sem conclusão interrompe.
      </p>
    </div>
  );
}
