import { useMemo, useState } from "react";
import {
  Archive,
  ArrowRight,
  Award,
  CalendarDays,
  Check,
  Flag,
  Flame,
  Mountain,
  Palette,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Sprout,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import type {
  LongTermGoal,
  LongTermGoalFields,
  Preferences,
  Snapshot,
} from "../../shared/types";
import { encouragement, journeySummary, levels } from "../../shared/journey";
import {
  defaultPreferences,
  themeOptions,
  longTermPercent,
} from "../../shared/personalization";
import { categoryClasses, categoryIcons, formatDay } from "../goalPresentation";
import { LongTermGoalForm } from "./LongTermGoalForm";

const achievementIcons: Record<string, LucideIcon> = {
  sprout: Sprout,
  target: Target,
  flame: Flame,
  mountain: Mountain,
  calendar: CalendarDays,
  sparkles: Sparkles,
};
const quantity = (value: number) =>
  value.toLocaleString("pt-BR", { maximumFractionDigits: 20 });

export function JourneyOverview({
  snapshot,
  today,
  onOpen,
}: {
  snapshot: Snapshot;
  today: string;
  onOpen: () => void;
}) {
  const summary = journeySummary(snapshot, today);
  return (
    <section className="card journey-overview" aria-label="Seu caminho pessoal">
      <span className="journey-overview-icon">
        <Mountain size={26} />
      </span>
      <div>
        <span>
          Nível {summary.currentLevel.level} · {summary.currentLevel.name}
        </span>
        <strong>
          {quantity(summary.points)} XP{" "}
          <small>construídos com suas ações</small>
        </strong>
        {(snapshot.preferences ?? defaultPreferences).showEncouragement && (
          <p className="encouragement-text">{encouragement(snapshot, today)}</p>
        )}
      </div>
      <button className="text-button" onClick={onOpen}>
        Ver meu caminho <ArrowRight size={16} />
      </button>
    </section>
  );
}

export function JourneyPage({
  snapshot,
  today,
  busy,
  onPreferences,
  onSaveGoal,
  onArchive,
}: {
  snapshot: Snapshot;
  today: string;
  busy: boolean;
  onPreferences: (input: Preferences) => Promise<boolean>;
  onSaveGoal: (
    goal: LongTermGoal | null,
    fields: LongTermGoalFields,
    operationKey: string,
  ) => Promise<boolean>;
  onArchive: (id: string, archived: boolean) => Promise<boolean>;
}) {
  const [tab, setTab] = useState<"achievements" | "objectives" | "preferences">(
    "achievements",
  );
  const [archived, setArchived] = useState(false);
  const [editing, setEditing] = useState<LongTermGoal | null | false>(false);
  const summary = useMemo(
    () => journeySummary(snapshot, today),
    [snapshot, today],
  );
  const preferences = snapshot.preferences ?? defaultPreferences;
  const objectives = (snapshot.longTermGoals ?? []).filter(
    (goal) => Boolean(goal.archivedAt) === archived,
  );
  return (
    <div className="journey-page">
      <div
        className="journey-tabs"
        role="group"
        aria-label="Seções do meu caminho"
      >
        {[
          { id: "achievements", title: "Conquistas", icon: Award },
          { id: "objectives", title: "Objetivos de longo prazo", icon: Flag },
          { id: "preferences", title: "Personalizar", icon: Palette },
        ].map(({ id, title, icon: Icon }) => (
          <button
            key={id}
            aria-pressed={tab === id}
            className={tab === id ? "selected" : ""}
            onClick={() => setTab(id as typeof tab)}
          >
            <Icon size={17} />
            {title}
          </button>
        ))}
      </div>
      {tab === "achievements" && (
        <>
          <section className="card journey-level" aria-labelledby="level-title">
            <div className="level-emblem" aria-hidden="true">
              <Mountain size={48} />
              <span>{summary.currentLevel.level}</span>
            </div>
            <div className="level-copy">
              <span className="eyebrow">O CAMINHO É SEU</span>
              <h2 id="level-title">
                Nível {summary.currentLevel.level} · {summary.currentLevel.name}
              </h2>
              <p>Pequenas ações registradas, progresso de verdade.</p>
              <div className="level-points">
                <strong data-testid="journey-points">
                  {quantity(summary.points)} XP
                </strong>
                <span>
                  {summary.completed} compromissos atingidos no histórico
                </span>
              </div>
              <div
                className="journey-meter"
                role="progressbar"
                aria-label="Progresso para o próximo nível"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={summary.levelPercent}
              >
                <span style={{ width: `${summary.levelPercent}%` }} />
              </div>
              <p>
                {summary.nextLevel
                  ? `Faltam ${quantity(summary.nextLevel.points - summary.points)} XP para o nível ${summary.nextLevel.level} — ${summary.nextLevel.name}.`
                  : "Você alcançou todos os níveis definidos. Seu caminho continua nas suas próximas escolhas."}
              </p>
            </div>
          </section>
          <details className="card level-rules">
            <summary>Como os pontos e níveis funcionam</summary>
            <p>
              Cada compromisso elegível atingido vale <strong>10 XP</strong>.
              Uma meta semanal conta uma vez por semana. Descanso, dias futuros,
              eventos repetidos e progresso de objetivos de longo prazo não
              geram pontos.
            </p>
            <div className="level-thresholds">
              {levels.map((level) => (
                <div key={level.level}>
                  <span>Nível {level.level}</span>
                  <strong>{level.name}</strong>
                  <span>A partir de {quantity(level.points)} XP</span>
                </div>
              ))}
            </div>
            <p>
              Os pontos e as conquistas seguem seus registros atuais. Desmarcar
              ou corrigir um resultado recalcula os marcos; não existe bônus
              extra ao marcar de novo.
            </p>
          </details>
          <div className="section-heading journey-section-heading">
            <div>
              <h2>Marcos do seu caminho</h2>
              <p>
                Os critérios estão aqui. Cada conquista vem dos seus registros.
              </p>
            </div>
            <span className="category-tag lavender">
              {summary.achievements.filter((item) => item.achieved).length} de{" "}
              {summary.achievements.length}
            </span>
          </div>
          <div className="achievement-grid">
            {summary.achievements.map((achievement) => {
              const Icon = achievementIcons[achievement.icon];
              return (
                <article
                  className={`card achievement-card ${achievement.achieved ? "achieved" : ""}`}
                  key={achievement.id}
                  data-testid={`achievement-${achievement.id}`}
                >
                  <div className="achievement-heading">
                    <span className="achievement-icon">
                      <Icon size={25} />
                    </span>
                    <span className="achievement-status">
                      {achievement.achieved ? (
                        <>
                          <Check size={13} />
                          Conquistada
                        </>
                      ) : (
                        "Em construção"
                      )}
                    </span>
                  </div>
                  <h3>{achievement.title}</h3>
                  <p>{achievement.description}</p>
                  <div className="achievement-progress">
                    <div
                      className="journey-meter"
                      role="progressbar"
                      aria-label={`Progresso de ${achievement.title}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={achievement.percent}
                    >
                      <span style={{ width: `${achievement.percent}%` }} />
                    </div>
                    <span>
                      {Math.min(achievement.value, achievement.target)} de{" "}
                      {achievement.target} {achievement.unit}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
          <p className="journey-note">
            A melhor sequência guarda os dias de constância já alcançados.
            Folgas e descanso não a aumentam nem a interrompem; um dia encerrado
            programado sem conclusão interrompe a sequência daquele momento.
          </p>
        </>
      )}
      {tab === "objectives" && (
        <>
          <div className="page-toolbar">
            <div>
              <h2>Uma visão além de hoje</h2>
              <p className="muted">
                Objetivos maiores, com progresso informado por você.
              </p>
            </div>
            <button
              className="button primary"
              onClick={() => setEditing(null)}
              disabled={busy}
            >
              <Plus size={17} />
              Novo objetivo
            </button>
          </div>
          <div
            className="objective-filter"
            role="group"
            aria-label="Situação dos objetivos"
          >
            <button
              className={!archived ? "selected" : ""}
              aria-pressed={!archived}
              onClick={() => setArchived(false)}
            >
              Em acompanhamento
            </button>
            <button
              className={archived ? "selected" : ""}
              aria-pressed={archived}
              onClick={() => setArchived(true)}
            >
              Arquivados
            </button>
          </div>
          <p className="journey-note">
            Estes objetivos têm acompanhamento próprio e não alteram a
            porcentagem das metas diárias, pontos ou conquistas.
          </p>
          {objectives.length ? (
            <div className="objective-grid">
              {objectives.map((goal) => {
                const Icon = categoryIcons[goal.category];
                const percent = longTermPercent(goal);
                return (
                  <article className="card objective-card" key={goal.id}>
                    <div className="objective-header">
                      <span
                        className={`goal-category-icon ${categoryClasses[goal.category]}`}
                      >
                        <Icon size={20} />
                      </span>
                      <span className="objective-state">
                        {goal.archivedAt
                          ? "Arquivado"
                          : goal.current >= goal.target
                            ? "Concluído"
                            : goal.dueOn && goal.dueOn < today
                              ? "Prazo passado · ajuste seu plano"
                              : "Em andamento"}
                      </span>
                    </div>
                    <h3>{goal.title}</h3>
                    {goal.description && <p>{goal.description}</p>}
                    <div className="objective-values">
                      <strong>
                        {quantity(goal.current)}{" "}
                        <small>
                          / {quantity(goal.target)} {goal.unit}
                        </small>
                      </strong>
                      <span>{percent}%</span>
                    </div>
                    <div
                      className="journey-meter"
                      role="progressbar"
                      aria-label={`Progresso de ${goal.title}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={percent}
                    >
                      <span style={{ width: `${percent}%` }} />
                    </div>
                    <span className="objective-due">
                      <CalendarDays size={14} />
                      {goal.dueOn
                        ? `Prazo: ${formatDay(goal.dueOn, { day: "2-digit", month: "long", year: "numeric" })}`
                        : "Sem prazo definido"}
                    </span>
                    <div className="objective-actions">
                      {!goal.archivedAt && (
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() => setEditing(goal)}
                          aria-label={`Atualizar objetivo ${goal.title}`}
                        >
                          <Pencil size={15} />
                          Atualizar progresso
                        </button>
                      )}
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() =>
                          void onArchive(goal.id, !goal.archivedAt)
                        }
                        aria-label={`${goal.archivedAt ? "Reativar" : "Arquivar"} objetivo ${goal.title}`}
                      >
                        {goal.archivedAt ? (
                          <RotateCcw size={15} />
                        ) : (
                          <Archive size={15} />
                        )}
                        {goal.archivedAt ? "Reativar" : "Arquivar"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="card objective-empty">
              <Flag size={35} />
              <h3>
                {archived
                  ? "Nenhum objetivo arquivado"
                  : "Dê espaço ao seu próximo horizonte"}
              </h3>
              <p>
                {archived
                  ? "Objetivos arquivados continuam guardados para consulta e podem ser reativados."
                  : "Um livro de cada vez. Uma etapa do projeto. Escolha uma conquista maior e acompanhe seu avanço."}
              </p>
              {!archived && (
                <button
                  className="button secondary"
                  onClick={() => setEditing(null)}
                >
                  Criar meu primeiro objetivo
                </button>
              )}
            </div>
          )}
        </>
      )}
      {tab === "preferences" && (
        <section className="card journey-preferences">
          <div className="section-heading">
            <div>
              <h2>Seu espaço, suas cores</h2>
              <p>Escolha um tema para acompanhar seu caminho.</p>
            </div>
            <Palette size={24} />
          </div>
          <fieldset aria-disabled={busy} aria-busy={busy}>
            <legend>Tema do aplicativo</legend>
            <div className="theme-options">
              {themeOptions.map((theme) => (
                <label
                  className={`theme-option ${preferences.theme === theme.id ? "selected" : ""}`}
                  key={theme.id}
                >
                  <span
                    className="theme-preview"
                    style={{ background: theme.background }}
                    aria-hidden="true"
                  >
                    <i style={{ background: theme.surface }} />
                    <b style={{ background: theme.primary }} />
                    <i style={{ background: theme.surface }} />
                  </span>
                  <span>
                    <input
                      type="radio"
                      name="app-theme"
                      aria-label={theme.name}
                      aria-disabled={busy}
                      value={theme.id}
                      checked={preferences.theme === theme.id}
                      onChange={() => {
                        if (!busy)
                          void onPreferences({
                            ...preferences,
                            theme: theme.id,
                          });
                      }}
                    />
                    {theme.name}
                  </span>
                </label>
              ))}
            </div>
            <label className="encouragement-choice">
              <input
                type="checkbox"
                aria-label="Mostrar mensagens de incentivo"
                aria-disabled={busy}
                checked={preferences.showEncouragement}
                onChange={(event) => {
                  if (!busy)
                    void onPreferences({
                      ...preferences,
                      showEncouragement: event.target.checked,
                    });
                }}
              />
              <span>
                Mostrar mensagens de incentivo
                <small>
                  Exibe o texto de incentivo na visão geral e o cartão lateral.
                  As ações e seus resultados continuam disponíveis.
                </small>
              </span>
            </label>
          </fieldset>
          <p className="journey-note">
            Suas preferências são salvas neste computador e mantidas ao reabrir.
            Todos os temas usam fundos escuros, texto claro e foco visível.
          </p>
        </section>
      )}
      {editing !== false && (
        <LongTermGoalForm
          goal={editing}
          today={today}
          busy={busy}
          onClose={() => {
            if (!busy) setEditing(false);
          }}
          onSave={onSaveGoal}
        />
      )}
    </div>
  );
}
