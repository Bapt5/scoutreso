import { describe, expect, it } from "vitest";
import { rechercherCategories } from "@/lib/rechercheCategories";

const categories = [
  { libelle: "Alimentation", description: "Courses, repas, transport inclus" },
  { libelle: "Transports", description: "Billets, essence, péages" },
  { libelle: "Frais de transport", description: "" },
  { libelle: "Matériel", description: "Achat de tentes et de cordes" },
];

describe("rechercherCategories", () => {
  it("conserve l'ordre si la recherche est vide", () => {
    expect(rechercherCategories(categories, "  ")).toEqual(categories);
  });

  it("place le libellé avant la description", () => {
    const resultats = rechercherCategories(categories, "transport");
    expect(resultats.map((c) => c.libelle)).toEqual([
      "Transports",
      "Frais de transport",
      "Alimentation",
    ]);
  });

  it("ignore accents et casse", () => {
    expect(rechercherCategories(categories, "MATERIEL")).toEqual([
      categories[3],
    ]);
  });

  it("exige tous les mots", () => {
    expect(rechercherCategories(categories, "billets essence")).toEqual([
      categories[1],
    ]);
    expect(rechercherCategories(categories, "billets tentes")).toEqual([]);
  });

  it("départage à égalité selon l'ordre d'entrée", () => {
    const egales = [
      { libelle: "Alpha", description: "x" },
      { libelle: "Alphabet", description: "x" },
    ];
    expect(rechercherCategories(egales, "alpha")).toEqual(egales);
  });
});
