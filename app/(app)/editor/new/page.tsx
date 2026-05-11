import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuthor } from "@/lib/auth/guards";
import { listTags } from "@/lib/db/tags";
import { PostEditor } from "@/components/editor/PostEditor";
import { BlocksPostEditor } from "@/components/editor/BlocksPostEditor";
import { WEEKLY_TEMPLATE } from "@/lib/editor/template";
import { publicEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { weekStartISO } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "New post" };
export const dynamic = "force-dynamic";

/**
 * /editor/new            → block-based editor (the new default)
 * /editor/new?mode=tiptap → legacy Tiptap editor
 * /editor/new?force=1    → bypass "continue existing draft" redirect
 */
export default async function NewEditorPage({
  searchParams,
}: {
  searchParams: { force?: string; mode?: string };
}) {
  const { profile, userId } = await requireAuthor();
  const useTiptap = searchParams.mode === "tiptap";

  if (searchParams.force !== "1") {
    const supabase = createSupabaseServerClient();
    const { data: existing } = await supabase
      .from("posts")
      .select("id")
      .eq("author_id", userId)
      .eq("week_start_date", weekStartISO())
      .in("status", ["draft", "submitted"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) {
      redirect(`/editor/${(existing as { id: string }).id}`);
    }
  }

  const tags = await listTags();

  if (useTiptap) {
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

  return (
    <BlocksPostEditor
      tags={tags}
      role={profile.role}
      requireReview={publicEnv.requireManagerReview}
      initialPost={{
        title: "",
        blocks: [],
        status: "draft",
        assigned_weekday: profile.weekly_post_day ?? null,
      }}
    />
  );
}
