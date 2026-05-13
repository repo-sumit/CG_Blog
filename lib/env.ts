// Centralized env access. Server-only values are read lazily so they never
// reach the client bundle.

export const publicEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  requireManagerReview:
    (process.env.NEXT_PUBLIC_REQUIRE_MANAGER_REVIEW ?? "false").toLowerCase() === "true",
  maxUploadMb: Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB ?? "50"),
  // Videos can be substantially bigger than images. Capped separately so
  // raising the video limit doesn't accidentally relax the image cap.
  maxVideoUploadMb: Number(process.env.NEXT_PUBLIC_MAX_VIDEO_UPLOAD_MB ?? "150"),
  // Demo-only: shows a blue "Demo: N watching" counter in the public nav.
  // Disabled unless explicitly opted-in so production deploys never ship the
  // simulated counter by accident.
  enableDemoWatchingCounter:
    (process.env.NEXT_PUBLIC_ENABLE_DEMO_WATCHING_COUNTER ?? "false").toLowerCase() === "true",
} as const;

function splitEmails(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function serverEnv() {
  // APP_MANAGER_EMAIL accepts a single email OR a comma-separated list so we
  // can have multiple admins (e.g. Sumit + Aditya) without renaming the var.
  const managerEmails = splitEmails(process.env.APP_MANAGER_EMAIL);
  return {
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    allowedDomain: (process.env.APP_ALLOWED_EMAIL_DOMAIN ?? "convegenius.ai").toLowerCase(),
    managerEmails,
    /** @deprecated kept for backwards-compat with existing callers; use managerEmails. */
    managerEmail: managerEmails[0] ?? "",
    authorEmails: splitEmails(process.env.APP_AUTHOR_EMAILS),
    cronSecret: process.env.CRON_SECRET ?? "",
  };
}

export function assertPublicSupabaseEnv() {
  if (!publicEnv.supabaseUrl || !publicEnv.supabasePublishableKey) {
    throw new Error(
      "Supabase env missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
}
