import { useState } from "react";
import { Archive, History, Plus, Target, Trash2 } from "lucide-react";
import { categories, type Goal, type Snapshot } from "../../shared/types";
import { scheduleLabel } from "../../shared/schedule";
import {
  categoryClasses,
  categoryIcons,
  formatDay,
  frequencyNames,
} from "../goalPresentation";
export function GoalsPage({
  snapshot,
  today,
  desktop,
  busy,
  onCreate,
  onEdit,
  onArchive,
  onDelete,
  onHistory,
}: {
  snapshot: Snapshot;
  today: string;
  desktop: boolean;
  busy: boolean;
  onCreate: () => void;
  onEdit: (goal: Goal) => void;
  onArchive: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
  onHistory: (goal: Goal) => void;
}) {
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const active = snapshot.goals.filter(
    (goal) =>
      !goal.archivedOn &&
      (goal.frequency !== "once" || goal.startDate >= today),
  );
  const archived = snapshot.goals.filter((goal) => !!goal.archivedOn);
  const source = tab === "active" ? active : archived;
  const visible = source.filter(
    (goal) =>
      `${goal.title} ${goal.nextRevision?.title ?? ""}`
        .toLocaleLowerCase("pt-BR")
        .includes(search.toLocaleLowerCase("pt-BR")) &&
      (category === "all" || goal.category === category),
  );
  return (
    <>
      <div className="goals-summary">
        <span className="stat-icon mint">
          <Target size={24} />
        </span>
        <div>
          <strong>{active.length} metas no seu caminho</strong>
          <p>Programe os dias, cuide do seu ritmo e preserve cada conquista.</p>
        </div>
        <span className="category-tag lavender">Seu ritmo importa</span>
      </div>
      <div className="goal-management-toolbar">
        <div className="range-picker" role="group" aria-label="Exibir metas">
          <button
            aria-pressed={tab === "active"}
            className={tab === "active" ? "selected" : ""}
            onClick={() => setTab("active")}
          >
            Ativas ({active.length})
          </button>
          <button
            aria-pressed={tab === "archived"}
            className={tab === "archived" ? "selected" : ""}
            onClick={() => setTab("archived")}
          >
            Arquivadas ({archived.length})
          </button>
        </div>
        <div className="goal-search-controls">
          <select
            aria-label="Filtrar por categoria"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="all">Todas as categorias</option>
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <input
            className="search-input"
            aria-label="Buscar metas"
            placeholder="Buscar uma meta…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>
      <div className="managed-goals">
        {visible.map((goal) => {
          const Icon = categoryIcons[goal.category];
          return (
            <article className="card managed-goal" key={goal.id}>
              <div className="managed-top">
                <span className={`stat-icon ${categoryClasses[goal.category]}`}>
                  <Icon size={23} />
                </span>
                <span className="frequency-tag">
                  {frequencyNames[goal.frequency]}
                </span>
              </div>
              <h3>{goal.title}</h3>
              <p>
                {goal.description ||
                  "Um pequeno compromisso para chegar mais perto de quem você quer ser."}
              </p>
              <div className="goal-schedule">
                <strong>
                  {scheduleLabel(goal.frequency, goal.weekdayMask)}
                </strong>
                <span>
                  {goal.archivedOn
                    ? "Arquivada em "
                    : goal.startDate > today
                      ? "Começa em "
                      : "Desde "}
                  {formatDay(goal.archivedOn ?? goal.startDate, {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
              {goal.nextRevision &&
                goal.nextRevision.effectiveFrom !== goal.startDate && (
                  <div className="pending-revision">
                    {goal.archivedOn
                      ? "Planejamento não aplicado:"
                      : "Próxima versão:"}{" "}
                    {goal.nextRevision.title}
                    <br />
                    {frequencyNames[goal.nextRevision.frequency]} ·{" "}
                    {goal.nextRevision.category} ·{" "}
                    {scheduleLabel(
                      goal.nextRevision.frequency,
                      goal.nextRevision.weekdayMask,
                    )}
                    <br />A partir de{" "}
                    {formatDay(goal.nextRevision.effectiveFrom, {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </div>
                )}
              <div className="managed-footer">
                <span
                  className={`category-tag ${categoryClasses[goal.category]}`}
                >
                  {goal.category}
                </span>
                <button
                  aria-label={`Histórico de ${goal.title}`}
                  onClick={() => onHistory(goal)}
                >
                  <History size={15} />
                  <span>Histórico</span>
                </button>
                {!goal.archivedOn && (
                  <button
                    disabled={busy || !desktop || goal.frequency === "once"}
                    onClick={() => onEdit(goal)}
                  >
                    Editar
                  </button>
                )}
              </div>
              <div className="goal-management-actions">
                {!goal.archivedOn && (
                  <button
                    disabled={busy || !desktop}
                    aria-label={`Arquivar ${goal.title}`}
                    onClick={() => onArchive(goal)}
                  >
                    <Archive size={15} />
                    Arquivar
                  </button>
                )}
                {goal.canDelete && desktop ? (
                  <button
                    className="delete-goal-button"
                    disabled={busy}
                    aria-label={`Excluir ${goal.title}`}
                    onClick={() => onDelete(goal)}
                  >
                    <Trash2 size={15} />
                    Excluir
                  </button>
                ) : (
                  desktop && (
                    <span className="preserved-history">
                      Histórico preservado
                    </span>
                  )
                )}
              </div>
            </article>
          );
        })}
      </div>
      {!visible.length && (
        <div className="card empty-state">
          <Target size={36} />
          <h2>
            {source.length
              ? "Nenhuma meta encontrada"
              : tab === "archived"
                ? "Espaço para novos caminhos"
                : "Qual é o seu próximo passo?"}
          </h2>
          <p>
            {source.length
              ? "Ajuste a busca ou a categoria para encontrar sua meta."
              : tab === "archived"
                ? "As metas que você arquivar continuam disponíveis aqui, com seu histórico."
                : "Escolha uma meta diária ou semanal e os dias que fazem sentido para você."}
          </p>
          {tab === "active" && !source.length && (
            <button className="button primary" onClick={onCreate}>
              <Plus size={17} />
              Criar primeira meta
            </button>
          )}
        </div>
      )}
    </>
  );
}
