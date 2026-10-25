# Proof-of-Done — Design Spec

**Date:** 2026-10-25 · **Hackathon:** PayPal AI Hackathon (Devpost) · **Deadline:** 2026-11-12 12:00 PT

## 1. Goal

An AI escrow for freelance work. A client funds a milestone (PayPal hold). The freelancer submits proof. An AI agent verifies the proof against a checklist both sides agreed on. If it passes, money is released automatically; if not, the AI explains what's missing and the money stays on hold.

**Prize targets:** Grand / Best Use of Agentic Commerce / Most Impactful + Best Use of Bryntum (sponsor). Hosted on Render (Render prize eligible).

**Success criteria**
- Hosted demo URL on Render that judges can log into with sandbox accounts.
- End-to-end flow works on PayPal sandbox with real transaction IDs.
- 3-minute video: AI refuses to pay → freelancer fixes → AI pays automatically.
- Public GitHub repo, MIT license, README with setup + test accounts.

**Out of scope:** mobile app.

## 2. Users & roles

- **Client** — posts jobs, funds milestones.
- **Freelancer** — accepts jobs, submits proof, gets paid.
- **Admin** — resolves escalated disputes (flag on user record).
- One account can be client on some jobs and freelancer on others.

## 3. Screens

1. **Login** — "Log in with PayPal" (sandbox Identity). Gives verified PayPal email → used as payout receiver.
2. **Dashboard** — "Jobs I posted" / "Jobs I'm working on", money totals in home currency.
3. **Create Job** — plain-language description, currency, review window. AI proposes milestones + prices + checklist per milestone; client edits; invites freelancer by email/link.
4. **Job page** — Bryntum Gantt of milestones (payments as dependencies, status colours), checklist, history.
5. **Submit Proof** — per milestone proof type: 🌐 website URL, 📷 before/after photos, 🧑‍💻 GitHub PR URL.
6. **AI Verdict (live)** — streamed agent steps, screenshots, per-item pass/fail/unsure with reasons.
7. **Dispute** — each side states their case + extra evidence; AI Judge decision; escalate to admin.
8. **Admin** — escalated disputes, final decision.
9. **Settings** — home currency.

## 4. Milestone lifecycle

```
draft ─fund─► funded (authorized) ─submit─► verifying ─► failed ─resubmit─► verifying
                │                                  └──► passed ─capture─► review_window ─timer─► paid_out
                └─cancel─► cancelled (voided)          (failed) ─freelancer disputes─► disputed
                                          (review_window) ─client disputes─► disputed
disputed ─AI Judge─► resolved (full / none / split) ─ or ─► escalated ─admin─► resolved
```

- **Next milestone can't be submitted until the previous one is paid_out** (Gantt dependency).
- Every transition writes a row to an `events` audit log (used as dispute evidence and on the job history).

## 5. AI verification

**Models (Gemini free tier):** Gemini 3.1 Flash-Lite (primary) and Gemini 3.5 Flash-Lite (fallback on 429/error). Both 15 RPM / 500 RPD. Exact model IDs live in env (`GEMINI_MODEL_PRIMARY`, `GEMINI_MODEL_FALLBACK`), confirmed via the ListModels API once the key is added.

**Rate limiting:** one in-process limiter shared by all Gemini calls (≤ 14 req/min, daily counter ≤ 480/model). Single Render instance, so in-process is enough. When both models are exhausted, the verification is queued and the UI says "AI busy, retrying in N s". Budget per website check: ≤ 10 calls.

**Checklist generation (job creation):** description → structured JSON checklist (id, requirement, proof type). Client edits before funding. Verification is always against this frozen list.

**Website check (agent):** KERNEL cloud browser driven via Playwright over CDP. Gemini function-calling tools: `open_page(url)`, `click(text)`, `screenshot()`, `resize_to_phone()`, `submit_verdict(items[])`. Max 10 steps. Each step streams to the UI (SSE).

**Photo check:** before + after photos + checklist → per-item verdict; flags location mismatch / stock-photo look.

**GitHub PR check:** GitHub API → merged? CI checks green? Diff (truncated to fit) + checklist → Gemini per-item verdict.

**Output (all checkers):** `{ itemId, status: pass|fail|unsure, reason, evidence }[]`.

**Safety rules**
- The AI never chooses amounts or recipients. Plain code decides: **all items `pass` → release**; any `fail`/`unsure` → hold + feedback.
- Page/PR/photo content is passed as data with an explicit instruction that it is untrusted and never instructions (prompt-injection guard).
- Unit-tested `shouldRelease(verdict)` is the only gate before capture.

## 6. PayPal integration

| Step | API |
|---|---|
| Login | Log in with PayPal (OAuth2 / Identity, `openid email profile`) |
| Fund | Orders v2 `intent: AUTHORIZE` + JS SDK button for buyer approval |
| AI pass | Authorizations **capture** (to platform account) |
| Review window ends | **Payouts** to freelancer's PayPal email (amount minus platform fee, default 5%) |
| Split decision | Capture → **Refund** (partial) to client + **Payout** of remainder |
| Cancel before pass | Authorizations **void** |
| Hold > 3 days | **Reauthorize** before capture (honor period) |
| Confirmations | **Webhooks** (verified signature): `PAYMENT.AUTHORIZATION.*`, `PAYMENT.CAPTURE.*`, `PAYMENT.PAYOUTSBATCH.*`, `CUSTOMER.DISPUTE.*` |
| PayPal dispute opened | **Disputes API** `provide-evidence`: checklist, verdict, screenshots, event log |

Plain `fetch` against the REST API (no SDK). OAuth token cached until expiry. Every money call uses a `PayPal-Request-Id` idempotency key derived from milestone id + action, so retries never double-pay.

**UI shows "Paid" only after the webhook confirms.**

**Sandbox accounts:** client (personal), platform (business — owns the app), freelancer (personal).

## 7. Disputes

**In-app**
- Client can dispute during the review window (default 24 h, client may set 0; demo 2 min).
- Freelancer can dispute a FAIL.
- Both sides submit statement + optional extra evidence → **AI Judge** (separate prompt, sees checklist, all submissions, verdicts, statements) → `full | none | split(percent)` with reasoning.
- Either side can escalate once → admin decides. Admin decision is final.

**PayPal-level:** webhook `CUSTOMER.DISPUTE.CREATED` → auto-submit evidence pack via Disputes API, show status on job page.

## 8. Multi-currency

- Client picks job currency from PayPal-supported list (USD, EUR, GBP, CAD, AUD, JPY, …; INR excluded — not supported cross-border).
- Authorize, capture, refund, payout all in the job currency. No in-app conversion.
- Users set a home currency; UI shows estimates via Frankfurter (ECB rates, no key), cached 1 h.
- JPY and other zero-decimal currencies handled in one amount-formatting helper.

## 9. Tech stack

- **Next.js (App Router) + TypeScript**, one app.
- **Auth.js** with a custom PayPal OAuth provider.
- **Postgres** — Docker locally, Render Postgres (paid with credits) in prod. **Drizzle ORM**.
- Photos stored in Postgres (resized ≤ 1600 px) — demo scale.
- **Gemini** via `@google/genai`. **KERNEL** via `@onkernel/sdk` + `playwright-core`.
- **Bryntum Gantt** (trial).
- **Render** web service + Postgres; review-window payouts run by a Render cron job hitting an internal endpoint every minute.
- Live AI steps via Server-Sent Events.

**Tables:** `users`, `accounts`/`sessions` (Auth.js), `jobs`, `milestones`, `checklist_items`, `submissions`, `verdicts`, `verdict_items`, `payments` (PayPal ids per action), `disputes`, `events`.

## 10. Testing

- Unit: `shouldRelease`, dispute split math, currency amount formatting, milestone state transitions.
- Script: one full sandbox money run (authorize → capture → payout, and authorize → void).
- Manual: full demo story on the deployed Render URL before recording.

## 11. Build order

1. Core: login → job → AI checklist → fund (authorize) → website check → capture → payout
2. Photo + GitHub checkers
3. Bryntum Gantt
4. Review window, in-app disputes, AI Judge, split payments
5. PayPal dispute auto-evidence
6. Multi-currency
7. Polish, deploy, README, video

## 12. Risks

- **Bryntum trial is 45 days** — may expire before judging ends (Dec 15). Ask Bryntum on the PayPal Discord for a hackathon license.
- **Gemini free tier limits** — limiter + fallback model; demo record during low usage.
- **Sandbox disputes / payouts can be slow or flaky** — record demo with confirmed runs; show webhook status honestly.
- **Scope vs 18 days** — build order keeps a submittable product after step 1.

## 13. Secrets (`.env`, never committed; `.env.example` in repo)

`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `GEMINI_API_KEY`, `GEMINI_MODEL_PRIMARY`, `GEMINI_MODEL_FALLBACK`, `KERNEL_API_KEY`, `GITHUB_TOKEN`, `DATABASE_URL`, `AUTH_SECRET`, `APP_URL`, `CRON_SECRET`.
