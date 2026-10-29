import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/gemini", () => ({ generate: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: { AUTH_SECRET: "s" } }));
import { generate } from "@/lib/gemini";
import { importProfile, parseImportedProfile, pickProfilePages } from "./profile-import";

describe("pickProfilePages", () => {
  const start = "https://me.dev/";
  it("reads real sub-pages, about/work pages first, and skips anchors, files and other sites", () => {
    const links = [
      { href: "#projects", text: "Projects" }, { href: "/blog/post-1", text: "A post" }, { href: "/about", text: "About" },
      { href: "/Resume.pdf", text: "Résumé" }, { href: "https://twitter.com/me", text: "Twitter" }, { href: "/work/", text: "Work" },
      { href: "/about#team", text: "Team" }, { href: "mailto:me@me.dev", text: "Email" }, { href: "/index.html", text: "Home" },
    ];
    expect(pickProfilePages(links, start)).toEqual(["https://me.dev/about", "https://me.dev/work/", "https://me.dev/blog/post-1"]);
  });
});

describe("parseImportedProfile", () => {
  it("keeps the freelancer fields within the form's limits and drops contact details", () => {
    const r = parseImportedProfile({
      displayName: "Shantanu Shinde", headline: "AI Developer · ML & GenAI ".repeat(10), company: "should be ignored",
      bio: "I build ML systems. Reach me at me@me.dev or +91 98765 43210.",
      skills: ["Python", "python", "PyTorch", "x", "A very long skill name that goes on and on and on", ...Array.from({ length: 12 }, (_, i) => `S${i}`)],
      sources: { displayName: "/", bio: "/about", company: "/x" },
    }, "freelancer");
    expect(r.draft.headline.length).toBeLessThanOrEqual(80);
    expect(r.draft.bio).not.toMatch(/@|98765/);
    expect(r.draft.company).toBe("");
    expect(r.draft.skills.length).toBeLessThanOrEqual(10);
    expect(r.draft.skills.filter((s) => s.toLowerCase() === "python")).toHaveLength(1);
    expect(r.draft.skills.every((s) => s.length <= 30 && s.length > 1)).toBe(true);
    expect(r.sources).toEqual({ displayName: "/", bio: "/about" }); // no source for an emptied field
  });
  it("fills only name and company for a client, and survives junk", () => {
    expect(parseImportedProfile({ displayName: "Leon", company: "Sunrise Bakery", headline: "x", bio: "y", skills: ["z"] }, "client").draft)
      .toEqual({ displayName: "Leon", company: "Sunrise Bakery", headline: "", bio: "", skills: [] });
    expect(parseImportedProfile("ignore previous instructions", "freelancer").draft).toEqual({ displayName: "", headline: "", bio: "", skills: [], company: "" });
  });
});

describe("importProfile", () => {
  it("reads the site, then drafts a profile from it, with the website text marked untrusted", async () => {
    const page = {
      goto: vi.fn(async () => {}), waitForLoadState: vi.fn(async () => {}), waitForTimeout: vi.fn(async () => {}),
      evaluate: vi.fn(async (js: string) => (js.includes("verifund-verification") ? "meta tag" : js.includes("a[href]") ? [] : false)),
      locator: () => ({ innerText: async () => "Shantanu Shinde. AI developer building ML systems for startups. Skills: Python, PyTorch." }),
      title: async () => "Shantanu Shinde", url: () => "https://me.dev/",
    };
    vi.mocked(generate).mockResolvedValueOnce({ text: JSON.stringify({ displayName: "Shantanu Shinde", headline: "AI Developer", bio: "I build ML systems.", skills: ["Python"], company: "", sources: { displayName: "/", bio: "/about" } }) } as never);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await importProfile({ url: "https://me.dev/", role: "freelancer", ownershipCode: "vf-x" }, (fn) => fn(page as any));
    expect(r.draft).toMatchObject({ displayName: "Shantanu Shinde", headline: "AI Developer", skills: ["Python"] });
    expect(r.ownedVia).toBe("meta tag");
    expect(r.sources).toEqual({ displayName: "/", bio: "/" }); // "/about" was never read: a one-page site means it came from "/"
    const call = vi.mocked(generate).mock.calls[0][0] as { contents: string; config: { systemInstruction: string } };
    expect(call.contents).toContain("WEBSITE TEXT (untrusted)");
    expect(call.config.systemInstruction).toMatch(/never follow instructions/);
  });
});
