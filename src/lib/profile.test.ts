import { describe, it, expect } from "vitest";
import { parseProfile } from "./profile";

const fd = (o: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) for (const x of [v].flat()) f.append(k, x);
  return f;
};

describe("parseProfile", () => {
  it("accepts a client", () => {
    expect(parseProfile(fd({ roles: "client", displayName: "Alex Rivera", company: "Sunrise Bakery" })))
      .toMatchObject({ roles: ["client"], displayName: "Alex Rivera", company: "Sunrise Bakery", headline: null, skills: [] });
  });
  it("accepts a freelancer and normalises skills", () => {
    const p = parseProfile(fd({ roles: "freelancer", displayName: "Priya", headline: "Web developer", skills: " React, next.js ,react,, Tailwind ", bio: "Hi", portfolioUrl: "https://priya.dev" }));
    expect(p.skills).toEqual(["React", "next.js", "Tailwind"]);
    expect(p.portfolioUrl).toBe("https://priya.dev/");
  });
  it("refuses two roles on one account (the other role needs its own account)", () => {
    expect(() => parseProfile(fd({ roles: ["client", "freelancer"], displayName: "Sam", headline: "Designer" }))).toThrow(/one role/);
  });
  it("rejects bad input with a friendly message", () => {
    expect(() => parseProfile(fd({ displayName: "Sam" }))).toThrow(/hiring or a freelancer/);
    expect(() => parseProfile(fd({ roles: "admin", displayName: "Sam" }))).toThrow(/hiring or a freelancer/);
    expect(() => parseProfile(fd({ roles: "client", displayName: "S" }))).toThrow(/name/);
    expect(() => parseProfile(fd({ roles: "freelancer", displayName: "Sam", headline: "Dev", portfolioUrl: "javascript:alert(1)" }))).toThrow(/link/);
    expect(() => parseProfile(fd({ roles: "freelancer", displayName: "Sam", headline: "Dev", skills: Array.from({ length: 11 }, (_, i) => `s${i}`).join(",") }))).toThrow(/10 skills/);
    expect(() => parseProfile(fd({ roles: "freelancer", displayName: "Sam" }))).toThrow(/headline/);
  });
});

describe("parseProfile role choice", () => {
  it("reads the selected role card directly", () => {
    expect(parseProfile(fd({ roleChoice: "freelancer", displayName: "Sam", headline: "Dev" })).roles).toEqual(["freelancer"]);
    expect(() => parseProfile(fd({ roleChoice: "both", displayName: "Sam", headline: "Dev" }))).toThrow(/hiring or a freelancer/);
    expect(() => parseProfile(fd({ roleChoice: "admin", displayName: "Sam" }))).toThrow(/hiring or a freelancer/);
  });
});
