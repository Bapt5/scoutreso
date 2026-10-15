import { pool } from "@/lib/baseDeDonnees";
import { estResponsable, synchroniserEffetsRole } from "@/lib/groupServer";
import { journal } from "@/lib/logger";

/**
 * Applique à l'acceptation d'une invitation le rôle et les unités définis à
 * l'avance par un responsable : copie les unités vers les accès du nouveau
 * membre (en ignorant celles supprimées entre-temps), synchronise les effets
 * annexes du rôle, puis supprime les unités de l'invitation. Appelé hors
 * transaction Better Auth : une erreur est journalisée sans faire échouer
 * l'acceptation (le membre reste alors sans unité, comme avant).
 */
export async function appliquerInvitationAcceptee(invitation: {
  id: string;
  organizationId: string;
  role?: string | null;
  userId: string;
}) {
  const role = invitation.role ?? "member";
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (!estResponsable(role))
      await client.query(
        `INSERT INTO scouticket_acces_unite_membre (user_id, organization_id, unite_id)
         SELECT $1, invitation_unite.organization_id, invitation_unite.unite_id
           FROM scouticket_invitation_unite invitation_unite
           JOIN scouticket_unites unite
             ON unite.organization_id = invitation_unite.organization_id
            AND unite.id = invitation_unite.unite_id
          WHERE invitation_unite.invitation_id = $2
         ON CONFLICT DO NOTHING`,
        [invitation.userId, invitation.id],
      );
    await synchroniserEffetsRole(
      client,
      invitation.userId,
      invitation.organizationId,
      null,
      role,
    );
    await client.query(
      "DELETE FROM scouticket_invitation_unite WHERE invitation_id = $1",
      [invitation.id],
    );
    await client.query("COMMIT");
  } catch (erreur) {
    await client.query("ROLLBACK").catch(() => undefined);
    journal.erreur("invitation.application_acces_echec", {
      categorie: "invitation",
      erreur,
    });
  } finally {
    client.release();
  }
}

/** Refus : l'invitation est conservée (visible du responsable), pas ses unités. */
export async function supprimerUnitesInvitation(identifiantInvitation: string) {
  try {
    await pool.query(
      "DELETE FROM scouticket_invitation_unite WHERE invitation_id = $1",
      [identifiantInvitation],
    );
  } catch (erreur) {
    journal.erreur("invitation.nettoyage_unites_echec", {
      categorie: "invitation",
      erreur,
    });
  }
}

/** Annulation : supprime l'invitation, ses unités partent en cascade. */
export async function supprimerInvitationAnnulee(
  identifiantInvitation: string,
) {
  try {
    await pool.query("DELETE FROM invitation WHERE id = $1", [
      identifiantInvitation,
    ]);
  } catch (erreur) {
    journal.erreur("invitation.suppression_annulee_echec", {
      categorie: "invitation",
      erreur,
    });
  }
}
