/** Nombre maximal de catégories récentes conservées par groupe. */
export const MAX_CATEGORIES_RECENTES = 8;

/** Libellé de catégorie -> date (ms) de dernière utilisation. */
export type CategoriesRecentes = Record<string, number>;

/** Clé locale des catégories comptables récemment utilisées, par groupe. */
export const cleCategoriesRecentes = (identifiantOrganisation: string) =>
  `scoutreso:categoriesRecentes:${identifiantOrganisation}`;

/** Lecture tolérante : le stockage peut être indisponible, bloqué ou altéré. */
export function lireCategoriesRecentes(
  identifiantOrganisation: string,
): CategoriesRecentes {
  try {
    const brut = localStorage.getItem(
      cleCategoriesRecentes(identifiantOrganisation),
    );
    if (!brut) return {};
    const valeur: unknown = JSON.parse(brut);
    if (typeof valeur !== "object" || valeur === null || Array.isArray(valeur))
      return {};
    const recentes: CategoriesRecentes = {};
    for (const [libelle, date] of Object.entries(valeur)) {
      if (typeof date === "number" && Number.isFinite(date)) {
        recentes[libelle] = date;
      }
    }
    return recentes;
  } catch {
    return {};
  }
}

/**
 * Mémorise les catégories d'un envoi réussi (sans doublon : une catégorie déjà
 * connue voit simplement sa date mise à jour) et ne garde que les plus récentes.
 */
export function memoriserCategoriesRecentes(
  identifiantOrganisation: string,
  libelles: readonly string[],
  maintenant: number = Date.now(),
) {
  const utilisees = libelles.filter(Boolean);
  if (utilisees.length === 0) return;
  try {
    const recentes = lireCategoriesRecentes(identifiantOrganisation);
    for (const libelle of utilisees) recentes[libelle] = maintenant;
    const gardees = Object.fromEntries(
      Object.entries(recentes)
        .sort(([, a], [, b]) => b - a)
        .slice(0, MAX_CATEGORIES_RECENTES),
    );
    localStorage.setItem(
      cleCategoriesRecentes(identifiantOrganisation),
      JSON.stringify(gardees),
    );
  } catch {
    // Pas de mémorisation : l'ordre des catégories reste simplement celui d'origine.
  }
}

/**
 * Place en tête les catégories récentes (la plus récente d'abord), une seule
 * fois, puis les autres dans leur ordre d'origine. Les récentes absentes de
 * `categories` sont ignorées.
 */
export function ordonnerParRecence<T extends { readonly libelle: string }>(
  categories: readonly T[],
  recentes: CategoriesRecentes,
): T[] {
  const enTete = categories
    .filter((categorie) => categorie.libelle in recentes)
    .sort((a, b) => recentes[b.libelle] - recentes[a.libelle]);
  const reste = categories.filter(
    (categorie) => !(categorie.libelle in recentes),
  );
  return [...enTete, ...reste];
}
