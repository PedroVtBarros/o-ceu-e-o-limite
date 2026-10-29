import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { dirname, join, resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { SkyDatabase } from "./database";
import { routines } from "../shared/routines";
import { BackupService } from "./backup";
import { SCHEMA_VERSION } from "./storage/schema";
import { backupError } from "./storage/backupFiles";

app.setName("O céu é o limite");
if (process.platform === "win32") app.setAppUserModelId("br.app.oceueolimite");
if (!app.isPackaged && process.env.SKY_TEST_DATA_DIR) {
  const testData = resolve(process.env.SKY_TEST_DATA_DIR);
  mkdirSync(testData, { recursive: true });
  app.setPath("userData", testData);
}
const locked = app.requestSingleInstanceLock();
if (!locked) app.quit();
let window: BrowserWindow | null = null;
let store: SkyDatabase;
let backups: BackupService;
const wasmPath = app.isPackaged
  ? join(process.resourcesPath, "sql-wasm.wasm")
  : join(__dirname, "../node_modules/sql.js/dist/sql-wasm.wasm");
const devUrl = !app.isPackaged ? process.env.VITE_DEV_SERVER_URL : undefined;
const rendererUrl = devUrl
  ? new URL(devUrl).href
  : pathToFileURL(join(__dirname, "../dist/index.html")).href;

function createWindow() {
  window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1000,
    minHeight: 720,
    title: "O Céu é o Limite",
    backgroundColor: "#0D1424",
    autoHideMenuBar: true,
    icon: join(__dirname, "../dist/favicon.svg"),
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false),
  );
  if (devUrl) void window.loadURL(devUrl);
  else void window.loadFile(join(__dirname, "../dist/index.html"));
  window.on("closed", () => {
    window = null;
  });
}

if (locked) {
  app.on("second-instance", () => {
    if (window?.isMinimized()) window.restore();
    window?.focus();
  });
  app
    .whenReady()
    .then(async () => {
      store = await SkyDatabase.open(
        join(app.getPath("userData"), "sky.sqlite"),
        wasmPath,
      );
      backups = new BackupService(store, {
        chooseExport: async () => {
          const result = await dialog.showSaveDialog(window!, {
            title: "Salvar cópia de segurança",
            defaultPath: `O-ceu-e-o-limite-backup-${new Date().toISOString().slice(0, 10)}.sqlite`,
            filters: [{ name: "Banco SQLite", extensions: ["sqlite"] }],
          });
          return result.canceled ? null : result.filePath || null;
        },
        chooseImport: async () => {
          const result = await dialog.showOpenDialog(window!, {
            title: "Restaurar cópia de segurança",
            properties: ["openFile"],
            filters: [
              { name: "Banco SQLite e cópias", extensions: ["sqlite", "bak"] },
            ],
          });
          return result.canceled ? null : result.filePaths[0] || null;
        },
        confirmRestore: async (path, preview) => {
          const result = await dialog.showMessageBox(window!, {
            type: "question",
            title: "Restaurar esta cópia?",
            message:
              "Substituir os dados deste computador pela cópia validada?",
            detail: `${path}\n\n${preview.goals} metas (incluindo arquivadas) · ${preview.results} resultados registrados\n${preview.routines} experiências de rotinas · ${preview.objectives} objetivos de longo prazo\nFormato ${preview.sourceVersion}${preview.sourceVersion !== preview.targetVersion ? " — será atualizado para o formato atual" : ""}. Preferências também serão restauradas.\n\nO histórico atual será substituído, sem mesclar dados. Uma cópia independente do estado anterior será guardada na pasta dos dados, com nome sky.sqlite.pre-restore-<data>-<id>.sqlite.`,
            buttons: ["Cancelar", "Restaurar e substituir"],
            defaultId: 0,
            cancelId: 0,
          });
          return result.response === 1;
        },
      });
      const handle = (
        channel: string,
        callback: (...args: any[]) => unknown,
      ) => {
        ipcMain.handle(channel, (event, ...args) => {
          if (
            !window ||
            event.sender !== window.webContents ||
            event.senderFrame !== window.webContents.mainFrame ||
            event.senderFrame.url !== rendererUrl
          )
            throw new Error("Solicitação não autorizada.");
          if (
            backups.busy &&
            !["sky:info", "sky:external", "sky:data-folder"].includes(channel)
          )
            throw new Error(
              "Conclua ou cancele a operação de backup em andamento.",
            );
          return callback(...args);
        });
      };
      handle("sky:load", () => store.load());
      handle("sky:create", (input) => store.createGoal(input));
      handle("sky:update", (id, input) => store.updateGoal(id, input));
      handle("sky:archive", (id) => store.archiveGoal(id));
      handle("sky:delete", (id) => store.deleteGoal(id));
      handle("sky:status", (id, date, status) =>
        store.setStatus(id, date, status),
      );
      handle("sky:routine", (id, date) => store.addRoutine(id, date));
      handle("sky:routine:start", (input) => store.startRoutine(input));
      handle("sky:preferences", (input) => store.updatePreferences(input));
      handle("sky:longterm:create", (input) => store.createLongTermGoal(input));
      handle("sky:longterm:update", (id, input) =>
        store.updateLongTermGoal(id, input),
      );
      handle("sky:longterm:archive", (id, archived) =>
        store.archiveLongTermGoal(id, archived),
      );
      handle("sky:rest", (date, note) => store.planRest(date, note));
      handle("sky:unrest", (date) => store.removeRest(date));
      handle("sky:info", () => ({
        mode: "desktop",
        path: join(app.getPath("userData"), "sky.sqlite"),
        schemaVersion: SCHEMA_VERSION,
      }));
      handle("sky:external", async (url) => {
        if (
          !routines.some((routine) => routine.sourceUrl === url) &&
          !store.snapshot().routineRuns?.some((run) => run.sourceUrl === url)
        )
          throw new Error("Link não permitido.");
        await shell.openExternal(url);
      });
      handle("sky:export", () => backups.export());
      handle("sky:import", () => backups.restore());
      handle("sky:data-folder", async () => {
        const error = await shell.openPath(dirname(store.filePath));
        if (error)
          throw new Error(
            "Não foi possível abrir a pasta dos dados. O caminho aparece em Meus dados e backups.",
          );
      });
      createWindow();
    })
    .catch((error) => {
      console.error("Falha ao iniciar O Céu é o Limite:", error);
      dialog.showErrorBox(
        "Não foi possível abrir seu espaço",
        `${backupError(error).message}\n\nSeus arquivos foram preservados; nenhum banco foi reinicializado. Pasta dos dados: ${app.getPath("userData")}\n\nFeche o aplicativo antes de recuperar arquivos. Guarde uma cópia dos arquivos existentes e use uma cópia SQLite válida para substituir sky.sqlite. O guia RECUPERACAO.md acompanha a documentação do projeto.`,
      );
      app.quit();
    });
  app.on("activate", () => {
    if (store && BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  app.on("will-quit", () => store?.close());
}
