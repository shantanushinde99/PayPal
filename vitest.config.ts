import { defineConfig } from "vitest/config";
import { loadEnvConfig } from "@next/env";
import path from "node:path";

// DB tests use the local Postgres from `npm run db`.
loadEnvConfig(process.cwd());

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { include: ["src/**/*.test.ts"], fileParallelism: false },
});
