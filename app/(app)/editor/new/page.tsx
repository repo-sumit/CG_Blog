import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuthor } from "@/lib/auth/guards";
import { listTags } from "@/lib/db/tags";
import { PostEditor } from "@/components/editor/PostEditor";
import { WEEKLY_TEMPLATE } from "@/lib/editor/template";
import { publicEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { weekStartISO } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "New post" };
export const dynamic = "force-dynamic";

export default async function NewEditorPage({
  searchParams,
}: {
  searchParams: { force?: string };
}) {
  const { profile, userId } = await requireAuthor();

  // Avoid accidentally creating a second draft for the same week. If one exists,
  // route the author to it. Override with /editor/new?force=1.
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
