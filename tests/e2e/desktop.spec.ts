import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
} from "@playwright/test";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { legacyFixture } from "../legacy-fixture";
import { dateKey, parseDate, shiftDate, weekStart } from "../../shared/domain";
import { weekdayBit, weekdays } from "../../shared/schedule";
import { SkyDatabase } from "../../electron/database";
import { formatDay } from "../../src/goalPresentation";

test("analytics renders real history offline, navigates the calendar and recalculates after a persisted correction", async () => {
  mkdirSync(resolve(".test-data"), { recursive: true });
  const dataDir = mkdtempSync(join(tmpdir(), "ceu-e-limite-analytics-"));
  const today = dateKey();
  const yesterday = shiftDate(today, -1);
  const start = shiftDate(weekStart(today), -70);
  let day = start;
  const store = await SkyDatabase.open(
    join(dataDir, "sky.sqlite"),
    resolve("node_modules/sql.js/dist/sql-wasm.wasm"),
    { now: () => parseDate(day) },
  );
  const reading = store
    .createGoal({
      title: "Ler 20 páginas",
      description: "Um capítulo de cada vez",
      category: "Estudos",
      frequency: "daily",
      startDate: start,
    })
    .goals.at(-1)!.id;
  const exercise = store
    .createGoal({
      title: "Caminhar por 20 minutos",
      description: "Respeitar meu ritmo",
      category: "Saúde",
      frequency: "daily",
      startDate: start,
    })
    .goals.at(-1)!.id;
  const focus = store
    .createGoal({
      title: "Um momento de foco",
      description: "Começar pelo que importa",
      category: "Trabalho",
      frequency: "daily",
      weekdayMask: 31,
      startDate: start,
    })
    .goals.at(-1)!.id;
  const weekly = store
    .createGoal({
      title: "Planejar a próxima semana",
      description: "",
      category: "Pessoal",
      frequency: "weekly",
      startDate: start,
    })
    .goals.at(-1)!.id;
  const expected: { date: string; total: number; done: number }[] = [];
  let weeklyCount = 0;
  try {
    for (let i = 0; day <= today; i++, day = shiftDate(day, 1)) {
      store.load();
      const weekday = parseDate(day).getDay();
      if (weekday === 1) {
        store.setStatus(weekly, day, "done");
        weeklyCount++;
      }
      // Yesterday stays eligible and unrecorded for the review flow, even on a Sunday.
      if (weekday === 0 && day !== yesterday && day !== today) {
        store.planRest(day, "Recuperar as energias");
        continue;
      }
      const ids =
        weekday > 0 && weekday < 6
          ? [reading, exercise, focus]
          : [reading, exercise];
      const result = { date: day, total: ids.length, done: 0 };
      if (day !== yesterday) {
        for (const [index, id] of ids.entries()) {
          const status =
            (i + index) % 4 === 0
              ? "missed"
              : (i + index) % 5 === 0
                ? "pending"
                : "done";
          if (status !== "pending") store.setStatus(id, day, status);
          if (status === "done") result.done++;
        }
      }
      expected.push(result);
    }
  } finally {
    store.close();
  }
  const counts = (range: number, correction = 0) => {
    const selected = expected.filter(
      (item) => item.date >= shiftDate(today, 1 - range),
    );
    const total = selected.reduce((sum, item) => sum + item.total, 0);
    const done = selected.reduce((sum, item) => sum + item.done, correction);
    return { done, percent: `${Math.round((100 * done) / total)}%` };
  };
  const env: Record<string, string> = Object.fromEntries(
    Object.entries({ ...process.env, SKY_TEST_DATA_DIR: dataDir }).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  let app: ElectronApplication | undefined;
  try {
    app = await electron.launch({ args: [resolve(".")], env });
    let page = await app.firstWindow();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.context().setOffline(true);
    await page
      .getByRole("button", { name: "Minha evolução", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Cada dia, um passo a mais",
        exact: true,
      }),
    ).toBeVisible();
    for (const range of [7, 30, 90]) {
      await page
        .getByRole("button", { name: `${range} dias`, exact: true })
        .click();
      await expect(page.getByTestId("analytics-done")).toHaveText(
        String(counts(range).done),
      );
      await expect(page.getByTestId("analytics-percent")).toHaveText(
        counts(range).percent,
      );
    }
    await expect(page.getByTestId("analytics-weekly")).toHaveText(
      `100%${weeklyCount} de ${weeklyCount} atingidas`,
    );
    await expect(page.locator(".recharts-line-curve")).toHaveCount(2);
    await expect(
      page.getByRole("heading", {
        name: "Uma semana de cada vez",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText("Semana atual · parcial", { exact: true }),
    ).toBeVisible();
    const tableDetails = page.locator(".evolution-chart .chart-data");
    await tableDetails.locator("summary").click();
    await expect(tableDetails.locator("tbody tr")).toHaveCount(90);
    await tableDetails.locator("summary").click();
    const monthlyDetails = page.locator(".monthly-evolution .chart-data");
    await monthlyDetails.locator("summary").click();
    await expect(monthlyDetails.locator("tbody tr")).toHaveCount(6);
    await expect(monthlyDetails.locator("tbody tr").last()).toContainText(
      "Mês parcial",
    );
    await monthlyDetails.locator("summary").click();
    const calendar = page.locator(".consistency-card");
    const monthText = formatDay(today, { month: "long", year: "numeric" });
    await calendar
      .getByRole("button", { name: "Mês anterior", exact: true })
      .click();
    await expect(calendar.locator(".calendar-nav h3")).not.toHaveText(
      monthText,
    );
    await calendar.getByRole("button", { name: "Hoje", exact: true }).click();
    await expect(calendar.locator(".calendar-nav h3")).toHaveText(monthText);
    // Also works when yesterday belongs to the previous month.
    if (yesterday.slice(0, 7) !== today.slice(0, 7))
      await calendar
        .getByRole("button", { name: "Mês anterior", exact: true })
        .click();
    await calendar
      .getByRole("button", {
        name: new RegExp(
          `^${formatDay(yesterday, { day: "numeric", month: "long", year: "numeric" })}: Sem registro`,
        ),
      })
      .click();
    await expect(calendar.locator(".calendar-detail")).toContainText(
      "Sem registro",
    );
    await calendar
      .getByRole("button", { name: "Revisar este dia", exact: false })
      .click();
    await expect(
      page.getByLabel("Data da agenda", { exact: true }),
    ).toHaveValue(yesterday);
    await page
      .getByRole("button", { name: "Concluir Ler 20 páginas", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Salvar correção", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page
      .getByRole("button", { name: "Minha evolução", exact: true })
      .click();
    await expect(page.getByTestId("analytics-done")).toHaveText(
      String(counts(30, 1).done),
    );
    await expect(page.getByTestId("analytics-percent")).toHaveText(
      counts(30, 1).percent,
    );
    if (
      await page
        .getByRole("button", { name: "Fechar aviso", exact: true })
        .isVisible()
    )
      await page
        .getByRole("button", { name: "Fechar aviso", exact: true })
        .click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: resolve(".test-data/phase4-evolution.png"),
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
    await expect
      .poll(() =>
        page
          .locator(".progress-chart")
          .first()
          .evaluate((element) => element.clientWidth),
      )
      .toBeGreaterThan(0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: resolve(".test-data/phase4-minimum.png"),
      fullPage: true,
    });
    const before = await page.evaluate(() => window.sky!.load());
    await app.close();
    app = await electron.launch({ args: [resolve(".")], env });
    page = await app.firstWindow();
    await page.context().setOffline(true);
    await page
      .getByRole("button", { name: "Minha evolução", exact: true })
      .click();
    await expect(page.getByTestId("analytics-percent")).toHaveText(
      counts(30, 1).percent,
    );
    expect(await page.evaluate(() => window.sky!.load())).toEqual(before);
    expect(errors).toEqual([]);
  } finally {
    if (app) await app.close();
  }
});

test("desktop app creates goals, tracks outcomes, applies a routine and persists across restart", async () => {
  mkdirSync(resolve(".test-data"), { recursive: true });
  const dataDir = mkdtempSync(join(tmpdir(), "ceu-e-limite-desktop-"));
  const env: Record<string, string> = Object.fromEntries(
    Object.entries({ ...process.env, SKY_TEST_DATA_DIR: dataDir }).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  let app: ElectronApplication | undefined;
  const launch = () => electron.launch({ args: [resolve(".")], env });
  try {
    app = await launch();
    let page = await app.firstWindow();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.context().setOffline(true);
    await expect(
      page.getByRole("heading", { name: "Continue evoluindo." }),
    ).toBeVisible();
    await expect(page.locator("body")).toHaveCSS(
      "background-color",
      "rgb(13, 20, 36)",
    );
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(() =>
        document.fonts.check('14px "Manrope Variable"'),
      ),
    ).toBe(true);
    expect(
      await page
        .locator('meta[http-equiv="Content-Security-Policy"]')
        .getAttribute("content"),
    ).not.toContain("ws://");
    const sandboxed = await app.evaluate(({ app, BrowserWindow }) => {
      const pid = BrowserWindow.getAllWindows()[0].webContents.getOSProcessId();
      return app.getAppMetrics().find((metric) => metric.pid === pid)
        ?.sandboxed;
    });
    expect(sandboxed).toBe(true);
    expect(
      await page.evaluate(
        () => typeof (window as unknown as { require?: unknown }).require,
      ),
    ).toBe("undefined");
    await expect(
      page.evaluate(() => window.sky!.createGoal(null as never)),
    ).rejects.toThrow();
    await expect(
      page.evaluate(() => window.sky!.openExternal("https://example.com/")),
    ).rejects.toThrow("Link não permitido");
    await expect(
      page.locator(".goals-panel").getByRole("heading", {
        name: "Sem metas programadas",
        exact: true,
      }),
    ).toBeVisible();
    await page.screenshot({ path: resolve(".test-data/dashboard-empty.png") });
    await page.getByRole("button", { name: "Nova meta", exact: true }).click();
    await page.getByLabel("O que você quer conquistar?").fill("Ler 10 páginas");
    await page.getByRole("button", { name: "Estudos", exact: true }).click();
    await page.getByRole("button", { name: "Criar minha meta" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page
      .getByRole("button", { name: "Concluir Ler 10 páginas", exact: true })
      .click();
    await expect(
      page.getByRole("progressbar", { name: "Metas diárias atingidas" }),
    ).toHaveAttribute("aria-valuenow", "100");
    await page.getByRole("button", { name: "Nova meta", exact: true }).click();
    await page
      .getByLabel("O que você quer conquistar?")
      .fill("Organizar a semana");
    await page
      .getByRole("button", { name: "Toda semana", exact: false })
      .click();
    await page.getByRole("button", { name: "Criar minha meta" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page.getByRole("button", { name: /^Da semana\s/ }).click();
    await page
      .getByRole("button", {
        name: "Não atingi Organizar a semana",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", { name: "Deixar Organizar a semana pendente" }),
    ).toHaveAttribute("aria-pressed", "true");
    await page
      .getByRole("button", { name: "Rotinas para inspirar", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Conhecer rotina de Ilia Topuria" })
      .click();
    await expect(
      page.getByText("Relato de Ilia Topuria · site oficial"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Quero experimentar" }).click();
    await expect(
      page.getByRole("button", {
        name: "Concluir Definir uma intenção para o dia",
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Concluir Definir uma intenção para o dia" })
      .click();
    if (await page.getByRole("button", { name: "Fechar aviso" }).isVisible())
      await page.getByRole("button", { name: "Fechar aviso" }).click();
    await page.screenshot({
      path: resolve(".test-data/dashboard.png"),
      fullPage: true,
    });
    const before = await page.evaluate(() => window.sky!.load());
    expect(before.goals).toHaveLength(6);
    expect(before.schemaVersion).toBe(4);
    expect(before.occurrences).toHaveLength(6);
    const userData = await app.evaluate(({ app }) => app.getPath("userData"));
    expect(userData).toBe(dataDir);
    expect(userData.startsWith(resolve("."))).toBe(false);
    await app.close();
    app = await launch();
    page = await app.firstWindow();
    await page.context().setOffline(true);
    await expect(
      page.getByRole("button", {
        name: "Desmarcar Ler 10 páginas",
        exact: true,
      }),
    ).toBeVisible();
    const after = await page.evaluate(() => window.sky!.load());
    expect(after).toEqual(before);
    await page
      .getByRole("button", { name: "Minhas metas", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await page
      .getByRole("button", { name: "Editar", exact: true })
      .first()
      .click();
    await page.getByLabel("O que você quer conquistar?").fill("Ler 15 páginas");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(
      page.getByText("Próxima versão: Ler 15 páginas"),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Ler 10 páginas", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Minha evolução", exact: true })
      .click();
    await page.getByRole("button", { name: "7 dias", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Cada dia, um passo a mais" }),
    ).toBeVisible();
    await page.screenshot({
      path: resolve(".test-data/evolution.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Meus dados e backups" }).click();
    await expect(
      page.getByText("Banco SQLite local", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(join(dataDir, "sky.sqlite"), { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Fechar janela", exact: true })
      .click();
    if (await page.getByRole("button", { name: "Fechar aviso" }).isVisible())
      await page.getByRole("button", { name: "Fechar aviso" }).click();
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setContentSize(1000, 720),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: resolve(".test-data/phase1-minimum.png"),
      fullPage: true,
    });
    expect(errors).toEqual([]);
  } finally {
    if (app) await app.close();
  }
});

test("desktop migrates legacy data with a rollback file and preserves it across another restart", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "ceu-e-limite-legacy-"));
  const bytes = await legacyFixture();
  writeFileSync(join(dataDir, "sky.sqlite"), bytes);
  const env: Record<string, string> = Object.fromEntries(
    Object.entries({ ...process.env, SKY_TEST_DATA_DIR: dataDir }).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  let app: ElectronApplication | undefined;
  try {
    app = await electron.launch({ args: [resolve(".")], env });
    let page = await app.firstWindow();
    await page.context().setOffline(true);
    await expect(
      page.getByRole("heading", { name: "Continue evoluindo." }),
    ).toBeVisible();
    const state = await page.evaluate(() => window.sky!.load());
    expect(state.schemaVersion).toBe(4);
    expect(state.goals).toHaveLength(4);
    expect(state.entries).toHaveLength(4);
    expect(
      state.occurrences!.find(
        (item) =>
          item.goalId === "archived" && item.periodStart === "2026-10-27",
      )!.status,
    ).toBe("done");
    const rollback = readdirSync(dataDir).find((name) =>
      name.includes(".pre-v2-"),
    )!;
    expect(readFileSync(join(dataDir, rollback))).toEqual(Buffer.from(bytes));
    await app.close();
    app = await electron.launch({ args: [resolve(".")], env });
    page = await app.firstWindow();
    await expect(
      page.getByRole("heading", { name: "Continue evoluindo." }),
    ).toBeVisible();
    expect(await page.evaluate(() => window.sky!.load())).toEqual(state);
  } finally {
    if (app) await app.close();
  }
});

test("scheduled goals can be revised, archived and deleted only when eligible, with all changes surviving restart", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "ceu-e-limite-goals-"));
  const env: Record<string, string> = Object.fromEntries(
    Object.entries({ ...process.env, SKY_TEST_DATA_DIR: dataDir }).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  const today = dateKey();
  const tomorrow = shiftDate(today, 1);
  const monday = shiftDate(weekStart(today), 7);
  let app: ElectronApplication | undefined;
  try {
    app = await electron.launch({ args: [resolve(".")], env });
    let page = await app.firstWindow();
    await page.context().setOffline(true);
    await page
      .getByRole("button", { name: "Minhas metas", exact: true })
      .click();
    await page.getByRole("button", { name: "Nova meta", exact: true }).click();
    await page
      .getByLabel("O que você quer conquistar?")
      .fill("Estudar com constância");
    await page
      .getByRole("button", { name: "Limpar dias", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Criar minha meta" }),
    ).toBeDisabled();
    const todayIndex = weekdays.findIndex(
      (day) => day.bit === weekdayBit(today),
    );
    await page
      .getByRole("button", { name: weekdays[todayIndex].name, exact: true })
      .click();
    await page
      .getByRole("button", {
        name: weekdays[(todayIndex + 2) % 7].name,
        exact: true,
      })
      .click();
    await page.getByRole("button", { name: "Criar minha meta" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page
      .getByRole("button", { name: "Visão geral", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Concluir Estudar com constância",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", {
        name: "Desmarcar Estudar com constância",
        exact: true,
      })
      .click();
    const protectedGoal = (await page.evaluate(() => window.sky!.load()))
      .goals[0];
    expect(protectedGoal.canDelete).toBe(false);
    await page
      .getByRole("button", { name: "Minhas metas", exact: true })
      .click();
    let card = page.getByRole("article").filter({
      has: page.getByRole("heading", {
        name: "Estudar com constância",
        exact: true,
      }),
    });
    await expect(
      card.getByRole("button", { name: "Excluir Estudar com constância" }),
    ).toHaveCount(0);
    await card.getByRole("button", { name: "Editar", exact: true }).click();
    await page
      .getByLabel("O que você quer conquistar?")
      .fill("Revisão semanal");
    await page.getByRole("button", { name: "Trabalho", exact: true }).click();
    await page.getByRole("button", { name: /Toda semana/ }).click();
    await page.getByLabel("Vigência da alteração").fill(monday);
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(
      card.getByText("Próxima versão: Revisão semanal"),
    ).toBeVisible();
    await card
      .getByRole("button", { name: "Histórico de Estudar com constância" })
      .click();
    await expect(page.getByText("Versão 1", { exact: true })).toBeVisible();
    await expect(page.getByText("Versão 2", { exact: true })).toBeVisible();
    await expect(page.getByText("Programada", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Fechar histórico" }).click();
    await page.getByRole("button", { name: "Nova meta", exact: true }).click();
    await page
      .getByLabel("O que você quer conquistar?")
      .fill("Planejar amanhã");
    await page.getByLabel("Começa em", { exact: true }).fill(tomorrow);
    await page.getByRole("button", { name: "Criar minha meta" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    if (await page.getByRole("button", { name: "Fechar aviso" }).isVisible())
      await page.getByRole("button", { name: "Fechar aviso" }).click();
    await page.screenshot({
      path: resolve(".test-data/phase2-goals.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Visão geral", exact: true })
      .click();
    if (weekStart(tomorrow) !== weekStart(today))
      await page
        .getByRole("button", { name: "Próxima semana", exact: true })
        .click();
    await page
      .getByRole("button", {
        name: parseDate(tomorrow).toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "numeric",
          month: "long",
        }),
        exact: true,
      })
      .click();
    await expect(
      page.getByText("AGENDA PLANEJADA", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Concluir Planejar amanhã",
        exact: true,
      }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Minhas metas", exact: true })
      .click();
    const disposable = page.getByRole("article").filter({
      has: page.getByRole("heading", {
        name: "Planejar amanhã",
        exact: true,
      }),
    });
    await disposable
      .getByRole("button", { name: "Excluir Planejar amanhã", exact: true })
      .click();
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(disposable).toBeVisible();
    await disposable
      .getByRole("button", { name: "Excluir Planejar amanhã", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Excluir definitivamente", exact: true })
      .click();
    await expect(disposable).toHaveCount(0);
    await expect(
      page.evaluate((id) => window.sky!.deleteGoal(id), protectedGoal.id),
    ).rejects.toThrow("histórico");
    card = page.getByRole("article").filter({
      has: page.getByRole("heading", {
        name: "Estudar com constância",
        exact: true,
      }),
    });
    await card
      .getByRole("button", {
        name: "Arquivar Estudar com constância",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Arquivar meta", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page.getByRole("button", { name: /^Arquivadas/ }).click();
    await expect(
      page.getByRole("heading", {
        name: "Estudar com constância",
        exact: true,
      }),
    ).toBeVisible();
    const before = await page.evaluate(() => window.sky!.load());
    expect(before.goals).toHaveLength(1);
    expect(before.revisions).toHaveLength(2);
    await app.close();
    app = await electron.launch({ args: [resolve(".")], env });
    page = await app.firstWindow();
    await expect(
      page.getByRole("heading", { name: "Continue evoluindo." }),
    ).toBeVisible();
    expect(await page.evaluate(() => window.sky!.load())).toEqual(before);
    await page
      .getByRole("button", { name: "Minhas metas", exact: true })
      .click();
    await page.getByRole("button", { name: /^Arquivadas/ }).click();
    await expect(
      page.getByRole("heading", {
        name: "Estudar com constância",
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    if (app) await app.close();
  }
});

test("MVP keeps daily and weekly progress separate and preserves planned rest after restart", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "ceu-e-limite-mvp-"));
  const env: Record<string, string> = Object.fromEntries(
    Object.entries({ ...process.env, SKY_TEST_DATA_DIR: dataDir }).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  const today = dateKey();
  const tomorrow = shiftDate(today, 1);
  let app: ElectronApplication | undefined;
  try {
    app = await electron.launch({ args: [resolve(".")], env });
    let page = await app.firstWindow();
    await page.context().setOffline(true);
    await expect(
      page
        .locator(".day-progress")
        .getByRole("heading", { name: "Sem metas programadas" }),
    ).toBeVisible();
    await expect(
      page.getByRole("progressbar", { name: "Metas diárias atingidas" }),
    ).toHaveCount(0);
    for (const title of [
      "Ler um capítulo",
      "Praticar um idioma",
      "Reservar um tempo para mim",
      "Planejar a semana",
    ]) {
      await page
        .getByRole("button", { name: "Nova meta", exact: true })
        .click();
      await page.getByLabel("O que você quer conquistar?").fill(title);
      if (title === "Planejar a semana")
        await page.getByRole("button", { name: /Toda semana/ }).click();
      await page
        .getByRole("button", { name: "Criar minha meta", exact: true })
        .click();
      await expect(page.getByRole("dialog")).not.toBeVisible();
    }
    await page
      .getByRole("button", { name: "Concluir Ler um capítulo", exact: true })
      .focus();
    await page.keyboard.press("Space");
    await expect(
      page.getByRole("button", {
        name: "Desmarcar Ler um capítulo",
        exact: true,
      }),
    ).toBeFocused();
    await expect(
      page.getByRole("progressbar", { name: "Metas diárias atingidas" }),
    ).toHaveAttribute("aria-valuenow", "33");
    await page
      .getByRole("button", {
        name: "Não atingi Praticar um idioma",
        exact: true,
      })
      .click();
    await expect(
      page
        .locator(".goal-row")
        .filter({ hasText: "Praticar um idioma" })
        .getByText("Não atingida", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^Da semana\s/ }).click();
    await page
      .getByRole("button", { name: "Concluir Planejar a semana", exact: true })
      .click();
    await expect(
      page.getByRole("progressbar", { name: "Metas semanais atingidas" }),
    ).toHaveAttribute("aria-valuenow", "100");
    await expect(
      page.getByRole("progressbar", { name: "Metas diárias atingidas" }),
    ).toHaveAttribute("aria-valuenow", "33");
    await page.getByRole("button", { name: /^Metas do dia/ }).click();
    if (await page.getByRole("button", { name: "Fechar aviso" }).isVisible())
      await page.getByRole("button", { name: "Fechar aviso" }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: resolve(".test-data/phase3-checklist.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Planejar descanso", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Confirmar descanso", exact: true }),
    ).toBeDisabled();
    await expect(page.getByRole("alert")).toContainText(
      "já teve resultados diários",
    );
    await page.getByLabel("Dia de descanso", { exact: true }).fill(tomorrow);
    await page
      .getByLabel("Uma observação")
      .fill("Um dia para recuperar as energias");
    await page
      .getByRole("button", { name: "Confirmar descanso", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(
      page
        .locator(".rest-day-banner")
        .getByRole("heading", { name: "Descanso planejado" }),
    ).toBeVisible();
    await expect(
      page.getByRole("progressbar", { name: "Metas diárias atingidas" }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Ajustar descanso", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Voltar à programação", exact: true })
      .click();
    await expect(
      page.getByText("AGENDA PLANEJADA", { exact: true }),
    ).toBeVisible();
    await expect(page.locator(".rest-day-banner")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Planejar descanso", exact: true })
      .click();
    await page
      .getByLabel("Uma observação")
      .fill("Um dia para recuperar as energias");
    await page
      .getByRole("button", { name: "Confirmar descanso", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    if (await page.getByRole("button", { name: "Fechar aviso" }).isVisible())
      await page.getByRole("button", { name: "Fechar aviso" }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: resolve(".test-data/phase3-rest.png"),
      fullPage: true,
    });
    const before = await page.evaluate(() => window.sky!.load());
    expect(before.dayPlans).toHaveLength(1);
    expect(before.events).toHaveLength(3);
    await app.close();
    app = await electron.launch({ args: [resolve(".")], env });
    page = await app.firstWindow();
    await expect(
      page.getByRole("progressbar", { name: "Metas diárias atingidas" }),
    ).toHaveAttribute("aria-valuenow", "33");
    expect(await page.evaluate(() => window.sky!.load())).toEqual(before);
    await page.getByLabel("Data da agenda", { exact: true }).fill(tomorrow);
    await expect(page.locator(".rest-day-banner")).toContainText(
      "Um dia para recuperar as energias",
    );
    await expect(
      page.getByRole("progressbar", { name: "Metas diárias atingidas" }),
    ).toHaveCount(0);
  } finally {
    if (app) await app.close();
  }
});

test("closed-day corrections require review, retain audit events and cannot rewrite a past rest day", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "ceu-e-limite-correction-"));
  const today = dateKey();
  const start = shiftDate(today, -3);
  const rest = shiftDate(today, -2);
  const yesterday = shiftDate(today, -1);
  const store = await SkyDatabase.open(
    join(dataDir, "sky.sqlite"),
    resolve("node_modules/sql.js/dist/sql-wasm.wasm"),
    { now: () => parseDate(start) },
  );
  const goalId = store.createGoal({
    title: "Aprender algo novo",
    description: "Um pouco a cada dia",
    category: "Estudos",
    frequency: "daily",
    startDate: start,
  }).goals[0].id;
  store.createGoal({
    title: "Organizar meu espaço",
    description: "",
    category: "Pessoal",
    frequency: "daily",
    startDate: start,
  });
  store.planRest(rest, "Descanso já planejado");
  store.close();
  const env: Record<string, string> = Object.fromEntries(
    Object.entries({ ...process.env, SKY_TEST_DATA_DIR: dataDir }).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  let app: ElectronApplication | undefined;
  try {
    app = await electron.launch({ args: [resolve(".")], env });
    let page = await app.firstWindow();
    await page.context().setOffline(true);
    await page.getByLabel("Data da agenda", { exact: true }).fill(yesterday);
    await expect(
      page
        .locator(".goal-row")
        .filter({ hasText: "Aprender algo novo" })
        .getByText("Sem registro", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Concluir Aprender algo novo", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Corrigir resultado no histórico",
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    expect((await page.evaluate(() => window.sky!.load())).events).toHaveLength(
      0,
    );
    await page
      .getByRole("button", { name: "Concluir Aprender algo novo", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Salvar correção", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(
      page.getByRole("progressbar", { name: "Metas diárias atingidas" }),
    ).toHaveAttribute("aria-valuenow", "50");
    await page
      .getByRole("button", {
        name: "Não atingi Aprender algo novo",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Salvar correção", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(
      page.getByRole("progressbar", { name: "Metas diárias atingidas" }),
    ).toHaveAttribute("aria-valuenow", "0");
    await page
      .getByRole("button", {
        name: "Registros de Aprender algo novo",
        exact: true,
      })
      .click();
    await expect(
      page.getByText("Correção no calendário", { exact: true }),
    ).toHaveCount(2);
    await expect(
      page.getByText("Pendente → Atingida", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Atingida → Não atingida", { exact: true }),
    ).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: resolve(".test-data/phase3-correction.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Fechar registros", exact: true })
      .click();
    await page.getByLabel("Data da agenda", { exact: true }).fill(rest);
    await expect(page.locator(".rest-day-banner")).toContainText(
      "Descanso já planejado",
    );
    await expect(
      page.getByRole("button", { name: "Ajustar descanso", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.evaluate((date) => window.sky!.removeRest(date), rest),
    ).rejects.toThrow("encerrado");
    await expect(
      page.evaluate((date) => window.sky!.planRest(date, ""), rest),
    ).rejects.toThrow("futura");
    await expect(
      page.evaluate(({ id, date }) => window.sky!.setStatus(id, date, "done"), {
        id: goalId,
        date: rest,
      }),
    ).rejects.toThrow("disponível");
    const before = await page.evaluate(() => window.sky!.load());
    expect(before.events).toHaveLength(2);
    expect(before.dayPlans).toHaveLength(1);
    await app.close();
    app = await electron.launch({ args: [resolve(".")], env });
    page = await app.firstWindow();
    await expect(
      page.getByRole("heading", { name: "Continue evoluindo." }),
    ).toBeVisible();
    expect(await page.evaluate(() => window.sky!.load())).toEqual(before);
    await page.getByLabel("Data da agenda", { exact: true }).fill(yesterday);
    await page
      .getByRole("button", {
        name: "Registros de Aprender algo novo",
        exact: true,
      })
      .click();
    await expect(
      page.getByText("Correção no calendário", { exact: true }),
    ).toHaveCount(2);
  } finally {
    if (app) await app.close();
  }
});
