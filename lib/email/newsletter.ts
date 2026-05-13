import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { sendEmail } from "@/lib/email/resend";
import { digestTemplate } from "@/lib/email/templates";
import { formatWeekRange } from "@/lib/utils/dates";

interface NewsletterResult {
  ok: boolean;
  skipped?: "already_sent" | "not_published" | "no_subscribers" | "not_configured";
  attempted?: number;
  sent?: number;
  failed?: number;
  error?: string;
}

/**
 * Sends the per-post newsletter to every active subscriber, EXACTLY ONCE.
 *
 * Idempotency: we claim the dispatch by stamping `newsletter_sent_at` BEFORE
 * sending, using a conditional update. If another worker stamps it first, the
 * UPDATE affects 0 rows and we bail out — preventing duplicate emails when
 * Post Now and the publish-scheduled cron race on the same post.
 *
 * Safe to call from anywhere; the function is its own gate. Both call sites
 * (`savePost` after Post Now and the publish-scheduled cron) just `void` the
 * promise — never block the editor on the email round-trip.
 */
export async function sendPerPostNewsletter(postId: string): Promise<NewsletterResult> {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) {
    // No-op when Resend isn't configured. The publish flow keeps working.
    return { ok: true, skipped: "not_configured" };
  }

  const service = createSupabaseServiceClient();

  // Fetch the post and its author. We need a published post — anything else
  // is a bug in the caller.
  const { data: postRow } = await service
    .from("posts")
    .select("id, title, slug, excerpt, status, published_at, read_time_minutes, newsletter_sent_at, author:profiles!posts_author_id_fkey(full_name, email)")
    .eq("id", postId)
    .maybeSingle();

  type AuthorJoin = { full_name: string | null; email: string };
  const post = postRow as
    | {
        id: string;
        title: string;
        slug: string;
        excerpt: string | null;
        status: string;
        published_at: string | null;
        read_time_minutes: number;
        newsletter_sent_at: string | null;
        author: AuthorJoin | AuthorJoin[] | null;
      }
    | null;

  if (!post) return { ok: false, error: "Post not found." };
  if (post.status !== "published") return { ok: true, skipped: "not_published" };
  if (post.newsletter_sent_at) return { ok: true, skipped: "already_sent" };

  // CRITICAL: stamp newsletter_sent_at as a conditional update BEFORE we send.
  // If two callers race (e.g. Post Now + the cron), only the first wins and
  // proceeds to send; the loser sees 0 rows updated and exits early.
  const claimedAt = new Date().toISOString();
  const { data: claimed, error: claimErr } = await service
    .from("posts")
    .update({ newsletter_sent_at: claimedAt })
    .eq("id", postId)
    .is("newsletter_sent_at", null)
    .select("id");
  if (claimErr) return { ok: false, error: claimErr.message };
  if (!claimed || claimed.length === 0) {
    // Someone else already claimed the dispatch — that's fine.
    return { ok: true, skipped: "already_sent" };
  }

  // Pull active subscribers.
  const { data: subs, error: subsErr } = await service
    .from("subscribers")
    .select("email, unsubscribe_token")
    .is("unsubscribed_at", null);
  if (subsErr) return { ok: false, error: subsErr.message };
  const subscribers = (subs ?? []) as { email: string; unsubscribe_token: string }[];
  if (subscribers.length === 0) return { ok: true, skipped: "no_subscribers" };

  // Author display name. Supabase types FK joins as arrays even when singleton.
  const a = Array.isArray(post.author) ? post.author[0] : post.author;
  const authorHandle = a?.email?.split("@")[0] ?? "ConveGenius team";
  const authorName = a?.full_name?.trim() || authorHandle;

  const weekLabel = formatWeekRange().toUpperCase();
  let sent = 0;
  const failures: { email: string; error: string }[] = [];

  for (const sub of subscribers) {
    const unsubscribeUrl = `${publicEnv.appUrl}/api/subscribe/unsubscribe?t=${sub.unsubscribe_token}`;
    const tpl = digestTemplate({
      appUrl: publicEnv.appUrl,
      unsubscribeUrl,
      weekLabel,
      posts: [
        {
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          publishedAt: post.published_at,
          readTimeMinutes: post.read_time_minutes,
          authorName,
        },
      ],
    });
    if (!tpl) continue;
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
    console.error(`[newsletter:${postId}] failures`, failures);
  }
  return { ok: true, attempted: subscribers.length, sent, failed: failures.length };
}
