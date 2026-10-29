import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
} from "@playwright/test";
import initSqlJs from "sql.js";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SkyDatabase } from "../../electron/database";
import { dateKey, parseDate, shiftDate } from "../../shared/domain";
import { defaultRoutineInput } from "../../shared/routineRuns";
import { routines } from "../../shared/routines";
import { sqliteBytes } from "../../electron/storage/files";

const wasm = resolve("node_modules/sql.js/dist/sql-wasm.wasm");
const environment = (dir: string) => {
  const env: Record<string, string> = Object.fromEntries(
    Object.entries({ ...process.env, SKY_TEST_DATA_DIR: dir }).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  return env;
};

test("routine preview personalizes choices, prevents retries and accidental overlaps, compares past attempts and persists offline", async () => {
  mkdirSync(resolve(".test-data"), { recursive: true });
  const dir = mkdtempSync(join(tmpdir(), "ceu-e-limite-routines-"));
  const today = dateKey();
  const tomorrow = shiftDate(today, 1);
  let day = shiftDate(today, -4);
  const store = await SkyDatabase.open(join(dir, "sky.sqlite"), wasm, {
    now: () => parseDate(day),
  });
  const old = store.startRoutine(
    defaultRoutineInput(routines[1], day, "past-one"),
  ).routineRuns![0];
  store.setStatus(old.activities[0].goals[0].id, day, "done");
  day = shiftDate(today, -2);
  store.load();
  const pastDraft = defaultRoutineInput(routines[1], day, "past-two");
  pastDraft.endsOn = shiftDate(today, -1);
  pastDraft.activities = pastDraft.activities.slice(0, 2);
  const recent = store.startRoutine(pastDraft).routineRuns![1];
  recent.activities.forEach((activity) =>
    store.setStatus(activity.goals[0].id, day, "done"),
  );
  day = shiftDate(today, -1);
  store.load();
  store.setStatus(recent.activities[0].goals[1].id, day, "done");
  day = today;
  store.load();
  store.close();
  const env = environment(dir);
  let app: ElectronApplication | undefined;
  try {
    app = await electron.launch({ args: [resolve(".")], env });
    let page = await app.firstWindow();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.context().setOffline(true);
    const openRoutines = () =>
      page
        .getByRole("button", { name: "Rotinas para inspirar", exact: true })
        .click();
    await openRoutines();
    await expect(page.locator(".routine-card")).toHaveCount(3);
    await expect(page.locator(".routine-model-meta")).toHaveCount(3);
    await page
      .getByRole("button", { name: "Minhas experiências", exact: true })
      .click();
    await page.getByLabel("Filtrar por inspiração").selectOption("murakami");
    await expect(page.locator(".run-comparison")).toContainText("75%");
    await expect(page.locator(".run-comparison")).toContainText("25%");
    await expect(page.locator(".run-history-table tbody tr")).toHaveCount(2);
    await page.getByRole("button", { name: "Catálogo", exact: true }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: resolve(".test-data/phase5-catalog.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", {
        name: "Conhecer rotina de Ilia Topuria",
        exact: true,
      })
      .click();
    await expect(
      page.getByText("Relato de Ilia Topuria · site oficial", { exact: true }),
    ).toBeVisible();
    await expect(page.locator(".routine-provenance")).toContainText(
      "Modelo v1",
    );
    await expect(
      page.getByRole("button", { name: "Só um dia", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel("Primeiro dia", { exact: true })).toHaveValue(
      today,
    );
    await expect(page.getByLabel("Último dia", { exact: true })).toHaveCount(0);
    await page
      .getByLabel("Incluir Praticar uma habilidade com foco", { exact: true })
      .uncheck();
    await page
      .getByLabel("Incluir Desacelerar e revisar o dia", { exact: true })
      .uncheck();
    await page
      .locator(".routine-activity-editor")
      .first()
      .locator("summary")
      .click();
    await page
      .getByLabel("Nome da atividade 1", { exact: true })
      .fill("Minha prioridade possível");
    await page
      .getByLabel("Descrição da atividade 1", { exact: true })
      .fill("Começar com uma pequena ação");
    await page
      .getByLabel("Categoria da atividade 1", { exact: true })
      .selectOption("Trabalho");
    await page
      .getByLabel("Duração em minutos da atividade 1", { exact: true })
      .fill("15");
    await page
      .getByLabel("Horário da atividade 1", { exact: true })
      .fill("08:30");
    await page
      .getByLabel("Meu ritmo na atividade 1", { exact: true })
      .fill("Com calma");
    await expect(page.locator(".routine-save-summary")).toContainText(
      "2 atividades × 1 dia = 2 compromissos",
    );
    await page
      .getByRole("dialog")
      .screenshot({ path: resolve(".test-data/phase5-preview.png") });
    await page
      .getByRole("button", { name: "Quero experimentar", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.locator(".goal-row")).toHaveCount(2);
    await expect(page.locator(".routine-schedule")).toHaveText(
      "08:30 · 15 min · Meu ritmo: Com calma",
    );
    await page
      .getByRole("button", {
        name: "Concluir Minha prioridade possível",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("progressbar", { name: "Metas diárias atingidas" }),
    ).toHaveAttribute("aria-valuenow", "50");
    const saved = await page.evaluate(() => window.sky!.load());
    const run = saved.routineRuns!.at(-1)!;
    const retry = {
      operationKey: run.operationKey,
      templateId: run.templateId,
      templateVersion: run.templateVersion,
      startsOn: run.startsOn,
      endsOn: run.endsOn,
      activities: run.activities.map(
        ({ goals: _goals, ...activity }) => activity,
      ),
      allowRepeat: false,
    };
    await page.evaluate(
      (input) =>
        Promise.all([
          window.sky!.startRoutine(input),
          window.sky!.startRoutine(input),
        ]),
      retry,
    );
    expect(
      (await page.evaluate(() => window.sky!.load())).routineRuns,
    ).toHaveLength(3);
    await expect(
      page.evaluate(
        (input) => window.sky!.startRoutine({ ...input, endsOn: "2026-02-30" }),
        retry,
      ),
    ).rejects.toThrow();
    await expect(
      page.evaluate(() => window.sky!.openExternal("javascript:alert(1)")),
    ).rejects.toThrow("Link não permitido");
    await openRoutines();
    await page
      .getByRole("button", {
        name: "Conhecer rotina de Ilia Topuria",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", { name: "Quero experimentar", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByLabel("Quero criar outra experiência neste período", {
        exact: false,
      }),
    ).not.toBeChecked();
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    expect(
      (await page.evaluate(() => window.sky!.load())).routineRuns,
    ).toHaveLength(3);
    await page
      .getByRole("button", {
        name: "Conhecer rotina de Ilia Topuria",
        exact: true,
      })
      .click();
    for (const title of [
      "Reservar um momento para me movimentar",
      "Praticar uma habilidade com foco",
      "Desacelerar e revisar o dia",
    ])
      await page.getByLabel(`Incluir ${title}`, { exact: true }).uncheck();
    await page
      .getByRole("button", { name: "Escolher um intervalo", exact: true })
      .click();
    await page.getByLabel("Último dia", { exact: true }).fill(tomorrow);
    await expect(page.locator(".routine-save-summary")).toContainText(
      "1 atividade × 2 dias = 2 compromissos",
    );
    await page
      .getByLabel("Quero criar outra experiência neste período", {
        exact: false,
      })
      .check();
    await page
      .getByRole("button", { name: "Quero experimentar", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(
      page.getByRole("progressbar", { name: "Metas diárias atingidas" }),
    ).toHaveAttribute("aria-valuenow", "33");
    await openRoutines();
    await page
      .getByRole("button", { name: "Minhas experiências", exact: true })
      .click();
    await page.getByLabel("Filtrar por inspiração").selectOption("ilia");
    await expect(page.locator(".run-history-table tbody tr")).toHaveCount(2);
    await expect(
      page.locator(".run-history-table tbody tr").first(),
    ).toContainText("1 futuros");
    await page
      .locator(".run-history-table tbody tr")
      .last()
      .getByRole("button", { name: /^Ver experiência/ })
      .click();
    await expect(page.locator(".run-chosen-activities")).toContainText(
      "Minha prioridade possível",
    );
    await expect(page.locator(".run-chosen-activities")).toContainText(
      "08:30 · 15 min · Meu ritmo: Com calma",
    );
    await expect(page.locator(".run-detail-summary")).toContainText("50%");
    await page
      .getByRole("button", { name: "Fechar janela", exact: true })
      .click();
    if (
      await page
        .getByRole("button", { name: "Fechar aviso", exact: true })
        .isVisible()
    )
      await page
        .getByRole("button", { name: "Fechar aviso", exact: true })
        .click();
    await page.getByLabel("Filtrar por inspiração").selectOption("murakami");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: resolve(".test-data/phase5-experiences.png"),
      fullPage: true,
    });
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
    const before = await page.evaluate(() => window.sky!.load());
    expect(before.routineRuns).toHaveLength(4);
    await app.close();
    app = await electron.launch({ args: [resolve(".")], env });
    page = await app.firstWindow();
    await page.context().setOffline(true);
    await expect(
      page.getByRole("progressbar", { name: "Metas diárias atingidas" }),
    ).toHaveAttribute("aria-valuenow", "33");
    expect(await page.evaluate(() => window.sky!.load())).toEqual(before);
    await openRoutines();
    await page
      .getByRole("button", { name: "Minhas experiências", exact: true })
      .click();
    await page.getByLabel("Filtrar por inspiração").selectOption("ilia");
    await expect(page.locator(".run-history-table tbody tr")).toHaveCount(2);
    expect(errors).toEqual([]);
  } finally {
    if (app) await app.close();
  }
});

test("desktop upgrades a v2 profile with exact backup and preserves legacy results across restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ceu-e-limite-v2-routines-"));
  const file = join(dir, "sky.sqlite");
  const today = dateKey();
  const store = await SkyDatabase.open(file, wasm);
  const id = store.createGoal({
    title: "Reflexão da rotina anterior",
    description: "Histórico sem versão do modelo",
    category: "Pessoal",
    frequency: "once",
    startDate: today,
    routineId: "ilia",
  }).goals[0].id;
  store.setStatus(id, today, "done");
  const original = store.snapshot();
  const bytes = store.exportBytes();
  store.close();
  const SQL = await initSqlJs({ locateFile: () => wasm });
  const old = new SQL.Database(bytes);
  old.run("DROP TABLE long_term_goals");
  old.run("DROP TABLE personal_preferences");
  old.run("DELETE FROM schema_migrations WHERE version = 4");
  old.run("DROP TABLE routine_runs");
  old.run("DELETE FROM schema_migrations WHERE version = 3");
  old.run("PRAGMA user_version = 2");
  const originalBytes = sqliteBytes(old);
  old.close();
  writeFileSync(file, originalBytes);
  const env = environment(dir);
  let app: ElectronApplication | undefined;
  try {
    app = await electron.launch({ args: [resolve(".")], env });
    let page = await app.firstWindow();
    await page.context().setOffline(true);
    await expect(
      page.getByRole("button", {
        name: "Desmarcar Reflexão da rotina anterior",
        exact: true,
      }),
    ).toBeVisible();
    expect(await page.evaluate(() => window.sky!.load())).toEqual(original);
    await page
      .getByRole("button", { name: "Rotinas para inspirar", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Minhas experiências", exact: true })
      .click();
    await expect(page.locator(".legacy-routine-history")).toContainText(
      "1/1 · 100% · legado",
    );
    await expect(page.locator(".legacy-routine-history")).toContainText(
      "não eram registrados",
    );
    await page.getByRole("button", { name: "Catálogo", exact: true }).click();
    await page
      .getByRole("button", {
        name: "Conhecer rotina de Ilia Topuria",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", { name: "Quero experimentar", exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    const backups = readdirSync(dir).filter((name) =>
      name.includes(".pre-v3-"),
    );
    expect(backups).toHaveLength(1);
    expect(readFileSync(join(dir, backups[0]))).toEqual(
      Buffer.from(originalBytes),
    );
    await app.close();
    app = await electron.launch({ args: [resolve(".")], env });
    page = await app.firstWindow();
    await expect(
      page.getByRole("heading", { name: "Continue evoluindo." }),
    ).toBeVisible();
    expect(await page.evaluate(() => window.sky!.load())).toEqual(original);
    expect(
      readdirSync(dir).filter((name) => name.includes(".pre-v3-")),
    ).toHaveLength(1);
  } finally {
    if (app) await app.close();
  }
});
