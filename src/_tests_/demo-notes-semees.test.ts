// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  recupererSession: vi.fn(),
  envoyerEmailTourDeSigner: vi.fn(),
}));

vi.mock("@/lib/baseDeDonnees", () => ({ pool: { query: mocks.query } }));
vi.mock("@/lib/sessionServeur", () => ({
  recupererSession: mocks.recupererSession,
}));

import { creerTransporteurEmail, envoyerMail } from "@/lib/email";
import { notifierNotesSemees } from "@/lib/demo/notifierNotes";
import {
  CLES_NOTES_SEMEES,
  MODELES_NOTES_SEMEES,
  construireDonneesNdf,
  lireEmpreintesNotesSemees,
  lirePdfNoteSemee,
  lireRibFictif,
  montantNoteSemee,
} from "@/lib/demo/notesSemees";
import type { BacASableCree } from "@/lib/demo/semis";

describe("notes de frais signées semées", () => {
  it("décrit une note classique et une note kilométrique", () => {
    expect(CLES_NOTES_SEMEES).toEqual(["classique", "kilometrique"]);
    expect(montantNoteSemee(MODELES_NOTES_SEMEES.classique)).toBe(121.3);
    // 14,20 EUR de péage + 200 km x 0,354 EUR
    expect(montantNoteSemee(MODELES_NOTES_SEMEES.kilometrique)).toBe(85);
  });

  it("le montant des données du circuit inclut les kilomètres", () => {
    const donnees = construireDonneesNdf(MODELES_NOTES_SEMEES.kilometrique, {
      emailBeneficiaire: "lea@demo.invalid",
      groupe: "Groupe",
      branche: "Farfadets",
      couleur: "#6CC24A",
      emailsTresoriers: ["camille@demo.invalid"],
      posteBudgetaireId: "poste-1",
    });

    expect(donnees.montant).toBe(85);
    expect(donnees.kilometrage?.montant).toBe(70.8);
    expect(donnees.detailsDepenses[0].posteBudgetaireId).toBe("poste-1");
  });

  it.each(CLES_NOTES_SEMEES)(
    "le PDF d'exemple %s porte les signatures du bénéficiaire et du responsable seulement",
    async (cle) => {
      const pdf = lirePdfNoteSemee(cle);
      const document = await PDFDocument.load(pdf);

      // page SGDF + justificatif(s) + 3 pages de signature
      expect(document.getPageCount()).toBeGreaterThanOrEqual(5);
      expect(pdf.toString("latin1").match(/\/ByteRange/g)).toHaveLength(2);
      expect(lireEmpreintesNotesSemees()[cle]).toMatch(/^[0-9a-f]{64}$/);
    },
  );

  it("le RIB est manifestement fictif", async () => {
    const rib = lireRibFictif();

    expect((await PDFDocument.load(rib)).getPageCount()).toBe(1);
    expect(rib.length).toBeLessThan(10_000);
    expect(JSON.stringify(MODELES_NOTES_SEMEES)).not.toMatch(/FR76/);
  });
});

describe("e-mails des notes semées", () => {
  const bac: BacASableCree = {
    identifiantBac: "bac-1",
    identifiantOrganisation: "o1",
    identifiantUtilisateur: "u1",
    email: "camille-x@demo.invalid",
    notes: [
      {
        id: "n1",
        demandeur: "thomas-x@demo.invalid",
        montant: 121.3,
        groupe: "Groupe Démo (fictif)",
        rib: {
          nomAffiche: "RIB fictif",
          typeMime: "application/pdf",
          donneesBase64: "JVBERi0=",
          nomFichierOriginal: "RIB fictif.pdf",
          nomFichierNormalise: "RIB fictif.pdf",
        },
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    vi.stubEnv("APP_URL", "http://localhost:3000");
    mocks.recupererSession.mockResolvedValue(null);
    mocks.query.mockResolvedValue({ rows: [] });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("dépose le mail dans le bac imposé, sans session ni envoi réel", async () => {
    await notifierNotesSemees(bac);

    expect(mocks.recupererSession).not.toHaveBeenCalled();
    const insertion = mocks.query.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO scouticket_demo_mail"),
    );
    const valeurs = insertion?.[1];
    expect(valeurs[1]).toBe("bac-1");
    expect(valeurs[2]).toEqual(["camille-x@demo.invalid"]);
    expect(valeurs[3]).toBe("Note de frais à traiter : thomas-x@demo.invalid");
    expect(valeurs[4]).toContain("/note-de-frais/n1/signature");
    expect(JSON.parse(valeurs[6])).toEqual([
      { nom: "RIB fictif.pdf", taille: 5 },
    ]);
  });

  it("n'impose le bac que pendant l'exécution demandée", async () => {
    await notifierNotesSemees(bac);
    mocks.query.mockClear();

    await envoyerMail({ to: "a@demo.invalid", subject: "Hors contexte" });

    expect(
      mocks.query.mock.calls.some(([sql]) =>
        String(sql).includes("INSERT INTO scouticket_demo_mail"),
      ),
    ).toBe(false);
    expect(() => creerTransporteurEmail()).toThrow();
  });
});
