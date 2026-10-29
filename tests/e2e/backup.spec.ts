import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
} from "@playwright/test";
import initSqlJs from "sql.js";
import {
  closeSync,
  ftruncateSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  rmdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SkyDatabase } from "../../electron/database";
import { dateKey, parseDate, shiftDate } from "../../shared/domain";
import { defaultRoutineInput } from "../../shared/routineRuns";
import { routines } from "../../shared/routines";
import { MAX_BACKUP_BYTES } from "../../shared/backup";

const wasm = resolve("node_modules/sql.js/dist/sql-wasm.wasm");
type Choice = { path?: string; cancel?: boolean; error?: string };
type Log = {
  kind: string;
  title?: string;
  path?: string;
  detail?: string;
  defaultId?: number;
  cancelId?: number;
  buttons?: string[];
};
type Harness = {
  saves: Choice[];
  opens: Choice[];
  confirms: (0 | 1 | "hold")[];
  seen: Log[];
  release?: (response: number) => void;
};
const envFor = (dir: string) => {
  const env: Record<string, string> = Object.fromEntries(
    Object.entries({ ...process.env, SKY_TEST_DATA_DIR: dir }).filter(
      (item): item is [string, string] => item[1] !== undefined,
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  return env;
};
async function mockDialogs(app: ElectronApplication) {
  await app.evaluate(({ dialog, shell }) => {
    const state: Harness = { saves: [], opens: [], confirms: [], seen: [] };
    (globalThis as typeof globalThis & { backupTest: Harness }).backupTest =
      state;
    dialog.showSaveDialog = (async (...args: unknown[]) => {
      const options = args.at(-1) as { title: string };
      state.seen.push({ kind: "save", title: options.title });
      const choice = state.saves.shift();
      if (!choice) throw new Error("Missing scripted save choice");
      if (choice.error)
        throw Object.assign(new Error("Scripted dialog failure"), {
          code: choice.error,
        });
      return { canceled: choice.cancel ?? false, filePath: choice.path };
    }) as typeof dialog.showSaveDialog;
    dialog.showOpenDialog = (async (...args: unknown[]) => {
      const options = args.at(-1) as { title: string };
      state.seen.push({ kind: "open", title: options.title });
      const choice = state.opens.shift();
      if (!choice) throw new Error("Missing scripted open choice");
      if (choice.error)
        throw Object.assign(new Error("Scripted dialog failure"), {
          code: choice.error,
        });
      return {
        canceled: choice.cancel ?? false,
        filePaths: choice.path ? [choice.path] : [],
      };
    }) as typeof dialog.showOpenDialog;
    dialog.showMessageBox = (async (...args: unknown[]) => {
      const options = args.at(-1) as Log;
      state.seen.push({
        kind: "confirm",
        title: options.title,
        detail: options.detail,
        buttons: options.buttons,
        defaultId: options.defaultId,
        cancelId: options.cancelId,
      });
      const answer = state.confirms.shift();
      if (answer === undefined)
        throw new Error("Missing scripted confirmation");
      const response =
        answer === "hold"
          ? await new Promise<number>((resolve) => {
              state.release = resolve;
            })
          : answer;
      return { response, checkboxChecked: false };
    }) as typeof dialog.showMessageBox;
    shell.openPath = async (path) => {
      state.seen.push({ kind: "folder", path });
      return "";
    };
    shell.openExternal = async (path) => {
      state.seen.push({ kind: "external", path });
    };
  });
}
async function queue(
  app: ElectronApplication,
  choices: {
    saves?: Choice[];
    opens?: Choice[];
    confirms?: (0 | 1 | "hold")[];
  },
) {
  await app.evaluate((_electron, plan) => {
    const state = (globalThis as typeof globalThis & { backupTest: Harness })
      .backupTest;
    state.saves.push(...(plan.saves ?? []));
    state.opens.push(...(plan.opens ?? []));
    state.confirms.push(...(plan.confirms ?? []));
  }, choices);
}
const logs = (app: ElectronApplication) =>
  app.evaluate(
    () =>
      (globalThis as typeof globalThis & { backupTest: Harness }).backupTest
        .seen,
  );

test("desktop exports, cancels, confirms and restores complete data with a durable recovery copy and offline restart", async () => {
  mkdirSync(resolve(".test-data"), { recursive: true });
  const dir = mkdtempSync(join(tmpdir(), "ceu-e-limite-backup-flow-"));
  const file = join(dir, "sky.sqlite"),
    exported = join(dir, "minha-copia.sqlite");
  const today = dateKey(),
    start = shiftDate(today, -2);
  let day = start;
  const store = await SkyDatabase.open(file, wasm, {
    now: () => parseDate(day),
  });
  const daily = store.createGoal({
    title: "Ler um capítulo",
    description: "Um dia de cada vez",
    category: "Estudos",
    frequency: "daily",
    startDate: start,
  }).goals[0].id;
  const weekly = store
    .createGoal({
      title: "Planejar a semana",
      description: "",
      category: "Pessoal",
      frequency: "weekly",
      startDate: start,
    })
    .goals.at(-1)!.id;
  store.setStatus(daily, start, "done");
  store.setStatus(weekly, start, "done");
  store.planRest(shiftDate(today, -1), "Descanso planejado");
  const draft = defaultRoutineInput(routines[0], today, "backup-experience");
  draft.activities[0] = {
    ...draft.activities[0],
    time: "08:30",
    minutes: 15,
    intensity: "Com calma",
  };
  store.startRoutine(draft);
  day = today;
  store.load();
  store.setStatus(daily, today, "done");
  store.updateGoal(daily, {
    title: "Leitura com foco",
    description: "Próxima versão",
    category: "Trabalho",
  });
  store.createLongTermGoal({
    operationKey: "books",
    title: "Ler 12 livros",
    description: "Repertório",
    category: "Estudos",
    target: 12,
    current: 3,
    unit: "livros",
    dueOn: shiftDate(today, 90),
  });
  store.updatePreferences({ theme: "ocean", showEncouragement: false });
  const original = store.snapshot();
  store.close();
  const env = envFor(dir);
  let app: ElectronApplication | undefined;
  try {
    app = await electron.launch({ args: [resolve(".")], env });
    let page = await app.firstWindow();
    await page.context().setOffline(true);
    await mockDialogs(app);
    await page
      .getByRole("button", { name: "Meus dados e backups", exact: true })
      .click();
    await expect(
      page.getByText("Banco SQLite local", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Abrir pasta dos dados", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await logs(app!)).filter((item) => item.kind === "folder").length,
      )
      .toBe(1);
    expect((await logs(app)).find((item) => item.kind === "folder")!.path).toBe(
      dir,
    );
    await queue(app, { saves: [{ path: exported }] });
    await page
      .getByRole("button", { name: "Exportar backup", exact: true })
      .click();
    await expect(page.locator(".backup-notice.success")).toContainText(
      "salva e conferida",
    );
    expect(readFileSync(exported).subarray(0, 15).toString()).toBe(
      "SQLite format 3",
    );
    const source = readFileSync(exported);
    await page
      .getByRole("dialog")
      .screenshot({ path: resolve(".test-data/phase7-backup.png") });
    await page
      .getByRole("button", { name: "Fechar janela", exact: true })
      .click();
    await page.getByRole("button", { name: "Nova meta", exact: true }).click();
    await page
      .getByLabel("O que você quer conquistar?", { exact: true })
      .fill("Depois do backup");
    await page
      .getByRole("button", { name: "Criar minha meta", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page
      .getByRole("button", { name: "Meu caminho", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Objetivos de longo prazo", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Atualizar objetivo Ler 12 livros",
        exact: true,
      })
      .click();
    await page.getByLabel("Progresso atual", { exact: true }).fill("9");
    await page
      .getByRole("button", { name: "Salvar objetivo", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page
      .getByRole("button", { name: "Personalizar", exact: true })
      .click();
    await page.getByRole("radio", { name: "Floresta", exact: true }).check();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "forest");
    await page
      .getByRole("checkbox", {
        name: "Mostrar mensagens de incentivo",
        exact: true,
      })
      .check();
    await expect(
      page.getByRole("checkbox", {
        name: "Mostrar mensagens de incentivo",
        exact: true,
      }),
    ).toBeChecked();
    const previous = await page.evaluate(() => window.sky!.load()),
      previousBytes = readFileSync(file);
    await page
      .getByRole("button", { name: "Meus dados e backups", exact: true })
      .click();
    await queue(app, { opens: [{ cancel: true }] });
    await page
      .getByRole("button", { name: "Restaurar backup", exact: true })
      .click();
    await expect(page.locator(".backup-notice.cancelled")).toContainText(
      "cancelada",
    );
    expect(
      (await logs(app)).filter((item) => item.kind === "confirm"),
    ).toHaveLength(0);
    await queue(app, { opens: [{ path: exported }], confirms: [0] });
    await page
      .getByRole("button", { name: "Restaurar backup", exact: true })
      .click();
    await expect(page.locator(".backup-notice.cancelled")).toContainText(
      "cancelada",
    );
    expect(await page.evaluate(() => window.sky!.load())).toEqual(previous);
    expect(readFileSync(file)).toEqual(previousBytes);
    expect(
      readdirSync(dir).some((name) => name.includes(".pre-restore-")),
    ).toBe(false);
    const confirmation = (await logs(app)).find(
      (item) => item.kind === "confirm",
    )!;
    expect(confirmation.defaultId).toBe(0);
    expect(confirmation.cancelId).toBe(0);
    expect(confirmation.buttons).toEqual([
      "Cancelar",
      "Restaurar e substituir",
    ]);
    expect(confirmation.detail).toContain(exported);
    expect(confirmation.detail).toContain("objetivos de longo prazo");
    await queue(app, { opens: [{ path: exported }], confirms: ["hold"] });
    await page
      .getByRole("button", { name: "Restaurar backup", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await logs(app!)).filter((item) => item.kind === "confirm").length,
      )
      .toBe(2);
    await expect(page.evaluate(() => window.sky!.load())).rejects.toThrow(
      "andamento",
    );
    await expect(
      page.evaluate(() =>
        window.sky!.createGoal({
          title: "Não deve gravar",
          description: "",
          category: "Pessoal",
          frequency: "daily",
          startDate: new Date().toLocaleDateString("en-CA"),
        }),
      ),
    ).rejects.toThrow("andamento");
    await expect(
      page.evaluate(() => window.sky!.exportBackup()),
    ).rejects.toThrow("andamento");
    expect((await page.evaluate(() => window.sky!.storageInfo())).path).toBe(
      file,
    );
    expect(readFileSync(file)).toEqual(previousBytes);
    await app.evaluate(() =>
      (globalThis as typeof globalThis & { backupTest: Harness }).backupTest
        .release!(1),
    );
    await expect(page.locator(".backup-notice.success")).toContainText(
      "Cópia restaurada",
    );
    await expect(page.locator("html")).toHaveAttribute("data-theme", "ocean");
    expect(await page.evaluate(() => window.sky!.load())).toEqual(original);
    const recoveryPath = (await page
      .locator(".backup-notice code")
      .textContent())!;
    expect(readFileSync(recoveryPath)).toEqual(previousBytes);
    expect(readFileSync(exported)).toEqual(source);
    await page
      .getByRole("dialog")
      .screenshot({ path: resolve(".test-data/phase7-restored.png") });
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setContentSize(1000, 720),
    );
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    await page.locator(".recovery-guide summary").click();
    await expect(
      page.getByRole("heading", {
        name: "Se o aplicativo não conseguir abrir",
        exact: true,
      }),
    ).toBeVisible();
    await app.close();
    app = await electron.launch({ args: [resolve(".")], env });
    page = await app.firstWindow();
    await page.context().setOffline(true);
    await mockDialogs(app);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "ocean");
    expect(await page.evaluate(() => window.sky!.load())).toEqual(original);
    await page
      .getByRole("button", { name: "Meus dados e backups", exact: true })
      .click();
    await queue(app, { opens: [{ path: recoveryPath }], confirms: [1] });
    await page
      .getByRole("button", { name: "Restaurar backup", exact: true })
      .click();
    await expect(page.locator(".backup-notice.success")).toContainText(
      "Cópia restaurada",
    );
    expect(await page.evaluate(() => window.sky!.load())).toEqual(previous);
    expect(readFileSync(recoveryPath)).toEqual(previousBytes);
    expect(
      readdirSync(dir).filter((name) => name.includes(".pre-restore-")).length,
    ).toBe(2);
  } finally {
    if (app) await app.close();
  }
});

test("desktop refuses invalid and oversized inputs and survives cancelled dialogs and failed restore writes", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ceu-e-limite-backup-errors-"));
  const file = join(dir, "sky.sqlite"),
    good = join(dir, "good.sqlite"),
    corrupt = join(dir, "corrupt.sqlite"),
    future = join(dir, "future.sqlite"),
    large = join(dir, "large.sqlite");
  const store = await SkyDatabase.open(file, wasm);
  store.createGoal({
    title: "Original",
    description: "",
    category: "Pessoal",
    frequency: "daily",
    startDate: dateKey(),
  });
  const expected = store.snapshot();
  writeFileSync(good, store.exportBytes());
  store.createGoal({
    title: "Atual",
    description: "",
    category: "Pessoal",
    frequency: "daily",
    startDate: dateKey(),
  });
  const previous = store.snapshot();
  store.close();
  writeFileSync(corrupt, "invalid SQLite");
  const SQL = await initSqlJs({ locateFile: () => wasm });
  const db = new SQL.Database();
  db.run("PRAGMA user_version = 99");
  writeFileSync(future, db.export());
  db.close();
  const fd = openSync(large, "w");
  ftruncateSync(fd, MAX_BACKUP_BYTES + 1);
  closeSync(fd);
  let app: ElectronApplication | undefined;
  try {
    app = await electron.launch({ args: [resolve(".")], env: envFor(dir) });
    const page = await app.firstWindow();
    await page.context().setOffline(true);
    await mockDialogs(app);
    await page
      .getByRole("button", { name: "Meus dados e backups", exact: true })
      .click();
    const before = readFileSync(file),
      originalSource = readFileSync(good);
    await queue(app, { saves: [{ path: file }] });
    await page
      .getByRole("button", { name: "Exportar backup", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("cópias internas");
    await queue(app, { saves: [{ error: "EACCES" }] });
    await page
      .getByRole("button", { name: "Exportar backup", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("permissões");
    await queue(app, { saves: [{ cancel: true }] });
    await page
      .getByRole("button", { name: "Exportar backup", exact: true })
      .click();
    await expect(page.locator(".backup-notice.cancelled")).toContainText(
      "cancelada",
    );
    for (const [path, message] of [
      [corrupt, "SQLite"],
      [future, "mais recente"],
      [large, "50 MB"],
      [join(dir, "missing.sqlite"), "não foi encontrado"],
      [file, "banco em uso"],
    ]) {
      await queue(app, { opens: [{ path }] });
      await page
        .getByRole("button", { name: "Restaurar backup", exact: true })
        .click();
      await expect(page.getByRole("alert")).toContainText(message);
      expect(await page.evaluate(() => window.sky!.load())).toEqual(previous);
      expect(readFileSync(file)).toEqual(before);
    }
    expect((await logs(app)).some((item) => item.kind === "confirm")).toBe(
      false,
    );
    mkdirSync(`${file}.tmp`);
    await queue(app, { opens: [{ path: good }], confirms: [1] });
    await page
      .getByRole("button", { name: "Restaurar backup", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("preservad");
    expect(readFileSync(file)).toEqual(before);
    expect(readFileSync(good)).toEqual(originalSource);
    expect(await page.evaluate(() => window.sky!.load())).toEqual(previous);
    rmdirSync(`${file}.tmp`);
    await queue(app, { opens: [{ path: good }], confirms: [1] });
    await page
      .getByRole("button", { name: "Restaurar backup", exact: true })
      .click();
    await expect(page.locator(".backup-notice.success")).toContainText(
      "Cópia restaurada",
    );
    expect(await page.evaluate(() => window.sky!.load())).toEqual(expected);
  } finally {
    if (app) await app.close();
  }
});

test("restoring the rolling copy preserves its source and IPC, navigation, frame and external-link boundaries stay restricted", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ceu-e-limite-backup-boundaries-"));
  const file = join(dir, "sky.sqlite");
  const store = await SkyDatabase.open(file, wasm);
  const id = store.createGoal({
    title: "Ler",
    description: "",
    category: "Estudos",
    frequency: "daily",
    startDate: dateKey(),
  }).goals[0].id;
  store.setStatus(id, dateKey(), "done");
  const expected = store.snapshot();
  store.createGoal({
    title: "Depois",
    description: "",
    category: "Pessoal",
    frequency: "daily",
    startDate: dateKey(),
  });
  store.close();
  const source = readFileSync(`${file}.bak`);
  let app: ElectronApplication | undefined;
  try {
    app = await electron.launch({ args: [resolve(".")], env: envFor(dir) });
    const page = await app.firstWindow();
    await page.context().setOffline(true);
    await mockDialogs(app);
    await page
      .getByRole("button", { name: "Meus dados e backups", exact: true })
      .click();
    await queue(app, { opens: [{ path: `${file}.bak` }], confirms: [1] });
    await page
      .getByRole("button", { name: "Restaurar backup", exact: true })
      .click();
    await expect(page.locator(".backup-notice.success")).toContainText(
      "Cópia restaurada",
    );
    expect(await page.evaluate(() => window.sky!.load())).toEqual(expected);
    expect(readFileSync(`${file}.bak`)).toEqual(source);
    await page
      .getByRole("button", { name: "Fechar janela", exact: true })
      .click();
    expect(
      await page.evaluate(
        () => typeof (window as unknown as { require?: unknown }).require,
      ),
    ).toBe("undefined");
    const csp = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute("content");
    expect(csp).toContain("frame-src 'none'");
    expect(csp).not.toContain("ws://");
    await page.evaluate(() => {
      window.open("https://example.com/", "_blank");
    });
    expect(
      await app.evaluate(
        ({ BrowserWindow }) => BrowserWindow.getAllWindows().length,
      ),
    ).toBe(1);
    for (const url of [
      "file:///C:/Windows/win.ini",
      "javascript:alert(1)",
      "https://example.com/",
    ])
      await expect(
        page.evaluate((value) => window.sky!.openExternal(value), url),
      ).rejects.toThrow("Link não permitido");
    await page.evaluate(
      (url) => window.sky!.openExternal(url),
      routines[0].sourceUrl,
    );
    expect(
      (await logs(app)).filter((item) => item.kind === "external"),
    ).toEqual([{ kind: "external", path: routines[0].sourceUrl }]);
    const denied = await app.evaluate(async ({ BrowserWindow }, preload) => {
      const foreign = new BrowserWindow({
        show: false,
        webPreferences: {
          preload,
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
        },
      });
      try {
        await foreign.loadURL(
          "data:text/html,<title>Untrusted test window</title>",
        );
        return await foreign.webContents.executeJavaScript(
          "Promise.all([window.sky.load(), window.sky.exportBackup(), window.sky.importBackup()].map(p => p.then(() => 'unexpected success', e => e.message)))",
        );
      } finally {
        foreign.destroy();
      }
    }, resolve("dist-electron/preload.cjs"));
    expect(denied).toHaveLength(3);
    expect(
      denied.every((message: string) => message.includes("não autorizada")),
    ).toBe(true);
    expect(
      (await logs(app)).filter((item) => item.kind === "save"),
    ).toHaveLength(0);
    expect(await page.evaluate(() => window.sky!.load())).toEqual(expected);
    const currentUrl = page.url();
    await app.evaluate(({ BrowserWindow }) => {
      const web = BrowserWindow.getAllWindows()[0].webContents;
      (
        globalThis as typeof globalThis & { blockedNavigation?: boolean }
      ).blockedNavigation = false;
      web.once("will-navigate", (event) => {
        (
          globalThis as typeof globalThis & { blockedNavigation?: boolean }
        ).blockedNavigation = event.defaultPrevented;
      });
    });
    await page.evaluate(() => {
      window.location.href = "https://example.com/blocked";
    });
    // Cancelled CDP navigations can leave Playwright waiting; inspect the committed Electron document.
    await expect
      .poll(() =>
        app!.evaluate(
          () =>
            (globalThis as typeof globalThis & { blockedNavigation?: boolean })
              .blockedNavigation,
        ),
      )
      .toBe(true);
    const document = await app.evaluate(async ({ BrowserWindow }) => {
      const web = BrowserWindow.getAllWindows()[0].webContents;
      return {
        url: web.getURL(),
        frameUrl: web.mainFrame.url,
        heading: await web.executeJavaScript(
          'document.querySelector("h1")?.textContent',
        ),
        snapshot: await web.executeJavaScript("window.sky.load()"),
      };
    });
    expect(document.url).toBe(currentUrl);
    expect(document.frameUrl).toBe(currentUrl);
    expect(document.heading).toBe("Continue evoluindo.");
    expect(document.snapshot).toEqual(expected);
  } finally {
    if (app) await app.close();
  }
});
