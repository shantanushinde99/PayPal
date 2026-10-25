import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "@/lib/env";

// Reuse one pool across dev hot reloads.
const g = globalThis as unknown as { pg?: ReturnType<typeof postgres> };
const client = (g.pg ??= postgres(env.DATABASE_URL));

export const db = drizzle({ client, schema, casing: "snake_case" });
