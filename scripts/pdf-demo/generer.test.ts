// @vitest-environment node
// Génère les PDF d'exemple des notes de frais signées de la démo
// (src/lib/demo/assets/) avec le vrai pipeline de dépôt et de signature :
// page SGDF rendue par Chrome, justificatifs fusionnés, signatures PAdES du
// bénéficiaire et du responsable avec le certificat de démo.
// Lancé par `pnpm demo:pdf` (voir docs/technical/demo.md), jamais par `pnpm test`.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, it } from "vitest";
import type { PieceJointeDepense } from "@/constants/piecesJointes";
import {
  CLES_NOTES_SEMEES,
  IDENTIFIANTS_PDF_EXEMPLE,
  MODELES_NOTES_SEMEES,
  type CleNoteSemee,
} from "@/lib/demo/notesSemees";
import { PERSONNES, prenomPourEmail } from "@/lib/demo/personnes";
import { UNITES_PAR_DEFAUT } from "@/lib/group";
import {
  assemblerDocumentInitial,
  hasherDocument,
} from "@/lib/ndfSignature/document";
import { construireDossierPreuve } from "@/lib/ndfSignature/dossierPreuve";
import { signerChamp } from "@/lib/ndfSignature/pdfSignature";
import { genererPdfNoteDeFrais } from "@/lib/sgdf/genererPagePdf";

const DOSSIER_SORTIE = join(process.cwd(), "src/lib/demo/assets");
const NOM_GROUPE = "Groupe Démo (fictif)";
const RESPONSABLE = PERSONNES[1];
const TRESORIER = PERSONNES[0];
const JOUR_MS = 24 * 60 * 60 * 1000;

const versDateAffichee = (dateIso: string) =>
  dateIso.split("-").reverse().join("/");
const nomComplet = (personne: { prenom: string; nom: string }) =>
  `${personne.prenom} ${personne.nom}`;
const emailExemple = (personne: { prenom: string }) =>
  `${prenomPourEmail(personne.prenom)}@demo.invalid`;

/** Page de texte simple (justificatif ou RIB fictif). */
async function creerPdfTexte(lignes: string[]) {
  const document = await PDFDocument.create();
  const page = document.addPage([420, 300]);
  const police = await document.embedFont(StandardFonts.Helvetica);
  lignes.forEach((ligne, index) =>
    page.drawText(ligne, {
      x: 30,
      y: 260 - index * 22,
      size: 12,
      font: police,
    }),
  );
  return Buffer.from(await document.save({ useObjectStreams: false }));
}

const enPieceJointe = (nom: string, pdf: Buffer): PieceJointeDepense => ({
  nomAffiche: nom,
  typeMime: "application/pdf",
  donneesBase64: pdf.toString("base64"),
  nomFichierOriginal: `${nom}.pdf`,
  nomFichierNormalise: `${nom}.pdf`,
});

async function genererNote(cle: CleNoteSemee) {
  const modele = MODELES_NOTES_SEMEES[cle];
  const beneficiaire = PERSONNES[modele.beneficiaire];
  const unite = UNITES_PAR_DEFAUT[modele.unite];
  const identifiantNote = IDENTIFIANTS_PDF_EXEMPLE[cle];

  const justificatifs = await Promise.all(
    modele.details.map(async (detail, index) => {
      const montant = detail.lignes.reduce((somme, [, m]) => somme + m, 0);
      return enPieceJointe(
        `Justificatif ${index + 1}`,
        await creerPdfTexte([
          "TICKET DE CAISSE (FICTIF)",
          `Date : ${versDateAffichee(detail.date)}`,
          detail.description,
          `Total : ${montant.toFixed(2)} EUR`,
          "Document d'exemple de la démo Scoutréso.",
        ]),
      );
    }),
  );

  const kilometrage = modele.kilometrage;
  const pageNdf = await genererPdfNoteDeFrais({
    groupe: NOM_GROUPE,
    demandeur: nomComplet(beneficiaire),
    unite: unite.label,
    pieces: modele.details.map((detail, index) => ({
      numero: index + 1,
      date: versDateAffichee(detail.date),
      activite: detail.activite,
      description: detail.description,
      lignes: detail.lignes.map(([categorie, montant]) => ({
        categorie,
        montant,
      })),
    })),
    kilometrage: kilometrage && {
      lignes: kilometrage.lignes.map((ligne) => ({
        date: versDateAffichee(ligne.date),
        activite: ligne.activite,
        objet: ligne.objet,
        distanceKm: ligne.distanceKm,
      })),
      taux: kilometrage.taux,
      tauxMajLe: kilometrage.tauxMajLe,
    },
    responsableNom: nomComplet(RESPONSABLE),
    tresorierNom: nomComplet(TRESORIER),
  });

  const documentInitial = await assemblerDocumentInitial(
    pageNdf,
    justificatifs,
    [
      { etape: "beneficiaire", nom: nomComplet(beneficiaire) },
      { etape: "responsable", nom: nomComplet(RESPONSABLE) },
      { etape: "tresorier", nom: nomComplet(TRESORIER) },
    ],
  );
  const documentHash = hasherDocument(documentInitial);

  // Le bénéficiaire puis le responsable ont déjà signé ; le visiteur
  // (trésorier) signera la dernière étape dans la démo.
  const maintenant = Date.now();
  let pdf = documentInitial;
  for (const [etape, signataire, ecartJours] of [
    ["beneficiaire", beneficiaire, 2],
    ["responsable", RESPONSABLE, 1],
  ] as const) {
    const verifieLe = new Date(maintenant - ecartJours * JOUR_MS);
    pdf = await signerChamp(pdf, {
      etape,
      nom: nomComplet(signataire),
      lignesDossier: construireDossierPreuve({
        noteDeFraisId: identifiantNote,
        etape,
        userId: `demo-${prenomPourEmail(signataire.prenom)}`,
        nom: nomComplet(signataire),
        email: emailExemple(signataire),
        adresseIp: "203.0.113.10",
        userAgent: "Mozilla/5.0 (exemple de la démo Scoutréso)",
        codeEnvoyeLe: new Date(verifieLe.getTime() - 60_000),
        codeVerifieLe: verifieLe,
        nombreSaisiesCode: 1,
        documentHash,
      }),
      date: verifieLe,
    });
  }
  return { pdf, documentHash };
}

describe.skipIf(!process.env.GENERER_PDF_DEMO)(
  "PDF d'exemple de la démo",
  () => {
    it(
      "génère les notes signées et le RIB fictif",
      { timeout: 180_000 },
      async () => {
        mkdirSync(DOSSIER_SORTIE, { recursive: true });
        const empreintes: Record<string, string> = {};
        for (const cle of CLES_NOTES_SEMEES) {
          const { pdf, documentHash } = await genererNote(cle);
          writeFileSync(join(DOSSIER_SORTIE, `note-${cle}.pdf`), pdf);
          empreintes[cle] = documentHash;
        }
        writeFileSync(
          join(DOSSIER_SORTIE, "empreintes.json"),
          `${JSON.stringify(empreintes, null, 2)}\n`,
        );
        writeFileSync(
          join(DOSSIER_SORTIE, "rib-fictif.pdf"),
          await creerPdfTexte([
            "RELEVE D'IDENTITE BANCAIRE (FICTIF)",
            "Titulaire : Beneficiaire fictif",
            "IBAN : FR00 0000 0000 0000 0000 0000 000",
            "BIC : DEMOFRPP",
            "Exemple de la démo Scoutréso, aucun compte réel.",
          ]),
        );
      },
    );
  },
);
