# Social sharing preview

When a CG SIGNAL post URL is pasted into WhatsApp, Slack, LinkedIn, Twitter/X,
or Google Chat, the message preview now shows the post thumbnail, title, and
short summary instead of the bare URL.

## How it works

[app/posts/[slug]/page.tsx](../app/posts/[slug]/page.tsx) exports
`generateMetadata({ params })` which Next renders into `<meta>` tags on every
post-detail page. The Next.js `Metadata` type maps `openGraph` and `twitter`
keys into the standard `og:…` and `twitter:…` tags every crawler reads.

The function does:

1. Load the post via `getPublicPostBySlug(slug)`.
2. Build an absolute `og:url` from `NEXT_PUBLIC_APP_URL` + the post slug.
3. Pick the image:
   - If the post has a `coverUrl` (the signed Supabase URL we already resolve
     for the public landing card), use it.
   - Otherwise fall back to `/cg.png` — the brand mark in `public/`.
4. Compose a description from the post's `excerpt`, or a generated one like
   `New signal from <author>` if no excerpt is set.
5. Emit OG + Twitter blocks pointing at all of the above.

## What each crawler sees

| Crawler | Reads | Card shape |
|---|---|---|
| WhatsApp | `og:image`, `og:title`, `og:description` | Square image + title + 1-2 lines of description |
| LinkedIn | `og:image`, `og:title`, `og:description`, `og:url` | Large card, title + description below |
| Slack | `og:image`, `og:title`, `og:description` | Inline unfurl with image preview |
| Twitter/X | `twitter:card="summary_large_image"` + `twitter:image/title/description` | Large image card |
| Google Chat | `og:image`, `og:title` | Compact card |
| Facebook | All `og:*` | Standard OG share card |

## Critical requirements (the gotchas)

- **All URLs in OG metadata MUST be absolute.** Relative paths (`/posts/foo`)
  break every crawler — they ignore the tag. We handle this by reading
  `publicEnv.appUrl` server-side and prefixing every URL.
- **`NEXT_PUBLIC_APP_URL` must be set in Vercel** for production. The default
  fallback in `lib/env.ts` (`http://localhost:3000`) generates unshareable
  previews if left in prod. Per the deployment guide this is non-negotiable.
- **The cover image URL must be publicly reachable** by anonymous crawlers.
  Our signed Supabase URLs work because the signature is in the query
  string; the URL is fetchable without auth. The signed URL TTL is 1 hour
  for the public-landing path, longer (7 days) for the email path — either
  is fine for crawler previews because they fetch once at share time.
- **No `noindex` headers** — we leave `robots` on by default for public post
  pages. The root layout sets `robots: { index: false }` for the app shell,
  but `generateMetadata` for `/posts/[slug]` doesn't inherit that block, so
  the post detail page is crawlable.

## Testing

Three options for verifying changes without spamming real chats:

1. **Facebook Sharing Debugger** — https://developers.facebook.com/tools/debug/
   - Paste a post URL. Click "Scrape Again" to bust cache after each edit.
2. **LinkedIn Post Inspector** — https://www.linkedin.com/post-inspector/
3. **Twitter Card Validator** — https://cards-dev.twitter.com/validator
   (Requires login but works on dev URLs too.)

WhatsApp / Slack / Google Chat don't have public debug tools — they cache for
~24h after the first fetch. To test fresh, share the URL with a query string
like `?v=1`, then `?v=2`, etc., to force a re-fetch.

## Files

- [app/posts/[slug]/page.tsx](../app/posts/[slug]/page.tsx) — `generateMetadata`
- [lib/db/public.ts](../lib/db/public.ts) — `coverUrl` resolution on `PublicPost`
- [public/cg.png](../public/cg.png) — default OG image fallback

## Limitations

- The default `cg.png` is a square brand mark. WhatsApp / LinkedIn render
  it cropped to a square card. That's intentional — a wider 1200×630 OG
  fallback could be added later but isn't a regression vs. the previous
  behaviour (no OG image at all).
- The `og:image` URL we emit for posts with covers is a Supabase signed URL.
  These rotate at the TTL boundary — once a crawler has cached the preview,
  the cached image is what users see for up to ~24h even if the post's
  cover changes. If we want instant invalidation we'd switch to a stable
  proxy route (`/api/og/<postId>`) but the current behaviour is fine for
  the first share of a fresh post.
