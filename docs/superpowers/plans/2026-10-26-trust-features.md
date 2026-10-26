# Trust & Showcase Features — Implementation Plan

> Executed natively (superpowers:executing-plans), TDD per task, one fresh review at the end.

**Spec:** `docs/superpowers/specs/2026-10-26-trust-and-showcase-design.md` (incl. spike results).
**Branch:** `trust-features`.

## Global constraints
- Money moves only through conditional state transitions + deterministic `PayPal-Request-Id`s.
- The AI (verifier or judge) never chooses an amount directly: the judge returns an integer share 0–100,
  code clamps it and computes `round(amount × share / 100)` in minor units (zero-decimal currencies safe).
- Review window: `REVIEW_WINDOW_MINUTES` (default 1440 = 24h, max 2880 = 48h); demo jobs use 2 minutes.
- Captures happen inside PayPal's 3-day honor period; anything older first reauthorizes (follow-up).
- Untrusted text (statements, site content) is data for the judge, never instructions.

## Review focus
1. Double approve / approve racing the sweeper → exactly one capture (conditional `passed → paid_out`).
2. Dispute opened at the same moment the window ends → either dispute wins or release wins, never both.
3. Judge returns junk / NaN / 150 / -5 / AI busy → share clamped or decision fails closed (stays disputed).
4. Share 0 → void (no capture); share 100 → full capture; 1–99 → partial capture, remainder back to client.
5. Only the right party can open, respond, accept, reject; admin only for escalated disputes.

## Feature 1 — Review window + AI Judge disputes
- **T1 Schema & states.** `milestones.releaseAt`, `milestones.capturedMinor`; table `disputes`
  (milestoneId unique, openedBy, clientStatement, freelancerStatement, judgeShare, judgeReasoning,
  status open|judged|escalated|resolved, decideAt, rejectedBy, finalShare, adminNote, timestamps).
  States: `passed → paid_out | disputed`, `failed → verifying | cancelled | disputed`,
  `disputed → paid_out | cancelled`. Tests: transition table.
- **T2 Settlement.** `settle(milestoneId, from, share)` in payments: 100 → full capture, 0 → void,
  1–99 → partial capture (`final_capture: true`), payments rows `paid`/`captured`+`payout` and `void`
  remainder. `release()` = `settle(id, "passed", 100)`. Tests with mocked PayPal: each share, idempotency.
- **T3 Review window.** run.ts: pass → `passed` + `releaseAt` (no immediate capture). `releaseDue()` sweeper
  (startup + every 60 s). `approveRelease` (client). Tests: window math, sweeper releases only due rows,
  approve vs sweeper race.
- **T4 Disputes + AI Judge.** `openDispute` (client in `passed` before releaseAt; freelancer in `failed`),
  `respondDispute` (other party), `askJudge` (Gemini JSON `{freelancerShare, reasoning}`, validated),
  `acceptDecision` / `rejectDecision` (reject → escalated), sweeper settles `judged` past `decideAt`,
  admin `resolveDispute(share, note)`. Tests for each rule + clamping + fail-closed.
- **T5 UI.** Job page: countdown + Approve now / Dispute (client); Dispute the AI (freelancer on failed);
  dispute panel (statements, judge reasoning + share bar, accept/reject); `/admin/disputes`.
  Proof Report: dispute timeline. Browser run.

## Later features (own task lists when reached)
2 Site ownership · 3 Webhooks (needs owner approval to register) · 4 PayPal disputes evidence ·
5 Venmo/Pay Later JS SDK buttons · 6 KERNEL replay MP4 · 7 AG Studio Insights + Gemini adapter.
