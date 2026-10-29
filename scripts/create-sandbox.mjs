import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const release = join(root, "release");
if (!existsSync(join(release, "SHA256SUMS.txt")))
  throw new Error("Gere a distribuição primeiro: npm.cmd run dist:win");
const mapped = release
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");
const output = join(root, ".test-data/windows-clean.wsb");
mkdirSync(join(root, ".test-data"), { recursive: true });
writeFileSync(
  output,
  `<Configuration>
  <Networking>Disable</Networking>
  <MappedFolders>
    <MappedFolder>
      <HostFolder>${mapped}</HostFolder>
      <SandboxFolder>C:\\Distribuicao</SandboxFolder>
      <ReadOnly>true</ReadOnly>
    </MappedFolder>
  </MappedFolders>
  <LogonCommand>
    <Command>explorer.exe C:\\Distribuicao</Command>
  </LogonCommand>
</Configuration>
`,
);
console.log(output);
