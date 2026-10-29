import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));
const notices = [
  "O Céu é o Limite — componentes de terceiros",
  "Os textos abaixo pertencem aos respectivos autores. Licença do aplicativo: MIT.",
];
let count = 0;
for (const [location, record] of Object.entries(lock.packages)) {
  if (!location || record.dev || record.devOptional) continue;
  const directory = join(root, location);
  const pkg = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
  const licenses = readdirSync(directory).filter((name) =>
    /^(licen[cs]e|copying|notice|ofl)([._-]|$)/i.test(name),
  );
  if (!licenses.length)
    throw new Error(`Texto da licença não encontrado: ${pkg.name}`);
  notices.push(
    `\n${"=".repeat(72)}\n${pkg.name} ${pkg.version} — ${record.license ?? pkg.license ?? "ver texto"}\n`,
  );
  for (const name of licenses)
    notices.push(`${name}\n${readFileSync(join(directory, name), "utf8")}`);
  count++;
}
mkdirSync(join(root, "build"), { recursive: true });
writeFileSync(
  join(root, "build/THIRD_PARTY_NOTICES.txt"),
  `${notices.join("\n")}\n`,
);
console.log(`Licenças de ${count} componentes locais preparadas.`);
