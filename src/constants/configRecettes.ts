import type { CategorieComptable } from "@/constants/configDepenses";

export const CATEGORIES_COMPTABLES_RECETTES: readonly CategorieComptable[] = [
  {
    libelle: "Autres subventions publiques",
    description: "Autres Organismes Publics dont la nature n'existe pas",
  },
  {
    libelle: "CAF : autres Subventions CAF, VACAF et Bons CAF",
    description:
      "Uniquement les subventions (ex: Appel à projets) et les bons CAF (VACAF, Pass Colo)",
  },
  {
    libelle: "CAF : PSCAF",
    description:
      "PSCAF : Prestation de Service de la CAF -> voir avec le territoire / Centre de ressources Si versé par le CR ==> Tiers National Si versé par le territoire ==> Tiers Territoire",
  },
  {
    libelle: "Cotisations SGDF",
    description:
      "Uniquement les cotisations versées par tous les adhérents et prélevées par le national Tout moyen de règlement : chq, chq vacances, virmt, paiement en ligne, espèces, CB (Terminal de Paiement) , y compris les frais de dossier (Lemonway) et frais adm ANCV, en montant négatif",
  },
  { libelle: "Déduction commission paiement en ligne (-)", description: "" },
  {
    libelle: "Dons avec Reçu Fiscal",
    courante: true,
    description:
      'Le don est un "acte désintéressé", en aucun cas la participation de parents pour une activité de Scoutisme ne peut-être considérée comme un Don. Le montant doit être au minima celui que vous avez saisi dans intranet pour émission des reçus fiscaux aux familles et les dons en dehors de la période d\'adhésion dont vous avez fait la demande au service donateur.',
  },
  {
    libelle: "Dons, calendriers (sans reçu fiscal)",
    courante: true,
    description:
      "Toutes les sommes versées par des particuliers qui ne donnent pas lieu à un reçu fiscal (calendriers, dons dans le cas où un reçu n'est pas demandé)",
  },
  {
    libelle: "Extra-Jobs",
    courante: true,
    description:
      "Toutes les sommes reçues lors des extra-Jobs des Pionniers-Caravelles ou des Compagnons. => Consultez la fiche https://chefscadres.sgdf.fr/ressources/#/explore/file/1427/ => L'extra-job ne doit pas pouvoir être requalifié par la loi comme une activité commerciale (achat sans transformation pour revente interdit) ou une activité salariale (lien de subordination). /!\\ L'extra-Job ne permet pas l'édition d'un reçu fiscal.",
  },
  {
    libelle:
      "Flux financiers entre structures (SAUF Particip. Activités Camp WE...)",
    description:
      "Transfert de fond entre : Un territoire et un groupe // Un groupe de mon territoire //Un groupe hors de mon territoire // National et un groupe ou territoire / Ex : aide d'un territoire à un autre, FSI reçu du national NE PAS UTILISER POUR les participations aux activités camp, WE, ... VERIFIER que la nature n'existe pas avant d'utiliser les \"Flux Financiers\"",
  },
  {
    libelle: "Formation",
    description:
      "Participation des stagiaires aux frais de formations interne (SGDF) ou externe",
  },
  {
    libelle: "Locations/Mise à disposition de Matériel",
    courante: true,
    description: "",
  },
  { libelle: "Mise à disposition Bases", description: "" },
  {
    libelle: "Participation Activités (camp, we...)",
    courante: true,
    description:
      "Tous les versements correspondant à la participations aux activités SGDF (WE, journée, mini-camps et les camps d'été, participation à un événement territorial, AG, Assemblée ou Conseil Territorial...) , recette ou dépense -> par tout moyen de règlement : chq, chq vacances, virmt, paiement en ligne en début année, y compris les frais de dossier et frais adm ANCV (en montant négatif)",
  },
  {
    libelle: "Participation familles aux frais de fonctionnement",
    courante: true,
    description:
      "Participation des familles au fonctionnement du groupe lors de l'Adhésion",
  },
  { libelle: "Produits financiers bancaires", description: "" },
  {
    libelle: "Recettes diverses",
    description: "A n'utiliser uniquement si la nature n'existe pas",
  },
  {
    libelle: "Refacturation médecins, pharmaciens",
    courante: true,
    description:
      "Remboursement des frais médicaux avancés (Medecins, Pharmacie, ...) par les familles",
  },
  {
    libelle: "Subvention Associations (paroisse, diocèse, Rotary, ...)",
    description: "",
  },
  {
    libelle: "Subvention Autres organismes Sociaux (MSA, ...)",
    description:
      "Subventions accordées par la Mutualité sociale agricole, autre que les bons vacances.",
  },
  {
    libelle: "Subvention Département",
    description: "Subventions Départementales",
  },
  {
    libelle: "Subvention Jeunesse et Sport",
    description: "Subventions Jeunesse et Sport",
  },
  { libelle: "Subvention Municipale", description: "Subventions Municipales" },
  {
    libelle:
      "Subvention Organismes Privés (Entreprises, Fondation d'entreprises,...)",
    description: "",
  },
  { libelle: "Subvention Région", description: "Subventions régionales" },
  {
    libelle: "Subventions Internationales (hors France)",
    description: "Subvention versée par des organismes Européens",
  },
  {
    libelle: "Taxe de séjour",
    description:
      "Uniquement pour les structures (territoires) qui ont des bases et qui doivent déclarer la taxe de séjour",
  },
  {
    libelle: "Vente article boutique",
    courante: true,
    description:
      "Revente d'articles de la Boutique du Scoutisme aux familles et autre (chemises, bougies Lumière de Bethléem, ...)",
  },
];

export const LIBELLES_CATEGORIES_COMPTABLES_RECETTES: readonly string[] =
  CATEGORIES_COMPTABLES_RECETTES.map((categorie) => categorie.libelle);

/** Liste fixe des modes de paiement d'une recette : non personnalisable par le groupe. */
export const MOYENS_PAIEMENT_RECETTE = [
  "Virement",
  "Chèque",
  "Liquide",
  "Carte bancaire",
] as const;

export type MoyenPaiementRecette = (typeof MOYENS_PAIEMENT_RECETTE)[number];
