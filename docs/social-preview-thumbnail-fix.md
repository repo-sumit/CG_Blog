# Social preview thumbnail fix

## Current issue

When sharing a CG SIGNAL post on WhatsApp / LinkedIn / Slack / Twitter, the
preview card sometimes shows no image, an outdated image, or a generic
fallback even though the post has a cover thumbnail. The root cause was
addressed in a prior pass; this doc explains what's in place today, why it
works, and how to test it.

## Root cause (from the earlier debug pass)

The original implementation pointed `og:image` directly at a Supabase signed
URL with a 1-hour TTL. Crawlers cache the image URL they're given — the URL
was valid at first share, but every later refetch (and most crawlers refetch
periodically) returned 401, and the cached preview broke. WhatsApp's own
24h cache then served the broken state to every viewer.

The fix is a stable proxy URL that re-signs Supabase Storage on every
crawler hit, instead of baking an expiring URL into the metadata.

## How it works now

```
Crawler                  Our Vercel function           Supabase Storage
───────                  ───────────────────           ────────────────
GET og:image              ↓
                          /api/og-image/[slug]
                          1. Look up post by slug
                          2. Verify status='published'
                          3. Resolve cover_media_id → storage_path
                          4. createSignedUrl(7d TTL)
                          5. 302 redirect
                          ↓                              ↓
                          (follows redirect) ──────────→ signed URL valid
                          ↓
                          Image bytes (cached by crawler thereafter)
```

The crawler caches the **bytes** of the resolved image, not the URL. Even
when the signed URL behind the proxy rotates the next day, every crawler
that already fetched once keeps serving its cached bytes. Subsequent
crawlers hit the proxy → fresh signed URL → fresh bytes.

When the post has no cover, the proxy 302s to `/og-default.png` instead.

## Files involved

| File | Role |
|---|---|
| [app/posts/[slug]/page.tsx](../app/posts/[slug]/page.tsx) | `generateMetadata()` builds the full OG + Twitter block per post |
| [app/page.tsx](../app/page.tsx) | Static OG + Twitter block for the landing `/` URL |
| [app/api/og-image/[slug]/route.ts](../app/api/og-image/[slug]/route.ts) | Stable proxy — re-signs cover storage path on every hit, 302s to default when no cover |
| [lib/seo/get-og-image-url.ts](../lib/seo/get-og-image-url.ts) | Two helpers: `getAbsoluteImageUrl` for any image, `getPostOgImageUrl` for posts |
| [public/og-default.png](../public/og-default.png) | 1200×630 brand fallback (copy of `cg.png`) |
| [lib/supabase/middleware.ts](../lib/supabase/middleware.ts) | `/api/og-image`, `/og-default.png`, `/cg.png` are in `PUBLIC_PATHS` so crawlers reach them without auth |
| [app/(app)/editor/actions.ts](../app/(app)/editor/actions.ts) | `savePost` calls `revalidatePath("/")` and `revalidatePath("/posts/${slug}")` on publish so OG metadata refreshes |

## Metadata shape per post

```html
<title>{title}</title>
<meta name="description" content="{excerpt || fallback}" />
<link rel="canonical" href="{appUrl}/posts/{slug}" />

<meta property="og:title" content="{title}" />
<meta property="og:description" content="{excerpt || fallback}" />
<meta property="og:url" content="{appUrl}/posts/{slug}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="CG Signal" />
<meta property="og:image" content="{appUrl}/api/og-image/{slug}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="{title}" />
<meta property="article:published_time" content="{ISO}" />
<meta property="article:author" content="{author name}" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="{title}" />
<meta name="twitter:description" content="..." />
<meta name="twitter:image" content="{appUrl}/api/og-image/{slug}" />
```

Posts without a cover get `/og-default.png` instead of the proxy URL.

## Why not a fully public Supabase bucket

The spec asked about a public bucket — that's the simplest crawler-safe
URL. We chose **not** to take that path because:

- `blog-media` holds drafts, audio uploads, video uploads, and authenticated
  thumbnails for in-progress posts. Making the bucket public exposes every
  byte to URL-guessing.
- A separate `post-thumbnails` public bucket would require migrating cover
  uploads to a different bucket + dual-write during transition + draft cover
  handling. Significant churn for an outcome the proxy already delivers.
- The proxy validates `post.status === 'published'` before signing — drafts
  and scheduled posts can never leak through it. A public bucket can't make
  that distinction.

The proxy adds one extra ~150ms RTT for the first crawler hit per post. All
caches downstream make it a one-time cost. WhatsApp / LinkedIn / Slack all
follow 302 redirects.

## Draft / scheduled / archived posts

`getPublicPostBySlug` is hard-pinned to `status = 'published'`. Drafts,
future-scheduled posts, and archived posts return `null`, so:

- `generateMetadata` returns `{ title: "Not found" }` — no OG block emitted.
- The page itself `notFound()`s and returns a 404.
- The proxy route ALSO checks `status = 'published'` before signing — if a
  crawler somehow knows the slug of an unpublished post, it gets 302'd to
  the default image, never the real cover.

Three independent gates. Private titles / descriptions / cover bytes never
appear in crawler caches.

## Supabase Storage bucket guidance

Current setup (no changes recommended for now):

- Bucket: `blog-media` (private)
- Per-file cap: 50 MB (default free tier; can be raised via `0012_bucket_file_size_limit.sql`)
- Allowed mime types via `lib/utils/file-validation.ts`: `image/jpeg|png|webp|gif`, `video/mp4|webm|quicktime`, `audio/*` subset

If you ever want a public-bucket setup:

1. Create a new bucket `post-thumbnails` with `public: true` in Supabase.
2. Make `coverUploadToPublicBucket` the path for cover uploads (split from `directUploadMedia`).
3. Store the resulting `https://{ref}.supabase.co/storage/v1/object/public/post-thumbnails/{path}` directly in `posts.cover_url` (a new column).
4. `getPostOgImageUrl` returns that URL when it's set; falls back to the proxy for legacy covers.

The proxy stays around either way — it serves legacy posts uploaded before
the bucket split, and it's the right answer for any media that should stay
private (audio / video / in-post images).

## Revalidation

Already wired in `app/(app)/editor/actions.ts` at the end of `savePost`:

```ts
if (desiredStatus === "published") {
  revalidatePath("/");
  revalidatePath(`/posts/${slug}`);
}
revalidatePath("/me/posts");
```

So changing a thumbnail and re-publishing → the post page revalidates → OG
metadata gets rebuilt → crawlers refetching after that see the new image.

## Testing checklist

After deploying any change to OG metadata:

1. **View source on the live post page.** Confirm the `<meta property="og:image">` tag is present and the URL starts with `https://<your-domain>/api/og-image/...` (or `/og-default.png`). No relative paths, no signed-URL query strings.

2. **Pull metadata with curl** (no caches in the way):

   ```bash
   curl -s "https://<your-domain>/posts/<slug>" | grep -E 'og:|twitter:'
   ```

3. **Use the official debugging tools** — these scrape fresh on demand:
   - [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) — best for clearing the Facebook + WhatsApp side cache.
   - [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)
   - [Twitter Card Validator](https://cards-dev.twitter.com/validator) (login required)

4. **WhatsApp caches for ~24h.** To test a fresh thumbnail in WhatsApp:
   - Append `?v=2` (or any unique query) to the URL the first time you share. WhatsApp treats `…/posts/foo?v=1` as a different URL from `…/posts/foo` and refetches.
   - Or wait for the cache to expire.

5. **Hit the proxy directly** in a browser:

   ```
   https://<your-domain>/api/og-image/<slug>
   ```

   You should land on the cover image (or `/og-default.png` if no cover).
   Any other behaviour means the proxy can't find the post or it isn't
   `published`.

## Common failure cases prevented

| Failure | Prevented by |
|---|---|
| `og:image` is relative path | `getAbsoluteImageUrl` always prefixes `appUrl` |
| `og:image` is signed URL with TTL | Proxy URL is stable; signing happens server-side per request |
| `og:image` is private Supabase route requiring auth | `/api/og-image` is in middleware's `PUBLIC_PATHS` |
| `og:image` points at localhost | `getAbsoluteImageUrl` throws when `NEXT_PUBLIC_APP_URL` is missing; localhost surfaces as the explicit dev fallback |
| Metadata only on client | `generateMetadata` is a server-side function; SSR'd into the response head |
| No fallback image | `/og-default.png` is in `public/` and served by Next |
| Old cached metadata after thumbnail update | `revalidatePath` runs on every publish |
| Draft metadata exposed | `getPublicPostBySlug` returns null for non-published → "Not found" metadata + 404 page + proxy 302 to default |

## Current build status

```
tsc --noEmit          → exit 0
next lint --quiet     → no warnings or errors
vitest run            → 34/34 passing (7 files)
next build            → ✓ 22 routes
```

The `/api/og-image/[slug]` route is in the route table; `/og-default.png`
ships in the static assets; landing + post-detail both have full OG +
Twitter blocks.

## Required env vars

```env
NEXT_PUBLIC_APP_URL=https://<your-production-host>   # required
SUPABASE_SERVICE_ROLE_KEY=...                         # required for proxy
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

`getAbsoluteImageUrl` throws at build time if `NEXT_PUBLIC_APP_URL` is unset
— that's intentional. A missing env is what produces silent broken previews
across the whole site; failing the build is a better outcome.
