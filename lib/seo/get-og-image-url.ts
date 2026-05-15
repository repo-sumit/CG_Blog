import { publicEnv } from "@/lib/env";

/**
 * Normalises any image input into an absolute HTTPS URL safe to put in
 * `og:image` / `twitter:image`. Social crawlers (WhatsApp, LinkedIn, Slack,
 * Facebook, Twitter/X) reject relative paths, localhost URLs, and signed
 * URLs that have already expired — so we always:
 *
 *   1. Prefix relative paths with `NEXT_PUBLIC_APP_URL` to make them absolute.
 *   2. Return absolute http(s) URLs untouched.
 *   3. Fall back to `${appUrl}/og-default.png` when nothing was supplied.
 *
 * Throws when `NEXT_PUBLIC_APP_URL` is missing — calling this in a build
 * without that env set would silently produce broken previews everywhere,
 * so the loud failure is by design.
 */
export function getAbsoluteImageUrl(imageUrl?: string | null): string {
  const appUrl = publicEnv.appUrl?.replace(/\/$/, "");
  if (!appUrl || appUrl === "http://localhost:3000") {
    // Localhost falls through to the same default-image branch — it produces
    // valid absolute URLs in dev (e.g. http://localhost:3000/og-default.png)
    // without surprising the rest of the app.
    if (!appUrl) {
      throw new Error("NEXT_PUBLIC_APP_URL is required for Open Graph image URLs");
    }
  }

  if (!imageUrl) {
    return `${appUrl}/og-default.png`;
  }

  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }

  return `${appUrl}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
}

/**
 * For a post detail page: builds the canonical OG image URL.
 * - Posts with a cover image → the `/api/og-image/[slug]` proxy (stable URL
 *   that re-signs the underlying Supabase Storage path on each fetch).
 * - Posts without a cover → the default brand image.
 *
 * Why the proxy and not a direct public-bucket URL: the `blog-media` bucket
 * holds drafts + private media too, so it stays private. The proxy is the
 * single public surface for cover images and validates the storage path
 * belongs to a published post before signing.
 */
export function getPostOgImageUrl(post: {
  slug: string;
  coverUrl?: string | null;
  cover_media_id?: string | null;
}): string {
  const appUrl = publicEnv.appUrl?.replace(/\/$/, "") ?? "";
  if (post.coverUrl || post.cover_media_id) {
    return `${appUrl}/api/og-image/${encodeURIComponent(post.slug)}`;
  }
  return getAbsoluteImageUrl(null);
}
