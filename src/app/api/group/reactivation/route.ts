import { NextResponse } from "next/server";
import { z } from "zod";
import { executerRouteAvecLogs } from "@/lib/api/routeAvecLogs";
import { verifierOrigineRequete } from "@/lib/api/securiteRequetes";
import { jsonError } from "@/lib/api/utils";
import { estResponsable, recupererRoleMembre } from "@/lib/groupServer";
import { recupererSession } from "@/lib/sessionServeur";
import {
  SuppressionGroupeErreur,
  reactiverGroupe,
} from "@/lib/suppressionGroupe";

const schemaCorps = z.object({ organizationId: z.string().min(1) });

/** Réactive un groupe en suppression : responsables (owner/admin) du groupe uniquement. */
export async function POST(requete: Request) {
  return executerRouteAvecLogs(requete, async () => {
    const session = await recupererSession();
    if (!session) return jsonError("Non autorisé", 401);

    const erreurOrigine = verifierOrigineRequete(requete);
    if (erreurOrigine) return erreurOrigine;

    const corps = schemaCorps.safeParse(await requete.json().catch(() => null));
    if (!corps.success) return jsonError("Identifiant de groupe manquant", 400);

    const role = await recupererRoleMembre(
      session.user.id,
      corps.data.organizationId,
    );
    if (!estResponsable(role))
      return jsonError("Accès réservé aux responsables du groupe", 403);

    try {
      await reactiverGroupe({
        identifiantOrganisation: corps.data.organizationId,
        identifiantUtilisateur: session.user.id,
      });
    } catch (erreur) {
      if (
        erreur instanceof SuppressionGroupeErreur &&
        erreur.code === "NON_EN_SUPPRESSION"
      )
        return jsonError("Ce groupe n’est pas en cours de suppression", 409);
      throw erreur;
    }
    return NextResponse.json({ success: true });
  });
}
