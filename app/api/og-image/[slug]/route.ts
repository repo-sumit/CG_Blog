import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COVER_BUCKET = "blog-media";
// 7 days is Supabase Storage's maximum signed-URL TTL. Crawlers cache the
// image bytes at THEIR side after the redirect resolves once, so the
// short-vs-long signed-URL distinction stops mattering after the first hit
// — but a longer TTL means a sane Cache-Control for the 302 reply too.
const SIGNED_TTL = 60 * 60 * 24 * 7;

/**
 * Stable, public-readable URL for a post's cover image. WhatsApp / Slack /
 * Twitter / Gmail all cache `og:image` and email-body images at the URL
 * they were given. Pointing them at a signed Supabase URL meant the cached
 * URL was useless 1 hour later — the next crawler fetch returned 401.
 *
 * This route fixes that by being itself the stable URL. On every request
 * it re-signs the underlying storage object and 302-redirects. The crawler
 * follows the redirect, fetches the bytes, caches them, and forgets the
 * signed URL ever existed.
 *
 * Fallback: if the post has no cover (or the cover lookup fails for any
 * reason), redirect to `/og-default.png` so previews still show a branded
 * image instead of breaking entirely.
 */
export async function GET(_request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const defaultUrl = new URL("/og-default.png", publicEnv.appUrl).toString();

  const service = createSupabaseServiceClient();
  const { data: postRow } = await service
    .from("posts")
    .select("status, cover_media_id")
    .eq("slug", params.slug)
    .eq("status", "published")
    .maybeSingle();

  const post = postRow as { status: string; cover_media_id: string | null } | null;
  if (!post?.cover_media_id) {
    return NextResponse.redirect(defaultUrl, { status: 302 });
  }

  const { data: mediaRow } = await service
    .from("media_assets")
    .select("storage_path")
    .eq("id", post.cover_media_id)
    .maybeSingle();
  const path = (mediaRow as { storage_path?: string | null } | null)?.storage_path;
  if (!path) return NextResponse.redirect(defaultUrl, { status: 302 });

  const { data: signed } = await service.storage
    .from(COVER_BUCKET)
    .createSignedUrl(path, SIGNED_TTL);
  if (!signed?.signedUrl) return NextResponse.redirect(defaultUrl, { status: 302 });

  // Short cache so subsequent crawlers / refreshes don't re-do the DB work,
  // while still letting cover changes propagate within a working day.
  const res = NextResponse.redirect(signed.signedUrl, { status: 302 });
  res.headers.set("Cache-Control", "public, max-age=3600, s-maxage=3600");
  return res;
}
