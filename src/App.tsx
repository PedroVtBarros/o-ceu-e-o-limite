import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  CloudUpload,
  Database,
  Dumbbell,
  Flame,
  LayoutDashboard,
  Leaf,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Mountain,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import { dailySeries } from "../shared/analytics";
import { EvolutionPage } from "./components/EvolutionPage";
import { ProgressChart } from "./components/ProgressCharts";
import { RoutinePreview } from "./components/RoutinePreview";
import { RoutinesPage } from "./components/RoutinesPage";
import { JourneyPage, JourneyOverview } from "./components/JourneyPage";
import { defaultPreferences } from "../shared/personalization";
import { StoragePanel } from "./components/StoragePanel";
import { api } from "./api";
import { dailySummary, isClosed } from "../shared/checklist";
import { DailyProgress } from "./components/ProgressSummary";
import { DailyChecklist } from "./components/DailyChecklist";
import { RestPlanner } from "./components/RestPlanner";
import { ResultCorrection, OutcomeHistory } from "./components/OutcomeDialogs";
import { Modal } from "./components/Modal";
import { GoalForm } from "./components/GoalForm";
import { GoalsPage } from "./components/GoalsPage";
import { GoalHistory } from "./components/GoalHistory";
import { formatDay } from "./goalPresentation";
import {
  type Category,
  type Goal,
  type Snapshot,
  type Status,
  type StorageInfo,
  type RoutineRunInput,
} from "../shared/types";
import { dateKey, opportunities, shiftDate, streak } from "../shared/domain";
import { routines, type Routine } from "../shared/routines";

type Page = "dashboard" | "goals" | "routines" | "evolution" | "journey";
const pageNames: Record<Page, string> = {
  dashboard: "Visão geral",
  goals: "Minhas metas",
  routines: "Rotinas para inspirar",
  evolution: "Minha evolução",
  journey: "Meu caminho",
};
function Landscape({ small = false }: { small?: boolean }) {
  return (
    <svg
      className={small ? "landscape small" : "landscape"}
      viewBox="0 0 430 250"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="308" cy="65" r="37" fill="#ECCD83" />
      <path
        d="M17 91h54a13 13 0 0 0-24-7 17 17 0 0 0-30 7ZM337 119h66a12 12 0 0 0-22-7 19 19 0 0 0-38-1"
        fill="#fff"
        opacity=".65"
      />
      <path d="m108 245 121-167 140 167" fill="#9DBAB0" />
      <path d="m179 146 50-68 56 68-36-15-17 12-18-10z" fill="#EAF0E6" />
      <path d="m233 250 116-117 106 117" fill="#709B8D" />
      <path d="m-26 250 155-120 148 120" fill="#527F70" />
      <path
        d="m169 247 61-46-33-15 27-19-10-24"
        stroke="#F3DDAC"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path
        d="M228 80V41"
        stroke="#466C60"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="m230 41 34 9-34 10" fill="#DC8065" />
      <path d="M14 245h425" stroke="#527F70" strokeWidth="2" />
      <path
        d="m358 210 8-29 8 29h-6v16h-5v-16ZM87 217l6-23 7 23h-5v12h-4v-12Z"
        fill="#386C5D"
      />
      <path d="m120 54 3-7 3 7 7 3-7 3-3 7-3-7-7-3z" fill="#B1C8B5" />
    </svg>
  );
}

export function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [snapshot, setSnapshot] = useState<Snapshot>({
    goals: [],
    entries: [],
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [today, setToday] = useState(dateKey());
  const [selectedDate, setSelectedDate] = useState(dateKey());
  const [filter, setFilter] = useState<"daily" | "weekly">("daily");
  const [goalModal, setGoalModal] = useState<false | Goal | null>(false);
  const [routineModal, setRoutineModal] = useState<Routine | null>(null);
  const [archiveModal, setArchiveModal] = useState<Goal | null>(null);
  const [deleteModal, setDeleteModal] = useState<Goal | null>(null);
  const [historyModal, setHistoryModal] = useState<Goal | null>(null);
  const [storageModal, setStorageModal] = useState(false);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    error?: boolean;
  } | null>(null);
  const [restModal, setRestModal] = useState(false);
  const [correction, setCorrection] = useState<{
    goal: Goal;
    date: string;
    status: Status;
  } | null>(null);
  const [outcomeLog, setOutcomeLog] = useState<{
    goal: Goal;
    date: string;
  } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mutating = useRef(false);
  const currentDay = useRef(today);
  const preferences = snapshot.preferences ?? defaultPreferences;
  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
  }, [preferences.theme]);

  const notify = (message: string, error = false) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, error });
    toastTimer.current = setTimeout(() => setToast(null), 5500);
  };
  async function load() {
    setLoading(true);
    setLoadError("");
    try {
      const [data, info] = await Promise.all([api.load(), api.storageInfo()]);
      setSnapshot(data);
      setStorage(info);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar seus dados.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);
  useEffect(() => {
    const update = () => {
      if (mutating.current) return;
      const next = dateKey();
      if (currentDay.current === next) return;
      const previous = currentDay.current;
      currentDay.current = next;
      setToday(next);
      setSelectedDate((current) => (current === previous ? next : current));
      void load();
    };
    const timer = setInterval(update, 30000);
    window.addEventListener("focus", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, []);
  async function mutate(
    action: () => Promise<Snapshot | null>,
    message?: string,
    throwOnError = false,
  ): Promise<boolean> {
    if (mutating.current) return false;
    mutating.current = true;
    setBusy(true);
    try {
      const data = await action();
      if (data) {
        setSnapshot(data);
        if (message) notify(message);
      }
      return true;
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message.replace(
              /^Error invoking remote method '[^']+': (Error: )?/,
              "",
            )
          : "Não foi possível salvar. Tente novamente.",
        true,
      );
      if (throwOnError) throw error;
      return false;
    } finally {
      mutating.current = false;
      setBusy(false);
    }
  }
  async function backupOperation<T>(action: () => Promise<T>): Promise<T> {
    if (mutating.current)
      throw new Error("Aguarde a gravação em andamento para cuidar do backup.");
    mutating.current = true;
    setBusy(true);
    try {
      return await action();
    } finally {
      mutating.current = false;
      setBusy(false);
    }
  }
  const summary = dailySummary(snapshot, today, today);
  const last7 = opportunities(snapshot, shiftDate(today, -6), today);
  const weeklyDone = last7.filter((item) => item.status === "done").length;
  const consecutive = streak(snapshot, today);
  const navigate = (next: Page) => {
    setPage(next);
  };
  const actionDate = (goal: Goal, date: string) =>
    goal.frequency === "weekly" && !isClosed(goal, date, today)
      ? today
      : goal.startDate > date
        ? goal.startDate
        : date;
  const changeStatus = (goal: Goal, status: Status) => {
    if (selectedDate > today) return;
    if (isClosed(goal, selectedDate, today)) {
      if (storage?.mode !== "desktop") {
        notify(
          "Abra o aplicativo desktop para corrigir resultados com histórico preservado.",
          true,
        );
        return;
      }
      setCorrection({ goal, date: selectedDate, status });
    } else
      void mutate(
        () => api.setStatus(goal.id, actionDate(goal, selectedDate), status),
        status === "done" ? "Mais um passo dado. Boa conquista! ✨" : undefined,
      );
  };
  const onRoutine = async (input: RoutineRunInput) => {
    if (
      await mutate(
        () => api.startRoutine(input),
        "Experiência adicionada. Seu dia, seu ritmo!",
        true,
      )
    ) {
      setRoutineModal(null);
      setSelectedDate(input.startsOn);
      setPage("dashboard");
      setFilter("daily");
    }
  };
  const onSource = (url: string) => {
    void api
      .openExternal(url)
      .catch(() => notify("Não foi possível abrir a fonte.", true));
  };
  const reviewDay = (date: string) => {
    setSelectedDate(date);
    setFilter("daily");
    navigate("dashboard");
    window.scrollTo(0, 0);
  };

  return (
    <div className="app-shell min-h-screen bg-sky-background text-sky-text">
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => navigate("dashboard")}
          aria-label="O céu é o limite, início"
        >
          <span className="brand-mark">
            <CloudUpload size={29} strokeWidth={1.7} />
          </span>
          <span>
            o céu é<br />
            <strong>o limite.</strong>
          </span>
        </button>
        <span className="sidebar-label">SEU ESPAÇO</span>
        <nav>
          {(
            [
              { id: "dashboard", icon: LayoutDashboard },
              { id: "goals", icon: Target },
              { id: "routines", icon: Sparkles },
              { id: "evolution", icon: BarChart3 },
              { id: "journey", icon: Mountain },
            ] as { id: Page; icon: LucideIcon }[]
          ).map(({ id, icon: Icon }) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              onClick={() => navigate(id)}
            >
              <Icon size={20} strokeWidth={1.8} />
              <span>{pageNames[id]}</span>
              {page === id && <i />}
            </button>
          ))}
        </nav>
        {preferences.showEncouragement && (
          <div className="sidebar-inspiration">
            <span className="tiny-spark">
              <Sparkles size={18} />
            </span>
            <h3>
              Seu único limite
              <br />é o próximo passo.
            </h3>
            <p>
              Um pouco melhor,
              <br />
              um dia de cada vez.
            </p>
            <Landscape small />
          </div>
        )}
        <div className="sidebar-bottom">
          <button onClick={() => setStorageModal(true)}>
            <Database size={18} />
            Meus dados e backups
          </button>
          <button onClick={() => setHelp(true)}>
            <CircleHelp size={18} />
            Como funciona
          </button>
          <div className="local-status">
            <span />
            {storage?.mode === "browser"
              ? "Prévia no navegador"
              : "Seu espaço. Só seu."}
            <small>
              {storage?.mode === "browser"
                ? "Salvo neste navegador"
                : "Salvo neste computador"}
            </small>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            Meu espaço <ChevronRight size={14} />
            <span>{pageNames[page]}</span>
          </div>
          <div className="topbar-right">
            <span className="today-label">
              {formatDay(today, {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            <span className="topbar-divider" />
            <span className="profile-avatar" title="Seu espaço pessoal">
              V<span />
            </span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span />
                {page === "dashboard"
                  ? "DISCIPLINA HOJE. EVOLUÇÃO SEMPRE."
                  : "CONSTRUA O SEU PRÓPRIO CAMINHO"}
              </div>
              <h1>
                {page === "dashboard" ? "Continue evoluindo" : pageNames[page]}
                <span className="title-dot">.</span>
              </h1>
              <p>
                {page === "dashboard"
                  ? "Pequenos passos de hoje. Grandes conquistas de amanhã."
                  : page === "goals"
                    ? "Dê direção aos seus sonhos. Uma meta de cada vez."
                    : page === "routines"
                      ? "Grandes histórias começam com pequenos hábitos. Encontre sua inspiração."
                      : page === "journey"
                        ? "Reconheça seu progresso. Planeje o que vem pela frente."
                        : "Olhe para o quanto você já caminhou. Cada passo conta."}
              </p>
            </div>
            {page !== "journey" && (
              <button
                className="button primary"
                onClick={() => setGoalModal(null)}
                disabled={loading || !!loadError}
              >
                <Plus size={18} />
                Nova meta
              </button>
            )}
          </div>
          {loading ? (
            <div className="loading-state">
              <CloudUpload size={38} />
              <p>Preparando o seu espaço…</p>
            </div>
          ) : loadError ? (
            <div className="card load-error">
              <Database size={32} />
              <h2>Seus dados precisam de atenção</h2>
              <p>{loadError}</p>
              <button className="button primary" onClick={() => void load()}>
                Tentar novamente
              </button>
            </div>
          ) : (
            <>
              {page === "dashboard" && (
                <>
                  {snapshot.goals.length === 0 && (
                    <section className="hero-banner">
                      <div className="hero-copy">
                        <span className="hero-pill">
                          <Sparkles size={13} />
                          SEU FUTURO ESTÁ EM CONSTRUÇÃO
                        </span>
                        <h2>
                          Você não precisa chegar
                          <br />
                          lá de uma vez.
                        </h2>
                        <p>
                          Só precisa dar o próximo passo.
                          <br />
                          Vamos fazer de hoje um bom começo?
                        </p>
                        <button
                          onClick={() =>
                            document
                              .querySelector(".goals-panel")
                              ?.scrollIntoView({
                                behavior: "smooth",
                                block: "center",
                              })
                          }
                        >
                          Vamos às suas metas <ArrowRight size={16} />
                        </button>
                      </div>
                      <Landscape />
                      <span className="hero-caption">
                        O horizonte é só o começo.
                      </span>
                    </section>
                  )}
                  <div className="stats-grid">
                    <div className="stat-card">
                      <span className="stat-icon mint">
                        <CheckCheck size={22} />
                      </span>
                      <div>
                        <span>Metas de hoje</span>
                        <strong>
                          {summary.state === "rest" ? (
                            "Descanso"
                          ) : summary.state === "empty" ? (
                            "Sem metas"
                          ) : (
                            <>
                              {summary.done}
                              <small> / {summary.total}</small>
                            </>
                          )}
                        </strong>
                        <p>
                          {summary.total
                            ? `${summary.pending} ${summary.pending === 1 ? "aguardando seu próximo passo" : "ainda podem acontecer"}`
                            : "Um espaço para suas conquistas"}
                        </p>
                      </div>
                    </div>
                    <div className="stat-card">
                      <span className="stat-icon peach">
                        <Flame size={22} />
                      </span>
                      <div>
                        <span>Dias em movimento</span>
                        <strong>
                          {consecutive}
                          <small> {consecutive === 1 ? "dia" : "dias"}</small>
                        </strong>
                        <p>
                          {consecutive
                            ? "Continue construindo sua constância"
                            : "Sua sequência começa com um passo"}
                        </p>
                      </div>
                    </div>
                    <div className="stat-card">
                      <span className="stat-icon lavender">
                        <Trophy size={22} />
                      </span>
                      <div>
                        <span>Conquistas em 7 dias</span>
                        <strong>
                          {weeklyDone}
                          <small> metas</small>
                        </strong>
                        <p>Cada uma delas fez a diferença</p>
                      </div>
                    </div>
                  </div>
                  <JourneyOverview
                    snapshot={snapshot}
                    today={today}
                    onOpen={() => navigate("journey")}
                  />
                  <div className="dashboard-columns">
                    <div className="dashboard-main">
                      <DailyProgress
                        snapshot={snapshot}
                        date={selectedDate}
                        today={today}
                      />
                      <DailyChecklist
                        snapshot={snapshot}
                        date={selectedDate}
                        today={today}
                        filter={filter}
                        busy={busy}
                        desktop={storage?.mode === "desktop"}
                        onDate={setSelectedDate}
                        onFilter={setFilter}
                        onCreate={() => setGoalModal(null)}
                        onAction={changeStatus}
                        onInspect={(goal) =>
                          setOutcomeLog({ goal, date: selectedDate })
                        }
                        onRest={() => setRestModal(true)}
                      />
                    </div>
                    <div className="dashboard-aside">
                      <section className="card evolution-preview">
                        <div className="section-heading">
                          <div>
                            <h2>Um pouco melhor a cada dia</h2>
                            <p>Suas metas diárias nos últimos 7 dias</p>
                          </div>
                          <span className="soft-icon">
                            <TrendingUp size={21} />
                          </span>
                        </div>
                        <ProgressChart
                          data={dailySeries(
                            snapshot,
                            shiftDate(today, -6),
                            today,
                            today,
                          )}
                          compact
                        />
                        <div className="chart-note">
                          <span className="legend-dot" />
                          Sua constância ganha forma aqui.
                        </div>
                        <button
                          className="panel-link"
                          onClick={() => navigate("evolution")}
                        >
                          Ver minha evolução
                          <ArrowUpRight size={16} />
                        </button>
                      </section>
                      <section className="routine-feature">
                        <span className="eyebrow">
                          <Sparkles size={14} />
                          INSPIRE-SE PARA IR ALÉM
                        </span>
                        <h2>
                          Um dia na rotina
                          <br />
                          de quem te inspira.
                        </h2>
                        <p>
                          Experimente novos hábitos.
                          <br />
                          Descubra o que funciona para você.
                        </p>
                        <div className="featured-person">
                          <span className="person-art">
                            <Dumbbell size={32} strokeWidth={1.5} />
                          </span>
                          <div>
                            <strong>Ilia Topuria</strong>
                            <span>Disciplina & constância</span>
                          </div>
                          <span className="person-star">✧</span>
                        </div>
                        <button onClick={() => setRoutineModal(routines[0])}>
                          Conhecer a rotina
                          <ArrowUpRight size={17} />
                        </button>
                      </section>
                    </div>
                  </div>
                </>
              )}
              {page === "goals" && (
                <GoalsPage
                  snapshot={snapshot}
                  today={today}
                  desktop={storage?.mode === "desktop"}
                  busy={busy}
                  onCreate={() => setGoalModal(null)}
                  onEdit={setGoalModal}
                  onArchive={(goal) => {
                    setToast(null);
                    setArchiveModal(goal);
                  }}
                  onDelete={(goal) => {
                    setToast(null);
                    setDeleteModal(goal);
                  }}
                  onHistory={setHistoryModal}
                />
              )}
              {page === "routines" && (
                <RoutinesPage
                  snapshot={snapshot}
                  today={today}
                  onChoose={setRoutineModal}
                  onReview={reviewDay}
                  onSource={onSource}
                />
              )}
              {page === "journey" && (
                <JourneyPage
                  snapshot={snapshot}
                  today={today}
                  busy={busy}
                  onPreferences={(input) =>
                    mutate(
                      () => api.updatePreferences(input),
                      "Seu espaço foi atualizado.",
                    )
                  }
                  onSaveGoal={(goal, fields, operationKey) =>
                    mutate(
                      () =>
                        goal
                          ? api.updateLongTermGoal(goal.id, fields)
                          : api.createLongTermGoal({ ...fields, operationKey }),
                      "Objetivo salvo. Um horizonte de cada vez.",
                      true,
                    )
                  }
                  onArchive={(id, archived) =>
                    mutate(
                      () => api.archiveLongTermGoal(id, archived),
                      archived
                        ? "Objetivo arquivado. Seu progresso continua guardado."
                        : "Objetivo reativado.",
                    )
                  }
                />
              )}
              {page === "evolution" && (
                <EvolutionPage
                  snapshot={snapshot}
                  today={today}
                  onReview={(date) => {
                    setSelectedDate(date);
                    setFilter("daily");
                    navigate("dashboard");
                    window.scrollTo(0, 0);
                  }}
                />
              )}
            </>
          )}
          <footer className="main-footer">
            <span>Feito para o seu próximo passo.</span>
            <span>
              o céu é o limite <Sparkles size={13} />
            </span>
          </footer>
        </main>
      </div>
      {restModal && (
        <RestPlanner
          snapshot={snapshot}
          initialDate={selectedDate}
          today={today}
          busy={busy}
          onClose={() => {
            if (!busy) setRestModal(false);
          }}
          onSave={async (date, note) => {
            if (
              await mutate(
                () => api.planRest(date, note),
                "Descanso planejado. Um espaço para recuperar as energias.",
                true,
              )
            ) {
              setSelectedDate(date);
              setRestModal(false);
            }
          }}
          onRemove={async (date) => {
            if (
              await mutate(
                () => api.removeRest(date),
                "Programação do dia restaurada.",
                true,
              )
            ) {
              setSelectedDate(date);
              setRestModal(false);
            }
          }}
        />
      )}
      {correction && (
        <ResultCorrection
          goal={correction.goal}
          date={correction.date}
          initialStatus={correction.status}
          snapshot={snapshot}
          today={today}
          busy={busy}
          onClose={() => {
            if (!busy) setCorrection(null);
          }}
          onSave={async (status) => {
            if (
              await mutate(
                () =>
                  api.setStatus(
                    correction.goal.id,
                    actionDate(correction.goal, correction.date),
                    status,
                  ),
                "Correção salva no histórico.",
                true,
              )
            )
              setCorrection(null);
          }}
        />
      )}
      {outcomeLog && (
        <OutcomeHistory
          goal={outcomeLog.goal}
          date={outcomeLog.date}
          snapshot={snapshot}
          onClose={() => setOutcomeLog(null)}
        />
      )}
      {goalModal !== false && (
        <GoalForm
          goal={goalModal}
          today={today}
          hasOccurrences={
            snapshot.occurrences?.some(
              (item) => item.goalId === goalModal?.id,
            ) ?? false
          }
          busy={busy}
          onClose={() => {
            if (!busy) setGoalModal(false);
          }}
          onSave={async (input) => {
            const success = await mutate(
              () =>
                goalModal
                  ? api.updateGoal(goalModal.id, {
                      title: input.title,
                      description: input.description,
                      category: input.category,
                      frequency:
                        input.frequency === "weekly" ? "weekly" : "daily",
                      weekdayMask: input.weekdayMask,
                      effectiveFrom: input.effectiveFrom,
                    })
                  : api.createGoal(input),
              goalModal
                ? "Nova versão programada. Seu histórico foi preservado."
                : "Meta criada. Um novo passo começa aqui!",
              true,
            );
            if (success) setGoalModal(false);
          }}
        />
      )}
      {routineModal && (
        <RoutinePreview
          routine={routineModal}
          snapshot={snapshot}
          today={today}
          busy={busy}
          onSave={onRoutine}
          onSource={onSource}
          onClose={() => {
            if (!busy) setRoutineModal(null);
          }}
        />
      )}
      {historyModal && (
        <GoalHistory
          goal={historyModal}
          snapshot={snapshot}
          today={today}
          onClose={() => setHistoryModal(null)}
        />
      )}
      {deleteModal && (
        <Modal
          title="Excluir esta meta?"
          subtitle={deleteModal.title}
          onClose={() => {
            if (!busy) setDeleteModal(null);
          }}
        >
          <p className="modal-body-copy">
            Esta meta ainda não possui resultados registrados. A exclusão remove
            sua programação e suas versões. Essa ação não pode ser desfeita.
          </p>
          {toast?.error && (
            <p className="form-error" role="alert">
              {toast.message}
            </p>
          )}
          <div className="modal-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setDeleteModal(null)}
            >
              Cancelar
            </button>
            <button
              className="button danger"
              disabled={busy}
              onClick={async () => {
                if (
                  await mutate(
                    () => api.deleteGoal(deleteModal.id),
                    "Meta excluída.",
                  )
                )
                  setDeleteModal(null);
              }}
            >
              Excluir definitivamente
            </button>
          </div>
        </Modal>
      )}
      {archiveModal && (
        <Modal
          title="Dar espaço para novos caminhos?"
          subtitle={`A meta “${archiveModal.title}” será arquivada.`}
          onClose={() => {
            if (!busy) setArchiveModal(null);
          }}
        >
          <p className="modal-body-copy">
            Ela deixa de gerar novos compromissos. Os períodos anteriores e os
            resultados que você já registrou continuam no histórico. Se este
            período já foi avaliado, ele permanece no resumo, mesmo que o
            resultado tenha sido desmarcado depois.
          </p>
          {toast?.error && (
            <p className="form-error" role="alert">
              {toast.message}
            </p>
          )}
          <div className="modal-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setArchiveModal(null)}
            >
              Manter meta
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={async () => {
                if (
                  await mutate(
                    () => api.archiveGoal(archiveModal.id),
                    "Meta arquivada. Espaço para novos passos.",
                  )
                )
                  setArchiveModal(null);
              }}
            >
              Arquivar meta
            </button>
          </div>
        </Modal>
      )}
      {storageModal && (
        <StoragePanel
          storage={storage}
          busy={busy || loading}
          onClose={() => {
            if (!busy) setStorageModal(false);
          }}
          onExport={() => backupOperation(() => api.exportBackup())}
          onRestore={() =>
            backupOperation(async () => {
              const result = await api.importBackup();
              if (result) {
                setSnapshot(result.snapshot);
                const day = dateKey();
                currentDay.current = day;
                setToday(day);
                setSelectedDate(day);
                setFilter("daily");
              }
              return result;
            })
          }
          onOpenFolder={() => backupOperation(() => api.openDataFolder())}
        />
      )}
      {help && (
        <Modal
          title="Pequenos passos, grandes possibilidades"
          subtitle="Um espaço simples para construir sua constância."
          onClose={() => setHelp(false)}
        >
          <div className="help-steps">
            {[
              [
                "Crie uma meta possível",
                "Escolha uma meta diária ou semanal. Seja específico sobre o que quer fazer.",
              ],
              [
                "Olhe para o seu dia",
                "Use ✓ para marcar uma conquista ou × quando não atingir. Clique de novo para voltar a pendente. O calendário permite revisar dias anteriores.",
              ],
              [
                "Acompanhe seu caminho",
                "O progresso do dia considera metas diárias e rotinas. Metas semanais têm um resultado de segunda a domingo e aparecem uma vez nos totais da evolução.",
              ],
              [
                "Experimente algo novo",
                "Escolha uma inspiração, personalize as atividades e defina quando experimentar. O padrão é só hoje. Consulte suas cópias e resultados em Minhas experiências.",
              ],
              [
                "Continue no seu ritmo",
                "A sequência conta dias com pelo menos uma meta diária ou de rotina atingida. Você ainda pode completar hoje para continuar a sequência de ontem.",
              ],
            ].map(([title, text], index) => (
              <div key={title}>
                <span>{index + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="modal-actions">
            <button className="button primary" onClick={() => setHelp(false)}>
              Pronto para o próximo passo
              <ArrowRight size={17} />
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div
          className={`toast ${toast.error ? "error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? <CircleHelp size={19} /> : <Check size={19} />}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} aria-label="Fechar aviso">
            <X size={17} />
          </button>
        </div>
      )}
    </div>
  );
}
