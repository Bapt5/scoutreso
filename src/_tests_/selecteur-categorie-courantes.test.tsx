import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SelecteurCategorie } from "@/components/SelecteurCategorie";
import {
  CATEGORIES_COMPTABLES,
  type CategorieComptable,
} from "@/constants/configDepenses";
import { CATEGORIES_COMPTABLES_RECETTES } from "@/constants/configRecettes";

const courantes = (categories: readonly CategorieComptable[]) =>
  categories.filter((categorie) => categorie.courante);

const simulerMobile = (mobile: boolean) =>
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation(() => ({
      matches: mobile,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );

const rendre = (valeur = "") =>
  render(
    <SelecteurCategorie
      id="cat"
      libelle="Catégorie comptable *"
      valeur={valeur}
      onChange={vi.fn()}
      restreindreAuxCourantes
    />,
  );

describe("configuration des catégories courantes", () => {
  it("marque des catégories courantes, et pas toutes, en dépenses et en recettes", () => {
    for (const liste of [
      CATEGORIES_COMPTABLES,
      CATEGORIES_COMPTABLES_RECETTES,
    ]) {
      expect(courantes(liste).length).toBeGreaterThan(0);
      expect(courantes(liste).length).toBeLessThan(liste.length);
    }
  });
});

describe("SelecteurCategorie restreint aux catégories courantes", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("mobile : propose les courantes puis toutes via le bouton", () => {
    simulerMobile(true);
    rendre();
    fireEvent.click(screen.getByLabelText("Catégorie comptable *"));
    expect(screen.getAllByRole("option")).toHaveLength(
      courantes(CATEGORIES_COMPTABLES).length,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Afficher toutes les catégories" }),
    );
    expect(screen.getAllByRole("option")).toHaveLength(
      CATEGORIES_COMPTABLES.length,
    );
    expect(
      screen.queryByRole("button", { name: "Afficher toutes les catégories" }),
    ).toBeNull();
  });

  it("ordinateur : propose les courantes puis toutes via le bouton", () => {
    simulerMobile(false);
    rendre();
    fireEvent.focus(screen.getByRole("combobox"));
    expect(screen.getAllByRole("option")).toHaveLength(
      courantes(CATEGORIES_COMPTABLES).length,
    );
    fireEvent.mouseDown(
      screen.getByRole("button", { name: "Afficher toutes les catégories" }),
    );
    expect(screen.getAllByRole("option")).toHaveLength(
      CATEGORIES_COMPTABLES.length,
    );
  });

  it("garde la catégorie déjà choisie même non courante", () => {
    simulerMobile(false);
    const nonCourante = CATEGORIES_COMPTABLES.find(
      (categorie) => !categorie.courante,
    )!;
    rendre(nonCourante.libelle);
    fireEvent.focus(screen.getByRole("combobox"));
    expect(screen.getAllByRole("option")).toHaveLength(
      courantes(CATEGORIES_COMPTABLES).length + 1,
    );
  });

  it("ne restreint pas sans l'option", () => {
    simulerMobile(false);
    render(
      <SelecteurCategorie
        id="cat"
        libelle="Catégorie comptable *"
        valeur=""
        onChange={vi.fn()}
      />,
    );
    fireEvent.focus(screen.getByRole("combobox"));
    expect(screen.getAllByRole("option")).toHaveLength(
      CATEGORIES_COMPTABLES.length,
    );
    expect(
      screen.queryByRole("button", { name: "Afficher toutes les catégories" }),
    ).toBeNull();
  });
});
