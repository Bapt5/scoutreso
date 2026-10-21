import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  connect: vi.fn(),
  requetesClient: [] as { sql: string; valeurs: unknown[] }[],
}));

vi.mock("@/lib/baseDeDonnees", () => ({
  pool: { query: mocks.query, connect: mocks.connect },
}));

import {
  MAX_BACS_A_SABLE_ACTIFS,
  MAX_CREATIONS_PAR_IP_PAR_HEURE,
} from "@/lib/demo/constantes";
import { purgerBacsASable } from "@/lib/demo/purge";
import { hacherIp, verifierQuotas } from "@/lib/demo/quotas";

describe("quotas du mode démo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("hache l'IP au lieu de la stocker en clair", () => {
    vi.stubEnv("AUDIT_LOG_SECRET", "secret");
    const entetes = new Headers({ "cf-connecting-ip": "203.0.113.7" });

    const hache = hacherIp(entetes);

    expect(hache).toMatch(/^[0-9a-f]{64}$/);
    expect(hache).not.toContain("203");
    expect(hacherIp(entetes)).toBe(hache);
    expect(
      hacherIp(new Headers({ "cf-connecting-ip": "203.0.113.8" })),
    ).not.toBe(hache);
    vi.unstubAllEnvs();
  });

  it.each([
    [0, 0, "ok"],
    [MAX_CREATIONS_PAR_IP_PAR_HEURE - 1, 10, "ok"],
    [MAX_CREATIONS_PAR_IP_PAR_HEURE, 10, "ip"],
    [0, MAX_BACS_A_SABLE_ACTIFS, "global"],
  ])(
    "avec %i création(s) par IP et %i bac(s) actifs : %s",
    async (parIp, actifs, attendu) => {
      mocks.query.mockResolvedValue({ rows: [{ par_ip: parIp, actifs }] });

      expect(await verifierQuotas("ip")).toBe(attendu);
      expect(mocks.query.mock.calls[0][1]).toEqual(["ip"]);
    },
  );
});

describe("quota par IP en développement", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("est relevé sous `next dev`, où toutes les IP sont identiques", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mocks.query.mockResolvedValue({
      rows: [{ par_ip: MAX_CREATIONS_PAR_IP_PAR_HEURE + 20, actifs: 3 }],
    });

    expect(await verifierQuotas("ip")).toBe("ok");
  });
});

describe("purge des bacs à sable", () => {
  const bac = { id: "b1", organization_id: "o1", utilisateur_id: "u1" };

  function preparerClient(verrou: boolean, expires: unknown[]) {
    mocks.requetesClient.length = 0;
    mocks.connect.mockResolvedValue({
      query: vi.fn(async (sql: string, valeurs: unknown[] = []) => {
        mocks.requetesClient.push({ sql, valeurs });
        if (sql.includes("pg_try_advisory_xact_lock"))
          return { rows: [{ obtenu: verrou }] };
        if (sql.includes("FROM scouticket_demo_bac_a_sable WHERE expire_le"))
          return { rows: expires };
        if (sql.includes('SELECT "userId" FROM member'))
          return { rows: [{ userId: "u1" }, { userId: "u2" }] };
        return { rows: [] };
      }),
      release: vi.fn(),
    });
  }

  it("ne supprime que les lignes référencées par les bacs expirés", async () => {
    preparerClient(true, [bac]);

    expect(await purgerBacsASable()).toBe(1);

    const suppressions = mocks.requetesClient.filter(
      (requete) =>
        requete.sql.includes("DELETE") ||
        requete.sql.includes("UPDATE session"),
    );
    expect(suppressions.length).toBeGreaterThanOrEqual(6);
    for (const requete of suppressions) {
      expect(requete.sql).toMatch(/WHERE/);
      const valeurs = JSON.stringify(requete.valeurs);
      expect(valeurs).toMatch(/o1|b1|u1/);
    }
    const suppressionUtilisateurs = mocks.requetesClient.find((requete) =>
      requete.sql.includes('DELETE FROM "user"'),
    );
    expect(suppressionUtilisateurs?.valeurs).toEqual([
      ["u1", "u2"],
      "%@demo.invalid",
    ]);
    expect(mocks.requetesClient[mocks.requetesClient.length - 1]?.sql).toBe(
      "COMMIT",
    );
  });

  it("ne supprime rien sans bac expiré", async () => {
    preparerClient(true, []);

    expect(await purgerBacsASable()).toBe(0);
    expect(
      mocks.requetesClient.some((requete) => requete.sql.includes("DELETE")),
    ).toBe(false);
  });

  it("n'agit pas si une autre instance détient le verrou", async () => {
    preparerClient(false, [bac]);

    expect(await purgerBacsASable()).toBe(0);
    expect(
      mocks.requetesClient.some((requete) => requete.sql.includes("DELETE")),
    ).toBe(false);
  });
});
