import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "blog-media";
const SIGNED_TTL = 60 * 60; // 1 hour — long enough for a typical playback session.
const CACHE_MAX_AGE = 50 * 60; // 50 min — browsers re-resolve before signature expires.

// Path must look like `{uuid}/{uuid|drafts}/...`. Rejecting anything else
// prevents a curious authenticated user from probing arbitrary storage paths.
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const PATH_RE = new RegExp(`^${UUID}/(?:${UUID}|drafts)/[^/].*$`, "i");

/**
 * Re-signs a storage path on demand and 302-redirects the client to the
 * fresh signed URL. Embedded into post HTML as `/api/media/file?path=...`,
 * so video/audio/image URLs never go stale even when the post is years old.
 *
 * Access control is by domain membership (middleware redirects non-domain
 * users before this handler runs). Paths inside posts are referenced only
 * from posts visible to the user via RLS, and paths themselves contain
 * unguessable UUIDs — sufficient for an internal team blog.
 */
export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path");
  if (!path) return new NextResponse("Missing path", { status: 400 });
  if (!PATH_RE.test(path)) return new NextResponse("Invalid path", { status: 400 });

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  // Service client bypasses storage RLS so that viewers (not the owner) can
  // also stream media embedded in published posts. RLS on posts still gates
  // whether viewers can SEE the page containing the URL.
  const service = createSupabaseServiceClient();
  const { data: signed, error } = await service.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_TTL);
  if (error || !signed) {
    return new NextResponse("Not found", { status: 404 });
  }

  return NextResponse.redirect(signed.signedUrl, {
    status: 302,
    headers: {
      "Cache-Control": `private, max-age=${CACHE_MAX_AGE}`,
    },
  });
}
