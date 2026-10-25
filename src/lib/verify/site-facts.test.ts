import { describe, it, expect } from "vitest";
import { classifyLink, extractContacts, isPageUrl, normalizeUrl, sameSite, summarizeReport, type SiteReport } from "./site-facts";

const base = "https://bakery.test/about";

describe("normalizeUrl", () => {
  it("resolves relative links and drops fragments", () => {
    expect(normalizeUrl("contact.html#form", base)).toBe("https://bakery.test/contact.html");
    expect(normalizeUrl("/menu?x=1", base)).toBe("https://bakery.test/menu?x=1");
  });
  it("rejects non-http links", () => {
    expect(normalizeUrl("javascript:alert(1)", base)).toBeNull();
    expect(normalizeUrl("mailto:a@b.com", base)).toBeNull();
  });
});

describe("classifyLink", () => {
  it("sorts links by kind", () => {
    expect(classifyLink("/menu", base)).toBe("internal");
    expect(classifyLink("https://other.test/", base)).toBe("external");
    expect(classifyLink("MAILTO:hi@bakery.test", base)).toBe("mailto");
    expect(classifyLink("tel:+1 555", base)).toBe("tel");
    expect(classifyLink("https://wa.me/15550100", base)).toBe("whatsapp");
    expect(classifyLink("javascript:void(0)", base)).toBe("other");
  });
});

describe("isPageUrl", () => {
  it("skips files that are not pages", () => {
    expect(isPageUrl("https://b.test/menu.pdf")).toBe(false);
    expect(isPageUrl("https://b.test/img/cake.JPG")).toBe(false);
    expect(isPageUrl("https://b.test/about")).toBe(true);
    expect(isPageUrl("https://b.test/about.html")).toBe(true);
  });
});

describe("extractContacts", () => {
  it("normalises emails from mailto links and text, once each", () => {
    const c = extractContacts([
      { url: "https://b.test/contact", text: "Write to hello@bakery.com today", links: [{ href: "mailto:Hello@Bakery.com?subject=Hi", text: "Email us" }] },
      { url: "https://b.test/", text: "", links: [{ href: "mailto:hello%40bakery.com", text: "" }] },
    ]);
    expect(c.emails).toEqual([{ value: "hello@bakery.com", page: "https://b.test/contact" }]);
  });
  it("finds phones, WhatsApp and real social profiles only", () => {
    const c = extractContacts([{ url: "https://b.test/", text: "Call +1 (555) 010-0200. Opened 2026-10-26.", links: [
      { href: "tel:+1-555-010-0200", text: "" },
      { href: "https://wa.me/15550100200", text: "" },
      { href: "https://www.instagram.com/sunrisebakery", text: "" },
      { href: "https://netflix.com/title/1", text: "" },
    ] }]);
    expect(c.phones.map((p) => p.value)).toEqual(["+15550100200"]);
    expect(c.whatsapp).toHaveLength(1);
    expect(c.social.map((s) => s.value)).toEqual(["https://www.instagram.com/sunrisebakery"]);
  });
});

describe("summarizeReport", () => {
  it("lists pages, broken links and contacts, and marks page text untrusted", () => {
    const r: SiteReport = {
      start: "https://b.test/", truncated: false,
      pages: [{ url: "https://b.test/", status: 200, offsite: false, title: "Home", headings: ["h1: Sunrise"], text: "Fresh bread", links: [],
        forms: [{ fields: ["email[email]"], submit: "Send" }], brokenImages: 1, consoleErrors: [], phoneOverflow: true }],
      links: [{ url: "https://b.test/team", status: 404, ok: false, foundOn: "https://b.test/", text: "Our team" }],
      contacts: { emails: [{ value: "hello@b.test", page: "https://b.test/" }], phones: [], whatsapp: [], social: [] },
    };
    const s = summarizeReport(r);
    expect(s).toContain("[200] /");
    expect(s).toContain("1 form");
    expect(s).toContain("does NOT fit a phone");
    expect(s).toContain("https://b.test/team (404)");
    expect(s).toContain("hello@b.test");
    expect(s).toMatch(/UNTRUSTED/);
  });
});

describe("sameSite", () => {
  it("treats http/https and www/no-www of one domain as the same site", () => {
    expect(sameSite("http://www.bakery.test/x", "https://bakery.test/")).toBe(true);
    expect(classifyLink("http://bakery.test/author/", "https://bakery.test/")).toBe("internal");
  });
  it("keeps other domains and subdomain tricks out", () => {
    expect(sameSite("https://bakery.test.evil.com/", "https://bakery.test/")).toBe(false);
    expect(sameSite("https://shop.bakery.test/", "https://bakery.test/")).toBe(false);
  });
});
