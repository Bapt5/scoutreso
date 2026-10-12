export const normaliser = (texte: string) =>
  texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const POINTS_DEBUT_LIBELLE = 100;
const POINTS_LIBELLE = 60;
const POINTS_DESCRIPTION = 10;

interface CategorieRecherchable {
  readonly libelle: string;
  readonly description?: string;
}

// Score d'une catégorie pour une requête : chaque mot doit se trouver dans le
// libellé ou la description (sinon 0), le libellé pesant bien plus que la
// description pour qu'un mot isolé dans un long texte ne fasse pas remonter
// la catégorie.
function scoreCategorie(
  categorie: CategorieRecherchable,
  mots: readonly string[],
): number {
  const libelle = normaliser(categorie.libelle);
  const description = normaliser(categorie.description ?? "");
  let score = 0;
  for (const mot of mots) {
    if (new RegExp(`(^|[^a-z0-9])${echapper(mot)}`).test(libelle)) {
      score += POINTS_DEBUT_LIBELLE;
    } else if (libelle.includes(mot)) {
      score += POINTS_LIBELLE;
    } else if (description.includes(mot)) {
      score += POINTS_DESCRIPTION;
    } else {
      return 0;
    }
  }
  return score;
}

const echapper = (texte: string) =>
  texte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function rechercherCategories<T extends CategorieRecherchable>(
  categories: readonly T[],
  recherche: string,
): T[] {
  const mots = normaliser(recherche).split(/\s+/).filter(Boolean);
  if (mots.length === 0) return [...categories];
  return categories
    .map((categorie) => ({ categorie, score: scoreCategorie(categorie, mots) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ categorie }) => categorie);
}
