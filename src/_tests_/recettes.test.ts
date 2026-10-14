import { describe, expect, it } from "vitest";
import {
  changerLignesRecette,
  choisirModePaiementRecette,
  fraisAncv,
  detailSaisieRecetteComplet,
  detailSaisieRecetteVide,
  versDetailRecette,
  versRecetteNomenclature,
  type DetailSaisieRecette,
} from "@/lib/recettes";
import type { DetailRecette } from "@/constants/piecesJointes";

const detailRecette = (
  modification: Partial<DetailRecette>,
): DetailRecette => ({
  date: "2026-08-16",
  modePaiement: "Virement",
  description: "",
  lignes: [],
  ...modification,
});

const detailSaisie = (
  modification: Partial<DetailSaisieRecette>,
): DetailSaisieRecette => ({
  date: "2026-08-16",
  modePaiement: "Virement",
  description: "",
  lignes: [{ categorie: "Cotisations SGDF", montant: "45" }],
  posteBudgetaireId: "",
  fraisAncvAuto: false,
  ...modification,
});

describe("recettes", () => {
  it("produit un détail vide avec la date du jour", () => {
    const vide = detailSaisieRecetteVide();
    expect(vide.modePaiement).toBe("");
    expect(vide.lignes).toEqual([{ categorie: "", montant: "" }]);
  });

  it("utilise la catégorie unique et le total pour la nomenclature", () => {
    expect(
      versRecetteNomenclature(
        detailRecette({
          modePaiement: "Chèque",
          lignes: [
            { categorie: "Cotisations SGDF", montant: 10 },
            { categorie: "Cotisations SGDF", montant: 5.5 },
          ],
        }),
      ),
    ).toEqual({
      typeDepense: "Cotisations SGDF",
      modePaiement: "Chèque",
      montant: 15.5,
    });
  });

  it("utilise « Multiples » quand plusieurs catégories sont utilisées", () => {
    expect(
      versRecetteNomenclature(
        detailRecette({
          lignes: [
            { categorie: "Cotisations SGDF", montant: 10 },
            { categorie: "Vente article boutique", montant: 5 },
          ],
        }),
      ).typeDepense,
    ).toBe("Multiples");
  });

  it("exige date, mode de paiement, catégorie et montant", () => {
    const complet = detailSaisie({});
    expect(detailSaisieRecetteComplet(complet)).toBe(true);
    expect(detailSaisieRecetteComplet({ ...complet, modePaiement: "" })).toBe(
      false,
    );
    expect(detailSaisieRecetteComplet({ ...complet, date: "" })).toBe(false);
    expect(
      detailSaisieRecetteComplet({
        ...complet,
        lignes: [...complet.lignes, { categorie: "", montant: "3" }],
      }),
    ).toBe(false);
  });

  it("convertit la saisie en détail avec montants numériques", () => {
    const saisie = detailSaisie({
      lignes: [{ categorie: "Cotisations SGDF", montant: "12,5" }],
    });
    expect(versDetailRecette(saisie)).toEqual({
      date: "2026-08-16",
      modePaiement: "Virement",
      description: "",
      lignes: [{ categorie: "Cotisations SGDF", montant: 12.5 }],
    });
  });
});

describe("mode de paiement ANCV", () => {
  const ancv = () =>
    choisirModePaiementRecette(detailSaisieRecetteVide(), "ANCV (2,5 %)");

  it("calcule 2,5 % négatif arrondi au centime", () => {
    expect(fraisAncv("100")).toBe("-2.5");
    expect(fraisAncv("33,33")).toBe("-0.83");
    expect(fraisAncv("")).toBe("");
    expect(fraisAncv("0")).toBe("");
  });

  it("remplace les lignes par deux lignes Cotisations SGDF", () => {
    const detail = ancv();
    expect(detail.fraisAncvAuto).toBe(true);
    expect(detail.lignes).toEqual([
      { categorie: "Cotisations SGDF", montant: "" },
      { categorie: "Cotisations SGDF", montant: "" },
    ]);
  });

  it("recalcule les frais tant que la ligne n'est pas modifiée", () => {
    const detail = ancv();
    const suivant = changerLignesRecette(detail, [
      { ...detail.lignes[0], montant: "200" },
      detail.lignes[1],
    ]);
    expect(suivant.lignes[1].montant).toBe("-5");
    expect(suivant.fraisAncvAuto).toBe(true);
  });

  it("fige la ligne de frais après modification manuelle", () => {
    const detail = ancv();
    const fige = changerLignesRecette(detail, [
      detail.lignes[0],
      { ...detail.lignes[1], montant: "-1" },
    ]);
    expect(fige.fraisAncvAuto).toBe(false);
    const apres = changerLignesRecette(fige, [
      { ...fige.lignes[0], montant: "200" },
      fige.lignes[1],
    ]);
    expect(apres.lignes[1].montant).toBe("-1");
  });

  it("retire la ligne de frais auto en quittant ANCV", () => {
    const detail = choisirModePaiementRecette(ancv(), "Virement");
    expect(detail.lignes).toHaveLength(1);
    expect(detail.fraisAncvAuto).toBe(false);
  });

  it("garde les lignes en quittant ANCV si les frais ont été modifiés", () => {
    const detail = ancv();
    const fige = changerLignesRecette(detail, [detail.lignes[0]]);
    const quitte = choisirModePaiementRecette(fige, "Chèque");
    expect(quitte.lignes).toHaveLength(1);
    expect(quitte.modePaiement).toBe("Chèque");
  });
});
