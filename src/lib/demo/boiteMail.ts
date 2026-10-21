import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { SendMailOptions } from "nodemailer";
import { pool } from "@/lib/baseDeDonnees";
import { journal } from "@/lib/logger";
import { recupererSession } from "@/lib/sessionServeur";

export const MAX_MAILS_PAR_BAC_A_SABLE = 50;
const TAILLE_MAX_HTML = 500_000;

type Destinataires = SendMailOptions["to"];

const bacImpose = new AsyncLocalStorage<string>();

/**
 * Exécute `action` en capturant ses mails dans ce bac à sable, sans passer par
 * la session (utile à la création du bac, avant que le visiteur soit connecté).
 */
export const executerDansBacASable = <T>(
  identifiantBac: string,
  action: () => Promise<T>,
) => bacImpose.run(identifiantBac, action);

function listerAdresses(valeur: Destinataires): string[] {
  if (!valeur) return [];
  if (Array.isArray(valeur)) return valeur.flatMap(listerAdresses);
  if (typeof valeur === "string") return [valeur];
  return valeur.address ? [valeur.address] : [];
}

function tailleContenu(contenu: unknown) {
  if (typeof contenu === "string" || ArrayBuffer.isView(contenu))
    return typeof contenu === "string"
      ? Buffer.byteLength(contenu)
      : contenu.byteLength;
  return 0;
}

/**
 * Mode démo : enregistre le mail dans la boîte du bac à sable de la session en
 * cours (jamais d'après le destinataire, saisi librement par le visiteur). Les
 * pièces jointes sont listées par nom et taille, leur contenu n'est jamais
 * conservé. Sans bac à sable, le mail est abandonné et journalisé.
 */
export async function capturerMailDemo(options: Omit<SendMailOptions, "from">) {
  const identifiant = randomUUID();
  const resultat = { messageId: `demo-${identifiant}` };

  const identifiantImpose = bacImpose.getStore();
  const session = identifiantImpose
    ? null
    : await recupererSession().catch(() => null);
  const bac = session
    ? await pool.query<{ id: string }>(
        `SELECT id FROM scouticket_demo_bac_a_sable
          WHERE organization_id = $1 OR utilisateur_id = $2
          ORDER BY (organization_id = $1) DESC LIMIT 1`,
        [session.session.activeOrganizationId ?? null, session.user.id],
      )
    : null;
  const identifiantBac = identifiantImpose ?? bac?.rows[0]?.id;
  if (!identifiantBac) {
    journal.avertissement("demo.mail_sans_bac_a_sable", {
      categorie: "email",
      details: { sujet: options.subject ?? null },
    });
    return resultat;
  }

  const destinataires = [
    ...listerAdresses(options.to),
    ...listerAdresses(options.cc),
    ...listerAdresses(options.bcc),
  ];
  const piecesJointes = (options.attachments ?? []).map((pieceJointe) => ({
    nom: pieceJointe.filename || "sans-nom",
    taille: tailleContenu(pieceJointe.content),
  }));
  const html = typeof options.html === "string" ? options.html : null;
  const texte = typeof options.text === "string" ? options.text : null;

  await pool.query(
    `INSERT INTO scouticket_demo_mail
       (id, bac_a_sable_id, destinataires, sujet, html, texte, pieces_jointes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      identifiant,
      identifiantBac,
      destinataires,
      options.subject ?? "",
      html?.slice(0, TAILLE_MAX_HTML) ?? null,
      texte?.slice(0, TAILLE_MAX_HTML) ?? null,
      JSON.stringify(piecesJointes),
    ],
  );
  await pool.query(
    `DELETE FROM scouticket_demo_mail
      WHERE bac_a_sable_id = $1
        AND id NOT IN (
          SELECT id FROM scouticket_demo_mail
           WHERE bac_a_sable_id = $1
           ORDER BY cree_le DESC LIMIT $2)`,
    [identifiantBac, MAX_MAILS_PAR_BAC_A_SABLE],
  );
  journal.info("demo.mail_capture", { categorie: "email" });
  return resultat;
}
