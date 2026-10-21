import { executerRouteAvecLogs } from "@/lib/api/routeAvecLogs";
import { verifierOrigineRequete } from "@/lib/api/securiteRequetes";
import { jsonError } from "@/lib/api/utils";
import { demarrerBacASable } from "@/lib/demo/demarrage";
import { estModeDemo } from "@/lib/demo/mode";

/** Crée le bac à sable du visiteur et ouvre sa session (POST uniquement). */
export async function POST(requete: Request) {
  return executerRouteAvecLogs(requete, async () => {
    if (!estModeDemo()) return jsonError("Introuvable", 404);
    const erreurOrigine = verifierOrigineRequete(requete);
    if (erreurOrigine) return erreurOrigine;
    return demarrerBacASable(requete);
  });
}
