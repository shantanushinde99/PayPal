# Accounts, Roles, Invitations & Demo Access — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (chosen: Native). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Real sign-up with roles and profiles, a freelancer directory with Hire, invitations the freelancer must accept before funding, and one-click isolated demo workspaces for judges.

**Architecture:** Log in with PayPal stays the identity. Users gain role/profile columns and an onboarding gate in `requireUser`. Jobs gain `freelancerId` + `status`; every "is this my job" check goes through one helper (`src/lib/job-access.ts`). Demo access is a second next-auth provider (Credentials) that can only *create* fresh demo users; switching sides uses an HMAC-signed token. Payments keep using `jobs.freelancerEmail` as the payout address, snapshotted at acceptance.

**Tech Stack:** Next.js 16, next-auth v5 (JWT), Drizzle + Postgres, vitest, Tailwind v4, lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-26-accounts-roles-demo-design.md`

## Global Constraints
- Real users sign in only with PayPal; payouts only go to a PayPal-confirmed email (or the configured sandbox demo payout account for demo users).
- Demo sign-in never returns an existing user; demo and real users never see or hire each other.
- No fake PayPal transaction IDs are ever stored or shown (seeded demo jobs stop before funding).
- Funding requires `jobs.status = "accepted"`; editing a draft milestone after acceptance resets it to `invited`.
- Demo env vars are optional: `DEMO_BUYER_EMAIL`, `DEMO_BUYER_PASSWORD`, `DEMO_PAYOUT_EMAIL`. Without `DEMO_PAYOUT_EMAIL` the demo button is hidden.
- Demo workspaces older than 48h are deleted.
- Schema changes are pushed to `pod`, `pod_test` and Supabase (`DATABASE_URL_PROD`).

## Review Focus
1. **A real user's verified email equals a demo payout email** → must not gain access to demo jobs (demo jobs always have `freelancerId` set, so email fallback never applies) → test in Task 1.
2. **Freelancer accepts, then client edits a draft milestone** → acceptance reset, funding blocked until re-accepted → test in Task 4.
3. **Tampered or replayed side-switch token** (other group's user id, edited signature, expired) → rejected → test in Task 7.
4. **Unclaimed email invite + a different PayPal account** → no access → test in Task 1.
5. **Existing jobs created before this change** (no freelancerId, no status) → still accessible and fundable as `accepted` → migration step + test in Task 1.

---

### Task 1: Schema + job access helper
**Files:** modify `src/db/schema.ts`, `src/test/fixtures.ts`; create `src/lib/job-access.ts` (+ test).
**Produces:**
- `users`: `roles: text[]` default `{}`, `displayName`, `company`, `headline`, `skills: text[]` default `{}`, `bio`, `portfolioUrl`, `onboardedAt`, `isDemo` bool default false, `demoGroup: uuid`, `payoutEmail`.
- `jobs`: `freelancerId: uuid` (nullable, references users), `status: text` default `"invited"`, `declineNote`, `acceptedAt`.
- `jobRole(job: {clientId; freelancerId; freelancerEmail}, user: {id; email}): "client" | "freelancer" | null` — freelancer iff `freelancerId === user.id`, or (`freelancerId == null` and `freelancerEmail === user.email`).
- `myJobsWhere(user)` drizzle SQL condition with the same rule.
- Migration: after push, `update jobs set status='accepted', accepted_at=created_at where status='invited' and created_at < now()` run once on `pod` (existing data).

Tests (`job-access.test.ts`): client; freelancer by id; unclaimed email invite matches by email; claimed job (freelancerId set to someone else) does NOT match by email (Review Focus 1, 4); stranger null. DB test: `myJobsWhere` returns the same set.

### Task 2: Onboarding gate, onboarding + profile pages
**Files:** modify `src/lib/session.ts`; create `src/lib/profile.ts` (+ test), `src/app/onboarding/page.tsx`, `src/app/profile/page.tsx`, `src/app/profile/actions.ts`.
**Produces:**
- `requireUser({ onboarded = true } = {})` → returns the full user row; redirects `/` when logged out and `/onboarding` when `onboarded` and `onboardedAt` is null.
- `parseProfile(formData): ProfileInput` — roles ⊆ {client, freelancer}, ≥1; displayName 2–60 chars; company ≤80; freelancer: headline 2–80, ≤10 skills each ≤30 chars (comma separated, trimmed, deduped case-insensitively), bio ≤600, portfolioUrl http(s) or empty. Throws a friendly Error.
- `saveProfile(formData)` server action: updates the user, sets `onboardedAt` if null, redirects to `/`.
- Pages: role cards (Client / Freelancer / Both) + fields shown per role (small client component toggling sections), prefilled on `/profile`.
Tests: valid client, valid freelancer with skills normalised, both roles, rejects empty roles / bad URL / too many skills.

### Task 3: Move every access check to job-access
**Files:** `src/app/jobs/load.ts`, `src/app/page.tsx`, `src/lib/payment-history.ts`, `src/app/jobs/actions.ts` (`submitProof`), `src/app/jobs/[id]/page.tsx` (show names).
- `loadJobForUser` uses `jobRole`; also returns `client` and `freelancer` display info (displayName ?? email).
- Dashboard + `loadPaymentsForUser` use `myJobsWhere`; history role uses `jobRole`.
- `submitProof` requires `jobRole(...) === "freelancer"` and `job.status === "accepted"`.
Tests: update `payment-history.test` (freelancer by id); `load.test` (freelancer by id sees job; stranger 404).

### Task 4: Invitations
**Files:** `src/app/jobs/actions.ts`, `src/lib/payments.ts`, `src/lib/invitations.ts` (+ test), job page.
**Produces:**
- `createJob` accepts `freelancerId` (hire from directory) or `freelancerEmail` (invite). With an id: target must be onboarded freelancer, same `isDemo`/`demoGroup`, not self; `freelancerEmail` = target payoutEmail ?? email. Demo users can't invite by email. Status `invited`.
- `acceptJob(jobId)` / `declineJob(jobId, formData)` in `src/lib/invitations.ts` (logic) wrapped by server actions: only the invited freelancer; only from `invited`; accept sets `freelancerId`, `freelancerEmail = user.payoutEmail ?? user.email`, `status=accepted`, `acceptedAt`; decline sets `status=declined`, `declineNote` (≤300).
- `startFunding` throws `"The freelancer hasn't accepted this job yet"` unless `status === "accepted"`.
- `saveMilestone`: if job was `accepted`, set back to `invited` (Review Focus 2).
- Job page: invited → client sees "Waiting for <name> to accept", no fund button; freelancer sees an invitation panel (milestones, amounts, checklists) with Accept / Decline (+note). Declined → client sees note.
Tests: accept/decline happy path; wrong user can't accept; can't accept twice; fund blocked before accept; edit after accept resets; accept snapshots payoutEmail.

### Task 5: Freelancer directory + Hire
**Files:** `src/lib/directory.ts` (+ test), `src/app/freelancers/page.tsx`, `src/app/jobs/new/page.tsx`.
**Produces:**
- `listFreelancers(viewer, q?)` — onboarded users with role freelancer, excluding the viewer; real viewers see `isDemo=false`, demo viewers see their `demoGroup`; `q` matches name/headline/skills (ILIKE). Each with `trackRecord {paid, firstTry}`: paid milestones count and % of paid milestones that passed on their first submission.
- Directory page: search box, cards (initials avatar, name, headline, skill chips, track record or "New on Verifund", portfolio link), **Hire** → `/jobs/new?freelancer=<id>`.
- New job page: with `?freelancer=` shows the selected card + hidden `freelancerId`; otherwise "Pick from directory" link + email field.
Tests: isolation real/demo/other demo group; search; track record counts.

### Task 6: Role dashboards + header
**Files:** `src/app/page.tsx`, `src/components/header.tsx`, `src/app/view/route.ts` (sets `view` cookie).
- Header: Dashboard, Freelancers (clients), Wallet, Profile, name instead of email; Client/Freelancer switch for both-role users (cookie `view`).
- Client view: stats, Recent payments, "Awaiting acceptance", "Active jobs", "Declined". Freelancer view: Invitations (with Accept shortcut link), Active work, Earnings (wallet totals).

### Task 7: Demo workspaces
**Files:** `src/lib/env.ts`, `src/lib/demo.ts` (+ test), `src/auth.ts`, `src/app/demo/actions.ts`, `src/components/demo-banner.tsx`, `src/instrumentation.ts`.
**Produces:**
- `createDemoWorkspace(): { clientId, freelancerId, group }` — group uuid; users (emails `client.<group>@demo.verifund.app` etc., `isDemo`, `payoutEmail = DEMO_PAYOUT_EMAIL`, onboarded): client "Alex Rivera · Sunrise Bakery", freelancer "Priya Shah · Web developer", showcase freelancers "Diego Morales · Painter & decorator", "Mei Chen · Brand & web designer". Jobs: "Sunrise Bakery website" ($300, 6 bakery checklist items, accepted, draft — ready to fund), "Repaint the shop wall" ($80, photo, invited to Priya), "Menu redesign" draft invited to Mei (shows the client waiting).
- `signSwitch(userId, group)` / `verifySwitch(token)` — HMAC-SHA256 with AUTH_SECRET, 10-minute expiry, target must be in the same group.
- next-auth Credentials provider `demo`: credentials `{ switch?: token }`; no token → new workspace, returns demo client; token → verified user. Never looks users up by any visitor-supplied email. `jwt` callback: for provider `demo` take `user.id` directly (no email upsert).
- `startDemo()` / `switchDemoSide()` server actions; banner (demo users only): "Demo workspace", switch button, sandbox buyer login (from env), demo site URLs.
- `deleteOldDemos(hours = 48)` — deletes payments, verdicts, events, submissions, checklist items, milestones, jobs, users of demo groups older than the cutoff; called on server start and every 24h.
Tests: workspace creates isolated users/jobs; demo provider never returns a pre-existing user; token tamper/expiry/other-group rejected (Review Focus 3); cleanup deletes only old demo rows.

### Task 8: Landing CTA + E2E
- Landing: "Try the live demo" next to "Start with PayPal" (hidden when demo isn't configured).
- Browser run (forged sessions for real users, real demo button): onboarding → directory → hire → accept → fund button appears; demo → switch sides → accept invitation.
- Push schema to Supabase; commit; push.
