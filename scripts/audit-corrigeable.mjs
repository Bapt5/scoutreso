// Échoue uniquement si `pnpm audit` remonte une vulnérabilité high/critical
// pour laquelle une version corrigée existe (rien à faire sinon côté amont).
import { spawnSync } from "node:child_process";

const resultat = spawnSync("pnpm", ["audit", "--audit-level=high", "--json"], {
  encoding: "utf8",
  shell: process.platform === "win32",
  maxBuffer: 64 * 1024 * 1024,
});

let rapport;
try {
  rapport = JSON.parse(resultat.stdout);
} catch {
  console.error(
    "Sortie de pnpm audit illisible :",
    resultat.stdout,
    resultat.stderr,
  );
  process.exit(2);
}

const avisories = Object.values(rapport.advisories ?? {}).filter(
  (a) => a.severity === "high" || a.severity === "critical",
);
const corrigeables = avisories.filter(
  (a) => a.patched_versions && a.patched_versions !== "None",
);
const sansCorrectif = avisories.filter((a) => !corrigeables.includes(a));

for (const a of sansCorrectif) {
  console.log(
    `Ignoré (aucun correctif publié) : ${a.module_name} ${a.vulnerable_versions} ${a.url}`,
  );
}
for (const a of corrigeables) {
  console.error(
    `Correctif disponible : ${a.module_name} ${a.vulnerable_versions} -> ${a.patched_versions} ${a.url}`,
  );
}
process.exit(corrigeables.length > 0 ? 1 : 0);
