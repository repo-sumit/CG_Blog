import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { PostRow, ProfileRow, TagRow } from "@/lib/db/types";
import { REACTION_EMOJIS, type ReactionEmoji } from "@/lib/reactions";

// Re-export the reaction constants so existing callers of `@/lib/db/public`
// keep working. The real definition is in `@/lib/reactions` (no server-only),
// which lets client components import it without tainting their bundle.
export { REACTION_EMOJIS, type ReactionEmoji } from "@/lib/reactions";

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
  /** Aggregate post_views count — server-computed, never inferred client-side. */
  viewCount: number;
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
    viewCount: 0, // back-filled by `attachViewCounts` after the join.
  };
}

/**
 * Stitches `post_views` counts onto an already-fetched list of public posts.
 * One round-trip per call regardless of list size — we group-count in a single
 * query using Supabase's foreign-table aggregate. The counts table is RLS-
 * protected (admin + author), so we use the service client.
 */
async function attachViewCounts(posts: PublicPost[]): Promise<PublicPost[]> {
  if (posts.length === 0) return posts;
  const service = createSupabaseServiceClient();
  const ids = posts.map((p) => p.id);
  // Pull every view row for the requested posts and aggregate in JS — fine
  // for our scale (single-digit-thousands of views per post).
  const { data, error } = await service
    .from("post_views")
    .select("post_id")
    .in("post_id", ids);
  if (error) {
    console.error("[attachViewCounts]", error);
    return posts;
  }
  const tally = new Map<string, number>();
  for (const r of (data ?? []) as { post_id: string }[]) {
    tally.set(r.post_id, (tally.get(r.post_id) ?? 0) + 1);
  }
  return posts.map((p) => ({ ...p, viewCount: tally.get(p.id) ?? 0 }));
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
  const posts = (data ?? []).map((r: unknown) => normalize(r as Record<string, unknown>));
  return attachViewCounts(posts);
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
  const post = normalize(data as Record<string, unknown>);
  const [withCount] = await attachViewCounts([post]);
  return withCount ?? post;
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
    // Supabase may type joined relations as arrays even when they're singletons.
    // Cast through `unknown` to bypass the overlap check, then normalize.
    const raw = (row as unknown as {
      tag?: { id?: string; name?: string; slug?: string } | { id?: string; name?: string; slug?: string }[] | null;
    }).tag;
    const t = Array.isArray(raw) ? raw[0] : raw;
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
    // Supabase types FK joins as arrays even when the relationship is
    // singleton; at runtime it's a single object. Normalize both shapes.
    const raw = (row as unknown as { author?: PublicAuthor | PublicAuthor[] | null }).author;
    const a = Array.isArray(raw) ? raw[0] : raw;
    if (a?.id && !seen.has(a.id)) seen.set(a.id, a);
  }
  return Array.from(seen.values());
}

// ============================================================
// Contributor stats — fuels the landing page contributor cards
// ============================================================

export interface ContributorStats {
  /** The profile (may be null if author profile is missing). */
  profile: PublicAuthor;
  /** Total number of published posts by this contributor. */
  postCount: number;
  /** Most recent published post (title + slug + published_at), or null. */
  latestPost: { title: string; slug: string; published_at: string | null } | null;
  /** Unique tag names across all their published posts (sorted by frequency). */
  topics: string[];
}

/**
 * Loads stats for every member of the team allowlist — even those with zero
 * published posts. This way the contributor section always shows the full
 * crew, not just the ones who've posted.
 *
 * Joins posts → tags → profile, aggregates per author. Cheap enough at our
 * scale that we don't bother with a SQL view.
 */
export async function listContributorStats(): Promise<ContributorStats[]> {
  const service = createSupabaseServiceClient();

  // 1. All editor profiles (author + manager) from the allowlist.
  const { data: profileRows } = await service
    .from("profiles")
    .select("id, full_name, email, avatar_url, role")
    .in("role", ["author", "manager"])
    .order("full_name", { ascending: true });

  const profiles = (profileRows ?? []) as unknown as PublicAuthor[];
  if (profiles.length === 0) return [];

  // 2. All published posts authored by them, with their tags.
  const authorIds = profiles.map((p) => p.id);
  const { data: postRows } = await service
    .from("posts")
    .select("id, title, slug, author_id, published_at, tags:post_tags(tag:tags(name))")
    .eq("status", "published")
    .in("author_id", authorIds)
    .order("published_at", { ascending: false });

  const posts = (postRows ?? []) as unknown as Array<{
    id: string;
    title: string;
    slug: string;
    author_id: string;
    published_at: string | null;
    tags: { tag: { name: string } | { name: string }[] | null }[] | null;
  }>;

  // 3. Aggregate per author.
  const byAuthor = new Map<string, { count: number; latest: typeof posts[number] | null; topicCounts: Map<string, number> }>();
  for (const p of profiles) byAuthor.set(p.id, { count: 0, latest: null, topicCounts: new Map() });

  for (const post of posts) {
    const slot = byAuthor.get(post.author_id);
    if (!slot) continue;
    slot.count += 1;
    if (!slot.latest) slot.latest = post; // posts are already ordered desc
    for (const t of post.tags ?? []) {
      const tagObj = Array.isArray(t.tag) ? t.tag[0] : t.tag;
      const name = tagObj?.name;
      if (name) slot.topicCounts.set(name, (slot.topicCounts.get(name) ?? 0) + 1);
    }
  }

  return profiles.map((profile) => {
    const slot = byAuthor.get(profile.id)!;
    const topics = Array.from(slot.topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name)
      .slice(0, 4);
    return {
      profile,
      postCount: slot.count,
      latestPost: slot.latest
        ? {
            title: slot.latest.title,
            slug: slot.latest.slug,
            published_at: slot.latest.published_at,
          }
        : null,
      topics,
    };
  });
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
