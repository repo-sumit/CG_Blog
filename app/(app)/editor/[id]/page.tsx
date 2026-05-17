import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireAuthor } from "@/lib/auth/guards";
import { listTags } from "@/lib/db/tags";
import { getPostById } from "@/lib/db/posts";
import { PostEditor } from "@/components/editor/PostEditor";
import { publicEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit post" };
export const dynamic = "force-dynamic";

export default async function EditPostPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { profile, userId } = await requireAuthor();
  const [post, tags] = await Promise.all([getPostById(params.id), listTags()]);
  if (!post) notFound();
  if (post.author_id !== userId && profile.role !== "manager") {
    redirect("/me/posts");
  }

  // Resolve the cover asset's storage path so the editor can render a preview
  // without an extra client fetch. RLS scopes media_assets to the owner; if
  // the row is missing (asset deleted out from under the post), we silently
  // fall back to "no cover".
  let cover: { id: string; url: string } | null = null;
  if (post.cover_media_id) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("media_assets")
      .select("id, storage_path")
      .eq("id", post.cover_media_id)
      .maybeSingle();
    const path = (data as { storage_path?: string | null } | null)?.storage_path;
    if (path) {
      cover = { id: post.cover_media_id, url: `/api/media/file?path=${encodeURIComponent(path)}` };
    }
  }

  return (
    <PostEditor
      role={profile.role}
      tags={tags}
      requireReview={publicEnv.requireManagerReview}
      initialPost={{
        ...post,
        tag_ids: post.tags.map((t) => t.id),
        cover,
      }}
    />
  );
}
