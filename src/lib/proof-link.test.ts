import { describe, it, expect } from "vitest";
import { checkProofLink } from "./proof-link";

describe("checkProofLink", () => {
  it("accepts live websites and public GitHub repos", () => {
    expect(checkProofLink("https://my-shop.vercel.app/")).toEqual({ kind: "website" });
    expect(checkProofLink("https://me.github.io/portfolio/")).toEqual({ kind: "website" }); // GitHub Pages is a website
    expect(checkProofLink("https://github.com/me/shop")).toEqual({ kind: "repo" });
    expect(checkProofLink(" https://github.com/me/shop/tree/main/web ")).toEqual({ kind: "repo" });
  });
  it("explains links that can't be checked", () => {
    expect(checkProofLink("my-shop.com").problem).toMatch(/full link/);
    expect(checkProofLink("ftp://x.com").problem).toMatch(/https/);
    expect(checkProofLink("http://localhost:3000").problem).toMatch(/Deploy/);
    expect(checkProofLink("https://gitlab.com/me/shop").problem).toMatch(/Only GitHub/);
    expect(checkProofLink("https://github.com/me").problem).toMatch(/not a profile/);
  });
});
