// Migre la base de démo locale (.env.demo) : tables Better Auth puis tables
// Scoutréso. Équivalent de `pnpm auth:migrate -y && pnpm db:migrate` avec les
// variables de .env.demo (voir docs/technical/demo.md).
import { spawnSync } from "node:child_process";

process.loadEnvFile(".env.demo");

for (const commande of [
  ["pnpm", "dlx", "auth@1.7.3", "migrate", "-y"],
  ["node", "scripts/migrate-base-de-donnees.mjs"],
]) {
  const resultat = spawnSync(commande[0], commande.slice(1), {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (resultat.status !== 0) process.exit(resultat.status ?? 1);
}
