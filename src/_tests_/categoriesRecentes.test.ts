import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_CATEGORIES_RECENTES,
  cleCategoriesRecentes,
  lireCategoriesRecentes,
  memoriserCategoriesRecentes,
  ordonnerParRecence,
} from "@/lib/categoriesRecentes";

function stockageEnMemoire() {
  const donnees = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (cle: string) => donnees.get(cle) ?? null,
    setItem: (cle: string, valeur: string) => donnees.set(cle, valeur),
    removeItem: (cle: string) => donnees.delete(cle),
  });
  return donnees;
}

describe("categoriesRecentes", () => {
  let donnees: Map<string, string>;

  beforeEach(() => {
    vi.unstubAllGlobals();
    donnees = stockageEnMemoire();
  });

  it("mémorise sans doublon et met à jour la date d'utilisation", () => {
    memoriserCategoriesRecentes("g1", ["A", "B", "A"], 100);
    memoriserCategoriesRecentes("g1", ["B"], 200);

    expect(lireCategoriesRecentes("g1")).toEqual({ A: 100, B: 200 });
  });

  it("isole les catégories par groupe", () => {
    memoriserCategoriesRecentes("g1", ["A"], 100);

    expect(lireCategoriesRecentes("g2")).toEqual({});
    expect(donnees.has(cleCategoriesRecentes("g1"))).toBe(true);
  });

  it("ne garde que les plus récentes", () => {
    for (let i = 0; i < MAX_CATEGORIES_RECENTES + 3; i++) {
      memoriserCategoriesRecentes("g1", [`Cat ${i}`], i);
    }

    const recentes = lireCategoriesRecentes("g1");
    expect(Object.keys(recentes)).toHaveLength(MAX_CATEGORIES_RECENTES);
    expect(recentes["Cat 0"]).toBeUndefined();
    expect(recentes[`Cat ${MAX_CATEGORIES_RECENTES + 2}`]).toBeDefined();
  });

  it("ignore les libellés vides", () => {
    memoriserCategoriesRecentes("g1", ["", ""], 100);

    expect(donnees.size).toBe(0);
  });

  it("tolère un contenu invalide", () => {
    donnees.set(cleCategoriesRecentes("g1"), "pas du json");
    expect(lireCategoriesRecentes("g1")).toEqual({});

    donnees.set(cleCategoriesRecentes("g1"), "[1,2]");
    expect(lireCategoriesRecentes("g1")).toEqual({});

    donnees.set(cleCategoriesRecentes("g1"), '{"A":"x","B":5}');
    expect(lireCategoriesRecentes("g1")).toEqual({ B: 5 });
  });

  it("tolère un stockage indisponible", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("bloqué");
      },
      setItem: () => {
        throw new Error("bloqué");
      },
    });

    expect(lireCategoriesRecentes("g1")).toEqual({});
    expect(() => memoriserCategoriesRecentes("g1", ["A"])).not.toThrow();
  });

  it("place les récentes en tête, la plus récente d'abord, sans doublon", () => {
    const categories = [
      { libelle: "A" },
      { libelle: "B" },
      { libelle: "C" },
      { libelle: "D" },
    ];

    const resultat = ordonnerParRecence(categories, {
      C: 300,
      A: 100,
      Inconnue: 999,
    });

    expect(resultat.map((categorie) => categorie.libelle)).toEqual([
      "C",
      "A",
      "B",
      "D",
    ]);
  });
});
