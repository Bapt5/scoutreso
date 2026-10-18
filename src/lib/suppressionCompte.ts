import { APIError } from "better-auth/api";
import { pool } from "@/lib/baseDeDonnees";

/**
 * Refuse la suppression tant que l’utilisateur appartient encore à un groupe.
 * Les groupes déjà « en suppression » ne comptent pas : l’utilisateur en est
 * retiré, même s’il en était le dernier responsable.
 */
export async function verifierSuppressionCompte(
  identifiantUtilisateur: string,
) {
  await pool.query(
    `DELETE FROM member
      USING scouticket_group_data donnees
      WHERE member."userId" = $1
        AND donnees.organization_id = member."organizationId"
        AND donnees.suppression_demandee_le IS NOT NULL`,
    [identifiantUtilisateur],
  );
  const appartenances = await pool.query(
    `SELECT 1 FROM member WHERE "userId" = $1 LIMIT 1`,
    [identifiantUtilisateur],
  );
  if (appartenances.rows.length > 0)
    throw new APIError("CONFLICT", {
      message:
        "Quittez d’abord tous vos groupes avant de supprimer votre compte.",
    });
}
