import { NextResponse } from "next/server";
import { executerRouteAvecLogs } from "@/lib/api/routeAvecLogs";
import { jsonError } from "@/lib/api/utils";
import {
  etatBoiteMail,
  identifiantBacDeLaSession,
  mailsApres,
} from "@/lib/demo/bacASable";
import { estModeDemo } from "@/lib/demo/mode";

/**
 * Interrogée par la boîte mail virtuelle. Sans `apres` : état de départ (mails
 * non lus et curseur, sans mails). Avec `apres` (identifiant du dernier mail
 * vu, ou `debut`) : les mails arrivés depuis.
 */
export async function GET(requete: Request) {
  return executerRouteAvecLogs(requete, async () => {
    if (!estModeDemo()) return jsonError("Introuvable", 404);
    const identifiantBac = await identifiantBacDeLaSession();
    if (!identifiantBac) return jsonError("Non autorisé", 401);

    const apres = new URL(requete.url).searchParams.get("apres");
    const mails = apres ? await mailsApres(identifiantBac, apres) : [];
    const etat = await etatBoiteMail(identifiantBac);
    return NextResponse.json({
      mails,
      nonLus: etat.nonLus,
      curseur: mails.length > 0 ? mails[mails.length - 1].id : etat.dernierId,
    });
  });
}
