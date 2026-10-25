# Stage 3 — Deep website audit, Proof Report, design match, checklist checker

**Date:** 2026-10-26 · builds on `2026-10-25-proof-of-done-design.md`

## Goal

Make website verification trustworthy for real multi-page sites: every page visited, every link tested, contact details matched exactly, contact form actually submitted, design compared with a reference, and every verdict backed by evidence the client can open. Add a checklist quality checker so vague requirements are fixed before money is held.

**Principle:** code measures, AI judges. Facts (HTTP status, broken links, exact emails, overflow on phones) come from deterministic code; Gemini only judges checklist items using those facts and must cite evidence.

## 1. Deep website audit (replaces the free-roaming agent's first phase)

**Crawl (code, inside the KERNEL browser — no server-side fetches, so no SSRF):**
- Breadth-first from the submitted URL, same origin only, max 20 pages, depth 3. URLs normalised (drop `#fragment`, keep path + query).
- Per page: HTTP status, title, h1–h3, text excerpt (≤2,000 chars), links (`internal | external | mailto | tel | whatsapp`, href + text), forms (fields with type/name/label, submit text), broken images (`naturalWidth === 0`), console errors, horizontal overflow at 390 px, desktop screenshot (JPEG q50).
- Homepage also gets a phone screenshot.

**Link check (code, second tab in the same KERNEL browser):** every unique link not already crawled (internal + external, max 40) is opened; status recorded; ≥400 or network error = broken. `mailto:`/`tel:` are not opened, only parsed.

**Contact facts (code):** emails (mailto + text regex), phone numbers (tel + text regex), WhatsApp links, social profile URLs — de-duplicated, with the page they appear on.

**AI judge (Gemini, short agent loop, max 8 steps):** first message = the audit report (site map, facts, broken links, overflow, console errors) + checklist + homepage screenshots (+ reference design, §3). Tools as today (`open_page`, `click`, `screenshot`, `resize_to_phone`) plus:
- `test_form(pageUrl, formIndex)` — fills the form with clearly marked test data (`Proof-of-Done test — please ignore`, `test@proof-of-done.dev`), submits, returns resulting URL/text + screenshot. Used only when a checklist item is about the form working.
- `submit_verdict` items now carry `evidence` (short quote/fact) and `pageUrl`.

**Rules kept:** same-origin navigation, verdict ignored unless the site loaded, page content is untrusted data, only `shouldRelease()` gates money.

**Fail-safe:** if the homepage doesn't return 2xx → every item `fail` ("site unreachable"), no AI call.

## 2. Proof Report + demo sites

- Each submission stores its audit report (`submissions.report` jsonb: pages, links, facts, screenshots).
- Verdict items store `evidence` and `pageUrl`.
- **Report page** `/jobs/[id]/report/[submissionId]` (client or freelancer only): header with job, milestone, amount, PayPal authorization/capture IDs and timestamps; per checklist item: verdict, reason, evidence, page link, screenshot of that page; site map table (page, status, issues); broken links; contact facts; print-friendly (`@media print`).
- Link "View proof report" on each milestone with a submission.

**Demo sites** in the repo under `demo-sites/` (static HTML, hosted on GitHub Pages so KERNEL can reach them):
- `bakery-v1/` — 4 pages, contact form missing, one broken link, wrong email on contact page.
- `bakery-v2/` — fixed version, working form (shows a success message client-side).

## 3. Design match vs reference

- On a draft milestone (website proof) the client may upload a reference image (mockup, Figma export or screenshot) — same browser-side resize + `parsePhoto` validation; stored on `milestones.referenceImage`.
- When a reference is saved, the checklist gets the item “Homepage matches the reference design (layout, colours, main sections)” if not already present.
- The AI judge receives the reference image next to the homepage desktop screenshot and judges that item on layout, colour palette and sections — not pixel-perfect equality.

## 4. Checklist quality checker

- After the AI drafts a job and every time the client saves a checklist: one Gemini call rates each item `ok | vague | unverifiable` for the milestone's proof type and suggests verifiable wording.
- Stored on `checklist_items.lintNote` (null = ok). Shown inline on the draft form as an amber hint with the suggestion. Non-blocking: the client can still fund.

## Data changes

- `submissions.report jsonb`
- `verdict_items.evidence text`, `verdict_items.page_url text`
- `milestones.reference_image text`
- `checklist_items.lint_note text`

## Gemini budget (free tier 15 RPM)

Per website check: ≤ 8 calls (was ≤ 10). Per checklist save: 1 call. Crawl and link checks use no AI.

## Testing

- Unit: URL normalisation + same-origin filter, link classification, contact extraction (emails/phones/WhatsApp from HTML text), report → prompt summary, lint result mapping, verdict evidence normalisation.
- Mocked: `checkWebsite` fails fast when homepage is not 2xx; verdict still ignored without a loaded site; reference image is sent when present.
- Live: run the audit on `bakery-v1` (expect: form missing, broken link, wrong email flagged) and `bakery-v2` (expect all pass).

## Out of scope

Lighthouse/performance scores, visual pixel-diff, crawling beyond 20 pages, logged-in areas of sites, GitHub PR checker.
