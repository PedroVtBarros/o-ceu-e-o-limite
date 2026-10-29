import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const output = join(root, "release");
const files = ["Portatil", "Instalador"].map(
  (kind) => `O-Ceu-e-o-Limite-${pkg.version}-Windows-x64-${kind}.exe`,
);
const entries = files.map((name) => {
  const path = join(output, name);
  if (!existsSync(path)) throw new Error(`Artefato ausente: ${name}`);
  const bytes = readFileSync(path);
  if (
    bytes[0] !== 0x4d ||
    bytes[1] !== 0x5a ||
    statSync(path).size < 1024 * 1024
  )
    throw new Error(`Executável inválido: ${name}`);
  return {
    name,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
});
writeFileSync(
  join(output, "SHA256SUMS.txt"),
  `${entries.map((file) => `${file.sha256}  ${file.name}`).join("\n")}\n`,
);
const sourceNotes = readFileSync(join(root, "docs/NOTAS_V1.0.0.md"), "utf8");
if (pkg.version !== "1.0.0")
  throw new Error(
    "Atualize as notas da versão antes de preparar outra versão.",
  );
const table = entries
  .map(
    (file) => `| ${file.name} | ${(file.bytes / 1024 / 1024).toFixed(1)} MB |`,
  )
  .join("\n");
writeFileSync(
  join(output, "NOTAS-DA-VERSAO.md"),
  `${sourceNotes}\n\n## Arquivos gerados\n\n| Arquivo | Tamanho |\n| --- | --- |\n${table}\n\nCompare os hashes com SHA256SUMS.txt antes de executar.\n`,
);
copyFileSync(join(root, "docs/RECUPERACAO.md"), join(output, "RECUPERACAO.md"));
copyFileSync(
  join(root, "build/THIRD_PARTY_NOTICES.txt"),
  join(output, "THIRD_PARTY_NOTICES.txt"),
);
copyFileSync(join(root, "LICENSE"), join(output, "LICENSE.txt"));
writeFileSync(
  join(output, "LEIA-ME.txt"),
  `O Céu é o Limite ${pkg.version} — Windows x64\n\nPortátil: abra ${files[0]}. Não exige instalação.\nInstalador: abra ${files[1]}. Instala para seu usuário e cria atalhos.\nNão é necessário instalar Node.js. O aplicativo funciona offline.\n\nFeche o aplicativo antes de atualizar ou trocar entre formatos. Ambos usam a mesma pasta de dados do usuário, fora do executável. Desinstalar preserva essa pasta. Consulte Meus dados e backups para ver o caminho e exportar uma cópia.\n\nEsta compilação não possui assinatura digital de editor. O Windows pode mostrar um aviso de aplicativo não reconhecido. Confira a origem e SHA256SUMS.txt.\n\nRECUPERACAO.md explica backups e recuperação. NOTAS-DA-VERSAO.md contém as notas desta versão.\n`,
);
console.log(JSON.stringify({ version: pkg.version, files: entries }, null, 2));
