import type { DetailRecette, LigneRecette } from "@/constants/piecesJointes";
import {
  CATEGORIE_ANCV,
  MOYEN_PAIEMENT_ANCV,
  TAUX_FRAIS_ANCV,
} from "@/constants/configRecettes";
import type { DepenseNomenclature } from "@/lib/nomenclature";
import {
  analyserMontantSaisi,
  dateDuJour,
  montantSaisiValide,
  totalLignes,
  type LigneSaisie,
} from "@/lib/depenses";

export const TYPE_RECETTE_MULTIPLE = "Multiples";

// Détail d'une recette tel que saisi dans le formulaire (le montant reste une
// chaîne). Pas d'« activité » (spécifique à la note de frais) : une recette
// n'a qu'un mode de paiement (liste fixe) et des lignes catégorie/montant.
export interface DetailSaisieRecette {
  date: string;
  modePaiement: string;
  description: string;
  lignes: LigneSaisie[];
  /** Poste budgétaire choisi (vide tant qu'aucun poste n'est sélectionné). */
  posteBudgetaireId: string;
  /** Vrai tant que la ligne de frais ANCV (2e ligne) est calculée automatiquement. */
  fraisAncvAuto: boolean;
}

export const detailSaisieRecetteVide = (): DetailSaisieRecette => ({
  date: dateDuJour(),
  modePaiement: "",
  description: "",
  lignes: [{ categorie: "", montant: "" }],
  posteBudgetaireId: "",
  fraisAncvAuto: false,
});

// Frais ANCV : montant négatif égal à 2,5 % de la première ligne (arrondi au
// centime), vide tant que ce montant n'est pas exploitable.
export const fraisAncv = (montantPremiereLigne: string) => {
  const montant = analyserMontantSaisi(montantPremiereLigne);
  if (!Number.isFinite(montant) || montant === 0) return "";
  const centimes = Math.round(Math.abs(montant) * TAUX_FRAIS_ANCV * 100);
  return centimes === 0 ? "" : String((-Math.sign(montant) * centimes) / 100);
};

// Choix du mode de paiement : ANCV remplace les lignes par « Cotisations SGDF »
// (montant vide) et sa ligne de frais ; quitter ANCV retire la ligne de frais
// si elle n'a pas été modifiée à la main.
export const choisirModePaiementRecette = (
  detail: DetailSaisieRecette,
  modePaiement: string,
): DetailSaisieRecette => {
  if (modePaiement === detail.modePaiement) return detail;
  if (modePaiement === MOYEN_PAIEMENT_ANCV) {
    return {
      ...detail,
      modePaiement,
      fraisAncvAuto: true,
      lignes: [
        { categorie: CATEGORIE_ANCV, montant: "" },
        { categorie: CATEGORIE_ANCV, montant: "" },
      ],
    };
  }
  if (detail.fraisAncvAuto) {
    return {
      ...detail,
      modePaiement,
      fraisAncvAuto: false,
      lignes: detail.lignes.slice(0, 1),
    };
  }
  return { ...detail, modePaiement };
};

// Édition des lignes : la ligne de frais ANCV suit la première tant qu'elle n'a
// pas été touchée (modification, suppression ou ajout de ligne la fige).
export const changerLignesRecette = (
  detail: DetailSaisieRecette,
  lignes: LigneSaisie[],
): DetailSaisieRecette => {
  if (!detail.fraisAncvAuto) return { ...detail, lignes };
  const intacte =
    lignes.length === detail.lignes.length &&
    lignes.slice(1).every((ligne, i) => ligne === detail.lignes[i + 1]);
  if (!intacte) return { ...detail, lignes, fraisAncvAuto: false };
  return {
    ...detail,
    lignes: [
      lignes[0],
      { ...lignes[1], montant: fraisAncv(lignes[0].montant) },
    ],
  };
};

export const detailSaisieRecetteComplet = (detail: DetailSaisieRecette) =>
  Boolean(detail.date) &&
  Boolean(detail.modePaiement) &&
  detail.lignes.length > 0 &&
  detail.lignes.every(
    (ligne) => ligne.categorie && montantSaisiValide(ligne.montant),
  );

export const versDetailRecette = (
  detail: DetailSaisieRecette,
): DetailRecette => ({
  date: detail.date,
  modePaiement: detail.modePaiement,
  description: detail.description.trim(),
  lignes: detail.lignes.map((ligne): LigneRecette => ({
    categorie: ligne.categorie,
    montant: analyserMontantSaisi(ligne.montant),
  })),
});

// Une recette = une seule entrée de nomenclature : le montant est le total
// de la recette et le type est sa catégorie, ou « Multiples » s'il y en a
// plusieurs (même convention que versDepenseNomenclature).
export const versRecetteNomenclature = (
  detail: DetailRecette,
): DepenseNomenclature => {
  const categories = new Set(
    detail.lignes.map((ligne) => ligne.categorie).filter(Boolean),
  );
  return {
    typeDepense:
      categories.size > 1
        ? TYPE_RECETTE_MULTIPLE
        : (categories.values().next().value ?? ""),
    modePaiement: detail.modePaiement,
    montant: totalLignes(detail.lignes),
  };
};
