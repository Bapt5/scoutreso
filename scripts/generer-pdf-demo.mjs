// Régénère les PDF d'exemple des notes signées de la démo (voir
// docs/technical/demo.md). Nécessite .env.demo (certificat de démo) et un
// Chrome local : PUPPETEER_EXECUTABLE_PATH, lu dans .env à défaut.
import { spawnSync } from "node:child_process";

process.loadEnvFile(".env.demo");
try {
  process.loadEnvFile(".env");
} catch {
  // Pas de .env : PUPPETEER_EXECUTABLE_PATH doit alors être déjà défini.
}
if (!process.env.PUPPETEER_EXECUTABLE_PATH)
  throw new Error("PUPPETEER_EXECUTABLE_PATH est requis (Chrome local).");

const resultat = spawnSync(
  process.execPath,
  [
    "node_modules/vitest/vitest.mjs",
    "run",
    "--config",
    "scripts/pdf-demo/vitest.config.ts",
  ],
  { stdio: "inherit", env: { ...process.env, GENERER_PDF_DEMO: "1" } },
);
process.exit(resultat.status ?? 1);
