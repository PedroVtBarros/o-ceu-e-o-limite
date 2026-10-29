import { afterEach, expect, test, vi } from "vitest";
import initSqlJs from "sql.js";
import {
  closeSync,
  existsSync,
  ftruncateSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  rmdirSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { SkyDatabase } from "../electron/database";
import { BackupService, type BackupDialogs } from "../electron/backup";
import {
  assertExportDestination,
  assertImportSource,
  backupError,
  readBackupFile,
  sameFile,
} from "../electron/storage/backupFiles";
import { MAX_BACKUP_BYTES } from "../shared/backup";
import { parseDate } from "../shared/domain";
import { defaultRoutineInput } from "../shared/routineRuns";
import { routines } from "../shared/routines";
import { validateDatabase } from "../electron/storage/validation";

const faults = vi.hoisted(() => ({
  renameTo: "",
  openPrefix: "",
  fsync: false,
}));
vi.mock("node:fs", async (original) => {
  const fs = await original<typeof import("node:fs")>();
  return {
    ...fs,
    renameSync: (
      source: import("node:fs").PathLike,
      destination: import("node:fs").PathLike,
    ) => {
      if (faults.renameTo && String(destination) === faults.renameTo)
        throw Object.assign(new Error("test rename blocked"), {
          code: "EACCES",
        });
      return fs.renameSync(source, destination);
    },
    openSync: (
      path: import("node:fs").PathLike,
      flags: import("node:fs").OpenMode,
      mode?: import("node:fs").Mode,
    ) => {
      if (
        faults.openPrefix &&
        String(path).startsWith(faults.openPrefix) &&
        flags === "wx"
      )
        throw Object.assign(new Error("test checkpoint blocked"), {
          code: "EACCES",
        });
      return fs.openSync(path, flags, mode);
    },
    fsyncSync: (fd: number) => {
      if (faults.fsync)
        throw Object.assign(new Error("test disk full"), { code: "ENOSPC" });
      return fs.fsyncSync(fd);
    },
  };
});
afterEach(() => {
  faults.renameTo = "";
  faults.openPrefix = "";
  faults.fsync = false;
});
const wasm = resolve("node_modules/sql.js/dist/sql-wasm.wasm");
mkdirSync(".test-data", { recursive: true });
async function setup() {
  const dir = mkdtempSync(resolve(".test-data/backup-"));
  const file = join(dir, "sky.sqlite"),
    selected = join(dir, "chosen.sqlite");
  let day = "2026-10-26";
  const store = await SkyDatabase.open(file, wasm, {
    now: () => parseDate(day),
  });
  const ports = {
    chooseExport: vi.fn(async (): Promise<string | null> => selected),
    chooseImport: vi.fn(async (): Promise<string | null> => selected),
    confirmRestore: vi.fn(async (): Promise<boolean> => true),
  };
  return {
    store,
    file,
    selected,
    dir,
    ports,
    service: new BackupService(store, ports),
    advance: (next: string) => {
      day = next;
      store.load();
    },
    reopen: () => SkyDatabase.open(file, wasm, { now: () => parseDate(day) }),
  };
}
const create = (store: SkyDatabase, title = "Ler") =>
  store
    .createGoal({
      title,
      description: "",
      category: "Estudos",
      frequency: "daily",
      startDate: "2026-10-26",
    })
    .goals.at(-1)!.id;

test("export, prepare, restore and reopen preserve every data family and create a durable pre-restore copy", async () => {
  const { store, file, selected, service, advance, reopen, dir } =
    await setup();
  const id = create(store);
  store.setStatus(id, "2026-10-26", "done");
  const weekly = store
    .createGoal({
      title: "Planejar",
      description: "Semanal",
      category: "Pessoal",
      frequency: "weekly",
      startDate: "2026-10-26",
    })
    .goals.at(-1)!.id;
  store.setStatus(weekly, "2026-10-26", "done");
  const draft = defaultRoutineInput(routines[0], "2026-10-26", "full-backup");
  draft.activities[0] = {
    ...draft.activities[0],
    time: "08:30",
    minutes: 15,
    intensity: "Com calma",
  };
  const run = store.startRoutine(draft).routineRuns![0];
  store.setStatus(run.activities[0].goals[0].id, "2026-10-26", "missed");
  store.planRest("2026-10-27", "Recuperar");
  store.updateGoal(id, {
    title: "Novo nome",
    description: "Futuro",
    category: "Trabalho",
    effectiveFrom: "2026-10-28",
  });
  store.createLongTermGoal({
    operationKey: "objective",
    title: "Ler 12 livros",
    description: "",
    category: "Estudos",
    target: 12,
    current: 3,
    unit: "livros",
    dueOn: "2026-12-31",
  });
  store.updatePreferences({ theme: "forest", showEncouragement: false });
  const expected = store.snapshot();
  const exported = await service.export();
  expect(exported?.path).toBe(selected);
  const sourceBytes = readFileSync(selected);
  const SQL = await initSqlJs({ locateFile: () => wasm });
  const db = new SQL.Database(sourceBytes);
  validateDatabase(db);
  db.close();
  create(store, "Uma meta posterior");
  store.updatePreferences({ theme: "ocean", showEncouragement: true });
  const previous = store.snapshot(),
    previousBytes = readFileSync(file);
  const restored = await service.restore();
  expect(restored?.snapshot).toEqual(expected);
  expect(
    restored?.snapshot.goals.find((goal) => goal.id === id)!.canDelete,
  ).toBe(false);
  expect(readFileSync(restored!.recoveryPath)).toEqual(previousBytes);
  expect(readFileSync(selected)).toEqual(sourceBytes);
  advance("2026-10-28"); // An ordinary write rotates .bak, not the independent restore copy.
  expect(readFileSync(restored!.recoveryPath)).toEqual(previousBytes);
  const current = store.snapshot();
  store.close();
  const reopened = await reopen();
  expect(reopened.snapshot()).toEqual(current);
  const undo = reopened.prepareImport(readFileSync(restored!.recoveryPath));
  expect(undo.preview.goals).toBe(previous.goals.length);
  undo.dispose();
  reopened.close();
  expect(
    readdirSync(dir).filter((name) => name.includes(".pre-restore-")),
  ).toHaveLength(1);
});

test("cancelling either file picker or the validated confirmation never changes active memory, source, or backups", async () => {
  const { store, file, selected, dir, ports, service } = await setup();
  try {
    create(store);
    writeFileSync(selected, store.exportBytes());
    const snapshot = store.snapshot(),
      bytes = readFileSync(file),
      source = readFileSync(selected),
      names = readdirSync(dir);
    ports.chooseExport.mockResolvedValueOnce(null);
    expect(await service.export()).toBeNull();
    ports.chooseImport.mockResolvedValueOnce(null);
    expect(await service.restore()).toBeNull();
    expect(ports.confirmRestore).not.toHaveBeenCalled();
    ports.confirmRestore.mockResolvedValueOnce(false);
    expect(await service.restore()).toBeNull();
    expect(ports.confirmRestore).toHaveBeenCalledTimes(1);
    expect(store.snapshot()).toEqual(snapshot);
    expect(readFileSync(file)).toEqual(bytes);
    expect(readFileSync(selected)).toEqual(source);
    expect(readdirSync(dir)).toEqual(names);
    expect(service.busy).toBe(false);
  } finally {
    store.close();
  }
});

test("invalid, corrupt, unknown and future copies are refused before a destructive confirmation", async () => {
  const { store, file, selected, ports, service, dir } = await setup();
  try {
    create(store);
    const snapshot = store.snapshot(),
      bytes = readFileSync(file);
    const SQL = await initSqlJs({ locateFile: () => wasm });
    const future = new SQL.Database();
    future.run("PRAGMA user_version = 99");
    const unknown = new SQL.Database();
    unknown.run("PRAGMA user_version = 0");
    const bad = [
      new Uint8Array(),
      Buffer.from("not SQLite"),
      Buffer.concat([Buffer.from("SQLite format 3\0"), Buffer.alloc(200)]),
      future.export(),
      unknown.export(),
    ];
    for (const candidate of bad) {
      writeFileSync(selected, candidate);
      const original = readFileSync(selected);
      await expect(service.restore()).rejects.toThrow();
      expect(ports.confirmRestore).not.toHaveBeenCalled();
      expect(readFileSync(file)).toEqual(bytes);
      expect(store.snapshot()).toEqual(snapshot);
      expect(readFileSync(selected)).toEqual(original);
    }
    future.close();
    unknown.close();
    expect(
      readdirSync(dir).some((name) => name.includes(".pre-restore-")),
    ).toBe(false);
  } finally {
    store.close();
  }
});

test("file size is checked before allocating or reading oversized content", async () => {
  const { store, selected, service, ports } = await setup();
  try {
    const fd = openSync(selected, "w");
    ftruncateSync(fd, MAX_BACKUP_BYTES + 1);
    closeSync(fd);
    expect(() => readBackupFile(selected)).toThrow("50 MB");
    await expect(service.restore()).rejects.toThrow("50 MB");
    expect(ports.confirmRestore).not.toHaveBeenCalled();
    expect(() =>
      store.prepareImport(new Uint8Array(MAX_BACKUP_BYTES + 1)),
    ).toThrow("50 MB");
    expect(() => store.prepareImport("invalid" as never)).toThrow("inválido");
  } finally {
    store.close();
  }
});

test("export protects active, rolling, temporary, migration and restore checkpoint files, including hard-link and directory aliases", async () => {
  const { store, file, dir, service, ports } = await setup();
  const junction = join(
    mkdtempSync(resolve(".test-data/backup-path-alias-")),
    "alias-folder",
  );
  try {
    create(store);
    const before = readFileSync(file);
    const checkpoint = `${file}.pre-restore-sample.sqlite`,
      migrated = `${file}.pre-v4-sample.sqlite`;
    writeFileSync(checkpoint, before);
    writeFileSync(migrated, before);
    const hardLink = join(dir, "alias.sqlite");
    linkSync(file, hardLink);
    symlinkSync(
      dir,
      junction,
      process.platform === "win32" ? "junction" : "dir",
    );
    const forbidden = [
      file,
      `${file}.bak`,
      `${file}.tmp`,
      checkpoint,
      migrated,
      hardLink,
      join(junction, "sky.sqlite"),
    ];
    for (const path of forbidden) {
      ports.chooseExport.mockResolvedValueOnce(path);
      await expect(service.export()).rejects.toThrow("cópias internas");
    }
    expect(readFileSync(file)).toEqual(before);
    expect(readFileSync(checkpoint)).toEqual(before);
    expect(readFileSync(migrated)).toEqual(before);
    expect(sameFile(file, hardLink)).toBe(true);
    if (process.platform === "win32")
      expect(() => assertExportDestination(file.toUpperCase(), file)).toThrow();
    expect(() => assertImportSource(file, file)).toThrow();
    expect(() => assertImportSource(`${file}.tmp`, file)).toThrow();
  } finally {
    store.close();
    if (existsSync(junction)) unlinkSync(junction);
  }
});

test("failed export replacement or synchronization preserves an existing destination and removes owned temporary files", async () => {
  const { store, selected, dir, service } = await setup();
  try {
    create(store);
    const original = Buffer.from("an existing external copy");
    writeFileSync(selected, original);
    faults.renameTo = selected;
    await expect(service.export()).rejects.toThrow("permissões");
    expect(readFileSync(selected)).toEqual(original);
    expect(
      readdirSync(dir).some((name) => name.includes("chosen.sqlite.tmp-")),
    ).toBe(false);
    faults.renameTo = "";
    faults.fsync = true;
    await expect(service.export()).rejects.toThrow("espaço");
    expect(readFileSync(selected)).toEqual(original);
    expect(
      readdirSync(dir).some((name) => name.includes("chosen.sqlite.tmp-")),
    ).toBe(false);
    faults.fsync = false;
    expect((await service.export())?.path).toBe(selected);
    expect(readFileSync(selected).subarray(0, 15).toString()).toBe(
      "SQLite format 3",
    );
  } finally {
    store.close();
  }
});

test("checkpoint and active-file replacement failures preserve the original active state and the chosen source", async () => {
  const { store, file, selected, dir, service } = await setup();
  try {
    create(store);
    writeFileSync(selected, store.exportBytes());
    create(store, "Outro registro");
    const before = store.snapshot(),
      bytes = readFileSync(file),
      source = readFileSync(selected);
    faults.openPrefix = `${file}.pre-restore-`;
    await expect(service.restore()).rejects.toThrow("permissões");
    expect(store.snapshot()).toEqual(before);
    expect(readFileSync(file)).toEqual(bytes);
    faults.openPrefix = "";
    faults.renameTo = file;
    await expect(service.restore()).rejects.toThrow("permissões");
    expect(store.snapshot()).toEqual(before);
    expect(readFileSync(file)).toEqual(bytes);
    expect(readFileSync(selected)).toEqual(source);
    const copy = readdirSync(dir).find((name) =>
      name.includes(".pre-restore-"),
    )!;
    expect(readFileSync(join(dir, copy))).toEqual(bytes);
    expect(service.busy).toBe(false);
    faults.renameTo = "";
    expect((await service.restore())!.snapshot.goals).toHaveLength(1);
  } finally {
    store.close();
  }
});

test("restoring the rolling .bak preserves that chosen source and keeps an independent copy of the replaced state", async () => {
  const { store, file, ports, service } = await setup();
  try {
    create(store);
    const original = store.snapshot();
    create(store, "Depois");
    const source = readFileSync(`${file}.bak`),
      previous = readFileSync(file);
    ports.chooseImport.mockResolvedValue(`${file}.bak`);
    const result = await service.restore();
    expect(result!.snapshot).toEqual(original);
    expect(readFileSync(`${file}.bak`)).toEqual(source);
    expect(readFileSync(result!.recoveryPath)).toEqual(previous);
  } finally {
    store.close();
  }
});

test("the preview and committed data use the same frozen bytes even when the source changes during confirmation", async () => {
  const { store, selected, ports, service } = await setup();
  try {
    create(store);
    writeFileSync(selected, store.exportBytes());
    const original = store.snapshot();
    create(store, "Atual");
    ports.confirmRestore.mockImplementationOnce(async () => {
      writeFileSync(selected, "external replacement");
      return true;
    });
    const result = await service.restore();
    expect(result!.snapshot).toEqual(original);
    expect(readFileSync(selected).toString()).toBe("external replacement");
  } finally {
    store.close();
  }
});

test("backup operations are serialized for the whole picker and confirmation lifecycle", async () => {
  const { store, selected } = await setup();
  try {
    create(store);
    writeFileSync(selected, store.exportBytes());
    let confirm!: (value: boolean) => void, entered!: () => void;
    const waiting = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const dialogs: BackupDialogs = {
      chooseExport: vi.fn(async () => selected),
      chooseImport: async () => selected,
      confirmRestore: () => {
        entered();
        return new Promise((resolve) => {
          confirm = resolve;
        });
      },
    };
    const service = new BackupService(store, dialogs);
    const request = service.restore();
    await waiting;
    expect(service.busy).toBe(true);
    await expect(service.export()).rejects.toThrow("andamento");
    expect(dialogs.chooseExport).not.toHaveBeenCalled();
    confirm(false);
    expect(await request).toBeNull();
    expect(service.busy).toBe(false);
  } finally {
    store.close();
  }
});

test("preparing and disposing is read-only, a disposed candidate cannot commit, and dialog failures release the lock", async () => {
  const { store, file, ports, service } = await setup();
  try {
    create(store);
    const bytes = readFileSync(file),
      snapshot = store.snapshot();
    const prepared = store.prepareImport(store.exportBytes());
    expect(prepared.preview).toMatchObject({
      sourceVersion: 4,
      targetVersion: 4,
      goals: 1,
    });
    prepared.dispose();
    expect(() => prepared.restore()).toThrow("encerrada");
    expect(readFileSync(file)).toEqual(bytes);
    expect(store.snapshot()).toEqual(snapshot);
    ports.chooseExport.mockRejectedValueOnce(
      Object.assign(new Error("picker denied"), { code: "EACCES" }),
    );
    await expect(service.export()).rejects.toThrow("permissões");
    expect(service.busy).toBe(false);
    ports.chooseExport.mockResolvedValueOnce(null);
    expect(await service.export()).toBeNull();
  } finally {
    store.close();
  }
});

test("filesystem errors have actionable messages without hiding preservation guarantees", () => {
  for (const code of [
    "EACCES",
    "EPERM",
    "EBUSY",
    "ENOENT",
    "ENOSPC",
    "EISDIR",
    "ENOTDIR",
  ])
    expect(
      backupError(Object.assign(new Error("test"), { code })).message,
    ).toContain("preservad");
  expect(
    backupError(new SyntaxError("Unexpected token in JSON")).message,
  ).toContain("validar");
});
