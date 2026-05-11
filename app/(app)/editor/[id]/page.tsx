import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireAuthor } from "@/lib/auth/guards";
import { listTags } from "@/lib/db/tags";
import { getPostById } from "@/lib/db/posts";
import { PostEditor } from "@/components/editor/PostEditor";
import { BlocksPostEditor } from "@/components/editor/BlocksPostEditor";
import { publicEnv } from "@/lib/env";
import { BlocksArraySchema } from "@/lib/blocks";

export const metadata: Metadata = { title: "Edit post" };
export const dynamic = "force-dynamic";

export default async function EditPostPage({ params }: { params: { id: string } }) {
  const { profile, userId } = await requireAuthor();
  const [post, tags] = await Promise.all([getPostById(params.id), listTags()]);
  if (!post) notFound();
  if (post.author_id !== userId && profile.role !== "manager") {
    redirect("/me/posts");
  }

  // Pick editor based on what the post actually has stored.
  const parsedBlocks = BlocksArraySchema.safeParse(post.blocks);
  const hasBlocks = parsedBlocks.success && parsedBlocks.data.length > 0;

  if (hasBlocks) {
    return (
      <BlocksPostEditor
        role={profile.role}
        tags={tags}
        requireReview={publicEnv.requireManagerReview}
        initialPost={{
          ...post,
          blocks: parsedBlocks.data,
          tag_ids: post.tags.map((t) => t.id),
        }}
      />
    );
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
