import { randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fstatSync,
  fsyncSync,
  openSync,
  readFileSync,
  readdirSync,
  readSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { MAX_BACKUP_BYTES } from "../../shared/backup";

function canonical(path: string) {
  const resolved = resolve(path);
  const actual = existsSync(resolved)
    ? realpathSync(resolved)
    : join(realpathSync(dirname(resolved)), basename(resolved));
  return process.platform === "win32" ? actual.toLowerCase() : actual;
}
export function sameFile(a: string, b: string) {
  if (canonical(a) === canonical(b)) return true;
  if (!existsSync(a) || !existsSync(b)) return false;
  const left = statSync(a, { bigint: true }),
    right = statSync(b, { bigint: true });
  return left.ino !== 0n && left.ino === right.ino && left.dev === right.dev;
}
export function assertExportDestination(path: string, activeFile: string) {
  const directory = dirname(activeFile),
    name = basename(activeFile).toLowerCase();
  const protectedPaths = [
    activeFile,
    `${activeFile}.bak`,
    `${activeFile}.tmp`,
    ...readdirSync(directory)
      .filter((file) => {
        const lower = file.toLowerCase();
        return (
          lower.startsWith(`${name}.pre-v`) ||
          lower.startsWith(`${name}.pre-restore-`)
        );
      })
      .map((file) => join(directory, file)),
  ];
  if (protectedPaths.some((file) => sameFile(path, file)))
    throw new Error(
      "Escolha um destino diferente do banco em uso e de suas cópias internas.",
    );
  if (existsSync(path) && !statSync(path).isFile())
    throw new Error("Escolha um arquivo para salvar a cópia de segurança.");
}
export function assertImportSource(path: string, activeFile: string) {
  if (sameFile(path, activeFile) || sameFile(path, `${activeFile}.tmp`))
    throw new Error(
      "Escolha uma cópia de segurança diferente do banco em uso e do arquivo temporário do aplicativo.",
    );
}
export function readBackupFile(path: string): Uint8Array {
  const fd = openSync(path, "r");
  try {
    const info = fstatSync(fd);
    if (!info.isFile()) throw new Error("Escolha um arquivo de backup SQLite.");
    if (info.size > MAX_BACKUP_BYTES)
      throw new Error("O backup deve ter no máximo 50 MB.");
    // Read at most the checked size plus one byte, even if the source grows.
    const buffer = Buffer.alloc(info.size + 1);
    let length = 0;
    while (length < buffer.length) {
      const count = readSync(fd, buffer, length, buffer.length - length, null);
      if (!count) break;
      length += count;
    }
    if (length !== info.size)
      throw new Error(
        "O arquivo foi alterado durante a leitura. Escolha a cópia novamente.",
      );
    return buffer.subarray(0, length);
  } finally {
    closeSync(fd);
  }
}
function writeVerified(path: string, bytes: Uint8Array) {
  const fd = openSync(path, "wx");
  try {
    try {
      writeFileSync(fd, bytes);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    if (!readFileSync(path).equals(Buffer.from(bytes)))
      throw new Error(
        "A cópia gravada não passou na conferência. Os arquivos originais foram preservados.",
      );
  } catch (error) {
    try {
      unlinkSync(path);
    } catch {
      /* Never remove or replace the original active file. */
    }
    throw error;
  }
}
export function writeExportFile(path: string, bytes: Uint8Array) {
  const temporary = `${path}.tmp-${randomUUID()}`;
  let owned = false;
  try {
    // An exclusive name prevents overwriting a file from an earlier operation.
    const fd = openSync(temporary, "wx");
    owned = true;
    try {
      writeFileSync(fd, bytes);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    if (!readFileSync(temporary).equals(Buffer.from(bytes)))
      throw new Error("A cópia exportada não passou na conferência.");
    renameSync(temporary, path);
    owned = false;
  } finally {
    if (owned) {
      try {
        unlinkSync(temporary);
      } catch {
        /* The destination remains intact even if cleanup is unavailable. */
      }
    }
  }
}
export function saveRestoreCheckpoint(activeFile: string, now: string) {
  const bytes = readFileSync(activeFile);
  if (bytes.length > MAX_BACKUP_BYTES)
    throw new Error(
      "O banco atual excede 50 MB. A restauração foi interrompida para preservar uma cópia recuperável.",
    );
  const path = `${activeFile}.pre-restore-${now.replace(/[:.]/g, "-")}-${randomUUID()}.sqlite`;
  writeVerified(path, bytes);
  return path;
}
export function backupError(error: unknown) {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  if (code === "EACCES" || code === "EPERM" || code === "EBUSY")
    return new Error(
      "Não foi possível acessar o arquivo ou a pasta. Verifique as permissões e se outro programa está usando o arquivo. Seus dados foram preservados.",
    );
  if (code === "ENOENT")
    return new Error(
      "O arquivo ou a pasta não foi encontrado. Escolha o local novamente; seus dados foram preservados.",
    );
  if (code === "ENOSPC")
    return new Error(
      "Não há espaço livre para concluir a operação. Seus dados e a cópia de origem foram preservados.",
    );
  if (code === "EISDIR" || code === "ENOTDIR")
    return new Error(
      "Escolha um arquivo em uma pasta disponível. Seus dados foram preservados.",
    );
  if (
    error instanceof Error &&
    !/malformed|not a database|SyntaxError|JSON|Unexpected token|out of bounds/i.test(
      error.message,
    )
  )
    return error;
  return new Error(
    "Não foi possível validar a cópia de segurança. O banco atual foi preservado.",
  );
}
