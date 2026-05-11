import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { PostRow, ProfileRow, TagRow } from "@/lib/db/types";

/**
 * Public reading layer. These helpers use the service-role client so anyone
 * (signed-in or anonymous) can read published posts on the public landing
 * and post-detail pages, even though RLS otherwise restricts row visibility
 * to @convegenius.ai users.
 *
 * SECURITY RULES:
 *  - Every query MUST be hard-pinned to `status = 'published'`.
 *  - We only project the fields needed for public rendering — never the raw
 *    Tiptap JSON for drafts, never private metadata.
 *  - Service-role bypasses RLS, so any new helper here is responsible for its
 *    own access control. Keep the surface tight.
 */

type PublicAuthor = Pick<ProfileRow, "id" | "full_name" | "email" | "avatar_url" | "role">;

export interface PublicPost extends PostRow {
  author: PublicAuthor | null;
  tags: Pick<TagRow, "id" | "name" | "slug">[];
}

const PUBLIC_SELECT = `
  id, author_id, title, slug, excerpt, content_html,
  week_start_date, assigned_weekday, published_at, read_time_minutes,
  created_at, updated_at, status, scheduled_for, archived_at,
  cover_media_id, content_json,
  author:profiles!posts_author_id_fkey ( id, full_name, email, avatar_url, role ),
  tags:post_tags ( tag:tags ( id, name, slug ) )
`;

function normalize(row: Record<string, unknown>): PublicPost {
  const tagsRaw = Array.isArray(row.tags) ? row.tags : [];
  const tags = tagsRaw
    .map((e) => {
      const t = (e as { tag?: unknown })?.tag;
      if (!t || typeof t !== "object") return null;
      const obj = t as Record<string, unknown>;
      if (typeof obj.id !== "string" || typeof obj.name !== "string" || typeof obj.slug !== "string") return null;
      return { id: obj.id, name: obj.name, slug: obj.slug };
    })
    .filter((t): t is { id: string; name: string; slug: string } => t !== null);
  const a = row.author as Record<string, unknown> | null;
  return {
    ...(row as unknown as PostRow),
    author: a
      ? {
          id: String(a.id ?? ""),
          full_name: (a.full_name as string | null) ?? null,
          email: String(a.email ?? ""),
          avatar_url: (a.avatar_url as string | null) ?? null,
          role: ((a.role as "manager" | "author" | "viewer" | undefined) ?? "viewer") as PublicAuthor["role"],
        }
      : null,
    tags,
  };
}

export async function listPublicPosts(limit = 30): Promise<PublicPost[]> {
  const service = createSupabaseServiceClient();
  const { data, error } = await service
    .from("posts")
    .select(PUBLIC_SELECT)
    .eq("status", "published") // SECURITY: never leak non-published rows.
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[listPublicPosts]", error);
    return [];
  }
  return (data ?? []).map((r) => normalize(r as Record<string, unknown>));
}

export async function getPublicPostBySlug(slug: string): Promise<PublicPost | null> {
  const service = createSupabaseServiceClient();
  const { data, error } = await service
    .from("posts")
    .select(PUBLIC_SELECT)
    .eq("slug", slug)
    .eq("status", "published") // SECURITY: drafts are not addressable via this route.
    .maybeSingle();
  if (error || !data) return null;
  return normalize(data as Record<string, unknown>);
}

export async function listPublicTags(): Promise<{ id: string; name: string; slug: string }[]> {
  const service = createSupabaseServiceClient();
  // Only return tags actually used by at least one published post — keeps the
  // category strip from showing empty/dead tags.
  const { data, error } = await service
    .from("post_tags")
    .select("tag:tags(id, name, slug), post:posts!inner(status)")
    .eq("post.status", "published");
  if (error) {
    console.error("[listPublicTags]", error);
    return [];
  }
  const seen = new Map<string, { id: string; name: string; slug: string }>();
  for (const row of data ?? []) {
    const t = (row as { tag?: { id?: string; name?: string; slug?: string } }).tag;
    if (t?.id && t.name && t.slug && !seen.has(t.id)) {
      seen.set(t.id, { id: t.id, name: t.name, slug: t.slug });
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function listPublicAuthors(): Promise<PublicAuthor[]> {
  const service = createSupabaseServiceClient();
  // Authors who have at least one published post.
  const { data, error } = await service
    .from("posts")
    .select("author:profiles!posts_author_id_fkey(id, full_name, email, avatar_url, role)")
    .eq("status", "published");
  if (error) return [];
  const seen = new Map<string, PublicAuthor>();
  for (const row of data ?? []) {
    const a = (row as { author?: PublicAuthor | null }).author;
    if (a?.id && !seen.has(a.id)) seen.set(a.id, a);
  }
  return Array.from(seen.values());
}

// ============================================================
// Comments + reactions (public reads)
// ============================================================

export interface PublicComment {
  id: string;
  post_id: string;
  user_id: string;
  author_name: string;
  author_avatar_url: string | null;
  body: string;
  created_at: string;
}

export async function listComments(postId: string): Promise<PublicComment[]> {
  const service = createSupabaseServiceClient();
  const { data, error } = await service
    .from("comments")
    .select("id, post_id, user_id, author_name, author_avatar_url, body, created_at")
    .eq("post_id", postId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[listComments]", error);
    return [];
  }
  return (data ?? []) as unknown as PublicComment[];
}

export const REACTION_EMOJIS = ["👍", "❤️", "😂", "🎉", "👀", "🚀"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export async function listReactionCounts(postId: string): Promise<Record<ReactionEmoji, number>> {
  const service = createSupabaseServiceClient();
  const { data, error } = await service
    .from("reactions")
    .select("emoji")
    .eq("post_id", postId);
  const out: Record<string, number> = {};
  for (const e of REACTION_EMOJIS) out[e] = 0;
  if (error) {
    console.error("[listReactionCounts]", error);
    return out as Record<ReactionEmoji, number>;
  }
  for (const r of data ?? []) {
    const e = (r as { emoji: string }).emoji;
    if ((REACTION_EMOJIS as readonly string[]).includes(e)) {
      out[e] = (out[e] ?? 0) + 1;
    }
  }
  return out as Record<ReactionEmoji, number>;
}

export async function listMyReactions(postId: string, userId: string): Promise<ReactionEmoji[]> {
  const service = createSupabaseServiceClient();
  const { data, error } = await service
    .from("reactions")
    .select("emoji")
    .eq("post_id", postId)
    .eq("user_id", userId);
  if (error) {
    console.error("[listMyReactions]", error);
    return [];
  }
  return ((data ?? []) as { emoji: string }[])
    .map((r) => r.emoji)
    .filter((e): e is ReactionEmoji => (REACTION_EMOJIS as readonly string[]).includes(e));
}
