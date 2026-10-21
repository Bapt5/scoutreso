/** Personnes fictives semées dans chaque bac à sable (la première est le visiteur). */
export const PERSONNES = [
  { prenom: "Camille", nom: "Moreau", role: "owner" },
  { prenom: "Julien", nom: "Lambert", role: "admin" },
  { prenom: "Sophie", nom: "Bernard", role: "member" },
  { prenom: "Thomas", nom: "Petit", role: "member" },
  { prenom: "Léa", nom: "Roux", role: "member" },
  { prenom: "Hugo", nom: "Fontaine", role: "member" },
  { prenom: "Manon", nom: "Girard", role: "member" },
] as const;

/** Prénom sans accent ni majuscule, utilisable dans une adresse e-mail. */
export const prenomPourEmail = (prenom: string) =>
  prenom.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
