import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifierQuotas: vi.fn(),
  purgerBacsASable: vi.fn(),
  creerBacASable: vi.fn(),
  signInEmail: vi.fn(),
  query: vi.fn(),
  recupererSession: vi.fn(),
}));

vi.mock("@/lib/baseDeDonnees", () => ({ pool: { query: mocks.query } }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { signInEmail: mocks.signInEmail } },
}));
vi.mock("@/lib/sessionServeur", () => ({
  recupererSession: mocks.recupererSession,
}));
vi.mock("@/lib/demo/quotas", () => ({
  hacherIp: () => "ip",
  verifierQuotas: mocks.verifierQuotas,
}));
vi.mock("@/lib/demo/purge", () => ({
  purgerBacsASable: mocks.purgerBacsASable,
}));
vi.mock("@/lib/demo/semis", () => ({
  creerBacASable: mocks.creerBacASable,
  motDePasseDemo: () => "mot-de-passe",
}));

import * as routeDemarrer from "@/app/api/demo/demarrer/route";
import { POST as reinitialiser } from "@/app/api/demo/reinitialiser/route";

const requete = (chemin: string) =>
  new Request(`http://localhost:3000${chemin}`, {
    method: "POST",
    headers: { origin: "http://localhost:3000" },
  });

describe("démarrage et réinitialisation de la démo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    vi.stubEnv("APP_URL", "http://localhost:3000");
    mocks.verifierQuotas.mockResolvedValue("ok");
    mocks.creerBacASable.mockResolvedValue({
      email: "camille-x@demo.invalid",
      identifiantOrganisation: "o1",
      identifiantUtilisateur: "u1",
    });
    mocks.signInEmail.mockResolvedValue({ token: "jeton" });
    mocks.recupererSession.mockResolvedValue({ user: { id: "u-ancien" } });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("n'expose que POST : un GET ne crée jamais de bac à sable", () => {
    expect(Object.keys(routeDemarrer).sort()).toEqual(["POST"]);
  });

  it("crée le bac, ouvre la session sur son organisation et redirige", async () => {
    const reponse = await routeDemarrer.POST(requete("/api/demo/demarrer"));

    expect(reponse.status).toBe(303);
    expect(reponse.headers.get("location")).toBe("http://localhost:3000/");
    expect(mocks.signInEmail.mock.calls[0][0].body).toEqual({
      email: "camille-x@demo.invalid",
      password: "mot-de-passe",
    });
    expect(mocks.query.mock.calls[0][1]).toEqual(["o1", "jeton"]);
  });

  it("renvoie 404 hors mode démo", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "");

    const reponse = await routeDemarrer.POST(requete("/api/demo/demarrer"));

    expect(reponse.status).toBe(404);
    expect(mocks.creerBacASable).not.toHaveBeenCalled();
  });

  it("refuse une origine différente", async () => {
    const reponse = await routeDemarrer.POST(
      new Request("http://localhost:3000/api/demo/demarrer", {
        method: "POST",
        headers: { origin: "https://autre.example" },
      }),
    );

    expect(reponse.status).toBe(403);
    expect(mocks.creerBacASable).not.toHaveBeenCalled();
  });

  it("répond 429 quand le quota par IP est atteint", async () => {
    mocks.verifierQuotas.mockResolvedValue("ip");

    const reponse = await routeDemarrer.POST(requete("/api/demo/demarrer"));

    expect(reponse.status).toBe(429);
    expect(await reponse.text()).toContain("momentanément saturée");
    expect(mocks.purgerBacsASable).not.toHaveBeenCalled();
    expect(mocks.creerBacASable).not.toHaveBeenCalled();
  });

  it("purge d'abord quand le plafond global est atteint, puis crée si de la place s'est libérée", async () => {
    mocks.verifierQuotas
      .mockResolvedValueOnce("global")
      .mockResolvedValueOnce("ok");

    const reponse = await routeDemarrer.POST(requete("/api/demo/demarrer"));

    expect(mocks.purgerBacsASable).toHaveBeenCalledOnce();
    expect(reponse.status).toBe(303);
  });

  it("refuse (429) si le plafond global tient après la purge", async () => {
    mocks.verifierQuotas.mockResolvedValue("global");

    const reponse = await routeDemarrer.POST(requete("/api/demo/demarrer"));

    expect(mocks.purgerBacsASable).toHaveBeenCalledOnce();
    expect(reponse.status).toBe(429);
  });

  it("réinitialise : nouveau bac, ancien marqué expiré", async () => {
    const reponse = await reinitialiser(requete("/api/demo/reinitialiser"));

    expect(reponse.status).toBe(303);
    expect(mocks.creerBacASable).toHaveBeenCalledOnce();
    const expiration = mocks.query.mock.calls.find(([sql]) =>
      String(sql).includes("SET expire_le = now()"),
    );
    expect(expiration?.[1]).toEqual(["u-ancien"]);
  });

  it("réinitialiser exige une session et respecte les quotas", async () => {
    mocks.recupererSession.mockResolvedValue(null);
    expect(
      (await reinitialiser(requete("/api/demo/reinitialiser"))).status,
    ).toBe(401);

    mocks.recupererSession.mockResolvedValue({ user: { id: "u" } });
    mocks.verifierQuotas.mockResolvedValue("ip");
    const reponse = await reinitialiser(requete("/api/demo/reinitialiser"));
    expect(reponse.status).toBe(429);
    expect(mocks.creerBacASable).not.toHaveBeenCalled();
    expect(
      mocks.query.mock.calls.some(([sql]) =>
        String(sql).includes("SET expire_le"),
      ),
    ).toBe(false);
  });
});
