import { z } from "zod";

const schema = z
  .object({
    PAYPAL_CLIENT_ID: z.string().min(1),
    PAYPAL_CLIENT_SECRET: z.string().min(1),
    PAYPAL_API_BASE: z.url(),
    PAYPAL_WEB_BASE: z.url(),
    GEMINI_API_KEY: z.string().min(1),
    GEMINI_MODEL_PRIMARY: z.string().min(1),
    GEMINI_MODEL_FALLBACK: z.string().min(1),
    KERNEL_API_KEY: z.string().min(1),
    DATABASE_URL: z.string().min(1),
    AUTH_SECRET: z.string().min(1),
    APP_URL: z.url(),
    // direct: capture pays the freelancer (works everywhere). payouts: capture to platform, then Payouts API (needs Payouts eligibility).
    PAYOUT_MODE: z.enum(["direct", "payouts"]).default("direct"),
    GITHUB_READ_TOKEN: z.string().optional(), // read-only token for checking public repos: 5,000 GitHub API calls/hour instead of 60
    AG_STUDIO_LICENSE_KEY: z.string().optional(), // without it AG Studio runs as a trial (watermark off localhost)
    PAYPAL_WEBHOOK_ID: z.string().optional(), // from scripts/register-webhook.mts; unset = webhooks ignored
    REVIEW_WINDOW_MINUTES: z.coerce.number().int().optional(), // after an AI pass, before auto-release
    // Optional demo for judges: shared sandbox accounts. No DEMO_PAYOUT_EMAIL → demo hidden.
    DEMO_PAYOUT_EMAIL: z.email().optional(),
    DEMO_BUYER_EMAIL: z.email().optional(),
    DEMO_BUYER_PASSWORD: z.string().optional(),
  });

// `next build` loads route modules to collect page data, where secrets don't exist (e.g. a CI build machine).
// They are validated when the server actually starts.
export const env: z.infer<typeof schema> =
  process.env.NEXT_PHASE === "phase-production-build" ? (process.env as never) : schema.parse(process.env);
