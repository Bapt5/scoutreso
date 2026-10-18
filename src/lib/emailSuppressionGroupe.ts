import { echapperHtml, envoyerMail } from "@/lib/email";

export interface FichierSauvegardeGroupe {
  nom: string;
  contenu: string;
}

/** Envoie aux responsables les données du groupe dont la suppression vient d’être demandée. */
export async function envoyerEmailSuppressionGroupe(parametres: {
  destinataires: string[];
  nomGroupe: string;
  demandeur: string;
  dateSuppressionDefinitive: Date;
  fichiers: FichierSauvegardeGroupe[];
}) {
  const date = parametres.dateSuppressionDefinitive.toLocaleDateString(
    "fr-FR",
    { day: "numeric", month: "long", year: "numeric" },
  );
  const sansDonnees =
    "Aucune donnée d’historique ni de budget n’était activée pour ce groupe.";
  const liste = parametres.fichiers.length
    ? `<p>Les données du groupe sont jointes à ce message :</p><ul>${parametres.fichiers
        .map((fichier) => `<li>${echapperHtml(fichier.nom)}</li>`)
        .join("")}</ul>`
    : `<p>${sansDonnees}</p>`;
  await envoyerMail({
    to: parametres.destinataires,
    subject: `Suppression du groupe ${parametres.nomGroupe}`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><div style="background-color: #1E3A8A; color: #ffffff; padding: 20px; text-align: center;"><h1 style="margin: 0; font-size: 24px;">Scoutréso</h1></div><div style="padding: 20px;"><p><strong>${echapperHtml(parametres.demandeur)}</strong> a demandé la suppression du groupe <strong>${echapperHtml(parametres.nomGroupe)}</strong>.</p>${liste}<p>Le groupe est conservé jusqu’au <strong>${echapperHtml(date)}</strong>. D’ici là, un responsable peut le réactiver depuis la liste de ses groupes. Passé ce délai, toutes ses données seront définitivement supprimées.</p></div></div>`,
    text: `${parametres.demandeur} a demandé la suppression du groupe ${parametres.nomGroupe}.\n\n${
      parametres.fichiers.length
        ? `Les données du groupe sont jointes à ce message : ${parametres.fichiers.map((fichier) => fichier.nom).join(", ")}.`
        : sansDonnees
    }\n\nLe groupe est conservé jusqu’au ${date}. D’ici là, un responsable peut le réactiver depuis la liste de ses groupes. Passé ce délai, toutes ses données seront définitivement supprimées.`,
    attachments: parametres.fichiers.map((fichier) => ({
      filename: fichier.nom,
      content: Buffer.from(fichier.contenu, "utf-8"),
      contentType: "text/csv; charset=utf-8",
    })),
  });
}
