import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/guards";
import { getNewsletterDiagnostics } from "@/lib/email/newsletter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/newsletter-diagnostics
 *
 * Manager-only health endpoint for the newsletter pipeline. Returns counts
 * + Resend config status; NEVER returns subscriber email addresses or any
 * other personal data. Useful when "only one person got the email" reports
 * come in — call this first to see whether the project is in Resend's
 * sandbox mode, or whether the subscriber list is wrong, before tailing
 * Vercel logs.
 *
 * Why manager-only and not viewer-readable: even subscriber counts are
 * useful intel for someone probing whether to spam-bomb the list. Keep it
 * locked down.
 */
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const diagnostics = await getNewsletterDiagnostics();
  return NextResponse.json(diagnostics, {
    headers: {
      // Always live — these counts change as subscribers come and go.
      "Cache-Control": "no-store",
    },
  });
}
