"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/guards";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { REACTION_EMOJIS, type ReactionEmoji } from "@/lib/db/public";
import { isManager } from "@/lib/auth/roles";

// ------------------------------------------------------------------
// addComment
// ------------------------------------------------------------------
const AddCommentInput = z.object({
  postId: z.string().uuid(),
  body: z.string().trim().min(1, "Comment cannot be empty.").max(100, "Comment must be 100 characters or less."),
});

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function addComment(input: { postId: string; body: string }): Promise<ActionResult> {
  const parsed = AddCommentInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid comment." };
  }

  const { userId, profile, email } = await requireSession();
  const service = createSupabaseServiceClient();

  // Ensure the post exists and is published — never accept comments on drafts.
  const { data: post } = await service
    .from("posts")
    .select("id, slug, status")
    .eq("id", parsed.data.postId)
    .maybeSingle();
  if (!post || (post as { status: string }).status !== "published") {
    return { ok: false, error: "Comments are only allowed on published posts." };
  }

  // Snapshot author identity so future profile changes/deletions don't erase
  // the discussion. Author name falls back to the part before the @ in the
  // email if the profile has no display name (typical for fresh signups).
  const authorName = profile.full_name?.trim() || email.split("@")[0];

  const { error } = await service.from("comments").insert({
    post_id: parsed.data.postId,
    user_id: userId,
    author_name: authorName,
    author_avatar_url: profile.avatar_url ?? null,
    body: parsed.data.body.trim(),
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/posts/${(post as { slug: string }).slug}`);
  return { ok: true };
}

// ------------------------------------------------------------------
// deleteComment — soft delete
// ------------------------------------------------------------------
export async function deleteComment(commentId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(commentId);
  if (!parsed.success) return { ok: false, error: "Invalid comment id." };

  const { userId, profile } = await requireSession();
  const service = createSupabaseServiceClient();

  // Resolve comment + the host post so we can authorize.
  const { data: row } = await service
    .from("comments")
    .select("id, user_id, post:posts!inner(author_id, slug)")
    .eq("id", parsed.data)
    .maybeSingle();
  if (!row) return { ok: false, error: "Comment not found." };

  const commentRow = row as unknown as {
    id: string;
    user_id: string;
    post: { author_id: string; slug: string };
  };

  const isCommentAuthor = commentRow.user_id === userId;
  const isPostAuthor = commentRow.post.author_id === userId;
  const isAdmin = isManager(profile.role);
  if (!isCommentAuthor && !isPostAuthor && !isAdmin) {
    return { ok: false, error: "You can't delete this comment." };
  }

  const { error } = await service
    .from("comments")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("id", parsed.data);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/posts/${commentRow.post.slug}`);
  return { ok: true };
}

// ------------------------------------------------------------------
// toggleReaction
// ------------------------------------------------------------------
const ToggleReactionInput = z.object({
  postId: z.string().uuid(),
  emoji: z.enum(REACTION_EMOJIS as unknown as [ReactionEmoji, ...ReactionEmoji[]]),
});

export async function toggleReaction(input: { postId: string; emoji: ReactionEmoji }): Promise<ActionResult> {
  const parsed = ToggleReactionInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid reaction." };

  const { userId } = await requireSession();
  const service = createSupabaseServiceClient();

  const { data: post } = await service
    .from("posts")
    .select("status, slug")
    .eq("id", parsed.data.postId)
    .maybeSingle();
  if (!post || (post as { status: string }).status !== "published") {
    return { ok: false, error: "Reactions are only allowed on published posts." };
  }

  // Check if the user already reacted with this emoji — if so, remove it.
  // Otherwise insert. UNIQUE(post, user, emoji) makes this safe even under
  // concurrent toggles.
  const { data: existing } = await service
    .from("reactions")
    .select("id")
    .eq("post_id", parsed.data.postId)
    .eq("user_id", userId)
    .eq("emoji", parsed.data.emoji)
    .maybeSingle();

  if (existing) {
    const { error } = await service.from("reactions").delete().eq("id", (existing as { id: string }).id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await service.from("reactions").insert({
      post_id: parsed.data.postId,
      user_id: userId,
      emoji: parsed.data.emoji,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/posts/${(post as { slug: string }).slug}`);
  return { ok: true };
}
