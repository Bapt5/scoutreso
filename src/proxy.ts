import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { REPONSE_BLOQUEE_DEMO, decider } from "@/lib/demo/garde";
import { estModeDemo } from "@/lib/demo/mode";

function urlPublique(chemin: string, requete: NextRequest) {
  return new URL(chemin, process.env.APP_URL?.trim() || requete.url);
}

function gererDemo(requete: NextRequest) {
  const decision = decider(
    requete.nextUrl.pathname,
    requete.method,
    Boolean(getSessionCookie(requete)),
  );
  const reponse =
    decision.action === "bloquer"
      ? NextResponse.json(REPONSE_BLOQUEE_DEMO, { status: 403 })
      : decision.action === "non_autorise"
        ? NextResponse.json({ error: "Non autorisé" }, { status: 401 })
        : decision.action === "rediriger"
          ? NextResponse.redirect(urlPublique(decision.vers, requete))
          : NextResponse.next();
  reponse.headers.set("X-Robots-Tag", "noindex, nofollow");
  return reponse;
}

export default function proxy(requete: NextRequest) {
  const chemin = requete.nextUrl.pathname;

  if (process.env.MAINTENANCE_MODE === "true") {
    if (chemin === "/maintenance") return NextResponse.next();
    if (chemin === "/api/health") {
      return NextResponse.json(
        { ok: false, status: "maintenance" },
        { status: 503 },
      );
    }
    if (chemin.startsWith("/api/")) {
      return NextResponse.json(
        { erreur: "Service en maintenance", status: "maintenance" },
        { status: 503 },
      );
    }
    return NextResponse.redirect(urlPublique("/maintenance", requete));
  }

  if (estModeDemo()) return gererDemo(requete);
  // Hors démo, ses pages et ses routes n'existent pas (avant toute redirection vers la connexion).
  if (
    chemin === "/demo" ||
    chemin.startsWith("/demo/") ||
    chemin.startsWith("/api/demo/")
  )
    return new NextResponse(null, { status: 404 });

  const estConnecte = Boolean(getSessionCookie(requete));
  if (chemin === "/invitation" && !estConnecte) {
    const urlConnexion = urlPublique("/sign-in", requete);
    urlConnexion.searchParams.set(
      "callbackURL",
      `${chemin}${requete.nextUrl.search}`,
    );
    urlConnexion.searchParams.set("invitation", "1");
    const nomGroupe = requete.nextUrl.searchParams.get("groupe");
    if (nomGroupe) urlConnexion.searchParams.set("groupe", nomGroupe);
    return NextResponse.redirect(urlConnexion);
  }
  const estRoutePublique =
    chemin.startsWith("/api/auth") ||
    chemin === "/api/health" ||
    // Authentifiée par son propre secret (CRON_SECRET), sans session.
    chemin === "/api/cron/purge-groupes" ||
    chemin === "/sign-in" ||
    chemin.startsWith("/sign-in/") ||
    chemin === "/maintenance" ||
    chemin === "/forgot-password" ||
    chemin === "/reset-password" ||
    chemin === "/offline" ||
    chemin === "/invitation" ||
    // Utilisées avant qu'une session n'existe pour préremplir/valider l'inscription par invitation.
    chemin === "/api/invitation/email" ||
    chemin === "/api/invitation/inscription";
  if (estRoutePublique || estConnecte) return NextResponse.next();
  if (chemin.startsWith("/api/"))
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  return NextResponse.redirect(urlPublique("/sign-in", requete));
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?:on)?|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|mjs|wasm|ort)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
