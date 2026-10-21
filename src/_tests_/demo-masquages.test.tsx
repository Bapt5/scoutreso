import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FormulaireDepense } from "@/components/FormulaireDepense";
import ProfilUtilisateur from "@/components/ProfilUtilisateur";
import { fonctionnaliteDisponibleEnDemo } from "@/lib/demo/mode";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/lib/auth-client", () => ({
  clientAuth: {
    useSession: () => ({
      data: { user: { name: "Camille", email: "camille@demo.invalid" } },
    }),
    listAccounts: vi.fn().mockResolvedValue({
      data: [{ providerId: "credential" }],
    }),
  },
}));

const formulaireNoteSignee = () => (
  <FormulaireDepense
    typeEnvoi="note-de-frais"
    piecesJointes={[]}
    emailUtilisateur="camille@demo.invalid"
    units={[{ id: "g", label: "Groupe", color: "#1E3A8A" }]}
    aTresorier
    ndfSigneeActif
  />
);

describe("fonctionnaliteDisponibleEnDemo", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("autorise tout hors démo", () => {
    expect(fonctionnaliteDisponibleEnDemo("invitation-membres")).toBe(true);
    expect(fonctionnaliteDisponibleEnDemo("suppression-groupe")).toBe(true);
  });

  it("retire les fonctionnalités sans objet en démo", () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");

    for (const nom of [
      "invitation-membres",
      "creation-groupe",
      "suppression-groupe",
      "suppression-compte",
      "identifiants-compte",
      "depot-note-signee",
    ] as const)
      expect(fonctionnaliteDisponibleEnDemo(nom)).toBe(false);
  });
});

describe("masquages de la démo", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true"));
  afterEach(() => vi.unstubAllEnvs());

  it("désactive le dépôt d'une note de frais signée avec une explication", () => {
    render(formulaireNoteSignee());

    expect(screen.getByRole("status")).toHaveTextContent(
      "disponible dans la version complète",
    );
    expect(
      screen.getByRole("button", {
        name: "Disponible dans la version complète",
      }),
    ).toBeDisabled();
    expect(screen.queryByText(/circuit de signature/)).not.toBeInTheDocument();
  });

  it("garde le circuit signé décrit et le bouton actif hors démo", () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "");
    render(formulaireNoteSignee());

    expect(screen.getByText(/circuit de signature/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Disponible dans la version complète",
      }),
    ).not.toBeInTheDocument();
  });

  it("fige l'adresse e-mail et masque le changement de mot de passe", async () => {
    render(<ProfilUtilisateur />);

    expect(await screen.findByLabelText("Adresse e-mail")).toBeDisabled();
    expect(
      screen.queryByText("Modifier mon mot de passe"),
    ).not.toBeInTheDocument();
  });
});
