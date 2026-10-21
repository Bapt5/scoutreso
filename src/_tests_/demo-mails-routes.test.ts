import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  identifiantBacDeLaSession: vi.fn(),
}));

vi.mock("@/lib/baseDeDonnees", () => ({ pool: { query: mocks.query } }));
vi.mock("@/lib/sessionServeur", () => ({
  recupererSession: vi.fn().mockResolvedValue(null),
}));

import { GET as lireHtml } from "@/app/api/demo/mails/[id]/html/route";
import { GET as interroger } from "@/app/api/demo/mails/route";
import * as bacASable from "@/lib/demo/bacASable";

vi.spyOn(bacASable, "identifiantBacDeLaSession").mockImplementation(
  mocks.identifiantBacDeLaSession,
);

const appeler = (chemin: string) =>
  new Request(`http://localhost:3000${chemin}`);
const parametresId = (id: string) => ({ params: Promise.resolve({ id }) });

describe("routes de la boîte mail de la démo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    mocks.identifiantBacDeLaSession.mockResolvedValue("bac-1");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("exige une session avec un bac à sable", async () => {
    mocks.identifiantBacDeLaSession.mockResolvedValue(null);

    expect((await interroger(appeler("/api/demo/mails"))).status).toBe(401);
    expect(
      (await lireHtml(appeler("/api/demo/mails/m1/html"), parametresId("m1")))
        .status,
    ).toBe(401);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("n'existe pas hors mode démo", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "");

    expect((await interroger(appeler("/api/demo/mails"))).status).toBe(404);
  });

  it("sans curseur, renvoie l'état de départ sans mails", async () => {
    mocks.query.mockResolvedValue({ rows: [{ non_lus: 2, dernier_id: "m9" }] });

    const reponse = await interroger(appeler("/api/demo/mails"));

    expect(await reponse.json()).toEqual({
      mails: [],
      nonLus: 2,
      curseur: "m9",
    });
  });

  it("avec un curseur, renvoie les mails du seul bac de la session", async () => {
    mocks.query.mockImplementation(async (sql: string) =>
      sql.includes("ORDER BY cree_le ASC")
        ? {
            rows: [
              {
                id: "m10",
                sujet: "Sujet",
                destinataires: ["a@demo.invalid"],
                cree_le: new Date("2026-10-21T10:00:00Z"),
                lu_le: null,
                pieces_jointes: [],
              },
            ],
          }
        : { rows: [{ non_lus: 1, dernier_id: "m10" }] },
    );

    const reponse = await interroger(appeler("/api/demo/mails?apres=m9"));
    const corps = await reponse.json();

    expect(corps.mails).toEqual([
      {
        id: "m10",
        sujet: "Sujet",
        destinataires: ["a@demo.invalid"],
        creeLe: "2026-10-21T10:00:00.000Z",
        lu: false,
      },
    ]);
    expect(corps.curseur).toBe("m10");
    for (const [sql, valeurs] of mocks.query.mock.calls) {
      expect(sql).toContain("bac_a_sable_id = $1");
      expect(valeurs[0]).toBe("bac-1");
    }
  });

  it("refuse le mail d'un autre bac à sable", async () => {
    mocks.query.mockResolvedValue({ rows: [] });

    const reponse = await lireHtml(
      appeler("/api/demo/mails/mail-d-un-autre/html"),
      parametresId("mail-d-un-autre"),
    );

    expect(reponse.status).toBe(404);
    const [sql, valeurs] = mocks.query.mock.calls[0];
    expect(sql).toContain("bac_a_sable_id = $1");
    expect(valeurs).toEqual(["bac-1", "mail-d-un-autre"]);
  });

  it("sert le HTML avec une CSP stricte et des liens en nouvel onglet", async () => {
    mocks.query.mockResolvedValue({
      rows: [{ html: "<p>Bonjour</p>", texte: null }],
    });

    const reponse = await lireHtml(
      appeler("/api/demo/mails/m1/html"),
      parametresId("m1"),
    );

    expect(reponse.status).toBe(200);
    const csp = reponse.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("img-src data: https:");
    expect(csp).toContain("sandbox");
    expect(csp).not.toContain("allow-scripts");
    expect(csp).not.toContain("allow-same-origin");
    expect(reponse.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await reponse.text()).toBe('<base target="_blank"><p>Bonjour</p>');
  });

  it("échappe le texte brut quand le mail n'a pas de HTML", async () => {
    mocks.query.mockResolvedValue({
      rows: [{ html: null, texte: "<script>alert(1)</script>" }],
    });

    const reponse = await lireHtml(
      appeler("/api/demo/mails/m1/html"),
      parametresId("m1"),
    );

    const corps = await reponse.text();
    expect(corps).not.toContain("<script>");
    expect(corps).toContain("&lt;script&gt;");
  });
});
