import { after } from "next/server";
import { pool } from "@/lib/baseDeDonnees";
import { genererCsvSuivi } from "@/lib/budget";
import { calculerSuiviBudgetaire } from "@/lib/budgetServer";
import { envoyerEmailSuppressionGroupe } from "@/lib/emailSuppressionGroupe";
import { recupererGroupeActif } from "@/lib/groupServer";
import {
  cellulesCsv,
  genererCsvHistorique,
  montantCsv,
} from "@/lib/historique";
import {
  construireWhere,
  rechercherHistorique,
  schemaFiltresHistorique,
} from "@/lib/historiqueRequetes";
import { journal } from "@/lib/logger";
import { anneeComptableDebut } from "@/lib/nomenclature";

/** Durée pendant laquelle un groupe « en suppression » reste réactivable. */
export const DELAI_SUPPRESSION_JOURS = 30;
const DELAI_SUPPRESSION_MS = DELAI_SUPPRESSION_JOURS * 24 * 60 * 60 * 1000;
const INTERVALLE_PURGE_PARESSEUSE_MS = 60 * 60 * 1000;
const VERROU_PURGE = "scouticket_purge_groupes";
const BOM = "﻿";

export function dateSuppressionDefinitive(demandeeLe: Date) {
  return new Date(demandeeLe.getTime() + DELAI_SUPPRESSION_MS);
}

export class SuppressionGroupeErreur extends Error {
  constructor(
    public readonly code:
      "DEJA_EN_SUPPRESSION" | "NON_EN_SUPPRESSION" | "ENVOI_EMAIL_ECHOUE",
  ) {
    super(code);
  }
}

/** Date de demande de suppression du groupe, ou null s’il n’est pas en suppression. */
export async function lireSuppressionDemandeeLe(
  identifiantOrganisation: string,
) {
  const resultat = await pool.query<{ suppression_demandee_le: Date | null }>(
    `SELECT suppression_demandee_le FROM scouticket_group_data
      WHERE organization_id = $1`,
    [identifiantOrganisation],
  );
  return resultat.rows[0]?.suppression_demandee_le ?? null;
}

async function genererSauvegardes(identifiantOrganisation: string) {
  const groupe = await recupererGroupeActif(identifiantOrganisation);
  const fichiers: { nom: string; contenu: string }[] = [];

  if (groupe.parametres.historiqueActif) {
    const filtres = schemaFiltresHistorique.parse({});
    const where = construireWhere(
      identifiantOrganisation,
      filtres,
      null,
      groupe.nomenclature.anneeComptable,
    );
    // Pas de plafond ici : le groupe va disparaître, rien ne doit être perdu.
    const resultat = await rechercherHistorique(where, filtres, {
      limite: 1_000_000,
      decalage: 0,
    });
    fichiers.push({
      nom: "historique.csv",
      contenu: genererCsvHistorique(resultat.lignes, {
        avecPoste: groupe.parametres.budgetActif,
      }),
    });
  }

  if (groupe.parametres.budgetActif) {
    const debut = groupe.parametres.anneeComptableDebut;
    const annees = await pool.query<{ annee_debut: number }>(
      `SELECT DISTINCT annee_debut FROM scouticket_budgets_postes
        WHERE organization_id = $1 ORDER BY annee_debut`,
      [identifiantOrganisation],
    );
    const anneeCourante = anneeComptableDebut(
      new Date().toISOString().slice(0, 10),
      debut,
    );
    const anneesDebut = [
      ...new Set([
        ...annees.rows.map((ligne) => ligne.annee_debut),
        anneeCourante,
      ]),
    ].sort((a, b) => a - b);
    for (const anneeDebut of anneesDebut) {
      const suivi = await calculerSuiviBudgetaire(
        identifiantOrganisation,
        anneeDebut,
        debut,
      );
      const csv = genererCsvSuivi(suivi, cellulesCsv, montantCsv);
      fichiers.push({
        nom: `suivi-budgetaire-${anneeDebut}.csv`,
        contenu: csv.startsWith(BOM) ? csv : `${BOM}${csv}`,
      });
    }
  }

  return { nomGroupe: groupe.organisation.name, fichiers };
}

/**
 * Envoie les données du groupe aux responsables, puis le marque « en
 * suppression ». Le mail part avant tout changement : s’il échoue, l’erreur
 * remonte et rien n’est modifié, on ne perd jamais de données sans sauvegarde.
 */
export async function demanderSuppressionGroupe(parametres: {
  identifiantOrganisation: string;
  identifiantUtilisateur: string;
  nomUtilisateur: string;
}) {
  const { identifiantOrganisation, identifiantUtilisateur } = parametres;
  if (await lireSuppressionDemandeeLe(identifiantOrganisation))
    throw new SuppressionGroupeErreur("DEJA_EN_SUPPRESSION");

  const [{ nomGroupe, fichiers }, destinataires] = await Promise.all([
    genererSauvegardes(identifiantOrganisation),
    pool.query<{ email: string }>(
      `SELECT "user".email FROM member
         JOIN "user" ON "user".id = member."userId"
        WHERE member."organizationId" = $1
          AND member.role IN ('owner', 'admin')`,
      [identifiantOrganisation],
    ),
  ]);

  const maintenant = new Date();
  try {
    await envoyerEmailSuppressionGroupe({
      destinataires: destinataires.rows.map((ligne) => ligne.email),
      nomGroupe,
      demandeur: parametres.nomUtilisateur,
      dateSuppressionDefinitive: dateSuppressionDefinitive(maintenant),
      fichiers,
    });
  } catch {
    // Détail déjà journalisé par envoyerMail.
    throw new SuppressionGroupeErreur("ENVOI_EMAIL_ECHOUE");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Ces notes contiennent un PDF et un RIB : elles ne survivent pas à la demande.
    const notes = await client.query(
      "DELETE FROM scouticket_notes_de_frais_signees WHERE organization_id = $1",
      [identifiantOrganisation],
    );
    await client.query(
      `DELETE FROM invitation
        WHERE "organizationId" = $1 AND status = 'pending'`,
      [identifiantOrganisation],
    );
    await client.query(
      `INSERT INTO scouticket_group_data
         (organization_id, suppression_demandee_le, suppression_demandee_par)
       VALUES ($1, $2, $3)
       ON CONFLICT (organization_id) DO UPDATE
         SET suppression_demandee_le = EXCLUDED.suppression_demandee_le,
             suppression_demandee_par = EXCLUDED.suppression_demandee_par`,
      [identifiantOrganisation, maintenant, identifiantUtilisateur],
    );
    await client.query("COMMIT");
    journal.info("groupe.suppression_demandee", {
      categorie: "groupe",
      details: {
        identifiantOrganisation,
        identifiantUtilisateur,
        fichiersEnvoyes: fichiers.length,
        notesSigneesAnnulees: notes.rowCount ?? 0,
      },
    });
  } catch (erreur) {
    await client.query("ROLLBACK");
    throw erreur;
  } finally {
    client.release();
  }

  return dateSuppressionDefinitive(maintenant);
}

export async function reactiverGroupe(parametres: {
  identifiantOrganisation: string;
  identifiantUtilisateur: string;
}) {
  const resultat = await pool.query(
    `UPDATE scouticket_group_data
        SET suppression_demandee_le = NULL, suppression_demandee_par = NULL
      WHERE organization_id = $1 AND suppression_demandee_le IS NOT NULL`,
    [parametres.identifiantOrganisation],
  );
  if (!resultat.rowCount)
    throw new SuppressionGroupeErreur("NON_EN_SUPPRESSION");
  journal.info("groupe.reactive", {
    categorie: "groupe",
    details: { ...parametres },
  });
}

/**
 * Supprime définitivement les groupes dont le délai est écoulé (cascade SQL
 * sur toutes les données du groupe). Le verrou consultatif évite que deux
 * instances purgent en même temps. Retourne le nombre de groupes purgés.
 */
export async function purgerGroupesEchus() {
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
    const echus = await client.query<{ organization_id: string }>(
      `SELECT organization_id FROM scouticket_group_data
        WHERE suppression_demandee_le IS NOT NULL
          AND suppression_demandee_le <= $1`,
      [new Date(Date.now() - DELAI_SUPPRESSION_MS)],
    );
    for (const { organization_id: identifiant } of echus.rows) {
      // Pas de clé étrangère sur la session, et on n’attend pas de la cascade
      // Better Auth qu’elle emporte membres et invitations.
      await client.query(
        `UPDATE session SET "activeOrganizationId" = NULL
          WHERE "activeOrganizationId" = $1`,
        [identifiant],
      );
      await client.query(`DELETE FROM invitation WHERE "organizationId" = $1`, [
        identifiant,
      ]);
      await client.query(`DELETE FROM member WHERE "organizationId" = $1`, [
        identifiant,
      ]);
      await client.query("DELETE FROM organization WHERE id = $1", [
        identifiant,
      ]);
      purges += 1;
      journal.info("groupe.purge", {
        categorie: "groupe",
        details: { identifiantOrganisation: identifiant },
      });
    }
    await client.query("COMMIT");
  } catch (erreur) {
    await client.query("ROLLBACK");
    throw erreur;
  } finally {
    client.release();
  }
  return purges;
}

let dernierePurgeParesseuse = 0;

/**
 * Filet de sécurité sans cron : à appeler depuis une route fréquente. La
 * purge s’exécute après la réponse, au plus une fois par heure et par
 * instance, et ne fait jamais échouer la requête.
 */
export function declencherPurgeParesseuse() {
  const maintenant = Date.now();
  if (maintenant - dernierePurgeParesseuse < INTERVALLE_PURGE_PARESSEUSE_MS)
    return;
  dernierePurgeParesseuse = maintenant;
  try {
    after(async () => {
      try {
        await purgerGroupesEchus();
      } catch (erreur) {
        journal.erreur("groupe.purge_echouee", {
          categorie: "groupe",
          erreur,
        });
      }
    });
  } catch {
    // Hors contexte de requête (tests, scripts) : rien à planifier.
  }
}
