import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  DetailDepense,
  LigneKilometrique,
} from "@/constants/piecesJointes";
import { montantKilometrique, totalKilometres } from "@/lib/depenses";
import type { DonneesNdfPourEnvoi } from "@/lib/ndfSignature/repository";

/**
 * Notes de frais signées semées dans chaque bac à sable : deux notes en cours,
 * à l'étape du trésorier (le visiteur), dont le PDF est un exemple versionné
 * dans `src/lib/demo/assets/` (voir `pnpm demo:pdf`). Les dates sont donc
 * figées, celles du PDF : à régénérer si la mise en page des notes ou le
 * certificat de démo changent (docs/technical/demo.md).
 */

export type CleNoteSemee = "classique" | "kilometrique";

export interface ModeleNoteSemee {
  /** Index du bénéficiaire dans PERSONNES. */
  beneficiaire: number;
  /** Index de l'unité dans les unités par défaut. */
  unite: number;
  /** Index du poste budgétaire de dépense affecté à la note. */
  poste: number;
  details: {
    date: string;
    activite: string;
    description: string;
    lignes: [categorie: string, montant: number][];
  }[];
  kilometrage?: {
    lignes: LigneKilometrique[];
    taux: number;
    tauxMajLe: string;
  };
}

export const MODELES_NOTES_SEMEES: Record<CleNoteSemee, ModeleNoteSemee> = {
  classique: {
    beneficiaire: 3,
    unite: 2,
    poste: 0,
    details: [
      {
        date: "2026-09-26",
        activite: "Camp de rentrée",
        description: "Courses du camp de rentrée",
        lignes: [["Alimentation, Intendance", 86.4]],
      },
      {
        date: "2026-09-27",
        activite: "Camp de rentrée",
        description: "Cordes et piquets de tente",
        lignes: [["Achat Petit Matériel", 34.9]],
      },
    ],
  },
  kilometrique: {
    beneficiaire: 4,
    unite: 0,
    poste: 3,
    details: [
      {
        date: "2026-09-20",
        activite: "Week-end de patrouille",
        description: "Péage aller-retour",
        lignes: [["Péage-Parking", 14.2]],
      },
    ],
    kilometrage: {
      lignes: [
        {
          date: "2026-09-19",
          distanceKm: 120,
          activite: "Week-end de patrouille",
          objet: "Aller : domicile, gîte de la forêt",
        },
        {
          date: "2026-09-20",
          distanceKm: 80,
          activite: "Week-end de patrouille",
          objet: "Retour avec le matériel du groupe",
        },
      ],
      taux: 0.354,
      tauxMajLe: "2025-11-05",
    },
  },
};

export const CLES_NOTES_SEMEES = Object.keys(
  MODELES_NOTES_SEMEES,
) as CleNoteSemee[];

/** Identifiant de note figé dans le dossier de preuve des PDF d'exemple. */
export const IDENTIFIANTS_PDF_EXEMPLE: Record<CleNoteSemee, string> = {
  classique: "00000000-0000-4000-8000-00000000d001",
  kilometrique: "00000000-0000-4000-8000-00000000d002",
};

export function montantNoteSemee(modele: ModeleNoteSemee) {
  const justificatifs = modele.details.reduce(
    (somme, detail) =>
      somme + detail.lignes.reduce((total, [, montant]) => total + montant, 0),
    0,
  );
  const kilometres = modele.kilometrage
    ? montantKilometrique(
        totalKilometres(modele.kilometrage.lignes),
        modele.kilometrage.taux,
      )
    : 0;
  return Math.round((justificatifs + kilometres) * 100) / 100;
}

export function construireDonneesNdf(
  modele: ModeleNoteSemee,
  contexte: {
    emailBeneficiaire: string;
    groupe: string;
    branche: string;
    couleur: string;
    emailsTresoriers: string[];
    posteBudgetaireId: string;
  },
): DonneesNdfPourEnvoi {
  const detailsDepenses: DetailDepense[] = modele.details.map(
    (detail, index) => ({
      date: detail.date,
      modePaiement: "NDF",
      activite: detail.activite,
      description: detail.description,
      lignes: detail.lignes.map(([categorie, montant]) => ({
        categorie,
        montant,
      })),
      posteBudgetaireId: index === 0 ? contexte.posteBudgetaireId : null,
    }),
  );
  return {
    emailUtilisateur: contexte.emailBeneficiaire,
    date: modele.details[0].date,
    branche: contexte.branche,
    couleur: contexte.couleur,
    groupe: contexte.groupe,
    montant: montantNoteSemee(modele),
    detailsDepenses,
    kilometrage: modele.kilometrage && {
      ...modele.kilometrage,
      montant: montantKilometrique(
        totalKilometres(modele.kilometrage.lignes),
        modele.kilometrage.taux,
      ),
    },
    emailsTresoriers: contexte.emailsTresoriers,
    rib: {
      nomAffiche: "RIB fictif",
      typeMime: "application/pdf",
      donneesBase64: lireRibFictif().toString("base64"),
      nomFichierOriginal: "RIB fictif.pdf",
      nomFichierNormalise: "RIB fictif.pdf",
    },
  };
}

// Chemins littéraux : le traçage de Next les embarque dans la fonction.
export function lirePdfNoteSemee(cle: CleNoteSemee): Buffer {
  return cle === "classique"
    ? readFileSync(
        join(process.cwd(), "src/lib/demo/assets/note-classique.pdf"),
      )
    : readFileSync(
        join(process.cwd(), "src/lib/demo/assets/note-kilometrique.pdf"),
      );
}

export function lireRibFictif(): Buffer {
  return readFileSync(
    join(process.cwd(), "src/lib/demo/assets/rib-fictif.pdf"),
  );
}

/** SHA-256 du document initial de chaque PDF, repris dans leur dossier de preuve. */
export function lireEmpreintesNotesSemees(): Record<CleNoteSemee, string> {
  return JSON.parse(
    readFileSync(
      join(process.cwd(), "src/lib/demo/assets/empreintes.json"),
      "utf8",
    ),
  ) as Record<CleNoteSemee, string>;
}
