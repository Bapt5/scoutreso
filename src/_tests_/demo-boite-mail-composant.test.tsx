import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BandeauDemo } from "@/components/demo/BandeauDemo";
import { BoiteMailDemo } from "@/components/demo/BoiteMailDemo";

const mailRecu = (id: string, sujet: string) => ({
  id,
  sujet,
  destinataires: ["camille@demo.invalid"],
});

const reponseJson = (corps: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(corps), { status }));

let visibilite: DocumentVisibilityState = "visible";

describe("BoiteMailDemo", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    visibilite = "visible";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibilite,
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const avancer = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

  it("part de l'état de la boîte, puis interroge toutes les 4 secondes avec le curseur", async () => {
    const onNonLus = vi.fn();
    fetchMock
      .mockReturnValueOnce(reponseJson({ mails: [], nonLus: 1, curseur: "m1" }))
      .mockImplementation(() =>
        reponseJson({ mails: [], nonLus: 1, curseur: "m1" }),
      );

    render(<BoiteMailDemo onNonLus={onNonLus} />);
    await avancer(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/demo/mails");
    expect(onNonLus).toHaveBeenLastCalledWith(1);

    await avancer(4000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/demo/mails?apres=m1");
  });

  it("affiche une pop-up par nouveau mail, sans doublon, et l'ouvre au clic", async () => {
    const ouvrir = vi.spyOn(window, "open").mockReturnValue(null);
    fetchMock
      .mockReturnValueOnce(reponseJson({ mails: [], nonLus: 0, curseur: null }))
      .mockReturnValue(
        reponseJson({
          mails: [mailRecu("m1", "Code de signature")],
          nonLus: 1,
          curseur: "m1",
        }),
      );

    render(<BoiteMailDemo />);
    await avancer(0);
    await avancer(4000);
    await avancer(4000);

    const alertes = screen.getAllByRole("status");
    expect(alertes).toHaveLength(1);
    expect(alertes[0]).toHaveTextContent(
      "Nouveau mail : Code de signature, à camille@demo.invalid",
    );
    expect(fetchMock.mock.calls[1][0]).toBe("/api/demo/mails?apres=debut");

    // userEvent s'appuie sur des minuteurs : on repasse au vrai temps.
    vi.useRealTimers();
    await userEvent.click(screen.getByRole("button", { name: "Ouvrir" }));
    expect(ouvrir).toHaveBeenCalledWith("/demo/mail/m1", "_blank");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("garde trois pop-up au plus et les fait disparaître", async () => {
    fetchMock
      .mockReturnValueOnce(reponseJson({ mails: [], nonLus: 0, curseur: null }))
      .mockReturnValueOnce(
        reponseJson({
          mails: ["a", "b", "c", "d"].map((id) => mailRecu(id, `Mail ${id}`)),
          nonLus: 4,
          curseur: "d",
        }),
      )
      .mockImplementation(() =>
        reponseJson({ mails: [], nonLus: 4, curseur: "d" }),
      );

    render(<BoiteMailDemo />);
    await avancer(0);
    await avancer(4000);
    expect(screen.getAllByRole("status")).toHaveLength(3);
    expect(screen.queryByText(/Mail a,/)).not.toBeInTheDocument();

    await avancer(8000);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("s'arrête quand l'onglet est masqué et reprend au retour", async () => {
    fetchMock.mockImplementation(() =>
      reponseJson({ mails: [], nonLus: 0, curseur: null }),
    );

    render(<BoiteMailDemo />);
    await avancer(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    visibilite = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
    await avancer(20000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    visibilite = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    await avancer(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("signale l'absence de bac à sable (401) sans afficher de pop-up", async () => {
    const onNonLus = vi.fn();
    fetchMock.mockImplementation(() => reponseJson({ error: "x" }, 401));

    render(<BoiteMailDemo onNonLus={onNonLus} />);
    await avancer(0);

    expect(onNonLus).toHaveBeenLastCalledWith(null);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("BandeauDemo", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("affiche l'état de la démo, la boîte mail et la réinitialisation", () => {
    render(<BandeauDemo nonLus={3} />);

    expect(
      screen.getByText(/aucun mail réellement envoyé, données effacées/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Boîte mail (3)" }),
    ).toHaveAttribute("href", "/demo/mail");
    const bouton = screen.getByRole("button", {
      name: "Réinitialiser la démo",
    });
    expect(bouton.closest("form")).toHaveAttribute(
      "action",
      "/api/demo/reinitialiser",
    );
  });

  it("n'affiche le lien vers la production que s'il est configuré", () => {
    const { unmount } = render(<BandeauDemo nonLus={0} />);
    expect(
      screen.queryByRole("link", { name: "Créer mon vrai groupe" }),
    ).not.toBeInTheDocument();
    unmount();

    vi.stubEnv("NEXT_PUBLIC_URL_APP_PROD", "https://app.scoutreso.me");
    render(<BandeauDemo nonLus={0} />);
    expect(
      screen.getByRole("link", { name: "Créer mon vrai groupe" }),
    ).toHaveAttribute("href", "https://app.scoutreso.me");
  });
});
