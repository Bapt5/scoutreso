import { NextResponse } from "next/server";
import { z } from "zod";
import { estResponsable, recupererRoleMembre } from "@/lib/groupServer";
import { recupererContexteGroupe } from "@/lib/sessionServeur";
import { pool } from "@/lib/baseDeDonnees";
import { verifierOrigineRequete } from "@/lib/api/securiteRequetes";
import { executerRouteAvecLogs } from "@/lib/api/routeAvecLogs";

const schemaCorps = z.object({
  role: z.enum(["member", "admin", "owner"]),
  uniteIds: z.array(z.string()),
});

type ContexteResponsable = {
  identifiantOrganisation: string;
  roleAppelant: string;
};

async function resoudreResponsable(): Promise<
  ContexteResponsable | NextResponse
> {
  const { identifiantOrganisation, identifiantUtilisateur } =
    await recupererContexteGroupe();
  const roleAppelant =
    identifiantOrganisation && identifiantUtilisateur
      ? await recupererRoleMembre(
          identifiantUtilisateur,
          identifiantOrganisation,
        )
      : null;
  if (
    !identifiantOrganisation ||
    !roleAppelant ||
    !estResponsable(roleAppelant)
  )
    return NextResponse.json(
      { error: "Accès réservé aux responsables du groupe" },
      { status: 403 },
    );
  return { identifiantOrganisation, roleAppelant };
}

async function chargerInvitationEnAttente(
  identifiantInvitation: string,
  identifiantOrganisation: string,
) {
  const resultat = await pool.query<{ email: string; role: string }>(
    `SELECT email, role FROM invitation
      WHERE id = $1 AND "organizationId" = $2 AND status = 'pending'`,
    [identifiantInvitation, identifiantOrganisation],
  );
  return resultat.rows[0] ?? null;
}

const reponseIntrouvable = () =>
  NextResponse.json(
    { error: "Cette invitation n’est plus en attente." },
    { status: 404 },
  );

/** Renvoie les unités du groupe et celles prévues pour cette invitation. */
export async function GET(
  requete: Request,
  { params }: { params: Promise<{ invitationId: string }> },
) {
  return executerRouteAvecLogs(requete, async () => {
    const contexte = await resoudreResponsable();
    if (contexte instanceof NextResponse) return contexte;
    const { identifiantOrganisation } = contexte;

    const { invitationId } = await params;
    const invitation = await chargerInvitationEnAttente(
      invitationId,
      identifiantOrganisation,
    );
    if (!invitation) return reponseIntrouvable();

    const unites = await pool.query<{
      id: string;
      label: string;
      color: string;
    }>(
      `SELECT id, label, color FROM scouticket_unites
        WHERE organization_id = $1 ORDER BY ordre ASC`,
      [identifiantOrganisation],
    );
    const accesTotal = estResponsable(invitation.role);
    const uniteIdsAutorisees = accesTotal
      ? unites.rows.map((unite) => unite.id)
      : (
          await pool.query<{ unite_id: string }>(
            `SELECT unite_id FROM scouticket_invitation_unite
              WHERE invitation_id = $1`,
            [invitationId],
          )
        ).rows.map((ligne) => ligne.unite_id);

    return NextResponse.json({
      email: invitation.email,
      role: invitation.role,
      accesTotal,
      unites: unites.rows,
      uniteIdsAutorisees,
    });
  });
}

/** Définit le rôle et les unités prévus pour une invitation en attente. */
export async function PATCH(
  requete: Request,
  { params }: { params: Promise<{ invitationId: string }> },
) {
  return executerRouteAvecLogs(requete, async () => {
    const contexte = await resoudreResponsable();
    if (contexte instanceof NextResponse) return contexte;
    const { identifiantOrganisation, roleAppelant } = contexte;

    const erreurOrigine = verifierOrigineRequete(requete);
    if (erreurOrigine) return erreurOrigine;

    const { invitationId } = await params;
    const invitation = await chargerInvitationEnAttente(
      invitationId,
      identifiantOrganisation,
    );
    if (!invitation) return reponseIntrouvable();

    const corps = schemaCorps.safeParse(await requete.json().catch(() => null));
    if (!corps.success)
      return NextResponse.json({ error: "Requête invalide" }, { status: 400 });

    // Seul un trésorier attribue ce rôle ou modifie l'invitation d'un futur
    // trésorier (comme pour l'édition d'un membre).
    if (
      roleAppelant !== "owner" &&
      (corps.data.role === "owner" || invitation.role === "owner")
    )
      return NextResponse.json(
        {
          error:
            "Seul un trésorier peut attribuer ou modifier le rôle de trésorier.",
        },
        { status: 403 },
      );

    // Un responsable a accès à toutes les unités : aucune n'est enregistrée.
    const idsValides = estResponsable(corps.data.role)
      ? []
      : (
          await pool.query<{ id: string }>(
            `SELECT id FROM scouticket_unites
              WHERE organization_id = $1 AND id = ANY($2::text[])`,
            [identifiantOrganisation, corps.data.uniteIds],
          )
        ).rows.map((ligne) => ligne.id);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const misAJour = await client.query(
        `UPDATE invitation SET role = $1
          WHERE id = $2 AND "organizationId" = $3 AND status = 'pending'`,
        [corps.data.role, invitationId, identifiantOrganisation],
      );
      if (misAJour.rowCount === 0) {
        await client.query("ROLLBACK");
        return reponseIntrouvable();
      }
      await client.query(
        "DELETE FROM scouticket_invitation_unite WHERE invitation_id = $1",
        [invitationId],
      );
      for (const uniteId of idsValides) {
        await client.query(
          `INSERT INTO scouticket_invitation_unite (invitation_id, organization_id, unite_id)
           VALUES ($1, $2, $3)`,
          [invitationId, identifiantOrganisation, uniteId],
        );
      }
      await client.query("COMMIT");
    } catch (erreur) {
      await client.query("ROLLBACK");
      throw erreur;
    } finally {
      client.release();
    }

    return NextResponse.json({
      success: true,
      role: corps.data.role,
      uniteIdsAutorisees: idsValides,
    });
  });
}

/** Retire de la liste une invitation refusée (suppression manuelle). */
export async function DELETE(
  requete: Request,
  { params }: { params: Promise<{ invitationId: string }> },
) {
  return executerRouteAvecLogs(requete, async () => {
    const contexte = await resoudreResponsable();
    if (contexte instanceof NextResponse) return contexte;
    const { identifiantOrganisation } = contexte;

    const erreurOrigine = verifierOrigineRequete(requete);
    if (erreurOrigine) return erreurOrigine;

    const { invitationId } = await params;
    const resultat = await pool.query(
      `DELETE FROM invitation
        WHERE id = $1 AND "organizationId" = $2 AND status = 'rejected'`,
      [invitationId, identifiantOrganisation],
    );
    if (resultat.rowCount === 0)
      return NextResponse.json(
        { error: "Invitation refusée introuvable" },
        { status: 404 },
      );
    return NextResponse.json({ success: true });
  });
}
