import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/env", async (orig) => ({ env: { ...(await orig<typeof import("@/lib/env")>()).env, DEMO_PAYOUT_EMAIL: undefined } }));
import { demoAuthorize } from "./demo";

describe("demo switched off", () => {
  it("creates nothing", async () => {
    expect(await demoAuthorize({})).toBeNull();
  });
});
