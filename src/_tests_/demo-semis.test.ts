import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requetes: [] as { sql: string; valeurs: unknown[] }[],
  connect: vi.fn(),
}));

vi.mock("@/lib/baseDeDonnees", () => ({ pool: { connect: mocks.connect } }));
vi.mock("better-auth/crypto", () => ({
  hashPassword: vi.fn().mockResolvedValue("empreinte"),
}));

import { creerBacASable } from "@/lib/demo/semis";
import { anneeComptableDebut } from "@/lib/nomenclature";

const requeteContenant = (extrait: string) =>
  mocks.requetes.find((requete) => requete.sql.includes(extrait));

describe("création d'un bac à sable", () => {
  beforeEach(() => {
    mocks.requetes.length = 0;
    mocks.connect.mockResolvedValue({
      query: vi.fn(async (sql: string, valeurs: unknown[] = []) => {
        mocks.requetes.push({ sql, valeurs });
        return { rows: [] };
      }),
      release: vi.fn(),
    });
  });

  it("sème le groupe en une transaction avec les bons rôles", async () => {
    const bac = await creerBacASable({ ipHachee: "ip" });

    const sqls = mocks.requetes.map((requete) => requete.sql.trim());
    expect(sqls[0]).toBe("BEGIN");
    expect(sqls[sqls.length - 1]).toBe("COMMIT");
    expect(sqls.filter((sql) => sql === "BEGIN")).toHaveLength(1);

    const membres = requeteContenant("INSERT INTO member");
    const roles = membres?.valeurs[3] as string[];
    expect(roles.filter((role) => role === "owner")).toHaveLength(1);
    expect(roles.filter((role) => role === "admin")).toHaveLength(1);
    expect(
      roles.filter((role) => role === "member").length,
    ).toBeGreaterThanOrEqual(4);

    const utilisateurs = requeteContenant('INSERT INTO "user"');
    const emails = utilisateurs?.valeurs[2] as string[];
    expect(new Set(emails).size).toBe(emails.length);
    for (const email of emails) expect(email).toMatch(/@demo\.invalid$/);
    expect(bac.email).toBe(emails[0]);
    expect((utilisateurs?.valeurs[1] as string[]).every(Boolean)).toBe(true);
  });

  it("active toutes les options et verrouille le trésorier comme visiteur", async () => {
    const bac = await creerBacASable({ ipHachee: "ip" });

    expect(requeteContenant("INSERT INTO scouticket_group_data")?.sql).toMatch(
      /true, true, true,\s+true, true/,
    );
    expect(
      requeteContenant("INSERT INTO scouticket_notification_tresorerie")
        ?.valeurs[0],
    ).toBe(bac.identifiantUtilisateur);
    expect(requeteContenant("scouticket_signataires")?.valeurs[1]).toBe(
      bac.identifiantUtilisateur,
    );
  });

  it("date l'historique dans l'année comptable courante, avec un poste proche de 85 %", async () => {
    await creerBacASable({ ipHachee: "ip" });

    const groupe = requeteContenant("INSERT INTO scouticket_group_data");
    expect(groupe?.valeurs.slice(1, 3)).toEqual([9, 1]);
    const debut = {
      mois: groupe?.valeurs[1] as number,
      jour: groupe?.valeurs[2] as number,
    };
    const aujourdhui = new Date();
    const iso = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const anneeCourante = anneeComptableDebut(iso(aujourdhui), debut);

    const entrees = JSON.parse(
      requeteContenant("INSERT INTO scouticket_historique")
        ?.valeurs[1] as string,
    ) as {
      date: string;
      type: string;
      poste_id: string;
      montant_total: number;
    }[];
    expect(entrees.length).toBeGreaterThanOrEqual(25);
    expect(entrees.length).toBeLessThanOrEqual(40);
    expect(entrees.map((entree) => entree.type)).toEqual(
      expect.arrayContaining(["depense", "recette", "note-de-frais"]),
    );
    for (const entree of entrees) {
      expect(anneeComptableDebut(entree.date, debut)).toBe(anneeCourante);
      expect(new Date(entree.date).getTime()).toBeLessThanOrEqual(
        aujourdhui.getTime(),
      );
    }

    const budgets = requeteContenant("INSERT INTO scouticket_budgets_postes");
    expect(budgets?.valeurs[1]).toBe(anneeCourante);
    const idsPostes = budgets?.valeurs[2] as string[];
    const montants = budgets?.valeurs[3] as number[];
    const taux = idsPostes.map((id, index) => {
      const depense = entrees
        .filter((entree) => entree.poste_id === id)
        .reduce((somme, entree) => somme + entree.montant_total, 0);
      return depense / montants[index];
    });
    expect(taux.some((valeur) => valeur >= 0.8 && valeur <= 0.9)).toBe(true);
  });

  it("expire le bac à sable dans 24 heures", async () => {
    await creerBacASable({ ipHachee: "ip-hachee" });

    const insertion = requeteContenant(
      "INSERT INTO scouticket_demo_bac_a_sable",
    );
    expect(insertion?.valeurs[3]).toBe("ip-hachee");
    const dureeHeures =
      ((insertion?.valeurs[4] as Date).getTime() - Date.now()) / 3_600_000;
    expect(dureeHeures).toBeGreaterThan(23.9);
    expect(dureeHeures).toBeLessThanOrEqual(24);
  });

  it("annule tout si une insertion échoue", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("scouticket_historique")) throw new Error("echec");
      return { rows: [] };
    });
    mocks.connect.mockResolvedValue({ query, release: vi.fn() });

    await expect(creerBacASable({ ipHachee: "ip" })).rejects.toThrow("echec");
    expect(query).toHaveBeenLastCalledWith("ROLLBACK");
  });
});
