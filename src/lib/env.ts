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
  })
  .parse(process.env);
