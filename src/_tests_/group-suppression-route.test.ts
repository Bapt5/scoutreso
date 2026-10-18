import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recupererContexteGroupe: vi.fn(),
  recupererRoleMembre: vi.fn(),
  recupererGroupeActif: vi.fn(),
  demanderSuppressionGroupe: vi.fn(),
  verifierOrigineRequete: vi.fn(),
}));

vi.mock("@/lib/sessionServeur", () => ({
  recupererContexteGroupe: mocks.recupererContexteGroupe,
  recupererSession: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/groupServer", () => ({
  recupererRoleMembre: mocks.recupererRoleMembre,
  recupererGroupeActif: mocks.recupererGroupeActif,
}));
vi.mock("@/lib/api/securiteRequetes", async () => {
  const reel = await vi.importActual<
    typeof import("@/lib/api/securiteRequetes")
  >("@/lib/api/securiteRequetes");
  return { ...reel, verifierOrigineRequete: mocks.verifierOrigineRequete };
});
vi.mock("@/lib/suppressionGroupe", async () => {
  const reel = await vi.importActual<typeof import("@/lib/suppressionGroupe")>(
    "@/lib/suppressionGroupe",
  );
  return {
    ...reel,
    demanderSuppressionGroupe: mocks.demanderSuppressionGroupe,
  };
});

import { POST } from "@/app/api/group/suppression/route";
import { SuppressionGroupeErreur } from "@/lib/suppressionGroupe";

const requete = (corps: unknown = { confirmation: "Groupe test" }) =>
  new Request("https://example.test/api/group/suppression", {
    method: "POST",
    body: JSON.stringify(corps),
  });

describe("POST /api/group/suppression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recupererContexteGroupe.mockResolvedValue({
      session: { user: { id: "user_1", name: "Alice" } },
      identifiantUtilisateur: "user_1",
      identifiantOrganisation: "org_1",
    });
    mocks.recupererRoleMembre.mockResolvedValue("owner");
    mocks.recupererGroupeActif.mockResolvedValue({
      organisation: { id: "org_1", name: "Groupe test" },
    });
    mocks.verifierOrigineRequete.mockReturnValue(null);
    mocks.demanderSuppressionGroupe.mockResolvedValue(
      new Date("2026-11-17T00:00:00Z"),
    );
  });

  it("refuse sans groupe actif", async () => {
    mocks.recupererContexteGroupe.mockResolvedValue({
      session: null,
      identifiantUtilisateur: null,
      identifiantOrganisation: null,
    });

    expect((await POST(requete())).status).toBe(401);
  });

  it("réserve la suppression au trésorier (owner)", async () => {
    mocks.recupererRoleMembre.mockResolvedValue("admin");

    const reponse = await POST(requete());

    expect(reponse.status).toBe(403);
    expect(mocks.demanderSuppressionGroupe).not.toHaveBeenCalled();
  });

  it("refuse un nom de confirmation incorrect", async () => {
    const reponse = await POST(requete({ confirmation: "Autre" }));

    expect(reponse.status).toBe(400);
    expect(mocks.demanderSuppressionGroupe).not.toHaveBeenCalled();
  });

  it("demande la suppression et renvoie la date définitive", async () => {
    const reponse = await POST(requete());
    const corps = await reponse.json();

    expect(reponse.status).toBe(200);
    expect(corps.suppressionDefinitiveLe).toBe("2026-11-17T00:00:00.000Z");
    expect(mocks.demanderSuppressionGroupe).toHaveBeenCalledWith({
      identifiantOrganisation: "org_1",
      identifiantUtilisateur: "user_1",
      nomUtilisateur: "Alice",
    });
  });

  it("renvoie 502 quand l'envoi de l'e-mail échoue", async () => {
    mocks.demanderSuppressionGroupe.mockRejectedValue(
      new SuppressionGroupeErreur("ENVOI_EMAIL_ECHOUE"),
    );

    const reponse = await POST(requete());
    const corps = await reponse.json();

    expect(reponse.status).toBe(502);
    expect(corps.error).toContain("n’a pas été supprimé");
  });

  it("renvoie 409 si le groupe est déjà en suppression", async () => {
    mocks.demanderSuppressionGroupe.mockRejectedValue(
      new SuppressionGroupeErreur("DEJA_EN_SUPPRESSION"),
    );

    expect((await POST(requete())).status).toBe(409);
  });
});
