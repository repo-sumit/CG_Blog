# Frontend cache audit — CG SIGNAL

A scan of the codebase as of 2026-05-15 to identify where the app re-fetches
data that could be cached safely. The goal is to reduce Supabase calls, make
navigation feel instant, and save mobile data — without breaking auth, RLS,
or publishing freshness.

## Current state at a glance

- **No client-side cache library** is installed. No SWR, no React Query, no
  custom store. Every data read flows through Server Components or a one-off
  `fetch`.
- **Every Next.js route opts into `dynamic = "force-dynamic"`.** This
  disables ISR, route-level caching, and the data cache entirely. Each
  navigation = full re-render + full Supabase round-trip.
- **Revalidation is already wired** in [app/(app)/editor/actions.ts](../app/(app)/editor/actions.ts)
  and [app/(app)/admin/actions.ts](../app/(app)/admin/actions.ts) — every
  publish/tag/role change calls `revalidatePath("/")`,
  `revalidatePath("/posts/${slug}")`, `revalidatePath("/me/posts")`,
  `revalidatePath("/dashboard")` etc. So ISR is **safe to enable** on routes
  that don't mix user-specific data — invalidations are already there to
  respond to writes.
- **`router.refresh()` is used in 7 places** — all of them after a mutating
  server action, which is fine (it asks Next to re-render with the freshly
  invalidated cache rather than reloading the browser).
- **No `window.location.reload()` calls** anywhere. ✓
- **OG image proxy already sets `Cache-Control: public, max-age=3600,
  s-maxage=3600`** ([app/api/og-image/[slug]/route.ts](../app/api/og-image/%5Bslug%5D/route.ts#L65)).
  Adequate for the use case.
- **Media file proxy already sets `Cache-Control: public, max-age=3000,
  s-maxage=3000`** ([app/api/media/file/route.ts](../app/api/media/file/route.ts#L88)).
  Pinned 10 minutes under the signed-URL TTL so browsers always re-resolve
  before signatures expire. Correct.
- **Editor has 15s server-side autosave** but **no local draft backup**. If
  the user closes the tab during a network outage, the work between the last
  successful server save and the crash is lost.

## Area-by-area table

| Area | Current behaviour | Cache exists? | Problem | Recommendation |
|---|---|---|---|---|
| Public landing feed | `force-dynamic` server render. `listPublicPosts`, `listPublicTags`, `listContributorStats` re-run on every nav. | None | 3 Supabase queries × every visitor × every nav. Heavy. | **ISR 60s** — `revalidate = 60` on [app/page.tsx](../app/page.tsx). `revalidatePath("/")` already runs on publish, so freshness is preserved. ✅ DONE in this pass. |
| Tags / categories | Fetched inside landing page render. | Inherits landing | Same as landing. | Covered by landing ISR. |
| Contributor list | Fetched inside landing page render. | Inherits landing | Same as landing. | Covered by landing ISR. |
| Post detail | `force-dynamic`. Mixes public post + per-user `listMyReactions` + session. | None | Per-user data prevents page-level ISR. | **Keep dynamic** for now. Future: `unstable_cache` the `getPublicPostBySlug` call with a tag, `revalidateTag` on publish; render user-specific reactions in a small client component. |
| Reaction counts on cards | Computed in `listPublicPosts → attachEngagementCounts`. | Inherits landing | Same as landing. | Covered by landing ISR. Counts lag by up to 60s on cards — acceptable. |
| Comment counts on cards | Same as above. | Same | Same | Covered by landing ISR. |
| View counts on cards | Same as above. | Same | Same | Covered by landing ISR. |
| Comments on post detail | Server-fetched, `router.refresh()` after add/delete. | None | OK as-is — `router.refresh()` is the cheapest way to re-render server data after a mutation. | No change. |
| Reactions on post detail | Server-fetched, optimistic UI in `ReactionsBar`. | None | Already optimistic at the client. | No change. |
| Public post thumbnails | Resolved server-side via `attachCoverUrls` → 1h signed URLs. | Signed URL is a form of cache. | Signed URLs are per-render so cached requests reuse the same URL. | Covered by landing ISR. |
| OG / unfurl image | Stable `/api/og-image/[slug]` proxy + `Cache-Control: public, max-age=3600`. | Browser + edge | Already correct. | No change. |
| Embedded media in post body | Stable `/api/media/file?path=...` proxy + `Cache-Control: public, max-age=3000`. | Browser + edge | Already correct (10 min under signed-URL TTL). | No change. |
| Dashboard data | `force-dynamic`. Includes user-specific assignment/team data. | None | Per-user data → can't easily ISR. | **Keep dynamic.** Acceptable trade-off; dashboard is a low-traffic page. |
| My Posts | `force-dynamic`. Per-user post list. | None | Per-user data → can't ISR. | **Keep dynamic.** Already `revalidatePath`'d on every relevant edit. |
| Admin Subscribers / Users / Tags / Schedule / Analytics | `force-dynamic`. Manager-only. | None | These pages MUST stay dynamic — they read RLS-locked / service-role data and must reflect writes instantly. | **Keep dynamic.** Caching here is dangerous (stale role assignment, stale subscriber state). |
| Editor draft state (open editor) | TipTap in-memory state + 15s server autosave. | None client-side | Tab crash / network outage between two autosaves = lost work. | **Add localStorage backup** every 2s. Restore prompt if the local snapshot is newer than the server `updated_at` on next mount. ✅ DONE in this pass. |
| Subscribe form state | In-memory React state. | None | Form is one-shot — caching doesn't apply. | No change. |
| Auth session / user role | Supabase auth helpers, server-side. | Auth cookie + Supabase SDK internal cache | Already cached by the SDK. | No change. |
| Subscribers admin list | Manager-only `/admin/subscribers`. | None | Sensitive. | **MUST NOT cache.** Already correct (`force-dynamic`). |
| Signed Supabase URLs | TTL 1h (media file proxy) / 7d (OG proxy). | TTL itself is the cache. | Can't be cached past expiry. | No change. ✅ |

## Cache-rule alignment with spec

| Spec recommendation | What we ship | Why |
|---|---|---|
| Public feed: 5 minutes, refresh in background | **60 seconds** | Vercel's ISR refreshes in background on the next request after expiry — exactly the SWR pattern. We chose 60s instead of 300s because `revalidatePath("/")` fires on every publish, so the cache is purged immediately on writes; the TTL only matters for non-publish updates (a new view count, a new reaction). 60s keeps cards "alive-feeling" without re-running every Supabase query on every nav. |
| Post detail: 10 minutes | **No change (`force-dynamic`)** | Post detail mixes user-specific reactions + session. Page-level ISR would leak one user's reactions to others. Documented as future work: split the page so the public post is `unstable_cache`'d and user-specific bits render client-side. |
| Contributors / tags: 30 minutes | **Inherits landing's 60s** | These are read inside the landing render. Caching them separately would split the cache key without reducing Supabase calls in practice. The data is also cheap (one query each). |
| Counts: 30–60 seconds | **60 seconds** (inherits landing) | Cards' view/reaction/comment counts lag at most 60s. The full counts on the post detail page itself remain real-time. |
| Dashboard / private: 30–60 seconds or none | **`force-dynamic` (no cache)** | Dashboard data is per-user; the safer default is no cache. Pages are fast enough without ISR. |
| Editor drafts: localStorage / IndexedDB | **localStorage** | Drafts are small (JSON + sanitized HTML). 5MB localStorage cap is comfortable. IndexedDB is overkill for the current payload shape. |

## SWR / React Query?

**Not adopted in this pass.** Reasoning:

- The app is overwhelmingly server-rendered. Adding SWR on the client means
  re-implementing every server query as a client query, doubling the data
  shapes and inviting drift.
- Server Components + ISR + `revalidatePath` is the same pattern as SWR
  (stale-while-revalidate, dedupe, on-write invalidation) — just at the
  server boundary instead of the client.
- The two places where client-side caching would matter are (a) reactions
  and (b) comments — and both already use optimistic UI + `router.refresh()`
  for invalidation, which is good enough.

If the project grows a richer client-driven dashboard later, **SWR** would be
the right addition (smaller than React Query, no provider tree, fits a Next
app cleanly). Until then, the cost of adding it outweighs the win.

## Editor draft backup behaviour

Implemented as a small wrapper around `localStorage`:

- Key: `cg_signal_draft_${postId || "new"}`
- Payload: `{ title, excerpt, contentJSON, contentHTML, scheduledFor, tagIds, coverMediaId, status, savedAt }`
- Write: debounced to every 2s of editor activity (separate from the 15s
  server autosave; local writes are cheap and tolerate crashes).
- Clear: on every successful server save with status confirmation.
- Restore prompt: on next mount, if the local snapshot's `savedAt` is newer
  than the server-side `initialPost.updated_at`, show a non-blocking banner
  "Unsaved local changes found — restore?" with Restore / Discard actions.
- Hard cap: skip the write if the JSON payload is >2 MB (browsers throw
  `QuotaExceededError` past ~5 MB; we keep headroom). The banner still warns
  the user even when the snapshot itself wasn't persisted.

What is **never** stored locally:
- Auth tokens
- Service role keys
- Other users' content
- Subscriber emails

## Invalidation strategy

| Trigger | Invalidates | Status |
|---|---|---|
| Post published | `/`, `/posts/${slug}`, `/me/posts`, `/dashboard` | Already wired in `editor/actions.ts` |
| Post saved (any status) | `/me/posts`, `/dashboard` | Already wired |
| Post deleted | `/`, `/me/posts`, `/dashboard` | Already wired |
| Tag added (admin) | `/admin/tags`, `/` | Already wired |
| Tag added (author shortcut) | `/admin/tags`, `/` | Already wired |
| Role allowlist edit | `/admin/users` | Already wired |
| Schedule re-assigned | `/admin/schedule`, `/dashboard` | Already wired |
| Comment add / delete | `/posts/${slug}` | Already wired (`app/posts/[slug]/actions.ts`) |
| Reaction toggle | `/posts/${slug}` | Already wired |

No new invalidation paths needed — every write that affects cached data
already calls `revalidatePath`. The cache TTL is just the fallback for
events Supabase fires *without* going through a Next server action (which
is currently nothing — there's no out-of-band write path).

## Data-savings improvements landed in this pass

| Before | After | Impact |
|---|---|---|
| Landing page re-fetches 3 Supabase queries on every visit | Cached 60s + revalidated on publish | Up to 90%+ Supabase read reduction on the highest-traffic route during a 60s window. Cards' view-count lag bounded to 60s. |
| Editor: tab crash between autosaves = lost work | Local snapshot every 2s + restore prompt on next mount | Worst-case lost work drops from 15s → 2s. Survives full tab/browser crashes. |
| OG image proxy / media file proxy | Already correct | No change |

## What was deliberately NOT changed

- **Post detail page** stays `force-dynamic`. ISR'ing it would either leak
  per-user reactions or require splitting public + user-specific renders,
  which is a bigger refactor and not worth the risk in this pass.
- **All admin / dashboard / my-posts pages** stay `force-dynamic`. They show
  RLS-sensitive or per-user data; caching here trades freshness for almost
  no perf win (these pages are low-traffic).
- **No client-side cache library installed.** Server-side ISR + the existing
  optimistic UI patterns are sufficient. SWR is the natural addition the
  day the app grows a heavy client dashboard.
- **No image versioning / `immutable` cache headers.** The OG proxy and
  media proxy serve the same URL with a TTL-bounded `Cache-Control`. Going
  `immutable` would require versioned filenames on upload, which is a
  storage-layer change with no measurable win for current traffic shape.

## Future work

1. **Post detail caching.** Wrap `getPublicPostBySlug` in `unstable_cache`
   keyed by slug + tagged for `revalidateTag` on publish. Render `myReactions`
   in a small client component that hydrates from the server session. Likely
   ~40 ms saved per post-detail nav.
2. **Offline reader.** Service worker that caches the last 10 visited posts'
   HTML so first-time WhatsApp arrivals work in flight mode. Pairs with the
   subscribe-on-post-end strategy.
3. **SWR adoption.** Only justified once we add a heavy client dashboard
   (e.g. realtime drafts list, multi-user editor presence). Until then,
   stays as planned future work.
