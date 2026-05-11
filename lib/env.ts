// Centralized env access. Server-only values are read lazily so they never
// reach the client bundle.

export const publicEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  requireManagerReview:
    (process.env.NEXT_PUBLIC_REQUIRE_MANAGER_REVIEW ?? "false").toLowerCase() === "true",
  maxUploadMb: Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB ?? "50"),
} as const;

export function serverEnv() {
  return {
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    allowedDomain: (process.env.APP_ALLOWED_EMAIL_DOMAIN ?? "convegenius.ai").toLowerCase(),
    managerEmail: (process.env.APP_MANAGER_EMAIL ?? "").toLowerCase(),
    authorEmails: (process.env.APP_AUTHOR_EMAILS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  };
}

export function assertPublicSupabaseEnv() {
  if (!publicEnv.supabaseUrl || !publicEnv.supabasePublishableKey) {
    throw new Error(
      "Supabase env missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
}
