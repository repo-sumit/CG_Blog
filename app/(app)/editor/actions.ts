"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/guards";
import { slugify, withSuffix } from "@/lib/utils/slugs";
import { weekStartISO } from "@/lib/utils/dates";
import { readTimeFromHtml } from "@/lib/utils/read-time";
import { sanitizeHtml } from "@/lib/editor/sanitize";
import { publicEnv } from "@/lib/env";
import { WEEKLY_TEMPLATE } from "@/lib/editor/template";
import { sendPerPostNewsletter } from "@/lib/email/newsletter";

const SavePostSchema = z.object({
  id: z.string().uuid().optional(),
  // Drafts may save with no title (autosave while the user is still typing);
  // the client decides whether a save can promote a draft to a publishable
  // status. We enforce a non-empty title at publish time below instead of in
  // the schema.
  title: z.string().max(160).default(""),
  excerpt: z.string().max(500).optional().nullable(),
  content_json: z.unknown(),
  content_html: z.string().default(""),
  status: z.enum(["draft", "submitted", "scheduled", "published", "archived"]).default("draft"),
  // `scheduled_for` is now an explicit input from the Schedule Post modal.
  // The server only writes it when status === "scheduled".
  scheduled_for: z.string().datetime().nullable().optional(),
  cover_media_id: z.string().uuid().nullable().optional(),
  tag_ids: z.array(z.string().uuid()).optional(),
});

export type SavePostInput = z.infer<typeof SavePostSchema>;

export interface SavePostResult {
  ok: boolean;
  id?: string;
  slug?: string;
  status?: string;
  /** ISO timestamp the post will go live at — only set when status==='scheduled'. */
  scheduledFor?: string | null;
  error?: string;
  fieldErrors?: Record<string, string>;
}

async function ensureUniqueSlug(base: string, currentId?: string): Promise<string> {
  const supabase = createSupabaseServerClient();
  let candidate = base;
  for (let i = 0; i < 6; i++) {
    const q = supabase.from("posts").select("id").eq("slug", candidate).limit(1);
    const { data } = await q;
    const conflict = (data ?? []).find((r) => (r as { id: string }).id !== currentId);
    if (!conflict) return candidate;
    candidate = withSuffix(base, Math.random().toString(36).slice(2, 6));
  }
  return withSuffix(base, Date.now().toString(36));
}

/**
 * Lightweight timing logger gated by SAVE_POST_TIMING_LOG=1. Off by default so
 * production function logs don't fill with timing chatter. Flip the env in
 * Vercel to debug a regression — output is one line per save, no PII.
 */
function timed(label: string, startedAt: number): number {
  const elapsed = Math.round(performance.now() - startedAt);
  if (process.env.SAVE_POST_TIMING_LOG === "1") {
    console.log(`[savePost.timing] ${label}=${elapsed}ms`);
  }
  return elapsed;
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const aSorted = [...a].sort();
  const bSorted = [...b].sort();
  for (let i = 0; i < aSorted.length; i++) if (aSorted[i] !== bSorted[i]) return false;
  return true;
}

export async function savePost(input: SavePostInput): Promise<SavePostResult> {
  const totalStart = performance.now();
  const parsed = SavePostSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join(".")] = issue.message;
    }
    return { ok: false, error: "Invalid input.", fieldErrors };
  }
  const data = parsed.data;
  const supabase = createSupabaseServerClient();
  const html = sanitizeHtml(data.content_html ?? "");
  const readTime = readTimeFromHtml(html);
  const trimmedTitle = data.title.trim();

  // Title is required for anything beyond a draft. Drafts may save empty so
  // the autosave doesn't keep failing while the author is still typing.
  if (data.status !== "draft" && trimmedTitle.length === 0) {
    return {
      ok: false,
      error: "Title is required before publishing.",
      fieldErrors: { title: "Title is required." },
    };
  }

  // PARALLELIZE three reads: session+profile, the existing post row (when
  // editing), and the post's current tag set (so we can skip the re-sync when
  // unchanged). Before this change these ran serially after each other, which
  // cost 1 round-trip per read against Supabase (~100–200ms each).
  const readStart = performance.now();

  // Supabase's query builders return `PromiseLike`, not native `Promise`. We
  // wrap each one with `Promise.resolve(...)` so `Promise.all` can accept
  // them alongside `requireSession()` (a real `Promise`). The shape of each
  // resolved value is whatever the builder returns from `.then(...)`.
  const existingPromise = data.id
    ? Promise.resolve(
        supabase
          .from("posts")
          .select("id, slug, author_id, status, title")
          .eq("id", data.id)
          .maybeSingle(),
      ).then((res) => ({
        data: res.data as { id: string; slug: string; author_id: string; status: string; title: string } | null,
      }))
    : Promise.resolve({ data: null as { id: string; slug: string; author_id: string; status: string; title: string } | null });

  const tagsPromise = data.id && data.tag_ids
    ? Promise.resolve(
        supabase.from("post_tags").select("tag_id").eq("post_id", data.id),
      ).then((res) => ({ data: (res.data ?? []) as { tag_id: string }[] }))
    : Promise.resolve({ data: [] as { tag_id: string }[] });

  const coverPromise = data.cover_media_id
    ? Promise.resolve(
        supabase
          .from("media_assets")
          .select("owner_id, media_type")
          .eq("id", data.cover_media_id)
          .maybeSingle(),
      ).then((res) => ({ data: res.data as { owner_id: string; media_type: string } | null }))
    : Promise.resolve({ data: null as { owner_id: string; media_type: string } | null });

  const [{ userId, profile }, existingRes, tagsRes, coverRes] = await Promise.all([
    requireSession(),
    existingPromise,
    tagsPromise,
    coverPromise,
  ]);
  timed("auth+fetch", readStart);

  if (profile.role !== "author" && profile.role !== "manager") {
    return { ok: false, error: "You don't have permission to author posts." };
  }

  // Determine desired status. The new publish flow has three explicit verbs —
  // Save Draft, Schedule Post, Post Now — which set draft / scheduled / published
  // respectively. The optional manager-review gate still demotes a Post Now to
  // "submitted" for authors.
  let desiredStatus = data.status;
  if (publicEnv.requireManagerReview && profile.role === "author" && desiredStatus === "published") {
    desiredStatus = "submitted";
  }

  // Scheduling is now FULLY manual via the Schedule Post modal. We only honour
  // scheduled_for when the client explicitly set status === "scheduled", and
  // we enforce that the slot is in the future so authors can't backdate.
  let scheduledFor: string | null = null;
  if (desiredStatus === "scheduled") {
    if (!data.scheduled_for) {
      return {
        ok: false,
        error: "Pick a future date and time before scheduling.",
        fieldErrors: { scheduled_for: "Choose a future date and time." },
      };
    }
    const slot = new Date(data.scheduled_for).getTime();
    if (Number.isNaN(slot) || slot <= Date.now()) {
      return {
        ok: false,
        error: "Choose a future date and time.",
        fieldErrors: { scheduled_for: "Choose a future date and time." },
      };
    }
    scheduledFor = new Date(slot).toISOString();
  }

  // Cover ownership check — the supplied media_assets row must belong to this
  // user; otherwise we silently null it (safer than rejecting the whole save).
  let coverMediaId: string | null | undefined = data.cover_media_id;
  if (coverMediaId) {
    const c = coverRes.data;
    if (!c || c.owner_id !== userId || c.media_type !== "image") {
      coverMediaId = null;
    }
  }

  let postId = data.id;
  let slug: string;

  if (postId) {
    // Update path. We already have the existing row from the parallel fetch.
    const existing = existingRes.data;
    if (!existing) return { ok: false, error: "Post not found." };
    if (existing.author_id !== userId && profile.role !== "manager") {
      return { ok: false, error: "You cannot edit this post." };
    }

    // If the title changed, regenerate a unique slug — otherwise keep stable.
    slug = existing.slug;
    const existingTitle = (existing.title ?? "").trim();
    if (existingTitle !== trimmedTitle && trimmedTitle.length > 0) {
      slug = await ensureUniqueSlug(slugify(trimmedTitle), postId);
    }

    const update: Record<string, unknown> = {
      // Keep an empty draft title falling back to the existing one so the slug
      // stays valid; the schema column is NOT NULL.
      title: trimmedTitle || existingTitle || "Untitled draft",
      slug,
      excerpt: data.excerpt ?? null,
      content_json: data.content_json,
      content_html: html,
      status: desiredStatus,
      scheduled_for: scheduledFor,
      cover_media_id: coverMediaId ?? null,
      read_time_minutes: readTime,
    };
    if (desiredStatus === "published") {
      // Always stamp the publish time on "Post Now" so the public byline
      // matches the live moment, even if the post had a previous run as a
      // scheduled draft.
      update.published_at = new Date().toISOString();
    }
    // Clear published_at when a post moves back to scheduled or draft so the
    // live date reflects the next real publish, not an earlier run.
    if (desiredStatus === "scheduled" || desiredStatus === "draft") {
      update.published_at = null;
    }
    if (desiredStatus === "archived") update.archived_at = new Date().toISOString();

    const updateStart = performance.now();
    const { error: updErr } = await supabase.from("posts").update(update).eq("id", postId);
    timed("update", updateStart);
    if (updErr) return { ok: false, error: updErr.message };

    // Tag re-sync — but ONLY when the incoming set actually differs from
    // what's already attached. Skipping this in the unchanged case saves two
    // writes per save (delete + insert), which used to fire on every autosave.
    if (data.tag_ids) {
      const tagStart = performance.now();
      const currentTagIds = tagsRes.data.map((r) => r.tag_id);
      const incomingTagIds = data.tag_ids;
      if (!arraysEqual(currentTagIds, incomingTagIds)) {
        await supabase.from("post_tags").delete().eq("post_id", postId);
        if (incomingTagIds.length > 0) {
          await supabase
            .from("post_tags")
            .insert(incomingTagIds.map((tag_id) => ({ post_id: postId, tag_id })));
        }
        timed("tags", tagStart);
      } else {
        timed("tags_skipped", tagStart);
      }
    }
  } else {
    // An empty draft title needs a unique placeholder slug so the NOT NULL +
    // UNIQUE constraints hold. The slug rolls over to the real title on the
    // next save (the title-change branch above re-slugs).
    const titleForInsert = trimmedTitle || "Untitled draft";
    slug = await ensureUniqueSlug(slugify(titleForInsert));
    const insert: Record<string, unknown> = {
      author_id: userId,
      title: titleForInsert,
      slug,
      excerpt: data.excerpt ?? null,
      content_json: data.content_json,
      content_html: html,
      status: desiredStatus,
      week_start_date: weekStartISO(),
      // Assigned weekday is preserved for admin planning + analytics but no
      // longer drives publishing. We seed it from the author's profile so the
      // contributor board stays accurate.
      assigned_weekday: profile.weekly_post_day ?? null,
      scheduled_for: scheduledFor,
      cover_media_id: coverMediaId ?? null,
      read_time_minutes: readTime,
      published_at: desiredStatus === "published" ? new Date().toISOString() : null,
    };
    const { data: row, error } = await supabase
      .from("posts")
      .insert(insert)
      .select("id, slug")
      .single();
    if (error || !row) return { ok: false, error: error?.message ?? "Insert failed." };
    postId = (row as { id: string }).id;
    slug = (row as { slug: string }).slug;

    if (data.tag_ids && data.tag_ids.length > 0) {
      await supabase
        .from("post_tags")
        .insert(data.tag_ids.map((tag_id) => ({ post_id: postId, tag_id })));
    }
  }

  // Per-post newsletter — fired once when a post becomes "published". The DB
  // column newsletter_sent_at gates duplicates so re-saves never re-send.
  if (desiredStatus === "published" && postId) {
    // Fire-and-forget: never block the editor on the email round-trip. The
    // function itself is idempotent so a missed/retried call is safe.
    void sendPerPostNewsletter(postId).catch((err) => {
      console.error("[savePost] newsletter dispatch failed", err);
    });
  }

  // Conditional revalidation — drafts aren't public, so revalidating `/` or
  // `/posts/<slug>` on a draft save thrashes the cache for no benefit. We
  // only invalidate the surfaces a status actually affects.
  const revalStart = performance.now();
  if (desiredStatus === "published") {
    // Post just became public on Post Now.
    revalidatePath("/");
    revalidatePath(`/posts/${slug}`);
  }
  // Authored-side surfaces always reflect the new status / updated_at.
  revalidatePath("/me/posts");
  if (desiredStatus === "published" || desiredStatus === "scheduled" || desiredStatus === "submitted") {
    revalidatePath("/dashboard");
  }
  timed("revalidate", revalStart);
  timed("total", totalStart);

  return {
    ok: true,
    id: postId,
    slug,
    status: desiredStatus,
    scheduledFor: desiredStatus === "scheduled" ? scheduledFor : null,
  };
}

export async function createDraftFromTemplate(): Promise<SavePostResult> {
  return savePost({
    title: "Weekly Update",
    content_json: WEEKLY_TEMPLATE,
    content_html: "",
    status: "draft",
  });
}

/**
 * Soft delete: mark as archived. The post stays in /me/posts → Trash forever
 * (or until the author/admin permanently deletes it via `permanentDeletePost`).
 */
export async function softDeletePost(id: string): Promise<SavePostResult> {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid post id." };
  const { userId, profile } = await requireSession();
  const supabase = createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("posts")
    .select("author_id, slug, status")
    .eq("id", parsed.data)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Post not found." };
  if ((existing as { author_id: string }).author_id !== userId && profile.role !== "manager") {
    return { ok: false, error: "You can only delete your own posts." };
  }
  const { error } = await supabase
    .from("posts")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("id", parsed.data);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  revalidatePath("/me/posts");
  revalidatePath("/dashboard");
  return { ok: true, id: parsed.data, slug: (existing as { slug: string }).slug };
}

/** Restore a soft-deleted post back to draft state. */
export async function restorePost(id: string): Promise<SavePostResult> {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid post id." };
  const { userId, profile } = await requireSession();
  const supabase = createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("posts")
    .select("author_id, slug, status")
    .eq("id", parsed.data)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Post not found." };
  if ((existing as { author_id: string }).author_id !== userId && profile.role !== "manager") {
    return { ok: false, error: "You can only restore your own posts." };
  }
  if ((existing as { status: string }).status !== "archived") {
    return { ok: false, error: "Post is not archived." };
  }
  const { error } = await supabase
    .from("posts")
    .update({ status: "draft", archived_at: null })
    .eq("id", parsed.data);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/me/posts");
  revalidatePath("/dashboard");
  return { ok: true, id: parsed.data, slug: (existing as { slug: string }).slug };
}

/**
 * Permanent delete. The post owner can wipe their own archived posts from
 * trash, and managers can wipe anyone's. Archived posts live in trash
 * indefinitely — this is the only way they leave the database.
 */
export async function permanentDeletePost(id: string): Promise<SavePostResult> {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid post id." };
  const { userId, profile } = await requireSession();
  const supabase = createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("posts")
    .select("author_id, status")
    .eq("id", parsed.data)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Post not found." };
  const row = existing as { author_id: string; status: string };
  if (row.author_id !== userId && profile.role !== "manager") {
    return { ok: false, error: "You can only delete your own posts." };
  }
  if (row.status !== "archived" && profile.role !== "manager") {
    return { ok: false, error: "Move the post to trash first." };
  }
  // Cascade: post_tags rows are deleted by FK on cascade; media_assets keep
  // their rows but post_id becomes null (FK is on delete set null).
  const { error } = await supabase.from("posts").delete().eq("id", parsed.data);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  revalidatePath("/me/posts");
  return { ok: true, id: parsed.data };
}

/**
 * @deprecated Use softDeletePost — kept as an alias so old callers keep
 * compiling. Will be removed in a follow-up.
 */
export const archivePost = softDeletePost;
