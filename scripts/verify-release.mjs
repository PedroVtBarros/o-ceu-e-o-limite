import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { extractFile, listPackage } from "@electron/asar";

const root = resolve(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const output = join(root, "release");
const hash = (path) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");
const expected = ["Portatil", "Instalador"].map(
  (kind) => `O-Ceu-e-o-Limite-${pkg.version}-Windows-x64-${kind}.exe`,
);
const checksums = readFileSync(join(output, "SHA256SUMS.txt"), "utf8")
  .trim()
  .split(/\r?\n/);
assert.equal(checksums.length, expected.length);
for (const name of expected)
  assert.ok(
    checksums.includes(`${hash(join(output, name))}  ${name}`),
    `Hash divergente: ${name}`,
  );
const resources = join(output, "win-unpacked/resources");
const archive = join(resources, "app.asar");
const files = listPackage(archive).map((name) => name.replaceAll("\\", "/"));
for (const path of [
  "/dist/index.html",
  "/dist-electron/main.cjs",
  "/dist-electron/preload.cjs",
  "/node_modules/sql.js/dist/sql-wasm.js",
])
  assert.ok(files.includes(path), `Recurso ausente: ${path}`);
assert.ok(
  !files.some(
    (path) =>
      /(^|\/)(\.test-data|\.git|\.npm-cache|tests|test-results)(\/|$)/.test(
        path,
      ) || /\.sqlite(?:\.|$)/i.test(path),
  ),
  "Arquivo de teste ou banco incluído",
);
const packed = JSON.parse(extractFile(archive, "package.json").toString());
assert.equal(packed.version, pkg.version);
assert.equal(packed.name, pkg.name);
assert.equal(packed.main, pkg.main);
assert.equal(
  hash(join(resources, "sql-wasm.wasm")),
  hash(join(root, "node_modules/sql.js/dist/sql-wasm.wasm")),
);
for (const name of ["RECUPERACAO.md", "THIRD_PARTY_NOTICES.txt"])
  assert.ok(existsSync(join(resources, name)), `Documento ausente: ${name}`);
const executable = readFileSync(
  join(output, "win-unpacked/O-Ceu-e-o-Limite.exe"),
);
assert.equal(
  executable.readUInt16LE(executable.readUInt32LE(0x3c) + 4),
  0x8664,
  "Runtime não é Windows x64",
);
console.log(
  JSON.stringify({
    version: pkg.version,
    architecture: "x64",
    artifacts: expected,
    hashes: "ok",
    sqliteWasm: "ok",
    archiveEntries: files.length,
    personalDataIncluded: false,
  }),
);
