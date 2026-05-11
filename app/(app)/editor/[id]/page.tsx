import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireAuthor } from "@/lib/auth/guards";
import { listTags } from "@/lib/db/tags";
import { getPostById } from "@/lib/db/posts";
import { PostEditor } from "@/components/editor/PostEditor";
import { publicEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Edit post" };
export const dynamic = "force-dynamic";

export default async function EditPostPage({ params }: { params: { id: string } }) {
  const { profile, userId } = await requireAuthor();
  const [post, tags] = await Promise.all([getPostById(params.id), listTags()]);
  if (!post) notFound();
  if (post.author_id !== userId && profile.role !== "manager") {
    redirect("/me/posts");
  }
  return (
    <PostEditor
      role={profile.role}
      tags={tags}
      requireReview={publicEnv.requireManagerReview}
      initialPost={{
        ...post,
        tag_ids: post.tags.map((t) => t.id),
      }}
    />
  );
}
