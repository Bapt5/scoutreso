import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn(), connect: vi.fn() }));

vi.mock("@/lib/baseDeDonnees", () => ({
  pool: { query: mocks.query, connect: mocks.connect },
}));

import {
  appliquerInvitationAcceptee,
  supprimerInvitationAnnulee,
  supprimerUnitesInvitation,
} from "@/lib/invitationUnites";

describe("invitationUnites", () => {
  let client: { query: ReturnType<typeof vi.fn>; release: () => void };

  beforeEach(() => {
    vi.clearAllMocks();
    client = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: vi.fn(),
    };
    mocks.connect.mockResolvedValue(client);
  });

  const appels = () => client.query.mock.calls.map(([sql]) => String(sql));

  it("copie les unités d'un membre simple puis les supprime de l'invitation", async () => {
    await appliquerInvitationAcceptee({
      id: "inv_1",
      organizationId: "org_1",
      role: "member",
      userId: "user_1",
    });

    expect(appels()).toEqual([
      "BEGIN",
      expect.stringContaining("INSERT INTO scouticket_acces_unite_membre"),
      expect.stringContaining("DELETE FROM scouticket_invitation_unite"),
      "COMMIT",
    ]);
    expect(client.release).toHaveBeenCalled();
  });

  it("ne copie aucune unité pour un trésorier mais synchronise ses effets", async () => {
    client.query.mockResolvedValue({ rows: [{ prochain: 1 }] });

    await appliquerInvitationAcceptee({
      id: "inv_1",
      organizationId: "org_1",
      role: "owner",
      userId: "user_1",
    });

    const sql = appels();
    expect(sql.some((s) => s.includes("scouticket_acces_unite_membre"))).toBe(
      false,
    );
    expect(
      sql.some((s) => s.includes("scouticket_notification_tresorerie")),
    ).toBe(true);
    expect(sql.some((s) => s.includes("scouticket_signataires"))).toBe(true);
    expect(sql[sql.length - 1]).toBe("COMMIT");
  });

  it("n'échoue pas et annule en cas d'erreur", async () => {
    client.query.mockImplementation(async (sql: string) => {
      if (sql.includes("INSERT INTO scouticket_acces_unite_membre"))
        throw new Error("boom");
      return { rows: [] };
    });

    await expect(
      appliquerInvitationAcceptee({
        id: "inv_1",
        organizationId: "org_1",
        role: "member",
        userId: "user_1",
      }),
    ).resolves.toBeUndefined();
    expect(appels()).toContain("ROLLBACK");
    expect(client.release).toHaveBeenCalled();
  });

  it("le refus supprime les unités sans toucher à l'invitation", async () => {
    await supprimerUnitesInvitation("inv_1");

    expect(String(mocks.query.mock.calls[0][0])).toContain(
      "DELETE FROM scouticket_invitation_unite",
    );
  });

  it("l'annulation supprime l'invitation", async () => {
    await supprimerInvitationAnnulee("inv_1");

    expect(String(mocks.query.mock.calls[0][0])).toContain(
      "DELETE FROM invitation",
    );
  });
});
