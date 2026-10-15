/** Valide le « Prénom Nom » saisi à l'inscription. Renvoie le nom nettoyé ou un message d'erreur. */
export function validerNomInscription(
  saisie: string,
): { nom: string } | { erreur: string } {
  const nom = saisie.trim().replace(/\s+/g, " ");
  if (nom.length < 2 || nom.length > 100)
    return { erreur: "Le nom doit contenir entre 2 et 100 caractères." };
  if (nom.includes("@"))
    return {
      erreur: "Saisissez votre prénom et votre nom, pas une adresse e-mail.",
    };
  return { nom };
}

/** Chemin de retour interne uniquement (refuse les URL externes et « // »), repli sur « / ». */
export function cheminRetourSecurise(chemin: string | null | undefined) {
  return chemin && chemin.startsWith("/") && !chemin.startsWith("//")
    ? chemin
    : "/";
}

/** URL de l'étape « Prénom et nom » qui renvoie ensuite vers `suite`. */
export function urlEtapeNom(suite: string) {
  return `/bienvenue?suite=${encodeURIComponent(suite)}`;
}
