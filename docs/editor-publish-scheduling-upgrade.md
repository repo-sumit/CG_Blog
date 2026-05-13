# Editor: publish + scheduling upgrade

This document describes the editor flow introduced by the May 2026 upgrade.
The previous "Publish" button silently auto-scheduled posts based on the
author's assigned weekday. That behaviour was opaque and inconsistent. It has
been replaced with three explicit actions.

## Three publish actions

The editor now exposes exactly three actions in a horizontal action bar at
the top of the page (stacked on mobile):

| Button | Server status | Side effects |
|---|---|---|
| **Save Draft** | `draft` | Persists content. Not visible publicly. No emails. |
| **Schedule Post** | `scheduled` | Opens the date/time modal. `scheduled_for` is required and must be in the future. |
| **Post Now** | `published` | Publishes immediately. Fires the per-post newsletter exactly once. |

Title is required before either Schedule Post or Post Now becomes clickable.
Save Draft is always available — drafts may persist with no title so autosave
keeps working while the author is still figuring out what to call the post.

## Scheduling flow

`Schedule Post` opens [`SchedulePostModal`](../components/editor/SchedulePostModal.tsx),
a small dialog with a native `datetime-local` input (best-in-class mobile
keyboards, no third-party deps). The picker is seeded with **tomorrow 09:00
local time** if no schedule exists yet, or with the current `scheduled_for`
when editing an existing scheduled post.

Validation:

- Empty input → "Pick a date and time."
- Parse failure → "That date and time isn't valid."
- Slot is in the past → "Choose a future date and time."

On confirm, the modal hands an ISO 8601 string back to the editor. The server
re-validates that the slot is in the future before writing the row — never
trust the client.

## State transitions

```
draft  ──(Schedule Post)──▶  scheduled  ──(slot reached)──▶  published
draft  ──(Post Now)─────────────────────────────────────▶  published
scheduled  ──(Edit Schedule)──▶  scheduled (new slot)
scheduled  ──(Post Now)───────▶  published
scheduled  ──(Back to Draft)──▶  draft
```

The "Edit schedule / Post now / Back to draft" controls are only rendered
when the post is in `scheduled` state — they live in the right-hand sidebar
status card.

## Visibility rules

The public reading layer (`lib/db/public.ts`) is hard-pinned to
`status = 'published'`. Anyone hitting `/posts/<slug>` while a post is
scheduled gets a 404. Authors and managers reach the row through
`getPostById` (no status filter), which is gated by RLS to row owners +
managers.

## Auto-publish cron

[`app/api/cron/publish-scheduled/route.ts`](../app/api/cron/publish-scheduled/route.ts)
runs daily at 09:00 UTC (Vercel Hobby plan limit; bump to `*/5 * * * *` on
Pro). It:

1. Loads posts where `status = 'scheduled'` and `scheduled_for <= now()`.
2. Updates each row to `status = 'published'`, `published_at = scheduled_for`.
3. Calls `sendPerPostNewsletter(postId)` — which is itself idempotent.

Why daily on Hobby is fine for a weekly cadence: posts scheduled for date X
at 09:00 UTC are picked up by the same-day 09:00 UTC cron run. If you need
faster catch-up, use cron-job.org / GitHub Actions to hit the URL more often
with the same `Authorization: Bearer $CRON_SECRET` header.

## Per-post newsletter (idempotent)

The newsletter is dispatched exactly once per post by
[`lib/email/newsletter.ts`](../lib/email/newsletter.ts):

1. Conditional update: `set newsletter_sent_at = now() where id = ? and newsletter_sent_at is null`.
2. If 0 rows updated → another worker already claimed the dispatch, bail.
3. Otherwise pull subscribers, send the digest template with this single post
   as its payload, log per-recipient failures.

Race conditions between `Post Now` (which fires the function inline) and the
publish-scheduled cron are handled by the conditional update — the first
caller wins, the loser is a no-op.

The function is a no-op when `RESEND_API_KEY` / `RESEND_FROM` are unset, so
the publish flow keeps working even without email configured.

## Autosave

Autosave debounce is **15 seconds** (`AUTOSAVE_MS = 15_000` in
[`PostEditor.tsx`](../components/editor/PostEditor.tsx)). Edits during an
in-flight save mark the document as dirty again so the next autosave fires
after the round-trip completes — no save can be lost mid-typing.

Save indicator copy:

- `Saving…`
- `Draft saved · 14:32`
- `Unsaved changes`
- `Save failed`

These render in the top-right of the editor as `aria-live="polite"` so
screen readers announce status changes.

## Thumbnail

Behaviour is unchanged from the prior pass — see
[`PostEditor.tsx`](../components/editor/PostEditor.tsx) "Thumbnail" card.
Users can pick from images already attached to the post (`/api/media/list`)
or upload a new file. Cover is stored as `posts.cover_media_id` referencing
`media_assets`.

## Migrations

```
supabase/migrations/0009_newsletter_sent_at.sql
```

Adds `posts.newsletter_sent_at timestamptz` plus a partial index for unsent
rows. Existing rows are treated as "not yet sent" (NULL).
