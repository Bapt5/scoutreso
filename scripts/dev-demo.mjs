// Lance le serveur de développement en mode démo avec les variables de
// .env.demo (qui l'emportent sur .env et .env.local). Voir docs/technical/demo.md.
import { spawn } from "node:child_process";

process.loadEnvFile(".env.demo");

const serveur = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", ...process.argv.slice(2)],
  { stdio: "inherit" },
);
serveur.on("exit", (code) => process.exit(code ?? 0));
