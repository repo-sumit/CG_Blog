import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lists the image media_assets attached to a post that the caller owns —
 * fuels the editor's "choose an existing image as thumbnail" picker. Returns
 * a stable `url` pointing at /api/media/file so the picker can render previews
 * without leaking signed URLs to the client bundle.
 */
export async function GET(request: NextRequest) {
  const postId = request.nextUrl.searchParams.get("postId");
  if (!postId || !UUID_RE.test(postId)) {
    return NextResponse.json({ error: "Invalid postId" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // RLS already restricts visibility to assets the user owns (or is a manager
  // for); the eq filters keep the projection tight.
  const { data, error } = await supabase
    .from("media_assets")
    .select("id, storage_path, mime_type, title, created_at, post_id")
    .eq("post_id", postId)
    .eq("media_type", "image")
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const images = (data ?? [])
    .map((r) => r as { id: string; storage_path: string | null; mime_type: string | null; title: string | null; created_at: string })
    .filter((r) => !!r.storage_path)
    .map((r) => ({
      id: r.id,
      title: r.title,
      mimeType: r.mime_type,
      createdAt: r.created_at,
      url: `/api/media/file?path=${encodeURIComponent(r.storage_path!)}`,
    }));

  return NextResponse.json({ ok: true, images });
}
