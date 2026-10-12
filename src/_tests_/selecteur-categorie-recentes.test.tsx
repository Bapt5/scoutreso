import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SelecteurCategorie } from "@/components/SelecteurCategorie";
import { CATEGORIES_COMPTABLES } from "@/constants/configDepenses";
import { memoriserCategoriesRecentes } from "@/lib/categoriesRecentes";

const simulerMobile = (mobile: boolean) =>
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation(() => ({
      matches: mobile,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );

const rendre = (props: { restreindre?: boolean; groupe?: string } = {}) =>
  render(
    <SelecteurCategorie
      id="cat"
      libelle="Catégorie comptable *"
      valeur=""
      onChange={vi.fn()}
      restreindreAuxCourantes={props.restreindre}
      identifiantOrganisation={props.groupe}
    />,
  );

const courante = CATEGORIES_COMPTABLES.filter((c) => c.courante)[0];
const nonCourante = CATEGORIES_COMPTABLES.find((c) => !c.courante)!;

describe("SelecteurCategorie : catégories récentes en premier", () => {
  beforeEach(() => {
    const donnees = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (cle: string) => donnees.get(cle) ?? null,
      setItem: (cle: string, valeur: string) => donnees.set(cle, valeur),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("ordinateur : place la plus récente en tête, une seule fois", () => {
    simulerMobile(false);
    memoriserCategoriesRecentes("g1", [courante.libelle], 100);
    memoriserCategoriesRecentes("g1", [nonCourante.libelle], 200);
    rendre({ groupe: "g1" });
    fireEvent.focus(screen.getByRole("combobox"));

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(CATEGORIES_COMPTABLES.length);
    expect(options[0].textContent).toContain(nonCourante.libelle);
    expect(options[1].textContent).toContain(courante.libelle);
  });

  it("mobile : place les récentes en tête", () => {
    simulerMobile(true);
    memoriserCategoriesRecentes("g1", [nonCourante.libelle], 100);
    rendre({ groupe: "g1" });
    fireEvent.click(screen.getByLabelText("Catégorie comptable *"));

    expect(screen.getAllByRole("option")[0].textContent).toContain(
      nonCourante.libelle,
    );
  });

  it("propose une récente non courante même en mode restreint", () => {
    simulerMobile(false);
    memoriserCategoriesRecentes("g1", [nonCourante.libelle], 100);
    rendre({ groupe: "g1", restreindre: true });
    fireEvent.focus(screen.getByRole("combobox"));

    const options = screen.getAllByRole("option");
    expect(options[0].textContent).toContain(nonCourante.libelle);
    expect(options).toHaveLength(
      CATEGORIES_COMPTABLES.filter((c) => c.courante).length + 1,
    );
  });

  it("ignore les récentes d'un autre groupe ou sans groupe", () => {
    simulerMobile(false);
    memoriserCategoriesRecentes("g1", [nonCourante.libelle], 100);
    rendre({ groupe: "g2" });
    fireEvent.focus(screen.getByRole("combobox"));

    expect(screen.getAllByRole("option")[0].textContent).toContain(
      CATEGORIES_COMPTABLES[0].libelle,
    );
  });
});
