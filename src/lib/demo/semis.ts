import { createHmac, randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { pool } from "@/lib/baseDeDonnees";
import { MODE_PAIEMENT_NOTE_DE_FRAIS } from "@/lib/depenses";
import {
  DOMAINE_EMAIL_DEMO,
  DUREE_BAC_A_SABLE_HEURES,
} from "@/lib/demo/constantes";
import { UNITES_PAR_DEFAUT } from "@/lib/group";
import { anneeComptableDebut } from "@/lib/nomenclature";
import { journal } from "@/lib/logger";

const JOUR_MS = 24 * 60 * 60 * 1000;

/**
 * Mot de passe commun des comptes semés, dérivé du secret de l'application :
 * il n'est ni dans le dépôt ni exposé, la connexion publique étant bloquée
 * (seule la session ouverte côté serveur par /api/demo/demarrer l'utilise).
 */
export function motDePasseDemo() {
  return createHmac("sha256", process.env.BETTER_AUTH_SECRET ?? "")
    .update("scouticket-demo")
    .digest("hex");
}

// Haché une seule fois par instance : le coût du hachage ne se paie pas par
// utilisateur ni par bac à sable.
let empreinteMotDePasse: Promise<string> | undefined;
const empreinteMotDePasseDemo = () =>
  (empreinteMotDePasse ??= hashPassword(motDePasseDemo()));

const PERSONNES = [
  { prenom: "Camille", nom: "Moreau", role: "owner" },
  { prenom: "Julien", nom: "Lambert", role: "admin" },
  { prenom: "Sophie", nom: "Bernard", role: "member" },
  { prenom: "Thomas", nom: "Petit", role: "member" },
  { prenom: "Léa", nom: "Roux", role: "member" },
  { prenom: "Hugo", nom: "Fontaine", role: "member" },
  { prenom: "Manon", nom: "Girard", role: "member" },
] as const;

/** Unités accessibles à chaque membre simple (index dans UNITES_PAR_DEFAUT). */
const ACCES_UNITES: Record<number, number[]> = {
  2: [1],
  3: [2, 3],
  4: [0],
  5: [4, 5],
  6: [1, 2],
};

const POSTES_DEPENSE = [
  "Camps et week-ends",
  "Matériel pédagogique",
  "Alimentation",
  "Transport",
  "Fournitures administratives",
  "Formation",
];
const POSTES_RECETTE = ["Cotisations", "Subventions", "Calendriers et ventes"];
/** Part du budget déjà consommée : « Alimentation » est proche de l'alerte (85 %). */
const TAUX_BUDGET_DEPENSE = [0.55, 0.4, 0.85, 0.7, 0.3, 0.2];
const TAUX_BUDGET_RECETTE = [0.75, 1, 0.4];

type TypeEntree = "depense" | "recette" | "note-de-frais";
interface ModeleEntree {
  type: TypeEntree;
  joursAvant: number;
  unite: number;
  poste: number;
  lignes: [string, number][];
  description: string;
  activite: string;
  mode: string;
  auteur: number;
}

const D = (
  joursAvant: number,
  unite: number,
  poste: number,
  lignes: [string, number][],
  description: string,
  activite: string,
  auteur: number,
  mode = "Carte de procurement",
): ModeleEntree => ({
  type: "depense",
  joursAvant,
  unite,
  poste,
  lignes,
  description,
  activite,
  mode,
  auteur,
});
const N = (
  joursAvant: number,
  unite: number,
  poste: number,
  lignes: [string, number][],
  description: string,
  activite: string,
  auteur: number,
): ModeleEntree => ({
  type: "note-de-frais",
  joursAvant,
  unite,
  poste,
  lignes,
  description,
  activite,
  mode: MODE_PAIEMENT_NOTE_DE_FRAIS,
  auteur,
});
const R = (
  joursAvant: number,
  unite: number,
  poste: number,
  lignes: [string, number][],
  description: string,
  mode: string,
  auteur: number,
): ModeleEntree => ({
  type: "recette",
  joursAvant,
  unite,
  poste,
  lignes,
  description,
  activite: "",
  mode,
  auteur,
});

const ENTREES: ModeleEntree[] = [
  D(
    86,
    2,
    0,
    [["Participation Activités (camp, we...)", 420]],
    "Acompte camp d'été",
    "Camp d'été",
    0,
    "Virement du groupe",
  ),
  D(
    84,
    2,
    2,
    [["Alimentation, Intendance", 186.4]],
    "Courses camp d'été",
    "Camp d'été",
    3,
  ),
  D(
    82,
    3,
    3,
    [["Transport collectif Train", 142]],
    "Billets de train du camp",
    "Camp d'été",
    3,
  ),
  D(
    79,
    1,
    1,
    [["Achat Matériel Pédagogique", 64.9]],
    "Jeux et livrets d'activités",
    "Rentrée",
    2,
  ),
  R(
    78,
    5,
    0,
    [["Cotisations SGDF", 1850]],
    "Cotisations de rentrée, première échéance",
    "Virement",
    0,
  ),
  D(
    75,
    5,
    4,
    [["Achat Fournitures administratives", 38.2]],
    "Papeterie et cartouches",
    "",
    1,
    "Espèces du groupe",
  ),
  D(
    72,
    0,
    1,
    [["Achat Petit Matériel", 52.3]],
    "Bricolage et peinture",
    "Week-end farfadets",
    4,
  ),
  D(
    70,
    0,
    2,
    [["Alimentation, Intendance", 74.8]],
    "Courses du week-end",
    "Week-end farfadets",
    4,
  ),
  N(
    68,
    2,
    3,
    [["Remboursement via Ndf frais de transport", 63.72]],
    "Déplacement repérage camp (180 km)",
    "Repérage",
    3,
  ),
  D(
    66,
    4,
    5,
    [["Formation", 210]],
    "Stage d'approfondissement",
    "Formation",
    5,
    "Virement du groupe",
  ),
  R(
    64,
    5,
    1,
    [["Autres subventions publiques", 600]],
    "Subvention communale",
    "Virement",
    1,
  ),
  D(
    61,
    1,
    2,
    [["Alimentation, Intendance", 96.5]],
    "Goûter de la sortie",
    "Sortie en forêt",
    2,
  ),
  D(
    58,
    5,
    4,
    [["Frais communication et Internet", 29.9]],
    "Abonnement site du groupe",
    "",
    1,
    "Virement du groupe",
  ),
  D(
    55,
    2,
    0,
    [["Hébergement, séminaire", 310]],
    "Gîte du week-end de patrouille",
    "Week-end de patrouille",
    3,
    "Virement du groupe",
  ),
  D(
    53,
    3,
    2,
    [["Alimentation, Intendance", 128.3]],
    "Repas du week-end de patrouille",
    "Week-end de patrouille",
    3,
  ),
  R(
    50,
    5,
    1,
    [["CAF : PSCAF", 420]],
    "Prestation de service CAF",
    "Virement",
    0,
  ),
  D(
    48,
    1,
    1,
    [["Achat Matériel Pédagogique", 41.6]],
    "Matériel de bricolage",
    "Atelier bricolage",
    2,
  ),
  D(
    45,
    5,
    3,
    [
      ["Carburant", 54.2],
      ["Péage-Parking", 12.4],
    ],
    "Déplacement de la réunion de groupe",
    "",
    1,
    "Chèque du groupe",
  ),
  N(
    43,
    3,
    3,
    [["Remboursement via Ndf frais de transport", 49.56]],
    "Déplacement réunion de secteur (140 km)",
    "Réunion de secteur",
    3,
  ),
  D(
    41,
    0,
    2,
    [["Alimentation, Intendance", 63.1]],
    "Pique-nique de la rentrée",
    "Rentrée",
    4,
  ),
  R(
    39,
    5,
    0,
    [["Cotisations SGDF", 920]],
    "Cotisations de rentrée, seconde échéance",
    "Chèque",
    0,
  ),
  D(
    36,
    2,
    0,
    [["Participation Activités (camp, we...)", 175]],
    "Entrées parc d'aventure",
    "Sortie de rentrée",
    6,
  ),
  D(
    34,
    5,
    4,
    [["Affranchissement", 21.6]],
    "Envoi de courriers aux familles",
    "",
    1,
    "Espèces du groupe",
  ),
  D(
    31,
    4,
    2,
    [["Alimentation, Intendance", 88.9]],
    "Repas de la veillée",
    "Veillée compagnons",
    5,
  ),
  D(
    28,
    1,
    1,
    [["Achat Matériel Pédagogique", 33.4]],
    "Fournitures de grand jeu",
    "Grand jeu",
    2,
  ),
  R(
    26,
    5,
    2,
    [["Dons, calendriers (sans reçu fiscal)", 380]],
    "Vente de calendriers, première tournée",
    "Liquide",
    6,
  ),
  D(
    22,
    5,
    5,
    [["Formation", 90]],
    "Journée de formation des responsables",
    "Formation",
    1,
    "Virement du groupe",
  ),
  D(
    19,
    3,
    3,
    [["Transport collectif en commun (RER, métro, Tram, bus, etc.)", 34.8]],
    "Tickets pour la visite",
    "Visite de ville",
    3,
  ),
  D(
    15,
    0,
    2,
    [["Alimentation, Intendance", 52.7]],
    "Goûter de la fête de groupe",
    "Fête de groupe",
    4,
  ),
  N(
    12,
    4,
    3,
    [["Remboursement via Ndf frais de transport", 38.94]],
    "Déplacement course d'orientation (110 km)",
    "Course d'orientation",
    5,
  ),
  R(
    9,
    5,
    2,
    [["Dons, calendriers (sans reçu fiscal)", 240]],
    "Vente de calendriers, seconde tournée",
    "Carte bancaire",
    6,
  ),
  D(
    5,
    1,
    1,
    [["Achat Petit Matériel", 27.3]],
    "Cordes et mousquetons",
    "Atelier nœuds",
    2,
  ),
  D(
    2,
    2,
    2,
    [["Alimentation, Intendance", 41.2]],
    "Courses de la réunion",
    "",
    3,
  ),
];

const formaterDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const arrondir = (montant: number) => Math.round(montant * 100) / 100;

export interface BacASableCree {
  identifiantBac: string;
  identifiantOrganisation: string;
  identifiantUtilisateur: string;
  email: string;
}

function budgetPoste(
  entrees: { poste_id: string; montant_total: number }[],
  identifiantPoste: string,
  tauxConsomme: number,
) {
  const total = entrees
    .filter((entree) => entree.poste_id === identifiantPoste)
    .reduce((somme, entree) => somme + entree.montant_total, 0);
  return Math.max(100, Math.round(total / tauxConsomme / 10) * 10);
}

/**
 * Crée un bac à sable complet en une seule transaction : groupe fictif aux
 * options toutes actives, utilisateurs, unités, postes et budgets, historique
 * sur les trois derniers mois. Les dates sont relatives à aujourd'hui, et
 * l'année comptable du groupe démarre dans la fenêtre pour tout contenir.
 */
export async function creerBacASable(parametres: {
  ipHachee: string;
}): Promise<BacASableCree> {
  const maintenant = new Date();
  const empreinte = await empreinteMotDePasseDemo();
  const identifiantBac = randomUUID();
  const suffixe = identifiantBac.slice(0, 8);
  const identifiantOrganisation = randomUUID();

  const utilisateurs = PERSONNES.map((personne) => ({
    ...personne,
    id: randomUUID(),
    memberId: randomUUID(),
    nomComplet: `${personne.prenom} ${personne.nom}`,
    email: `${personne.prenom
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()}-${suffixe}@${DOMAINE_EMAIL_DEMO}`,
  }));
  const visiteur = utilisateurs[0];

  const unites = UNITES_PAR_DEFAUT.map((unite) => ({
    ...unite,
    id: randomUUID(),
  }));

  // Année comptable du 1er septembre (valeur usuelle des groupes). Si moins de
  // 86 jours se sont écoulés depuis ce début, les dates de l'historique sont
  // resserrées pour qu'il tienne tout entier dans l'année courante.
  const debutAnnee = { mois: 9, jour: 1 };
  const anneeDebut = anneeComptableDebut(formaterDate(maintenant), debutAnnee);
  const joursDepuisDebut = Math.floor(
    (maintenant.getTime() - new Date(anneeDebut, 8, 1).getTime()) / JOUR_MS,
  );
  const facteurDates = Math.min(1, joursDepuisDebut / 86);

  const postesDepense = POSTES_DEPENSE.map((label) => ({
    id: randomUUID(),
    label,
  }));
  const postesRecette = POSTES_RECETTE.map((label) => ({
    id: randomUUID(),
    label,
  }));

  const entrees = ENTREES.map((modele) => {
    const unite = unites[modele.unite];
    const poste =
      modele.type === "recette"
        ? postesRecette[modele.poste]
        : postesDepense[modele.poste];
    const dateEntree = new Date(
      maintenant.getTime() -
        Math.floor(modele.joursAvant * facteurDates) * JOUR_MS,
    );
    return {
      id: randomUUID(),
      envoi_id: randomUUID(),
      type: modele.type,
      date: formaterDate(dateEntree),
      unite_id: unite.id,
      unite_label: unite.label,
      unite_couleur: unite.color,
      mode_paiement: modele.mode,
      activite: modele.activite,
      description: modele.description,
      montant_total: arrondir(
        modele.lignes.reduce((somme, [, montant]) => somme + montant, 0),
      ),
      lignes: modele.lignes.map(([categorie, montant]) => ({
        categorie,
        montant,
      })),
      auteur_user_id: utilisateurs[modele.auteur].id,
      poste_id: poste.id,
      poste_label: poste.label,
      cree_le: dateEntree.toISOString(),
    };
  });

  // Budget de chaque poste : dépenses du poste / part consommée visée.
  const budgets = [
    ...postesDepense.map((poste, index) => ({
      poste_id: poste.id,
      montant: budgetPoste(entrees, poste.id, TAUX_BUDGET_DEPENSE[index]),
    })),
    ...postesRecette.map((poste, index) => ({
      poste_id: poste.id,
      montant: budgetPoste(entrees, poste.id, TAUX_BUDGET_RECETTE[index]),
    })),
  ];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
       SELECT id, nom, email, true, now(), now()
         FROM unnest($1::text[], $2::text[], $3::text[]) AS u(id, nom, email)`,
      [
        utilisateurs.map((u) => u.id),
        utilisateurs.map((u) => u.nomComplet),
        utilisateurs.map((u) => u.email),
      ],
    );
    await client.query(
      `INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
       SELECT gen_random_uuid()::text, id, 'credential', id, $2, now(), now()
         FROM unnest($1::text[]) AS u(id)`,
      [utilisateurs.map((u) => u.id), empreinte],
    );
    await client.query(
      `INSERT INTO organization (id, name, slug, "createdAt")
       VALUES ($1, $2, $3, now())`,
      [identifiantOrganisation, "Groupe Démo (fictif)", `demo-${suffixe}`],
    );
    await client.query(
      `INSERT INTO member (id, "organizationId", "userId", role, "createdAt")
       SELECT id, $1, user_id, role, now()
         FROM unnest($2::text[], $3::text[], $4::text[]) AS m(id, user_id, role)`,
      [
        identifiantOrganisation,
        utilisateurs.map((u) => u.memberId),
        utilisateurs.map((u) => u.id),
        utilisateurs.map((u) => u.role),
      ],
    );
    await client.query(
      `INSERT INTO scouticket_group_data
         (organization_id, annee_comptable_debut_mois, annee_comptable_debut_jour,
          scan_justificatifs_actif, ndf_signee_actif, ndf_km_actif,
          historique_actif, budget_actif)
       VALUES ($1, $2, $3, true, true, true, true, true)`,
      [identifiantOrganisation, debutAnnee.mois, debutAnnee.jour],
    );
    await client.query(
      `INSERT INTO scouticket_unites (organization_id, id, label, color, ordre)
       SELECT $1, id, label, color, ordre - 1
         FROM unnest($2::text[], $3::text[], $4::text[]) WITH ORDINALITY AS u(id, label, color, ordre)`,
      [
        identifiantOrganisation,
        unites.map((u) => u.id),
        unites.map((u) => u.label),
        unites.map((u) => u.color),
      ],
    );
    const acces = Object.entries(ACCES_UNITES).flatMap(
      ([membre, indexUnites]) =>
        indexUnites.map((index) => ({
          user_id: utilisateurs[Number(membre)].id,
          unite_id: unites[index].id,
        })),
    );
    await client.query(
      `INSERT INTO scouticket_acces_unite_membre (user_id, organization_id, unite_id)
       SELECT user_id, $1, unite_id FROM unnest($2::text[], $3::text[]) AS a(user_id, unite_id)`,
      [
        identifiantOrganisation,
        acces.map((a) => a.user_id),
        acces.map((a) => a.unite_id),
      ],
    );
    await client.query(
      `INSERT INTO scouticket_notification_tresorerie (user_id, organization_id)
       VALUES ($1, $2)`,
      [visiteur.id, identifiantOrganisation],
    );
    await client.query(
      `INSERT INTO scouticket_signataires (organization_id, user_id, ordre)
       VALUES ($1, $2, 1), ($1, $3, 2)`,
      [identifiantOrganisation, visiteur.id, utilisateurs[1].id],
    );
    await client.query(
      `INSERT INTO scouticket_user_default_group (user_id, organization_id)
       SELECT id, $2 FROM unnest($1::text[]) AS u(id)`,
      [utilisateurs.map((u) => u.id), identifiantOrganisation],
    );
    await client.query(
      `INSERT INTO scouticket_user_unit_preference (user_id, organization_id, unit_id)
       VALUES ($1, $2, $3)`,
      [visiteur.id, identifiantOrganisation, unites[2].id],
    );

    const postes = [
      ...postesDepense.map((p, i) => ({ ...p, domaine: "depense", ordre: i })),
      ...postesRecette.map((p, i) => ({ ...p, domaine: "recette", ordre: i })),
    ];
    await client.query(
      `INSERT INTO scouticket_postes_budgetaires (organization_id, id, domaine, label, ordre)
       SELECT $1, id, domaine, label, ordre
         FROM unnest($2::text[], $3::text[], $4::text[], $5::int[]) AS p(id, domaine, label, ordre)`,
      [
        identifiantOrganisation,
        postes.map((p) => p.id),
        postes.map((p) => p.domaine),
        postes.map((p) => p.label),
        postes.map((p) => p.ordre),
      ],
    );
    await client.query(
      `INSERT INTO scouticket_budgets_postes (organization_id, poste_id, annee_debut, montant)
       SELECT $1, poste_id, $2, montant
         FROM unnest($3::text[], $4::numeric[]) AS b(poste_id, montant)`,
      [
        identifiantOrganisation,
        anneeDebut,
        budgets.map((b) => b.poste_id),
        budgets.map((b) => b.montant),
      ],
    );
    await client.query(
      `INSERT INTO scouticket_historique
         (id, organization_id, envoi_id, type, date, unite_id, unite_label,
          unite_couleur, mode_paiement, activite, description, montant_total,
          lignes, auteur_user_id, poste_id, poste_label, cree_le)
       SELECT id, $1, envoi_id, type, date, unite_id, unite_label,
              unite_couleur, mode_paiement, activite, description, montant_total,
              lignes, auteur_user_id, poste_id, poste_label, cree_le
         FROM jsonb_to_recordset($2::jsonb) AS e(
           id text, envoi_id text, type text, date date, unite_id text,
           unite_label text, unite_couleur text, mode_paiement text,
           activite text, description text, montant_total numeric,
           lignes jsonb, auteur_user_id text, poste_id text,
           poste_label text, cree_le timestamptz)`,
      [identifiantOrganisation, JSON.stringify(entrees)],
    );
    await client.query(
      `INSERT INTO scouticket_demo_bac_a_sable
         (id, organization_id, utilisateur_id, ip_hachee, expire_le)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        identifiantBac,
        identifiantOrganisation,
        visiteur.id,
        parametres.ipHachee,
        new Date(
          maintenant.getTime() + DUREE_BAC_A_SABLE_HEURES * 60 * 60 * 1000,
        ),
      ],
    );
    await client.query("COMMIT");
  } catch (erreur) {
    await client.query("ROLLBACK");
    throw erreur;
  } finally {
    client.release();
  }

  journal.info("demo.bac_a_sable_cree", { categorie: "demo" });
  return {
    identifiantBac,
    identifiantOrganisation,
    identifiantUtilisateur: visiteur.id,
    email: visiteur.email,
  };
}
