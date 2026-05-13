import "server-only";
import { format } from "date-fns";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { sendEmail } from "@/lib/email/resend";
import { postNotificationTemplate } from "@/lib/email/templates";

interface NewsletterResult {
  ok: boolean;
  skipped?: "already_sent" | "not_published" | "no_subscribers" | "not_configured";
  attempted?: number;
  sent?: number;
  failed?: number;
  error?: string;
}

const COVER_BUCKET = "blog-media";
const COVER_SIGNED_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days — long enough for inbox retention.

/**
 * Extracts the first paragraph of plain text from a Tiptap-generated HTML
 * body. Strips tags, collapses whitespace, takes everything up to the first
 * empty line (a paragraph break in our renderer is `</p><p>`).
 *
 * Lossy by design — newsletter previews want the gist, not the formatting.
 */
function extractFirstParagraph(html: string, maxChars = 320): string | null {
  if (!html) return null;
  // Pull the first `<p>…</p>` block; ProseMirror wraps paragraphs that way.
  const match = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(html);
  if (!match) return null;
  const raw = match[1] ?? "";
  const text = raw
    .replace(/<[^>]+>/g, "") // strip nested tags (strong, em, etc.)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
}

/**
 * Sends the per-post newsletter to every active subscriber, EXACTLY ONCE.
 *
 * Idempotency: we claim the dispatch by stamping `newsletter_sent_at` BEFORE
 * sending, using a conditional update. If another worker stamps it first, the
 * UPDATE affects 0 rows and we bail out — preventing duplicate emails when
 * Post Now and the publish-scheduled cron race on the same post.
 *
 * Delivery is per-recipient: one Resend call per subscriber so each gets a
 * unique `unsubscribe_token` in their email + List-Unsubscribe header. We
 * never short-circuit on a single failure — failures get logged and the loop
 * carries on so a bad address doesn't block deliveries to everyone else.
 *
 * IMPORTANT: Resend's free tier with `onboarding@resend.dev` as `from` only
 * delivers to the email that owns the Resend account. Mail to every other
 * subscriber gets returned as a 403 — that's why "only I receive the email"
 * happens when domain verification isn't done. See
 * docs/newsletter-delivery-debug.md for the fix.
 */
export async function sendPerPostNewsletter(postId: string): Promise<NewsletterResult> {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) {
    // No-op when Resend isn't configured. The publish flow keeps working.
    return { ok: true, skipped: "not_configured" };
  }

  const service = createSupabaseServiceClient();

  // Fetch the post + author + cover media path so the email can show a
  // thumbnail. Single query — Supabase resolves the FK joins.
  const { data: postRow } = await service
    .from("posts")
    .select(
      "id, title, slug, excerpt, content_html, status, published_at, read_time_minutes, newsletter_sent_at, cover_media_id, author:profiles!posts_author_id_fkey(full_name, email)",
    )
    .eq("id", postId)
    .maybeSingle();

  type AuthorJoin = { full_name: string | null; email: string };
  const post = postRow as
    | {
        id: string;
        title: string;
        slug: string;
        excerpt: string | null;
        content_html: string | null;
        status: string;
        published_at: string | null;
        read_time_minutes: number;
        newsletter_sent_at: string | null;
        cover_media_id: string | null;
        author: AuthorJoin | AuthorJoin[] | null;
      }
    | null;

  if (!post) return { ok: false, error: "Post not found." };
  if (post.status !== "published") return { ok: true, skipped: "not_published" };
  if (post.newsletter_sent_at) return { ok: true, skipped: "already_sent" };

  // CRITICAL: stamp newsletter_sent_at as a conditional update BEFORE we
  // send. If two callers race (Post Now + cron), only the first wins.
  const claimedAt = new Date().toISOString();
  const { data: claimed, error: claimErr } = await service
    .from("posts")
    .update({ newsletter_sent_at: claimedAt })
    .eq("id", postId)
    .is("newsletter_sent_at", null)
    .select("id");
  if (claimErr) return { ok: false, error: claimErr.message };
  if (!claimed || claimed.length === 0) {
    return { ok: true, skipped: "already_sent" };
  }

  // Pull EVERY active subscriber. We deliberately fetch the full list rather
  // than streaming — at our scale (single/double digits today, low-100s on
  // the projected growth curve) the round-trip cost is negligible and a
  // single batch keeps logs simple.
  const { data: subs, error: subsErr } = await service
    .from("subscribers")
    .select("email, unsubscribe_token")
    .is("unsubscribed_at", null);
  if (subsErr) return { ok: false, error: subsErr.message };
  const subscribers = (subs ?? []) as { email: string; unsubscribe_token: string }[];
  console.log(`[newsletter:${postId}] starting · ${subscribers.length} subscribers`);
  if (subscribers.length === 0) return { ok: true, skipped: "no_subscribers" };

  // Resolve a public cover URL for the email. Long-lived signed URL because
  // emails sit in inboxes and image hosts get hit days later. If the post
  // has no cover or the media row is missing, `coverUrl` stays null and the
  // template renders a brand-coloured placeholder block.
  let coverUrl: string | null = null;
  if (post.cover_media_id) {
    const { data: mediaRow } = await service
      .from("media_assets")
      .select("storage_path")
      .eq("id", post.cover_media_id)
      .maybeSingle();
    const path = (mediaRow as { storage_path?: string | null } | null)?.storage_path;
    if (path) {
      const { data: signed } = await service.storage
        .from(COVER_BUCKET)
        .createSignedUrl(path, COVER_SIGNED_TTL_SECONDS);
      coverUrl = signed?.signedUrl ?? null;
    }
  }

  // Author display name. Supabase types FK joins as arrays even when singleton.
  const a = Array.isArray(post.author) ? post.author[0] : post.author;
  const authorHandle = a?.email?.split("@")[0] ?? "ConveGenius team";
  const authorName = a?.full_name?.trim() || authorHandle;

  const dayLabel = format(
    post.published_at ? new Date(post.published_at) : new Date(),
    "MMM d, yyyy",
  ).toUpperCase();

  const firstParagraph = extractFirstParagraph(post.content_html ?? "");

  let sent = 0;
  const failures: { email: string; error: string }[] = [];

  for (const sub of subscribers) {
    const unsubscribeUrl = `${publicEnv.appUrl}/api/subscribe/unsubscribe?t=${sub.unsubscribe_token}`;
    const tpl = postNotificationTemplate({
      appUrl: publicEnv.appUrl,
      unsubscribeUrl,
      dayLabel,
      post: {
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        firstParagraph,
        authorName,
        readTimeMinutes: post.read_time_minutes,
        coverUrl,
      },
    });
    // Per-recipient send. We DON'T short-circuit on failure — a bad
    // address shouldn't block delivery to everyone else.
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
    if (res.ok) {
      sent++;
    } else {
      failures.push({ email: sub.email, error: res.error ?? "unknown" });
    }
  }

  if (failures.length > 0) {
    console.error(`[newsletter:${postId}] ${failures.length} failures`, failures);
  }
  console.log(
    `[newsletter:${postId}] done · attempted=${subscribers.length} sent=${sent} failed=${failures.length}`,
  );
  return { ok: true, attempted: subscribers.length, sent, failed: failures.length };
}
