# Accounts, Roles, Invitations & Demo Access — Design

**Date:** 2026-10-26 · **Status:** awaiting approval

## Why
Today a client types a freelancer's email and both sides just "log in". Judges also have no
sandbox accounts. We want a real product flow: sign up with a role, find and hire a freelancer,
the freelancer accepts, then money is held — and a one-click way for judges to try everything.

## Decisions (from the user)
- Build all four: role onboarding + profiles, freelancer directory + Hire, invitations
  (accept/decline), one-click demo logins.
- Judge access: demo logins **and** Log in with PayPal. No email/password sign-up.

## 1. Identity & roles
- **Log in with PayPal stays the only real sign-in.** It gives a confirmed email, which is the
  payout address (no typos, no impersonation).
- First login → **onboarding** (`/onboarding`), required before using the app:
  - "How will you use Verifund?" → **Client**, **Freelancer**, or **Both**.
  - Client profile: display name, company (optional).
  - Freelancer profile: display name, headline, skills (tags), bio, portfolio URL (optional).
- Profile editable later at `/profile`. Users with both roles get a **Client / Freelancer view
  switch** in the header; the dashboard shows that role's view.

## 2. Freelancer directory & hiring
- `/freelancers`: cards with name, headline, skills, portfolio link, and track record computed
  from our data (milestones paid, % verified on first try). Search by name/skill.
- **Hire** on a card opens "Post a job" with that freelancer pre-selected.
- Invite by email stays available for freelancers not on Verifund yet; when that person logs in
  with PayPal using that email, the invitation is waiting for them.

## 3. Invitations (consent before money)
- A new job starts as **Invited**. The freelancer sees it in **Invitations** with the full
  description, milestones, amounts and checklists, and can **Accept** or **Decline** (optional note).
- **Funding is only possible after Accept.** Accepting freezes the agreed checklist for that
  version; if the client edits a draft milestone afterwards, the freelancer must accept again.
- Declined jobs are shown to the client with the note; the client can hire someone else.
- Job states: `invited → accepted | declined` (job level), separate from milestone states.

## 4. Demo access for judges
- Landing page and login page get **"Try the live demo"** (and README instructions).
- Each click creates a **private demo workspace** for that visitor, so judges never collide:
  - a demo **client** and demo **freelancer** user (flagged `isDemo`, `demoGroup`),
  - 2–3 seeded demo freelancer profiles in the directory,
  - seeded jobs in useful states: an invitation waiting, a funded milestone ready for proof,
    one already refused with a Proof Report, one paid.
- A banner in demo mode: "Demo workspace · switch to the freelancer side" (one click), plus the
  **sandbox buyer login** to use on PayPal's approval page (sandbox only, clearly labelled).
- Money in demo mode is still real PayPal sandbox: approvals use a dedicated sandbox buyer, and
  payouts go to a dedicated sandbox freelancer account. The demo freelancer's payout address is
  that sandbox account; the demo user's login identity is separate.
- Safety: the demo sign-in can only ever create new demo users — it can't sign in as a real
  user. Demo users can't hire or see real users, and real users don't see demo users.
- Workspaces older than 48h are deleted (on server start + daily).

## Data model changes
- `users`: `roles` (text[]: client/freelancer), `displayName`, `company`, `headline`, `skills`
  (text[]), `bio`, `portfolioUrl`, `onboardedAt`, `isDemo`, `demoGroup`, `payoutEmail`
  (= PayPal email for real users; the shared sandbox freelancer for demo users).
- `jobs`: `freelancerId` (nullable for email invites until claimed), `status`
  (invited/accepted/declined), `declineNote`, `acceptedAt`. `freelancerEmail` remains the payout
  address snapshot taken at acceptance.
- Access checks move from "email matches" to `freelancerId = me` (or email match for an
  unclaimed invite).

## Pages
`/onboarding`, `/profile`, `/freelancers`, dashboard sections per role (Invitations, Active
work, Earnings / My jobs, Awaiting acceptance, Spending), invitation view on the job page.

## Testing
- Unit/DB tests: onboarding required; role gating; accept/decline transitions; fund blocked
  before accept; re-accept after edit; access by freelancerId; email-invite claiming; demo
  sign-in never resolves a real user; demo/real isolation in directory and jobs; cleanup.
- Browser run: new user onboarding → client hires → freelancer accepts → fund; demo button →
  full flow on both sides.

## Needed from the user
- Create two **dedicated sandbox accounts** for the demo (Personal, United States): a demo
  buyer and a demo freelancer. Their buyer login will be shown publicly in demo mode, so don't
  reuse the personal test accounts.

## Out of scope
Email/password accounts, messaging/chat, reviews and ratings by users, freelancer bidding.
