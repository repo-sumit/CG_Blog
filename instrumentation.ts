// Next.js boot-time hook. Runs once per server process (Node and Edge runtimes
// have separate registers). Use this to:
//   1. Fail fast if a required env var is missing (better than a 500 mid-request).
//   2. Warn on optional-but-recommended vars that production should not skip.
//   3. Load runtime-specific Sentry config (when @sentry/nextjs is wired up).

import * as Sentry from "@sentry/nextjs";

const REQUIRED_PROD_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "APP_ALLOWED_EMAIL_DOMAIN",
  "CRON_SECRET",
  "RESEND_API_KEY",
  "NEXT_PUBLIC_APP_URL",
] as const;

const RECOMMENDED_PROD_ENV = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "SENTRY_DSN",
  "NEXT_PUBLIC_SENTRY_DSN",
] as const;

function validateEnv() {
  const isProd = process.env.NODE_ENV === "production";
  const missingRequired = REQUIRED_PROD_ENV.filter((k) => !process.env[k]);
  const missingRecommended = RECOMMENDED_PROD_ENV.filter((k) => !process.env[k]);

  if (isProd && missingRequired.length > 0) {
    // Throw — refusing to boot a misconfigured production server is the
    // entire point of this file.
    throw new Error(
      `[instrumentation] missing required production env vars: ${missingRequired.join(", ")}`,
    );
  }

  if (missingRequired.length > 0) {
    console.warn(
      `[instrumentation] dev: missing required-for-prod env vars (ok in dev): ${missingRequired.join(", ")}`,
    );
  }
  if (isProd && missingRecommended.length > 0) {
    console.warn(
      `[instrumentation] prod: missing recommended env vars (rate limit + error tracking degraded): ${missingRecommended.join(", ")}`,
    );
  }

  // CRON_SECRET sanity check — a 3-character secret defeats the purpose.
  const cron = process.env.CRON_SECRET ?? "";
  if (isProd && cron.length < 24) {
    throw new Error(
      "[instrumentation] CRON_SECRET must be >=24 characters in production. Generate with `openssl rand -hex 32`.",
    );
  }
}

export async function register() {
  validateEnv();

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Next 15+ Sentry hook — bubbles Server Component / route handler errors into
// Sentry with proper context. No-op when SENTRY_DSN isn't set.
export const onRequestError = Sentry.captureRequestError;
