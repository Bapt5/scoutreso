import type { PoolClient } from "pg";
import { pool } from "@/lib/baseDeDonnees";
import { DOMAINE_EMAIL_DEMO } from "@/lib/demo/constantes";
import { journal } from "@/lib/logger";

const VERROU_PURGE = "scouticket_purge_demo";

/**
 * Supprime un bac à sable : son organisation (la cascade SQL emporte les
 * données du groupe, dont les notes signées et la boîte mail) et ses
 * utilisateurs. Ne touche qu'aux lignes référencées par la table des bacs à
 * sable, et aux seuls utilisateurs de domaine `.invalid`, même si
 * DATABASE_URL pointait par erreur vers une vraie base.
 */
export async function supprimerBacASable(
  client: PoolClient,
  bac: { id: string; organization_id: string; utilisateur_id: string },
) {
  const utilisateurs = await client.query<{ userId: string }>(
    `SELECT "userId" FROM member WHERE "organizationId" = $1`,
    [bac.organization_id],
  );
  const identifiantsUtilisateurs = [
    ...new Set([
      bac.utilisateur_id,
      ...utilisateurs.rows.map((ligne) => ligne.userId),
    ]),
  ];
  await client.query(
    `UPDATE session SET "activeOrganizationId" = NULL
      WHERE "activeOrganizationId" = $1`,
    [bac.organization_id],
  );
  // Les signataires des notes référencent les utilisateurs sans cascade.
  await client.query(
    "DELETE FROM scouticket_notes_de_frais_signees WHERE organization_id = $1",
    [bac.organization_id],
  );
  await client.query(`DELETE FROM invitation WHERE "organizationId" = $1`, [
    bac.organization_id,
  ]);
  await client.query(`DELETE FROM member WHERE "organizationId" = $1`, [
    bac.organization_id,
  ]);
  await client.query("DELETE FROM organization WHERE id = $1", [
    bac.organization_id,
  ]);
  await client.query("DELETE FROM scouticket_demo_bac_a_sable WHERE id = $1", [
    bac.id,
  ]);
  await client.query(
    `DELETE FROM "user" WHERE id = ANY($1::text[]) AND email LIKE $2`,
    [identifiantsUtilisateurs, `%@${DOMAINE_EMAIL_DEMO}`],
  );
}

/**
 * Purge les bacs à sable expirés. Le verrou consultatif évite que deux
 * instances purgent en même temps. Retourne le nombre de bacs purgés.
 */
export async function purgerBacsASable() {
  const client = await pool.connect();
  let purges = 0;
  try {
    await client.query("BEGIN");
    const verrou = await client.query<{ obtenu: boolean }>(
      "SELECT pg_try_advisory_xact_lock(hashtext($1)) AS obtenu",
      [VERROU_PURGE],
    );
    if (!verrou.rows[0]?.obtenu) {
      await client.query("ROLLBACK");
      return 0;
    }
    const expires = await client.query<{
      id: string;
      organization_id: string;
      utilisateur_id: string;
    }>(
      `SELECT id, organization_id, utilisateur_id
         FROM scouticket_demo_bac_a_sable WHERE expire_le <= now()`,
    );
    for (const bac of expires.rows) {
      await supprimerBacASable(client, bac);
      purges += 1;
    }
    await client.query("COMMIT");
    if (purges > 0)
      journal.info("demo.purge", { categorie: "demo", details: { purges } });
  } catch (erreur) {
    await client.query("ROLLBACK");
    throw erreur;
  } finally {
    client.release();
  }
  return purges;
}

/** Supprime le bac à sable d'un utilisateur (réinitialisation de la démo). */
export async function supprimerBacASableDeUtilisateur(
  identifiantUtilisateur: string,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const bacs = await client.query<{
      id: string;
      organization_id: string;
      utilisateur_id: string;
    }>(
      `SELECT id, organization_id, utilisateur_id
         FROM scouticket_demo_bac_a_sable WHERE utilisateur_id = $1`,
      [identifiantUtilisateur],
    );
    for (const bac of bacs.rows) await supprimerBacASable(client, bac);
    await client.query("COMMIT");
  } catch (erreur) {
    await client.query("ROLLBACK");
    throw erreur;
  } finally {
    client.release();
  }
}
