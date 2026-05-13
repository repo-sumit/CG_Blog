import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Supabase keep-alive ping. The Supabase free tier pauses projects after a
 * stretch of inactivity, which makes the first request after a quiet period
 * (e.g. a draft autosave) feel sluggish. This tiny endpoint runs a one-row
 * read against the `posts` table on a schedule so the DB stays warm.
 *
 * Auth: same Bearer-CRON_SECRET pattern as the other crons. The endpoint is
 * deliberately read-only and uses the service client (read-only intent), but
 * is rate-limited by the cron schedule itself — there's no rationale for an
 * external caller to hit this URL.
 */
export async function GET(request: NextRequest) {
  const { cronSecret } = serverEnv();
  const auth = request.headers.get("authorization") ?? "";
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createSupabaseServiceClient();
  const startedAt = Date.now();
  const { error } = await service.from("posts").select("id").limit(1);
  const elapsedMs = Date.now() - startedAt;

  if (error) {
    console.error("[cron:keep-alive] query failed", error.message);
    return NextResponse.json({ ok: false, error: error.message, elapsedMs }, { status: 500 });
  }

  return NextResponse.json({ ok: true, elapsedMs });
}
