import { NextResponse } from "next/server";
import { pool } from "@/lib/baseDeDonnees";
import { recupererContexteGroupe } from "@/lib/sessionServeur";
import { recupererRoleMembre } from "@/lib/groupServer";
import { executerRouteAvecLogs } from "@/lib/api/routeAvecLogs";

export async function GET(requete: Request) {
  return executerRouteAvecLogs(requete, async () => {
    const { identifiantOrganisation, identifiantUtilisateur } =
      await recupererContexteGroupe();
    if (!identifiantOrganisation || !identifiantUtilisateur)
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const role = await recupererRoleMembre(
      identifiantUtilisateur,
      identifiantOrganisation,
    );
    if (role !== "admin" && role !== "owner")
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const [organisation, membres, invitations, moiLigne] = await Promise.all([
      pool.query<{ name: string }>(
        "SELECT name FROM organization WHERE id = $1",
        [identifiantOrganisation],
      ),
      pool.query<{
        id: string;
        nom: string;
        email: string;
        role: string;
        recoitNotifications: boolean;
        nombreUnites: number;
      }>(
        `SELECT member.id, "user".name AS nom, "user".email, member.role,
                notif.user_id IS NOT NULL AS "recoitNotifications",
                (SELECT COUNT(*)::int FROM scouticket_acces_unite_membre acces
                  WHERE acces.user_id = member."userId"
                    AND acces.organization_id = member."organizationId") AS "nombreUnites"
           FROM member
           JOIN "user" ON "user".id = member."userId"
           LEFT JOIN scouticket_notification_tresorerie notif
             ON notif.user_id = member."userId"
            AND notif.organization_id = member."organizationId"
          WHERE member."organizationId" = $1
          ORDER BY "user".name ASC, "user".email ASC`,
        [identifiantOrganisation],
      ),
      pool.query<{
        id: string;
        email: string;
        role: string;
        statut: string;
        expiresAt: Date;
        nombreUnites: number;
      }>(
        // Les refusées restent visibles pour que le responsable voie le
        // refus ; les annulées sont supprimées, les acceptées sont devenues
        // des membres.
        `SELECT invitation.id, invitation.email, invitation.role,
                invitation.status AS statut, invitation."expiresAt",
                (SELECT COUNT(*)::int FROM scouticket_invitation_unite iu
                  WHERE iu.invitation_id = invitation.id) AS "nombreUnites"
           FROM invitation
          WHERE invitation."organizationId" = $1
            AND invitation.status IN ('pending', 'rejected')
          ORDER BY invitation."createdAt" DESC`,
        [identifiantOrganisation],
      ),
      pool.query<{ id: string }>(
        `SELECT id FROM member WHERE "userId" = $1 AND "organizationId" = $2`,
        [identifiantUtilisateur, identifiantOrganisation],
      ),
    ]);

    return NextResponse.json({
      organisation: {
        id: identifiantOrganisation,
        name: organisation.rows[0]?.name ?? "",
      },
      membres: membres.rows,
      moi: { id: moiLigne.rows[0]?.id ?? "", role },
      invitations: invitations.rows.map((invitation) => ({
        ...invitation,
        expiree:
          invitation.statut === "pending" && invitation.expiresAt <= new Date(),
      })),
    });
  });
}
