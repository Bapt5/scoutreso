import {
  PAGES_INUTILES_DEMO,
  ROUTES_AUTH_AUTORISEES_DEMO,
  ROUTES_BLOQUEES_DEMO,
  ROUTES_PUBLIQUES_DEMO,
  correspondALaRoute,
} from "@/lib/demo/routes";

export type DecisionGardeDemo =
  | { action: "continuer" }
  | { action: "bloquer" }
  | { action: "non_autorise" }
  | { action: "rediriger"; vers: string };

const MESSAGE_INDISPONIBLE = "Indisponible en démo";
export const REPONSE_BLOQUEE_DEMO = { error: MESSAGE_INDISPONIBLE };

const estRoutePubliqueDemo = (chemin: string) =>
  chemin === "/demo" ||
  chemin.startsWith("/demo/") ||
  ROUTES_PUBLIQUES_DEMO.includes(chemin) ||
  chemin.startsWith("/api/auth") ||
  chemin === "/api/health" ||
  // Authentifiée par son propre secret (CRON_SECRET), sans session.
  chemin === "/api/cron/purge-groupes" ||
  chemin === "/maintenance" ||
  chemin === "/offline";

/**
 * Décision du mode démo pour une requête, d'après le chemin et la méthode
 * seulement (aucun accès base). Appelée par `src/proxy.ts`.
 */
export function decider(
  chemin: string,
  methode: string,
  estConnecte: boolean,
): DecisionGardeDemo {
  if (chemin.startsWith("/api/auth")) {
    const sousChemin = chemin.slice("/api/auth".length).replace(/\/$/, "");
    return ROUTES_AUTH_AUTORISEES_DEMO.includes(sousChemin)
      ? { action: "continuer" }
      : { action: "bloquer" };
  }
  const bloquee = ROUTES_BLOQUEES_DEMO.some(
    (regle) =>
      correspondALaRoute(regle.route, chemin) &&
      (!regle.methodes || regle.methodes.includes(methode)),
  );
  if (bloquee) return { action: "bloquer" };

  if (
    PAGES_INUTILES_DEMO.some(
      (page) => chemin === page || chemin.startsWith(`${page}/`),
    )
  )
    return { action: "rediriger", vers: "/demo" };

  if (estRoutePubliqueDemo(chemin) || estConnecte)
    return { action: "continuer" };
  if (chemin.startsWith("/api/")) return { action: "non_autorise" };
  return { action: "rediriger", vers: "/demo" };
}
