import type { TypeEnvoi, TypeEnvoiRecette } from "@/constants/piecesJointes";

/** Contextes de saisie où une catégorie peut être proposée : dépense ou recette. */
export type ScopeCategorie = TypeEnvoi | TypeEnvoiRecette;

export interface CategorieComptable {
  readonly libelle: string;
  readonly description: string;
  /**
   * Contextes où la catégorie est proposée (et acceptée) : `depense-groupe`
   * seul = jamais avancée par un membre (moyen de paiement du groupe),
   * `note-de-frais` seul = réservée aux notes de frais.
   */
  readonly scope: readonly ScopeCategorie[];
  /** Proposée par défaut aux membres simples ; les autres via « Afficher toutes les catégories ». */
  readonly courante?: boolean;
}

export const CATEGORIES_COMPTABLES: readonly CategorieComptable[] = [
  {
    libelle: "Abonnements documentation",
    scope: ["note-de-frais", "depense-groupe"],
    description:
      "Tous types d'abonnements à des organismes extérieurs aux SGDF",
  },
  {
    libelle: "Achat destiné à la revente",
    scope: ["note-de-frais", "depense-groupe"],
    description:
      'Achats fait à la boutique du scoutisme (scoutik) qui est "revendu" aux familles (chemise, badges, livres, ...) lumière de bethléem, ... Pour ce qui n\'est pas revendu -> achat de matériel pédagogique',
  },
  {
    libelle: "Achat Fournitures administratives",
    scope: ["note-de-frais", "depense-groupe"],
    description:
      "Fournitures de bureau : Stylos, Papeterie, papier, cartouches pour imprimante, scotch, pochettes, classeurs",
  },
  {
    libelle: "Achat Gros Matériel",
    scope: ["note-de-frais", "depense-groupe"],
    description:
      "Achats durables, facture supérieure ou égale à 500,00 € (tente, marabout, gamelles, trépieds gaz, perches, racks de rangement au local) Si facture inférieure à 500,00 € unitaire ==> Achat Petit Matériel",
  },
  {
    libelle: "Achat Matériel Pédagogique",
    courante: true,
    scope: ["note-de-frais", "depense-groupe"],
    description:
      "Achat faits par le groupe pour faire de l'animation : livres, bougies, écussons, déguisements pour imaginaire, tissus, papier couleur, crépon",
  },
  {
    libelle: "Achat Petit Matériel",
    courante: true,
    scope: ["note-de-frais", "depense-groupe"],
    description:
      "Toutes factures inférieures à 500,00 €, sauf matériel pédagogique et fourniture administrative",
  },
  {
    libelle: "Affranchissement",
    scope: ["note-de-frais", "depense-groupe"],
    description:
      "timbres, lettre recommandée, lettre suivie, enveloppe pré-timbrée ...",
  },
  {
    libelle: "Alimentation, Intendance",
    courante: true,
    scope: ["note-de-frais", "depense-groupe"],
    description:
      "Alimentation pour les camps, les week end, les rassemblements, ... Détailler les tickets de caisse et tout ce qui n'est pas alimentaire -> achat de petit matériel",
  },
  {
    libelle: "Assurances",
    scope: ["depense-groupe"],
    description:
      "Toutes les assurances contractées et prélevées directement par le national (locaux, ...) Assurances contractées dans d'autres organismes",
  },
  {
    libelle: "Autres cotisations",
    scope: ["depense-groupe"],
    description:
      'Toutes les autres cotisations qui ne sont pas les "cotisations SGDF" . /!\\ Les cotisations des cartes bancaires sont considérées comme des frais bancaires.',
  },
  {
    libelle: "Cadeaux, pourboires, dons",
    scope: ["note-de-frais", "depense-groupe"],
    description:
      "Pour tous les achats de cadeaux offerts ou pourboires , cadeaux au propriétaire du lieu de camps, dons fait par le groupe",
  },
  {
    libelle: "CAF : Reversion PSCAF",
    scope: ["depense-groupe"],
    description:
      "pour les territoires qui reçoivent la PSCAF et la reversent aux groupes (1 écriture par groupe)",
  },
  {
    libelle: "Carburant",
    courante: true,
    scope: ["depense-groupe"],
    description:
      "Achat de carburant ou recharge electrique effectué par un moyen de paiement de la structure",
  },
  {
    libelle: "Eau",
    scope: ["depense-groupe"],
    description: "Abonnement et consommation rattachés au local ou activité",
  },
  {
    libelle: "Electricité",
    scope: ["depense-groupe"],
    description: "Abonnement et consommation rattachés au local ou activité",
  },
  {
    libelle: "Entretien Locaux",
    scope: ["note-de-frais", "depense-groupe"],
    description:
      "Tous les entretiens des locaux petits ou gros, y compris achat clef pour le local, ...",
  },
  {
    libelle: "Entretien Matériel",
    courante: true,
    scope: ["note-de-frais", "depense-groupe"],
    description:
      "Achat de pièces de rechanges en vue de réparer ou entretenir du matériel existant",
  },
  {
    libelle: "Entretien Véhicule/Bateau",
    scope: ["note-de-frais", "depense-groupe"],
    description:
      "Entretien des Véhicules et des Bateaux s'il y a eu une déclaration assurance, mettre le remboursement par une écriture de dépense avec une somme négative",
  },
  {
    libelle:
      "Flux financiers entre structures (SAUF Particip. Activités Camp WE...)",
    scope: ["depense-groupe"],
    description:
      "Transfert de fond entre : Un territoire et un groupe // Un groupe de mon territoire //Un groupe hors de mon territoire // National et un groupe ou territoire / Ex : aide d'un territoire à un autre, FSI reçu du national NE PAS UTILISER POUR les participations aux activités camp, WE, ... VERIFIER que la nature n'existe pas avant d'utiliser les \"Flux Financiers\"",
  },
  {
    libelle: "Formation",
    scope: ["note-de-frais", "depense-groupe"],
    description:
      "Participation des stagiaires aux frais de formations interne (SGDF) ou externe",
  },
  {
    libelle: "Frais Bancaires",
    scope: ["depense-groupe"],
    description:
      "Tous les frais donnant lieu à facturation de la banque. Ne pas utiliser pour : les frais des chèques vacances (ANCV) ; les commissions de paiement en ligne (LEMONWAY) -> à mettre recette de la nature initiale (cotisation, participation activité, frais fonctionnement, ...) en somme négative",
  },
  {
    libelle: "Frais communication et Internet",
    scope: ["depense-groupe"],
    description:
      "Factures téléphones, abonnement internet, ligne d'urgence, coût des adresses mail si achat de nom de domaine",
  },
  {
    libelle: "Gaz : abonnement au réseau",
    scope: ["depense-groupe"],
    description:
      'Uniquement "gaz de ville" (EDF, Engie, Total Direct Energie, ...)',
  },
  {
    libelle: "Gaz : achat de bouteille",
    courante: true,
    scope: ["note-de-frais", "depense-groupe"],
    description: "Uniquement bouteilles de gaz achetées dans le commerce",
  },
  {
    libelle: "Hébergement, séminaire",
    courante: true,
    scope: ["note-de-frais", "depense-groupe"],
    description:
      "Pour une unité qui dormirait lors d'un week-end ou camp dans une structure payante : location gite, places de camping, location terrain, location salle de réunion, auberge de jeunesse (compas en projet international itinérant)",
  },
  {
    libelle: "Honoraires/prestataires extérieurs",
    scope: ["note-de-frais", "depense-groupe"],
    description:
      "Sommes dues que vous versez à : certains intervenants extérieurs (Guide ou Moniteurs) ou artistes pour leur prestation dans le cadre d'une activité exceptionnelle (veillée, activités)",
  },
  {
    libelle: "Imprimés, Annonces",
    courante: true,
    scope: ["note-de-frais", "depense-groupe"],
    description:
      "Tout ce qui concerne la publicité, les documents édités pour de la communication à l'extérieur de l'association SGDF",
  },
  {
    libelle: "Location Matériel",
    courante: true,
    scope: ["note-de-frais", "depense-groupe"],
    description: "Toute location de matériel : Outillage, Sonos, Podium etc",
  },
  {
    libelle: "Location Véhicule/Bateau",
    courante: true,
    scope: ["note-de-frais", "depense-groupe"],
    description:
      "Location d'un véhicule pour une activité ou un camp, sans chauffeur Location de bateaux",
  },
  {
    libelle: "Loyer et Charges locatives",
    scope: ["depense-groupe"],
    description:
      "Location avec bail d'un local et charges afférentes à ce local",
  },
  {
    libelle: "Médecin, Pharmacie",
    courante: true,
    scope: ["note-de-frais", "depense-groupe"],
    description:
      "Frais avancés pour une consultation chez le médecin et pharmacie ; Achats pour mise à niveau d'une trousse de secours, d'une petite pharmacie, avance de médicament à la suite d'une visite chez le médecin => Pensez à demander le remboursement aux familles (nature de la recette = refacturation médecins, pharmaciens)",
  },
  {
    libelle: "Participation Activités (camp, we...)",
    scope: ["depense-groupe"],
    description:
      "Tous les versements correspondant à la participations aux activités SGDF (WE, journée, mini-camps et les camps d'été, participation à un événement territorial, AG, Assemblée ou Conseil Territorial...) , recette ou dépense -> par tout moyen de règlement : chq, chq vacances, virmt, paiement en ligne en début année, y compris les frais de dossier et frais adm ANCV (en montant négatif)",
  },
  {
    libelle: "Participation au Fct du Mouvement",
    scope: ["depense-groupe"],
    description: "",
  },
  {
    libelle: "Péage-Parking",
    courante: true,
    scope: ["note-de-frais", "depense-groupe"],
    description:
      "Péage et parking payés uniquement par les moyens de paiement de la structure",
  },
  {
    libelle: "Remboursement via Ndf frais de transport",
    courante: true,
    scope: ["note-de-frais"],
    description:
      "Tous les déplacements rentrant dans le cadre d'activités SGDF avancés par les adhérents",
  },
  {
    libelle: "Reversion Subvention",
    scope: ["depense-groupe"],
    description:
      "Reversion d'une subvention perçue par un échelon pour un autre échelon (PSCAF, VACAF, Pass Colo par exemple)",
  },
  {
    libelle: "Taxe de séjour",
    scope: ["depense-groupe"],
    description:
      "Uniquement pour les structures (territoires) qui ont des bases et qui doivent déclarer la taxe de séjour",
  },
  {
    libelle: "Taxes foncières",
    scope: ["depense-groupe"],
    description: "Impôt Taxes foncières",
  },
  {
    libelle: "Taxes habitations",
    scope: ["depense-groupe"],
    description: "Impôt Taxes d'habitation",
  },
  {
    libelle: "Taxes portuaires et droits de douane",
    scope: ["note-de-frais", "depense-groupe"],
    description: "",
  },
  {
    libelle: "Transport collectif : en Autocar",
    courante: true,
    scope: ["depense-groupe"],
    description:
      "Autocar privé avec chauffeur avec moyen de paiement de la structure Autocar public longue distance (exemple : Flixbus, compagnie diverses) avec moyen de paiement de la structure",
  },
  {
    libelle: "Transport collectif : en Avion",
    scope: ["depense-groupe"],
    description:
      "Achat de billet d'avion avec un des moyens de paiement de la structure",
  },
  {
    libelle: "Transport collectif : en Bateau",
    scope: ["depense-groupe"],
    description:
      "Achat de billet de bateau avec un des moyens de paiement de la structure",
  },
  {
    libelle: "Transport collectif en commun (RER, métro, Tram, bus, etc.)",
    courante: true,
    scope: ["depense-groupe"],
    description:
      "Transport en commun ville et banlieue avec moyen de paiement de la structure",
  },
  {
    libelle: "Transport collectif Train",
    courante: true,
    scope: ["depense-groupe"],
    description:
      "Achat de billet de train avec un des moyens de paiement de la structure",
  },
  {
    libelle: "Travaux, Gros entretiens",
    scope: ["depense-groupe"],
    description: "Investissements autorisés par le conseil d'administration",
  },
  {
    libelle: "Visas/passeport",
    scope: ["note-de-frais", "depense-groupe"],
    description:
      "Dépenses de visa et de passeport pour un déplacement à l'étranger",
  },
];

export const LIBELLES_CATEGORIES_COMPTABLES: readonly string[] =
  CATEGORIES_COMPTABLES.map((categorie) => categorie.libelle);

/** Catégories comptables proposées (et acceptées) pour un type d'envoi de dépense. */
export function categoriesPourTypeEnvoi(
  typeEnvoi: TypeEnvoi,
): readonly CategorieComptable[] {
  return CATEGORIES_COMPTABLES.filter((categorie) =>
    categorie.scope.includes(typeEnvoi),
  );
}

/** Liste par défaut des moyens de paiement du groupe, tant qu'aucune n'a été personnalisée. */
export const MOYENS_PAIEMENT_PAR_DEFAUT: readonly string[] = [
  "Carte de procurement",
  "Espèces du groupe",
  "Virement du groupe",
  "Chèque du groupe",
];
