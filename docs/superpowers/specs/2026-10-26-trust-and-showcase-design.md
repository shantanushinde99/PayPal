# Trust & Showcase Features — Design

**Date:** 2026-10-26 · **Deadline:** Nov 12, 2026 · **Status:** awaiting approval

## Goal
Answer the judges' question "what if the AI is wrong?" with real controls, use PayPal more deeply
(webhooks, disputes, Venmo/Pay Later), and add two showcase pieces: watchable AI checks (KERNEL)
and an analytics command center (AG Studio, targeting the AG Grid sponsor prize).

Chosen by the user: review window + AI Judge disputes; KERNEL live view/replay; AG Studio
analytics; PayPal webhooks, Disputes API evidence, Venmo/Pay Later, site ownership check.

## Facts that shape the design (from docs/SDKs, 2026-10-26)
- PayPal authorization: valid 29 days; capture inside a **3-day honor period**, otherwise reauthorize.
- Partial capture of an authorization with `final_capture: true` releases the remainder to the buyer.
- Venmo: **JS SDK buttons only**, US merchant + US buyer, USD. Pay Later: JS SDK, US/USD, Pay in 4 $10–$2,000.
  Whether either works with `intent=AUTHORIZE` in sandbox is not documented → spike.
- Webhooks: verify with `POST /v1/notifications/verify-webhook-signature`; events include
  `CHECKOUT.ORDER.APPROVED`, `PAYMENT.AUTHORIZATION.CREATED|VOIDED`, `PAYMENT.CAPTURE.COMPLETED|REFUNDED|REVERSED`,
  `CUSTOMER.DISPUTE.CREATED|UPDATED|RESOLVED`. Simulator events can't be signature-verified.
- Disputes API v1: list, show, `provide-evidence` (multipart: JSON `input` + files), `send-message`,
  sandbox-only `require-evidence` / `adjudicate`. In **direct mode the freelancer is the payee/merchant**,
  so a buyer dispute lands on the freelancer's account; the platform app may not see it → spike.
- KERNEL: `browser_live_view_url` (non-headless only), `browsers.replays.start/stop/list/download`
  (`replay_view_url`). Whether live view can be view-only and whether replay URLs open without a
  KERNEL login → spike.
- AG Studio: `ag-studio-react` (React 19 ok), `<AgStudio data={{ sources: [{ id, data }] }} mode="edit" />`,
  client component; 45-day trial licence (ends before judging closes → ask AG Grid for a hackathon key);
  Studio Agent Framework details → spike.

## Phase 0 — Spikes (1 day, decide before building)
Each spike is a throwaway sandbox check with a written yes/no and the fallback it triggers.
1. KERNEL live view: can it be embedded and made non-interactive? Replay URL viewable without login?
2. Webhooks for direct-mode captures: does the platform app receive `PAYMENT.CAPTURE.COMPLETED` for a
   capture whose payee is the freelancer?
3. Disputes in direct mode: a sandbox buyer opens a dispute on a direct-mode payment — does it appear in
   `GET /v1/customer/disputes` with platform credentials?
4. Venmo / Pay Later with `intent=AUTHORIZE` via JS SDK buttons in sandbox.
5. AG Studio: render with our data in Next 16; how the Studio Agent Framework plugs a custom model (Gemini).

## 1. Review window + AI Judge disputes (core trust feature)
- AI pass no longer pays instantly. Milestone goes to `passed` with `releaseAt = now + window`
  (default 24h, `REVIEW_WINDOW_MINUTES` env; demo jobs 2 min). Window ≤ 48h so capture stays inside the
  3-day honor period; if a capture is late, reauthorize first.
- Client during the window: **Approve & pay now** or **Dispute** (with a reason). Freelancer after a
  `failed` verdict: **Dispute the AI** ("the AI is wrong").
- Auto-release: an in-process sweeper (startup + every minute) captures milestones whose window ended.
  ponytail: single-instance sweeper; move to Render Workflows/cron if we scale out.
- Dispute flow: state `disputed`; both sides add a statement and optional extra proof (text, link, photo).
  The **AI Judge** (separate, stricter Gemini prompt; sees checklist, verdict, audit facts, screenshots,
  both statements) returns `{ freelancerShare: 0..100, reasoning }`. Code turns it into money:
  100 → full capture, 0 → void, otherwise **partial capture** of `amount × share` (rest returns to the client).
- Either party can **reject** the AI Judge decision within the window → `escalated` → admin page
  (`users.isAdmin`) records the final split, executed by the same code path.
- State machine additions: `passed → paid_out | disputed`, `failed → disputed | verifying | cancelled`,
  `disputed → judged`, `judged → paid_out | cancelled | escalated`, `escalated → paid_out | cancelled`.
  Every money step stays a conditional transition with deterministic PayPal request ids.
- Payments history gains `refund`/partial rows; the Proof Report shows the dispute timeline and decision.

## 2. Site ownership check
- Each freelancer has a verification code (HMAC of their user id). Before judging, the crawler requires
  `<meta name="verifund-verification" content="CODE">` on the start page or `/.well-known/verifund.txt`
  containing the code — measured by code in the KERNEL browser, not by the AI.
- Missing → every item `fail` with "Add your verification code to prove you own this site"; shown in the
  submit form with copy button.
- Demo workspaces are exempt for the hosted demo sites only (clearly labelled), since judges can't edit them.

## 3. PayPal webhooks
- `POST /api/paypal/webhook`: verify signature (`PAYPAL_WEBHOOK_ID`), store every event once in
  `paypal_events` (unique event id), then dispatch:
  - `CHECKOUT.ORDER.APPROVED` → complete funding even if the client closed the tab before the return page.
  - `PAYMENT.AUTHORIZATION.VOIDED`, `PAYMENT.CAPTURE.COMPLETED|REFUNDED|REVERSED` → mark the matching
    payment row "Confirmed by PayPal" (webhook-confirmed, replacing per-view polling where available).
  - `CUSTOMER.DISPUTE.*` → feature 4.
- `scripts/register-webhook.mts` registers the Render URL's webhook and prints the id for the env.

## 4. PayPal Disputes (customer opens a dispute on PayPal)
- On `CUSTOMER.DISPUTE.CREATED`, find our milestone by the disputed transaction/capture id, show a
  "PayPal dispute open" banner to both parties and log it.
- **If spike 3 = visible to the platform:** automatically `provide-evidence` with notes (checklist,
  verdict, timestamps, Proof Report link) and the key screenshots as documents, and post a message.
- **If not (expected in direct mode):** generate an **evidence pack** (PDF of the Proof Report + screenshots)
  the freelancer downloads and uploads in PayPal's Resolution Center, with step-by-step guidance.

## 5. Venmo & Pay Later
- Replace the redirect with the PayPal JS SDK v6 buttons on the job page (client component):
  `createOrder` → server action (same server-side order creation, amount from DB), `onApprove` → server
  action `completeFunding`. Buttons: PayPal, Venmo (US/USD), Pay Later; Pay Later messaging under the amount.
- If spike 4 shows Venmo/Pay Later refuse `AUTHORIZE`, show them only where valid and keep PayPal as default;
  never switch escrow to immediate capture.

## 6. KERNEL live view & replay ("watch the AI check your site")
- Start a replay recording for every website check; store `replayId` (+ view URL if usable) on the submission.
- Job page while verifying: embedded **live view**, only if spike 1 confirms it is view-only; otherwise a
  "recording…" indicator. After the check: **Replay** player on the job page and in the Proof Report.
- Fallback if replay URLs need a KERNEL login: download the MP4 after the check and serve it through our app
  (parties only), stored in Supabase Storage.

## 7. AG Studio analytics ("Insights")
- `/insights` page per user, data scoped by `myJobsWhere`: sources `milestones` (amount, state, proof type,
  dates), `verdicts` (item, status, reason), `payments` (kind, amount, date), `checks` (duration, pages,
  broken links). Admin sees all.
- Preset dashboard (custom widgets + Verifund theme): money held vs released over time, pass rate per
  checklist category, top failure reasons, time-to-payment, freelancer track records.
- **Ask your data**: Studio Agent Framework with Gemini as the model ("show milestones that failed on
  contact forms this month" → new widget). Exact wiring decided by spike 5.

## Testing
- Unit/DB tests (TDD) for: review-window transitions and sweeper, AI Judge share → capture/void/partial
  mapping (bounds 0–100, rounding, zero-decimal currencies), escalation, webhook signature handling and
  idempotency, dispute → milestone mapping, ownership code check, Insights data scoping.
- Live sandbox runs for each PayPal flow (approve in browser), recorded in the plan.

## Order and estimate (~15 working days to Nov 12)
0. Spikes (1d) → 1. Review window + disputes (3d) → 3. Webhooks (1d) → 4. PayPal disputes (1.5d) →
2. Ownership (1d) → 6. KERNEL replay (1d) → 5. Venmo/Pay Later (1.5d) → 7. AG Studio (3d) →
README/license/video/demo accounts (2d). If time runs short, cut from the end of 7 (agent chat) first.

## Out of scope
Multi-instance scaling, real-money (live) PayPal, MCP/agentic-commerce server (not chosen), mobile app.
