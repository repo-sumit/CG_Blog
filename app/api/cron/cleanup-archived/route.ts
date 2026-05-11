import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RETENTION_DAYS = 30;

/**
 * Hard-deletes posts that have been in the `archived` state for more than
 * RETENTION_DAYS days. Authenticated either by:
 *
 *   1. Vercel cron — Vercel automatically injects `Authorization: Bearer <CRON_SECRET>`
 *      into requests made by its scheduler. Set `CRON_SECRET` in Vercel env
 *      and in vercel.json's cron config will work out of the box.
 *   2. Manual trigger — hit the URL with the same bearer token (useful for
 *      one-off cleanup from a script).
 *
 * Any other caller gets a 401.
 */
export async function GET(request: NextRequest) {
  const { cronSecret } = serverEnv();
  const auth = request.headers.get("authorization") ?? "";
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const service = createSupabaseServiceClient();

  // Fetch IDs first so we can return a count + log what was purged.
  const { data: purgeable, error: selErr } = await service
    .from("posts")
    .select("id, slug, archived_at")
    .eq("status", "archived")
    .lt("archived_at", cutoff);
  if (selErr) {
    return NextResponse.json({ error: selErr.message }, { status: 500 });
  }

  const ids = (purgeable ?? []).map((r) => (r as { id: string }).id);
  if (ids.length === 0) {
    return NextResponse.json({ ok: true, purged: 0, cutoff });
  }

  const { error: delErr } = await service.from("posts").delete().in("id", ids);
  if (delErr) {
    return NextResponse.json({ error: delErr.message, attempted: ids.length }, { status: 500 });
  }

  console.log(`[cron:cleanup-archived] purged ${ids.length} posts older than ${cutoff}`);
  return NextResponse.json({ ok: true, purged: ids.length, cutoff });
}
