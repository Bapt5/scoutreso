import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createTransport: vi.fn(),
  query: vi.fn(),
  recupererSession: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: { createTransport: mocks.createTransport },
}));
vi.mock("@/lib/baseDeDonnees", () => ({ pool: { query: mocks.query } }));
vi.mock("@/lib/sessionServeur", () => ({
  recupererSession: mocks.recupererSession,
}));

import { creerTransporteurEmail, envoyerMail } from "@/lib/email";

describe("capture des mails en démo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    mocks.recupererSession.mockResolvedValue({
      user: { id: "u1" },
      session: { activeOrganizationId: "o1" },
    });
    mocks.query.mockImplementation(async (requete: string) =>
      requete.includes("SELECT id FROM scouticket_demo_bac_a_sable")
        ? { rows: [{ id: "bac1" }] }
        : { rows: [] },
    );
  });
  afterEach(() => vi.unstubAllEnvs());

  it("capture le mail sans jamais créer de transporteur", async () => {
    const info = await envoyerMail({
      to: ["tresorerie@demo.invalid", { name: "Cc", address: "cc@x.fr" }],
      subject: "Sujet",
      html: "<p>Bonjour</p>",
      attachments: [{ filename: "a.pdf", content: Buffer.from("abcd") }],
    });

    expect(info.messageId).toMatch(/^demo-/);
    expect(mocks.createTransport).not.toHaveBeenCalled();
    const insertion = mocks.query.mock.calls.find(([requete]) =>
      String(requete).includes("INSERT INTO scouticket_demo_mail"),
    );
    expect(insertion?.[1]).toEqual([
      expect.any(String),
      "bac1",
      ["tresorerie@demo.invalid", "cc@x.fr"],
      "Sujet",
      "<p>Bonjour</p>",
      null,
      JSON.stringify([{ nom: "a.pdf", taille: 4 }]),
    ]);
  });

  it("refuse de créer un transporteur SMTP", () => {
    expect(() => creerTransporteurEmail()).toThrow();
    expect(mocks.createTransport).not.toHaveBeenCalled();
  });

  it("abandonne sans bac à sable, sans rien envoyer ni insérer", async () => {
    mocks.query.mockResolvedValue({ rows: [] });

    const info = await envoyerMail({ to: "a@b.fr", subject: "S" });

    expect(info.messageId).toMatch(/^demo-/);
    expect(mocks.createTransport).not.toHaveBeenCalled();
    expect(
      mocks.query.mock.calls.some(([requete]) =>
        String(requete).includes("INSERT"),
      ),
    ).toBe(false);
  });
});
