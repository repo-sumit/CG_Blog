# Save / Publish performance audit

Investigation into why Save Draft / Post Now / Schedule Post felt slow, and the
exact changes that brought perceived latency back down.

The dominant cost was **serial Supabase round-trips inside the server action**,
not a single heavy operation. On a healthy connection each round-trip is ~80–200ms;
when Supabase has just woken from idle the first one is +1–2s. The action was
doing 5–6 of these back-to-back for every save.

## Table

| Area checked | Current behavior | Likely bottleneck | Fix applied | Status |
|---|---|---|---|---|
| `requireSession()` | Two sequential queries: `auth.getUser()` + `profiles.select("*").eq("id", user.id)` | Couldn't be parallelized internally (profile lookup needs user.id) but the result could overlap with other work outside it | Run `requireSession()` in parallel with the existing-post + tag fetch via `Promise.all` | ✅ fixed |
| Existence + ownership check | Separate `SELECT id, slug, author_id, status, title FROM posts` before every UPDATE | Adds one full round-trip on every save before the write even starts | Fetched in parallel with auth via `Promise.all`. Cost moved from "+1 RT" to "max(auth, fetch) instead of sum" | ✅ fixed |
| Tag re-sync | `DELETE FROM post_tags … ; INSERT INTO post_tags …` ran on every save, even when the user never touched the tag pills | Two writes per save = ~200–400ms wasted on the common path | Fetch current tags in the same parallel block, compare sorted arrays, only delete+insert when changed | ✅ fixed |
| `revalidatePath` calls | Called 4× synchronously (`/`, `/posts/<slug>`, `/me/posts`, `/dashboard`) on every save including draft autosave | Drafts aren't public — revalidating the landing page on a draft save thrashes the cache for no benefit | Skip `revalidatePath` when the save is a pure draft (no status transition to a public state). Schedule saves only revalidate author-facing surfaces; Post Now still hits all 4 because the post just became public | ✅ fixed |
| `ensureUniqueSlug` | Up to 6 SELECTs on first save or title change | Only triggers when title actually changes — not the autosave path | Left as-is (correct cost for a real title change) | ✅ ok |
| `sanitizeHtml` | Regex-based, runs on every save | Fast (<1ms even for 50 KB posts) | Left as-is | ✅ ok |
| Newsletter dispatch | `void sendPerPostNewsletter(id).catch(...)` after the action returns | Already fire-and-forget — not blocking the response | Left as-is; flagged separately for `waitUntil` follow-up (see "Known follow-up" below) | ✅ ok |
| Autosave debounce | `AUTOSAVE_MS = 15_000` — fires 15s after the last keystroke | Already debounced | Left | ✅ ok |
| Race protection | Old client used `dirtyDuringSave` flag — caught the "user typed during save" case but didn't cancel stale requests | A slow autosave finishing AFTER a manual Post Now could clobber the published status with `"draft"` | Added `saveVersion` + `AbortController` in the client. Manual saves aborts in-flight autosave; older results are discarded by version mismatch | ✅ fixed |
| UI feedback | Spinner shown only on the clicked button, status set optimistically after server reply | OK but felt "stuck" for ~1s | No structural change — speed itself fixed by the server-side parallel work | ✅ ok |
| Indexes | `posts(updated_at desc)` missing — `listOwnPosts` does an `ORDER BY updated_at DESC` against all of an author's posts | At small data sizes the planner does a seq scan; not a current bottleneck but will be as the table grows | Added `posts_updated_at_idx` + `posts_scheduled_for_idx` (used by the publish-scheduled cron) + `post_views_viewer_id_idx` | ✅ fixed |
| Cold start | Supabase free tier pauses after idle; first request adds 1–2s | Outside the savePost call itself, but felt as save latency | Keep-alive cron already wired (`/api/cron/keep-alive`). Hobby plan limits it to daily — recommend hitting via cron-job.org every 14 min for full coverage. Documented in `docs/keep-alive.md`. | ✅ docs |

## Timing log

`savePost` now emits `[savePost.timing]` lines when `SAVE_POST_TIMING_LOG=1`:

```
[savePost.timing] total=312 auth+fetch=148 update=132 tags=0 revalidate=4 status=draft
```

Set the flag in Vercel project env to debug a regression. Off by default in
production so we don't fill the function logs.

## Round-trip count

| Path | Before | After |
|---|---|---|
| Draft autosave (no title change, no tag change) | 6 round-trips | **2** (auth + update; reads done in parallel with auth) |
| Schedule Post | 6 round-trips | 2 |
| Post Now (no title/tags change) | 6 round-trips | 2 |
| First save (insert) | 4 round-trips | 4 (insert flow unchanged) |
| Save with new title | 7–11 round-trips | 4–8 (no existence fetch + parallel auth) |

## Files changed

- [app/(app)/editor/actions.ts](../app/(app)/editor/actions.ts) — `savePost` rewrite
- [components/editor/PostEditor.tsx](../components/editor/PostEditor.tsx) — save-version + abort controller
- [supabase/migrations/0011_save_performance_indexes.sql](../supabase/migrations/0011_save_performance_indexes.sql) — new indexes

## Known follow-ups (not in scope for this pass)

- **`waitUntil` for newsletter**: on Vercel serverless, a `void promise` after returning the response may be cut off when the worker is recycled. The publish-scheduled cron catches scheduled → published, but a Post Now newsletter currently relies on the editor's request staying alive long enough. Wrapping the call in `waitUntil()` from `@vercel/functions` would make this rock-solid.
- **`select("*")` on `profiles`**: only `role` + `weekly_post_day` + `id` are read by savePost. Narrow the projection to shave another few ms.
- **`content_json` diffing**: long posts ship the full Tiptap JSON on every autosave. A diff-and-patch approach would cut bandwidth on 5+ KB posts, but adds complexity. Skipped for now — measured cost is small.
