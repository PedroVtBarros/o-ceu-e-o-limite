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
import { routines } from "../../shared/routines";
import { defaultRoutineInput } from "../../shared/routineRuns";
import { sqliteBytes } from "../../electron/storage/files";

const wasm = resolve("node_modules/sql.js/dist/sql-wasm.wasm");
function environment(dir: string) {
  const env: Record<string, string> = Object.fromEntries(
    Object.entries({ ...process.env, SKY_TEST_DATA_DIR: dir }).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  return env;
}

test("journey recalculates levels after corrections, keeps long-term goals separate and persists themes and encouragement offline", async () => {
  mkdirSync(resolve(".test-data"), { recursive: true });
  const dir = mkdtempSync(join(tmpdir(), "ceu-e-limite-journey-"));
  const today = dateKey(),
    yesterday = shiftDate(today, -1),
    start = shiftDate(today, -9);
  let day = start;
  const store = await SkyDatabase.open(join(dir, "sky.sqlite"), wasm, {
    now: () => parseDate(day),
  });
  const daily = store.createGoal({
    title: "Ler um capítulo",
    description: "Um passo por dia",
    category: "Estudos",
    frequency: "daily",
    startDate: start,
  }).goals[0].id;
  store.createGoal({
    title: "Planejar minha semana",
    description: "",
    category: "Pessoal",
    frequency: "weekly",
    startDate: start,
  });
  day = today;
  store.load();
  for (let date = start; date < today; date = shiftDate(date, 1))
    store.setStatus(daily, date, "done");
  store.close();
  const env = environment(dir);
  let app: ElectronApplication | undefined;
  try {
    app = await electron.launch({ args: [resolve(".")], env });
    let page = await app.firstWindow();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.context().setOffline(true);
    await page
      .getByRole("button", { name: "Meu caminho", exact: true })
      .click();
    await expect(page.getByTestId("journey-points")).toHaveText("90 XP");
    await expect(
      page.getByRole("heading", {
        name: "Nível 1 · Primeiro passo",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByTestId("achievement-ten")).toContainText(
      "Em construção",
    );
    await expect(page.getByTestId("achievement-seven")).toContainText(
      "Conquistada",
    );
    await page.locator(".level-rules summary").click();
    await expect(page.locator(".level-thresholds > div")).toHaveCount(5);
    await expect(page.locator(".level-rules")).toContainText("10 XP");
    await page
      .getByRole("button", { name: "Visão geral", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Concluir Ler um capítulo", exact: true })
      .click();
    await expect(
      page.getByRole("progressbar", {
        name: "Metas diárias atingidas",
        exact: true,
      }),
    ).toHaveAttribute("aria-valuenow", "100");
    await page
      .getByRole("button", { name: "Meu caminho", exact: true })
      .click();
    await expect(page.getByTestId("journey-points")).toHaveText("100 XP");
    await expect(
      page.getByRole("heading", {
        name: "Nível 2 · Criando raízes",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByTestId("achievement-ten")).toContainText(
      "Conquistada",
    );
    await page
      .getByRole("button", { name: "Objetivos de longo prazo", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Novo objetivo", exact: true })
      .click();
    await page
      .getByLabel("Nome do objetivo", { exact: true })
      .fill("Ler 12 livros");
    await page
      .getByLabel("Por que este objetivo importa?", { exact: true })
      .fill("Ampliar meu repertório");
    await page
      .getByLabel("Categoria do objetivo", { exact: true })
      .selectOption("Estudos");
    await page.getByLabel("Quantidade desejada", { exact: true }).fill("12");
    await page.getByLabel("Progresso atual", { exact: true }).fill("3");
    await page.getByLabel("Unidade", { exact: true }).fill("livros");
    await page
      .getByLabel("Prazo do objetivo", { exact: true })
      .fill(shiftDate(today, 40));
    await page
      .getByRole("button", { name: "Criar objetivo", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(
      page.getByRole("progressbar", {
        name: "Progresso de Ler 12 livros",
        exact: true,
      }),
    ).toHaveAttribute("aria-valuenow", "25");
    const saved = await page.evaluate(() => window.sky!.load());
    const goal = saved.longTermGoals![0];
    await page.evaluate(
      (goal) =>
        Promise.all([
          window.sky!.createLongTermGoal(goal),
          window.sky!.createLongTermGoal(goal),
        ]),
      goal,
    );
    expect(
      (await page.evaluate(() => window.sky!.load())).longTermGoals,
    ).toHaveLength(1);
    await page
      .getByRole("button", {
        name: "Atualizar objetivo Ler 12 livros",
        exact: true,
      })
      .click();
    await page.getByLabel("Progresso atual", { exact: true }).fill("12");
    await page
      .getByRole("button", { name: "Salvar objetivo", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.locator(".objective-state")).toHaveText("Concluído");
    await page.getByRole("button", { name: "Conquistas", exact: true }).click();
    await expect(page.getByTestId("journey-points")).toHaveText("100 XP");
    await page
      .getByRole("button", { name: "Objetivos de longo prazo", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Atualizar objetivo Ler 12 livros",
        exact: true,
      })
      .click();
    await page.getByLabel("Progresso atual", { exact: true }).fill("6");
    await page
      .getByRole("button", { name: "Salvar objetivo", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page
      .getByRole("button", {
        name: "Arquivar objetivo Ler 12 livros",
        exact: true,
      })
      .click();
    await expect(page.locator(".objective-card")).toHaveCount(0);
    await page.getByRole("button", { name: "Arquivados", exact: true }).click();
    await expect(page.locator(".objective-state")).toHaveText("Arquivado");
    await page
      .getByRole("button", {
        name: "Reativar objetivo Ler 12 livros",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Em acompanhamento", exact: true })
      .click();
    await expect(
      page.getByRole("progressbar", {
        name: "Progresso de Ler 12 livros",
        exact: true,
      }),
    ).toHaveAttribute("aria-valuenow", "50");
    const afterGoal = await page.evaluate(() => window.sky!.load());
    expect(afterGoal.goals).toEqual(saved.goals);
    expect(afterGoal.occurrences).toEqual(saved.occurrences);
    expect(afterGoal.events).toEqual(saved.events);
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
      path: resolve(".test-data/phase6-objectives.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Personalizar", exact: true })
      .click();
    await expect(
      page.getByRole("radio", { name: "Violeta", exact: true }),
    ).toBeChecked();
    await page.getByRole("radio", { name: "Oceano", exact: true }).focus();
    await page.keyboard.press("Space");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "ocean");
    await expect(page.locator("body")).toHaveCSS(
      "background-color",
      "rgb(12, 25, 41)",
    );
    await expect(
      page.getByRole("radio", { name: "Oceano", exact: true }),
    ).toBeFocused();
    await expect(
      page.getByRole("radio", { name: "Oceano", exact: true }),
    ).toHaveCSS("outline-style", "solid");
    await expect(
      page.getByRole("radio", { name: "Oceano", exact: true }),
    ).toHaveCSS("outline-color", "rgb(158, 207, 255)");
    await page.getByRole("radio", { name: "Floresta", exact: true }).check();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "forest");
    await expect(page.locator("body")).toHaveCSS(
      "background-color",
      "rgb(13, 29, 27)",
    );
    await page.getByRole("radio", { name: "Oceano", exact: true }).check();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "ocean");
    await page
      .getByRole("checkbox", {
        name: "Mostrar mensagens de incentivo",
        exact: true,
      })
      .uncheck();
    await expect(
      page.getByRole("checkbox", {
        name: "Mostrar mensagens de incentivo",
        exact: true,
      }),
    ).not.toBeChecked();
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
      path: resolve(".test-data/phase6-preferences.png"),
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
    await page
      .getByRole("button", { name: "Visão geral", exact: true })
      .click();
    await expect(page.locator(".sidebar-inspiration")).toHaveCount(0);
    await expect(page.locator(".encouragement-text")).toHaveCount(0);
    await expect(
      page.getByRole("progressbar", {
        name: "Metas diárias atingidas",
        exact: true,
      }),
    ).toHaveAttribute("aria-valuenow", "100");
    await page.getByLabel("Data da agenda", { exact: true }).fill(yesterday);
    await page
      .getByRole("button", { name: "Desmarcar Ler um capítulo", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Salvar correção", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page
      .getByRole("button", { name: "Meu caminho", exact: true })
      .click();
    await expect(page.getByTestId("journey-points")).toHaveText("90 XP");
    await expect(page.getByTestId("achievement-ten")).toContainText(
      "Em construção",
    );
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    const before = await page.evaluate(() => window.sky!.load());
    await app.close();
    app = await electron.launch({ args: [resolve(".")], env });
    page = await app.firstWindow();
    await page.context().setOffline(true);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "ocean");
    await expect(page.locator(".encouragement-text")).toHaveCount(0);
    await expect(
      page.getByRole("progressbar", {
        name: "Metas diárias atingidas",
        exact: true,
      }),
    ).toHaveAttribute("aria-valuenow", "100");
    expect(await page.evaluate(() => window.sky!.load())).toEqual(before);
    await page
      .getByRole("button", { name: "Meu caminho", exact: true })
      .click();
    await expect(page.getByTestId("journey-points")).toHaveText("90 XP");
    await page
      .getByRole("button", { name: "Objetivos de longo prazo", exact: true })
      .click();
    await expect(
      page.getByRole("progressbar", {
        name: "Progresso de Ler 12 livros",
        exact: true,
      }),
    ).toHaveAttribute("aria-valuenow", "50");
    await page
      .getByRole("button", { name: "Visão geral", exact: true })
      .click();
    await page.getByLabel("Data da agenda", { exact: true }).fill(yesterday);
    await page
      .getByRole("button", { name: "Concluir Ler um capítulo", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Salvar correção", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page
      .getByRole("button", { name: "Meu caminho", exact: true })
      .click();
    await expect(page.getByTestId("journey-points")).toHaveText("100 XP");
    await expect(page.getByTestId("achievement-ten")).toContainText(
      "Conquistada",
    );
    if (
      await page
        .getByRole("button", { name: "Fechar aviso", exact: true })
        .isVisible()
    )
      await page
        .getByRole("button", { name: "Fechar aviso", exact: true })
        .click();
    await page.locator(".level-rules summary").click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: resolve(".test-data/phase6-achievements.png"),
      fullPage: true,
    });
    expect(errors).toEqual([]);
  } finally {
    if (app) await app.close();
  }
});

test("desktop upgrades an original v3 shape with exact rollback and computes milestones from preserved history", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ceu-e-limite-personal-v3-"));
  const file = join(dir, "sky.sqlite"),
    today = dateKey();
  const store = await SkyDatabase.open(file, wasm);
  const weekly = store.createGoal({
    title: "Organizar semana",
    description: "",
    category: "Pessoal",
    frequency: "weekly",
    startDate: today,
  }).goals[0].id;
  const draft = defaultRoutineInput(routines[0], today, "old-v3-run");
  draft.activities[0] = {
    ...draft.activities[0],
    time: "09:00",
    minutes: 10,
    intensity: "Com calma",
  };
  const run = store.startRoutine(draft).routineRuns![0];
  store.setStatus(weekly, today, "done");
  store.setStatus(run.activities[0].goals[0].id, today, "done");
  store.setStatus(run.activities[1].goals[0].id, today, "done");
  const original = store.snapshot(),
    exported = store.exportBytes();
  store.close();
  const SQL = await initSqlJs({ locateFile: () => wasm });
  const old = new SQL.Database(exported);
  old.run("DROP TABLE long_term_goals");
  old.run("DROP TABLE personal_preferences");
  old.run("DELETE FROM schema_migrations WHERE version = 4");
  old.run("PRAGMA user_version = 3");
  const bytes = sqliteBytes(old);
  old.close();
  writeFileSync(file, bytes);
  const env = environment(dir);
  let app: ElectronApplication | undefined;
  try {
    app = await electron.launch({ args: [resolve(".")], env });
    let page = await app.firstWindow();
    await page.context().setOffline(true);
    await expect(
      page.getByRole("button", {
        name: "Desmarcar Definir uma intenção para o dia",
        exact: true,
      }),
    ).toBeVisible();
    expect(await page.evaluate(() => window.sky!.load())).toEqual(original);
    await page
      .getByRole("button", { name: "Meu caminho", exact: true })
      .click();
    await expect(page.getByTestId("journey-points")).toHaveText("30 XP");
    await expect(page.getByTestId("achievement-routine")).toContainText(
      "Conquistada",
    );
    await expect(page.getByTestId("achievement-weekly")).toContainText(
      "Conquistada",
    );
    const backups = readdirSync(dir).filter((name) =>
      name.includes(".pre-v4-"),
    );
    expect(backups).toHaveLength(1);
    expect(readFileSync(join(dir, backups[0]))).toEqual(Buffer.from(bytes));
    await app.close();
    app = await electron.launch({ args: [resolve(".")], env });
    page = await app.firstWindow();
    await expect(
      page.getByRole("heading", { name: "Continue evoluindo." }),
    ).toBeVisible();
    expect(await page.evaluate(() => window.sky!.load())).toEqual(original);
    expect(
      readdirSync(dir).filter((name) => name.includes(".pre-v4-")),
    ).toHaveLength(1);
  } finally {
    if (app) await app.close();
  }
});
