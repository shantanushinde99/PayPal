// Local Postgres without Docker: real Postgres 17 binaries from npm. Run: npm run db (keep it open)
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";

const dir = "./.data/pg";
const pg = new EmbeddedPostgres({ databaseDir: dir, user: "pod", password: "pod", port: 5433, persistent: true });

if (!existsSync(`${dir}/PG_VERSION`)) await pg.initialise();
await pg.start();
await pg.createDatabase("pod").catch(() => {}); // already exists
await pg.createDatabase("pod_test").catch(() => {}); // for `npm test`
console.log("Postgres running on postgres://pod:pod@localhost:5433/pod (Ctrl+C to stop)");

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, async () => { await pg.stop(); process.exit(0); });
}
