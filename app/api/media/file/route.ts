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
 * Access control — two-tier:
 *
 *   1. Signed-in `@convegenius.ai` users: anything goes (middleware already
 *      vetted the session). They can stream their own drafts + anyone's
 *      published media.
 *
 *   2. Anonymous public readers: allowed ONLY if the storage path belongs
 *      to a `media_assets` row whose `post_id` is set AND the post is
 *      `published`. This is what makes embedded images / audio / video
 *      load inside a published post for visitors who never sign in.
 *      Drafts + orphan media (no post_id) stay locked.
 *
 *   3. Anonymous + path doesn't resolve to a published post → 401. The
 *      route never falls through to "everyone can read anything"; the
 *      lookup is the gate.
 *
 * Why service-client for the lookup: `media_assets` RLS scopes reads to
 * the owner. Public readers need to see "is this file attached to a
 * published post" without being the owner of the file. Service-client
 * bypasses RLS for that one specific check — we then enforce our own
 * stricter rule (path → media_asset → post.status === 'published').
 */
export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path");
  if (!path) return new NextResponse("Missing path", { status: 400 });
  if (!PATH_RE.test(path)) return new NextResponse("Invalid path", { status: 400 });

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Anonymous viewer path. Validate that the storage path belongs to a
  // media asset attached to a published post before allowing any access.
  if (!user) {
    const service = createSupabaseServiceClient();
    const { data: row } = await service
      .from("media_assets")
      .select("post_id, post:posts!media_assets_post_id_fkey(status)")
      .eq("storage_path", path)
      .maybeSingle();
    type AssetWithPost = {
      post_id: string | null;
      post: { status: string } | { status: string }[] | null;
    };
    const asset = row as AssetWithPost | null;
    const post = Array.isArray(asset?.post) ? asset?.post[0] : asset?.post;
    if (!asset?.post_id || post?.status !== "published") {
      return new NextResponse("Not found", { status: 404 });
    }
  }

  // Resolve the signed URL (auth'd OR validated-anonymous path reaches here).
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
      // `public` so shared CDNs (Cloudflare in front of Vercel) can also
      // cache the redirect for anonymous viewers. Signed-in users get the
      // same TTL — private vs public doesn't matter because the cached
      // entry is the redirect, not the underlying bytes.
      "Cache-Control": `public, max-age=${CACHE_MAX_AGE}, s-maxage=${CACHE_MAX_AGE}`,
    },
  });
}
