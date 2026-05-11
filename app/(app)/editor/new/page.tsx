import type { Metadata } from "next";
import { requireAuthor } from "@/lib/auth/guards";
import { listTags } from "@/lib/db/tags";
import { PostEditor } from "@/components/editor/PostEditor";
import { WEEKLY_TEMPLATE } from "@/lib/editor/template";
import { publicEnv } from "@/lib/env";

export const metadata: Metadata = { title: "New post" };
export const dynamic = "force-dynamic";

export default async function NewEditorPage() {
  const { profile } = await requireAuthor();
  const tags = await listTags();
  return (
    <PostEditor
      tags={tags}
      role={profile.role}
      requireReview={publicEnv.requireManagerReview}
      initialPost={{
        title: "",
        content_json: WEEKLY_TEMPLATE,
        status: "draft",
        assigned_weekday: profile.weekly_post_day ?? null,
      }}
    />
  );
}
