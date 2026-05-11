import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { serverEnv, publicEnv } from "@/lib/env";
import { sendEmail } from "@/lib/email/resend";
import { digestTemplate } from "@/lib/email/templates";
import { formatWeekRange } from "@/lib/utils/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Bumped because we send sequentially to Resend; 5 subs + 1s budget each is
// comfortably under the 10-minute Hobby plan limit.
export const maxDuration = 300;

const LOOKBACK_DAYS = 7;

/**
 * Weekly digest. Runs every Monday at 09:00 UTC (see vercel.json).
 *
 * Pipeline:
 *  1. Authenticate via CRON_SECRET.
 *  2. Pull posts published in the last 7 days.
 *  3. Bail early if nothing new (don't spam an empty digest).
 *  4. Pull active subscribers (unsubscribed_at IS NULL).
 *  5. Send the same digest to each one, with their unique unsubscribe link.
 *  6. Return a summary.
 */
export async function GET(request: NextRequest) {
  const { cronSecret } = serverEnv();
  const auth = request.headers.get("authorization") ?? "";
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const service = createSupabaseServiceClient();

  // Pull recently published posts.
  const { data: posts, error: pErr } = await service
    .from("posts")
    .select("title, slug, excerpt, published_at, read_time_minutes, author:profiles!posts_author_id_fkey(full_name, email)")
    .eq("status", "published")
    .gte("published_at", since)
    .order("published_at", { ascending: false });

  if (pErr) {
    return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });
  }
  if (!posts || posts.length === 0) {
    return NextResponse.json({ ok: true, posts: 0, sent: 0, note: "Nothing new this week — skipped." });
  }

  // Normalize the FK join (Supabase types it as array even for singleton).
  const normalized = (posts as unknown as Array<{
    title: string;
    slug: string;
    excerpt: string | null;
    published_at: string | null;
    read_time_minutes: number;
    author: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null;
  }>).map((p) => {
    const a = Array.isArray(p.author) ? p.author[0] : p.author;
    // `noUncheckedIndexedAccess: true` makes `email.split("@")[0]` return
    // `string | undefined`, so we chain `??` with a hard fallback so the
    // final value is always `string`.
    const handle = a?.email?.split("@")[0] ?? "ConveGenius team";
    const authorName: string = a?.full_name?.trim() || handle;
    return {
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      publishedAt: p.published_at,
      readTimeMinutes: p.read_time_minutes,
      authorName,
    };
  });

  // Pull active subscribers.
  const { data: subs, error: sErr } = await service
    .from("subscribers")
    .select("email, unsubscribe_token")
    .is("unsubscribed_at", null);
  if (sErr) {
    return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });
  }

  const subscribers = (subs ?? []) as unknown as { email: string; unsubscribe_token: string }[];
  if (subscribers.length === 0) {
    return NextResponse.json({ ok: true, posts: normalized.length, sent: 0, note: "No active subscribers." });
  }

  const weekLabel = formatWeekRange().toUpperCase();
  let sent = 0;
  const failures: { email: string; error: string }[] = [];

  // Send sequentially to keep within Resend free-tier rate limits and to make
  // it easy to inspect failures in logs. For lists > ~200, switch to Resend
  // batch send.
  for (const sub of subscribers) {
    const unsubscribeUrl = `${publicEnv.appUrl}/api/subscribe/unsubscribe?t=${sub.unsubscribe_token}`;
    const tpl = digestTemplate({
      appUrl: publicEnv.appUrl,
      unsubscribeUrl,
      posts: normalized,
      weekLabel,
    });
    if (!tpl) continue;
    // RFC 8058 List-Unsubscribe headers — required by Gmail/Yahoo/Outlook bulk
    // sender rules. Each recipient gets THEIR token, never anyone else's.
    const res = await sendEmail({
      to: sub.email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
    if (res.ok) sent++;
    else failures.push({ email: sub.email, error: res.error ?? "unknown" });
  }

  if (failures.length > 0) {
    console.error("[cron:send-digest] failures", failures);
  }
  console.log(`[cron:send-digest] posts=${normalized.length} sent=${sent} failed=${failures.length}`);

  return NextResponse.json({
    ok: true,
    posts: normalized.length,
    subscribers: subscribers.length,
    sent,
    failed: failures.length,
    weekLabel,
  });
}
