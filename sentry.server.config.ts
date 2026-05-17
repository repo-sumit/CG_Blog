import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    // Lower in prod once we have signal — start at 100% so the first deploy
    // surfaces issues quickly.
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
    enabled: process.env.NODE_ENV === "production",
  });
}
