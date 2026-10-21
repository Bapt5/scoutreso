import { executerRouteAvecLogs } from "@/lib/api/routeAvecLogs";
import { verifierOrigineRequete } from "@/lib/api/securiteRequetes";
import { jsonError } from "@/lib/api/utils";
import { pool } from "@/lib/baseDeDonnees";
import { demarrerBacASable } from "@/lib/demo/demarrage";
import { estModeDemo } from "@/lib/demo/mode";
import { recupererSession } from "@/lib/sessionServeur";

/**
 * Remplace le bac à sable courant par un neuf. L'ancien est marqué expiré
 * (purgé ensuite comme les autres) plutôt que supprimé : sa ligne continue de
 * compter dans le quota par IP, une réinitialisation coûte donc une création.
 */
export async function POST(requete: Request) {
  return executerRouteAvecLogs(requete, async () => {
    if (!estModeDemo()) return jsonError("Introuvable", 404);
    const session = await recupererSession();
    if (!session) return jsonError("Non autorisé", 401);
    const erreurOrigine = verifierOrigineRequete(requete);
    if (erreurOrigine) return erreurOrigine;

    const reponse = await demarrerBacASable(requete);
    if (reponse.status === 429) return reponse;
    await pool.query(
      `UPDATE scouticket_demo_bac_a_sable SET expire_le = now()
        WHERE utilisateur_id = $1`,
      [session.user.id],
    );
    return reponse;
  });
}
