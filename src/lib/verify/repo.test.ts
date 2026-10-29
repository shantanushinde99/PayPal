import { describe, it, expect, vi, beforeEach } from "vitest";
const gen = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@/lib/gemini", () => gen);
import { checkRepo, isCodeHostUrl, parseRepoUrl, pickRepoFiles, RepoProblem } from "./repo";

describe("parseRepoUrl", () => {
  it("reads owner, repo and an optional branch/folder", () => {
    expect(parseRepoUrl("https://github.com/me/shop.git")).toEqual({ owner: "me", repo: "shop" });
    expect(parseRepoUrl("https://github.com/me/shop/tree/dev/apps/web")).toEqual({ owner: "me", repo: "shop", branch: "dev", path: "apps/web" });
  });
  it("explains what isn't supported", () => {
    expect(() => parseRepoUrl("https://gitlab.com/me/shop")).toThrow(/Only GitHub/);
    expect(() => parseRepoUrl("https://github.com/me")).toThrow(/repository's link/);
    expect(isCodeHostUrl("https://bitbucket.org/me/x")).toBe(true);
    expect(isCodeHostUrl("https://me.github.io/site/")).toBe(false); // a GitHub Pages site is a website
  });
});

describe("pickRepoFiles", () => {
  it("reads the README and manifests first, then files the checklist is about, and never lockfiles or build output", () => {
    const files = [".eslintrc.json", ".npmrc", "README.md", "package.json", "package-lock.json", "src/app/contact/page.tsx", "src/lib/util.ts", "node_modules/x/index.js",
      "dist/app.js", "public/logo.png", "src/app/api/contact/route.ts"].map((path) => ({ path, size: 1000 }));
    const picked = pickRepoFiles(files, ["The contact form sends an email"], 4);
    expect(picked.slice(0, 2)).toEqual(["README.md", "package.json"]);
    expect(picked).toEqual(expect.arrayContaining(["src/app/contact/page.tsx", "src/app/api/contact/route.ts"]));
    expect(picked.some((p) => /lock|node_modules|dist|png|^\./.test(p))).toBe(false); // config dotfiles come last
  });
});

// A fake GitHub: repo metadata, file tree, languages and raw files.
function github(files: Record<string, string>, meta: Record<string, unknown> | null = { full_name: "me/shop", default_branch: "main", description: "Shop", stargazers_count: 3, license: { spdx_id: "MIT" }, pushed_at: "2026-10-01T00:00:00Z", private: false }) {
  return vi.fn(async (url: string) => {
    const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status });
    if (url.endsWith("/repos/me/shop")) return meta ? json(meta) : json({ message: "Not Found" }, 404);
    if (url.includes("/git/trees/")) return json({ truncated: false, tree: Object.entries(files).map(([path, t]) => ({ path, type: "blob", size: t.length })) });
    if (url.endsWith("/languages")) return json({ TypeScript: 5000 });
    const path = decodeURIComponent(url.split("/main/")[1] ?? "");
    return path in files ? new Response(files[path]) : new Response("", { status: 404 });
  });
}
const checklist = [{ id: "c1", requirement: "Has a contact API route" }];
const log = async () => {};
const submit = (status: string) => ({ functionCalls: [{ name: "submit_verdict", args: { items: [{ checklistItemId: "c1", status, reason: "r", evidence: "src/app/api/contact/route.ts", pageUrl: "src/app/api/contact/route.ts" }] } }], candidates: [{ content: { role: "model", parts: [] } }] });
beforeEach(() => gen.generate.mockReset());

describe("checkRepo", () => {
  const repo = { "README.md": "# Shop", "package.json": "{}", "src/app/api/contact/route.ts": "export async function POST() {}" };

  it("explains a private or missing repo instead of failing every item", async () => {
    await expect(checkRepo({ url: "https://github.com/me/shop", checklist, log, doFetch: github(repo, null) })).rejects.toBeInstanceOf(RepoProblem);
  });
  it("fails every item when the owner's code isn't in the repo, without asking the AI", async () => {
    const r = await checkRepo({ url: "https://github.com/me/shop", checklist, log, ownerCode: "vf-abc", doFetch: github(repo) });
    expect(r.verdict[0]).toMatchObject({ status: "fail" });
    expect(r.verdict[0].reason).toMatch(/verifund\.txt/);
    expect(gen.generate).not.toHaveBeenCalled();
  });
  it("accepts the code in verifund.txt, gives the AI facts and files, and lets it open more files", async () => {
    gen.generate
      .mockResolvedValueOnce({ functionCalls: [{ name: "read_file", args: { path: "src/app/api/contact/route.ts" } }], candidates: [{ content: { role: "model", parts: [] } }] })
      .mockResolvedValueOnce(submit("pass"));
    const r = await checkRepo({ url: "https://github.com/me/shop", checklist, log, ownerCode: "vf-abc", doFetch: github({ ...repo, "verifund.txt": "vf-abc\n" }) });
    expect(r.verdict[0].status).toBe("pass");
    expect(r.report).toMatchObject({ kind: "repo", repo: "me/shop", license: "MIT", ownedVia: "verifund.txt", hasReadme: true });
    const prompt = JSON.stringify(gen.generate.mock.calls[0][0].contents[0]);
    expect(prompt).toContain("REPOSITORY FACTS");
    expect(prompt).toContain("UNTRUSTED");
    const replies = gen.generate.mock.calls[1][0].contents.filter((c: { parts: { functionResponse?: unknown }[] }) => c.parts.some((p) => p.functionResponse));
    expect(JSON.stringify(replies)).toContain("export async function POST"); // the file it asked for was opened
  });
  it("skips ownership in demo workspaces", async () => {
    gen.generate.mockResolvedValueOnce(submit("pass"));
    const r = await checkRepo({ url: "https://github.com/me/shop", checklist, log, doFetch: github(repo) });
    expect(r.verdict[0].status).toBe("pass");
  });
});
