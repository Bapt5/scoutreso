import { pool } from "@/lib/baseDeDonnees";
import { recupererSession } from "@/lib/sessionServeur";

export async function recupererBacASableCourant(
  identifiantUtilisateur: string,
) {
  const resultat = await pool.query<{ id: string }>(
    `SELECT id FROM scouticket_demo_bac_a_sable
      WHERE utilisateur_id = $1 AND expire_le > now()`,
    [identifiantUtilisateur],
  );
  return resultat.rows[0] ?? null;
}

/** Bac à sable du visiteur connecté, ou null (sans session ou bac expiré). */
export async function identifiantBacDeLaSession() {
  const session = await recupererSession();
  if (!session) return null;
  return (await recupererBacASableCourant(session.user.id))?.id ?? null;
}

export interface ResumeMail {
  id: string;
  sujet: string;
  destinataires: string[];
  creeLe: string;
  lu: boolean;
}

export interface DetailMail extends ResumeMail {
  piecesJointes: { nom: string; taille: number }[];
}

interface LigneMail {
  id: string;
  sujet: string;
  destinataires: string[];
  cree_le: Date;
  lu_le: Date | null;
  pieces_jointes: { nom: string; taille: number }[];
}

const versResume = (ligne: LigneMail): ResumeMail => ({
  id: ligne.id,
  sujet: ligne.sujet,
  destinataires: ligne.destinataires,
  creeLe: ligne.cree_le.toISOString(),
  lu: ligne.lu_le !== null,
});

// Toutes les requêtes filtrent par le bac à sable de la session, jamais par
// l'identifiant du mail seul : un visiteur ne lit pas la boîte d'un autre.
const COLONNES = "id, sujet, destinataires, cree_le, lu_le, pieces_jointes";

export async function listerMails(
  identifiantBac: string,
  destinataire?: string,
) {
  const resultat = await pool.query<LigneMail>(
    `SELECT ${COLONNES} FROM scouticket_demo_mail
      WHERE bac_a_sable_id = $1
        AND ($2::text IS NULL OR $2 ILIKE ANY (destinataires))
      ORDER BY cree_le DESC`,
    [identifiantBac, destinataire ?? null],
  );
  return resultat.rows.map(versResume);
}

/** Mails arrivés après `apres` (identifiant d'un mail), ou tous si `debut`. */
export async function mailsApres(identifiantBac: string, apres: string) {
  const resultat = await pool.query<LigneMail>(
    `SELECT ${COLONNES} FROM scouticket_demo_mail
      WHERE bac_a_sable_id = $1
        AND ($2 = 'debut' OR cree_le > (
          SELECT cree_le FROM scouticket_demo_mail
           WHERE id = $2 AND bac_a_sable_id = $1))
      ORDER BY cree_le ASC`,
    [identifiantBac, apres],
  );
  return resultat.rows.map(versResume);
}

export async function etatBoiteMail(identifiantBac: string) {
  const resultat = await pool.query<{
    non_lus: number;
    dernier_id: string | null;
  }>(
    `SELECT COUNT(*) FILTER (WHERE lu_le IS NULL)::int AS non_lus,
            (SELECT id FROM scouticket_demo_mail
              WHERE bac_a_sable_id = $1
              ORDER BY cree_le DESC LIMIT 1) AS dernier_id
       FROM scouticket_demo_mail WHERE bac_a_sable_id = $1`,
    [identifiantBac],
  );
  return {
    nonLus: resultat.rows[0].non_lus,
    dernierId: resultat.rows[0].dernier_id,
  };
}

/** Détail d'un mail (marqué comme lu), ou null s'il n'est pas dans ce bac. */
export async function ouvrirMail(
  identifiantBac: string,
  identifiantMail: string,
): Promise<DetailMail | null> {
  const resultat = await pool.query<LigneMail>(
    `UPDATE scouticket_demo_mail SET lu_le = COALESCE(lu_le, now())
      WHERE id = $2 AND bac_a_sable_id = $1
      RETURNING ${COLONNES}`,
    [identifiantBac, identifiantMail],
  );
  const ligne = resultat.rows[0];
  return ligne
    ? { ...versResume(ligne), piecesJointes: ligne.pieces_jointes }
    : null;
}

/** Corps HTML (ou texte à défaut) d'un mail du bac, ou null. */
export async function lireCorpsMail(
  identifiantBac: string,
  identifiantMail: string,
) {
  const resultat = await pool.query<{
    html: string | null;
    texte: string | null;
  }>(
    `SELECT html, texte FROM scouticket_demo_mail
      WHERE id = $2 AND bac_a_sable_id = $1`,
    [identifiantBac, identifiantMail],
  );
  return resultat.rows[0] ?? null;
}
