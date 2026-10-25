import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "./schema";
import { env } from "@/lib/env";

// One PGlite instance per process; dev hot-reload must not open the data dir twice.
// ponytail: embedded single-process Postgres; swap to drizzle-orm/postgres-js if we ever run >1 instance.
const g = globalThis as unknown as { pglite?: PGlite };
const client = (g.pglite ??= new PGlite(env.DATABASE_URL));

export const db = drizzle({ client, schema, casing: "snake_case" });
