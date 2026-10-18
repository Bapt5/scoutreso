import { NextResponse } from "next/server";
import { executerRouteAvecLogs } from "@/lib/api/routeAvecLogs";
import { jsonError } from "@/lib/api/utils";
import { listerGroupesUtilisateur } from "@/lib/groupServer";
import { recupererSession } from "@/lib/sessionServeur";
import { dateSuppressionDefinitive } from "@/lib/suppressionGroupe";

/** Groupes de l'utilisateur et leur état (`suppressionDefinitiveLe` non nul = en suppression). */
export async function GET(requete: Request) {
  return executerRouteAvecLogs(requete, async () => {
    const session = await recupererSession();
    if (!session) return jsonError("Non autorisé", 401);
    return NextResponse.json(
      {
        groupes: (await listerGroupesUtilisateur(session.user.id)).map(
          ({ suppressionDemandeeLe, ...groupe }) => ({
            ...groupe,
            suppressionDefinitiveLe: suppressionDemandeeLe
              ? dateSuppressionDefinitive(suppressionDemandeeLe).toISOString()
              : null,
          }),
        ),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  });
}
