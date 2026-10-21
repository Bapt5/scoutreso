import { describe, expect, it } from "vitest";
import { decider } from "@/lib/demo/garde";

describe("garde du mode démo", () => {
  it("bloque les routes d'invitation, de suppression et de sortie", () => {
    for (const chemin of [
      "/api/group/invitations/abc",
      "/api/group/resend-invitation",
      "/api/group/suppression",
      "/api/group/reactivation",
      "/api/group/leave",
      "/api/invitation",
      "/api/invitation/inscription",
    ])
      expect(decider(chemin, "POST", true)).toEqual({ action: "bloquer" });
  });

  it("n'autorise que la liste blanche Better Auth", () => {
    for (const chemin of [
      "/api/auth/get-session",
      "/api/auth/sign-out",
      "/api/auth/update-user",
      "/api/auth/organization/set-active",
      "/api/auth/organization/get-full-organization",
    ])
      expect(decider(chemin, "POST", false)).toEqual({ action: "continuer" });
    for (const chemin of [
      "/api/auth/sign-up/email",
      "/api/auth/sign-in/email",
      "/api/auth/sign-in/social",
      "/api/auth/request-password-reset",
      "/api/auth/reset-password",
      "/api/auth/change-password",
      "/api/auth/change-email",
      "/api/auth/delete-user",
      "/api/auth/send-verification-email",
      "/api/auth/organization/create",
      "/api/auth/organization/invite-member",
      "/api/auth/organization/accept-invitation",
      "/api/auth/organization/remove-member",
      "/api/auth/organization/update-member-role",
      "/api/auth/organization/delete",
      "/api/auth/organization/leave",
    ])
      expect(decider(chemin, "POST", true)).toEqual({ action: "bloquer" });
  });

  it("redirige les pages sans objet vers /demo", () => {
    for (const chemin of [
      "/sign-in",
      "/forgot-password",
      "/reset-password",
      "/invitation",
    ])
      expect(decider(chemin, "GET", false)).toEqual({
        action: "rediriger",
        vers: "/demo",
      });
  });

  it("renvoie le visiteur non connecté vers /demo au lieu de /sign-in", () => {
    expect(decider("/historique", "GET", false)).toEqual({
      action: "rediriger",
      vers: "/demo",
    });
  });

  it("laisse /demo et le démarrage publics, et exige une session ailleurs", () => {
    expect(decider("/demo", "GET", false)).toEqual({ action: "continuer" });
    expect(decider("/demo/mail", "GET", false)).toEqual({
      action: "continuer",
    });
    expect(decider("/api/demo/demarrer", "POST", false)).toEqual({
      action: "continuer",
    });
    expect(decider("/api/demo/mails", "GET", false)).toEqual({
      action: "non_autorise",
    });
    expect(decider("/api/demo/mails", "GET", true)).toEqual({
      action: "continuer",
    });
  });
});
