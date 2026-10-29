import { contextBridge, ipcRenderer } from "electron";
import type { SkyAPI } from "../shared/types";

const api: SkyAPI = {
  load: () => ipcRenderer.invoke("sky:load"),
  createGoal: (input) => ipcRenderer.invoke("sky:create", input),
  updateGoal: (id, input) => ipcRenderer.invoke("sky:update", id, input),
  archiveGoal: (id) => ipcRenderer.invoke("sky:archive", id),
  deleteGoal: (id) => ipcRenderer.invoke("sky:delete", id),
  setStatus: (id, date, status) =>
    ipcRenderer.invoke("sky:status", id, date, status),
  addRoutine: (id, date) => ipcRenderer.invoke("sky:routine", id, date),
  startRoutine: (input) => ipcRenderer.invoke("sky:routine:start", input),
  updatePreferences: (input) => ipcRenderer.invoke("sky:preferences", input),
  createLongTermGoal: (input) =>
    ipcRenderer.invoke("sky:longterm:create", input),
  updateLongTermGoal: (id, input) =>
    ipcRenderer.invoke("sky:longterm:update", id, input),
  archiveLongTermGoal: (id, archived) =>
    ipcRenderer.invoke("sky:longterm:archive", id, archived),
  planRest: (date, note) => ipcRenderer.invoke("sky:rest", date, note),
  removeRest: (date) => ipcRenderer.invoke("sky:unrest", date),
  storageInfo: () => ipcRenderer.invoke("sky:info"),
  exportBackup: () => ipcRenderer.invoke("sky:export"),
  importBackup: () => ipcRenderer.invoke("sky:import"),
  openDataFolder: () => ipcRenderer.invoke("sky:data-folder"),
  openExternal: (url) => ipcRenderer.invoke("sky:external", url),
};
contextBridge.exposeInMainWorld("sky", api);
