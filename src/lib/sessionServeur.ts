import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  declencherPurgeParesseuse,
  lireSuppressionDemandeeLe,
} from "@/lib/suppressionGroupe";

export async function recupererSession() {
  return auth.api.getSession({ headers: await headers() });
}

/**
 * Un groupe « en suppression » est traité comme s’il n’y avait pas de groupe
 * actif : toutes les routes de groupe lui ferment ainsi leur accès. La
 * réactivation et la sortie du groupe n’utilisent pas ce contexte.
 */
export async function recupererContexteGroupe() {
  const session = await recupererSession();
  declencherPurgeParesseuse();
  const organisationActive = session?.session.activeOrganizationId ?? null;
  const enSuppression = organisationActive
    ? Boolean(await lireSuppressionDemandeeLe(organisationActive))
    : false;
  return {
    session,
    identifiantUtilisateur: session?.user.id ?? null,
    identifiantOrganisation: enSuppression ? null : organisationActive,
  };
}
