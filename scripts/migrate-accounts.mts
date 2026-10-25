// One-off, idempotent: run after deploying the accounts/roles change to an existing database.
//   npx tsx --env-file=.env --tsconfig tsconfig.json scripts/migrate-accounts.mts --before <ISO time of the deploy> [--url postgres://…]
// 1. Jobs created before invitations existed were agreed already → status accepted.
// 2. Link those jobs to the freelancer's account when their email matches, so track records count them.
// 3. People who already used Verifund skip onboarding: roles come from their job history.
import postgres from "postgres";

const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const raw = arg("--before");
if (!raw || Number.isNaN(Date.parse(raw))) { console.error("Pass --before <ISO time> = when the invitations feature went live."); process.exit(1); }
const before = new Date(raw);
const sql = postgres(arg("--url") ?? process.env.DATABASE_URL!, { max: 1 });
const accepted = await sql`update jobs set status = 'accepted', accepted_at = created_at
  where status = 'invited' and created_at < ${before}
    and client_id not in (select id from users where is_demo) returning id`;
const linked = await sql`update jobs j set freelancer_id = u.id from users u
  where j.freelancer_id is null and j.status = 'accepted' and u.email = j.freelancer_email and not u.is_demo returning j.id`;
const onboarded = await sql`update users u set
    roles = array_remove(array[
      case when exists (select 1 from jobs j where j.client_id = u.id) then 'client' end,
      case when exists (select 1 from jobs j where j.freelancer_id = u.id) then 'freelancer' end
    ], null),
    display_name = coalesce(u.display_name, u.name, split_part(u.email, '@', 1)),
    headline = case when exists (select 1 from jobs j where j.freelancer_id = u.id) then coalesce(u.headline, 'Freelancer') else u.headline end,
    onboarded_at = now()
  where u.onboarded_at is null and not u.is_demo
    and exists (select 1 from jobs j where j.client_id = u.id or j.freelancer_id = u.id)
  returning u.email, u.roles`;
console.log(`jobs marked accepted: ${accepted.length}, jobs linked to freelancer accounts: ${linked.length}, existing users set up: ${onboarded.map((u) => `${u.email} (${u.roles.join("+")})`).join(", ") || "none"}`);
await sql.end();
