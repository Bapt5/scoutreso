import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ purgerGroupesEchus: vi.fn() }));

vi.mock("@/lib/sessionServeur", () => ({
  recupererSession: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/suppressionGroupe", () => ({
  purgerGroupesEchus: mocks.purgerGroupesEchus,
}));

import { GET, POST } from "@/app/api/cron/purge-groupes/route";

const requete = (autorisation?: string) =>
  new Request("https://example.test/api/cron/purge-groupes", {
    method: "POST",
    headers: autorisation ? { authorization: autorisation } : {},
  });

describe("/api/cron/purge-groupes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.purgerGroupesEchus.mockResolvedValue(2);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("n'existe pas sans CRON_SECRET", async () => {
    vi.stubEnv("CRON_SECRET", "");

    expect((await POST(requete("Bearer x"))).status).toBe(404);
    expect(mocks.purgerGroupesEchus).not.toHaveBeenCalled();
  });

  it("refuse un secret absent ou incorrect", async () => {
    vi.stubEnv("CRON_SECRET", "secret");

    expect((await POST(requete())).status).toBe(401);
    expect((await POST(requete("Bearer autre"))).status).toBe(401);
    expect(mocks.purgerGroupesEchus).not.toHaveBeenCalled();
  });

  it("purge avec le bon secret (POST et GET)", async () => {
    vi.stubEnv("CRON_SECRET", "secret");

    const reponse = await POST(requete("Bearer secret"));

    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toEqual({ purges: 2 });
    expect((await GET(requete("Bearer secret"))).status).toBe(200);
  });
});
