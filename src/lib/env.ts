import { z } from "zod";

export const env = z
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
    AG_STUDIO_LICENSE_KEY: z.string().optional(), // without it AG Studio runs as a trial (watermark off localhost)
    PAYPAL_WEBHOOK_ID: z.string().optional(), // from scripts/register-webhook.mts; unset = webhooks ignored
    REVIEW_WINDOW_MINUTES: z.coerce.number().int().optional(), // after an AI pass, before auto-release
    // Optional demo for judges: shared sandbox accounts. No DEMO_PAYOUT_EMAIL → demo hidden.
    DEMO_PAYOUT_EMAIL: z.email().optional(),
    DEMO_BUYER_EMAIL: z.email().optional(),
    DEMO_BUYER_PASSWORD: z.string().optional(),
  })
  .parse(process.env);
