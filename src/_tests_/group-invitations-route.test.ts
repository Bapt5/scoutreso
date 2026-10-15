import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recupererContexteGroupe: vi.fn(),
  recupererSession: vi.fn(),
  recupererRoleMembre: vi.fn(),
  query: vi.fn(),
  connect: vi.fn(),
  verifierOrigineRequete: vi.fn(),
}));

vi.mock("@/lib/sessionServeur", () => ({
  recupererContexteGroupe: mocks.recupererContexteGroupe,
  recupererSession: mocks.recupererSession,
}));
vi.mock("@/lib/groupServer", async () => {
  const reel =
    await vi.importActual<typeof import("@/lib/groupServer")>(
      "@/lib/groupServer",
    );
  return { ...reel, recupererRoleMembre: mocks.recupererRoleMembre };
});
vi.mock("@/lib/baseDeDonnees", () => ({
  pool: { query: mocks.query, connect: mocks.connect },
}));
vi.mock("@/lib/api/securiteRequetes", () => ({
  verifierOrigineRequete: mocks.verifierOrigineRequete,
}));

import {
  DELETE,
  GET,
  PATCH,
} from "@/app/api/group/invitations/[invitationId]/route";

const params = () => Promise.resolve({ invitationId: "inv_1" });
const patch = (corps: unknown) =>
  new Request("https://example.test/api/group/invitations/inv_1", {
    method: "PATCH",
    body: JSON.stringify(corps),
  });

describe("/api/group/invitations/[invitationId]", () => {
  let client: { query: ReturnType<typeof vi.fn>; release: () => void };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recupererContexteGroupe.mockResolvedValue({
      identifiantOrganisation: "org_1",
      identifiantUtilisateur: "admin_1",
    });
    mocks.recupererRoleMembre.mockResolvedValue("admin");
    mocks.verifierOrigineRequete.mockReturnValue(null);
    client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }),
      release: vi.fn(),
    };
    mocks.connect.mockResolvedValue(client);
  });

  it("refuse un appelant non responsable", async () => {
    mocks.recupererRoleMembre.mockResolvedValue("member");

    const reponse = await GET(new Request("https://example.test/x"), {
      params: params(),
    });

    expect(reponse.status).toBe(403);
  });

  it("GET renvoie 404 si l'invitation n'est plus en attente", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [] });

    const reponse = await GET(new Request("https://example.test/x"), {
      params: params(),
    });

    expect(reponse.status).toBe(404);
  });

  it("GET renvoie les unités prévues pour un futur membre", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ email: "a@b.fr", role: "member" }] })
      .mockResolvedValueOnce({
        rows: [{ id: "u1", label: "Louveteaux", color: "#fff" }],
      })
      .mockResolvedValueOnce({ rows: [{ unite_id: "u1" }] });

    const reponse = await GET(new Request("https://example.test/x"), {
      params: params(),
    });
    const corps = await reponse.json();

    expect(corps.accesTotal).toBe(false);
    expect(corps.uniteIdsAutorisees).toEqual(["u1"]);
  });

  it("PATCH refuse qu'un responsable attribue le rôle de trésorier", async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [{ email: "a@b.fr", role: "member" }],
    });

    const reponse = await PATCH(patch({ role: "owner", uniteIds: [] }), {
      params: params(),
    });

    expect(reponse.status).toBe(403);
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it("PATCH enregistre le rôle et les unités valides d'un membre", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ email: "a@b.fr", role: "member" }] })
      .mockResolvedValueOnce({ rows: [{ id: "u1" }] });

    const reponse = await PATCH(
      patch({ role: "member", uniteIds: ["u1", "inconnue"] }),
      { params: params() },
    );
    const corps = await reponse.json();

    expect(reponse.status).toBe(200);
    expect(corps.uniteIdsAutorisees).toEqual(["u1"]);
    const insertions = client.query.mock.calls.filter(([sql]) =>
      String(sql).includes("INSERT INTO scouticket_invitation_unite"),
    );
    expect(insertions).toHaveLength(1);
    expect(insertions[0][1]).toEqual(["inv_1", "org_1", "u1"]);
  });

  it("PATCH n'enregistre aucune unité pour un responsable", async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [{ email: "a@b.fr", role: "member" }],
    });

    const reponse = await PATCH(patch({ role: "admin", uniteIds: ["u1"] }), {
      params: params(),
    });

    expect(reponse.status).toBe(200);
    expect(
      client.query.mock.calls.some(([sql]) =>
        String(sql).includes("INSERT INTO scouticket_invitation_unite"),
      ),
    ).toBe(false);
  });

  it("DELETE ne supprime qu'une invitation refusée", async () => {
    mocks.query.mockResolvedValueOnce({ rowCount: 0 });

    const reponse = await DELETE(new Request("https://example.test/x"), {
      params: params(),
    });

    expect(reponse.status).toBe(404);
    expect(String(mocks.query.mock.calls[0][0])).toContain("'rejected'");
  });
});
