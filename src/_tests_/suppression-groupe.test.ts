import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  clientQuery: vi.fn(),
  release: vi.fn(),
  envoyerEmail: vi.fn(),
  recupererGroupeActif: vi.fn(),
  rechercherHistorique: vi.fn(),
  calculerSuivi: vi.fn(),
}));

vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/baseDeDonnees", () => ({
  pool: {
    query: mocks.query,
    connect: async () => ({
      query: mocks.clientQuery,
      release: mocks.release,
    }),
  },
}));
vi.mock("@/lib/emailSuppressionGroupe", () => ({
  envoyerEmailSuppressionGroupe: mocks.envoyerEmail,
}));
vi.mock("@/lib/groupServer", () => ({
  recupererGroupeActif: mocks.recupererGroupeActif,
}));
vi.mock("@/lib/historiqueRequetes", async () => {
  const reel = await vi.importActual<typeof import("@/lib/historiqueRequetes")>(
    "@/lib/historiqueRequetes",
  );
  return { ...reel, rechercherHistorique: mocks.rechercherHistorique };
});
vi.mock("@/lib/budgetServer", () => ({
  calculerSuiviBudgetaire: mocks.calculerSuivi,
}));

import {
  DELAI_SUPPRESSION_JOURS,
  SuppressionGroupeErreur,
  demanderSuppressionGroupe,
  purgerGroupesEchus,
  reactiverGroupe,
} from "@/lib/suppressionGroupe";

const groupe = (historiqueActif: boolean, budgetActif: boolean) => ({
  organisation: { id: "org_1", name: "Groupe test" },
  nomenclature: { anneeComptable: { mois: 9, jour: 1 } },
  parametres: {
    historiqueActif,
    budgetActif,
    anneeComptableDebut: { mois: 9, jour: 1 },
  },
});

const parametres = {
  identifiantOrganisation: "org_1",
  identifiantUtilisateur: "user_1",
  nomUtilisateur: "Alice",
};

describe("demanderSuppressionGroupe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.envoyerEmail.mockResolvedValue(undefined);
    mocks.rechercherHistorique.mockResolvedValue({ lignes: [] });
    mocks.calculerSuivi.mockResolvedValue({ depense: [], recette: [] });
    mocks.clientQuery.mockResolvedValue({ rowCount: 0 });
  });

  const preparerRequetes = (suppressionDemandeeLe: Date | null) =>
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT suppression_demandee_le"))
        return {
          rows: suppressionDemandeeLe
            ? [{ suppression_demandee_le: suppressionDemandeeLe }]
            : [],
        };
      if (sql.includes("FROM member"))
        return { rows: [{ email: "a@test.fr" }, { email: "b@test.fr" }] };
      return { rows: [] };
    });

  it("refuse un groupe déjà en suppression", async () => {
    preparerRequetes(new Date());

    await expect(demanderSuppressionGroupe(parametres)).rejects.toMatchObject({
      code: "DEJA_EN_SUPPRESSION",
    });
    expect(mocks.envoyerEmail).not.toHaveBeenCalled();
  });

  it("joint uniquement les CSV des options activées", async () => {
    preparerRequetes(null);
    mocks.recupererGroupeActif.mockResolvedValue(groupe(true, false));

    await demanderSuppressionGroupe(parametres);

    const envoi = mocks.envoyerEmail.mock.calls[0][0];
    expect(envoi.destinataires).toEqual(["a@test.fr", "b@test.fr"]);
    expect(envoi.fichiers.map((f: { nom: string }) => f.nom)).toEqual([
      "historique.csv",
    ]);
  });

  it("n'envoie aucun fichier sans historique ni budget", async () => {
    preparerRequetes(null);
    mocks.recupererGroupeActif.mockResolvedValue(groupe(false, false));

    await demanderSuppressionGroupe(parametres);

    expect(mocks.envoyerEmail.mock.calls[0][0].fichiers).toEqual([]);
  });

  it("ne modifie rien si l'e-mail échoue", async () => {
    preparerRequetes(null);
    mocks.recupererGroupeActif.mockResolvedValue(groupe(false, false));
    mocks.envoyerEmail.mockRejectedValue(new Error("SMTP"));

    await expect(demanderSuppressionGroupe(parametres)).rejects.toMatchObject({
      code: "ENVOI_EMAIL_ECHOUE",
    });
    expect(mocks.clientQuery).not.toHaveBeenCalled();
  });

  it("annule les notes signées et marque le groupe après l'envoi", async () => {
    preparerRequetes(null);
    mocks.recupererGroupeActif.mockResolvedValue(groupe(false, false));

    const date = await demanderSuppressionGroupe(parametres);

    const requetes = mocks.clientQuery.mock.calls.map(([sql]) => sql);
    expect(requetes[0]).toBe("BEGIN");
    expect(requetes[1]).toContain("scouticket_notes_de_frais_signees");
    expect(
      requetes.some((sql) => sql.includes("suppression_demandee_le")),
    ).toBe(true);
    expect(requetes[requetes.length - 1]).toBe("COMMIT");
    expect(date.getTime()).toBeGreaterThan(
      Date.now() + (DELAI_SUPPRESSION_JOURS - 1) * 24 * 60 * 60 * 1000,
    );
  });
});

describe("reactiverGroupe", () => {
  beforeEach(() => vi.clearAllMocks());

  it("échoue si le groupe n'est pas en suppression", async () => {
    mocks.query.mockResolvedValue({ rowCount: 0 });

    await expect(
      reactiverGroupe({
        identifiantOrganisation: "org_1",
        identifiantUtilisateur: "user_1",
      }),
    ).rejects.toBeInstanceOf(SuppressionGroupeErreur);
  });
});

describe("purgerGroupesEchus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ne fait rien si une autre instance détient le verrou", async () => {
    mocks.clientQuery.mockImplementation(async (sql: string) =>
      sql.includes("pg_try_advisory_xact_lock")
        ? { rows: [{ obtenu: false }] }
        : { rows: [] },
    );

    expect(await purgerGroupesEchus()).toBe(0);
    expect(
      mocks.clientQuery.mock.calls.some(([sql]) =>
        String(sql).includes("DELETE FROM organization"),
      ),
    ).toBe(false);
  });

  it("supprime les groupes échus (délai de 30 jours)", async () => {
    mocks.clientQuery.mockImplementation(
      async (sql: string, valeurs: unknown[]) => {
        if (sql.includes("pg_try_advisory_xact_lock"))
          return { rows: [{ obtenu: true }] };
        if (sql.includes("SELECT organization_id")) {
          const limite = valeurs[0] as Date;
          const attendu = Date.now() - DELAI_SUPPRESSION_JOURS * 86_400_000;
          expect(Math.abs(limite.getTime() - attendu)).toBeLessThan(5000);
          return { rows: [{ organization_id: "org_1" }] };
        }
        return { rows: [] };
      },
    );

    expect(await purgerGroupesEchus()).toBe(1);
    expect(mocks.clientQuery).toHaveBeenCalledWith(
      "DELETE FROM organization WHERE id = $1",
      ["org_1"],
    );
    expect(mocks.clientQuery).toHaveBeenLastCalledWith("COMMIT");
  });
});
