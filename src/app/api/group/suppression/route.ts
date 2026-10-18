import { NextResponse } from "next/server";
import { z } from "zod";
import { executerRouteAvecLogs } from "@/lib/api/routeAvecLogs";
import {
  reponseRateLimit,
  verifierOrigineRequete,
  verifierRateLimit,
} from "@/lib/api/securiteRequetes";
import { jsonError } from "@/lib/api/utils";
import { recupererGroupeActif, recupererRoleMembre } from "@/lib/groupServer";
import { recupererContexteGroupe } from "@/lib/sessionServeur";
import {
  SuppressionGroupeErreur,
  demanderSuppressionGroupe,
} from "@/lib/suppressionGroupe";

const schemaCorps = z.object({ confirmation: z.string() });

/**
 * Demande la suppression du groupe actif : le Trésorier (owner) uniquement.
 * Les responsables reçoivent les données par e-mail, puis le groupe est
 * conservé 30 jours avant sa purge définitive.
 */
export async function POST(requete: Request) {
  return executerRouteAvecLogs(requete, async () => {
    const { session, identifiantOrganisation, identifiantUtilisateur } =
      await recupererContexteGroupe();
    if (!session || !identifiantOrganisation || !identifiantUtilisateur)
      return jsonError("Sélectionnez un groupe", 401);

    const role = await recupererRoleMembre(
      identifiantUtilisateur,
      identifiantOrganisation,
    );
    if (role !== "owner")
      return jsonError("Seul le trésorier du groupe peut le supprimer", 403);

    const erreurOrigine = verifierOrigineRequete(requete);
    if (erreurOrigine) return erreurOrigine;

    const limite = verifierRateLimit(
      `suppression-groupe:${identifiantOrganisation}`,
      5,
      60_000,
    );
    if (!limite.autorise) return reponseRateLimit(limite.attenteSecondes);

    const corps = schemaCorps.safeParse(await requete.json().catch(() => null));
    if (!corps.success) return jsonError("Données invalides", 400);

    const groupe = await recupererGroupeActif(identifiantOrganisation);
    if (corps.data.confirmation !== groupe.organisation.name)
      return jsonError("Le nom saisi ne correspond pas au groupe", 400);

    try {
      const dateDefinitive = await demanderSuppressionGroupe({
        identifiantOrganisation,
        identifiantUtilisateur,
        nomUtilisateur: session.user.name,
      });
      return NextResponse.json({
        success: true,
        suppressionDefinitiveLe: dateDefinitive.toISOString(),
      });
    } catch (erreur) {
      if (erreur instanceof SuppressionGroupeErreur) {
        if (erreur.code === "DEJA_EN_SUPPRESSION")
          return jsonError("Ce groupe est déjà en cours de suppression", 409);
        if (erreur.code === "ENVOI_EMAIL_ECHOUE")
          return jsonError(
            "L’envoi de l’e-mail de sauvegarde a échoué : le groupe n’a pas été supprimé. Réessayez.",
            502,
          );
      }
      throw erreur;
    }
  });
}
