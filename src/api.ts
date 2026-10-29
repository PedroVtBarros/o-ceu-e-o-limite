import type { SkyAPI, Snapshot, GoalInput } from "../shared/types";
import { dateKey, periodFor, scheduled } from "../shared/domain";
import { routines } from "../shared/routines";
import { validatePreferences } from "../shared/personalization";

declare global {
  interface Window {
    sky?: SkyAPI;
  }
}

// The browser preview uses IndexedDB. The distributed desktop app always uses SQLite.
function browserAPI(): SkyAPI {
  const opened = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("o-ceu-e-o-limite", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("state");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error("Não foi possível abrir os dados neste navegador."));
  });
  async function load(): Promise<Snapshot> {
    const db = await opened;
    return new Promise((resolve, reject) => {
      const request = db
        .transaction("state")
        .objectStore("state")
        .get("snapshot");
      request.onsuccess = () =>
        resolve(request.result ?? { goals: [], entries: [] });
      request.onerror = () => reject(request.error);
    });
  }
  async function change(fn: (snapshot: Snapshot) => void): Promise<Snapshot> {
    const db = await opened;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("state", "readwrite");
      const storage = transaction.objectStore("state");
      const request = storage.get("snapshot");
      let state: Snapshot;
      request.onsuccess = () => {
        state = request.result ?? { goals: [], entries: [] };
        try {
          fn(state);
          storage.put(state, "snapshot");
        } catch (error) {
          transaction.abort();
          reject(error);
        }
      };
      transaction.oncomplete = () => resolve(state);
      transaction.onerror = () => reject(transaction.error);
    });
  }
  const insert = (state: Snapshot, input: GoalInput) =>
    state.goals.push({
      ...input,
      id: crypto.randomUUID(),
      archivedOn: null,
      routineId: input.routineId ?? null,
    });
  return {
    load,
    createGoal: (input) =>
      change((state) => {
        insert(state, input);
      }),
    updateGoal: async () => {
      throw new Error(
        "Abra o aplicativo desktop para editar metas com histórico preservado.",
      );
    },
    deleteGoal: async () => {
      throw new Error(
        "Abra o aplicativo desktop para excluir metas com verificação do histórico.",
      );
    },
    archiveGoal: (id) =>
      change((state) => {
        const goal = state.goals.find((goal) => goal.id === id);
        if (goal) goal.archivedOn = dateKey();
      }),
    setStatus: (id, date, status) =>
      change((state) => {
        const goal = state.goals.find((goal) => goal.id === id);
        if (!goal || !scheduled(goal, date) || date > dateKey())
          throw new Error("Meta indisponível nessa data.");
        const period = periodFor(goal, date);
        state.entries = state.entries.filter(
          (entry) => entry.goalId !== id || entry.period !== period,
        );
        if (status !== "pending")
          state.entries.push({ goalId: id, period, status });
      }),
    addRoutine: (id, date) =>
      change((state) => {
        const routine = routines.find((item) => item.id === id);
        if (!routine) throw new Error("Rotina não encontrada.");
        if (
          state.goals.some(
            (goal) => goal.routineId === id && goal.startDate === date,
          )
        )
          throw new Error("Esta rotina já foi adicionada nesse dia.");
        routine.goals.forEach((goal) =>
          insert(state, {
            ...goal,
            frequency: "once",
            startDate: date,
            routineId: id,
          }),
        );
      }),
    startRoutine: async () => {
      throw new Error(
        "Abra o aplicativo desktop para salvar experiências personalizadas e acompanhar seu histórico.",
      );
    },
    updatePreferences: (input) =>
      change((state) => {
        state.preferences = validatePreferences(input);
      }),
    createLongTermGoal: async () => {
      throw new Error(
        "Abra o aplicativo desktop para guardar seus objetivos de longo prazo.",
      );
    },
    updateLongTermGoal: async () => {
      throw new Error(
        "Abra o aplicativo desktop para atualizar seus objetivos de longo prazo.",
      );
    },
    archiveLongTermGoal: async () => {
      throw new Error(
        "Abra o aplicativo desktop para organizar seus objetivos de longo prazo.",
      );
    },
    storageInfo: async () => ({
      mode: "browser",
      path: "Dados salvos neste navegador. No aplicativo desktop, seus dados ficam em um banco SQLite no computador.",
    }),
    planRest: async () => {
      throw new Error(
        "Abra o aplicativo desktop para planejar descansos com histórico preservado.",
      );
    },
    removeRest: async () => {
      throw new Error(
        "Abra o aplicativo desktop para alterar o descanso planejado.",
      );
    },
    exportBackup: async () => {
      throw new Error("Abra a versão desktop para exportar seu banco SQLite.");
    },
    importBackup: async () => {
      throw new Error("Abra a versão desktop para restaurar um backup SQLite.");
    },
    openDataFolder: async () => {
      throw new Error(
        "Abra a versão desktop para consultar a pasta do banco SQLite.",
      );
    },
    openExternal: async (url) => {
      if (routines.some((routine) => routine.sourceUrl === url))
        window.open(url, "_blank", "noopener,noreferrer");
    },
  };
}
export const api = window.sky ?? browserAPI();
