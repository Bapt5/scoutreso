import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recupererSession: vi.fn(),
  recupererRoleMembre: vi.fn(),
  reactiverGroupe: vi.fn(),
  verifierOrigineRequete: vi.fn(),
}));

vi.mock("@/lib/sessionServeur", () => ({
  recupererSession: mocks.recupererSession,
}));
vi.mock("@/lib/groupServer", async () => {
  const reel =
    await vi.importActual<typeof import("@/lib/groupServer")>(
      "@/lib/groupServer",
    );
  return { ...reel, recupererRoleMembre: mocks.recupererRoleMembre };
});
vi.mock("@/lib/api/securiteRequetes", () => ({
  verifierOrigineRequete: mocks.verifierOrigineRequete,
}));
vi.mock("@/lib/suppressionGroupe", async () => {
  const reel = await vi.importActual<typeof import("@/lib/suppressionGroupe")>(
    "@/lib/suppressionGroupe",
  );
  return { ...reel, reactiverGroupe: mocks.reactiverGroupe };
});

import { POST } from "@/app/api/group/reactivation/route";
import { SuppressionGroupeErreur } from "@/lib/suppressionGroupe";

const requete = () =>
  new Request("https://example.test/api/group/reactivation", {
    method: "POST",
    body: JSON.stringify({ organizationId: "org_1" }),
  });

describe("POST /api/group/reactivation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recupererSession.mockResolvedValue({ user: { id: "user_1" } });
    mocks.recupererRoleMembre.mockResolvedValue("admin");
    mocks.verifierOrigineRequete.mockReturnValue(null);
    mocks.reactiverGroupe.mockResolvedValue(undefined);
  });

  it("refuse une requête non authentifiée", async () => {
    mocks.recupererSession.mockResolvedValue(null);

    expect((await POST(requete())).status).toBe(401);
  });

  it("refuse un simple membre", async () => {
    mocks.recupererRoleMembre.mockResolvedValue("member");

    const reponse = await POST(requete());

    expect(reponse.status).toBe(403);
    expect(mocks.reactiverGroupe).not.toHaveBeenCalled();
  });

  it("réactive le groupe pour un responsable", async () => {
    const reponse = await POST(requete());

    expect(reponse.status).toBe(200);
    expect(mocks.reactiverGroupe).toHaveBeenCalledWith({
      identifiantOrganisation: "org_1",
      identifiantUtilisateur: "user_1",
    });
  });

  it("renvoie 409 si le groupe n'est pas en suppression", async () => {
    mocks.reactiverGroupe.mockRejectedValue(
      new SuppressionGroupeErreur("NON_EN_SUPPRESSION"),
    );

    expect((await POST(requete())).status).toBe(409);
  });
});
