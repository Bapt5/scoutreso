import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ROUTES_AUTH_AUTORISEES_DEMO,
  ROUTES_AUTORISEES_DEMO,
  ROUTES_BLOQUEES_DEMO,
} from "@/lib/demo/routes";

const dossierApi = join(process.cwd(), "src", "app", "api");

function listerRoutes(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return listerRoutes(chemin);
    return nom === "route.ts" ? [dossier] : [];
  });
}

const routesDuDepot = listerRoutes(dossierApi).map(
  (dossier) => "/api/" + relative(dossierApi, dossier).split(sep).join("/"),
);

describe("classification des routes API en démo", () => {
  it("trouve les routes du dépôt", () => {
    expect(routesDuDepot.length).toBeGreaterThan(30);
  });

  it("classe chaque route dans exactement une liste", () => {
    const bloquees = ROUTES_BLOQUEES_DEMO.map((regle) => regle.route);
    for (const route of routesDuDepot) {
      const nombre =
        Number(ROUTES_AUTORISEES_DEMO.includes(route)) +
        Number(bloquees.includes(route));
      expect(nombre, `Route non classée ou en double : ${route}`).toBe(1);
    }
  });

  it("ne référence aucune route inexistante", () => {
    const connues = new Set(routesDuDepot);
    for (const route of [
      ...ROUTES_AUTORISEES_DEMO,
      ...ROUTES_BLOQUEES_DEMO.map((regle) => regle.route),
    ])
      expect(connues.has(route), `Route inconnue : ${route}`).toBe(true);
  });

  it("n'autorise que des routes Better Auth sans création ni suppression", () => {
    for (const route of ROUTES_AUTH_AUTORISEES_DEMO)
      expect(route).not.toMatch(
        /sign-up|sign-in|password|delete|create|invit|remove|email|leave/,
      );
  });
});
