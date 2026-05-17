import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";
import { sendPerPostNewsletter } from "@/lib/email/newsletter";
import { PUBLIC_FEED_TAG } from "@/lib/db/public";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Promotes posts whose `scheduled_for` slot has arrived to `published`.
 *
 * Runs hourly (see vercel.json) — combined with the editor scheduling slot of
 * 09:00 UTC, posts go live the morning of their assigned weekday with at most
 * one hour of latency.
 *
 * Auth: Vercel injects `Authorization: Bearer <CRON_SECRET>` for scheduled
 * runs; the same header lets ops run the cron manually.
 */
export async function GET(request: NextRequest) {
  const { cronSecret } = serverEnv();
  const auth = request.headers.get("authorization") ?? "";
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nowIso = new Date().toISOString();
  const service = createSupabaseServiceClient();

  const { data: due, error: selErr } = await service
    .from("posts")
    .select("id, slug, scheduled_for")
    .eq("status", "scheduled")
    .lte("scheduled_for", nowIso);
  if (selErr) {
    return NextResponse.json({ error: selErr.message }, { status: 500 });
  }

  const rows = (due ?? []) as { id: string; slug: string; scheduled_for: string | null }[];
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, promoted: 0, now: nowIso });
  }

  // Use each post's own scheduled_for as published_at so the public byline
  // reflects the intended slot, not the time the cron happened to fire.
  let promoted = 0;
  let newslettersDispatched = 0;
  const failures: { id: string; error: string }[] = [];
  for (const r of rows) {
    const { error } = await service
      .from("posts")
      .update({
        status: "published",
        published_at: r.scheduled_for ?? nowIso,
      })
      .eq("id", r.id);
    if (error) {
      failures.push({ id: r.id, error: error.message });
      continue;
    }
    promoted++;
    // Invalidate the per-post route + bust the public-feed cache so the
    // freshly-promoted post appears immediately on the landing instead of
    // waiting up to 60s for the unstable_cache TTL.
    revalidatePath("/");
    revalidatePath(`/posts/${r.slug}`);
    revalidateTag(PUBLIC_FEED_TAG, "default");
    // Idempotent — `sendPerPostNewsletter` claims the post via a conditional
    // newsletter_sent_at update, so retries / double-runs never duplicate mail.
    const dispatch = await sendPerPostNewsletter(r.id);
    if (dispatch.ok && (dispatch.sent ?? 0) > 0) newslettersDispatched++;
    if (!dispatch.ok && dispatch.error) {
      console.error(`[cron:publish-scheduled] newsletter for ${r.id} failed: ${dispatch.error}`);
    }
  }

  if (failures.length > 0) console.error("[cron:publish-scheduled] failures", failures);
  console.log(`[cron:publish-scheduled] promoted=${promoted} mailed=${newslettersDispatched} failed=${failures.length}`);
  return NextResponse.json({
    ok: true,
    promoted,
    newsletters: newslettersDispatched,
    failed: failures.length,
    now: nowIso,
  });
}
