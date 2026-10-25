import { defineConfig } from "vitest/config";
import { loadEnvConfig } from "@next/env";
import path from "node:path";

// DB tests use a separate database on the local Postgres from `npm run db`, never the dev data.
loadEnvConfig(process.cwd());
process.env.DATABASE_URL = process.env.DATABASE_URL!.replace(/\/pod$/, "/pod_test");

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { include: ["src/**/*.test.ts"], fileParallelism: false },
});
