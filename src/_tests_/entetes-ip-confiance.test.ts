import { describe, expect, it } from "vitest";
import { entetesIpDeConfiance } from "@/lib/api/entetesIpConfiance";

describe("entetesIpDeConfiance", () => {
  it("utilise x-real-ip sur Vercel", () => {
    expect(entetesIpDeConfiance({ VERCEL: "1" })).toEqual(["x-real-ip"]);
  });

  it("utilise cf-connecting-ip hors Vercel", () => {
    expect(entetesIpDeConfiance({})).toEqual(["cf-connecting-ip"]);
  });

  it("traite une variable VERCEL vide comme absente", () => {
    expect(entetesIpDeConfiance({ VERCEL: "" })).toEqual(["cf-connecting-ip"]);
  });
});
