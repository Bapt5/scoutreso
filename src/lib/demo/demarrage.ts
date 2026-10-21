import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/baseDeDonnees";
import { hacherIp, verifierQuotas } from "@/lib/demo/quotas";
import { purgerBacsASable } from "@/lib/demo/purge";
import { creerBacASable, motDePasseDemo } from "@/lib/demo/semis";

export async function recupererBacASableCourant(
  identifiantUtilisateur: string,
) {
  const resultat = await pool.query<{ id: string }>(
    `SELECT id FROM scouticket_demo_bac_a_sable
      WHERE utilisateur_id = $1 AND expire_le > now()`,
    [identifiantUtilisateur],
  );
  return resultat.rows[0] ?? null;
}

function pageSaturee() {
  return new Response(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Démo saturée</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#18181b"><h1>La démo est momentanément saturée</h1><p>Trop de démonstrations ont été lancées récemment. Réessayez dans quelques minutes.</p><p><a href="/demo">Retour</a></p></body></html>`,
    {
      status: 429,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Retry-After": "600",
      },
    },
  );
}

/**
 * Crée un bac à sable pour le visiteur, ouvre sa session côté serveur (les
 * cookies sont posés par le plugin nextCookies) et le redirige vers l'accueil.
 * Les quotas sont vérifiés avant toute création ; quand le plafond global est
 * atteint, on tente d'abord de purger les bacs expirés.
 */
export async function demarrerBacASable(requete: Request) {
  const ipHachee = hacherIp(requete.headers);
  let quota = await verifierQuotas(ipHachee);
  if (quota === "global") {
    await purgerBacsASable();
    quota = await verifierQuotas(ipHachee);
  }
  if (quota !== "ok") return pageSaturee();

  const bac = await creerBacASable({ ipHachee });
  const connexion = await auth.api.signInEmail({
    body: { email: bac.email, password: motDePasseDemo() },
    headers: requete.headers,
  });
  await pool.query(
    `UPDATE session SET "activeOrganizationId" = $1 WHERE token = $2`,
    [bac.identifiantOrganisation, connexion.token],
  );
  return NextResponse.redirect(
    new URL("/", process.env.APP_URL?.trim() || requete.url),
    303,
  );
}
