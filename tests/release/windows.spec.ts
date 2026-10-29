import {
  _electron as electron,
  chromium,
  expect,
  test,
  type ElectronApplication,
} from "@playwright/test";
import { execFile, spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { createServer } from "node:net";
import { dateKey } from "../../shared/domain";

const exec = promisify(execFile);
const output = resolve("release");
const portable = join(
  output,
  "O-Ceu-e-o-Limite-1.0.0-Windows-x64-Portatil.exe",
);
const installer = join(
  output,
  "O-Ceu-e-o-Limite-1.0.0-Windows-x64-Instalador.exe",
);
const unpacked = join(output, "win-unpacked/O-Ceu-e-o-Limite.exe");
const powershell = join(
  process.env.SystemRoot ?? "C:\\Windows",
  "System32/WindowsPowerShell/v1.0/powershell.exe",
);
mkdirSync(".test-data", { recursive: true });
function appEnv() {
  const env = {
    ...process.env,
    PATH: join(process.env.SystemRoot ?? "C:\\Windows", "System32"),
    SKY_TEST_DATA_DIR: resolve(".test-data/packaged-must-ignore-this"),
    VITE_DEV_SERVER_URL: "http://127.0.0.1:1",
  };
  delete (env as NodeJS.ProcessEnv).ELECTRON_RUN_AS_NODE;
  return env;
}
async function launch(executablePath: string, profile: string, scale?: number) {
  return electron.launch({
    executablePath,
    args: [
      `--user-data-dir=${profile}`,
      ...(scale ? [`--force-device-scale-factor=${scale}`] : []),
    ],
    env: appEnv(),
    timeout: 120000,
  });
}
async function launchPortable(profile: string) {
  const server = createServer();
  const port = await new Promise<number>((resolvePort) =>
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as { port: number }).port;
      server.close(() => resolvePort(port));
    }),
  );
  const endpoint = `http://127.0.0.1:${port}`;
  const child = spawn(
    portable,
    [`--user-data-dir=${profile}`, `--remote-debugging-port=${port}`],
    { env: appEnv(), windowsHide: true, stdio: "ignore" },
  );
  child.on("error", () => {});
  await expect
    .poll(
      async () => {
        try {
          return (await fetch(`${endpoint}/json/version`)).ok;
        } catch {
          return false;
        }
      },
      { timeout: 60000 },
    )
    .toBe(true);
  const browser = await chromium.connectOverCDP(endpoint);
  const page = browser.contexts()[0].pages()[0];
  return {
    page,
    close: async () => {
      try {
        if (!page.isClosed()) await page.close();
      } finally {
        await browser.close();
      }
      if (child.exitCode === null)
        await new Promise<void>((done) => {
          const timer = setTimeout(done, 10000);
          child.once("exit", () => {
            clearTimeout(timer);
            done();
          });
        });
      if (child.exitCode === null && child.pid)
        await exec("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
          windowsHide: true,
        });
    },
  };
}
async function native(
  pid: number,
  action: "Cancel" | "Choose" | "Confirm",
  path?: string,
) {
  return exec(
    powershell,
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      resolve("tests/release/native-dialog.ps1"),
      "-OwnerProcessId",
      String(pid),
      "-Action",
      action,
      ...(path ? ["-FilePath", path] : []),
    ],
    { windowsHide: true, timeout: 30000 },
  );
}
async function setup(
  action: "Install" | "Uninstall",
  executable: string,
  directory: string,
) {
  return exec(
    powershell,
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      resolve("tests/release/installer.ps1"),
      "-Action",
      action,
      "-Executable",
      executable,
      "-InstallDir",
      directory,
    ],
    { windowsHide: true, timeout: 100000 },
  );
}
test("portable and installed binaries share data, survive restart and reinstall, preserve data on uninstall and use real Windows backup dialogs", async () => {
  const profile = mkdtempSync(join(tmpdir(), "ceu-e-limite-release-"));
  const directory = mkdtempSync(resolve(".test-data/release-installed-"));
  const installed = join(directory, "O-Ceu-e-o-Limite.exe");
  const backup = join(profile, "exported.sqlite");
  let app: ElectronApplication | undefined;
  let portableApp: Awaited<ReturnType<typeof launchPortable>> | undefined;
  let owned = false;
  try {
    await setup("Install", installer, directory);
    owned = true;
    expect(existsSync(installed)).toBe(true);
    portableApp = await launchPortable(profile);
    let page = portableApp.page;
    await page.context().setOffline(true);
    await expect(
      page.getByRole("heading", { name: "Continue evoluindo.", exact: true }),
    ).toBeVisible();
    expect(page.url()).toMatch(/app\.asar\/dist\/index\.html$/);
    expect(
      existsSync(resolve(".test-data/packaged-must-ignore-this/sky.sqlite")),
    ).toBe(false);
    expect((await page.evaluate(() => window.sky!.storageInfo())).path).toBe(
      join(profile, "sky.sqlite"),
    );
    await page.getByRole("button", { name: "Nova meta", exact: true }).click();
    await page
      .getByLabel("O que você quer conquistar?", { exact: true })
      .fill("Abrir o céu todos os dias");
    await page
      .getByRole("button", { name: "Criar minha meta", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    const goal = (await page.evaluate(() => window.sky!.load())).goals[0];
    await page.evaluate(
      ({ id, date }) => window.sky!.setStatus(id, date, "done"),
      { id: goal.id, date: dateKey() },
    );
    await page.reload();
    const original = await page.evaluate(() => window.sky!.load());
    const beforeSecond = readFileSync(join(profile, "sky.sqlite"));
    await exec(installed, [`--user-data-dir=${profile}`], {
      env: appEnv(),
      windowsHide: true,
      timeout: 20000,
    });
    expect(readFileSync(join(profile, "sky.sqlite"))).toEqual(beforeSecond);
    expect(portableApp.page.context().pages()).toHaveLength(1);
    await portableApp.close();
    portableApp = undefined;
    await setup("Install", installer, directory);
    app = await launch(installed, profile);
    page = await app.firstWindow();
    await page.context().setOffline(true);
    await expect(
      page.getByRole("heading", { name: "Continue evoluindo.", exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => window.sky!.load())).toEqual(original);
    expect(await app.evaluate(({ app }) => app.getPath("userData"))).toBe(
      profile,
    );
    expect(
      await app.evaluate(({ app }) => ({
        packaged: app.isPackaged,
        version: app.getVersion(),
      })),
    ).toEqual({ packaged: true, version: "1.0.0" });
    const nativePid = await app.evaluate(() => process.pid);
    await page
      .getByRole("button", { name: "Meus dados e backups", exact: true })
      .click();
    const cancel = native(nativePid, "Cancel");
    await page
      .getByRole("button", { name: "Exportar backup", exact: true })
      .click();
    await cancel;
    await expect(page.locator(".backup-notice.cancelled")).toContainText(
      "cancelada",
    );
    const save = native(nativePid, "Choose", backup);
    await page
      .getByRole("button", { name: "Exportar backup", exact: true })
      .click();
    await save;
    await expect(page.locator(".backup-notice.success")).toContainText(
      "salva e conferida",
    );
    expect(readFileSync(backup).subarray(0, 15).toString()).toBe(
      "SQLite format 3",
    );
    await page
      .getByRole("button", { name: "Fechar janela", exact: true })
      .click();
    await page.evaluate(() =>
      window.sky!.createGoal({
        title: "Depois da exportação",
        description: "",
        category: "Pessoal",
        frequency: "daily",
        startDate: new Date().toLocaleDateString("en-CA"),
      }),
    );
    await page
      .getByRole("button", { name: "Meus dados e backups", exact: true })
      .click();
    const choose = native(nativePid, "Choose", backup);
    await page
      .getByRole("button", { name: "Restaurar backup", exact: true })
      .click();
    await choose;
    await native(nativePid, "Confirm");
    await expect(page.locator(".backup-notice.success")).toContainText(
      "Cópia restaurada",
    );
    expect(await page.evaluate(() => window.sky!.load())).toEqual(original);
    await page
      .getByRole("dialog")
      .screenshot({ path: resolve(".test-data/phase8-installed-backup.png") });
    await app.close();
    app = undefined;
    const preserved = readFileSync(join(profile, "sky.sqlite"));
    const uninstaller = join(
      directory,
      readdirSync(directory).find((name) => /^Uninstall.*\.exe$/i.test(name))!,
    );
    await setup("Uninstall", uninstaller, directory);
    owned = false;
    await expect.poll(() => existsSync(installed)).toBe(false);
    expect(readFileSync(join(profile, "sky.sqlite"))).toEqual(preserved);
    portableApp = await launchPortable(profile);
    page = portableApp.page;
    await page.context().setOffline(true);
    await expect(
      page.getByRole("heading", { name: "Continue evoluindo.", exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => window.sky!.load())).toEqual(original);
    await page.screenshot({
      path: resolve(".test-data/phase8-portable.png"),
      fullPage: true,
    });
  } finally {
    if (portableApp) await portableApp.close();
    if (app) await app.close();
    if (owned) {
      const name = readdirSync(directory).find((name) =>
        /^Uninstall.*\.exe$/i.test(name),
      );
      if (name) await setup("Uninstall", join(directory, name), directory);
    }
  }
});

for (const scale of [1.25, 1.5])
  test(`packaged layout fits 1000 x 720 at ${scale * 100}% scale offline`, async () => {
    const profile = mkdtempSync(join(tmpdir(), "ceu-e-limite-release-scale-"));
    const app = await launch(unpacked, profile, scale);
    try {
      const page = await app.firstWindow();
      await page.context().setOffline(true);
      await expect(
        page.getByRole("heading", { name: "Continue evoluindo.", exact: true }),
      ).toBeVisible();
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].setContentSize(1000, 720),
      );
      expect(await page.evaluate(() => window.devicePixelRatio)).toBeCloseTo(
        scale,
        1,
      );
      for (const name of [
        "Minhas metas",
        "Minha evolução",
        "Rotinas para inspirar",
        "Meu caminho",
      ]) {
        await page.getByRole("button", { name, exact: true }).click();
        await expect
          .poll(() =>
            page.evaluate(
              () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
          )
          .toBe(true);
      }
      await page.screenshot({
        path: resolve(`.test-data/phase8-scale-${scale * 100}.png`),
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "Meus dados e backups", exact: true })
        .click();
      await expect(
        page.getByText("Banco SQLite local", { exact: true }),
      ).toBeVisible();
      await page.locator(".recovery-guide summary").click();
      await expect(
        page.getByRole("heading", {
          name: "Se o aplicativo não conseguir abrir",
          exact: true,
        }),
      ).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        )
        .toBe(true);
    } finally {
      await app.close();
    }
  });
