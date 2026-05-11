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

const SavePostSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1, "Title is required").max(160),
  excerpt: z.string().max(500).optional().nullable(),
  content_json: z.unknown(),
  content_html: z.string().default(""),
  status: z.enum(["draft", "submitted", "scheduled", "published", "archived"]).default("draft"),
  assigned_weekday: z.number().int().min(1).max(5).nullable().optional(),
  scheduled_for: z.string().datetime().nullable().optional(),
  tag_ids: z.array(z.string().uuid()).optional(),
});

export type SavePostInput = z.infer<typeof SavePostSchema>;

export interface SavePostResult {
  ok: boolean;
  id?: string;
  slug?: string;
  status?: string;
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

export async function savePost(input: SavePostInput): Promise<SavePostResult> {
  const parsed = SavePostSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join(".")] = issue.message;
    }
    return { ok: false, error: "Invalid input.", fieldErrors };
  }

  const { userId, profile } = await requireSession();
  if (profile.role !== "author" && profile.role !== "manager") {
    return { ok: false, error: "You don't have permission to author posts." };
  }

  const data = parsed.data;
  const supabase = createSupabaseServerClient();
  const html = sanitizeHtml(data.content_html ?? "");
  const readTime = readTimeFromHtml(html);

  // Determine desired status; enforce review workflow if enabled.
  let desiredStatus = data.status;
  if (publicEnv.requireManagerReview && profile.role === "author" && desiredStatus === "published") {
    desiredStatus = "submitted";
  }

  let postId = data.id;
  let slug: string;

  if (postId) {
    // Update path. Verify author ownership / manager.
    const { data: existing, error: fetchErr } = await supabase
      .from("posts")
      .select("id, slug, author_id, status, title")
      .eq("id", postId)
      .maybeSingle();
    if (fetchErr || !existing) return { ok: false, error: "Post not found." };
    if (existing.author_id !== userId && profile.role !== "manager") {
      return { ok: false, error: "You cannot edit this post." };
    }

    // If the title changed, regenerate a unique slug — otherwise keep stable.
    slug = existing.slug as string;
    if ((existing.title as string).trim() !== data.title.trim()) {
      slug = await ensureUniqueSlug(slugify(data.title), postId);
    }

    const update: Record<string, unknown> = {
      title: data.title,
      slug,
      excerpt: data.excerpt ?? null,
      content_json: data.content_json,
      content_html: html,
      status: desiredStatus,
      assigned_weekday: data.assigned_weekday ?? profile.weekly_post_day ?? null,
      scheduled_for: data.scheduled_for ?? null,
      read_time_minutes: readTime,
    };
    if (desiredStatus === "published" && !((existing as { published_at?: string | null }).published_at)) {
      update.published_at = new Date().toISOString();
    }
    if (desiredStatus === "archived") update.archived_at = new Date().toISOString();

    const { error: updErr } = await supabase.from("posts").update(update).eq("id", postId);
    if (updErr) return { ok: false, error: updErr.message };

    // Re-sync tags.
    if (data.tag_ids) {
      await supabase.from("post_tags").delete().eq("post_id", postId);
      if (data.tag_ids.length > 0) {
        await supabase
          .from("post_tags")
          .insert(data.tag_ids.map((tag_id) => ({ post_id: postId, tag_id })));
      }
    }
  } else {
    slug = await ensureUniqueSlug(slugify(data.title));
    const insert: Record<string, unknown> = {
      author_id: userId,
      title: data.title,
      slug,
      excerpt: data.excerpt ?? null,
      content_json: data.content_json,
      content_html: html,
      status: desiredStatus,
      week_start_date: weekStartISO(),
      assigned_weekday: data.assigned_weekday ?? profile.weekly_post_day ?? null,
      scheduled_for: data.scheduled_for ?? null,
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

  revalidatePath("/");
  revalidatePath(`/posts/${slug}`);
  revalidatePath("/me/posts");
  revalidatePath("/dashboard");

  return { ok: true, id: postId, slug, status: desiredStatus };
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
 * Soft delete: mark as archived. Recoverable for 30 days via `restorePost`.
 * After 30 days, the cron at /api/cron/cleanup-archived hard-deletes the row.
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
 * Permanent delete — manager-only. Used both by the admin UI and by the
 * cron that purges posts past their 30-day archival window.
 */
export async function permanentDeletePost(id: string): Promise<SavePostResult> {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid post id." };
  const { profile } = await requireSession();
  if (profile.role !== "manager") {
    return { ok: false, error: "Only admins can permanently delete posts." };
  }
  const supabase = createSupabaseServerClient();
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
