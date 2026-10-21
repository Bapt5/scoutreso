/**
 * Classification de chaque route API pour le mode démo. Le test
 * `demo-routes.test.ts` échoue si une route de `src/app/api` n'est dans aucune
 * des deux listes : toute nouvelle route impose une décision.
 */

export interface RouteBloqueeDemo {
  route: string;
  /** Méthodes bloquées ; toutes si absent. */
  methodes?: readonly string[];
}

/** Routes qui n'ont pas de sens en démo (invitations, suppression, sortie). */
export const ROUTES_BLOQUEES_DEMO: readonly RouteBloqueeDemo[] = [
  { route: "/api/group/invitations/[invitationId]" },
  { route: "/api/group/resend-invitation" },
  { route: "/api/group/suppression" },
  { route: "/api/group/reactivation" },
  { route: "/api/group/leave" },
  { route: "/api/invitation" },
  { route: "/api/invitation/email" },
  { route: "/api/invitation/inscription" },
];

/**
 * Routes utilisables en démo. `/api/auth/[...all]` y figure mais n'est
 * accessible que via `ROUTES_AUTH_AUTORISEES_DEMO`. Gardes internes aux
 * handlers : `send-expense` refuse le dépôt d'une note de frais signée, et le
 * visiteur (responsable) ne peut ni se retirer ni changer son propre rôle.
 */
export const ROUTES_AUTORISEES_DEMO: readonly string[] = [
  "/api/auth/[...all]",
  "/api/budget",
  "/api/budget/donnees",
  "/api/budget/export",
  "/api/budget/montants",
  "/api/budget/postes",
  "/api/cron/purge-groupes",
  "/api/group/config",
  "/api/group/members",
  "/api/group/members/[memberId]",
  "/api/group/members/[memberId]/notifications",
  "/api/group/members/[memberId]/role",
  "/api/group/members/[memberId]/unites",
  "/api/group/nomenclature",
  "/api/group/parametres",
  "/api/group/parametres/logo",
  "/api/group/signataires",
  "/api/group/units",
  "/api/health",
  "/api/historique",
  "/api/historique/export",
  "/api/historique/[id]",
  "/api/note-de-frais/[id]",
  "/api/note-de-frais/[id]/document",
  "/api/note-de-frais/[id]/envoyer-code",
  "/api/note-de-frais/[id]/rib",
  "/api/note-de-frais/[id]/signature",
  "/api/send-expense",
  "/api/send-recette",
  "/api/user/default-group",
  "/api/user/groupes",
  "/api/user/unit-preference",
];

/**
 * Routes natives de Better Auth (chemin sous `/api/auth`) réellement utilisées
 * par l'interface. Tout le reste est bloqué : inscription, connexion,
 * mot de passe, e-mail, suppression de compte et routes d'organisation
 * (création, invitations, retrait de membre, changement de rôle…).
 */
export const ROUTES_AUTH_AUTORISEES_DEMO: readonly string[] = [
  "/get-session",
  "/sign-out",
  "/update-user",
  "/organization/set-active",
  "/organization/get-full-organization",
  "/organization/get-active-member",
  "/organization/get-active-member-role",
  "/organization/list",
];

/** Routes /demo publiques (le reste de /api/demo exige une session). */
export const ROUTES_PUBLIQUES_DEMO: readonly string[] = ["/api/demo/demarrer"];

/** Pages sans objet en démo : le visiteur est renvoyé vers /demo. */
export const PAGES_INUTILES_DEMO: readonly string[] = [
  "/sign-in",
  "/forgot-password",
  "/reset-password",
  "/invitation",
];

function versExpressionReguliere(route: string) {
  const motif = route
    .split("/")
    .map((segment) => {
      if (/^\[\.\.\..+\]$/.test(segment)) return ".*";
      if (/^\[.+\]$/.test(segment)) return "[^/]+";
      return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return new RegExp(`^${motif}/?$`);
}

export function correspondALaRoute(route: string, chemin: string) {
  return versExpressionReguliere(route).test(chemin);
}
