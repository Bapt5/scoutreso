import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FormulaireNomInscription from "@/components/FormulaireNomInscription";
import {
  cheminRetourSecurise,
  validerNomInscription,
} from "@/lib/nomInscription";

const mocks = vi.hoisted(() => ({
  modifierUtilisateur: vi.fn(),
  suite: "/invitation?id=abc",
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams({ suite: mocks.suite }),
}));
vi.mock("@/lib/auth-client", () => ({
  clientAuth: { updateUser: mocks.modifierUtilisateur },
}));

describe("validerNomInscription", () => {
  it("nettoie et accepte un nom valide", () => {
    expect(validerNomInscription("  Jean   Dupont ")).toEqual({
      nom: "Jean Dupont",
    });
  });
  it.each(["", " a ", "jean@example.com", "x".repeat(101)])(
    "refuse %j",
    (saisie) => {
      expect(validerNomInscription(saisie)).toHaveProperty("erreur");
    },
  );
});

describe("cheminRetourSecurise", () => {
  it("refuse les URL externes", () => {
    expect(cheminRetourSecurise("//evil.test")).toBe("/");
    expect(cheminRetourSecurise("https://evil.test")).toBe("/");
    expect(cheminRetourSecurise(null)).toBe("/");
    expect(cheminRetourSecurise("/invitation?id=1")).toBe("/invitation?id=1");
  });
});

describe("FormulaireNomInscription", () => {
  const assign = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.suite = "/invitation?id=abc";
    mocks.modifierUtilisateur.mockResolvedValue({ error: null });
    Object.defineProperty(window, "location", {
      value: { ...window.location, assign },
      writable: true,
    });
  });

  it("enregistre le nom puis redirige vers la suite", async () => {
    render(<FormulaireNomInscription />);
    await userEvent.type(screen.getByLabelText("Prénom et nom"), "Jean Dupont");
    await userEvent.click(screen.getByRole("button", { name: "Valider" }));
    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith("/invitation?id=abc"),
    );
    expect(mocks.modifierUtilisateur).toHaveBeenCalledWith({
      name: "Jean Dupont",
    });
  });

  it("ignore sans modifier le nom", async () => {
    render(<FormulaireNomInscription />);
    await userEvent.click(screen.getByRole("button", { name: "Ignorer" }));
    expect(mocks.modifierUtilisateur).not.toHaveBeenCalled();
    expect(assign).toHaveBeenCalledWith("/invitation?id=abc");
  });

  it("refuse un nom invalide", async () => {
    render(<FormulaireNomInscription />);
    await userEvent.type(screen.getByLabelText("Prénom et nom"), "a@b.c");
    await userEvent.click(screen.getByRole("button", { name: "Valider" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(mocks.modifierUtilisateur).not.toHaveBeenCalled();
  });

  it("replie sur l'accueil si la suite est externe", async () => {
    mocks.suite = "//evil.test";
    render(<FormulaireNomInscription />);
    await userEvent.click(screen.getByRole("button", { name: "Ignorer" }));
    expect(assign).toHaveBeenCalledWith("/");
  });
});
